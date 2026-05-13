<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\CobroComision;
use App\Models\ComisionManualPoliza;
use App\Models\LiquidacionVendedor;
use App\Models\LiquidacionVendedorDetalle;
use App\Models\Poliza;
use App\Models\Vendedor;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Carbon\Carbon;

class LiquidacionesVendedoresController extends Controller
{
    /**
     * Obtener broker_id desde request (compatible con middleware GlobalBrokerAuth)
     */
    private function getBrokerId(Request $request): int
    {
        // 1. Primero intentar obtener desde el middleware GlobalBrokerAuth
        if ($request->has('authenticated_broker_id')) {
            return (int) $request->get('authenticated_broker_id');
        }

        // 2. Intentar obtener desde broker_id directo del request
        if ($request->has('broker_id')) {
            return (int) $request->get('broker_id');
        }

        // 3. Verificar usuario autenticado
        $authType = $request->get('auth_type');
        
        if ($authType === 'empleado') {
            $user = $request->get('authenticated_empleado');
            if ($user && $user->broker_id) {
                return (int) $user->broker_id;
            }
        } else {
            $user = $request->user();
            if ($user && isset($user->broker_id) && $user->broker_id) {
                return (int) $user->broker_id;
            }
        }

        // 4. Desarrollo: header X-Dev-Broker-Id
        if (app()->environment('local', 'development')) {
            $devBrokerId = $request->header('X-Dev-Broker-Id');
            if ($devBrokerId) {
                return (int) $devBrokerId;
            }
        }

        // 5. Fallback a variable de entorno
        return (int) env('DEV_FALLBACK_BROKER_ID', 0);
    }

    /**
     * Resolver nombre del cliente correctamente (persona y empresa)
     */
    private function resolveClienteName($client): string
    {
        if (!$client) return 'Sin nombre';

        $nombre = trim(($client->first_name ?? '') . ' ' . ($client->last_name ?? ''));

        if (empty($nombre) || $nombre === ' ') {
            // Fallback para empresas: company_legal_name o company
            $nombre = $client->company_legal_name ?? $client->company ?? '';
        }

        return !empty(trim($nombre)) ? trim($nombre) : 'Sin nombre';
    }

    /**
     * Obtener user_id del usuario autenticado
     */
    private function getUserId(Request $request): ?int
    {
        // Intentar obtener usuario autenticado
        $authType = $request->get('auth_type');
        
        if ($authType === 'empleado') {
            $empleado = $request->get('authenticated_empleado');
            // Los empleados no tienen user_id en la tabla users, retornar null
            return null;
        }
        
        $user = $request->user();
        if ($user && isset($user->id)) {
            return (int) $user->id;
        }
        
        return null; // Sin usuario autenticado
    }

    /**
     * Obtener comisiones disponibles para liquidar con filtros
     * Solo muestra pólizas cuya comisión de la aseguradora ya fue cobrada
     * y que no han sido liquidadas al vendedor
     */
    public function comisionesDisponibles(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            // Buscar cobros de comisión que están cobrados (aseguradora ya pagó)
            // y cuyas pólizas tienen vendedor y no han sido liquidadas
            $query = CobroComision::where('broker_id', $brokerId)
                ->where('estado', 'cobrado') // Solo comisiones ya cobradas de la aseguradora
                ->whereHas('poliza', function ($q) {
                    $q->whereNotNull('seller_name')
                      ->where('seller_name', '!=', '')
                      ->where('seller_name', '!=', 'Sin asignar');
                })
                // Excluir pólizas ya liquidadas al vendedor
                ->whereDoesntHave('poliza.liquidacionesDetalle');

            // Aplicar filtros
            if ($request->has('vendedor_id') && $request->vendedor_id) {
                $vendedor = Vendedor::find($request->vendedor_id);
                if ($vendedor) {
                    $query->whereHas('poliza', function ($q) use ($vendedor) {
                        $q->where('seller_name', $vendedor->nombres);
                    });
                }
            }

            // Filtrar por fecha de cobro de la comisión (no por fecha de inicio de póliza)
            if ($request->has('fecha_inicio') && $request->fecha_inicio) {
                $query->where('fecha_cobro', '>=', $request->fecha_inicio);
            }

            if ($request->has('fecha_fin') && $request->fecha_fin) {
                $query->where('fecha_cobro', '<=', $request->fecha_fin);
            }

            if ($request->has('aseguradoras') && is_array($request->aseguradoras) && count($request->aseguradoras) > 0) {
                $query->whereIn('aseguradora_id', $request->aseguradoras);
            }

            if ($request->has('ramos') && is_array($request->ramos) && count($request->ramos) > 0) {
                $query->whereHas('poliza', function ($q) use ($request) {
                    $q->whereIn('type', $request->ramos);
                });
            }

            $cobros = $query->with(['poliza.client', 'poliza.aseguradora', 'poliza.ramo'])->get();

            // Agrupar por vendedor y calcular comisiones
            $comisionesPorVendedor = [];
            $vendedores = Vendedor::where('broker_id', $brokerId)->get()->keyBy('nombres');

            foreach ($cobros as $cobro) {
                $poliza = $cobro->poliza;
                if (!$poliza) continue;
                
                $vendedorNombre = $poliza->seller_name;
                $vendedorInfo = $vendedores->get($vendedorNombre);
                
                if (!isset($comisionesPorVendedor[$vendedorNombre])) {
                    $comisionesPorVendedor[$vendedorNombre] = [
                        'vendedor' => $vendedorNombre,
                        'vendedor_id' => $vendedorInfo?->id,
                        'polizas' => [],
                        'total_polizas' => 0,
                        'prima_total' => 0,
                        'comision_bruta_total' => 0,
                        'retencion_total' => 0,
                        'retencion_ica_total' => 0,
                        'iva_total' => 0,
                        'reteiva_total' => 0,
                        'comision_neta_total' => 0,
                        'porcentajes' => [
                            'comision' => $vendedorInfo->porcentaje_comision ?? 0,
                            'retencion' => $vendedorInfo->porcentaje_retencion ?? 0,
                            'retencion_ica' => $vendedorInfo->porcentaje_retencion_ica ?? 0,
                            'iva' => $vendedorInfo->porcentaje_iva ?? 0,
                            'reteiva' => $vendedorInfo->porcentaje_retencion_iva ?? 0,
                        ],
                    ];
                }

                $primaNeta = (float) $poliza->premium_amount;
                // Usar el monto del cobro de comisión (lo que realmente se cobró de la aseguradora)
                $comisionBruta = (float) $cobro->monto_cobrado;
                
                // Calcular comisión del vendedor basada en su porcentaje
                $porcentajeVendedor = $vendedorInfo->porcentaje_comision ?? 15;
                $comisionVendedor = $comisionBruta * ($porcentajeVendedor / 100);
                
                $retencion = $vendedorInfo ? ($comisionVendedor * ($vendedorInfo->porcentaje_retencion ?? 0) / 100) : 0;
                $retencionIca = $vendedorInfo ? ($comisionVendedor * ($vendedorInfo->porcentaje_retencion_ica ?? 0) / 100) : 0;
                $iva = $vendedorInfo ? ($comisionVendedor * ($vendedorInfo->porcentaje_iva ?? 0) / 100) : 0;
                $reteiva = $vendedorInfo ? ($iva * ($vendedorInfo->porcentaje_retencion_iva ?? 0) / 100) : 0;
                // Comisión neta = bruta - retenciones + IVA - ReteIVA
                $comisionNeta = $comisionVendedor - $retencion - $retencionIca + $iva - $reteiva;

                $comisionesPorVendedor[$vendedorNombre]['polizas'][] = [
                    'id' => $poliza->id,
                    'cobro_comision_id' => $cobro->id,
                    'numero_poliza' => $poliza->policy_number,
                    'cliente' => $poliza->client ? trim($poliza->client->first_name . ' ' . $poliza->client->last_name) : 'Sin nombre',
                    'aseguradora' => $poliza->aseguradora?->nombre ?? $poliza->insurance_company,
                    'ramo' => $poliza->ramo?->nombre ?? $poliza->type,
                    'fecha_poliza' => $poliza->start_date?->format('Y-m-d'),
                    'fecha_cobro' => $cobro->fecha_cobro?->format('Y-m-d'),
                    'prima_neta' => $primaNeta,
                    'comision_aseguradora' => $comisionBruta, // Lo que pagó la aseguradora
                    'porcentaje_comision' => $porcentajeVendedor,
                    'comision_bruta' => $comisionVendedor, // Comisión del vendedor
                    'porcentaje_retencion' => $vendedorInfo->porcentaje_retencion ?? 0,
                    'retencion' => $retencion,
                    'porcentaje_retencion_ica' => $vendedorInfo->porcentaje_retencion_ica ?? 0,
                    'retencion_ica' => $retencionIca,
                    'porcentaje_iva' => $vendedorInfo->porcentaje_iva ?? 0,
                    'iva' => $iva,
                    'porcentaje_reteiva' => $vendedorInfo->porcentaje_retencion_iva ?? 0,
                    'reteiva' => $reteiva,
                    'comision_neta' => $comisionNeta,
                ];

                $comisionesPorVendedor[$vendedorNombre]['total_polizas']++;
                $comisionesPorVendedor[$vendedorNombre]['prima_total'] += $primaNeta;
                $comisionesPorVendedor[$vendedorNombre]['comision_bruta_total'] += $comisionVendedor;
                $comisionesPorVendedor[$vendedorNombre]['retencion_total'] += $retencion;
                $comisionesPorVendedor[$vendedorNombre]['retencion_ica_total'] += $retencionIca;
                $comisionesPorVendedor[$vendedorNombre]['iva_total'] += $iva;
                $comisionesPorVendedor[$vendedorNombre]['reteiva_total'] += $reteiva;
                $comisionesPorVendedor[$vendedorNombre]['comision_neta_total'] += $comisionNeta;
            }

            // Incluir comisiones manuales pendientes (para liquidar)
            $comisionesManualesQuery = ComisionManualPoliza::where('broker_id', $brokerId)
                ->where('estado', 'pendiente')
                ->with(['vendedor', 'aseguradora', 'poliza.client']);

            if ($request->has('vendedor_id') && $request->vendedor_id) {
                $comisionesManualesQuery->where('vendedor_id', $request->vendedor_id);
            }

            // Filtrar comisiones manuales por fecha de creación
            if ($request->has('fecha_inicio') && $request->fecha_inicio) {
                $comisionesManualesQuery->whereDate('created_at', '>=', $request->fecha_inicio);
            }

            if ($request->has('fecha_fin') && $request->fecha_fin) {
                $comisionesManualesQuery->whereDate('created_at', '<=', $request->fecha_fin);
            }

            $comisionesManuales = $comisionesManualesQuery->get();

            foreach ($comisionesManuales as $cm) {
                $vendedorInfo = $cm->vendedor;
                if (!$vendedorInfo) continue;

                $vendedorNombre = $vendedorInfo->nombres;

                if (!isset($comisionesPorVendedor[$vendedorNombre])) {
                    $comisionesPorVendedor[$vendedorNombre] = [
                        'vendedor' => $vendedorNombre,
                        'vendedor_id' => $vendedorInfo->id,
                        'polizas' => [],
                        'comisiones_manuales' => [],
                        'total_polizas' => 0,
                        'total_comisiones_manuales' => 0,
                        'prima_total' => 0,
                        'comision_bruta_total' => 0,
                        'retencion_total' => 0,
                        'retencion_ica_total' => 0,
                        'iva_total' => 0,
                        'reteiva_total' => 0,
                        'comision_neta_total' => 0,
                        'porcentajes' => [
                            'comision' => $vendedorInfo->porcentaje_comision ?? 0,
                            'retencion' => $vendedorInfo->porcentaje_retencion ?? 0,
                            'retencion_ica' => $vendedorInfo->porcentaje_retencion_ica ?? 0,
                            'iva' => $vendedorInfo->porcentaje_iva ?? 0,
                            'reteiva' => $vendedorInfo->porcentaje_retencion_iva ?? 0,
                        ],
                    ];
                }

                // Inicializar arrays si no existen
                if (!isset($comisionesPorVendedor[$vendedorNombre]['comisiones_manuales'])) {
                    $comisionesPorVendedor[$vendedorNombre]['comisiones_manuales'] = [];
                    $comisionesPorVendedor[$vendedorNombre]['total_comisiones_manuales'] = 0;
                }

                $comisionesPorVendedor[$vendedorNombre]['comisiones_manuales'][] = [
                    'id' => $cm->id,
                    'tipo' => 'manual',
                    'poliza_id' => $cm->poliza_id,
                    'numero_poliza' => $cm->numero_poliza,
                    'anexo' => $cm->anexo,
                    'tipo_movimiento' => $cm->tipo_movimiento,
                    'cliente' => $cm->asegurado_nombre,
                    'aseguradora' => $cm->aseguradora?->nombre,
                    'ramo' => $cm->ramo,
                    'abono_prima' => $cm->abono_prima,
                    'porcentaje_comision' => $cm->porcentaje_comision,
                    'valor_comision' => $cm->valor_comision,
                    'rtf_calculada' => $cm->rtf_calculada,
                    'iva_19' => $cm->iva_19,
                    'reteiva' => $cm->reteiva,
                    'ica' => $cm->ica,
                    'cree' => $cm->cree,
                    'neto_comision' => $cm->neto_comision,
                    'created_at' => $cm->created_at?->format('Y-m-d'),
                ];

                $comisionesPorVendedor[$vendedorNombre]['total_comisiones_manuales']++;
                $comisionesPorVendedor[$vendedorNombre]['prima_total'] += (float) $cm->abono_prima;
                $comisionesPorVendedor[$vendedorNombre]['comision_bruta_total'] += (float) $cm->valor_comision;
                $comisionesPorVendedor[$vendedorNombre]['iva_total'] += (float) $cm->iva_19;
                $comisionesPorVendedor[$vendedorNombre]['reteiva_total'] += (float) $cm->reteiva;
                $comisionesPorVendedor[$vendedorNombre]['retencion_ica_total'] += (float) $cm->ica;
                $comisionesPorVendedor[$vendedorNombre]['comision_neta_total'] += (float) $cm->neto_comision;
            }

            return response()->json([
                'success' => true,
                'data' => array_values($comisionesPorVendedor),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener comisiones: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Generar vista previa de liquidación
     */
    public function vistaPrevia(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $validator = Validator::make($request->all(), [
                'vendedor_id' => 'required|exists:vendedores,id',
                'polizas_ids' => 'required|array|min:1',
                'polizas_ids.*' => 'exists:polizas,id',
                'periodo_inicio' => 'required|date',
                'periodo_fin' => 'required|date|after_or_equal:periodo_inicio',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors(),
                ], 422);
            }

            $vendedor = Vendedor::findOrFail($request->vendedor_id);
            $polizas = Poliza::whereIn('id', $request->polizas_ids)
                ->where('broker_id', $brokerId)
                ->with(['client', 'aseguradora', 'ramo'])
                ->get();

            $detalles = [];
            $totales = [
                'prima_total' => 0,
                'comision_bruta_total' => 0,
                'retencion_total' => 0,
                'retencion_ica_total' => 0,
                'iva_total' => 0,
                'comision_neta_total' => 0,
            ];

            foreach ($polizas as $poliza) {
                $primaNeta = (float) $poliza->premium_amount;
                $comisionBruta = (float) ($poliza->commission_amount ?? ($primaNeta * ($poliza->commission_percentage ?? 15) / 100));
                
                $retencion = $comisionBruta * $vendedor->porcentaje_retencion / 100;
                $retencionIca = $comisionBruta * $vendedor->porcentaje_retencion_ica / 100;
                $iva = $comisionBruta * $vendedor->porcentaje_iva / 100;
                $comisionNeta = $comisionBruta - $retencion - $retencionIca + $iva;

                $detalles[] = [
                    'poliza_id' => $poliza->id,
                    'numero_poliza' => $poliza->policy_number,
                    'cliente_nombre' => $this->resolveClienteName($poliza->client),
                    'aseguradora' => $poliza->aseguradora?->nombre ?? $poliza->insurance_company,
                    'ramo' => $poliza->ramo?->nombre ?? $poliza->type,
                    'fecha_poliza' => $poliza->start_date?->format('Y-m-d'),
                    'prima_neta' => $primaNeta,
                    'porcentaje_comision' => $vendedor->porcentaje_comision,
                    'comision_bruta' => $comisionBruta,
                    'porcentaje_retencion' => $vendedor->porcentaje_retencion,
                    'monto_retencion' => $retencion,
                    'porcentaje_retencion_ica' => $vendedor->porcentaje_retencion_ica,
                    'monto_retencion_ica' => $retencionIca,
                    'porcentaje_iva' => $vendedor->porcentaje_iva,
                    'monto_iva' => $iva,
                    'comision_neta' => $comisionNeta,
                ];

                $totales['prima_total'] += $primaNeta;
                $totales['comision_bruta_total'] += $comisionBruta;
                $totales['retencion_total'] += $retencion;
                $totales['retencion_ica_total'] += $retencionIca;
                $totales['iva_total'] += $iva;
                $totales['comision_neta_total'] += $comisionNeta;
            }

            $vistaPrevia = [
                'vendedor' => [
                    'id' => $vendedor->id,
                    'nombres' => $vendedor->nombres,
                    'tipo_documento' => $vendedor->tipo_documento,
                    'numero_documento' => $vendedor->numero_documento,
                    'cuenta_bancaria' => $vendedor->cuenta_bancaria,
                ],
                'periodo' => [
                    'inicio' => $request->periodo_inicio,
                    'fin' => $request->periodo_fin,
                ],
                'detalles' => $detalles,
                'totales' => $totales,
                'cantidad_polizas' => count($detalles),
            ];

            return response()->json([
                'success' => true,
                'data' => $vistaPrevia,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al generar vista previa: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Crear liquidación
     */
    public function store(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $userId = $this->getUserId($request);
            
            $validator = Validator::make($request->all(), [
                'vendedor_id' => 'required|exists:vendedores,id',
                'polizas_ids' => 'required|array|min:1',
                'polizas_ids.*' => 'exists:polizas,id',
                'periodo_inicio' => 'required|date',
                'periodo_fin' => 'required|date|after_or_equal:periodo_inicio',
                'observaciones' => 'nullable|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors(),
                ], 422);
            }

            DB::beginTransaction();

            $vendedor = Vendedor::findOrFail($request->vendedor_id);
            $polizas = Poliza::whereIn('id', $request->polizas_ids)
                ->where('broker_id', $brokerId)
                ->with(['client', 'aseguradora', 'ramo'])
                ->get();

            // Calcular totales
            $totales = [
                'prima_total' => 0,
                'monto_bruto_total' => 0,
                'monto_retencion_total' => 0,
                'monto_retencion_ica_total' => 0,
                'monto_iva_total' => 0,
                'monto_neto_total' => 0,
            ];

            $detalles = [];

            foreach ($polizas as $poliza) {
                $primaNeta = (float) $poliza->premium_amount;
                $comisionBruta = (float) ($poliza->commission_amount ?? ($primaNeta * ($poliza->commission_percentage ?? 15) / 100));
                
                $retencion = $comisionBruta * $vendedor->porcentaje_retencion / 100;
                $retencionIca = $comisionBruta * $vendedor->porcentaje_retencion_ica / 100;
                $iva = $comisionBruta * $vendedor->porcentaje_iva / 100;
                $comisionNeta = $comisionBruta - $retencion - $retencionIca + $iva;

                $detalles[] = [
                    'poliza_id' => $poliza->id,
                    'numero_poliza' => $poliza->policy_number,
                    'cliente_nombre' => $this->resolveClienteName($poliza->client),
                    'aseguradora' => $poliza->aseguradora?->nombre ?? $poliza->insurance_company,
                    'ramo' => $poliza->ramo?->nombre ?? $poliza->type,
                    'fecha_poliza' => $poliza->start_date?->format('Y-m-d'),
                    'prima_neta' => $primaNeta,
                    'porcentaje_comision' => $vendedor->porcentaje_comision,
                    'comision_bruta' => $comisionBruta,
                    'porcentaje_retencion' => $vendedor->porcentaje_retencion,
                    'monto_retencion' => $retencion,
                    'porcentaje_retencion_ica' => $vendedor->porcentaje_retencion_ica,
                    'monto_retencion_ica' => $retencionIca,
                    'porcentaje_iva' => $vendedor->porcentaje_iva,
                    'monto_iva' => $iva,
                    'comision_neta' => $comisionNeta,
                ];

                $totales['prima_total'] += $primaNeta;
                $totales['monto_bruto_total'] += $comisionBruta;
                $totales['monto_retencion_total'] += $retencion;
                $totales['monto_retencion_ica_total'] += $retencionIca;
                $totales['monto_iva_total'] += $iva;
                $totales['monto_neto_total'] += $comisionNeta;
            }

            // Crear liquidación con código único (maneja reintentos automáticos)
            $liquidacion = LiquidacionVendedor::crearConReintento([
                'broker_id' => $brokerId,
                'vendedor_id' => $request->vendedor_id,
                'periodo_inicio' => $request->periodo_inicio,
                'periodo_fin' => $request->periodo_fin,
                'fecha_generacion' => now(),
                'filtros_aplicados' => $request->filtros ?? [],
                'prima_total' => $totales['prima_total'],
                'monto_bruto_total' => $totales['monto_bruto_total'],
                'monto_retencion_total' => $totales['monto_retencion_total'],
                'monto_retencion_ica_total' => $totales['monto_retencion_ica_total'],
                'monto_iva_total' => $totales['monto_iva_total'],
                'monto_neto_total' => $totales['monto_neto_total'],
                'cantidad_polizas' => count($detalles),
                'estado' => 'generada',
                'observaciones' => $request->observaciones,
                'creado_por' => $userId,
            ]);

            // Crear detalles
            foreach ($detalles as $detalle) {
                LiquidacionVendedorDetalle::create([
                    'liquidacion_id' => $liquidacion->id,
                    ...$detalle
                ]);
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Liquidación creada exitosamente',
                'data' => $liquidacion->load(['vendedor', 'detalles']),
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al crear liquidación: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Listar liquidaciones
     */
    public function index(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $query = LiquidacionVendedor::where('broker_id', $brokerId)
                ->with(['vendedor', 'creadoPor', 'aprobadoPor']);

            // Filtros
            if ($request->has('estado') && $request->estado) {
                $query->where('estado', $request->estado);
            }

            if ($request->has('vendedor_id') && $request->vendedor_id) {
                $query->where('vendedor_id', $request->vendedor_id);
            }

            if ($request->has('fecha_desde') && $request->fecha_desde) {
                $query->where('fecha_generacion', '>=', $request->fecha_desde);
            }

            if ($request->has('fecha_hasta') && $request->fecha_hasta) {
                $query->where('fecha_generacion', '<=', $request->fecha_hasta);
            }

            $liquidaciones = $query->orderBy('created_at', 'desc')->get();

            return response()->json([
                'success' => true,
                'data' => $liquidaciones,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener liquidaciones: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Reporte de liquidaciones agrupado por vendedor
     * Filtra por período (periodo_inicio y periodo_fin) de la tabla liquidaciones_vendedores_cabecera
     */
    public function reporteLiquidaciones(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $perPage = (int) ($request->per_page ?? 25);
            $page = (int) ($request->page ?? 1);
            
            $query = LiquidacionVendedor::where('broker_id', $brokerId)
                ->whereIn('estado', ['generada', 'aprobada', 'pagada']) // Excluir revertidas
                ->with(['vendedor']);

            // Filtrar por rango de período
            // Una liquidación entra en el rango si su período se solapa con el rango buscado
            if ($request->has('fecha_inicio') && $request->fecha_inicio) {
                $query->where('periodo_fin', '>=', $request->fecha_inicio);
            }

            if ($request->has('fecha_fin') && $request->fecha_fin) {
                $query->where('periodo_inicio', '<=', $request->fecha_fin);
            }

            if ($request->has('vendedor_id') && $request->vendedor_id) {
                $query->where('vendedor_id', $request->vendedor_id);
            }

            $liquidaciones = $query->get();

            // Agrupar por vendedor
            $porVendedor = [];
            $totalesGenerales = [
                'total_polizas' => 0,
                'prima_total' => 0,
                'comision_bruta_total' => 0,
                'iva_comision_total' => 0,
                'reteiva_total' => 0,
                'retencion_total' => 0,
                'retencion_ica_total' => 0,
                'comision_neta_total' => 0,
            ];

            foreach ($liquidaciones as $liq) {
                $vendedorId = $liq->vendedor_id;
                $vendedorNombre = $liq->vendedor?->nombres ?? 'Sin vendedor';
                
                if (!isset($porVendedor[$vendedorId])) {
                    $porVendedor[$vendedorId] = [
                        'vendedor_id' => $vendedorId,
                        'vendedor' => $vendedorNombre,
                        'porcentajes' => [
                            'tipo_documento' => $liq->vendedor?->tipo_documento ?? '',
                            'numero_documento' => $liq->vendedor?->numero_documento ?? '',
                            'comision' => $liq->vendedor?->porcentaje_comision ?? 0,
                            'retencion' => $liq->vendedor?->porcentaje_retencion ?? 0,
                            'iva' => $liq->vendedor?->porcentaje_iva ?? 19, // Por defecto 19%
                            'retencion_iva' => $liq->vendedor?->porcentaje_retencion_iva ?? 15, // Por defecto 15%
                            'retencion_ica' => $liq->vendedor?->porcentaje_retencion_ica ?? 0,
                        ],
                        'total_polizas' => 0,
                        'total_comisiones_manuales' => 0,
                        'prima_total' => 0,
                        'comision_bruta_total' => 0,
                        'iva_comision_total' => 0,
                        'reteiva_total' => 0,
                        'retencion_total' => 0,
                        'retencion_ica_total' => 0,
                        'comision_neta_total' => 0,
                    ];
                }

                // Calcular IVA de la comisión (19% del valor comisión)
                $comisionBruta = (float) $liq->monto_bruto_total;
                $porcentajeIva = $liq->vendedor?->porcentaje_iva ?? 19;
                $porcentajeReteiva = $liq->vendedor?->porcentaje_retencion_iva ?? 15;
                
                // IVA = 19% de la comisión bruta
                $ivaComision = $comisionBruta * ($porcentajeIva / 100);
                // ReteIVA = 15% del IVA
                $reteiva = $ivaComision * ($porcentajeReteiva / 100);

                $porVendedor[$vendedorId]['total_polizas'] += $liq->cantidad_polizas ?? 0;
                $porVendedor[$vendedorId]['prima_total'] += (float) $liq->prima_total;
                $porVendedor[$vendedorId]['comision_bruta_total'] += $comisionBruta;
                $porVendedor[$vendedorId]['iva_comision_total'] += $ivaComision;
                $porVendedor[$vendedorId]['reteiva_total'] += $reteiva;
                $porVendedor[$vendedorId]['retencion_total'] += (float) $liq->monto_retencion_total;
                $porVendedor[$vendedorId]['retencion_ica_total'] += (float) $liq->monto_retencion_ica_total;
                $porVendedor[$vendedorId]['comision_neta_total'] += (float) $liq->monto_neto_total;

                // Acumular totales generales
                $totalesGenerales['total_polizas'] += $liq->cantidad_polizas ?? 0;
                $totalesGenerales['prima_total'] += (float) $liq->prima_total;
                $totalesGenerales['comision_bruta_total'] += $comisionBruta;
                $totalesGenerales['iva_comision_total'] += $ivaComision;
                $totalesGenerales['reteiva_total'] += $reteiva;
                $totalesGenerales['retencion_total'] += (float) $liq->monto_retencion_total;
                $totalesGenerales['retencion_ica_total'] += (float) $liq->monto_retencion_ica_total;
                $totalesGenerales['comision_neta_total'] += (float) $liq->monto_neto_total;
            }

            // Convertir a array y ordenar por comisión neta descendente
            $vendedoresArray = array_values($porVendedor);
            usort($vendedoresArray, fn($a, $b) => $b['comision_neta_total'] <=> $a['comision_neta_total']);

            // Paginación manual
            $totalVendedores = count($vendedoresArray);
            $totalPages = ceil($totalVendedores / $perPage);
            $offset = ($page - 1) * $perPage;
            $vendedoresPaginados = array_slice($vendedoresArray, $offset, $perPage);

            return response()->json([
                'success' => true,
                'data' => $vendedoresPaginados,
                'totales' => $totalesGenerales,
                'pagination' => [
                    'current_page' => $page,
                    'per_page' => $perPage,
                    'total' => $totalVendedores,
                    'total_pages' => $totalPages,
                    'has_more' => $page < $totalPages,
                ],
                'total_liquidaciones' => $liquidaciones->count(),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al generar reporte: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Reporte detallado por vendedor individual
     * Incluye cada póliza con aseguradora y ramo
     */
    public function reporteVendedor(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $request->validate([
                'vendedor_id' => 'required|integer',
                'fecha_inicio' => 'required|date',
                'fecha_fin' => 'required|date',
            ]);

            $vendedorId = $request->vendedor_id;
            $fechaInicio = $request->fecha_inicio;
            $fechaFin = $request->fecha_fin;

            // Obtener información del vendedor
            $vendedor = \App\Models\Vendedor::where('broker_id', $brokerId)
                ->findOrFail($vendedorId);

            // Obtener liquidaciones del vendedor en el período
            $liquidaciones = LiquidacionVendedor::where('broker_id', $brokerId)
                ->where('vendedor_id', $vendedorId)
                ->whereIn('estado', ['generada', 'aprobada', 'pagada'])
                ->where('periodo_fin', '>=', $fechaInicio)
                ->where('periodo_inicio', '<=', $fechaFin)
                ->with(['detalles'])
                ->orderBy('periodo_inicio', 'asc')
                ->get();

            // Recopilar todos los detalles (pólizas) de todas las liquidaciones
            $polizas = [];
            $totales = [
                'cantidad_polizas' => 0,
                'prima_total' => 0,
                'comision_bruta_total' => 0,
                'iva_comision_total' => 0,
                'retencion_total' => 0,
                'reteiva_total' => 0,
                'retencion_ica_total' => 0,
                'comision_neta_total' => 0,
            ];

            foreach ($liquidaciones as $liq) {
                foreach ($liq->detalles as $detalle) {
                    // Obtener porcentaje de comisión del ramo desde la póliza
                    $porcentajeRamo = null;
                    if ($detalle->poliza_id) {
                        $poliza = \App\Models\Poliza::find($detalle->poliza_id);
                        if ($poliza) {
                            // Primero intentar desde commission_percentage de la póliza (solo si es > 0)
                            $commissionPct = (float) $poliza->commission_percentage;
                            if ($commissionPct > 0) {
                                $porcentajeRamo = $commissionPct;
                            }
                            // Si no existe, intentar calcular desde comisiones_aseguradoras
                            if (!$porcentajeRamo && $poliza->aseguradora_id && $poliza->ramo_id) {
                                $comisionAseg = \App\Models\ComisionAseguradora::where('aseguradora_id', $poliza->aseguradora_id)
                                    ->where('ramo_id', $poliza->ramo_id)
                                    ->first();
                                if ($comisionAseg && (float) $comisionAseg->porcentaje_comision > 0) {
                                    $porcentajeRamo = (float) $comisionAseg->porcentaje_comision;
                                }
                            }
                            // Si aún no hay, calcular desde la comisión bruta y prima neta
                            $primaNeta = (float) $detalle->prima_neta;
                            $comisionBruta = (float) $detalle->comision_bruta;
                            if (!$porcentajeRamo && $primaNeta > 0 && $comisionBruta > 0) {
                                // Calcular el porcentaje inverso: comision_bruta = prima * (% ramo) * (% vendedor) / 10000
                                // Si conocemos % vendedor, podemos calcular % ramo
                                $porcentajeVendedor = (float) $detalle->porcentaje_comision;
                                if ($porcentajeVendedor > 0) {
                                    $porcentajeRamo = round(($comisionBruta * 100) / ($primaNeta * $porcentajeVendedor / 100), 2);
                                }
                            }
                        }
                    }

                    // Calcular IVA de comisión (porcentaje IVA del vendedor sobre la comisión bruta)
                    $comisionBruta = (float) $detalle->comision_bruta;
                    $ivaComision = $comisionBruta * ($vendedor->porcentaje_iva / 100);

                    // ReteIVA = IVA × % retención IVA del vendedor (NO es el monto del IVA).
                    // El campo $detalle->monto_iva guarda el IVA bruto, no el reteIVA, así que
                    // lo recalculamos para que la planilla muestre el valor correcto.
                    $reteIvaCalc = $ivaComision * ((float) ($vendedor->porcentaje_retencion_iva ?? 0) / 100);

                    // Resolver nombre del cliente en tiempo real si está vacío
                    $clienteNombre = $detalle->cliente_nombre;
                    if (empty(trim($clienteNombre ?? ''))) {
                        if (isset($poliza) && $poliza && $poliza->client_id) {
                            $cliente = $poliza->client ?? \App\Models\Cliente::find($poliza->client_id);
                            $clienteNombre = $this->resolveClienteName($cliente);
                        } else {
                            $clienteNombre = $poliza->client_name ?? 'Sin nombre';
                        }
                    }

                    $polizas[] = [
                        'liquidacion_codigo' => $liq->codigo,
                        'liquidacion_fecha' => $liq->fecha_generacion,
                        'numero_poliza' => $detalle->numero_poliza,
                        'cliente' => $clienteNombre,
                        'aseguradora' => $detalle->aseguradora,
                        'ramo' => $detalle->ramo,
                        'fecha_poliza' => $detalle->fecha_poliza,
                        'prima_neta' => (float) $detalle->prima_neta,
                        'porcentaje_comision' => (float) $detalle->porcentaje_comision,
                        'porcentaje_comision_ramo' => $porcentajeRamo, // Porcentaje configurado en el ramo
                        'comision_bruta' => $comisionBruta,
                        'iva_comision' => $ivaComision,
                        'retencion_fuente' => (float) $detalle->monto_retencion,
                        'retencion_iva' => $reteIvaCalc,
                        'retencion_ica' => (float) $detalle->monto_retencion_ica,
                        'comision_neta' => (float) $detalle->comision_neta,
                    ];

                    $totales['cantidad_polizas']++;
                    $totales['prima_total'] += (float) $detalle->prima_neta;
                    $totales['comision_bruta_total'] += $comisionBruta;
                    $totales['iva_comision_total'] += $ivaComision;
                    $totales['retencion_total'] += (float) $detalle->monto_retencion;
                    $totales['reteiva_total'] += $reteIvaCalc;
                    $totales['retencion_ica_total'] += (float) $detalle->monto_retencion_ica;
                    $totales['comision_neta_total'] += (float) $detalle->comision_neta;
                }
            }

            return response()->json([
                'success' => true,
                'vendedor' => [
                    'id' => $vendedor->id,
                    'nombres' => $vendedor->nombres,
                    'tipo_documento' => $vendedor->tipo_documento,
                    'numero_documento' => $vendedor->numero_documento,
                    'porcentaje_comision' => $vendedor->porcentaje_comision,
                    'porcentaje_retencion' => $vendedor->porcentaje_retencion,
                    'porcentaje_retencion_iva' => $vendedor->porcentaje_retencion_iva,
                    'porcentaje_retencion_ica' => $vendedor->porcentaje_retencion_ica,
                ],
                'polizas' => $polizas,
                'totales' => $totales,
                'periodo' => [
                    'inicio' => $fechaInicio,
                    'fin' => $fechaFin,
                ],
                'total_liquidaciones' => $liquidaciones->count(),
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al generar reporte: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Ver detalle de liquidación
     */
    public function show($id, Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $liquidacion = LiquidacionVendedor::where('broker_id', $brokerId)
                ->with(['vendedor', 'detalles', 'creadoPor', 'aprobadoPor', 'revertidoPor'])
                ->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $liquidacion,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener liquidación: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Aprobar liquidación
     */
    public function aprobar($id, Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $userId = $this->getUserId($request);
            
            $liquidacion = LiquidacionVendedor::where('broker_id', $brokerId)
                ->findOrFail($id);

            if (!$liquidacion->aprobar($userId)) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se puede aprobar la liquidación en su estado actual',
                ], 400);
            }

            return response()->json([
                'success' => true,
                'message' => 'Liquidación aprobada exitosamente',
                'data' => $liquidacion->fresh(),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al aprobar liquidación: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Registrar pago de liquidación
     */
    public function registrarPago($id, Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $userId = $this->getUserId($request);
            
            $validator = Validator::make($request->all(), [
                'fecha_pago' => 'required|date',
                'metodo_pago' => 'required|string',
                'referencia_pago' => 'nullable|string',
                'comprobante_url' => 'nullable|string',
                'observaciones' => 'nullable|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors(),
                ], 422);
            }

            $liquidacion = LiquidacionVendedor::where('broker_id', $brokerId)
                ->findOrFail($id);

            if (!$liquidacion->registrarPago($request->all(), $userId)) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se puede registrar el pago en el estado actual de la liquidación',
                ], 400);
            }

            return response()->json([
                'success' => true,
                'message' => 'Pago registrado exitosamente',
                'data' => $liquidacion->fresh(),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al registrar pago: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Revertir liquidación
     */
    public function revertir($id, Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $userId = $this->getUserId($request);
            
            $validator = Validator::make($request->all(), [
                'motivo' => 'required|string|min:10',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors(),
                ], 422);
            }

            $liquidacion = LiquidacionVendedor::where('broker_id', $brokerId)
                ->findOrFail($id);

            if (!$liquidacion->puedeRevertirse()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Esta liquidación no puede ser revertida',
                ], 400);
            }

            if (!$liquidacion->revertir($request->motivo, $userId)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error al revertir la liquidación',
                ], 400);
            }

            return response()->json([
                'success' => true,
                'message' => 'Liquidación revertida exitosamente',
                'data' => $liquidacion->fresh(),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al revertir liquidación: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Crear liquidación desde comisiones manuales de una póliza
     */
    public function crearDesdeComisionesManuales(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $userId = $this->getUserId($request);
            
            $validator = Validator::make($request->all(), [
                'vendedor_id' => 'required|exists:vendedores,id',
                'comisiones_manuales_ids' => 'required|array|min:1',
                'comisiones_manuales_ids.*' => 'exists:comisiones_manuales_polizas,id',
                'periodo_inicio' => 'required|date',
                'periodo_fin' => 'required|date|after_or_equal:periodo_inicio',
                'observaciones' => 'nullable|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors(),
                ], 422);
            }

            DB::beginTransaction();

            $vendedor = Vendedor::findOrFail($request->vendedor_id);
            
            // Obtener comisiones manuales pendientes
            $comisionesManuales = ComisionManualPoliza::where('broker_id', $brokerId)
                ->whereIn('id', $request->comisiones_manuales_ids)
                ->where('estado', 'pendiente')
                ->with(['poliza', 'aseguradora'])
                ->get();

            if ($comisionesManuales->isEmpty()) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se encontraron comisiones pendientes para liquidar',
                ], 400);
            }

            // Calcular totales
            $totales = [
                'prima_total' => 0,
                'monto_bruto_total' => 0,
                'monto_retencion_total' => 0,
                'monto_retencion_ica_total' => 0,
                'monto_iva_total' => 0,
                'monto_neto_total' => 0,
            ];

            $detalles = [];

            foreach ($comisionesManuales as $cm) {
                $detalles[] = [
                    'poliza_id' => $cm->poliza_id,
                    'numero_poliza' => $cm->numero_poliza,
                    'cliente_nombre' => $cm->asegurado_nombre,
                    'aseguradora' => $cm->aseguradora?->nombre ?? 'N/A',
                    'ramo' => $cm->ramo,
                    'fecha_poliza' => $cm->created_at?->format('Y-m-d'),
                    'prima_neta' => (float) $cm->abono_prima,
                    'porcentaje_comision' => (float) $cm->porcentaje_comision,
                    'comision_bruta' => (float) $cm->valor_comision,
                    'porcentaje_retencion' => (float) $cm->porcentaje_rtf,
                    'monto_retencion' => (float) $cm->rtf_calculada,
                    'porcentaje_retencion_ica' => 0,
                    'monto_retencion_ica' => (float) $cm->ica,
                    'porcentaje_iva' => 19,
                    'monto_iva' => (float) $cm->iva_19,
                    'comision_neta' => (float) $cm->neto_comision,
                ];

                $totales['prima_total'] += (float) $cm->abono_prima;
                $totales['monto_bruto_total'] += (float) $cm->valor_comision;
                $totales['monto_retencion_total'] += (float) $cm->rtf_calculada;
                $totales['monto_retencion_ica_total'] += (float) $cm->ica;
                $totales['monto_iva_total'] += (float) $cm->iva_19;
                $totales['monto_neto_total'] += (float) $cm->neto_comision;
            }

            // Crear liquidación con código único (maneja reintentos automáticos)
            $liquidacion = LiquidacionVendedor::crearConReintento([
                'broker_id' => $brokerId,
                'vendedor_id' => $request->vendedor_id,
                'periodo_inicio' => $request->periodo_inicio,
                'periodo_fin' => $request->periodo_fin,
                'fecha_generacion' => now(),
                'filtros_aplicados' => ['tipo' => 'comisiones_manuales', 'ids' => $request->comisiones_manuales_ids],
                'prima_total' => $totales['prima_total'],
                'monto_bruto_total' => $totales['monto_bruto_total'],
                'monto_retencion_total' => $totales['monto_retencion_total'],
                'monto_retencion_ica_total' => $totales['monto_retencion_ica_total'],
                'monto_iva_total' => $totales['monto_iva_total'],
                'monto_neto_total' => $totales['monto_neto_total'],
                'cantidad_polizas' => count($detalles),
                'estado' => 'generada',
                'observaciones' => $request->observaciones,
                'creado_por' => $userId,
            ]);

            // Crear detalles
            foreach ($detalles as $detalle) {
                LiquidacionVendedorDetalle::create([
                    'liquidacion_id' => $liquidacion->id,
                    ...$detalle
                ]);
            }

            // Marcar comisiones manuales como liquidadas
            foreach ($comisionesManuales as $cm) {
                $cm->estado = 'liquidada';
                $cm->liquidacion_id = $liquidacion->id;
                $cm->save();
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Liquidación creada exitosamente',
                'data' => $liquidacion->load(['vendedor', 'detalles']),
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al crear liquidación: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Generar PDF de liquidación
     */
    public function generarPDF($id, Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $liquidacion = LiquidacionVendedor::where('broker_id', $brokerId)
                ->with(['vendedor', 'detalles'])
                ->findOrFail($id);

            $broker = \App\Models\Broker::findOrFail($brokerId);
            $vendedor = $liquidacion->vendedor;
            $detalles = $liquidacion->detalles;
            
            // Obtener terminología desde settings del broker
            $settings = is_array($broker->settings) ? $broker->settings : [];
            $terminologia = $settings['terminologia'] ?? [];
            $terminoVendedor = $terminologia['vendedor'] ?? 'Vendedor';

            $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('pdf.liquidacion-vendedor', [
                'liquidacion' => $liquidacion,
                'broker' => $broker,
                'vendedor' => $vendedor,
                'detalles' => $detalles,
                'terminoVendedor' => $terminoVendedor,
            ]);

            $pdf->setPaper('letter', 'portrait');

            $filename = "Liquidacion_{$liquidacion->codigo}.pdf";

            return $pdf->download($filename);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al generar PDF: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Crear liquidación directamente desde póliza con comisiones en el request
     */
    public function crearDesdePoliza(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $userId = $this->getUserId($request);
            
            $validator = Validator::make($request->all(), [
                'poliza_id' => 'required|exists:polizas,id',
                'periodo_inicio' => 'required|date',
                'periodo_fin' => 'required|date|after_or_equal:periodo_inicio',
                'comisiones' => 'required|array|min:1',
                'comisiones.*.vendedor_id' => 'required|exists:vendedores,id',
                'comisiones.*.tipo_movimiento' => 'required|string',
                'comisiones.*.abono_prima' => 'required|numeric', // Permite valores negativos para cancelaciones/ajustes
                'comisiones.*.porcentaje_comision' => 'required|numeric|min:0',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors(),
                ], 422);
            }

            DB::beginTransaction();

            $poliza = Poliza::findOrFail($request->poliza_id);
            
            // Agrupar comisiones por vendedor
            $comisionesPorVendedor = collect($request->comisiones)->groupBy('vendedor_id');
            
            $liquidacionesCreadas = [];
            
            foreach ($comisionesPorVendedor as $vendedorId => $comisiones) {
                $vendedor = Vendedor::findOrFail($vendedorId);
                
                // Calcular totales
                $totales = [
                    'prima_total' => 0,
                    'monto_bruto_total' => 0,
                    'monto_retencion_total' => 0,
                    'monto_retencion_ica_total' => 0,
                    'monto_iva_total' => 0,
                    'monto_neto_total' => 0,
                ];

                $detalles = [];

                foreach ($comisiones as $com) {
                    $abonoPrima = (float) $com['abono_prima'];
                    $porcentajeComision = (float) ($com['porcentaje_comision'] ?? 0); // % del ramo/aseguradora
                    $porcentajeAgencia = (float) ($com['porcentaje_agencia'] ?? 0);   // % que se queda la agencia
                    $porcentajeVendedor = (float) ($com['porcentaje_vendedor'] ?? 100); // % del vendedor (de la comisión)
                    $porcentajeRtf = (float) ($com['porcentaje_rtf'] ?? 0);
                    $porcentajeIva = (float) ($com['porcentaje_iva'] ?? 0); // % IVA
                    $porcentajeReteiva = (float) ($com['porcentaje_reteiva'] ?? 0); // % ReteIVA (sobre el IVA)
                    $porcentajeReteica = (float) ($com['porcentaje_reteica'] ?? 0);
                    
                    // 1. Comisión total del ramo (lo que paga la aseguradora)
                    $comisionTotalRamo = $abonoPrima * ($porcentajeComision / 100);
                    // 2. Valor comisión del vendedor (su porcentaje de la comisión total)
                    $valorComision = $comisionTotalRamo * ($porcentajeVendedor / 100);
                    // 3. IVA: se SUMA al valor de comisión (es un ingreso adicional)
                    $ivaCalculado = $valorComision * ($porcentajeIva / 100);
                    // 4. Deducciones (se restan):
                    //    - RTF: sobre el valor de comisión
                    $rtfCalculada = $valorComision * ($porcentajeRtf / 100);
                    //    - ReteIVA: sobre el IVA
                    $reteivaCalculada = $ivaCalculado * ($porcentajeReteiva / 100);
                    //    - ReteICA: sobre el valor de comisión
                    $reteicaCalculada = $valorComision * ($porcentajeReteica / 100);
                    // 5. Neto = valor comisión + IVA - deducciones (RTF, ReteIVA, ReteICA)
                    $netoComision = $valorComision + $ivaCalculado - $rtfCalculada - $reteivaCalculada - $reteicaCalculada;

                    // Crear comisión manual
                    $comisionManual = ComisionManualPoliza::create([
                        'broker_id' => $brokerId,
                        'poliza_id' => $poliza->id,
                        'vendedor_id' => $vendedorId,
                        'aseguradora_id' => $poliza->aseguradora_id,
                        'numero_poliza' => $poliza->policy_number,
                        'anexo' => $com['anexo'] ?? null,
                        'tipo_movimiento' => $com['tipo_movimiento'],
                        'asegurado_nombre' => $poliza->client ? trim($poliza->client->first_name . ' ' . $poliza->client->last_name) : 'N/A',
                        'ramo' => $poliza->ramo?->nombre ?? $poliza->type ?? 'N/A',
                        'saldo' => 0,
                        'abono_prima' => $abonoPrima,
                        'porcentaje_comision' => $porcentajeVendedor, // Guardar el % del vendedor
                        'porcentaje_agencia' => $porcentajeAgencia,
                        'valor_comision' => $valorComision,
                        'porcentaje_rtf' => $porcentajeRtf,
                        'rtf_calculada' => $rtfCalculada,
                        'iva_19' => $ivaCalculado, // IVA calculado (se suma al neto)
                        'reteiva' => $reteivaCalculada,
                        'ica' => $reteicaCalculada,
                        'cree' => 0,
                        'neto_comision' => $netoComision,
                        'estado' => 'liquidada',
                        'creado_por' => $userId,
                    ]);

                    // Usar null para poliza_id en filas adicionales para evitar violación de restricción única
                    // La restricción unique es liquidacion_id + poliza_id
                    // Solo la primera fila tendrá poliza_id, las demás serán null
                    $esPrimeraFila = count($detalles) === 0;
                    $detalles[] = [
                        'poliza_id' => $esPrimeraFila ? $poliza->id : null, // Solo primera fila tiene poliza_id
                        'numero_poliza' => $poliza->policy_number . ($com['anexo'] ? ' - Anexo ' . $com['anexo'] : ''),
                        'cliente_nombre' => $this->resolveClienteName($poliza->client),
                        'aseguradora' => $poliza->aseguradora?->nombre ?? $poliza->insurance_company ?? 'N/A',
                        'ramo' => $poliza->ramo?->nombre ?? $poliza->type ?? 'N/A',
                        'fecha_poliza' => $poliza->start_date?->format('Y-m-d'),
                        'prima_neta' => $abonoPrima,
                        'porcentaje_comision' => $porcentajeVendedor,
                        'comision_bruta' => $valorComision,
                        'porcentaje_retencion' => $porcentajeRtf,
                        'monto_retencion' => $rtfCalculada,
                        'porcentaje_retencion_ica' => $porcentajeReteica,
                        'monto_retencion_ica' => $reteicaCalculada,
                        'porcentaje_iva' => $porcentajeIva,
                        'monto_iva' => $ivaCalculado,
                        'comision_neta' => $netoComision,
                    ];

                    $totales['prima_total'] += $abonoPrima;
                    $totales['monto_bruto_total'] += $valorComision;
                    $totales['monto_retencion_total'] += $rtfCalculada;
                    $totales['monto_retencion_ica_total'] += $reteicaCalculada;
                    $totales['monto_iva_total'] += $ivaCalculado;
                    $totales['monto_neto_total'] += $netoComision;
                }

                // Crear liquidación con código único (maneja reintentos automáticos)
                $liquidacion = LiquidacionVendedor::crearConReintento([
                    'broker_id' => $brokerId,
                    'vendedor_id' => $vendedorId,
                    'periodo_inicio' => $request->periodo_inicio,
                    'periodo_fin' => $request->periodo_fin,
                    'fecha_generacion' => now(),
                    'filtros_aplicados' => ['tipo' => 'liquidacion_poliza', 'poliza_id' => $poliza->id],
                    'prima_total' => $totales['prima_total'],
                    'monto_bruto_total' => $totales['monto_bruto_total'],
                    'monto_retencion_total' => $totales['monto_retencion_total'],
                    'monto_retencion_ica_total' => $totales['monto_retencion_ica_total'],
                    'monto_iva_total' => $totales['monto_iva_total'],
                    'monto_neto_total' => $totales['monto_neto_total'],
                    'cantidad_polizas' => count($detalles),
                    'estado' => 'generada',
                    'observaciones' => $request->observaciones,
                    'creado_por' => $userId,
                ]);

                // Crear detalles
                foreach ($detalles as $detalle) {
                    LiquidacionVendedorDetalle::create([
                        'liquidacion_id' => $liquidacion->id,
                        ...$detalle
                    ]);
                }

                // Actualizar comisiones manuales con liquidacion_id
                ComisionManualPoliza::where('broker_id', $brokerId)
                    ->where('poliza_id', $poliza->id)
                    ->where('vendedor_id', $vendedorId)
                    ->where('estado', 'liquidada')
                    ->whereNull('liquidacion_id')
                    ->update(['liquidacion_id' => $liquidacion->id]);

                $liquidacionesCreadas[] = $liquidacion->load(['vendedor']);
            }

            DB::commit();

            // Retornar la primera liquidación (o la única si solo hay un vendedor)
            $liquidacionPrincipal = $liquidacionesCreadas[0] ?? null;

            return response()->json([
                'success' => true,
                'message' => 'Liquidación creada exitosamente',
                'data' => $liquidacionPrincipal,
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al crear liquidación: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Obtener detalles de una liquidación para edición
     */
    public function obtenerDetalles($id, Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $liquidacion = LiquidacionVendedor::where('broker_id', $brokerId)
                ->with(['vendedor', 'detalles'])
                ->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => [
                    'liquidacion' => $liquidacion,
                    'detalles' => $liquidacion->detalles,
                    'observaciones' => $liquidacion->observaciones,
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener detalles: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Actualizar liquidación desde póliza
     */
    public function actualizarDesdePoliza($id, Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $userId = $this->getUserId($request);
            
            $validator = Validator::make($request->all(), [
                'poliza_id' => 'required|exists:polizas,id',
                'periodo_inicio' => 'required|date',
                'periodo_fin' => 'required|date|after_or_equal:periodo_inicio',
                'comisiones' => 'required|array|min:1',
                'comisiones.*.vendedor_id' => 'required|exists:vendedores,id',
                'comisiones.*.tipo_movimiento' => 'required|string',
                'comisiones.*.abono_prima' => 'required|numeric',
                'comisiones.*.porcentaje_comision' => 'required|numeric|min:0',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'errors' => $validator->errors(),
                ], 422);
            }

            DB::beginTransaction();

            $liquidacion = LiquidacionVendedor::where('broker_id', $brokerId)->findOrFail($id);
            $poliza = Poliza::findOrFail($request->poliza_id);
            
            // Eliminar detalles anteriores
            LiquidacionVendedorDetalle::where('liquidacion_id', $liquidacion->id)->delete();
            
            // Eliminar comisiones manuales anteriores asociadas
            ComisionManualPoliza::where('liquidacion_id', $liquidacion->id)->delete();

            // Calcular nuevos totales
            $totales = [
                'prima_total' => 0,
                'monto_bruto_total' => 0,
                'monto_retencion_total' => 0,
                'monto_retencion_ica_total' => 0,
                'monto_iva_total' => 0,
                'monto_neto_total' => 0,
            ];

            $detalles = [];
            $vendedorId = $request->comisiones[0]['vendedor_id'] ?? $liquidacion->vendedor_id;

            foreach ($request->comisiones as $index => $com) {
                $abonoPrima = (float) $com['abono_prima'];
                $porcentajeComision = (float) ($com['porcentaje_comision'] ?? 0);
                $porcentajeVendedor = (float) ($com['porcentaje_vendedor'] ?? 100);
                $porcentajeRtf = (float) ($com['porcentaje_rtf'] ?? 0);
                $porcentajeIva = (float) ($com['porcentaje_iva'] ?? 0);
                $porcentajeReteiva = (float) ($com['porcentaje_reteiva'] ?? 0);
                $porcentajeReteica = (float) ($com['porcentaje_reteica'] ?? 0);
                
                $comisionTotalRamo = $abonoPrima * ($porcentajeComision / 100);
                $valorComision = $comisionTotalRamo * ($porcentajeVendedor / 100);
                $ivaCalculado = $valorComision * ($porcentajeIva / 100);
                $rtfCalculada = $valorComision * ($porcentajeRtf / 100);
                $reteivaCalculada = $ivaCalculado * ($porcentajeReteiva / 100);
                $reteicaCalculada = $valorComision * ($porcentajeReteica / 100);
                $netoComision = $valorComision + $ivaCalculado - $rtfCalculada - $reteivaCalculada - $reteicaCalculada;

                // Crear comisión manual
                ComisionManualPoliza::create([
                    'broker_id' => $brokerId,
                    'poliza_id' => $poliza->id,
                    'vendedor_id' => $vendedorId,
                    'liquidacion_id' => $liquidacion->id,
                    'aseguradora_id' => $poliza->aseguradora_id,
                    'numero_poliza' => $poliza->policy_number,
                    'anexo' => $com['anexo'] ?? null,
                    'tipo_movimiento' => $com['tipo_movimiento'],
                    'asegurado_nombre' => $poliza->client ? trim($poliza->client->first_name . ' ' . $poliza->client->last_name) : 'N/A',
                    'ramo' => $poliza->ramo?->nombre ?? $poliza->type ?? 'N/A',
                    'saldo' => 0,
                    'abono_prima' => $abonoPrima,
                    'porcentaje_comision' => $porcentajeVendedor,
                    'porcentaje_agencia' => (float) ($com['porcentaje_agencia'] ?? 0),
                    'valor_comision' => $valorComision,
                    'porcentaje_rtf' => $porcentajeRtf,
                    'rtf_calculada' => $rtfCalculada,
                    'iva_19' => $ivaCalculado,
                    'reteiva' => $reteivaCalculada,
                    'ica' => $reteicaCalculada,
                    'cree' => 0,
                    'neto_comision' => $netoComision,
                    'estado' => 'liquidada',
                    'creado_por' => $userId,
                ]);

                $esPrimeraFila = count($detalles) === 0;
                $detalles[] = [
                    'poliza_id' => $esPrimeraFila ? $poliza->id : null,
                    'numero_poliza' => $poliza->policy_number . ($com['anexo'] ? ' - Anexo ' . $com['anexo'] : ''),
                    'cliente_nombre' => $this->resolveClienteName($poliza->client),
                    'aseguradora' => $poliza->aseguradora?->nombre ?? $poliza->insurance_company ?? 'N/A',
                    'ramo' => $poliza->ramo?->nombre ?? $poliza->type ?? 'N/A',
                    'fecha_poliza' => $poliza->start_date?->format('Y-m-d'),
                    'prima_neta' => $abonoPrima,
                    'porcentaje_comision' => $porcentajeVendedor,
                    'comision_bruta' => $valorComision,
                    'porcentaje_retencion' => $porcentajeRtf,
                    'monto_retencion' => $rtfCalculada,
                    'porcentaje_retencion_ica' => $porcentajeReteica,
                    'monto_retencion_ica' => $reteicaCalculada,
                    'porcentaje_iva' => $porcentajeIva,
                    'monto_iva' => $ivaCalculado,
                    'comision_neta' => $netoComision,
                ];

                $totales['prima_total'] += $abonoPrima;
                $totales['monto_bruto_total'] += $valorComision;
                $totales['monto_retencion_total'] += $rtfCalculada;
                $totales['monto_retencion_ica_total'] += $reteicaCalculada;
                $totales['monto_iva_total'] += $ivaCalculado;
                $totales['monto_neto_total'] += $netoComision;
            }

            // Crear nuevos detalles
            foreach ($detalles as $detalle) {
                LiquidacionVendedorDetalle::create([
                    'liquidacion_id' => $liquidacion->id,
                    ...$detalle
                ]);
            }

            // Actualizar liquidación
            $liquidacion->update([
                'periodo_inicio' => $request->periodo_inicio,
                'periodo_fin' => $request->periodo_fin,
                'prima_total' => $totales['prima_total'],
                'monto_bruto_total' => $totales['monto_bruto_total'],
                'monto_retencion_total' => $totales['monto_retencion_total'],
                'monto_retencion_ica_total' => $totales['monto_retencion_ica_total'],
                'monto_iva_total' => $totales['monto_iva_total'],
                'monto_neto_total' => $totales['monto_neto_total'],
                'cantidad_polizas' => count($detalles),
                'observaciones' => $request->observaciones,
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Liquidación actualizada exitosamente',
                'data' => $liquidacion->fresh()->load(['vendedor']),
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar liquidación: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Obtener liquidaciones de una póliza específica
     */
    public function liquidacionesPorPoliza($polizaId, Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            // Obtener IDs de liquidaciones que tienen comisiones de esta póliza
            $liquidacionIds = ComisionManualPoliza::where('broker_id', $brokerId)
                ->where('poliza_id', $polizaId)
                ->whereNotNull('liquidacion_id')
                ->pluck('liquidacion_id')
                ->unique();

            $liquidaciones = LiquidacionVendedor::where('broker_id', $brokerId)
                ->whereIn('id', $liquidacionIds)
                ->with(['vendedor'])
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $liquidaciones,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener liquidaciones: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Obtener datos de póliza para precargar el modal de liquidación
     */
    public function datosLiquidacionPoliza($polizaId, Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $poliza = Poliza::where('broker_id', $brokerId)
                ->with(['aseguradora', 'ramo', 'client'])
                ->find($polizaId);
            
            if (!$poliza) {
                // Intentar sin filtro de broker para pólizas compartidas
                $poliza = Poliza::with(['aseguradora', 'ramo', 'client'])->find($polizaId);
            }
            
            if (!$poliza) {
                return response()->json([
                    'success' => false,
                    'message' => 'Póliza no encontrada',
                ], 404);
            }

            // Obtener anexos de la póliza
            $anexos = \App\Models\Anexo::where('broker_id', $brokerId)
                ->where('poliza_id', $polizaId)
                ->whereNull('deleted_at')
                ->orderBy('anexo_number')
                ->get();

            // Obtener % comisión del ramo/aseguradora
            $porcentajeComisionRamo = 0;
            if ($poliza->ramo_id && $poliza->aseguradora_id) {
                $comisionAseguradora = \DB::table('comisiones_aseguradoras')
                    ->where('ramo_id', $poliza->ramo_id)
                    ->where('aseguradora_id', $poliza->aseguradora_id)
                    ->first();
                
                if ($comisionAseguradora) {
                    $porcentajeComisionRamo = $comisionAseguradora->porcentaje_comision ?? 0;
                }
            }

            // Si no hay comisión del ramo, usar la de la póliza
            if (!$porcentajeComisionRamo && $poliza->commission_percentage) {
                $porcentajeComisionRamo = $poliza->commission_percentage;
            }

            // Obtener deducciones del vendedor principal
            $porcentajeRtf = 0;
            $porcentajeReteiva = 0;
            $porcentajeReteica = 0;
            
            if ($poliza->seller_id) {
                $vendedor = Vendedor::find($poliza->seller_id);
                if ($vendedor) {
                    $porcentajeRtf = $vendedor->porcentaje_retencion ?? 0;
                    $porcentajeReteiva = $vendedor->porcentaje_retencion_iva ?? 0;
                    $porcentajeReteica = $vendedor->porcentaje_retencion_ica ?? 0;
                }
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'poliza' => [
                        'id' => $poliza->id,
                        'policy_number' => $poliza->policy_number,
                        'premium_amount' => (int) $poliza->premium_amount,
                        'commission_percentage' => $poliza->commission_percentage,
                        'aseguradora' => $poliza->aseguradora?->nombre ?? $poliza->insurance_company,
                        'ramo' => $poliza->ramo?->nombre ?? $poliza->type,
                        'cliente' => $poliza->client ? trim($poliza->client->first_name . ' ' . $poliza->client->last_name) : null,
                    ],
                    'anexos' => $anexos->map(function ($anexo) {
                        return [
                            'id' => $anexo->id,
                            'anexo_number' => $anexo->anexo_number,
                            'prima_neta' => $anexo->prima_neta,
                            'commission_percentage' => $anexo->commission_percentage,
                            'motivo' => $anexo->motivo,
                        ];
                    }),
                    'porcentaje_comision_ramo' => $porcentajeComisionRamo,
                    'porcentaje_rtf' => $porcentajeRtf,
                    'porcentaje_reteiva' => $porcentajeReteiva,
                    'porcentaje_reteica' => $porcentajeReteica,
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener datos de póliza: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Eliminar una liquidación
     */
    public function destroy($id, Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $liquidacion = LiquidacionVendedor::where('broker_id', $brokerId)
                ->findOrFail($id);

            // Solo permitir eliminar liquidaciones en estado 'generada'
            if ($liquidacion->estado !== 'generada') {
                return response()->json([
                    'success' => false,
                    'message' => 'Solo se pueden eliminar liquidaciones en estado "generada"',
                ], 422);
            }

            DB::beginTransaction();

            // Revertir el estado de las comisiones manuales asociadas
            ComisionManualPoliza::where('liquidacion_id', $liquidacion->id)
                ->update([
                    'liquidacion_id' => null,
                    'estado' => 'pendiente',
                ]);

            // Eliminar los detalles de la liquidación
            LiquidacionVendedorDetalle::where('liquidacion_id', $liquidacion->id)->delete();

            // Eliminar la liquidación
            $liquidacion->delete();

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Liquidación eliminada correctamente',
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar liquidación: ' . $e->getMessage(),
            ], 500);
        }
    }
}
