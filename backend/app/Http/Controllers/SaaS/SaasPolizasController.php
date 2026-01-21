<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\Poliza;
use App\Models\Automovil;
use App\Models\Broker;
use App\Models\Cliente;
use App\Models\RenewalHistory;
use App\Models\Aseguradora;
use App\Models\Ramo;
use App\Models\Vendedor;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;
use App\Services\BrokerAuthService;

class SaasPolizasController extends Controller
{
    /**
     * Registrar auditoría para acciones sobre pólizas
     */
    private function logPolizaAction(Request $request, string $action, $poliza, int $status = 200, array $metadata = []): void
    {
        try {
            if (!\Schema::hasTable('audit_logs')) return;

            $user = \Illuminate\Support\Facades\Auth::user();
            $payload = [
                'broker_id' => $poliza?->broker_id ?? null,
                'user_id' => $user?->id,
                'user_type' => $user ? class_basename($user) : null,
                'action' => $action,
                'module' => 'polizas',
                'ip_address' => $request->ip(),
                'user_agent' => substr((string)$request->userAgent(), 0, 255),
                'path' => $request->path(),
                'method' => $request->method(),
                'request_payload' => $request->all(),
                'response_status' => $status,
                'metadata' => array_merge([
                    'poliza_id' => $poliza?->id,
                    'policy_number' => $poliza?->policy_number,
                    'user_name' => $user?->name ?? ($user->nombres ?? ($user->nombre ?? $user?->email)),
                    'user_email' => $user?->email,
                ], $metadata),
            ];

            \App\Models\AuditLog::create($payload);
        } catch (\Throwable $e) {
            // No romper el flujo por fallos de auditoría
        }

    }

    /**
     * Obtener historial de renovaciones de una póliza (contactos y eventos)
     */
    public function historialRenovaciones(Request $request, int $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            /** @var Poliza|null $poliza */
            $poliza = Poliza::where('broker_id', $brokerId)->where('id', $id)->first();
            if (!$poliza) {
                return response()->json([
                    'success' => false,
                    'message' => 'Póliza no encontrada',
                ], 404);
            }

            // 1) Leer historial directamente desde renewal_history
            if (!Schema::hasTable('renewal_history')) {
                return response()->json([
                    'success' => true,
                    'message' => 'Historial de renovaciones obtenido correctamente',
                    'data' => [],
                ]);
            }

            $historial = RenewalHistory::where('poliza_id', $poliza->id)
                ->where('broker_id', $brokerId)
                ->orderBy('created_at', 'desc')
                ->limit(200)
                ->get()
                ->map(function ($h) {
                    $usuario = $h->user?->name ?? $h->user?->email ?? null;
                    $item = [
                        'tipo' => $h->action_type === 'renewal_processed' ? 'renovacion' : ($h->action_type === 'contact' ? 'contacto' : $h->action_type),
                        'fecha' => (string)($h->created_at ?? ''),
                        'usuario' => $usuario,
                        'metadata' => $h->metadata ?? [],
                    ];
                    if ($h->action_type === 'contact') {
                        $item['canal'] = $h->contact_type;
                        $item['resultado'] = $h->contact_result;
                        $item['observaciones'] = $h->description;
                        $item['proximo_contacto'] = $h->next_contact_date?->toDateTimeString();
                    } else {
                        $item['detalle'] = $h->title;
                        $item['descripcion'] = $h->description;
                    }
                    return $item;
                });

            return response()->json([
                'success' => true,
                'message' => 'Historial de renovaciones obtenido correctamente',
                'data' => $historial,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener historial de renovaciones: ' . $e->getMessage(),
            ], 500);
        }
    }
    /**
     * Get the broker ID for the current user (supports both Firebase users and employees)
     */
    private function getBrokerId(Request $request)
    {
        \Log::info('🔍 [DEBUG] getBrokerId - INICIANDO', [
            'step' => 'inicio',
            'request_has_authenticated_broker_id' => $request->has('authenticated_broker_id'),
            'authenticated_broker_id_value' => $request->get('authenticated_broker_id'),
            'auth_type' => $request->get('auth_type')
        ]);

        // 1. Primero intentar obtener desde el middleware GlobalBrokerAuth
        if ($request->has('authenticated_broker_id')) {
            $brokerId = $request->get('authenticated_broker_id');
            \Log::info('✅ [DEBUG] getBrokerId - ENCONTRADO desde middleware', [
                'broker_id' => $brokerId,
                'source' => 'middleware_authenticated_broker_id'
            ]);
            return $brokerId;
        }

        // 2. Intentar obtener desde broker_id directo del request (UnifiedAuthMiddleware)
        if ($request->has('broker_id')) {
            $brokerId = $request->get('broker_id');
            \Log::info('✅ [DEBUG] getBrokerId - ENCONTRADO desde request broker_id', [
                'broker_id' => $brokerId,
                'source' => 'request_broker_id'
            ]);
            return $brokerId;
        }

        \Log::info('🔍 [DEBUG] getBrokerId - No encontrado en middleware, probando usuarios autenticados');

        // 3. Verificar tipo de autenticación y obtener usuario correspondiente
        $authType = $request->get('auth_type');
        $user = null;

        if ($authType === 'empleado') {
            // Usuario autenticado como empleado
            $user = $request->get('authenticated_empleado');
            \Log::info('🔍 [DEBUG] getBrokerId - Usuario empleado', [
                'user_exists' => $user !== null,
                'user_id' => $user ? $user->id : null,
                'user_broker_id' => $user ? $user->broker_id : null
            ]);
        } else {
            // Usuario Firebase o tradicional
            $user = $request->user();

            \Log::info('🔍 [DEBUG] getBrokerId - Usuario Firebase del request', [
                'user_exists' => $user !== null,
                'user_id' => $user ? $user->id : null,
                'user_email' => $user ? $user->email : null,
                'user_broker_id' => $user ? $user->broker_id : null
            ]);

            // 4. Si no hay usuario, intentar obtenerlo de Auth (fallback)
            if (!$user) {
                \Log::info('🔍 [DEBUG] getBrokerId - No hay usuario en request, probando Auth::user()');
                $user = Auth::user();

                \Log::info('🔍 [DEBUG] getBrokerId - Usuario de Auth', [
                    'user_exists' => $user !== null,
                    'user_id' => $user ? $user->id : null,
                    'user_email' => $user ? $user->email : null,
                    'user_broker_id' => $user ? $user->broker_id : null
                ]);
            }
        }

        if ($user && isset($user->broker_id) && $user->broker_id) {
            \Log::info('✅ [DEBUG] getBrokerId - ENCONTRADO desde usuario', [
                'broker_id' => $user->broker_id,
                'user_id' => $user->id,
                'user_type' => get_class($user),
                'source' => 'authenticated_user'
            ]);
            return $user->broker_id;
        }

        // Si no hay usuario autenticado, lanzar excepción
        if (!$user) {
            \Log::error('❌ [DEBUG] getBrokerId - FALLA: Usuario no autenticado', [
                'auth_type' => $authType,
                'has_authenticated_empleado' => $request->has('authenticated_empleado'),
                'has_authenticated_user' => $request->has('authenticated_user')
            ]);
            throw new \Exception('Usuario no autenticado');
        }

        // Si el usuario no tiene broker_id, lanzar excepción
        if (!isset($user->broker_id) || !$user->broker_id) {
            \Log::error('❌ [DEBUG] getBrokerId - FALLA: Usuario no tiene broker asignado', [
                'user_id' => $user->id,
                'user_type' => get_class($user),
                'user_broker_id' => $user->broker_id ?? 'null'
            ]);
            throw new \Exception('Usuario no tiene un broker asignado');
        }

        return null; // Nunca debería llegar aquí
    }
    /**
     * Display a listing of polizas with filters and pagination (Development version without auth)
     */
    public function indexDev(Request $request)
    {
        try {
            // Obtener broker_id dinámicamente usando el método unificado
            $brokerId = $this->getBrokerId($request);
            
            // OPTIMIZACIÓN: Construir la query base con aislamiento multi-tenant y eager loading optimizado
            $query = Poliza::where('broker_id', $brokerId)
                ->with([
                    'client:id,client_type,first_name,last_name,company,company_legal_name,document_type,document_number,email,phone,mobile_phone,address,birth_date',
                    'assignedUser:id,name,email',
                    'createdBy:id,name,email',
                    'ramo:id,nombre,subramo',
                    'aseguradora:id,nombre',
                    'automoviles:id,placa,poliza_id,client_id'
                ]);

            // OPTIMIZACIÓN: Aplicar filtros con índices optimizados
            if ($request->has('search') && !empty($request->search)) {
                $searchOriginal = (string) $request->search;
                $search = trim($searchOriginal);
                $digitsOnly = preg_replace('/\D+/', '', $search);
                $upperSearch = strtoupper($search);

                $query->where(function($q) use ($search, $digitsOnly, $upperSearch) {
                    // Búsqueda básica existente
                    $q->where('policy_number', 'like', "%{$search}%")
                      ->orWhere('client_name', 'like', "%{$search}%")
                      ->orWhere('client_document', 'like', "%{$search}%")
                      ->orWhere('insurance_company', 'like', "%{$search}%")
                      // Riesgo asegurado (descripción del riesgo)
                      ->orWhere('description', 'like', "%{$search}%")
                      // Valor asegurado (búsqueda exacta si el término parece numérico)
                      ->when($digitsOnly !== '' && preg_match('/^\d{4,}$/', $digitsOnly), function($qq) use ($digitsOnly) {
                          $num = (float) $digitsOnly;
                          $qq->orWhere('insured_amount', $num);
                      })
                      // Placas guardadas en JSON/texto vehicle_plates
                      ->orWhere('vehicle_plates', 'like', "%{$upperSearch}%")
                      // Placas por relación automóviles
                      ->orWhereHas('automoviles', function($a) use ($upperSearch) {
                          $a->where('placa', 'like', "%{$upperSearch}%");
                      });
                });
            }

            if ($request->has('aseguradora') && !empty($request->aseguradora)) {
                $query->where('insurance_company', $request->aseguradora);
            }
            if ($request->filled('aseguradora_id')) {
                $query->where('aseguradora_id', $request->aseguradora_id);
            }

            if ($request->has('ramo') && !empty($request->ramo)) {
                $query->where('type', $this->mapTypeFromFrontend($request->ramo));
            }
            if ($request->filled('ramo_id')) {
                $query->where('ramo_id', $request->ramo_id);
            }

            if ($request->has('estado') && !empty($request->estado)) {
                $estadoFilter = strtoupper(trim((string)$request->estado));
                if ($estadoFilter === 'POR_VENCER') {
                    $today = Carbon::now()->toDateString();
                    $query->where('status', 'active')
                          ->whereRaw('DATEDIFF(end_date, ?) >= 0 AND DATEDIFF(end_date, ?) <= 30', [$today, $today]);
                } else {
                    $query->where('status', $this->mapStatusFromFrontend($request->estado));
                }
            }

            if ($request->has('client_id') && !empty($request->client_id)) {
                $query->where('client_id', $request->client_id);
            }

            // Filtro EXACTO por número de póliza (para verificar duplicados)
            if ($request->has('numero_poliza') && !empty($request->numero_poliza)) {
                $query->where('policy_number', trim($request->numero_poliza));
            }

            if ($request->has('vendedor') && !empty($request->vendedor)) {
                $vendedor = $request->vendedor;
                $query->where(function($q) use ($vendedor) {
                    // Buscar en seller_name (campo directo)
                    $q->where('seller_name', 'like', "%{$vendedor}%")
                      // O buscar en assignedUser.name (relación)
                      ->orWhereHas('assignedUser', function($qu) use ($vendedor) {
                          $qu->where('name', 'like', "%{$vendedor}%");
                      });
                });
            }

            // Nuevos filtros adicionales
            if ($request->has('renovable') && $request->renovable !== null && $request->renovable !== '') {
                $renovable = filter_var($request->renovable, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                if ($renovable !== null) {
                    $query->where('auto_renewal', $renovable);
                }
            }

            

            if ($request->has('fecha_recepcion_desde') && !empty($request->fecha_recepcion_desde)) {
                $query->where('reception_date', '>=', $request->fecha_recepcion_desde);
            }

            if ($request->has('fecha_recepcion_hasta') && !empty($request->fecha_recepcion_hasta)) {
                $query->where('reception_date', '<=', $request->fecha_recepcion_hasta);
            }

            if ($request->has('fecha_inicio') && !empty($request->fecha_inicio)) {
                $query->where('start_date', '>=', $request->fecha_inicio);
            }

            if ($request->has('fecha_fin') && !empty($request->fecha_fin)) {
                $query->where('end_date', '<=', $request->fecha_fin);
            }

            // Ordenamiento: siempre priorizar última póliza agregada primero
            $primarySortField = 'created_at';
            $query->orderBy($primarySortField, 'desc');

            // Orden secundario opcional desde el frontend (sin romper el primario)
            $sortField = $request->get('sort_field');
            $sortDirection = strtolower((string)$request->get('sort_direction', 'asc')) === 'desc' ? 'desc' : 'asc';
            
            // Mapear campos del frontend a campos de la BD
            $fieldMapping = [
                'numero_poliza' => 'policy_number',
                'fecha_fin' => 'end_date',
                'fecha_inicio' => 'start_date',
                'fecha_recepcion' => 'reception_date',
                'aseguradora' => 'insurance_company',
                'prima_neta' => 'premium_amount',
                'cliente' => 'client_name'
            ];

            $dbField = $fieldMapping[$sortField] ?? $sortField;
            if (!empty($dbField) && $dbField !== $primarySortField) {
                $query->orderBy($dbField, $sortDirection);
            }

            // Paginación
            $perPage = $request->get('per_page', 15);
            $polizas = $query->paginate($perPage);

            // Transformar los datos para el frontend
            $transformedData = $polizas->through(function ($poliza) {
                return $this->transformPolizaToFrontend($poliza);
            });

            // Devolver formato compatible con el frontend
            $response = $transformedData->toArray();
            $response['success'] = true;
            $response['message'] = 'Pólizas obtenidas exitosamente';

            return response()->json($response);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener las pólizas: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Display a listing of polizas with filters and pagination (Production version with auth)
     */
    public function index(Request $request)
    {
        try {
            // Obtener broker_id dinámicamente usando el método unificado
            $brokerId = $this->getBrokerId($request);
            
            // OPTIMIZACIÓN: Construir la query base con aislamiento multi-tenant y eager loading optimizado
            $query = Poliza::where('broker_id', $brokerId)
                ->with([
                    'client:id,client_type,first_name,last_name,company,company_legal_name,document_type,document_number,email,phone,mobile_phone,address,birth_date',
                    'assignedUser:id,name,email',
                    'createdBy:id,name,email',
                    'ramo:id,nombre,subramo',
                    'aseguradora:id,nombre',
                    'automoviles:id,placa,poliza_id,client_id'
                ]);

            // OPTIMIZACIÓN: Aplicar filtros con índices optimizados
            if ($request->has('search') && !empty($request->search)) {
                $searchOriginal = (string) $request->search;
                $search = trim($searchOriginal);
                $digitsOnly = preg_replace('/\D+/', '', $search);
                $upperSearch = strtoupper($search);

                $query->where(function($q) use ($search, $digitsOnly, $upperSearch) {
                    // Búsqueda básica existente
                    $q->where('policy_number', 'like', "%{$search}%")
                      ->orWhere('client_name', 'like', "%{$search}%")
                      ->orWhere('client_document', 'like', "%{$search}%")
                      ->orWhere('insurance_company', 'like', "%{$search}%")
                      // Riesgo asegurado (descripción del riesgo)
                      ->orWhere('description', 'like', "%{$search}%")
                      // Valor asegurado (búsqueda exacta si el término parece numérico)
                      ->when($digitsOnly !== '' && preg_match('/^\d{4,}$/', $digitsOnly), function($qq) use ($digitsOnly) {
                          $num = (float) $digitsOnly;
                          $qq->orWhere('insured_amount', $num);
                      })
                      // Placas guardadas en JSON/texto vehicle_plates
                      ->orWhere('vehicle_plates', 'like', "%{$upperSearch}%")
                      // Placas por relación automóviles
                      ->orWhereHas('automoviles', function($a) use ($upperSearch) {
                          $a->where('placa', 'like', "%{$upperSearch}%");
                      });
                });
            }

            if ($request->has('aseguradora') && !empty($request->aseguradora)) {
                $query->where('insurance_company', $request->aseguradora);
            }
            if ($request->filled('aseguradora_id')) {
                $query->where('aseguradora_id', $request->aseguradora_id);
            }

            if ($request->has('ramo') && !empty($request->ramo)) {
                $query->where('type', $this->mapTypeFromFrontend($request->ramo));
            }
            if ($request->filled('ramo_id')) {
                $query->where('ramo_id', $request->ramo_id);
            }

            if ($request->has('estado') && !empty($request->estado)) {
                $estadoFilter = strtoupper(trim((string)$request->estado));
                if ($estadoFilter === 'POR_VENCER') {
                    $today = Carbon::now()->toDateString();
                    $query->where('status', 'active')
                          ->whereRaw('DATEDIFF(end_date, ?) >= 0 AND DATEDIFF(end_date, ?) <= 30', [$today, $today]);
                } else {
                    $query->where('status', $this->mapStatusFromFrontend($request->estado));
                }
            }

            if ($request->has('client_id') && !empty($request->client_id)) {
                $query->where('client_id', $request->client_id);
            }

            // Filtro EXACTO por número de póliza (para verificar duplicados)
            if ($request->has('numero_poliza') && !empty($request->numero_poliza)) {
                $query->where('policy_number', trim($request->numero_poliza));
            }

            if ($request->has('vendedor') && !empty($request->vendedor)) {
                $vendedor = $request->vendedor;
                $query->where(function($q) use ($vendedor) {
                    // Buscar en seller_name (campo directo)
                    $q->where('seller_name', 'like', "%{$vendedor}%")
                      // O buscar en assignedUser.name (relación)
                      ->orWhereHas('assignedUser', function($qu) use ($vendedor) {
                          $qu->where('name', 'like', "%{$vendedor}%");
                      });
                });
            }

            // Renovable (booleano)
            if ($request->has('renovable') && $request->renovable !== null && $request->renovable !== '') {
                $renovable = filter_var($request->renovable, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                if ($renovable !== null) {
                    $query->where('auto_renewal', $renovable);
                }
            }

            // Fechas de recepción
            if ($request->has('fecha_recepcion_desde') && !empty($request->fecha_recepcion_desde)) {
                $query->where('reception_date', '>=', $request->fecha_recepcion_desde);
            }

            if ($request->has('fecha_recepcion_hasta') && !empty($request->fecha_recepcion_hasta)) {
                $query->where('reception_date', '<=', $request->fecha_recepcion_hasta);
            }

            // Fechas de vigencia
            if ($request->has('fecha_inicio') && !empty($request->fecha_inicio)) {
                $query->where('start_date', '>=', $request->fecha_inicio);
            }

            if ($request->has('fecha_fin') && !empty($request->fecha_fin)) {
                $query->where('end_date', '<=', $request->fecha_fin);
            }

            // Ordenamiento: siempre priorizar última póliza agregada primero
            $primarySortField = 'created_at';
            $query->orderBy($primarySortField, 'desc');

            // Orden secundario opcional desde el frontend (sin romper el primario)
            $sortField = $request->get('sort_field');
            $sortDirection = strtolower((string)$request->get('sort_direction', 'asc')) === 'desc' ? 'desc' : 'asc';
            
            // Mapear campos del frontend a campos de la BD
            $fieldMapping = [
                'numero_poliza' => 'policy_number',
                'fecha_fin' => 'end_date',
                'fecha_inicio' => 'start_date',
                'fecha_recepcion' => 'reception_date',
                'aseguradora' => 'insurance_company',
                'prima_neta' => 'premium_amount',
                'cliente' => 'client_name'
            ];
 
            $dbField = $fieldMapping[$sortField] ?? $sortField;
            if (!empty($dbField) && $dbField !== $primarySortField) {
                $query->orderBy($dbField, $sortDirection);
            }

            // Paginación
            $perPage = $request->get('per_page', 15);
            $polizas = $query->paginate($perPage);

            // Transformar los datos para el frontend
            $transformedData = $polizas->through(function ($poliza) {
                return $this->transformPolizaToFrontend($poliza);
            });

            // Devolver formato compatible con el frontend
            $response = $transformedData->toArray();
            $response['success'] = true;
            $response['message'] = 'Pólizas obtenidas exitosamente';

            return response()->json($response);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener las pólizas: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get active polizas for siniestros (Development version)
     */
    public function activasParaSiniestrosDev(Request $request)
    {
        try {
            // Obtener broker_id dinámicamente
            $brokerId = $this->getBrokerId($request);
            
            // Obtener solo pólizas activas para siniestros
            $polizas = Poliza::where('broker_id', $brokerId)
                ->where('status', 'active')
                ->with(['client'])
                ->orderBy('policy_number')
                ->get();

            // Transformar datos específicamente para el formulario de siniestros
            $polizasTransformadas = $polizas->map(function ($poliza) {
                return [
                    'id' => $poliza->id,
                    'numero_poliza' => $poliza->policy_number,
                    'aseguradora' => $poliza->insurance_company,
                    'ramo_principal' => $this->mapTypeToFrontend($poliza->type),
                    'subramo' => $poliza->product_name,
                    'nombres_cliente' => $poliza->client_name,
                    'apellidos_cliente' => '', // Se puede extraer del client_name si es necesario
                    'dni_cliente' => $poliza->client_document,
                    'correo_cliente' => $poliza->client?->email ?? '',
                    'telefono_cliente' => $poliza->client?->phone ?? '',
                    'nombre_completo_cliente' => $poliza->client_name,
                    'prima_neta' => $poliza->premium_amount,
                    'fecha_inicio' => $poliza->start_date?->format('Y-m-d'),
                    'fecha_fin' => $poliza->end_date?->format('Y-m-d'),
                    'estado' => $this->mapStatusToFrontend($poliza->status),
                    'valor_asegurado' => $poliza->insured_amount,
                ];
            });

            return response()->json([
                'success' => true,
                'message' => 'Pólizas activas obtenidas exitosamente',
                'data' => $polizasTransformadas
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener las pólizas: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get cartera data - optimized endpoint for portfolio view with real payment data
     */
    public function carteraDev(Request $request)
    {
        try {
            // Obtener broker_id dinámicamente
            $brokerId = $this->getBrokerId($request);
            
            // Obtener nombre del broker para usarlo como fallback cuando no hay vendedor asignado
            $brokerName = 'Broker';
            $broker = \App\Models\Broker::find($brokerId);
            if ($broker) {
                $brokerName = $broker->company_name ?: ($broker->contact_name ?: 'Broker');
            }

            // 1. CALCULAR ESTADÍSTICAS GLOBALES (TOTALES REALES)
            // Se calculan sobre todas las pólizas activas del broker, sin filtros de búsqueda ni paginación
            // Calcular siempre para mantener los KPIs visibles en todas las páginas
            
            // Definiciones SQL para cálculos (alineados con la query principal)
            $totalPolizaExpr = 'COALESCE(polizas.total_amount, (polizas.premium_amount + COALESCE(polizas.vat_amount, 0)))';
            $recaudadoOficinaExpr = "COALESCE((SELECT SUM(monto_pagado) FROM pagos_polizas WHERE pagos_polizas.poliza_id = polizas.id AND tipo_recaudo = 'oficina'), 0)";
            $pendienteOficinaExpr = "GREATEST(0, {$totalPolizaExpr} - {$recaudadoOficinaExpr})";
            $comisionExpr = "COALESCE(polizas.commission_amount, (polizas.premium_amount * COALESCE(polizas.commission_percentage, 15) / 100))";

            // Usamos DB::table para máxima eficiencia en agregación
            $statsRaw = DB::table('polizas')
                ->where('broker_id', $brokerId)
                ->where('status', 'active')
                ->whereNull('deleted_at')
                ->selectRaw("
                    COUNT(*) as total_polizas,
                    SUM({$totalPolizaExpr}) as total_cartera,
                    SUM({$comisionExpr}) as total_comisiones,
                    SUM({$pendienteOficinaExpr}) as por_cobrar_total,
                    SUM({$recaudadoOficinaExpr}) as recaudado_total
                ")
                ->first();

            $estadisticas = [
                'totalPolizas' => (int) ($statsRaw->total_polizas ?? 0),
                'polizasActivas' => (int) ($statsRaw->total_polizas ?? 0),
                'primaTotal' => (float) ($statsRaw->total_cartera ?? 0),
                'comisionesTotal' => (float) ($statsRaw->total_comisiones ?? 0),
                'recaudadoTotal' => (float) ($statsRaw->recaudado_total ?? 0),
                'porCobrarTotal' => (float) ($statsRaw->por_cobrar_total ?? 0),
                'tasaRecaudo' => ($statsRaw->total_cartera ?? 0) > 0 ? ((($statsRaw->recaudado_total ?? 0) / $statsRaw->total_cartera) * 100) : 0,
                'porCobrarVencido' => 0,
                'polizasVencidas' => 0,
                'polizasPorVencer' => 0
            ];

            // Calcular contadores para cada tab (siempre, para mostrar en títulos)
            $pagadoAseguradoraExpr = "COALESCE((SELECT SUM(monto_pagado) FROM pagos_polizas WHERE pagos_polizas.poliza_id = polizas.id AND tipo_recaudo = 'aseguradora' AND estado = 'pagado'), 0)";
            $pendienteAseguradoraExpr = "COALESCE((SELECT SUM(monto_pendiente) FROM pagos_polizas WHERE pagos_polizas.poliza_id = polizas.id AND tipo_recaudo = 'aseguradora' AND estado IN ('pendiente', 'parcial')), 0)";
            $tienePagosAseguradoraExpr = "(SELECT COUNT(*) FROM pagos_polizas WHERE pagos_polizas.poliza_id = polizas.id AND tipo_recaudo = 'aseguradora')";
            $pendienteAseguradoraRealExpr = "(CASE WHEN {$tienePagosAseguradoraExpr} > 0 THEN {$pendienteAseguradoraExpr} ELSE polizas.premium_amount END)";

            $tabCounters = DB::table('polizas')
                ->where('broker_id', $brokerId)
                ->where('status', 'active')
                ->whereNull('deleted_at')
                ->selectRaw("
                    SUM(CASE WHEN ({$totalPolizaExpr} - {$recaudadoOficinaExpr}) > 1 THEN 1 ELSE 0 END) as count_por_cobrar,
                    SUM(CASE WHEN ({$totalPolizaExpr} - {$recaudadoOficinaExpr}) <= 1 AND {$recaudadoOficinaExpr} > 0 AND {$pendienteAseguradoraRealExpr} > 0 THEN 1 ELSE 0 END) as count_por_pagar,
                    SUM(CASE WHEN {$pagadoAseguradoraExpr} > 0 THEN 1 ELSE 0 END) as count_recaudos_completados
                ")
                ->first();

            // Contar clientes únicos para el tab general
            $clientesCount = DB::table('polizas')
                ->where('broker_id', $brokerId)
                ->where('status', 'active')
                ->whereNull('deleted_at')
                ->distinct('client_id')
                ->count('client_id');

            $contadoresTabs = [
                'general' => (int) $clientesCount,
                'porCobrar' => (int) ($tabCounters->count_por_cobrar ?? 0),
                'porPagar' => (int) ($tabCounters->count_por_pagar ?? 0),
                'recaudosCompletados' => (int) ($tabCounters->count_recaudos_completados ?? 0),
            ];

            // 2. CONSTRUIR QUERY PRINCIPAL CON PAGINACIÓN
            $query = DB::table('polizas')
                ->leftJoin('clientes', 'polizas.client_id', '=', 'clientes.id')
                ->leftJoin('aseguradoras', 'polizas.aseguradora_id', '=', 'aseguradoras.id')
                ->leftJoin('ramos', 'polizas.ramo_id', '=', 'ramos.id')
                ->leftJoin('users', 'polizas.assigned_user_id', '=', 'users.id')
                ->where('polizas.broker_id', $brokerId)
                ->where('polizas.status', 'active')
                ->whereNull('polizas.deleted_at')
                ->selectRaw('
                    polizas.id,
                    polizas.policy_number,
                    polizas.client_id,
                    polizas.insurance_company,
                    polizas.aseguradora_id,
                    polizas.type,
                    polizas.ramo_id,
                    polizas.premium_amount,
                    polizas.commission_amount,
                    polizas.commission_percentage,
                    polizas.vat_percentage,
                    polizas.vat_amount,
                    polizas.total_amount,
                    polizas.start_date,
                    polizas.end_date,
                    polizas.status,
                    polizas.payment_status,
                    polizas.created_at,
                    polizas.assigned_user_id,
                    polizas.seller_name,
                    TRIM(CONCAT(COALESCE(clientes.first_name, ""), " ", COALESCE(clientes.last_name, ""))) as cliente_nombre,
                    clientes.document_number as cliente_documento,
                    aseguradoras.nombre as aseguradora_nombre,
                    ramos.nombre as ramo_nombre,
                    users.name as vendedor_nombre,
                    -- Cálculos de pagos
                    COALESCE((SELECT SUM(monto_pagado) FROM pagos_polizas WHERE pagos_polizas.poliza_id = polizas.id AND tipo_recaudo = "oficina"), 0) as recaudado_oficina,
                    COALESCE((SELECT SUM(monto_pagado) FROM pagos_polizas WHERE pagos_polizas.poliza_id = polizas.id AND tipo_recaudo = "aseguradora" AND estado = "pagado"), 0) as pagado_aseguradora,
                    COALESCE((SELECT SUM(monto_pendiente) FROM pagos_polizas WHERE pagos_polizas.poliza_id = polizas.id AND tipo_recaudo = "aseguradora" AND estado IN ("pendiente", "parcial")), 0) as pendiente_aseguradora_reg,
                    (SELECT COUNT(*) FROM pagos_polizas WHERE pagos_polizas.poliza_id = polizas.id AND tipo_recaudo = "oficina") as tiene_pagos_oficina,
                    (SELECT COUNT(*) FROM pagos_polizas WHERE pagos_polizas.poliza_id = polizas.id AND tipo_recaudo = "aseguradora") as tiene_pagos_aseguradora,
                    COALESCE((SELECT SUM(monto_cobrado) FROM cobros_comisiones WHERE cobros_comisiones.poliza_id = polizas.id AND estado = "cobrado"), 0) as comision_cobrada,
                    COALESCE((SELECT SUM(monto_pendiente) FROM cobros_comisiones WHERE cobros_comisiones.poliza_id = polizas.id AND estado IN ("pendiente", "parcial")), 0) as comision_pendiente_reg,
                    (SELECT COUNT(*) FROM cobros_comisiones WHERE cobros_comisiones.poliza_id = polizas.id) as tiene_cobros_comision
                ');

        // Aplicar filtros adicionales si se especifican
        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('polizas.policy_number', 'like', "%{$search}%")
                  ->orWhereRaw('TRIM(CONCAT(COALESCE(clientes.first_name, ""), " ", COALESCE(clientes.last_name, ""))) LIKE ?', ["%{$search}%"])
                  ->orWhere('clientes.document_number', 'like', "%{$search}%")
                  ->orWhere('polizas.insurance_company', 'like', "%{$search}%");
            });
        }

        if ($request->has('aseguradora') && !empty($request->aseguradora)) {
            $query->where('polizas.insurance_company', $request->aseguradora);
        }

        if ($request->has('estado_pago') && !empty($request->estado_pago)) {
            // Filtrar por estado de pago basado en pagos reales
            $estadoPago = $request->estado_pago;
            $query->whereHas('pagos', function($q) use ($estadoPago) {
                if ($estadoPago === 'Al día') {
                    $q->where('tipo_recaudo', 'oficina')
                      ->where('estado', 'pagado')
                      ->havingRaw('SUM(monto_pagado) >= polizas.total_amount');
                } elseif ($estadoPago === 'Pendiente') {
                    $q->where('tipo_recaudo', 'oficina')
                      ->whereIn('estado', ['pendiente', 'parcial'])
                      ->havingRaw('SUM(monto_pagado) = 0');
                } elseif ($estadoPago === 'Parcial') {
                    $q->where('tipo_recaudo', 'oficina')
                      ->where('estado', 'parcial')
                      ->havingRaw('SUM(monto_pagado) > 0 AND SUM(monto_pagado) < polizas.total_amount');
                } elseif ($estadoPago === 'Vencido') {
                    $q->where('tipo_recaudo', 'oficina')
                      ->where('estado', 'vencido');
                }
            });
        }

        // Filtrar por vendedor
        if ($request->has('vendedor') && !empty($request->vendedor)) {
            $vendedor = $request->vendedor;
            $query->where(function($q) use ($vendedor) {
                $q->where('polizas.assigned_user_id', $vendedor)
                  ->orWhere('polizas.seller_name', 'like', "%{$vendedor}%");
            });
        }

        // Filtrar por vendedor_id específico
        if ($request->has('vendedor_id') && !empty($request->vendedor_id)) {
            $query->where('polizas.assigned_user_id', $request->vendedor_id);
        }

        // Filtro por tab/vista (aplicar ANTES de paginar)
        if ($request->filled('tab')) {
            $tab = trim((string) $request->tab);

            // Subconsultas SQL para usar en WHERE (necesarias para que paginate() cuente bien los registros)
            // No podemos usar alias del SELECT en el WHERE, debemos repetir la subconsulta
            $recaudadoOficinaSql = "COALESCE((SELECT SUM(monto_pagado) FROM pagos_polizas WHERE pagos_polizas.poliza_id = polizas.id AND tipo_recaudo = 'oficina'), 0)";
            $pagadoAseguradoraSql = "COALESCE((SELECT SUM(monto_pagado) FROM pagos_polizas WHERE pagos_polizas.poliza_id = polizas.id AND tipo_recaudo = 'aseguradora' AND estado = 'pagado'), 0)";
            $pendienteAseguradoraRegSql = "COALESCE((SELECT SUM(monto_pendiente) FROM pagos_polizas WHERE pagos_polizas.poliza_id = polizas.id AND tipo_recaudo = 'aseguradora' AND estado IN ('pendiente', 'parcial')), 0)";
            $tienePagosAseguradoraSql = "(SELECT COUNT(*) FROM pagos_polizas WHERE pagos_polizas.poliza_id = polizas.id AND tipo_recaudo = 'aseguradora')";
            $totalPolizaSql = "COALESCE(polizas.total_amount, (polizas.premium_amount + COALESCE(polizas.vat_amount, 0)))";
            
            // Pendiente real aseguradora (si no hay pagos registrados, es la prima total)
            $pendienteAseguradoraRealSql = "(CASE WHEN {$tienePagosAseguradoraSql} > 0 THEN {$pendienteAseguradoraRegSql} ELSE polizas.premium_amount END)";

            switch ($tab) {
                case 'porCobrar':
                    // Pendiente por oficina > 0 (puede tener pagos parciales de aseguradora)
                    $query->whereRaw("({$totalPolizaSql} - {$recaudadoOficinaSql}) > 1"); 
                    break;

                case 'porPagar':
                    // Oficina pagada (pendiente <= 1) Y recaudado algo Y aseguradora pendiente
                    $query->whereRaw("({$totalPolizaSql} - {$recaudadoOficinaSql}) <= 1")
                          ->whereRaw("{$recaudadoOficinaSql} > 0")
                          ->whereRaw("{$pendienteAseguradoraRealSql} > 0");
                    break;

                case 'recaudosCompletados':
                    // Tiene pago a aseguradora completado (sin importar si pasó por oficina o no)
                    $query->whereRaw("{$pagadoAseguradoraSql} > 0");
                    break;
            }
        }

        // Aplicar ordenamiento por fecha de vencimiento por defecto
        $query->orderBy('polizas.end_date', 'asc');

        // Paginación del servidor - páginas pequeñas para carga rápida
        $perPage = $request->input('per_page', 25);
        $page = $request->input('page', 1);
        
        // Limitar máximo de registros por página
        $perPage = min($perPage, 100);
        
        $polizasPaginated = $query->paginate($perPage, ['*'], 'page', $page);
        $polizas = $polizasPaginated->getCollection();

        // Transformar datos optimizados para cartera - USANDO CAMPOS PRECALCULADOS EN SQL
        $carteraData = $polizas->map(function ($poliza) use ($brokerName) {
            $endDate = Carbon::parse($poliza->end_date);
            $diasVencimiento = (int) round(Carbon::now()->diffInDays($endDate, false));

            $totalPoliza = (float) ($poliza->total_amount ?? ($poliza->premium_amount + ($poliza->vat_amount ?? ($poliza->premium_amount * ($poliza->vat_percentage ?? 19) / 100))));
            $primaNeta = (float) $poliza->premium_amount;

            // USAR VALORES PRECALCULADOS EN SQL (mucho más rápido)
            $recaudadoOficina = (float) ($poliza->recaudado_oficina ?? 0);
            $pendienteOficina = $poliza->tiene_pagos_oficina > 0
                ? max(0, $totalPoliza - $recaudadoOficina)
                : $totalPoliza;

            $pagadoAseguradora = (float) ($poliza->pagado_aseguradora ?? 0);
            $pendienteAseguradora = $poliza->tiene_pagos_aseguradora > 0
                ? (float) ($poliza->pendiente_aseguradora_reg ?? 0)
                : $primaNeta;

            $comisionTotal = (float) ($poliza->commission_amount ?? ($poliza->premium_amount * ($poliza->commission_percentage ?? 15) / 100));
            $comisionCobrada = (float) ($poliza->comision_cobrada ?? 0);
            $comisionPendiente = $poliza->tiene_cobros_comision > 0
                ? (float) ($poliza->comision_pendiente_reg ?? 0)
                : $comisionTotal;

            // Determinar estado de pago
            $estadoPago = $this->determinarEstadoPago($recaudadoOficina, $totalPoliza);

            return [
                'id' => $poliza->id,
                'numero_poliza' => $poliza->policy_number,
                'cliente' => $poliza->cliente_nombre ?: 'Sin nombre',
                'cliente_id' => $poliza->client_id,
                'documento' => $poliza->cliente_documento ?? '',
                'aseguradora' => $poliza->aseguradora_nombre ?? $poliza->insurance_company,
                'ramo' => $poliza->ramo_nombre ?? $poliza->type,
                'estado' => 'ACTIVA',
                'fecha_inicio' => $poliza->start_date,
                'fecha_vencimiento' => $poliza->end_date,
                'dias_vencimiento' => (int) $diasVencimiento,
                'prima_neta' => $primaNeta,
                'iva' => (float) ($poliza->vat_amount ?? ($poliza->premium_amount * ($poliza->vat_percentage ?? 19) / 100)),
                'total' => $totalPoliza,
                'comision' => $comisionTotal,
                'forma_pago' => 'Contado',
                'estado_pago' => $estadoPago,
                'vendedor' => $poliza->vendedor_nombre ?: ($poliza->seller_name ?: $brokerName),
                'vendedor_id' => $poliza->assigned_user_id,

                // Información detallada de cobros (valores precalculados en SQL)
                    'recaudo_oficina' => [
                        'recaudado' => $recaudadoOficina,
                        'pendiente' => $pendienteOficina,
                        'total' => $totalPoliza,
                    ],
                    'recaudo_aseguradora' => [
                        'pagado' => $pagadoAseguradora,
                        'pendiente' => $pendienteAseguradora,
                        'total' => $primaNeta,
                    ],
                    'cobro_comision' => [
                        'cobrada' => $comisionCobrada,
                        'pendiente' => $comisionPendiente,
                        'total' => $comisionTotal,
                    ]
                ];
            });

            return response()->json([
                'success' => true,
                'message' => 'Cartera obtenida exitosamente',
                'data' => $carteraData,
                'pagination' => [
                    'current_page' => $polizasPaginated->currentPage(),
                    'last_page' => $polizasPaginated->lastPage(),
                    'per_page' => $polizasPaginated->perPage(),
                    'total' => $polizasPaginated->total(),
                ],
                'estadisticas' => $estadisticas, // Incluir estadísticas globales
                'contadoresTabs' => $contadoresTabs // Contadores para títulos de tabs
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener la cartera: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get polizas statistics (Development version without auth) - OPTIMIZED
     */
    public function estadisticasDev(Request $request)
    {
        try {
            // Obtener broker_id dinámicamente
            $brokerId = $this->getBrokerId($request);

            // OPTIMIZACIÓN: Una sola consulta para obtener todas las estadísticas
            $stats = Poliza::where('broker_id', $brokerId)
                ->selectRaw('
                    COUNT(*) as total_polizas,
                    COUNT(CASE WHEN status = "active" THEN 1 END) as polizas_activas,
                    COUNT(CASE WHEN status = "expired" THEN 1 END) as polizas_vencidas,
                    COUNT(CASE WHEN status = "active" AND end_date <= DATE_ADD(NOW(), INTERVAL 30 DAY) THEN 1 END) as polizas_por_vencer,
                    SUM(CASE WHEN status = "active" THEN premium_amount ELSE 0 END) as valor_total_primas
                ')
                ->first();

            // Si no hay pólizas, devolver ceros reales
            if ($stats->total_polizas === 0) {
                return response()->json([
                    'success' => true,
                    'message' => 'No hay pólizas registradas para este broker',
                    'data' => [
                        'total_polizas' => 0,
                        'polizas_activas' => 0,
                        'polizas_vencidas' => 0,
                        'polizas_por_vencer' => 0,
                        'valor_total_primas' => 0,
                    ]
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Estadísticas obtenidas exitosamente',
                'data' => [
                    'total_polizas' => (int) $stats->total_polizas,
                    'polizas_activas' => (int) $stats->polizas_activas,
                    'polizas_vencidas' => (int) $stats->polizas_vencidas,
                    'polizas_por_vencer' => (int) $stats->polizas_por_vencer,
                    'valor_total_primas' => (float) $stats->valor_total_primas,
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener las estadísticas: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get polizas statistics (Production version with auth) - OPTIMIZED
     */
    public function estadisticas(Request $request)
    {
        try {
            // Obtener broker_id dinámicamente usando el método unificado
            $brokerId = $this->getBrokerId($request);

            // OPTIMIZACIÓN: Una sola consulta para estadísticas básicas
            $basicStats = Poliza::where('broker_id', $brokerId)
                ->selectRaw('
                    COUNT(*) as total_polizas,
                    COUNT(CASE WHEN status = "active" THEN 1 END) as polizas_activas,
                    COUNT(CASE WHEN status = "expired" THEN 1 END) as polizas_vencidas,
                    COUNT(CASE WHEN status = "active" AND end_date <= DATE_ADD(NOW(), INTERVAL 30 DAY) THEN 1 END) as polizas_por_vencer,
                    SUM(CASE WHEN status = "active" THEN premium_amount ELSE 0 END) as prima_total,
                    SUM(CASE WHEN status = "active" THEN commission_amount ELSE 0 END) as comision_total
                ')
                ->first();

            // OPTIMIZACIÓN: Estadísticas por mes (últimos 12 meses) - consulta optimizada
            $polizasPorMes = DB::table('polizas')
                ->where('broker_id', $brokerId)
                ->selectRaw('
                    YEAR(created_at) as year,
                    MONTH(created_at) as month,
                    COUNT(*) as total
                ')
                ->where('created_at', '>=', Carbon::now()->subMonths(12))
                ->groupByRaw('YEAR(created_at), MONTH(created_at)')
                ->orderByRaw('YEAR(created_at), MONTH(created_at)')
                ->get();

            // OPTIMIZACIÓN: Estadísticas por ramo, estado y aseguradora en una sola consulta
            $groupedStats = DB::table('polizas')
                ->where('broker_id', $brokerId)
                ->selectRaw('
                    type,
                    status,
                    insurance_company,
                    COUNT(*) as count
                ')
                ->groupBy('type', 'status', 'insurance_company')
                ->get();

            // Procesar estadísticas agrupadas
            $polizasPorRamo = collect($groupedStats)->groupBy('type')
                ->map(function ($items) {
                    return ['type' => $items->first()->type, 'total' => $items->sum('count')];
                })->values();

            $polizasPorEstado = collect($groupedStats)->groupBy('status')
                ->map(function ($items) {
                    return ['status' => $items->first()->status, 'total' => $items->sum('count')];
                })->values();

            $polizasPorAseguradora = collect($groupedStats)->groupBy('insurance_company')
                ->map(function ($items) {
                    return ['insurance_company' => $items->first()->insurance_company, 'total' => $items->sum('count')];
                })->sortByDesc('total')->take(10)->values();

            return response()->json([
                'success' => true,
                'message' => 'Estadísticas obtenidas exitosamente',
                'data' => [
                    'total_polizas' => (int) $basicStats->total_polizas,
                    'polizas_activas' => (int) $basicStats->polizas_activas,
                    'polizas_vencidas' => (int) $basicStats->polizas_vencidas,
                    'polizas_por_vencer' => (int) $basicStats->polizas_por_vencer,
                    'prima_total' => (float) $basicStats->prima_total,
                    'comision_total' => (float) $basicStats->comision_total,
                    'polizas_por_mes' => $polizasPorMes,
                    'polizas_por_ramo' => $polizasPorRamo,
                    'polizas_por_estado' => $polizasPorEstado,
                    'polizas_por_aseguradora' => $polizasPorAseguradora,
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener estadísticas: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Obtener nombre de cliente para mostrar (maneja personas y empresas)
     */
    private function getClientDisplayName($poliza): string
    {
        $client = $poliza->client;
        
        // Si no hay cliente relacionado, usar client_name de la póliza
        if (!$client) {
            return $poliza->client_name ?? '';
        }
        
        // Si es empresa (client_type = 'business' o 'empresa'), usar company o company_legal_name
        $clientType = strtolower($client->client_type ?? '');
        if (in_array($clientType, ['business', 'empresa', 'juridica', 'juridico'])) {
            // Priorizar company_legal_name (razón social), luego company
            return $client->company_legal_name ?: ($client->company ?: ($client->first_name ?? ''));
        }
        
        // Para personas naturales, usar first_name + last_name
        $firstName = $client->first_name ?? '';
        $lastName = $client->last_name ?? '';
        $fullName = trim($firstName . ' ' . $lastName);
        
        // Si no hay nombre, usar client_name de la póliza como fallback
        return $fullName ?: ($poliza->client_name ?? '');
    }

    /**
     * Obtener solo el primer nombre del cliente (para evitar duplicación con apellidos)
     */
    private function getClientFirstName($poliza): string
    {
        $client = $poliza->client;
        
        // Si no hay cliente relacionado, usar client_name de la póliza
        if (!$client) {
            return $poliza->client_name ?? '';
        }
        
        // Si es empresa, usar razón social completa en nombres_cliente
        $clientType = strtolower($client->client_type ?? '');
        if (in_array($clientType, ['business', 'empresa', 'juridica', 'juridico'])) {
            return $client->company_legal_name ?: ($client->company ?: ($client->first_name ?? ''));
        }
        
        // Para personas naturales, solo devolver first_name
        return $client->first_name ?? ($poliza->client_name ?? '');
    }

    /**
     * Obtener solo el apellido del cliente
     */
    private function getClientLastName($poliza): string
    {
        $client = $poliza->client;
        
        // Si no hay cliente o es empresa, no hay apellido separado
        if (!$client) {
            return '';
        }
        
        $clientType = strtolower($client->client_type ?? '');
        if (in_array($clientType, ['business', 'empresa', 'juridica', 'juridico'])) {
            return ''; // Empresas no tienen apellido separado
        }
        
        // Para personas naturales, devolver last_name
        return $client->last_name ?? '';
    }

    /**
     * Transform Poliza model to frontend format
     */
    private function transformPolizaToFrontend($poliza)
    {
        // Unificar placas desde polizas.vehicle_plates y la relación automoviles
        $vehiclePlates = $poliza->vehicle_plates;
        if (is_string($vehiclePlates)) {
            $decoded = json_decode($vehiclePlates, true);
            if (is_array($decoded)) { $vehiclePlates = $decoded; }
        }
        $vehiclePlates = is_array($vehiclePlates) ? $vehiclePlates : [];
        $autoPlates = $poliza->relationLoaded('automoviles') ? $poliza->automoviles->pluck('placa')->filter()->values()->all() : [];
        $placas = array_values(array_unique(array_filter(array_map(function($p){ return strtoupper(trim((string)$p)); }, array_merge($vehiclePlates, $autoPlates)))));

        return [
            'id' => $poliza->id,
            'numero_poliza' => $poliza->policy_number,
            'riesgo' => $poliza->description,
            'valor_riesgo_asegurado' => (int) round((float) $poliza->insured_amount),
            'aseguradora' => $poliza->insurance_company,
            'ramo_principal' => $this->mapTypeToFrontend($poliza->type),
            'subramo' => $poliza->product_name,
            'ramo_id' => $poliza->ramo_id,
            'ramo_nombre' => $poliza->ramo?->nombre,
            'aseguradora_id' => $poliza->aseguradora_id,
            'aseguradora_nombre' => $poliza->aseguradora?->nombre,
            'tipo_poliza' => $poliza->type,
            
            // Información del cliente
            'cliente_id' => $poliza->client_id,
            // Para empresas usar razón social, para personas separar first_name y last_name
            'nombres_cliente' => $this->getClientFirstName($poliza),
            'apellidos_cliente' => $this->getClientLastName($poliza),
            'dni_cliente' => $poliza->client_document ?: ($poliza->client?->document_number ?? ''),
            'tipo_documento' => strtolower((string)($poliza->client?->document_type ?? 'cc')),
            'telefono_cliente' => $poliza->client?->phone ?? '',
            'celular_cliente' => $poliza->client?->mobile_phone ?? '',
            'domicilio' => $poliza->client?->address ?? '',
            'correo_cliente' => $poliza->client?->email ?? '',
            'correos_secundarios' => ($poliza->custom_fields['cliente_correos_secundarios'] ?? ''),
            'observaciones_cliente' => ($poliza->custom_fields['cliente_observaciones'] ?? ''),
            'fecha_expedicion_dni' => isset($poliza->custom_fields['cliente_fecha_expedicion_dni'])
                ? (string)$poliza->custom_fields['cliente_fecha_expedicion_dni']
                : '',
            'fecha_nacimiento' => $poliza->client?->birth_date?->format('Y-m-d') ?? '',
            
            // Información financiera
            'prima_neta' => (int) round((float) $poliza->premium_amount),
            'porcentaje_iva' => $poliza->vat_percentage ?? 19.00,
            'iva' => (int) round((float) ($poliza->vat_amount ?? ($poliza->premium_amount * (($poliza->vat_percentage ?? 19.00) / 100)))),
            'total' => (int) round((float) ($poliza->total_amount ?? ($poliza->premium_amount + ($poliza->vat_amount ?? ($poliza->premium_amount * (($poliza->vat_percentage ?? 19.00) / 100)))))),
            'gastos_adicionales' => (int) round((float) ($poliza->gastos_adicionales ?? 0)),
            'porcentaje_comision' => (float) $poliza->commission_percentage,
            'comision' => (int) round((float) $poliza->commission_amount),
            // Forma de pago (UI: contado/credito/financiado) derivada del método
            'forma_pago' => ($this->mapPaymentMethodToFormaPagoCode($poliza->payment_method) ?: ($poliza->custom_fields['forma_pago'] ?? '')),
            // Periodicidad (códigos UI: mensual/trimestral/semestral/anual)
            'periodicidad_pago' => $this->mapPaymentFrequencyToCode($poliza->payment_frequency),
            // Medio de pago (códigos UI: tarjeta_credito/transferencia/cheque/convenio/efectivo)
            'medio_pago' => ($poliza->half_payment ?: $this->mapPaymentMethodToCode($poliza->payment_method)),

            // Datos de pago adicionales requeridos por el formulario de edición
            'bank_name' => $poliza->bank_name,
            'installments_count' => $poliza->installments_count,
            'card_last4' => $poliza->card_last4,
            'cheque_number' => $poliza->cheque_number,
            'agreement_term' => $poliza->agreement_term,
            'debit_account_number' => $poliza->debit_account_number,

            // Partes: Tomador / Asegurado (para prefijar en el paso final)
            'policy_holder_name' => ($poliza->policy_holder_name ?? ($poliza->custom_fields['policy_holder_name'] ?? null)),
            'policy_holder_document' => ($poliza->policy_holder_document ?? ($poliza->custom_fields['policy_holder_document'] ?? null)),
            'insured_name' => ($poliza->insured_name ?? ($poliza->custom_fields['insured_name'] ?? null)),
            'insured_document' => ($poliza->insured_document ?? ($poliza->custom_fields['insured_document'] ?? null)),
            
            // Información administrativa - Vendedores
            'vendedor' => ($poliza->seller_name
                ?: ($poliza->assignedUser?->name ?? 'Sin asignar')
            ),
            'vendedor_id' => $poliza->seller_id,
            'vendedor_id_2' => $poliza->seller_id_2,
            'vendedor_2' => $poliza->seller_name_2,
            'enlace_externo' => $poliza->external_link,
            'observaciones' => $poliza->notes,
            'observaciones_internas' => $poliza->status_notes,
            'fecha_expedicion' => $poliza->issue_date?->format('Y-m-d'),
            'fecha_recepcion' => $poliza->reception_date?->format('Y-m-d'),
            'fecha_inicio' => $poliza->start_date?->format('Y-m-d'),
            'fecha_fin' => $poliza->end_date?->format('Y-m-d'),
            'estado' => $this->mapStatusToFrontend($poliza->status),
            'sede' => ($poliza->custom_fields['sede'] ?? 'Principal'), // Preferir sede guardada en custom_fields
            'renovable' => (bool) $poliza->auto_renewal,
            'motivo' => $poliza->reason,
            
            'pri_a_pre' => $poliza->pri_a_pre,
            'participacion' => $poliza->participation,
            'co_corretaje' => $poliza->co_brokerage,
            'comision_agencia' => $poliza->agency_commission,
            'porcentaje_retencion' => $poliza->withholding_percentage,
            'porcentaje_reteiva' => $poliza->reteiva_percentage,
            'beneficiario_en_remision' => (bool) $poliza->beneficiary_in_remittance,
            'beneficiario_oneroso_nombre' => $poliza->beneficiary_name,
            'beneficiario_oneroso_documento' => $poliza->beneficiary_document,
            
            'documents' => $poliza->documents ?? [],
            // Placas de vehículos (aplica para ramos automotores: Automóvil y SOAT)
            'placas' => ($this->mapTypeFromFrontend($poliza->ramo?->nombre ?? $poliza->type) === 'autos') ? $placas : [],
            // Notificaciones
            
            
            // Metadatos
            'created_at' => $poliza->created_at?->toISOString(),
            'updated_at' => $poliza->updated_at?->toISOString(),
            
            // Campos calculados
            'nombre_completo_cliente' => $poliza->client_name,
            'dias_para_vencimiento' => $poliza->end_date ? Carbon::now()->diffInDays($poliza->end_date, false) : null,
            'esta_vencida' => $poliza->status === 'expired',
            'esta_por_vencer' => $poliza->end_date && Carbon::now()->addDays(30)->gte($poliza->end_date),
        ];
    }

    /**
     * Get renovaciones (polizas que necesitan renovación) with filters and pagination
     */
    public function renovacionesDev(Request $request)
    {
        try {
            // Obtener broker_id dinámicamente
            $brokerId = $this->getBrokerId($request);
            
            // Normalizar parámetros desde frontend (camelCase → snake_case)
            if ($request->has('diasVencimiento') && !$request->has('dias_vencimiento')) {
                $request->merge(['dias_vencimiento' => $request->get('diasVencimiento')]);
            }

            // Días para considerar renovaciones críticas, próximas, etc.
            $diasCritico = 7;
            $diasProximo = 30;
            $diasAdelantado = 60; // 2 meses - solo próximas a vencer
            
            // Construir la query base con aislamiento multi-tenant
            $query = Poliza::where('broker_id', $brokerId)
                ->with(['client', 'assignedUser', 'createdBy', 'ramo', 'automoviles']);

            // Normalización de filtros de cliente
            if ($request->has('cliente_id') && !$request->has('client_id')) {
                $request->merge(['client_id' => $request->get('cliente_id')]);
            }
            if ($request->has('client_id') && !empty($request->client_id)) {
                $query->where('client_id', $request->client_id);
            }
            if ($request->has('dni_cliente') && !empty($request->dni_cliente)) {
                $query->where('client_document', $request->dni_cliente);
            }

            // Filtros de estado y ventana (opcionalmente controlados desde frontend)
            if ($request->has('status') && !empty($request->status)) {
                $query->where('status', $request->status);
            }

            // Filtrar por días de vencimiento - sin limitaciones por defecto
            if ($request->has('dias_vencimiento') && !empty($request->dias_vencimiento)) {
                $filtro = $request->dias_vencimiento;
                $today = Carbon::now();

                if ($filtro === 'critico') {
                    // Crítico: vencen en 7 días o menos
                    $query->whereRaw('DATEDIFF(end_date, ?) <= ?', [$today->toDateString(), $diasCritico]);
                } elseif ($filtro === 'proximo') {
                    // Próximo: vencen en 30 días o menos
                    $query->whereRaw('DATEDIFF(end_date, ?) <= ?', [$today->toDateString(), $diasProximo]);
                } elseif ($filtro === 'proximo_2m') {
                    // Próximos 2 meses: vencen en 60 días o menos
                    $query->whereRaw('DATEDIFF(end_date, ?) <= ? AND DATEDIFF(end_date, ?) >= ?',
                        [$today->toDateString(), $diasAdelantado, $today->toDateString(), -30]);
                }
                // Si es 'all' o cualquier otro valor, no aplicar filtro de días
            }
            // Sin filtro de días por defecto - mostrar todas las renovaciones

            // Aplicar filtros adicionales
            if ($request->has('search') && !empty($request->search)) {
                $search = $request->search;
                $searchUpper = strtoupper($search);
                $query->where(function($q) use ($search, $searchUpper) {
                    $q->where('policy_number', 'like', "%{$search}%")
                      ->orWhere('client_name', 'like', "%{$search}%")
                      ->orWhere('client_document', 'like', "%{$search}%")
                      ->orWhere('insurance_company', 'like', "%{$search}%")
                      // Buscar placa en automóviles vinculados
                      ->orWhereHas('automoviles', function($qa) use ($searchUpper) {
                          $qa->where('placa', 'like', "%{$searchUpper}%");
                      })
                      // Buscar placa en campos de texto (notes, description)
                      ->orWhere('notes', 'like', "%{$searchUpper}%")
                      ->orWhere('description', 'like', "%{$searchUpper}%");
                });
            }

            if ($request->has('aseguradora') && !empty($request->aseguradora)) {
                $query->where('insurance_company', $request->aseguradora);
            }

            if ($request->has('agente') && !empty($request->agente)) {
                $agente = $request->agente;
                $query->where(function($q) use ($agente) {
                    // Buscar en seller_name (campo directo)
                    $q->where('seller_name', 'like', "%{$agente}%")
                      // O buscar en vendedor.nombres (relación con tabla vendedores)
                      ->orWhereHas('vendedor', function($qv) use ($agente) {
                          $qv->where('nombres', 'like', "%{$agente}%");
                      })
                      // O buscar en assignedUser.name (usuario asignado)
                      ->orWhereHas('assignedUser', function($qu) use ($agente) {
                          $qu->where('name', 'like', "%{$agente}%");
                      });
                });
            }

            // Rango de fechas (vencimiento) - permite filtrar solo enero, etc.
            if ($request->has('fecha_inicio') && !empty($request->fecha_inicio)) {
                $query->whereDate('end_date', '>=', $request->fecha_inicio);
            }
            if ($request->has('fecha_fin') && !empty($request->fecha_fin)) {
                $query->whereDate('end_date', '<=', $request->fecha_fin);
            }

            // Filtro por ramo
            if ($request->has('ramo') && !empty($request->ramo)) {
                $ramo = $request->ramo;
                $query->where(function($q) use ($ramo) {
                    $q->whereHas('ramo', function($qr) use ($ramo) {
                        $qr->where('nombre', 'like', "%{$ramo}%");
                    })
                    ->orWhere('type', 'like', "%{$ramo}%");
                });
            }

            // Filtro por estado de renovación (acepta múltiples separados por coma)
            // VENCIDO: DATEDIFF(end_date, today) < 0 AND status != 'renewed'
            // CRITICO: 0..7 días AND status != 'renewed'
            // PENDIENTE/EN_PROCESO: 8..30 días AND status != 'renewed'
            // RENOVADO: status = 'renewed'
            if ($request->filled('estado')) {
                $today = Carbon::now();
                $estados = array_filter(array_map('trim', explode(',', strtoupper((string) $request->estado))));
                if (!empty($estados)) {
                    $query->where(function ($q) use ($estados, $today) {
                        foreach ($estados as $estado) {
                            switch ($estado) {
                                case 'VENCIDO':
                                    $q->orWhere(function($subQ) use ($today) {
                                        $subQ->whereRaw('DATEDIFF(end_date, ?) < 0', [$today->toDateString()])
                                             ->where('status', '!=', 'renewed');
                                    });
                                    break;
                                case 'CRITICO':
                                    $q->orWhere(function($subQ) use ($today) {
                                        $subQ->whereRaw('DATEDIFF(end_date, ?) >= 0 AND DATEDIFF(end_date, ?) <= 7', [$today->toDateString(), $today->toDateString()])
                                             ->where('status', '!=', 'renewed');
                                    });
                                    break;
                                case 'PENDIENTE':
                                case 'EN_PROCESO':
                                    $q->orWhere(function($subQ) use ($today) {
                                        $subQ->whereRaw('DATEDIFF(end_date, ?) > 7 AND DATEDIFF(end_date, ?) <= 30', [$today->toDateString(), $today->toDateString()])
                                             ->where('status', '!=', 'renewed');
                                    });
                                    break;
                                case 'RENOVADO':
                                    $q->orWhere('status', 'renewed');
                                    break;
                                default:
                                    // ignorar
                                    break;
                            }
                        }
                    });
                }
            }

            // Ordenamiento por defecto: días hasta vencimiento (ascendente - más próxima primero)
            $sortField = $request->get('sort_field', 'dias_vencimiento');
            $sortDirection = $request->get('sort_direction', 'asc');
            
            if ($sortField === 'dias_vencimiento' || $sortField === 'fechaVencimiento') {
                $query->orderByRaw('DATEDIFF(end_date, ?) ' . $sortDirection, [Carbon::now()->toDateString()]);
            } else {
                // Mapear campos del frontend a campos de la BD
                $fieldMapping = [
                    'numero_poliza' => 'policy_number',
                    'cliente' => 'client_name',
                    'aseguradora' => 'insurance_company',
                    'prima' => 'premium_amount'
                ];
                $dbField = $fieldMapping[$sortField] ?? $sortField;
                $query->orderBy($dbField, $sortDirection);
            }

            // Paginación
            $perPage = $request->get('per_page', 15);
            $polizas = $query->paginate($perPage);

            // Transformar los datos para el frontend como renovaciones
            $transformedData = $polizas->through(function ($poliza) {
                return $this->transformPolizaToRenovacion($poliza);
            });

            // Devolver formato compatible con el frontend
            $response = $transformedData->toArray();
            $response['success'] = true;
            $response['message'] = 'Renovaciones obtenidas exitosamente';

            return response()->json($response);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener las renovaciones: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get renovaciones statistics
     */
    public function estadisticasRenovacionesDev(Request $request)
    {
        try {
            // Obtener broker_id dinámicamente
            $brokerId = $this->getBrokerId($request);
            
            $today = Carbon::now();
            
            // Query base: todas las pólizas del broker (sin filtros de status ni fecha)
            $baseQuery = Poliza::where('broker_id', $brokerId);

            // Total renovaciones: todas las pólizas
            $totalRenovaciones = (clone $baseQuery)->count();

            // Renovaciones críticas: 0-7 días y NO renovadas
            $renovacionesCriticas = (clone $baseQuery)
                ->whereRaw('DATEDIFF(end_date, ?) >= 0 AND DATEDIFF(end_date, ?) <= 7', 
                    [$today->toDateString(), $today->toDateString()])
                ->where('status', '!=', 'renewed')
                ->count();

            // Renovaciones pendientes: 8-30 días y NO renovadas
            $renovacionesPendientes = (clone $baseQuery)
                ->whereRaw('DATEDIFF(end_date, ?) > 7 AND DATEDIFF(end_date, ?) <= 30',
                    [$today->toDateString(), $today->toDateString()])
                ->where('status', '!=', 'renewed')
                ->count();

            // Renovaciones vencidas: días negativos y NO renovadas
            $renovacionesVencidas = (clone $baseQuery)
                ->whereRaw('DATEDIFF(end_date, ?) < 0', [$today->toDateString()])
                ->where('status', '!=', 'renewed')
                ->count();

            // Renovaciones completadas: todas las pólizas con status 'renewed'
            $renovacionesCompletadas = (clone $baseQuery)
                ->where('status', 'renewed')
                ->count();

            // Valor total de primas: suma de todas las pólizas
            $valorTotalPrimas = (clone $baseQuery)->sum('premium_amount');

            return response()->json([
                'success' => true,
                'message' => 'Estadísticas de renovaciones obtenidas exitosamente',
                'data' => [
                    'total_renovaciones' => $totalRenovaciones,
                    'renovaciones_criticas' => $renovacionesCriticas,
                    'renovaciones_pendientes' => $renovacionesPendientes,
                    'renovaciones_vencidas' => $renovacionesVencidas,
                    'renovaciones_completadas' => $renovacionesCompletadas,
                    'valor_total_primas' => $valorTotalPrimas,
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener estadísticas de renovaciones: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Transform a poliza to renovacion format for frontend
     */
    private function transformPolizaToRenovacion($poliza)
    {
        $today = Carbon::now();
        // Tolerancia: algunas pólizas importadas pueden no traer timestamps o end_date casteado
        $endDate = $poliza->end_date ? Carbon::parse($poliza->end_date) : Carbon::now();
        $diasVencimiento = (int) round($today->diffInDays($endDate, false));

        // Determinar estado de renovación
        // Primero verificar si está renovada (tiene prioridad sobre todo)
        if ($poliza->status === 'renewed') {
            $estado = 'RENOVADO';
        } elseif ($diasVencimiento < 0) {
            $estado = 'VENCIDO';
        } elseif ($diasVencimiento <= 7) {
            $estado = 'CRITICO';
        } else {
            $estado = 'PENDIENTE';
        }

        // Determinar prioridad con lógica más coherente
        // Primero evaluar urgencia temporal, luego ajustar por valor económico
        $prioridad = 'MEDIA'; // Default

        // 1. URGENCIA TEMPORAL (base de la prioridad)
        if ($diasVencimiento < 0) {
            // Vencidas: siempre críticas
            $prioridad = 'CRITICA';
        } elseif ($diasVencimiento <= 7) {
            // Vencen en 7 días o menos: críticas
            $prioridad = 'CRITICA';
        } elseif ($diasVencimiento <= 15) {
            // Vencen en 8-15 días: altas
            $prioridad = 'ALTA';
        } elseif ($diasVencimiento <= 30) {
            // Vencen en 16-30 días: media
            $prioridad = 'MEDIA';
        } else {
            // Vencen en más de 30 días: baja
            $prioridad = 'BAJA';
        }

        // 2. AJUSTE POR VALOR ECONÓMICO (puede elevar la prioridad, nunca bajarla)
        if ($poliza->premium_amount >= 5000000) {
            // Primas muy altas (≥$5M): siempre críticas
            $prioridad = 'CRITICA';
        } elseif ($poliza->premium_amount >= 2000000 && $prioridad !== 'CRITICA') {
            // Primas altas (≥$2M): mínimo alta (si no es ya crítica por tiempo)
            if ($prioridad === 'MEDIA' || $prioridad === 'BAJA') {
                $prioridad = 'ALTA';
            }
        } elseif ($poliza->premium_amount >= 1000000 && $prioridad === 'BAJA') {
            // Primas medias-altas (≥$1M): mínimo media (si era baja por tiempo)
            $prioridad = 'MEDIA';
        }

        // Obtener el ramo correcto: usar ramo.nombre si existe, sino usar type directamente (sin mapeo a vida)
        $ramoNombre = $poliza->ramo?->nombre ?? ($poliza->type ?: 'Sin ramo');

        // Obtener placa del primer automóvil vinculado (si existe)
        $placa = null;
        if ($poliza->automoviles && $poliza->automoviles->count() > 0) {
            $placa = $poliza->automoviles->first()->placa;
        }

        return [
            'id' => (string)$poliza->id,
            'numeroPoliza' => $poliza->policy_number,
            'cliente' => $poliza->client_name,
            'dni_cliente' => $poliza->client_document,
            'aseguradora' => $poliza->insurance_company,
            'tipoSeguro' => $ramoNombre, // Usar el nombre del ramo correcto
            'ramo' => $ramoNombre,
            'placa' => $placa,
            'fechaVencimiento' => $endDate->format('Y-m-d'),
            'diasVencimiento' => (int)$diasVencimiento,
            'valorPrima' => (float)$poliza->premium_amount,
            'estado' => $estado,
            'prioridad' => $prioridad,
            'agente' => $poliza->assignedUser ? $poliza->assignedUser->name : 'Sin asignar',
            'ultimoContacto' => $poliza->last_renewal_notice_sent ?
                ($poliza->last_renewal_notice_sent instanceof \Carbon\Carbon
                    ? $poliza->last_renewal_notice_sent->format('Y-m-d')
                    : Carbon::parse($poliza->last_renewal_notice_sent)->format('Y-m-d'))
                : (
                    $poliza->updated_at
                        ? ($poliza->updated_at instanceof \Carbon\Carbon
                            ? $poliza->updated_at->format('Y-m-d')
                            : Carbon::parse($poliza->updated_at)->format('Y-m-d'))
                        : ($poliza->created_at
                            ? ($poliza->created_at instanceof \Carbon\Carbon
                                ? $poliza->created_at->format('Y-m-d')
                                : Carbon::parse($poliza->created_at)->format('Y-m-d'))
                            : $today->format('Y-m-d'))
                  ),
            'intentosContacto' => 0, // Este campo se podría agregar al modelo en el futuro
            'observaciones' => $poliza->notes ?? 'Sin observaciones',
            'poliza_id' => $poliza->id, // Para referencia a la póliza original
        ];
    }

    /**
     * Map tipo de seguro from database to frontend format
     */
    private function mapTipoSeguroToFrontend($tipo)
    {
        $mapping = [
            'life' => 'vida',
            'auto' => 'automovil',
            'home' => 'hogar',
            'health' => 'salud',
            'business' => 'empresarial',
            'vehicles' => 'automovil',
            'property' => 'hogar',
            'liability' => 'empresarial',
        ];

        return $mapping[strtolower($tipo)] ?? 'otros';
    }

    /**
     * Get a specific poliza (Development version - works with or without auth)
     */
    public function show(Request $request, $id)
    {
        try {
            // Obtener broker_id dinámicamente
            $brokerId = $this->getBrokerId($request);
            
            $poliza = Poliza::where('broker_id', $brokerId)
                ->where('id', $id)
                ->with(['client', 'assignedUser', 'ramo:id,nombre,subramo', 'aseguradora:id,nombre', 'automoviles:id,placa,poliza_id,client_id'])
                ->first();

            if (!$poliza) {
                return response()->json([
                    'success' => false,
                    'message' => 'Póliza no encontrada',
                ], 404);
            }

            // Historial de cambios básico (si existe tabla audit_logs)
            $historial = [];
            try {
                if (\Schema::hasTable('audit_logs')) {
                    $historial = \App\Models\AuditLog::where('module', 'polizas')
                        ->where(function($q) use ($poliza) {
                            $q->where('metadata->poliza_id', $poliza->id)
                              ->orWhere('path', 'like', "%/polizas/{$poliza->id}%");
                        })
                        ->orderByDesc('created_at')
                        ->limit(200)
                        ->get(['id','user_id','action','path','method','request_payload','response_status','metadata','created_at']);

                    // Enriquecer con nombre de usuario si no viene
                    $userIds = $historial->pluck('user_id')->filter()->unique()->values();
                    if ($userIds->count() > 0) {
                        $users = \App\Models\User::whereIn('id', $userIds)->get(['id','name','email']);
                        $map = [];
                        foreach ($users as $u) { $map[$u->id] = $u->name ?: $u->email; }
                        $historial->transform(function ($log) use ($map) {
                            $meta = is_array($log->metadata) ? $log->metadata : (json_decode($log->metadata, true) ?: []);
                            if (empty($meta['user_name']) && !empty($log->user_id) && isset($map[$log->user_id])) {
                                $meta['user_name'] = $map[$log->user_id];
                            }
                            $log->metadata = $meta;
                            return $log;
                        });
                    }
                }
            } catch (\Throwable $e) {
                $historial = [];
            }

            return response()->json([
                'success' => true,
                'message' => 'Póliza obtenida exitosamente',
                'data' => $this->transformPolizaToFrontend($poliza) + [ 'historial' => $historial ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener la póliza: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store a new poliza (Development version - works with or without auth)
     */
    public function store(Request $request)
    {
        try {
            // Obtener broker_id dinámicamente
            $brokerId = $this->getBrokerId($request);
            $user = Auth::user(); // Puede ser null en desarrollo

            $validated = $request->validate([
                'numero_poliza' => 'required|string|max:255',
                'riesgo' => 'nullable|string',
                'valor_riesgo_asegurado' => 'nullable|numeric',
                'aseguradora' => 'required|string|max:255',
                'ramo_principal' => 'required|string|max:255',
                'subramo' => 'nullable|string|max:255',
                // Cliente: usar cliente_id o datos básicos
                'cliente_id' => 'nullable|integer|exists:clientes,id',
                'nombres_cliente' => 'required_without:cliente_id|string|max:255',
                'apellidos_cliente' => 'nullable|string|max:255',
                'dni_cliente' => 'required_without:cliente_id|string|max:50',
                'telefono_cliente' => 'nullable|string|max:20',
                'celular_cliente' => 'nullable|string|max:20',
                'domicilio' => 'nullable|string',
                'correo_cliente' => 'nullable|email|max:255',
                'correos_secundarios' => 'nullable|string|max:1000',
                'observaciones_cliente' => 'nullable|string|max:2000',
                'tipo_documento' => 'nullable|string|max:10',
                'fecha_expedicion_dni' => 'nullable|date',
                'fecha_nacimiento' => 'nullable|date',
                'prima_neta' => 'required|numeric|min:0',
                'porcentaje_iva' => 'nullable|numeric|min:0|max:100',
                'iva' => 'nullable|numeric|min:0',
                'total' => 'nullable|numeric|min:0',
                'gastos_adicionales' => 'nullable|numeric|min:0',
                'porcentaje_comision' => 'nullable|numeric|min:0|max:100',
                'comision' => 'nullable|numeric|min:0',
                'forma_pago' => 'nullable|string|max:100',
                'periodicidad_pago' => 'nullable|string|max:100',
                'medio_pago' => 'nullable|string|max:100',
                // Placas (edición)
                'placas' => 'nullable|array',
                'placas.*' => ['nullable','string','max:20','regex:/^[A-Za-z0-9-]{3,20}$/'],
                'renovable' => 'nullable|boolean',
                // Datos de pago adicionales
                'banco' => 'nullable|string|max:255',
                'cuotas' => 'nullable|integer|min:1|required_if:medio_pago,tarjeta_credito',
                'numero_tarjeta' => ['nullable','string','max:32','regex:/^[0-9]{4,19}$/','required_if:medio_pago,tarjeta_credito'],
                'cheque_number' => 'nullable|string|max:64|required_if:medio_pago,cheque,cheque_al_dia,cheque_postfechado',
                'agreement_term' => 'nullable|string|in:contado,30_45,30_60,60_90|required_if:medio_pago,convenio',
                'debit_account_number' => 'nullable|string|max:64|required_if:medio_pago,debito',
                'vendedor' => 'nullable|string|max:255',
                'observaciones' => 'nullable|string',
                'observaciones_internas' => 'nullable|string',
                'fecha_expedicion' => 'required|date',
                'fecha_inicio' => 'required|date',
                'fecha_fin' => 'required|date|after:fecha_inicio',
                'estado' => 'nullable|in:ACTIVA,VENCIDA,CANCELADA,SUSPENDIDA,COTIZACION,DEVENGADA,EXPEDICION,NO_RENOVADA,PENDIENTE,COTIZACIÓN,EXPEDICIÓN,VIGENTE',
                'sede' => 'nullable|string|max:255',

                // Nuevos campos para edición coherentes con store
                'vendedor_user_id' => 'nullable|integer|exists:users,id',
                'vendedor_id' => 'nullable|integer|exists:vendedores,id',
                'vendedor_id_2' => 'nullable|integer|exists:vendedores,id',
                'fecha_recepcion' => 'nullable|date',
                'enlace_externo' => 'nullable|string|max:500',

                // Beneficiarios
                'beneficiario_en_remision' => 'nullable|boolean',
                'beneficiario_oneroso_nombre' => 'nullable|string|max:255',
                'beneficiario_oneroso_documento' => 'nullable|string|max:255',
            ]);

            \Log::info('POLIZAS: store incoming', [
                'ramo_principal_raw' => $request->input('ramo_principal'),
                'ramo_mapped' => $this->mapTypeFromFrontend($request->input('ramo_principal')),
                'placas' => $request->input('placas'),
            ]);

            // Si viene vendedor_id (catálogo de vendedores), mapear su nombre para seller_name
            $sellerId = null;
            if (isset($validated['vendedor_id'])) {
                $vend = Vendedor::forBroker($brokerId)->find((int)$validated['vendedor_id']);
                if ($vend) {
                    $sellerId = $vend->id;
                    $validated['vendedor'] = $validated['vendedor'] ?? $vend->nombres;
                }
            }
            
            // Si viene vendedor_id_2 (segundo vendedor opcional)
            $sellerId2 = null;
            $sellerName2 = null;
            if (isset($validated['vendedor_id_2']) && !empty($validated['vendedor_id_2'])) {
                $vend2 = Vendedor::forBroker($brokerId)->find((int)$validated['vendedor_id_2']);
                if ($vend2) {
                    $sellerId2 = $vend2->id;
                    $sellerName2 = $vend2->nombres;
                }
            }

            // Resolver cliente por cliente_id o crear/buscar por documento
            if (!empty($validated['cliente_id'])) {
                $cliente = Cliente::where('broker_id', $brokerId)->where('id', $validated['cliente_id'])->first();
                if (!$cliente) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Cliente no pertenece al broker actual',
                    ], 422);
                }
                // Actualizar metadatos del cliente si se enviaron
                $cliente->update([
                    'document_type' => !empty($validated['tipo_documento']) ? strtoupper($validated['tipo_documento']) : ($cliente->document_type ?? 'CC'),
                    'birth_date' => $validated['fecha_nacimiento'] ?? $cliente->birth_date,
                ]);
            } else {
                $cliente = Cliente::firstOrCreate([
                    'document_number' => $validated['dni_cliente'],
                    'broker_id' => $brokerId,
                ], [
                    'first_name' => $validated['nombres_cliente'],
                    'last_name' => $validated['apellidos_cliente'] ?? '',
                    'phone' => $validated['telefono_cliente'] ?? '',
                    'mobile_phone' => $validated['celular_cliente'] ?? '',
                    'address' => $validated['domicilio'] ?? '',
                    'email' => $validated['correo_cliente'] ?? '',
                    'document_type' => strtoupper($validated['tipo_documento'] ?? 'CC'),
                    'birth_date' => $validated['fecha_nacimiento'] ?? null,
                    'status' => 'active',
                ]);
            }

            // Verificar duplicado de número de póliza por broker antes de crear
            $dup = Poliza::where('broker_id', $brokerId)
                ->where('policy_number', $validated['numero_poliza'])
                ->first();
            if ($dup) {
                return response()->json([
                    'success' => false,
                    'code' => 'DUPLICATE_POLICY_NUMBER',
                    'message' => 'El número de póliza ya existe para este broker',
                    'data' => [
                        'id' => $dup->id,
                        'policy_number' => $dup->policy_number,
                    ]
                ], 409);
            }

            // Resolver catálogo: aseguradora_id y ramo_id (por id o por nombre)
            $aseguradoraId = null;
            if (isset($validated['aseguradora']) && $validated['aseguradora'] !== null && $validated['aseguradora'] !== '') {
                $asegVal = $validated['aseguradora'];
                if (is_numeric($asegVal)) {
                    $rowA = Aseguradora::forBroker($brokerId)->find((int)$asegVal);
                } else {
                    $rowA = Aseguradora::forBroker($brokerId)->where('nombre', $asegVal)->first();
                }
                $aseguradoraId = $rowA?->id;
            }

            $ramoId = null;
            if (isset($validated['ramo_principal']) && $validated['ramo_principal'] !== null && $validated['ramo_principal'] !== '') {
                $ramoVal = $validated['ramo_principal'];
                if (is_numeric($ramoVal)) {
                    $rowR = Ramo::forBroker($brokerId)->find((int)$ramoVal);
                } else {
                    $rowR = Ramo::forBroker($brokerId)->where('nombre', $ramoVal)->first();
                }
                $ramoId = $rowR?->id;
            }
            // Resolver tipo mapeado usando el nombre real del ramo cuando llega ID numérico
            $ramoNombreParaMapeo = $rowR?->nombre ?? (string)($validated['ramo_principal'] ?? '');
            $mappedType = $this->mapTypeFromFrontend($ramoNombreParaMapeo);

            // Armar custom_fields opcionales desde la solicitud
            $customFields = null;
            $__cf = [];
            if (isset($validated['sede'])) { $__cf['sede'] = $validated['sede']; }
            if (isset($validated['forma_pago'])) { $__cf['forma_pago'] = strtolower((string)$validated['forma_pago']); }
            if (isset($validated['fecha_expedicion_dni'])) { $__cf['cliente_fecha_expedicion_dni'] = $validated['fecha_expedicion_dni']; }
            if (isset($validated['correos_secundarios'])) { $__cf['cliente_correos_secundarios'] = $validated['correos_secundarios']; }
            if (isset($validated['observaciones_cliente'])) { $__cf['cliente_observaciones'] = $validated['observaciones_cliente']; }
            if (!empty($__cf)) { $customFields = $__cf; }

            // Resolver método de pago: primero desde medio_pago; si viene forma_pago, tiene prioridad
            $paymentMethod = $this->mapPaymentMethodFromFrontend($validated['medio_pago'] ?? null);
            if (isset($validated['forma_pago'])) {
                $fp = strtolower((string)$validated['forma_pago']);
                if ($fp === 'contado') {
                    $paymentMethod = 'cash';
                } elseif ($fp === 'credito') {
                    $paymentMethod = 'card';
                } elseif ($fp === 'financiado') {
                    $paymentMethod = 'financing';
                }
            }

            $poliza = Poliza::create([
                'policy_number' => $validated['numero_poliza'],
                'description' => $validated['riesgo'] ?? null,
                // Asegurar que insured_amount nunca sea null (DB con NOT NULL)
                'insured_amount' => $validated['valor_riesgo_asegurado'] ?? 0,
                'insurance_company' => $validated['aseguradora'],
                'aseguradora_id' => $aseguradoraId,
                'type' => $mappedType,
                // DB requiere NOT NULL
                'product_name' => $validated['subramo'] ?? 'General',
                'ramo_id' => $ramoId,
                'client_name' => $cliente->first_name . (empty($cliente->last_name) ? '' : (' ' . $cliente->last_name)),
                'client_document' => $cliente->document_number,
                'premium_amount' => $validated['prima_neta'],
                'commission_percentage' => $validated['porcentaje_comision'] ?? 0,
                'commission_amount' => $validated['comision'] ?? 0,
                'payment_frequency' => $this->mapPaymentFrequencyFromFrontend($validated['periodicidad_pago'] ?? null),
                'payment_method' => $paymentMethod,
                'half_payment' => $validated['medio_pago'] ?? null,
                'bank_name' => $validated['banco'] ?? null,
                'installments_count' => $validated['cuotas'] ?? null,
                'card_last4' => isset($validated['numero_tarjeta']) && strlen($validated['numero_tarjeta']) >= 4 ? substr(preg_replace('/\D+/', '', $validated['numero_tarjeta']), -4) : null,
                'cheque_number' => $validated['cheque_number'] ?? null,
                'agreement_term' => $validated['agreement_term'] ?? null,
                'debit_account_number' => $validated['debit_account_number'] ?? null,
                'notes' => $validated['observaciones'] ?? null,
                'status_notes' => $validated['observaciones_internas'] ?? null,
                'issue_date' => $validated['fecha_expedicion'],
                'start_date' => $validated['fecha_inicio'],
                'end_date' => $validated['fecha_fin'],
                'status' => $this->mapStatusFromFrontend($validated['estado'] ?? 'ACTIVA'),
                'auto_renewal' => isset($validated['renovable']) ? (bool) $validated['renovable'] : false,
                'beneficiary_name' => $validated['beneficiario_oneroso_nombre'] ?? null,
                'beneficiary_document' => $validated['beneficiario_oneroso_documento'] ?? null,
                'beneficiary_relationship' => isset($validated['beneficiario_oneroso_nombre']) ? 'oneroso' : null,
                'documents' => $validated['documents'] ?? null,
                // Guardar placas solo si el tipo es autos
                'vehicle_plates' => (isset($validated['placas']) && $mappedType === 'autos') ? array_values(array_filter($validated['placas'])) : null,
                'broker_id' => $brokerId,
                'client_id' => $cliente->id,
                'assigned_user_id' => !empty($validated['vendedor_user_id']) ? (int)$validated['vendedor_user_id'] : ($user ? $user->id : null),
                // Guardar nombre del vendedor si fue enviado (o si se resolvió por vendedor_id)
                'seller_name' => $validated['vendedor'] ?? ($user ? ($user->name ?? null) : null),
                'seller_id' => $sellerId,
                // Segundo vendedor (opcional)
                'seller_id_2' => $sellerId2,
                'seller_name_2' => $sellerName2,
                // Nuevas columnas
                'reception_date' => $validated['fecha_recepcion'] ?? null,
                // Persistir sede en custom_fields (sin migraciones)
                'custom_fields' => isset($validated['sede']) ? ['sede' => $validated['sede']] : null,
                
                'reason' => $validated['motivo'] ?? null,
                'pri_a_pre' => $validated['pri_a_pre'] ?? null,
                'participation' => $validated['participacion'] ?? null,
                'co_brokerage' => $validated['co_corretaje'] ?? null,
                'agency_commission' => $validated['comision_agencia'] ?? null,
                'vat_percentage' => $validated['porcentaje_iva'] ?? null,
                'vat_amount' => $validated['iva'] ?? null,
                'total_amount' => $validated['total'] ?? null,
                'gastos_adicionales' => $validated['gastos_adicionales'] ?? null,
                'withholding_percentage' => $validated['porcentaje_retencion'] ?? null,
                'reteiva_percentage' => $validated['porcentaje_reteiva'] ?? null,
                // Tomador / Asegurado
                'policy_holder_name' => $validated['policy_holder_name'] ?? null,
                'policy_holder_document' => $validated['policy_holder_document'] ?? null,
                'insured_name' => $validated['insured_name'] ?? null,
                'insured_document' => $validated['insured_document'] ?? null,
                
                'beneficiary_in_remittance' => $validated['beneficiario_en_remision'] ?? false,
                // Enlace externo
                'external_link' => $validated['enlace_externo'] ?? null,
                // Custom fields: sede y metadata de cliente
                'custom_fields' => $customFields,
                
            ]);

            // Sincronizar automóviles por placas si aplica (ramo autos)
            if (!empty($validated['placas']) && $poliza->type === 'autos') {
                $this->syncAutomovilesForPoliza($poliza, $validated['placas'], $cliente->id);
            }

            // Auditoría
            $this->logPolizaAction($request, 'crear', $poliza, 201);

            \Log::info('POLIZAS: store result', [
                'poliza_id' => $poliza->id,
                'type' => $poliza->type,
                'vehicle_plates' => $poliza->vehicle_plates,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Póliza creada exitosamente',
                'data' => $this->transformPolizaToFrontend($poliza->load(['client', 'assignedUser', 'automoviles'])),
            ], 201);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de validación incorrectos',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al crear la póliza: ' . $e->getMessage(),
            ], 500);
        }
    
    }

    /**
     * Update a poliza (Development version - works with or without auth)
     */
    public function update(Request $request, $id)
    {
        try {
            // Obtener broker_id dinámicamente
            $brokerId = $this->getBrokerId($request);
            $user = Auth::user(); // Puede ser null en desarrollo

            $poliza = Poliza::where('broker_id', $brokerId)
                ->where('id', $id)
                ->first();

            if (!$poliza) {
                return response()->json([
                    'success' => false,
                    'message' => 'Póliza no encontrada',
                ], 404);
            }

            $validated = $request->validate([
                'numero_poliza' => 'sometimes|required|string|max:255',
                'riesgo' => 'nullable|string',
                'valor_riesgo_asegurado' => 'nullable|numeric',
                'aseguradora' => 'sometimes|required|string|max:255',
                'ramo_principal' => 'sometimes|required|string|max:255',
                'subramo' => 'nullable|string|max:255',
                'nombres_cliente' => 'sometimes|required|string|max:255',
                'apellidos_cliente' => 'nullable|string|max:255',
                'dni_cliente' => 'sometimes|required|string|max:50',
                'telefono_cliente' => 'nullable|string|max:20',
                'celular_cliente' => 'nullable|string|max:20',
                'domicilio' => 'nullable|string',
                'correo_cliente' => 'nullable|email|max:255',
                'correos_secundarios' => 'nullable|string|max:1000',
                'observaciones_cliente' => 'nullable|string|max:2000',
                'tipo_documento' => 'nullable|string|max:10',
                'fecha_expedicion_dni' => 'nullable|date',
                'fecha_nacimiento' => 'nullable|date',
                'prima_neta' => 'sometimes|required|numeric|min:0',
                'porcentaje_iva' => 'nullable|numeric|min:0|max:100',
                'iva' => 'nullable|numeric|min:0',
                'total' => 'nullable|numeric|min:0',
                'gastos_adicionales' => 'nullable|numeric|min:0',
                'porcentaje_comision' => 'nullable|numeric|min:0|max:100',
                'comision' => 'nullable|numeric|min:0',
                'forma_pago' => 'nullable|string|max:100',
                'periodicidad_pago' => 'nullable|string|max:100',
                'medio_pago' => 'nullable|string|max:100',
                // Datos de pago adicionales (para edición también)
                'banco' => 'nullable|string|max:255',
                'cuotas' => 'nullable|integer|min:1|required_if:medio_pago,tarjeta_credito',
                'numero_tarjeta' => ['nullable','string','max:32','regex:/^[0-9]{4,19}$/','required_if:medio_pago,tarjeta_credito'],
                'cheque_number' => 'nullable|string|max:64|required_if:medio_pago,cheque,cheque_al_dia,cheque_postfechado',
                'agreement_term' => 'nullable|string|in:contado,30_45,30_60,60_90|required_if:medio_pago,convenio',
                'debit_account_number' => 'nullable|string|max:64|required_if:medio_pago,debito',
                // Tomador / Asegurado
                'policy_holder_name' => 'nullable|string|max:255',
                'policy_holder_document' => 'nullable|string|max:100',
                'insured_name' => 'nullable|string|max:255',
                'insured_document' => 'nullable|string|max:100',
                // Placas (edición)
                'placas' => 'nullable|array',
                'placas.*' => ['nullable','string','max:20','regex:/^[A-Za-z0-9-]{3,20}$/'],
                'renovable' => 'nullable|boolean',
                'vendedor' => 'nullable|string|max:255',
                'observaciones' => 'nullable|string',
                'observaciones_internas' => 'nullable|string',
                'fecha_expedicion' => 'sometimes|required|date',
                'fecha_inicio' => 'sometimes|required|date',
                'fecha_fin' => 'sometimes|required|date',
                'estado' => 'nullable|in:ACTIVA,VENCIDA,CANCELADA,SUSPENDIDA,COTIZACION,DEVENGADA,EXPEDICION,NO_RENOVADA,PENDIENTE,COTIZACIÓN,EXPEDICIÓN,VIGENTE',
                'sede' => 'nullable|string|max:255',

                // Nuevos campos para edición coherentes con store
                'vendedor_user_id' => 'nullable|integer|exists:users,id',
                'vendedor_id' => 'nullable|integer|exists:vendedores,id',
                'vendedor_id_2' => 'nullable|integer|exists:vendedores,id',
                'fecha_recepcion' => 'nullable|date',
                'enlace_externo' => 'nullable|string|max:500',

                // Beneficiarios
                'beneficiario_en_remision' => 'nullable|boolean',
                'beneficiario_oneroso_nombre' => 'nullable|string|max:255',
                'beneficiario_oneroso_documento' => 'nullable|string|max:255',
                
                // Cliente (para cambiar el cliente asociado a la póliza)
                'cliente_id' => 'nullable|integer|exists:clientes,id',
            ]);

            \Log::info('POLIZAS: update incoming', [
                'poliza_id' => $poliza->id,
                'ramo_principal_raw' => $request->input('ramo_principal'),
                'ramo_mapped' => $request->has('ramo_principal') ? $this->mapTypeFromFrontend($request->input('ramo_principal')) : $poliza->type,
                'placas' => $request->input('placas'),
            ]);

            // Si viene cliente_id, cambiar el cliente asociado a la póliza
            if (isset($validated['cliente_id']) && $validated['cliente_id'] !== $poliza->client_id) {
                $nuevoCliente = Cliente::where('broker_id', $brokerId)->find($validated['cliente_id']);
                if ($nuevoCliente) {
                    $poliza->client_id = $nuevoCliente->id;
                    $poliza->client_name = trim(($nuevoCliente->first_name ?? '') . ' ' . ($nuevoCliente->last_name ?? '')) ?: $nuevoCliente->company_name;
                    $poliza->client_document = $nuevoCliente->document_number;
                    \Log::info('POLIZAS: Cambiando cliente de póliza', [
                        'poliza_id' => $poliza->id,
                        'cliente_anterior' => $poliza->getOriginal('client_id'),
                        'cliente_nuevo' => $nuevoCliente->id,
                    ]);
                }
            }
            // Actualizar datos del cliente existente si NO se cambió el cliente
            elseif (isset($validated['dni_cliente']) || isset($validated['nombres_cliente'])) {
                $cliente = $poliza->client;
                if ($cliente) {
                    $cliente->update([
                        'first_name' => $validated['nombres_cliente'] ?? $cliente->first_name,
                        'last_name' => $validated['apellidos_cliente'] ?? $cliente->last_name,
                        'document_number' => $validated['dni_cliente'] ?? $cliente->document_number,
                        'document_type' => !empty($validated['tipo_documento']) ? strtoupper($validated['tipo_documento']) : $cliente->document_type,
                        'birth_date' => $validated['fecha_nacimiento'] ?? $cliente->birth_date,
                        'phone' => $validated['telefono_cliente'] ?? $cliente->phone,
                        'mobile_phone' => $validated['celular_cliente'] ?? $cliente->mobile_phone,
                        'address' => $validated['domicilio'] ?? $cliente->address,
                        'email' => $validated['correo_cliente'] ?? $cliente->email,
                    ]);
                }
            }

            // Actualizar póliza
            $updateData = [];
            
            if (isset($validated['numero_poliza'])) {
                $updateData['policy_number'] = $validated['numero_poliza'];
            }
            if (isset($validated['riesgo'])) {
                $updateData['description'] = $validated['riesgo'];
            }
            if (isset($validated['valor_riesgo_asegurado'])) {
                $updateData['insured_amount'] = $validated['valor_riesgo_asegurado'];
            }
            if (isset($validated['aseguradora'])) {
                $updateData['insurance_company'] = $validated['aseguradora'];
                $asegVal = $validated['aseguradora'];
                $rowA = null;
                if ($asegVal !== null && $asegVal !== '') {
                    if (is_numeric($asegVal)) {
                        $rowA = Aseguradora::forBroker($brokerId)->find((int)$asegVal);
                    } else {
                        $rowA = Aseguradora::forBroker($brokerId)->where('nombre', $asegVal)->first();
                    }
                }
                $updateData['aseguradora_id'] = $rowA?->id;
            }
            if (isset($validated['ramo_principal'])) {
                $ramoVal = $validated['ramo_principal'];
                $rowR = null;
                if ($ramoVal !== null && $ramoVal !== '') {
                    if (is_numeric($ramoVal)) {
                        $rowR = Ramo::forBroker($brokerId)->find((int)$ramoVal);
                    } else {
                        $rowR = Ramo::forBroker($brokerId)->where('nombre', $ramoVal)->first();
                    }
                }
                // Mapear tipo usando el nombre del ramo si vino ID
                $updateData['type'] = $this->mapTypeFromFrontend($rowR?->nombre ?? $validated['ramo_principal']);
                $updateData['ramo_id'] = $rowR?->id;
            }
            if (isset($validated['subramo'])) {
                $updateData['product_name'] = $validated['subramo'];
            }
            if (isset($validated['nombres_cliente'])) {
                $updateData['client_name'] = trim($validated['nombres_cliente'] . ' ' . ($validated['apellidos_cliente'] ?? ''));
            }
            if (isset($validated['dni_cliente'])) {
                $updateData['client_document'] = $validated['dni_cliente'];
            }
            if (isset($validated['prima_neta'])) {
                $updateData['premium_amount'] = $validated['prima_neta'];
            }
            if (isset($validated['porcentaje_iva'])) {
                $updateData['vat_percentage'] = $validated['porcentaje_iva'];
            }
            if (isset($validated['iva'])) {
                $updateData['vat_amount'] = $validated['iva'];
            }
            if (isset($validated['total'])) {
                $updateData['total_amount'] = $validated['total'];
            }
            if (isset($validated['gastos_adicionales'])) {
                $updateData['gastos_adicionales'] = $validated['gastos_adicionales'];
            }
            if (isset($validated['porcentaje_comision'])) {
                $updateData['commission_percentage'] = $validated['porcentaje_comision'];
            }
            if (isset($validated['comision'])) {
                $updateData['commission_amount'] = $validated['comision'];
            }
            if (isset($validated['periodicidad_pago'])) {
                $updateData['payment_frequency'] = $this->mapPaymentFrequencyFromFrontend($validated['periodicidad_pago']);
            }
            if (isset($validated['medio_pago'])) {
                $updateData['payment_method'] = $this->mapPaymentMethodFromFrontend($validated['medio_pago']);
                $updateData['half_payment'] = $validated['medio_pago'];
            }
            // Si llega forma_pago, tomarlo como fuente de verdad y sobreescribir payment_method
            if (isset($validated['forma_pago'])) {
                $fp = strtolower((string)$validated['forma_pago']);
                if ($fp === 'contado') {
                    $updateData['payment_method'] = 'cash';
                } elseif ($fp === 'credito') {
                    $updateData['payment_method'] = 'card';
                } elseif ($fp === 'financiado') {
                    $updateData['payment_method'] = 'financing';
                }
            }
            // Datos de pago adicionales
            if (isset($validated['banco'])) {
                $updateData['bank_name'] = $validated['banco'];
            }
            if (isset($validated['cuotas'])) {
                $updateData['installments_count'] = (int)$validated['cuotas'];
            }
            if (isset($validated['numero_tarjeta'])) {
                $digits = preg_replace('/\D+/', '', (string)$validated['numero_tarjeta']);
                if ($digits && strlen($digits) >= 4) {
                    $updateData['card_last4'] = substr($digits, -4);
                }
            }
            if (isset($validated['cheque_number'])) {
                $updateData['cheque_number'] = $validated['cheque_number'];
            }
            if (isset($validated['agreement_term'])) {
                $updateData['agreement_term'] = $validated['agreement_term'];
            }
            if (isset($validated['debit_account_number'])) {
                $updateData['debit_account_number'] = $validated['debit_account_number'];
            }
            // Guardar nombre del vendedor si se envía en edición (texto directo)
            if (isset($validated['vendedor'])) {
                $updateData['seller_name'] = $validated['vendedor'];
            }
            // Si viene vendedor_id del catálogo, mapear a seller_name y seller_id
            if (isset($validated['vendedor_id'])) {
                $vend = Vendedor::forBroker($brokerId)->find((int)$validated['vendedor_id']);
                if ($vend) {
                    $updateData['seller_id'] = $vend->id;
                    $updateData['seller_name'] = $vend->nombres;
                }
            }
            // Si viene vendedor_id_2 (segundo vendedor opcional)
            if (array_key_exists('vendedor_id_2', $validated)) {
                if (!empty($validated['vendedor_id_2'])) {
                    $vend2 = Vendedor::forBroker($brokerId)->find((int)$validated['vendedor_id_2']);
                    if ($vend2) {
                        $updateData['seller_id_2'] = $vend2->id;
                        $updateData['seller_name_2'] = $vend2->nombres;
                    }
                } else {
                    // Si se envía vacío, limpiar el segundo vendedor
                    $updateData['seller_id_2'] = null;
                    $updateData['seller_name_2'] = null;
                }
            }
            // Asignación de asesor (vendedor_user_id) si viene en edición
            if (isset($validated['vendedor_user_id'])) {
                $updateData['assigned_user_id'] = (int)$validated['vendedor_user_id'];
            }
            // Tomador / Asegurado
            if (isset($validated['policy_holder_name'])) {
                $updateData['policy_holder_name'] = $validated['policy_holder_name'];
            }
            if (isset($validated['policy_holder_document'])) {
                $updateData['policy_holder_document'] = $validated['policy_holder_document'];
            }
            if (isset($validated['insured_name'])) {
                $updateData['insured_name'] = $validated['insured_name'];
            }
            if (isset($validated['insured_document'])) {
                $updateData['insured_document'] = $validated['insured_document'];
            }

            // Enlace externo
            if (array_key_exists('enlace_externo', $validated)) {
                $updateData['external_link'] = $validated['enlace_externo'];
            }
            // Beneficiarios
            if (array_key_exists('beneficiario_en_remision', $validated)) {
                $updateData['beneficiary_in_remittance'] = (bool)$validated['beneficiario_en_remision'];
            }
            $hasOneroso = (isset($validated['beneficiario_oneroso_nombre']) && $validated['beneficiario_oneroso_nombre'] !== '')
                || (isset($validated['beneficiario_oneroso_documento']) && $validated['beneficiario_oneroso_documento'] !== '');
            if ($hasOneroso) {
                $updateData['beneficiary_name'] = $validated['beneficiario_oneroso_nombre'] ?? null;
                $updateData['beneficiary_document'] = $validated['beneficiario_oneroso_documento'] ?? null;
                $updateData['beneficiary_relationship'] = 'oneroso';
            } elseif (isset($validated['beneficiario_oneroso_nombre']) || isset($validated['beneficiario_oneroso_documento'])) {
                // Si llegaron vacíos explícitamente, limpiar relación/valores
                $updateData['beneficiary_name'] = $validated['beneficiario_oneroso_nombre'] ?? null;
                $updateData['beneficiary_document'] = $validated['beneficiario_oneroso_documento'] ?? null;
                $updateData['beneficiary_relationship'] = null;
            }
            // Actualizar custom_fields (sede y metadatos del cliente)
            $__cf = is_array($poliza->custom_fields) ? $poliza->custom_fields : (json_decode($poliza->custom_fields ?? '[]', true) ?: []);
            $cfTouched = false;
            if (isset($validated['sede'])) { $__cf['sede'] = $validated['sede']; $cfTouched = true; }
            if (isset($validated['fecha_expedicion_dni'])) { $__cf['cliente_fecha_expedicion_dni'] = $validated['fecha_expedicion_dni']; $cfTouched = true; }
            if (isset($validated['correos_secundarios'])) { $__cf['cliente_correos_secundarios'] = $validated['correos_secundarios']; $cfTouched = true; }
            if (isset($validated['observaciones_cliente'])) { $__cf['cliente_observaciones'] = $validated['observaciones_cliente']; $cfTouched = true; }
            // Fallbacks en custom_fields para Tomador/Asegurado y Forma de pago, por si faltan columnas en alguna instalación
            if (isset($validated['policy_holder_name'])) { $__cf['policy_holder_name'] = $validated['policy_holder_name']; $cfTouched = true; }
            if (isset($validated['policy_holder_document'])) { $__cf['policy_holder_document'] = $validated['policy_holder_document']; $cfTouched = true; }
            if (isset($validated['insured_name'])) { $__cf['insured_name'] = $validated['insured_name']; $cfTouched = true; }
            if (isset($validated['insured_document'])) { $__cf['insured_document'] = $validated['insured_document']; $cfTouched = true; }
            if (isset($validated['forma_pago'])) { $__cf['forma_pago'] = strtolower((string)$validated['forma_pago']); $cfTouched = true; }
            if ($cfTouched) { $updateData['custom_fields'] = $__cf; }
            if (isset($validated['renovable'])) {
                $updateData['auto_renewal'] = (bool) $validated['renovable'];
            }
            if (isset($validated['observaciones'])) {
                $updateData['notes'] = $validated['observaciones'];
            }
            if (isset($validated['observaciones_internas'])) {
                $updateData['status_notes'] = $validated['observaciones_internas'];
            }
            if (isset($validated['fecha_expedicion'])) {
                $updateData['issue_date'] = $validated['fecha_expedicion'];
            }
            if (isset($validated['fecha_inicio'])) {
                $updateData['start_date'] = $validated['fecha_inicio'];
            }
            if (isset($validated['fecha_fin'])) {
                $updateData['end_date'] = $validated['fecha_fin'];
            }
            if (isset($validated['estado'])) {
                $updateData['status'] = $this->mapStatusFromFrontend($validated['estado']);
            }
            // Fecha de recepción (administrativa)
            if (isset($validated['fecha_recepcion'])) {
                $updateData['reception_date'] = $validated['fecha_recepcion'];
            }
            // Si se reciben placas en edición, sincronizar automóviles (solo si vienen no vacías)
            if (array_key_exists('placas', $validated)) {
                $incomingPlates = array_values(array_filter($validated['placas'] ?? []));
                if (count($incomingPlates) > 0) {
                    $this->syncAutomovilesForPoliza($poliza, $incomingPlates, $poliza->client_id);
                }
            }
            // Placas de vehículos: solo si el ramo es autos; no sobrescribir con [] vacíos
            if (array_key_exists('placas', $validated)) {
                $isAutosTargetType = isset($validated['ramo_principal'])
                    ? ($this->mapTypeFromFrontend(($rowR?->nombre ?? $validated['ramo_principal'])) === 'autos')
                    : ($poliza->type === 'autos');
                $incomingPlates = array_values(array_filter($validated['placas'] ?? []));
                if ($isAutosTargetType && count($incomingPlates) > 0) {
                    $updateData['vehicle_plates'] = $incomingPlates;
                }
                // Si se quisiera limpiar placas explícitamente, podríamos respetar null via una bandera específica.
            }

            $poliza->update($updateData);
            $this->logPolizaAction($request, 'actualizar', $poliza, 200, ['update_fields' => array_keys($updateData)]);

            \Log::info('POLIZAS: update result', [
                'poliza_id' => $poliza->id,
                'type' => $poliza->type,
                'vehicle_plates' => $poliza->vehicle_plates,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Póliza actualizada exitosamente',
                'data' => $this->transformPolizaToFrontend($poliza->load(['client', 'assignedUser', 'automoviles'])),
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de validación incorrectos',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar la póliza: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Crear/actualizar automóviles a partir de una póliza de autos y una lista de placas.
     */
    private function syncAutomovilesForPoliza(Poliza $poliza, array $placas, ?int $clientId = null): void
    {
        $brokerId = $poliza->broker_id;
        foreach ($placas as $raw) {
            if (!$raw) { continue; }
            $placa = strtoupper(trim((string)$raw));
            if (!preg_match('/^[A-Z0-9-]{3,20}$/', $placa)) { continue; }
            $auto = Automovil::where('broker_id', $brokerId)->where('placa', $placa)->first();
            if ($auto) {
                $auto->poliza_id = $poliza->id;
                if ($clientId) { $auto->client_id = $clientId; }
                $auto->save();
            } else {
                Automovil::create([
                    'broker_id' => $brokerId,
                    'placa' => $placa,
                    'poliza_id' => $poliza->id,
                    'client_id' => $clientId,
                ]);
            }
        }
    }

    /**
     * Reconciliar placas para pólizas existentes:
     * - Une vehicle_plates con placas de Automóviles asociados a la póliza.
     * - Opcionalmente vincula Automóviles con poliza_id = null al cliente/póliza cuando es seguro:
     *   - Si se pasa poliza_id explícito, vincula para esa póliza.
     *   - Si no se pasa poliza_id: solo vincula cuando el cliente tiene exactamente 1 póliza de autos.
     * - Actualiza vehicle_plates en la póliza con el set unificado.
     *
     * Request params:
     *   - poliza_id (opcional): int
     *   - limit (opcional): int, por defecto 1000
     */
    public function reconciliarPlacas(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $polizaId = $request->get('poliza_id');
            $limit = (int) ($request->get('limit', 1000));

            $query = Poliza::where('broker_id', $brokerId)->where('type', 'autos');
            if (!empty($polizaId)) {
                $query->where('id', (int)$polizaId);
            }

            $polizas = $query->with(['automoviles:id,placa,poliza_id,client_id'])->limit($limit)->get();

            $processed = 0;
            $updatedPolizas = 0;
            $linkedAutos = 0;

            foreach ($polizas as $poliza) {
                $processed++;

                // Placas actuales guardadas en la póliza
                $platesFromPoliza = $poliza->vehicle_plates;
                if (is_string($platesFromPoliza)) {
                    $decoded = json_decode($platesFromPoliza, true);
                    if (is_array($decoded)) { $platesFromPoliza = $decoded; }
                }
                $platesFromPoliza = is_array($platesFromPoliza) ? array_filter($platesFromPoliza) : [];

                // Placas actuales desde relación Automóviles (vinculados por poliza_id)
                $platesFromAutos = $poliza->automoviles->pluck('placa')->filter()->values()->all();

                // Merge normalizado
                $merged = array_values(array_unique(array_filter(array_map(function($p){
                    return strtoupper(trim((string)$p));
                }, array_merge($platesFromPoliza, $platesFromAutos)))));

                // Regla de vinculación segura de autos con poliza_id = null (mismo cliente)
                $autoPolizasCount = Poliza::where('broker_id', $brokerId)
                    ->where('client_id', $poliza->client_id)
                    ->where('type', 'autos')
                    ->count();
                $canLinkExtras = (!empty($polizaId)) || ($autoPolizasCount === 1);

                if ($canLinkExtras) {
                    $extras = Automovil::where('broker_id', $brokerId)
                        ->where('client_id', $poliza->client_id)
                        ->whereNull('poliza_id')
                        ->get(['id','placa']);

                    foreach ($extras as $a) {
                        $p = strtoupper(trim((string)$a->placa));
                        if (!$p) { continue; }
                        if (!in_array($p, $merged, true)) {
                            $merged[] = $p;
                        }
                        // Vincular el automóvil a esta póliza
                        $a->poliza_id = $poliza->id;
                        $a->save();
                        $linkedAutos++;
                    }
                }

                // Persistir el set unificado en la póliza (si cambió o estaba vacío)
                $shouldUpdatePoliza = false;
                $currentPlates = is_array($poliza->vehicle_plates) ? array_values($poliza->vehicle_plates) : [];
                $targetPlates = $merged;

                if ($poliza->vehicle_plates === null) {
                    $shouldUpdatePoliza = count($targetPlates) > 0;
                } else {
                    // Comparar arrays normalizados
                    $shouldUpdatePoliza = json_encode(array_values($currentPlates)) !== json_encode(array_values($targetPlates));
                }

                if ($shouldUpdatePoliza) {
                    $poliza->vehicle_plates = $targetPlates;
                    $poliza->save();
                    $updatedPolizas++;
                }

                // Asegurar existencia/vínculo de Automóviles para todas las placas resultantes
                if (count($targetPlates) > 0) {
                    $this->syncAutomovilesForPoliza($poliza, $targetPlates, $poliza->client_id);
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Reconciliación de placas ejecutada',
                'data' => [
                    'broker_id' => $brokerId,
                    'processed' => $processed,
                    'polizas_actualizadas' => $updatedPolizas,
                    'automoviles_vinculados' => $linkedAutos,
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error en reconciliación: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete a poliza (Development version - works with or without auth)
     */
    public function destroy(Request $request, $id)
    {
        try {
            // Obtener broker_id dinámicamente
            $brokerId = $this->getBrokerId($request);
            
            $poliza = Poliza::where('broker_id', $brokerId)
                ->where('id', $id)
                ->first();

            if (!$poliza) {
                return response()->json([
                    'success' => false,
                    'message' => 'Póliza no encontrada',
                ], 404);
            }

            $poliza->delete();
            $this->logPolizaAction($request, 'eliminar', $poliza, 200);

            return response()->json([
                'success' => true,
                'message' => 'Póliza eliminada exitosamente',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar la póliza: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Change poliza status (Development version - works with or without auth)
     */
    public function cambiarEstado(Request $request, $id)
    {
        try {
            // Obtener broker_id dinámicamente
            $brokerId = $this->getBrokerId($request);
            
            $poliza = Poliza::where('broker_id', $brokerId)
                ->where('id', $id)
                ->first();

            if (!$poliza) {
                return response()->json([
                    'success' => false,
                    'message' => 'Póliza no encontrada',
                ], 404);
            }

            $validated = $request->validate([
                'estado' => 'required|in:ACTIVA,VENCIDA,CANCELADA,SUSPENDIDA,COTIZACION,DEVENGADA,EXPEDICION,NO_RENOVADA,PENDIENTE,COTIZACIÓN,EXPEDICIÓN,VIGENTE',
                'motivo' => 'nullable|string|max:500'
            ]);

            $estadoAnterior = $this->mapStatusToFrontend($poliza->status);
            $nuevoEstado = $this->mapStatusFromFrontend($validated['estado']);

            $poliza->update([
                'status' => $nuevoEstado,
                'status_notes' => $validated['motivo'] ?? null
            ]);

            $this->logPolizaAction($request, 'cambiar_estado', $poliza, 200, [
                'estado_anterior' => $estadoAnterior,
                'estado_nuevo' => $validated['estado'],
            ]);
            \Log::info("Cambio de estado de póliza {$poliza->policy_number}: {$estadoAnterior} -> {$validated['estado']}", [
                'poliza_id' => $poliza->id,
                'broker_id' => $brokerId,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Estado de póliza actualizado exitosamente',
                'data' => $this->transformPolizaToFrontend($poliza),
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de validación incorrectos',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al cambiar el estado de la póliza: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Map database status to frontend status
     */
    private function mapStatusToFrontend($status)
    {
        // Mapear todos los estados soportados por BD al conjunto español mostrado en frontend
        $mapping = [
            'active' => 'ACTIVA',
            'expired' => 'VENCIDA',
            'cancelled' => 'CANCELADA',
            'suspended' => 'SUSPENDIDA',
            'pending' => 'PENDIENTE',
            'quoted' => 'COTIZACION',
            'accrued' => 'DEVENGADA',
            'issued' => 'EXPEDICION',
            'not_renewed' => 'NO_RENOVADA',
            'renewed' => 'ACTIVA'
        ];

        return $mapping[$status] ?? 'PENDIENTE';
    }

// ...

    /**
     * Map frontend status to database status
     */
    private function mapStatusFromFrontend($status)
    {
        // Normalizar a mayúsculas y sin acentos
        $key = strtoupper(trim((string)$status));
        $key = strtr($key, [
            'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ñ' => 'N'
        ]);

        // Mapear estados del frontend a valores específicos del enum en BD
        $mapping = [
            'ACTIVA' => 'active',
            'SUSPENDIDA' => 'suspended',
            'VENCIDA' => 'expired',
            'CANCELADA' => 'cancelled',
            'PENDIENTE' => 'pending',
            'COTIZACION' => 'quoted',
            'DEVENGADA' => 'accrued',
            'EXPEDICION' => 'issued',
            'NO_RENOVADA' => 'not_renewed',
            'VIGENTE' => 'active',
            'COTIZACIÓN' => 'quoted',
            'EXPEDICIÓN' => 'issued'
        ];

        // Log para debug del mapeo de estados
        \Log::info('🔄 [DEBUG] Mapeo de estado', [
            'estado_original' => $status,
            'estado_normalizado' => $key,
            'estado_mapeado' => $mapping[$key] ?? 'active'
        ]);

        return $mapping[$key] ?? 'active'; // Cambiar fallback de 'pending' a 'active'
    }

    /**
     * Map frontend type to database type
     */
    private function mapTypeFromFrontend($type)
    {
        // Normalizar: minúsculas, remover acentos, espacios y símbolos → guion bajo
        $key = strtolower((string) $type);
        // Remover acentos (fallback seguro si iconv no está disponible)
        if (function_exists('iconv')) {
            $trans = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $key);
            if ($trans !== false) {
                $key = $trans;
            }
        }
        $key = preg_replace('/[^a-z0-9]+/i', '_', $key);
        $key = trim($key, '_');

        // Fallback amplio: cualquier cosa que contenga "auto" la tratamos como autos
        if (strpos($key, 'auto') !== false) {
            return 'autos';
        }

        // Mapeos explícitos
        $mapping = [
            'automovil' => 'autos',
            'automoviles' => 'autos',
            'automotores' => 'autos',
            'vehiculo' => 'autos',
            'vehiculos' => 'autos',
            'autos' => 'autos',
            'soat' => 'autos',
            'vida' => 'vida',
            'hogar' => 'hogar',
            'empresarial' => 'empresarial',
            'salud' => 'salud',
            'accidentes' => 'accidentes',
            'responsabilidad_civil' => 'responsabilidad_civil',
            'otros' => 'otros',
        ];

        return $mapping[$key] ?? 'otros';
    }

    /**
     * Map frontend payment frequency to database enum
     */
    private function mapPaymentFrequencyFromFrontend($frequency)
    {
        $mapping = [
            'mensual' => 'monthly',
            'monthly' => 'monthly',
            'trimestral' => 'quarterly',
            'quarterly' => 'quarterly',
            'semestral' => 'biannual',
            'biannual' => 'biannual',
            'anual' => 'annual',
            'annual' => 'annual'
        ];

        return $mapping[strtolower($frequency ?? '')] ?? 'annual';
    }

    /**
     * Map frontend payment method to database enum
     */
    private function mapPaymentMethodFromFrontend($method)
    {
        $mapping = [
            'efectivo' => 'cash',
            'cash' => 'cash',
            'transferencia' => 'transfer',
            'consignacion' => 'transfer',
            'pse' => 'transfer',
            'transferencia_bancaria' => 'transfer',
            'transfer' => 'transfer',
            'cheque' => 'check',
            'cheque_al_dia' => 'check',
            'check' => 'check',
            'tarjeta' => 'card',
            'tarjeta_credito' => 'card',
            'card' => 'card',
            'financiacion' => 'financing',
            'convenio' => 'financing',
            'financing' => 'financing'
        ];

        $key = strtolower($method ?? '');
        if (!array_key_exists($key, $mapping)) {
            // Mapear 'debito' a transferencia por compatibilidad con enum
            if ($key === 'debito' || $key === 'debito_automatico') {
                return 'transfer';
            }
        }
        return $mapping[$key] ?? null;
    }

    /**
     * Map database type to frontend format
     */
    private function mapTypeToFrontend($type)
    {
        $mapping = [
            'autos' => 'automovil',
            'vida' => 'vida',
            'hogar' => 'hogar', 
            'empresarial' => 'empresarial',
            'salud' => 'salud',
            'accidentes' => 'accidentes',
            'responsabilidad_civil' => 'responsabilidad_civil',
            'otros' => 'otros'
        ];

        return $mapping[$type] ?? 'otros';
    }

    /**
     * Get active polizas for siniestros form
     */
    public function getPolizasActivasParaSiniestros(Request $request)
    {
        try {
            // Obtener broker_id dinámicamente
            $brokerId = $this->getBrokerId($request);
            
            // Consultar solo pólizas activas
            $polizas = Poliza::where('broker_id', $brokerId)
                ->where('status', 'active')
                ->with(['client'])
                ->select([
                    'id',
                    'policy_number',
                    'client_name',
                    'client_document', 
                    'client_id',
                    'insurance_company',
                    'type',
                    'product_name',
                    'start_date',
                    'end_date',
                    'premium_amount',
                    'insured_amount'
                ])
                ->orderBy('policy_number', 'asc')
                ->get();
            
            // Transformar datos para el frontend
            $polizasTransformadas = $polizas->map(function ($poliza) {
                return [
                    'id' => $poliza->id,
                    'numero_poliza' => $poliza->policy_number,
                    'cliente' => $poliza->client_name,
                    'documento_cliente' => $poliza->client_document,
                    'aseguradora' => $poliza->insurance_company,
                    'tipo_seguro' => $this->mapTypeToFrontend($poliza->type),
                    'producto' => $poliza->product_name,
                    'fecha_inicio' => $poliza->start_date->format('Y-m-d'),
                    'fecha_fin' => $poliza->end_date->format('Y-m-d'),
                    'valor_asegurado' => $poliza->insured_amount,
                    'prima' => $poliza->premium_amount,
                    'client_id' => $poliza->client_id,
                    'display_text' => $poliza->policy_number . ' - ' . $poliza->client_name . ' (' . $poliza->insurance_company . ')'
                ];
            });
            
            return response()->json([
                'success' => true,
                'message' => 'Pólizas activas obtenidas exitosamente',
                'data' => $polizasTransformadas
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener pólizas activas: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Map database payment frequency to frontend format
     */
    private function mapPaymentFrequencyToFrontend($frequency)
    {
        $mapping = [
            'monthly' => 'Mensual',
            'quarterly' => 'Trimestral', 
            'biannual' => 'Semestral',
            'annual' => 'Anual'
        ];

        return $mapping[$frequency] ?? 'Anual';
    }

    /**
     * Map database payment method to frontend format
     */
    private function mapPaymentMethodToFrontend($method)
    {
        $mapping = [
            'cash' => 'Efectivo',
            'transfer' => 'Transferencia bancaria',
            'check' => 'Cheque',
            'card' => 'Tarjeta',
            'financing' => 'Financiación'
        ];

        return $mapping[$method] ?? null;
    }

    /**
     * Map database payment method to UI code used by frontend selects
     * Outputs: tarjeta_credito | transferencia | cheque | convenio | efectivo
     */
    private function mapPaymentMethodToCode($method)
    {
        $mapping = [
            'cash' => 'efectivo',
            'transfer' => 'transferencia',
            'check' => 'cheque',
            'card' => 'tarjeta_credito',
            'financing' => 'convenio',
        ];
        return $mapping[strtolower((string)$method)] ?? null;
    }

    /**
     * Map database payment method to forma_pago code (contado/credito/financiado)
     */
    private function mapPaymentMethodToFormaPagoCode($method)
    {
        $m = strtolower((string)$method);
        if ($m === 'cash') return 'contado';
        if ($m === 'card') return 'credito';
        if ($m === 'financing') return 'financiado';
        return '';
    }

    /**
     * Map database payment status to frontend payment status
     */
    private function mapPaymentStatusToFrontend($status)
    {
        $s = strtolower((string)$status);
        switch ($s) {
            case 'paid':
            case 'completed':
                return 'Al día';
            case 'pending':
                return 'Pendiente';
            case 'overdue':
                return 'Vencido';
            case 'partial':
                return 'Parcial';
            default:
                return 'Al día';
        }
    }

    /**
     * Determinar estado de pago basado en montos
     */
    private function determinarEstadoPago(float $recaudado, float $total): string
    {
        if ($recaudado == 0) {
            return 'Pendiente';
        } elseif ($recaudado >= $total) {
            return 'Al día';
        } elseif ($recaudado > 0) {
            return 'Parcial';
        } else {
            return 'Pendiente';
        }
    }

    /**
     * Map database payment frequency to UI code used by frontend selects
     * Outputs: mensual | trimestral | semestral | anual
     */
    private function mapPaymentFrequencyToCode($frequency)
    {
        $mapping = [
            'monthly' => 'mensual',
            'quarterly' => 'trimestral',
            'biannual' => 'semestral',
            'annual' => 'anual',
        ];
        return $mapping[strtolower((string)$frequency)] ?? 'anual';
    }

    /**
     * Registrar contacto para una renovación
     */
    public function registrarContactoRenovacion(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            // Buscar la póliza
            $poliza = Poliza::where('broker_id', $brokerId)
                ->where('id', $id)
                ->first();

            if (!$poliza) {
                return response()->json([
                    'success' => false,
                    'message' => 'Renovación no encontrada'
                ], 404);
            }

            // Validar que la póliza no esté ya renovada
            if ($poliza->status === 'renewed') {
                return response()->json([
                    'success' => false,
                    'message' => 'Esta póliza ya ha sido renovada y no puede procesarse nuevamente.'
                ], 422);
            }

            // Validar que la póliza esté activa
            if ($poliza->status !== 'active') {
                return response()->json([
                    'success' => false,
                    'message' => 'Solo se pueden renovar pólizas activas.'
                ], 422);
            }

            // Validar antigüedad de la póliza (mínimo 30 días de vigencia)
            $diasRestantes = Carbon::now()->diffInDays(Carbon::parse($poliza->end_date), false);
            if ($diasRestantes < 30) {
                return response()->json([
                    'success' => false,
                    'message' => 'La póliza debe tener al menos 30 días de vigencia restante para poder renovarse.'
                ], 422);
            }

            $validated = $request->validate([
                'tipo' => 'required|in:llamada,email,whatsapp,presencial,sms',
                'resultado' => 'required|in:exitoso,no_disponible,no_contesta,rebotado,solicita_info,no_interesado',
                'observaciones' => 'required|string|max:1000',
                'proximoContacto' => 'nullable|date_format:Y-m-d\TH:i'
            ]);

            // Crear registro de contacto (podrías crear una tabla específica para esto)
            // Por ahora, actualizamos las notas de la póliza
            $contactInfo = [
                'fecha' => now()->toDateTimeString(),
                'tipo' => $validated['tipo'],
                'resultado' => $validated['resultado'],
                'observaciones' => $validated['observaciones'],
                'proximo_contacto' => $validated['proximoContacto'] ?? null
            ];

            // Actualizar notas de la póliza con el registro de contacto
            $notasActuales = $poliza->notes ? json_decode($poliza->notes, true) : [];
            if (!is_array($notasActuales)) {
                $notasActuales = ['nota_original' => $poliza->notes];
            }

            $notasActuales['contactos_renovacion'] = $notasActuales['contactos_renovacion'] ?? [];
            $notasActuales['contactos_renovacion'][] = $contactInfo;

            $poliza->update([
                'notes' => json_encode($notasActuales),
                'updated_at' => now()
            ]);

            // Guardar en renewal_history
            $mapTipo = [
                'llamada' => 'phone_call',
                'email' => 'email',
                'whatsapp' => 'whatsapp',
                'presencial' => 'in_person',
                'sms' => 'sms',
            ];
            $mapResultado = [
                'exitoso' => 'successful',
                'no_contesta' => 'no_answer',
                'no_disponible' => 'unreachable',
                'rebotado' => 'unreachable',
                'solicita_info' => 'needs_info',
                'no_interesado' => 'not_interested',
            ];

            if (Schema::hasTable('renewal_history')) {
                try {
                    RenewalHistory::create([
                        'poliza_id' => $poliza->id,
                        'broker_id' => $brokerId,
                        'user_id' => Auth::id(),
                        'action_type' => 'contact',
                        'contact_type' => $mapTipo[$validated['tipo']] ?? null,
                        'contact_result' => $mapResultado[$validated['resultado']] ?? null,
                        'title' => 'Contacto de renovación',
                        'description' => $validated['observaciones'],
                        'metadata' => $contactInfo,
                        'next_contact_date' => $validated['proximoContacto'] ?? null,
                        'priority' => 'medium',
                        'status' => 'active',
                    ]);
                } catch (\Throwable $e) {
                    \Log::warning('No se pudo guardar en renewal_history', ['error' => $e->getMessage()]);
                }
            }

            // Log del contacto registrado con sanitización
            $observacionesSanitizadas = strip_tags($validated['observaciones']);
            \Log::info("Contacto de renovación registrado para póliza {$poliza->policy_number}", [
                'poliza_id' => $poliza->id,
                'broker_id' => $brokerId,
                'tipo_contacto' => $validated['tipo'],
                'resultado' => $validated['resultado'],
                'proximo_contacto' => $validated['proximoContacto'] ?? null
            ]);

            // Registrar auditoría
            $this->logPolizaAction($request, 'contacto_renovacion', $poliza, 200, [
                'tipo_contacto' => $validated['tipo'],
                'resultado' => $validated['resultado'],
                'proximo_contacto' => $validated['proximoContacto'] ?? null
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Contacto registrado exitosamente',
                'data' => [
                    'contacto_registrado' => $contactInfo,
                    'poliza_id' => $poliza->id,
                    'numero_poliza' => $poliza->policy_number
                ]
            ]);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de validación incorrectos',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al registrar contacto: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Procesar renovación - crea una nueva póliza y actualiza la actual
     */
    public function procesarRenovacion(Request $request, $id)
    {
        try {
            // Obtener broker_id dinámicamente
            $brokerId = $this->getBrokerId($request);
            $user = Auth::user(); // Puede ser null en desarrollo

            // Verificar que la póliza existe y pertenece al broker
            $polizaOriginal = Poliza::where('broker_id', $brokerId)
                ->where('id', $id)
                ->with(['client'])
                ->first();

            if (!$polizaOriginal) {
                return response()->json([
                    'success' => false,
                    'message' => 'Renovación no encontrada'
                ], 404);
            }

            $validated = $request->validate([
                'nuevaFechaVencimiento' => 'required|date|after:today|before:' . Carbon::now()->addYears(2)->format('Y-m-d'),
                'nuevoValorPrima' => 'required|numeric|min:0',
                'observaciones' => 'nullable|string|max:1000',
                'nuevoNumeroPoliza' => 'nullable|string|max:255|regex:/^[A-Z]{3}-\d{4}-\d{4}$/',
            ]);

            // Validaciones de negocio adicionales
            $fechaVencimientoActual = Carbon::parse($polizaOriginal->end_date);
            $nuevaFechaVencimiento = Carbon::parse($validated['nuevaFechaVencimiento']);

            // Validar que la nueva fecha sea posterior a la fecha de vencimiento actual
            // (permitir renovaciones anticipadas, la nueva fecha debe ser al menos 1 mes después del vencimiento actual)
            if ($nuevaFechaVencimiento->lte($fechaVencimientoActual)) {
                return response()->json([
                    'success' => false,
                    'message' => 'La nueva fecha de vencimiento debe ser posterior a la fecha de vencimiento actual de la póliza (' . $fechaVencimientoActual->format('Y-m-d') . ').',
                ], 422);
            }

            // Validación de cambio de prima removida - permitir cualquier cambio

            DB::beginTransaction();

            try {
                // 1. Marcar la póliza original como renovada
                $polizaOriginal->update([
                    'status' => 'renewed',
                    'status_notes' => 'Póliza renovada el ' . now()->toDateString(),
                    'updated_at' => now()
                ]);

                // 2. Crear nueva póliza renovada
                $nuevaFechaInicio = Carbon::parse($validated['nuevaFechaVencimiento'])->subYear();

                $nuevaPoliza = Poliza::create([
                    // Información básica copiada de la original
                    'policy_number' => !empty($validated['nuevoNumeroPoliza'])
                        ? $validated['nuevoNumeroPoliza']
                        : $this->generateNewPolicyNumber($polizaOriginal->policy_number),
                    'description' => $polizaOriginal->description,
                    'insured_amount' => $polizaOriginal->insured_amount,
                    'insurance_company' => $polizaOriginal->insurance_company,
                    'type' => $polizaOriginal->type,
                    'product_name' => $polizaOriginal->product_name,

                    // Información del cliente (igual)
                    'client_name' => $polizaOriginal->client_name,
                    'client_document' => $polizaOriginal->client_document,
                    'client_id' => $polizaOriginal->client_id,

                    // Información financiera actualizada
                    'premium_amount' => $validated['nuevoValorPrima'],
                    'commission_percentage' => $polizaOriginal->commission_percentage,
                    'commission_amount' => ($validated['nuevoValorPrima'] * $polizaOriginal->commission_percentage) / 100,

                    // Fechas actualizadas
                    'issue_date' => now()->toDateString(),
                    'start_date' => $nuevaFechaInicio->toDateString(),
                    'end_date' => $validated['nuevaFechaVencimiento'],

                    // Otros campos
                    'status' => 'active',
                    'payment_frequency' => $polizaOriginal->payment_frequency,
                    'payment_method' => $polizaOriginal->payment_method,
                    'notes' => json_encode([
                        'renovacion_de' => $polizaOriginal->id,
                        'numero_poliza_anterior' => $polizaOriginal->policy_number,
                        'observaciones_renovacion' => $validated['observaciones'] ?? 'Renovación procesada automáticamente',
                        'fecha_procesamiento' => now()->toDateTimeString()
                    ]),

                    // Relaciones
                    'broker_id' => $brokerId,
                    'assigned_user_id' => $user ? $user->id : $polizaOriginal->assigned_user_id,
                    
                    // Copiar ramo_id, aseguradora_id y auto_renewal de la póliza original
                    'ramo_id' => $polizaOriginal->ramo_id,
                    'aseguradora_id' => $polizaOriginal->aseguradora_id,
                    'auto_renewal' => $polizaOriginal->auto_renewal,
                ]);

                // 3. Actualizar estadísticas del cliente si existe
                if ($polizaOriginal->client) {
                    $polizaOriginal->client->updatePolicyCounters();
                }

                DB::commit();

                // Log de la renovación procesada con sanitización
                $observacionesSanitizadas = strip_tags($validated['observaciones'] ?? '');
                \Log::info("Renovación procesada para póliza {$polizaOriginal->policy_number}", [
                    'poliza_original_id' => $polizaOriginal->id,
                    'nueva_poliza_id' => $nuevaPoliza->id,
                    'nuevo_numero_poliza' => $nuevaPoliza->policy_number,
                    'nuevo_valor_prima' => $validated['nuevoValorPrima'],
                    'nueva_fecha_vencimiento' => $validated['nuevaFechaVencimiento'],
                    'cambio_prima_porcentaje' => $polizaOriginal->premium_amount > 0 ?
                        round((($validated['nuevoValorPrima'] - $polizaOriginal->premium_amount) / $polizaOriginal->premium_amount) * 100, 2) : 0,
                    'broker_id' => $brokerId,
                    'user_id' => $user ? $user->id : null
                ]);

                // Registrar auditoría de la renovación
                $this->logPolizaAction($request, 'procesar_renovacion', $polizaOriginal, 200, [
                    'nueva_poliza_id' => $nuevaPoliza->id,
                    'nuevo_numero_poliza' => $nuevaPoliza->policy_number,
                    'nuevo_valor_prima' => $validated['nuevoValorPrima'],
                    'nueva_fecha_vencimiento' => $validated['nuevaFechaVencimiento'],
                    'observaciones' => $observacionesSanitizadas
                ]);

                // Guardar evento en renewal_history
                if (Schema::hasTable('renewal_history')) {
                    try {
                        RenewalHistory::create([
                            'poliza_id' => $polizaOriginal->id,
                            'broker_id' => $brokerId,
                            'user_id' => Auth::id(),
                            'action_type' => 'renewal_processed',
                            'title' => 'Renovación procesada',
                            'description' => $validated['observaciones'] ?? 'Renovación procesada automáticamente',
                            'metadata' => [
                                'nueva_poliza_id' => $nuevaPoliza->id,
                                'nuevo_numero_poliza' => $nuevaPoliza->policy_number,
                                'numero_poliza_anterior' => $polizaOriginal->policy_number,
                                'nuevo_valor_prima' => $validated['nuevoValorPrima'],
                                'nueva_fecha_vencimiento' => $validated['nuevaFechaVencimiento'],
                            ],
                            'status' => 'completed',
                        ]);
                    } catch (\Throwable $e) {
                        \Log::warning('No se pudo guardar evento de renovación en renewal_history', ['error' => $e->getMessage()]);
                    }
                }

                return response()->json([
                    'success' => true,
                    'message' => 'Renovación procesada exitosamente',
                    'data' => [
                        'poliza_original' => [
                            'id' => $polizaOriginal->id,
                            'numero_poliza' => $polizaOriginal->policy_number,
                            'nuevo_estado' => 'renovada'
                        ],
                        'nueva_poliza' => [
                            'id' => $nuevaPoliza->id,
                            'numero_poliza' => $nuevaPoliza->policy_number,
                            'valor_prima' => $nuevaPoliza->premium_amount,
                            'fecha_inicio' => $nuevaPoliza->start_date,
                            'fecha_vencimiento' => $nuevaPoliza->end_date,
                            'estado' => 'activa'
                        ]
                    ]
                ]);
                
            } catch (\Exception $e) {
                DB::rollback();
                throw $e;
            }
            
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de validación incorrectos',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al procesar renovación: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Exportar pólizas en formato Excel/CSV con filtros
     */
    public function exportar(Request $request)
    {
        try {
            \Log::info('EXPORTAR: Iniciando exportación', [
                'request_all' => $request->all(),
                'headers' => $request->headers->all()
            ]);

            // Obtener broker_id dinámicamente (para debug sin auth)
            $brokerId = $request->header('X-Dev-Broker-Id') ?: $this->getBrokerId($request);

            \Log::info('EXPORTAR: Broker ID obtenido', ['broker_id' => $brokerId]);

            // Determinar formato (excel por defecto, csv alternativo)
            $formato = $request->get('formato', 'excel');

            // OPTIMIZACIÓN: Construir la query base con aislamiento multi-tenant
            $query = Poliza::where('broker_id', $brokerId)
                ->with(['client', 'assignedUser', 'createdBy']);

            // OPTIMIZACIÓN: Aplicar filtros con índices optimizados (igual que indexDev)
            if ($request->has('search') && !empty($request->search)) {
                $search = $request->search;
                $query->where(function($q) use ($search) {
                    $q->where('policy_number', 'like', "%{$search}%")
                      ->orWhere('client_name', 'like', "%{$search}%")
                      ->orWhere('client_document', 'like', "%{$search}%")
                      ->orWhere('insurance_company', 'like', "%{$search}%");
                });
            }

            if ($request->has('aseguradora') && !empty($request->aseguradora)) {
                $query->where('insurance_company', $request->aseguradora);
            }

            if ($request->filled('aseguradora_id')) {
                $query->where('aseguradora_id', $request->aseguradora_id);
            }

            if ($request->has('ramo') && !empty($request->ramo)) {
                $query->where('type', $this->mapTypeFromFrontend($request->ramo));
            }

            if ($request->filled('ramo_id')) {
                $query->where('ramo_id', $request->ramo_id);
            }

            if ($request->has('estado') && !empty($request->estado)) {
                $estadoFilter = strtoupper(trim((string)$request->estado));
                if ($estadoFilter === 'POR_VENCER') {
                    $today = Carbon::now()->toDateString();
                    $query->where('status', 'active')
                          ->whereRaw('DATEDIFF(end_date, ?) >= 0 AND DATEDIFF(end_date, ?) <= 30', [$today, $today]);
                } else {
                    $query->where('status', $this->mapStatusFromFrontend($request->estado));
                }
            }

            if ($request->has('client_id') && !empty($request->client_id)) {
                $query->where('client_id', $request->client_id);
            }

            if ($request->has('vendedor') && !empty($request->vendedor)) {
                $vendedor = $request->vendedor;
                $query->where(function($q) use ($vendedor) {
                    // Buscar en seller_name (campo directo)
                    $q->where('seller_name', 'like', "%{$vendedor}%")
                      // O buscar en assignedUser.name (relación)
                      ->orWhereHas('assignedUser', function($qu) use ($vendedor) {
                          $qu->where('name', 'like', "%{$vendedor}%");
                      });
                });
            }

            if ($request->has('renovable') && $request->renovable !== null && $request->renovable !== '') {
                $renovable = filter_var($request->renovable, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                if ($renovable !== null) {
                    $query->where('auto_renewal', $renovable);
                }
            }

            if ($request->has('fecha_recepcion_desde') && !empty($request->fecha_recepcion_desde)) {
                $query->where('reception_date', '>=', $request->fecha_recepcion_desde);
            }

            if ($request->has('fecha_recepcion_hasta') && !empty($request->fecha_recepcion_hasta)) {
                $query->where('reception_date', '<=', $request->fecha_recepcion_hasta);
            }

            if ($request->has('fecha_inicio') && !empty($request->fecha_inicio)) {
                $query->where('start_date', '>=', $request->fecha_inicio);
            }

            if ($request->has('fecha_fin') && !empty($request->fecha_fin)) {
                $query->where('end_date', '<=', $request->fecha_fin);
            }

            // Obtener columnas a exportar (si no se especifica, exportar todas)
            $columnasParam = $request->get('columnas', '');
            $columnas = !empty($columnasParam) ? explode(',', $columnasParam) : [];

            // Obtener todas las pólizas sin paginación
            \Log::info('EXPORTAR: Ejecutando query', ['broker_id' => $brokerId, 'columnas' => $columnas]);
            $polizas = $query->get();
            \Log::info('EXPORTAR: Query ejecutada', ['count' => $polizas->count()]);

            if ($formato === 'csv') {
                \Log::info('EXPORTAR: Exportando CSV');
                return $this->exportarCSV($polizas, $columnas);
            } else {
                \Log::info('EXPORTAR: Exportando Excel');
                return $this->exportarExcel($polizas, $columnas);
            }

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al exportar pólizas: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Definición de todas las columnas disponibles para exportar
     */
    private function getExportColumns()
    {
        return [
            'numero_poliza' => ['header' => 'Número Póliza', 'getter' => fn($p) => $p->policy_number],
            'cliente' => ['header' => 'Cliente', 'getter' => fn($p) => $p->client_name],
            'documento_cliente' => ['header' => 'Documento Cliente', 'getter' => fn($p) => $p->client_document],
            'aseguradora' => ['header' => 'Aseguradora', 'getter' => fn($p) => $p->insurance_company],
            'ramo' => ['header' => 'Ramo', 'getter' => fn($p) => $this->mapTypeToFrontend($p->type)],
            'estado' => ['header' => 'Estado', 'getter' => fn($p) => $this->mapStatusToFrontend($p->status)],
            'prima_neta' => ['header' => 'Prima Neta', 'getter' => fn($p) => $p->premium_amount, 'format' => 'number'],
            'iva' => ['header' => 'IVA', 'getter' => fn($p) => $p->vat_amount ?? 0, 'format' => 'number'],
            'total' => ['header' => 'Total', 'getter' => fn($p) => $p->total_amount ?? 0, 'format' => 'number'],
            'fecha_inicio' => ['header' => 'Fecha Inicio', 'getter' => fn($p) => $p->start_date ? $p->start_date->format('Y-m-d') : ''],
            'fecha_fin' => ['header' => 'Fecha Fin', 'getter' => fn($p) => $p->end_date ? $p->end_date->format('Y-m-d') : ''],
            'fecha_expedicion' => ['header' => 'Fecha Expedición', 'getter' => fn($p) => $p->issue_date ? $p->issue_date->format('Y-m-d') : ''],
            'fecha_recepcion' => ['header' => 'Fecha Recepción', 'getter' => fn($p) => $p->reception_date ? $p->reception_date->format('Y-m-d') : ''],
            'comision' => ['header' => 'Comisión', 'getter' => fn($p) => $p->commission_amount ?? 0, 'format' => 'number'],
            'porcentaje_comision' => ['header' => '% Comisión', 'getter' => fn($p) => $p->commission_percentage ?? 0],
            'estado_pago' => ['header' => 'Estado Pago', 'getter' => fn($p) => $this->mapStatusToFrontend($p->payment_status ?? 'pending')],
            'vendedor' => ['header' => 'Vendedor', 'getter' => fn($p) => $p->seller_name ?: ($p->assignedUser ? $p->assignedUser->name : 'Sin asignar')],
            'forma_pago' => ['header' => 'Forma de Pago', 'getter' => fn($p) => $p->payment_method ?? ''],
            'periodicidad' => ['header' => 'Periodicidad', 'getter' => fn($p) => $p->payment_frequency ?? ''],
            'valor_asegurado' => ['header' => 'Valor Asegurado', 'getter' => fn($p) => $p->insured_amount ?? 0, 'format' => 'number'],
            'observaciones' => ['header' => 'Observaciones', 'getter' => fn($p) => $p->notes ? strip_tags($p->notes) : ''],
            'telefono_cliente' => ['header' => 'Teléfono Cliente', 'getter' => fn($p) => $p->client?->phone ?? $p->client?->mobile_phone ?? ''],
            'email_cliente' => ['header' => 'Email Cliente', 'getter' => fn($p) => $p->client?->email ?? ''],
        ];
    }

    /**
     * Exportar pólizas a formato CSV
     */
    private function exportarCSV($polizas, $columnasSeleccionadas = [])
    {
        $allColumns = $this->getExportColumns();
        
        // Si no se especifican columnas, usar las predeterminadas
        $defaultColumns = ['numero_poliza', 'cliente', 'documento_cliente', 'aseguradora', 'ramo', 'estado', 'prima_neta', 'fecha_inicio', 'fecha_fin', 'fecha_expedicion', 'fecha_recepcion', 'comision', 'estado_pago', 'vendedor', 'observaciones'];
        $columnas = !empty($columnasSeleccionadas) ? $columnasSeleccionadas : $defaultColumns;
        
        // Filtrar solo columnas válidas
        $columnas = array_filter($columnas, fn($c) => isset($allColumns[$c]));
        
        // Generar CSV
        $csvData = [];
        
        // Headers
        $headers = [];
        foreach ($columnas as $col) {
            $headers[] = $allColumns[$col]['header'];
        }
        $csvData[] = $headers;

        // Datos
        foreach ($polizas as $poliza) {
            $row = [];
            foreach ($columnas as $col) {
                $value = $allColumns[$col]['getter']($poliza);
                if (isset($allColumns[$col]['format']) && $allColumns[$col]['format'] === 'number') {
                    $row[] = number_format((float)$value, 2, ',', '');
                } else {
                    $row[] = $value;
                }
            }
            $csvData[] = $row;
        }

        // Convertir a CSV
        $output = fopen('php://temp', 'r+');
        foreach ($csvData as $row) {
            fputcsv($output, $row, ';');
        }
        rewind($output);
        $csvContent = stream_get_contents($output);
        fclose($output);

        // Agregar BOM para UTF-8
        $csvContent = "\xEF\xBB\xBF" . $csvContent;

        return response($csvContent, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="polizas_' . date('Y-m-d_H-i-s') . '.csv"',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0'
        ]);
    }

    /**
     * Exportar pólizas a formato Excel
     */
    private function exportarExcel($polizas, $columnasSeleccionadas = [])
    {
        // Verificar si tenemos la librería PHPExcel/PhpSpreadsheet
        if (!class_exists('\PhpOffice\PhpSpreadsheet\Spreadsheet')) {
            // Fallback a CSV si no hay Excel
            return $this->exportarCSV($polizas, $columnasSeleccionadas);
        }

        $allColumns = $this->getExportColumns();
        
        // Si no se especifican columnas, usar las predeterminadas
        $defaultColumns = ['numero_poliza', 'cliente', 'documento_cliente', 'aseguradora', 'ramo', 'estado', 'prima_neta', 'fecha_inicio', 'fecha_fin', 'fecha_expedicion', 'fecha_recepcion', 'comision', 'estado_pago', 'vendedor', 'observaciones'];
        $columnas = !empty($columnasSeleccionadas) ? $columnasSeleccionadas : $defaultColumns;
        
        // Filtrar solo columnas válidas
        $columnas = array_values(array_filter($columnas, fn($c) => isset($allColumns[$c])));

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();

        // Headers dinámicos
        $colIndex = 1;
        $numberColumns = []; // Para guardar qué columnas son numéricas
        foreach ($columnas as $col) {
            $cellRef = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($colIndex) . '1';
            $sheet->setCellValue($cellRef, $allColumns[$col]['header']);
            $sheet->getStyle($cellRef)->getFont()->setBold(true);
            
            if (isset($allColumns[$col]['format']) && $allColumns[$col]['format'] === 'number') {
                $numberColumns[$colIndex] = true;
            }
            $colIndex++;
        }

        // Datos
        $row = 2;
        foreach ($polizas as $poliza) {
            $colIndex = 1;
            foreach ($columnas as $col) {
                $cellRef = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($colIndex) . $row;
                $value = $allColumns[$col]['getter']($poliza);
                $sheet->setCellValue($cellRef, $value);
                
                // Formato de números
                if (isset($numberColumns[$colIndex])) {
                    $sheet->getStyle($cellRef)->getNumberFormat()->setFormatCode('#,##0');
                }
                $colIndex++;
            }
            $row++;
        }

        // Auto-size columns
        $lastCol = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex(count($columnas));
        foreach (range('A', $lastCol) as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        // Crear archivo Excel
        $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
        $tempFile = tempnam(sys_get_temp_dir(), 'polizas_export');
        $writer->save($tempFile);

        $excelContent = file_get_contents($tempFile);
        unlink($tempFile);

        return response($excelContent, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="polizas_' . date('Y-m-d_H-i-s') . '.xlsx"',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0'
        ]);
    }

    /**
     * Exportar renovaciones en formato CSV
     */
    public function exportarRenovaciones(Request $request)
    {
        try {
            // Obtener broker_id dinámicamente
            $brokerId = $this->getBrokerId($request);

            // Normalizar parámetros desde frontend (camelCase → snake_case)
            if ($request->has('diasVencimiento') && !$request->has('dias_vencimiento')) {
                $request->merge(['dias_vencimiento' => $request->get('diasVencimiento')]);
            }
            
            // Aplicar mismos filtros que en renovacionesDev
            $diasCritico = 7;
            $diasProximo = 30;
            $diasAdelantado = 60;
            
            $query = Poliza::where('broker_id', $brokerId)
                ->with(['client', 'assignedUser', 'ramo', 'automoviles', 'vendedor']);
            
            // Filtros por días de vencimiento
            if ($request->has('dias_vencimiento') && !empty($request->dias_vencimiento)) {
                $filtro = $request->dias_vencimiento;
                $today = Carbon::now();
                
                if ($filtro === 'critico') {
                    $query->whereRaw('DATEDIFF(end_date, ?) <= ?', [$today->toDateString(), $diasCritico]);
                } elseif ($filtro === 'proximo') {
                    $query->whereRaw('DATEDIFF(end_date, ?) <= ?', [$today->toDateString(), $diasProximo]);
                } elseif ($filtro === 'proximo_2m') {
                    // Próximos 2 meses: vencen en 60 días o menos
                    $query->whereRaw('DATEDIFF(end_date, ?) <= ? AND DATEDIFF(end_date, ?) >= ?',
                        [$today->toDateString(), $diasAdelantado, $today->toDateString(), -30]);
                }
                // Si es 'all' o cualquier otro valor, no aplicar filtro de días
            }
            // Sin filtro de días por defecto - exportar según el resto de filtros
            
            // Otros filtros
            if ($request->has('search') && !empty($request->search)) {
                $search = $request->search;
                $searchUpper = strtoupper($search);
                $query->where(function($q) use ($search, $searchUpper) {
                    $q->where('policy_number', 'like', "%{$search}%")
                      ->orWhere('client_name', 'like', "%{$search}%")
                      ->orWhere('client_document', 'like', "%{$search}%")
                      ->orWhere('insurance_company', 'like', "%{$search}%")
                      // Buscar placa en automóviles vinculados
                      ->orWhereHas('automoviles', function($qa) use ($searchUpper) {
                          $qa->where('placa', 'like', "%{$searchUpper}%");
                      })
                      // Buscar placa en campos de texto (notes, description)
                      ->orWhere('notes', 'like', "%{$searchUpper}%")
                      ->orWhere('description', 'like', "%{$searchUpper}%");
                });
            }

            if ($request->has('aseguradora') && !empty($request->aseguradora)) {
                $query->where('insurance_company', $request->aseguradora);
            }

            if ($request->has('agente') && !empty($request->agente)) {
                $agente = $request->agente;
                $query->where(function($q) use ($agente) {
                    // Buscar en seller_name (campo directo)
                    $q->where('seller_name', 'like', "%{$agente}%")
                      // O buscar en vendedor.nombres (relación con tabla vendedores)
                      ->orWhereHas('vendedor', function($qv) use ($agente) {
                          $qv->where('nombres', 'like', "%{$agente}%");
                      })
                      // O buscar en assignedUser.name (usuario asignado)
                      ->orWhereHas('assignedUser', function($qu) use ($agente) {
                          $qu->where('name', 'like', "%{$agente}%");
                      });
                });
            }

            // Rango de fechas (vencimiento) - permite exportar solo enero, etc.
            if ($request->has('fecha_inicio') && !empty($request->fecha_inicio)) {
                $query->whereDate('end_date', '>=', $request->fecha_inicio);
            }
            if ($request->has('fecha_fin') && !empty($request->fecha_fin)) {
                $query->whereDate('end_date', '<=', $request->fecha_fin);
            }

            // Filtro por ramo
            if ($request->has('ramo') && !empty($request->ramo)) {
                $ramo = $request->ramo;
                $query->where(function($q) use ($ramo) {
                    $q->whereHas('ramo', function($qr) use ($ramo) {
                        $qr->where('nombre', 'like', "%{$ramo}%");
                    })
                    ->orWhere('type', 'like', "%{$ramo}%");
                });
            }

            // Filtro por estado de renovación (acepta múltiples separados por coma)
            if ($request->filled('estado')) {
                $today = Carbon::now();
                $estados = array_filter(array_map('trim', explode(',', strtoupper((string) $request->estado))));
                if (!empty($estados)) {
                    $query->where(function ($q) use ($estados, $today) {
                        foreach ($estados as $estado) {
                            switch ($estado) {
                                case 'VENCIDO':
                                    $q->orWhere(function($subQ) use ($today) {
                                        $subQ->whereRaw('DATEDIFF(end_date, ?) < 0', [$today->toDateString()])
                                             ->where('status', '!=', 'renewed');
                                    });
                                    break;
                                case 'CRITICO':
                                    $q->orWhere(function($subQ) use ($today) {
                                        $subQ->whereRaw('DATEDIFF(end_date, ?) >= 0 AND DATEDIFF(end_date, ?) <= 7', [$today->toDateString(), $today->toDateString()])
                                             ->where('status', '!=', 'renewed');
                                    });
                                    break;
                                case 'PENDIENTE':
                                case 'EN_PROCESO':
                                    $q->orWhere(function($subQ) use ($today) {
                                        $subQ->whereRaw('DATEDIFF(end_date, ?) > 7 AND DATEDIFF(end_date, ?) <= 30', [$today->toDateString(), $today->toDateString()])
                                             ->where('status', '!=', 'renewed');
                                    });
                                    break;
                                case 'RENOVADO':
                                    $q->orWhere('status', 'renewed');
                                    break;
                                default:
                                    // ignorar
                                    break;
                            }
                        }
                    });
                }
            }
            
            $renovaciones = $query->get();
            
            // Generar CSV
            $csvData = [];
            $csvData[] = [
                'Número Póliza',
                'Cliente',
                'Documento',
                'Aseguradora',
                'Ramo',
                'Placa',
                'Póliza de riesgo',
                'Fecha Vencimiento',
                'Días para Vencimiento',
                'Valor Prima',
                'Estado',
                'Prioridad',
                'Vendedor',
                'Observaciones'
            ];
            
            foreach ($renovaciones as $poliza) {
                $today = Carbon::now();
                $endDate = Carbon::parse($poliza->end_date);
                $diasVencimiento = (int) round($today->diffInDays($endDate, false));
                
                $estado = 'PENDIENTE';
                if ($diasVencimiento < 0) {
                    $estado = 'VENCIDO';
                } elseif ($diasVencimiento <= 7) {
                    $estado = 'CRITICO';
                }
                
                // Aplicar la misma lógica mejorada de prioridades
                // 1. URGENCIA TEMPORAL (base de la prioridad)
                $prioridad = 'MEDIA'; // Default
                
                if ($diasVencimiento < 0) {
                    // Vencidas: siempre críticas
                    $prioridad = 'CRITICA';
                } elseif ($diasVencimiento <= 7) {
                    // Vencen en 7 días o menos: críticas
                    $prioridad = 'CRITICA';
                } elseif ($diasVencimiento <= 15) {
                    // Vencen en 8-15 días: altas
                    $prioridad = 'ALTA';
                } elseif ($diasVencimiento <= 30) {
                    // Vencen en 16-30 días: media
                    $prioridad = 'MEDIA';
                } else {
                    // Vencen en más de 30 días: baja
                    $prioridad = 'BAJA';
                }
                
                // 2. AJUSTE POR VALOR ECONÓMICO (puede elevar la prioridad, nunca bajarla)
                if ($poliza->premium_amount >= 5000000) {
                    // Primas muy altas (≥$5M): siempre críticas
                    $prioridad = 'CRITICA';
                } elseif ($poliza->premium_amount >= 2000000 && $prioridad !== 'CRITICA') {
                    // Primas altas (≥$2M): mínimo alta (si no es ya crítica por tiempo)
                    if ($prioridad === 'MEDIA' || $prioridad === 'BAJA') {
                        $prioridad = 'ALTA';
                    }
                } elseif ($poliza->premium_amount >= 1000000 && $prioridad === 'BAJA') {
                    // Primas medias-altas (≥$1M): mínimo media (si era baja por tiempo)
                    $prioridad = 'MEDIA';
                }
                
                // Obtener ramo correcto
                $ramoNombre = $poliza->ramo?->nombre ?? ($poliza->type ?: 'Sin ramo');
                
                // Obtener placa del primer automóvil vinculado
                $placa = '';
                if ($poliza->automoviles && $poliza->automoviles->count() > 0) {
                    $placa = $poliza->automoviles->first()->placa ?? '';
                }
                
                $csvData[] = [
                    $poliza->policy_number,
                    $poliza->client_name,
                    $poliza->client_document,
                    $poliza->insurance_company,
                    $ramoNombre,
                    $placa,
                    $poliza->description ?? '',
                    $poliza->end_date->format('Y-m-d'),
                    $diasVencimiento,
                    number_format($poliza->premium_amount, 2),
                    $estado,
                    $prioridad,
                    ($poliza->vendedor?->nombres ?? ($poliza->seller_name ?? ($poliza->assignedUser?->name ?? 'Sin asignar'))),
                    $poliza->notes ? strip_tags($poliza->notes) : 'Sin observaciones'
                ];
            }
            
            // Convertir a CSV
            $output = fopen('php://temp', 'r+');
            foreach ($csvData as $row) {
                fputcsv($output, $row, ';');
            }
            rewind($output);
            $csvContent = stream_get_contents($output);
            fclose($output);
            
            // Agregar BOM para UTF-8
            $csvContent = "\xEF\xBB\xBF" . $csvContent;
            
            return response($csvContent, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="renovaciones_' . date('Y-m-d_H-i-s') . '.csv"',
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
                'Pragma' => 'no-cache',
                'Expires' => '0'
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al exportar renovaciones: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Generar nuevo número de póliza para renovación
     */
    private function generateNewPolicyNumber($originalNumber)
    {
        // Estrategia: agregar sufijo -R01, -R02, etc.
        $baseNumber = preg_replace('/-R\d+$/', '', $originalNumber);
        
        // Buscar el último número de renovación
        $lastRenovation = Poliza::where('policy_number', 'like', $baseNumber . '-R%')
            ->orderByRaw('CAST(SUBSTRING(policy_number, LENGTH(?) + 3) AS UNSIGNED) DESC', [$baseNumber])
            ->first();
        
        if ($lastRenovation) {
            // Extraer el número de renovación y incrementar
            preg_match('/-R(\d+)$/', $lastRenovation->policy_number, $matches);
            $nextNumber = isset($matches[1]) ? intval($matches[1]) + 1 : 1;
        } else {
            $nextNumber = 1;
        }
        
        return $baseNumber . '-R' . str_pad($nextNumber, 2, '0', STR_PAD_LEFT);
    }

    /**
     * Debug endpoint para diagnosticar el problema de broker_id
     */
    public function debugBroker(Request $request)
    {
        try {
            $debugInfo = [
                'timestamp' => now()->toDateTimeString(),
                'request_data' => [
                    'has_authenticated_broker_id' => $request->has('authenticated_broker_id'),
                    'authenticated_broker_id_value' => $request->get('authenticated_broker_id'),
                    'dev_broker_header' => $request->header('X-Dev-Broker-Id'),
                    'all_headers' => $request->headers->all(),
                ],
                'auth_data' => [
                    'user_authenticated' => Auth::check(),
                    'user_id' => Auth::check() ? Auth::user()->id : null,
                    'user_broker_id' => Auth::check() ? Auth::user()->broker_id : null,
                ],
                'broker_service_data' => [
                    'current_broker_id' => BrokerAuthService::getCurrentBrokerId(),
                    'current_broker' => BrokerAuthService::getCurrentBroker(),
                ],
                'app_context' => [
                    'has_current_broker' => app()->has('current_broker'),
                    'current_broker_from_app' => app()->has('current_broker') ? app('current_broker') : null,
                ],
                'database_info' => [
                    'total_brokers' => \App\Models\Broker::count(),
                    'first_broker' => \App\Models\Broker::first(['id', 'name']),
                    'all_brokers' => \App\Models\Broker::orderBy('id')->get(['id', 'name']),
                ]
            ];

            // Intentar obtener broker_id usando la misma lógica del controlador
            $brokerId = null;
            $brokerSource = 'none';
            
            // 1. Desde el request (pasado por middleware GlobalBrokerAuth)
            if ($request->has('authenticated_broker_id')) {
                $brokerId = $request->get('authenticated_broker_id');
                $brokerSource = 'request_middleware';
            }
            
            // 2. Desde el servicio BrokerAuthService (contexto global)
            if (!$brokerId) {
                $brokerId = BrokerAuthService::getCurrentBrokerId();
                if ($brokerId) {
                    $brokerSource = 'broker_auth_service';
                }
            }
            
            // 3. Desde el contexto de la aplicación directamente
            if (!$brokerId && app()->has('current_broker')) {
                $broker = app('current_broker');
                $brokerId = $broker ? $broker->id : null;
                if ($brokerId) {
                    $brokerSource = 'app_context';
                }
            }
            
            // 4. Fallback para desarrollo - obtener desde el usuario autenticado
            if (!$brokerId) {
                $user = Auth::user();
                if ($user && $user->broker_id) {
                    $brokerId = $user->broker_id;
                    $brokerSource = 'authenticated_user';
                }
            }
            
            // 5. Fallback usando header personalizado para desarrollo/pruebas
            if (!$brokerId) {
                $devBrokerId = $request->header('X-Dev-Broker-Id');
                if ($devBrokerId) {
                    $brokerId = (int) $devBrokerId;
                    $brokerSource = 'dev_header';
                }
            }

            $debugInfo['resolved_broker'] = [
                'broker_id' => $brokerId,
                'broker_source' => $brokerSource,
            ];

            // Si tenemos broker_id, obtener información de las pólizas
            if ($brokerId) {
                $debugInfo['polizas_info'] = [
                    'broker_id_used' => $brokerId,
                    'polizas_count_for_broker' => \App\Models\Poliza::where('broker_id', $brokerId)->count(),
                    'polizas_sample' => \App\Models\Poliza::where('broker_id', $brokerId)
                        ->select(['id', 'policy_number', 'client_name', 'broker_id'])
                        ->limit(5)
                        ->get(),
                ];
            }

            // Información adicional de todos los brokers y sus pólizas
            $debugInfo['all_polizas_by_broker'] = \App\Models\Poliza::select('broker_id', \DB::raw('COUNT(*) as count'))
                ->groupBy('broker_id')
                ->get();

            return response()->json([
                'success' => true,
                'message' => 'Debug information',
                'debug' => $debugInfo
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error en debug: ' . $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ], 500);
        }
    }
}
