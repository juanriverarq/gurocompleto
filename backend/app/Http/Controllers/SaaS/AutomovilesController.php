<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\Automovil;
use App\Models\Cliente;
use App\Models\Poliza;
use App\Models\VehBrand;
use App\Models\VehModel;
use App\Models\VehLine;
use App\Models\VehPrice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AutomovilesController extends Controller
{
    private function getBrokerId(Request $request)
    {
        if ($request->has('authenticated_broker_id')) {
            return $request->get('authenticated_broker_id');
        }
        $user = $request->user() ?: Auth::user();
        if ($user && $user->broker_id) return $user->broker_id;
        abort(401, 'No autenticado');
    }

    public function index(Request $request)
    {
        $brokerId = $this->getBrokerId($request);
        $perPage = (int)($request->get('per_page', 15));
        $search = trim((string)$request->get('search', ''));
        $polizaId = $request->get('poliza_id');
        $placaExact = $request->get('placa');

        $query = Automovil::where('broker_id', $brokerId)->with(['client','poliza','brand','vehModel']);
        if (!empty($polizaId)) {
            // Cuando filtra por póliza, traer también los autos del mismo cliente cuya
            // placa coincida con `polizas.vehicle_plates`. Esto cubre el caso donde el
            // automóvil quedó vinculado a una póliza vieja (renovaciones de SOAT/RTM)
            // pero la nueva tiene el cliente y la placa correctos.
            $poliza = \App\Models\Poliza::where('broker_id', $brokerId)
                ->where('id', (int)$polizaId)
                ->first(['id', 'client_id', 'vehicle_plates']);

            $polizaPlates = [];
            if ($poliza) {
                $vp = $poliza->vehicle_plates;
                if (is_string($vp)) { $vp = json_decode($vp, true) ?: []; }
                if (is_array($vp)) {
                    $polizaPlates = array_values(array_filter(array_map(
                        fn($p) => strtoupper(trim((string)$p)),
                        $vp
                    )));
                }
            }

            $query->where(function ($q) use ($polizaId, $poliza, $polizaPlates) {
                $q->where('poliza_id', (int)$polizaId);
                if ($poliza && $poliza->client_id && !empty($polizaPlates)) {
                    $q->orWhere(function ($q2) use ($poliza, $polizaPlates) {
                        $q2->where('client_id', $poliza->client_id)
                           ->whereIn(\DB::raw('UPPER(placa)'), $polizaPlates);
                    });
                }
            });
        }
        if (!empty($placaExact)) {
            $query->where('placa', strtoupper(trim((string)$placaExact)));
        }
        if ($search !== '') {
            $query->where(function($q) use ($search) {
                $q->where('placa', 'like', "%{$search}%")
                  ->orWhere('marca', 'like', "%{$search}%")
                  ->orWhere('modelo', 'like', "%{$search}%")
                  ->orWhere('vin', 'like', "%{$search}%");
            });
        }

        // Filtro por tab (estado de vencimiento / sincronización)
        $tab = (string) $request->get('tab', '');
        $today = now()->toDateString();
        $in30 = now()->addDays(30)->toDateString();
        switch ($tab) {
            case 'proximos':
                // SOAT o RTM con vencimiento entre HOY y HOY+30
                $query->where(function ($q) use ($today, $in30) {
                    $q->whereBetween('fecha_vencimiento_soat', [$today, $in30])
                      ->orWhereBetween('fecha_vencimiento_rtm', [$today, $in30]);
                });
                break;
            case 'vencidos':
                // SOAT o RTM ya vencido
                $query->where(function ($q) use ($today) {
                    $q->where('fecha_vencimiento_soat', '<', $today)
                      ->orWhere('fecha_vencimiento_rtm', '<', $today);
                });
                break;
            case 'sin_datos_runt':
                // Ya se consultó al RUNT pero no llegaron SOAT ni RTM (mismatch propietario)
                $query->whereNotNull('runt_consulted_at')
                      ->whereNull('fecha_vencimiento_soat')
                      ->whereNull('fecha_vencimiento_rtm');
                break;
            case 'no_sincronizados':
                // Nunca se ha consultado al RUNT
                $query->whereNull('runt_consulted_at');
                break;
        }

        $query->orderBy('placa');
        $autos = $query->paginate($perPage);

        // Transformar para exponer nombre de cliente y número de póliza
        $transformed = $autos->through(function ($a) {
            $clienteNombre = null;
            if ($a->poliza && $a->poliza->client_name) {
                $clienteNombre = $a->poliza->client_name;
            } elseif ($a->client) {
                $first = $a->client->first_name ?? ($a->client->nombre ?? '');
                $last = $a->client->last_name ?? ($a->client->apellidos ?? '');
                $clienteNombre = trim(($first . ' ' . $last));
            }
            // Derivar marca/modelo desde catálogos si los campos de texto están vacíos
            $derivedMarca = $a->marca ?: ($a->brand?->name ?? null);
            $derivedModelo = $a->modelo ?: ($a->vehModel?->name ?? null);
            $derivedAnio = $a->anio;
            if ($derivedAnio === null && $a->vehModel && is_numeric($a->vehModel->name)) {
                $val = (int)$a->vehModel->name;
                // filtrar valores no válidos
                if ($val >= 1900 && $val <= 2100) { $derivedAnio = $val; }
            }
            // Precio asegurado y meta
            $insuredValue = null; $insuredMeta = null;
            if ($a->brand_id && $a->model_id) {
                $priceQ = VehPrice::where('brand_id', $a->brand_id)->where('model_id', $a->model_id);
                if ($a->line_id) { $priceQ->where('line_id', $a->line_id); }
                $price = $priceQ->first();
                if ($price) {
                    $insuredValue = (int)$price->amount;
                    $insuredMeta = [
                        'clase' => $price->clase,
                        'referencia1' => $price->referencia1,
                        'referencia2' => $price->referencia2,
                        'referencia3' => $price->referencia3,
                    ];
                }
            }
            return [
                'id' => $a->id,
                'placa' => $a->placa,
                'marca' => $derivedMarca,
                'modelo' => $derivedModelo,
                'anio' => $derivedAnio,
                'vin' => $a->vin,
                'color' => $a->color,
                'client_id' => $a->client_id,
                'poliza_id' => $a->poliza_id,
                'client_name' => $clienteNombre,
                'policy_number' => $a->poliza?->policy_number,
                // extendidos
                'tipo_servicio' => $a->tipo_servicio,
                'clase' => $a->clase,
                'linea' => $a->linea,
                'tipo_carroceria' => $a->tipo_carroceria,
                'numero_motor' => $a->numero_motor,
                'numero_chasis' => $a->numero_chasis,
                'numero_serie' => $a->numero_serie,
                'cilindraje' => $a->cilindraje,
                'combustible' => $a->combustible,
                'capacidad_pasajeros' => $a->capacidad_pasajeros,
                'capacidad_carga_kg' => $a->capacidad_carga_kg,
                'tipo_transmision' => $a->tipo_transmision,
                'traccion' => $a->traccion,
                'pais_origen' => $a->pais_origen,
                'brand_id' => $a->brand_id,
                'model_id' => $a->model_id,
                'line_id' => $a->line_id,
                'insured_value' => $insuredValue,
                'insured_meta' => $insuredMeta,
                // SOAT
                'numero_soat' => $a->numero_soat,
                'fecha_inicio_soat' => $a->fecha_inicio_soat?->format('Y-m-d'),
                'fecha_vencimiento_soat' => $a->fecha_vencimiento_soat?->format('Y-m-d'),
                'aseguradora_soat' => $a->aseguradora_soat,
                'estado_soat' => $a->estado_soat,
                // RTM
                'numero_certificado_rtm' => $a->numero_certificado_rtm,
                'fecha_expedicion_rtm' => $a->fecha_expedicion_rtm?->format('Y-m-d'),
                'fecha_vencimiento_rtm' => $a->fecha_vencimiento_rtm?->format('Y-m-d'),
                'nombre_cda_rtm' => $a->nombre_cda_rtm,
                'estado_rtm' => $a->estado_rtm,
                // Estado legal
                'estado_automotor' => $a->estado_automotor,
                'gravamenes' => $a->gravamenes,
                'prendas' => $a->prendas,
                'organismo_transito' => $a->organismo_transito,
                'fecha_registro_runt' => $a->fecha_registro_runt?->format('Y-m-d'),
                // Propietario
                'propietario_nombre' => $a->propietario_nombre,
                'propietario_documento' => $a->propietario_documento,
                // Meta
                'runt_consulted_at' => $a->runt_consulted_at?->format('Y-m-d H:i:s'),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $transformed,
        ]);
    }

    /**
     * Contadores por tab para el listado de automoviles.
     */
    public function tabCounts(Request $request)
    {
        $brokerId = $this->getBrokerId($request);
        $today = now()->toDateString();
        $in30 = now()->addDays(30)->toDateString();

        $base = fn() => Automovil::where('broker_id', $brokerId);

        return response()->json([
            'success' => true,
            'data' => [
                'todos' => $base()->count(),
                'proximos' => $base()->where(function ($q) use ($today, $in30) {
                    $q->whereBetween('fecha_vencimiento_soat', [$today, $in30])
                      ->orWhereBetween('fecha_vencimiento_rtm', [$today, $in30]);
                })->count(),
                'vencidos' => $base()->where(function ($q) use ($today) {
                    $q->where('fecha_vencimiento_soat', '<', $today)
                      ->orWhere('fecha_vencimiento_rtm', '<', $today);
                })->count(),
                'sin_datos_runt' => $base()->whereNotNull('runt_consulted_at')
                                            ->whereNull('fecha_vencimiento_soat')
                                            ->whereNull('fecha_vencimiento_rtm')
                                            ->count(),
                'no_sincronizados' => $base()->whereNull('runt_consulted_at')->count(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $brokerId = $this->getBrokerId($request);
        $validated = $request->validate([
            'placa' => ['required','string','max:20','regex:/^[A-Za-z0-9-]{3,20}$/'],
            'marca' => 'nullable|string|max:100',
            'modelo' => 'nullable|string|max:100',
            'anio' => 'nullable|integer|min:1900|max:2100',
            'vin' => 'nullable|string|max:32',
            'color' => 'nullable|string|max:50',
            // Campos extendidos (Excel)
            'tipo_servicio' => 'nullable|string|max:100',
            'clase' => 'nullable|string|max:100',
            'referencia1' => 'nullable|string|max:150',
            'referencia2' => 'nullable|string|max:150',
            'referencia3' => 'nullable|string|max:150',
            'linea' => 'nullable|string|max:100',
            'tipo_carroceria' => 'nullable|string|max:100',
            'numero_motor' => 'nullable|string|max:64',
            'numero_chasis' => 'nullable|string|max:64',
            'numero_serie' => 'nullable|string|max:64',
            'cilindraje' => 'nullable|integer|min:0',
            'combustible' => 'nullable|string|max:50',
            'capacidad_pasajeros' => 'nullable|integer|min:0',
            'capacidad_carga_kg' => 'nullable|integer|min:0',
            'tipo_transmision' => 'nullable|string|max:50',
            'traccion' => 'nullable|string|max:50',
            'pais_origen' => 'nullable|string|max:100',
            'client_id' => 'nullable|integer|exists:clientes,id',
            'poliza_id' => 'nullable|integer|exists:polizas,id',
            'custom_fields' => 'nullable|array',
            // Catálogos
            'brand_id' => 'nullable|integer|exists:veh_brands,id',
            'model_id' => 'nullable|integer|exists:veh_models,id',
            'line_id' => 'nullable|integer|exists:veh_lines,id',
        ]);

        // Normalizar placa a mayúsculas
        $placa = strtoupper($validated['placa']);
        $exists = Automovil::where('broker_id', $brokerId)->where('placa', $placa)->first();
        if ($exists) {
            return response()->json([
                'success' => false,
                'message' => 'La placa ya existe para este broker',
            ], 409);
        }

        // Verificar pertenencia de client/poliza al broker
        if (!empty($validated['client_id'])) {
            $cli = Cliente::where('broker_id', $brokerId)->where('id', $validated['client_id'])->first();
            if (!$cli) return response()->json(['success'=>false,'message'=>'Cliente no pertenece al broker'],422);
        }
        if (!empty($validated['poliza_id'])) {
            $pol = Poliza::where('broker_id', $brokerId)->where('id', $validated['poliza_id'])->first();
            if (!$pol) return response()->json(['success'=>false,'message'=>'Póliza no pertenece al broker'],422);
        }

        $auto = Automovil::create([
            'broker_id' => $brokerId,
            'placa' => $placa,
            'marca' => $validated['marca'] ?? null,
            'modelo' => $validated['modelo'] ?? null,
            'anio' => $validated['anio'] ?? null,
            'vin' => $validated['vin'] ?? null,
            'color' => $validated['color'] ?? null,
            'tipo_servicio' => $validated['tipo_servicio'] ?? null,
            'clase' => $validated['clase'] ?? null,
            'referencia1' => $validated['referencia1'] ?? null,
            'referencia2' => $validated['referencia2'] ?? null,
            'referencia3' => $validated['referencia3'] ?? null,
            'linea' => $validated['linea'] ?? null,
            'tipo_carroceria' => $validated['tipo_carroceria'] ?? null,
            'numero_motor' => $validated['numero_motor'] ?? null,
            'numero_chasis' => $validated['numero_chasis'] ?? null,
            'numero_serie' => $validated['numero_serie'] ?? null,
            'cilindraje' => $validated['cilindraje'] ?? null,
            'combustible' => $validated['combustible'] ?? null,
            'capacidad_pasajeros' => $validated['capacidad_pasajeros'] ?? null,
            'capacidad_carga_kg' => $validated['capacidad_carga_kg'] ?? null,
            'tipo_transmision' => $validated['tipo_transmision'] ?? null,
            'traccion' => $validated['traccion'] ?? null,
            'pais_origen' => $validated['pais_origen'] ?? null,
            'brand_id' => $validated['brand_id'] ?? null,
            'model_id' => $validated['model_id'] ?? null,
            'line_id' => $validated['line_id'] ?? null,
            'client_id' => $validated['client_id'] ?? null,
            'poliza_id' => $validated['poliza_id'] ?? null,
            'custom_fields' => $validated['custom_fields'] ?? null,
        ]);

        return response()->json(['success'=>true,'data'=>$auto],201);
    }

    public function show(Request $request, int $id)
    {
        $brokerId = $this->getBrokerId($request);
        $auto = Automovil::where('broker_id', $brokerId)->where('id', $id)->first();
        if (!$auto) return response()->json(['success'=>false,'message'=>'Automóvil no encontrado'],404);
        return response()->json(['success'=>true,'data'=>$auto]);
    }

    public function update(Request $request, int $id)
    {
        $brokerId = $this->getBrokerId($request);
        $auto = Automovil::where('broker_id', $brokerId)->where('id', $id)->first();
        if (!$auto) return response()->json(['success'=>false,'message'=>'Automóvil no encontrado'],404);

        $validated = $request->validate([
            'placa' => ['sometimes','required','string','max:20','regex:/^[A-Za-z0-9-]{3,20}$/'],
            'marca' => 'nullable|string|max:100',
            'modelo' => 'nullable|string|max:100',
            'anio' => 'nullable|integer|min:1900|max:2100',
            'vin' => 'nullable|string|max:32',
            'color' => 'nullable|string|max:50',
            // Campos extendidos (Excel)
            'tipo_servicio' => 'nullable|string|max:100',
            'clase' => 'nullable|string|max:100',
            'referencia1' => 'nullable|string|max:150',
            'referencia2' => 'nullable|string|max:150',
            'referencia3' => 'nullable|string|max:150',
            'linea' => 'nullable|string|max:100',
            'tipo_carroceria' => 'nullable|string|max:100',
            'numero_motor' => 'nullable|string|max:64',
            'numero_chasis' => 'nullable|string|max:64',
            'numero_serie' => 'nullable|string|max:64',
            'cilindraje' => 'nullable|integer|min:0',
            'combustible' => 'nullable|string|max:50',
            'capacidad_pasajeros' => 'nullable|integer|min:0',
            'capacidad_carga_kg' => 'nullable|integer|min:0',
            'tipo_transmision' => 'nullable|string|max:50',
            'traccion' => 'nullable|string|max:50',
            'pais_origen' => 'nullable|string|max:100',
            'client_id' => 'nullable|integer|exists:clientes,id',
            'poliza_id' => 'nullable|integer|exists:polizas,id',
            'custom_fields' => 'nullable|array',
            // Catálogos
            'brand_id' => 'nullable|integer|exists:veh_brands,id',
            'model_id' => 'nullable|integer|exists:veh_models,id',
            'line_id' => 'nullable|integer|exists:veh_lines,id',
            // SOAT
            'numero_soat' => 'nullable|string|max:64',
            'fecha_inicio_soat' => 'nullable|date',
            'fecha_vencimiento_soat' => 'nullable|date',
            'aseguradora_soat' => 'nullable|string|max:150',
            'estado_soat' => 'nullable|string|max:50',
            // RTM
            'numero_certificado_rtm' => 'nullable|string|max:64',
            'fecha_expedicion_rtm' => 'nullable|date',
            'fecha_vencimiento_rtm' => 'nullable|date',
            'nombre_cda_rtm' => 'nullable|string|max:200',
            'estado_rtm' => 'nullable|string|max:50',
            // Estado legal / RUNT
            'estado_automotor' => 'nullable|string|max:100',
            'gravamenes' => 'nullable|string|max:200',
            'prendas' => 'nullable|string|max:200',
            'organismo_transito' => 'nullable|string|max:200',
            'fecha_registro_runt' => 'nullable|date',
            'propietario_nombre' => 'nullable|string|max:200',
            'propietario_documento' => 'nullable|string|max:50',
        ]);

        if (isset($validated['placa'])) {
            $newPlaca = strtoupper($validated['placa']);
            $dup = Automovil::where('broker_id', $brokerId)
                ->where('placa', $newPlaca)
                ->where('id', '!=', $auto->id)
                ->first();
            if ($dup) return response()->json(['success'=>false,'message'=>'La placa ya existe para este broker'],409);
            $auto->placa = $newPlaca;
        }
        foreach (['marca','modelo','anio','vin','color','tipo_servicio','clase','referencia1','referencia2','referencia3','linea','tipo_carroceria','numero_motor','numero_chasis','numero_serie','cilindraje','combustible','capacidad_pasajeros','capacidad_carga_kg','tipo_transmision','traccion','pais_origen','custom_fields','brand_id','model_id','line_id','numero_soat','fecha_inicio_soat','fecha_vencimiento_soat','aseguradora_soat','estado_soat','numero_certificado_rtm','fecha_expedicion_rtm','fecha_vencimiento_rtm','nombre_cda_rtm','estado_rtm','estado_automotor','gravamenes','prendas','organismo_transito','fecha_registro_runt','propietario_nombre','propietario_documento'] as $f) {
            if (array_key_exists($f, $validated)) $auto->{$f} = $validated[$f];
        }
        if (array_key_exists('client_id', $validated)) {
            if ($validated['client_id']) {
                $cli = Cliente::where('broker_id', $brokerId)->where('id', $validated['client_id'])->first();
                if (!$cli) return response()->json(['success'=>false,'message'=>'Cliente no pertenece al broker'],422);
            }
            $auto->client_id = $validated['client_id'];
        }
        if (array_key_exists('poliza_id', $validated)) {
            if ($validated['poliza_id']) {
                $pol = Poliza::where('broker_id', $brokerId)->where('id', $validated['poliza_id'])->first();
                if (!$pol) return response()->json(['success'=>false,'message'=>'Póliza no pertenece al broker'],422);
            }
            $auto->poliza_id = $validated['poliza_id'];
        }
        $auto->save();
        return response()->json(['success'=>true,'data'=>$auto]);
    }

    public function destroy(Request $request, int $id)
    {
        $brokerId = $this->getBrokerId($request);
        $auto = Automovil::where('broker_id', $brokerId)->where('id', $id)->first();
        if (!$auto) return response()->json(['success'=>false,'message'=>'Automóvil no encontrado'],404);
        $auto->delete();
        return response()->json(['success'=>true]);
    }

    public function syncRuntMasivo(Request $request)
    {
        $brokerId = $this->getBrokerId($request);
        $onlyPending = $request->boolean('only_pending', true);

        $query = Automovil::where('broker_id', $brokerId)
            ->whereNotNull('placa')
            ->where('placa', '!=', '')
            ->whereNotNull('client_id');

        if ($onlyPending) {
            // Solo procesar autos que NUNCA se han consultado, O que se consultaron
            // hace más de 7 días Y todavía les faltan datos (SOAT/RTM). Sin la
            // condición temporal, los autos donde RUNT no devolvió datos serían
            // re-consultados infinitamente en cada batch sin avanzar el cursor.
            $query->where(function ($q) {
                $q->whereNull('runt_consulted_at')
                  ->orWhere(function ($q2) {
                      $q2->where('runt_consulted_at', '<', now()->subDays(7))
                         ->where(function ($q3) {
                             $q3->whereNull('fecha_vencimiento_soat')
                                ->orWhereNull('fecha_vencimiento_rtm');
                         });
                  });
            });
        }

        $limit = (int) $request->get('limit', 50);
        if ($limit < 1) $limit = 50;
        if ($limit > 500) $limit = 500;

        $autos = $query->with('client')->limit($limit)->get();
        $total = $autos->count();

        return response()->stream(function () use ($autos, $total) {
            set_time_limit(0);
            ini_set('max_execution_time', '0');
            // Let PHP notice when the client disconnects so we can break out.
            ignore_user_abort(false);
            while (ob_get_level()) ob_end_flush();

            $send = function ($event, $data) {
                echo "event: {$event}\n";
                echo 'data: ' . json_encode($data) . "\n\n";
                @flush();
                return connection_aborted() === 0;
            };

            if (!$send('init', ['total' => $total])) {
                return;
            }

            $success = 0;
            $failed = 0;
            $skipped = 0;
            $index = 0;
            $cancelled = false;

            foreach ($autos as $auto) {
                // Stop immediately if the client closed the SSE stream.
                if (connection_aborted()) {
                    $cancelled = true;
                    break;
                }
                $index++;
                $documento = $auto->client->document_number ?? null;

                if (!$documento) {
                    $skipped++;
                    $send('progress', [
                        'index' => $index, 'total' => $total,
                        'placa' => $auto->placa, 'status' => 'skipped',
                        'message' => 'Sin documento de cliente',
                        'success' => $success, 'failed' => $failed, 'skipped' => $skipped,
                    ]);
                    continue;
                }

                try {
                    $response = Http::timeout(10)->get('https://historialrunt.org/api/consultar.php', [
                        'placa' => strtoupper($auto->placa),
                        'documento' => $documento,
                    ]);

                    $body = $response->json() ?? [];
                    if (!$response->ok() || empty($body['success'])) {
                        $failed++;
                        $msg = $body['error'] ?? $body['mensaje'] ?? $body['message'] ?? ('HTTP ' . $response->status());
                        // Marcar como consultado si la respuesta llegó (no fue timeout/error de red)
                        // para que el cursor avance en próximas pasadas.
                        if ($response->ok()) {
                            try {
                                $auto->runt_consulted_at = now();
                                $auto->save();
                            } catch (\Throwable $ignored) {}
                        }
                        $send('progress', [
                            'index' => $index, 'total' => $total,
                            'placa' => $auto->placa, 'status' => 'failed',
                            'message' => mb_substr($msg, 0, 120),
                            'success' => $success, 'failed' => $failed, 'skipped' => $skipped,
                        ]);
                        continue;
                    }

                    $this->applyRuntData($auto, $body);
                    // Detectar si la respuesta RUNT trajo info real útil. Si vino con
                    // success:true pero todo vacío, lo marcamos como failed para que
                    // el usuario vea el conteo real de actualizaciones.
                    $hasUsefulData = !empty($body['soat']['fechaVencimSoat'])
                        || !empty($body['rtm']['fechaVencimientoRvt'])
                        || !empty($body['vehiculo']['marca'])
                        || !empty($body['vehiculo']['linea']);

                    if (!$hasUsefulData && !$auto->isDirty()) {
                        // No cambió nada; reportar como fallido informativo.
                        $failed++;
                        $send('progress', [
                            'index' => $index, 'total' => $total,
                            'placa' => $auto->placa, 'status' => 'failed',
                            'message' => 'RUNT respondió OK pero sin datos de SOAT/RTM/vehículo',
                            'success' => $success, 'failed' => $failed, 'skipped' => $skipped,
                        ]);
                        // Igual guardamos runt_consulted_at para no reintentar a ciegas.
                        $auto->runt_consulted_at = now();
                        $auto->save();
                        continue;
                    }

                    $auto->save();
                    $success++;

                    $send('progress', [
                        'index' => $index, 'total' => $total,
                        'placa' => $auto->placa, 'status' => 'success',
                        'soat_venc' => $auto->fecha_vencimiento_soat?->format('Y-m-d'),
                        'rtm_venc' => $auto->fecha_vencimiento_rtm?->format('Y-m-d'),
                        'success' => $success, 'failed' => $failed, 'skipped' => $skipped,
                    ]);
                } catch (\Throwable $e) {
                    $failed++;
                    $send('progress', [
                        'index' => $index, 'total' => $total,
                        'placa' => $auto->placa, 'status' => 'failed',
                        'message' => $e->getMessage(),
                        'success' => $success, 'failed' => $failed, 'skipped' => $skipped,
                    ]);
                }

                // Short pause between RUNT lookups (100ms total), honoring mid-loop abort.
                if (connection_aborted()) { $cancelled = true; break; }
                usleep(100000);
            }

            $send('done', [
                'total' => $total, 'success' => $success,
                'failed' => $failed, 'skipped' => $skipped,
                'cancelled' => $cancelled,
            ]);
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    /**
     * Versión JSON (no streaming) del sync masivo. Recomendada en producción
     * detrás de Apache/Cloudflare donde SSE se buffereaba por mod_deflate /
     * output_buffering. Procesa una tanda corta sincrónicamente y retorna
     * los contadores. El frontend encadena batches sucesivos.
     */
    public function syncRuntMasivoJson(Request $request)
    {
        $brokerId = $this->getBrokerId($request);
        $onlyPending = $request->boolean('only_pending', true);

        $query = Automovil::where('broker_id', $brokerId)
            ->whereNotNull('placa')
            ->where('placa', '!=', '')
            ->whereNotNull('client_id');

        if ($onlyPending) {
            // Mismo fix que syncRuntMasivo: si ya se consultó, no re-consultar a menos
            // que haya pasado 1 semana Y todavía falten SOAT/RTM. Evita el loop infinito
            // sobre autos donde RUNT no devuelve datos por mismatch de propietario.
            $query->where(function ($q) {
                $q->whereNull('runt_consulted_at')
                  ->orWhere(function ($q2) {
                      $q2->where('runt_consulted_at', '<', now()->subDays(7))
                         ->where(function ($q3) {
                             $q3->whereNull('fecha_vencimiento_soat')
                                ->orWhereNull('fecha_vencimiento_rtm');
                         });
                  });
            });
        }

        // Lotes pequeños para caber dentro del timeout de ~100s de Cloudflare.
        // 10 vehículos × ~7s c/u ≈ 70s.
        $limit = (int) $request->get('limit', 10);
        if ($limit < 1) $limit = 10;
        if ($limit > 30) $limit = 30;

        $autos = $query->with('client')->limit($limit)->get();
        $total = $autos->count();
        $success = 0;
        $failed = 0;
        $skipped = 0;
        $items = [];

        @set_time_limit(120);
        @ini_set('max_execution_time', '120');

        foreach ($autos as $auto) {
            $documento = $auto->client->document_number ?? null;
            if (!$documento) {
                $skipped++;
                $items[] = [
                    'placa' => $auto->placa,
                    'status' => 'skipped',
                    'message' => 'Sin documento de cliente',
                ];
                continue;
            }
            try {
                $response = Http::timeout(10)->get('https://historialrunt.org/api/consultar.php', [
                    'placa' => strtoupper($auto->placa),
                    'documento' => $documento,
                ]);
                $body = $response->json() ?? [];
                if (!$response->ok() || empty($body['success'])) {
                    $failed++;
                    $msg = $body['error'] ?? $body['mensaje'] ?? $body['message'] ?? ('HTTP ' . $response->status());
                    // Marcar como consultado incluso si el RUNT respondió "no coincide"
                    // para que el cursor avance y el sync masivo no se quede en loop
                    // sobre los mismos vehículos. Solo evitamos marcar en errores
                    // transitorios (timeout, HTTP 5xx) que sí deben reintentarse.
                    $shouldMark = $response->ok();
                    if ($shouldMark) {
                        try {
                            $auto->runt_consulted_at = now();
                            $auto->save();
                        } catch (\Throwable $ignored) {}
                    }
                    $items[] = [
                        'placa' => $auto->placa,
                        'status' => 'failed',
                        'message' => mb_substr((string) $msg, 0, 160),
                    ];
                    continue;
                }
                $this->applyRuntData($auto, $body);
                $hasUsefulData = !empty($body['soat']['fechaVencimSoat'])
                    || !empty($body['rtm']['fechaVencimientoRvt'])
                    || !empty($body['vehiculo']['marca'])
                    || !empty($body['vehiculo']['linea']);
                if (!$hasUsefulData && !$auto->isDirty()) {
                    $failed++;
                    $auto->runt_consulted_at = now();
                    $auto->save();
                    $items[] = [
                        'placa' => $auto->placa,
                        'status' => 'failed',
                        'message' => 'RUNT respondió OK pero sin datos de SOAT/RTM/vehículo',
                    ];
                    continue;
                }
                $auto->save();
                $success++;
                $items[] = [
                    'placa' => $auto->placa,
                    'status' => 'success',
                    'soat_venc' => $auto->fecha_vencimiento_soat?->format('Y-m-d'),
                    'rtm_venc' => $auto->fecha_vencimiento_rtm?->format('Y-m-d'),
                ];
            } catch (\Throwable $e) {
                $failed++;
                $items[] = [
                    'placa' => $auto->placa,
                    'status' => 'failed',
                    'message' => mb_substr($e->getMessage(), 0, 160),
                ];
            }
            usleep(50000); // 50ms entre llamadas
        }

        return response()->json([
            'success' => true,
            'total' => $total,
            'success_count' => $success,
            'failed' => $failed,
            'skipped' => $skipped,
            'cancelled' => false,
            'items' => $items,
        ]);
    }

    private function applyRuntData(Automovil $auto, array $data): void
    {
        $vehiculo = $data['vehiculo'] ?? [];
        $datosTecnicos = $data['datosTecnicos'] ?? [];
        $soat = $data['soat'] ?? [];
        $rtm = $data['rtm'] ?? [];
        $estadoLegal = $data['estadoLegal'] ?? [];
        $propietario = $data['propietario'] ?? [];

        $vehicleFields = [
            'marca' => $vehiculo['marca'] ?? null,
            'linea' => $vehiculo['linea'] ?? null,
            'color' => $vehiculo['color'] ?? null,
            'cilindraje' => !empty($vehiculo['cilindraje']) ? (int) $vehiculo['cilindraje'] : null,
            'tipo_servicio' => $vehiculo['tipoServicio'] ?? null,
            'clase' => $vehiculo['clase'] ?? null,
            'combustible' => $vehiculo['tipoCombustible'] ?? null,
            'numero_motor' => $datosTecnicos['numMotor'] ?? null,
            'numero_chasis' => $datosTecnicos['numChasis'] ?? null,
            'vin' => $datosTecnicos['vin'] ?? null,
            'tipo_carroceria' => $datosTecnicos['tipoCarroceria'] ?? null,
        ];

        foreach ($vehicleFields as $field => $value) {
            if ($value !== null && ($auto->{$field} === null || $auto->{$field} === '')) {
                $auto->{$field} = $value;
            }
        }

        if (!empty($vehiculo['modelo']) && $auto->anio === null) {
            $auto->anio = (int) $vehiculo['modelo'];
        }

        $auto->numero_soat = $soat['numSoat'] ?? $auto->numero_soat;
        $auto->fecha_inicio_soat = !empty($soat['fechaInicioPoliza']) ? $soat['fechaInicioPoliza'] : $auto->fecha_inicio_soat;
        $auto->fecha_vencimiento_soat = !empty($soat['fechaVencimSoat']) ? $soat['fechaVencimSoat'] : $auto->fecha_vencimiento_soat;
        $auto->aseguradora_soat = $soat['razonSocialAsegur'] ?? $auto->aseguradora_soat;
        $auto->estado_soat = $soat['estadoSoat'] ?? $soat['estado'] ?? $auto->estado_soat;

        $auto->numero_certificado_rtm = $rtm['numeCerti'] ?? $auto->numero_certificado_rtm;
        $auto->fecha_expedicion_rtm = !empty($rtm['fechaExpedicionRvt']) ? $rtm['fechaExpedicionRvt'] : $auto->fecha_expedicion_rtm;
        $auto->fecha_vencimiento_rtm = !empty($rtm['fechaVencimientoRvt']) ? $rtm['fechaVencimientoRvt'] : $auto->fecha_vencimiento_rtm;
        $auto->nombre_cda_rtm = $rtm['nombreCda'] ?? $auto->nombre_cda_rtm;
        $auto->estado_rtm = $rtm['estadoRvt'] ?? $auto->estado_rtm;

        $auto->estado_automotor = $estadoLegal['estadoAutomotor'] ?? $vehiculo['estadoAutomotor'] ?? $auto->estado_automotor;
        $auto->gravamenes = $estadoLegal['gravamenes'] ?? $vehiculo['gravamenes'] ?? $auto->gravamenes;
        $auto->prendas = $estadoLegal['prendas'] ?? $vehiculo['prendas'] ?? $auto->prendas;
        $auto->organismo_transito = $estadoLegal['organismoTransito'] ?? $vehiculo['organismoTransito'] ?? $auto->organismo_transito;
        $auto->fecha_registro_runt = !empty($vehiculo['fechaRegistro']) ? $vehiculo['fechaRegistro'] : $auto->fecha_registro_runt;

        $auto->propietario_nombre = $propietario['nombre'] ?? $auto->propietario_nombre;
        $auto->propietario_documento = $propietario['documento'] ?? $auto->propietario_documento;

        $auto->runt_consulted_at = now();
        $auto->runt_raw_data = $data;
    }

    public function consultarRunt(Request $request, int $id)
    {
        $brokerId = $this->getBrokerId($request);
        $auto = Automovil::where('broker_id', $brokerId)->where('id', $id)->with('client')->first();
        if (!$auto) {
            return response()->json(['success' => false, 'message' => 'Automóvil no encontrado'], 404);
        }

        $placa = $auto->placa;
        if (!$placa) {
            return response()->json(['success' => false, 'message' => 'El automóvil no tiene placa registrada'], 422);
        }

        // Obtener documento del cliente asociado
        $documento = null;
        if ($auto->client) {
            $cliente = $auto->client;
            $documento = $cliente->document_number ?? null;
            if (!$documento && $cliente->client_type === 'EMPRESA') {
                $documento = $cliente->legal_representative_document_number ?? null;
            }
        }

        // Permitir override manual del documento
        if ($request->has('documento') && $request->get('documento')) {
            $documento = $request->get('documento');
        }

        if (!$documento) {
            return response()->json([
                'success' => false,
                'message' => 'No se encontró documento del cliente asociado. Asocie un cliente o envíe el parámetro "documento".',
            ], 422);
        }

        try {
            $response = Http::timeout(30)->get('https://historialrunt.org/api/consultar.php', [
                'placa' => strtoupper($placa),
                'documento' => $documento,
            ]);

            if (!$response->ok()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error al consultar RUNT: HTTP ' . $response->status(),
                ], 502);
            }

            $data = $response->json();

            if (empty($data['success'])) {
                return response()->json([
                    'success' => false,
                    'message' => $data['error'] ?? $data['mensaje'] ?? $data['message'] ?? 'RUNT no retornó datos válidos',
                ], 422);
            }

            $this->applyRuntData($auto, $data);
            $auto->save();

            return response()->json([
                'success' => true,
                'message' => 'Consulta RUNT exitosa. Datos actualizados.',
                'data' => $auto->fresh(),
            ]);
        } catch (\Throwable $e) {
            Log::error('RUNT consultation failed', [
                'automovil_id' => $id,
                'placa' => $placa,
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Error al consultar RUNT: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function catalogos(Request $request)
    {
        // Global (sin broker scope)
        $brandId = $request->get('brand_id');
        $modelId = $request->get('model_id');

        $brands = VehBrand::orderBy('name')->limit(10000)->get(['id','name']);
        $models = [];
        $lines = [];
        if ($brandId) {
            $models = VehModel::where('brand_id', $brandId)->orderBy('name')->limit(10000)->get(['id','name','brand_id']);
        }
        if ($modelId) {
            $lines = VehLine::where('model_id', $modelId)->orderBy('name')->limit(10000)->get(['id','name','model_id']);
        }

        $amount = null; $meta = null;
        if ($brandId && $modelId) {
            $lineId = $request->get('line_id');
            $priceQuery = VehPrice::where('brand_id', $brandId)->where('model_id', $modelId);
            if ($lineId) $priceQuery->where('line_id', $lineId);
            $price = $priceQuery->first();
            if ($price) {
                $amount = (int)$price->amount;
                $meta = [
                    'clase' => $price->clase,
                    'referencia1' => $price->referencia1,
                    'referencia2' => $price->referencia2,
                    'referencia3' => $price->referencia3,
                ];
            }
        }

        // Opciones para cascada de clase y referencias
        $clases = [];$ref1 = [];$ref2 = [];$ref3 = [];
        if ($brandId && $modelId) {
            $q = VehPrice::query()->where('brand_id', $brandId)->where('model_id', $modelId);
            if ($request->filled('line_id')) $q->where('line_id', (int)$request->get('line_id'));
            $clases = $q->clone()->select('clase')->whereNotNull('clase')->distinct()->orderBy('clase')->limit(1000)->pluck('clase');
            if ($request->filled('clase')) $q->where('clase', $request->get('clase'));
            $ref1 = $q->clone()->select('referencia1')->whereNotNull('referencia1')->distinct()->orderBy('referencia1')->limit(1000)->pluck('referencia1');
            if ($request->filled('referencia1')) $q->where('referencia1', $request->get('referencia1'));
            $ref2 = $q->clone()->select('referencia2')->whereNotNull('referencia2')->distinct()->orderBy('referencia2')->limit(1000)->pluck('referencia2');
            if ($request->filled('referencia2')) $q->where('referencia2', $request->get('referencia2'));
            $ref3 = $q->clone()->select('referencia3')->whereNotNull('referencia3')->distinct()->orderBy('referencia3')->limit(1000)->pluck('referencia3');
        }

        return response()->json([
            'success' => true,
            'data' => [
                'brands' => $brands,
                'models' => $models,
                'lines' => $lines,
                'insured_value' => $amount,
                'insured_meta' => $meta,
                'clases' => $clases,
                'referencia1_opts' => $ref1,
                'referencia2_opts' => $ref2,
                'referencia3_opts' => $ref3,
            ]
        ]);
    }
}


