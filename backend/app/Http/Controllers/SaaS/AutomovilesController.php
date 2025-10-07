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
            $query->where('poliza_id', (int)$polizaId);
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
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $transformed,
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
        foreach (['marca','modelo','anio','vin','color','tipo_servicio','clase','referencia1','referencia2','referencia3','linea','tipo_carroceria','numero_motor','numero_chasis','numero_serie','cilindraje','combustible','capacidad_pasajeros','capacidad_carga_kg','tipo_transmision','traccion','pais_origen','custom_fields','brand_id','model_id','line_id'] as $f) {
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


