<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\Poliza;
use App\Models\InsurerConnection;
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
use App\Jobs\SyncPolizaDetailJob;

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

            // Ordenamiento: vigentes primero, luego más recientes
            $sortField = $request->get('sort_field');
            $sortDirection = strtolower((string)$request->get('sort_direction', 'asc')) === 'desc' ? 'desc' : 'asc';

            if (!empty($sortField)) {
                // Si el frontend solicita un orden específico, respetar eso
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
                $query->orderBy($dbField, $sortDirection);
            } else {
                // Default: vigentes primero, luego por fecha más reciente
                $query->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END ASC");
                $query->orderBy('created_at', 'desc');
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

            // Filtrar por vendedor del catálogo (seller_id)
            if ($request->filled('vendedor_id')) {
                $vendedorId = $request->vendedor_id;
                $query->where(function($q) use ($vendedorId) {
                    $q->where('seller_id', $vendedorId)
                      ->orWhere('seller_id_2', $vendedorId);
                });
            }

            // Filtro por motivo de cancelación (solo aplica a pólizas canceladas)
            if ($request->filled('cancellation_reason')) {
                $query->where('cancellation_reason', $request->cancellation_reason);
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

            // Ordenamiento: vigentes primero, luego más recientes
            $sortField = $request->get('sort_field');
            $sortDirection = strtolower((string)$request->get('sort_direction', 'asc')) === 'desc' ? 'desc' : 'asc';

            if (!empty($sortField)) {
                // Si el frontend solicita un orden específico, respetar eso
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
                $query->orderBy($dbField, $sortDirection);
            } else {
                // Default: vigentes primero, luego por fecha más reciente
                $query->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END ASC");
                $query->orderBy('created_at', 'desc');
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
     * Get cartera data - reads from cartera_items (SoftSeguros-aligned source of truth)
     * Tabs: por_cobrar | por_pagar | comision_por_cobrar | comision_recibida
     */
    public function carteraDev(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            // 1. TAB COUNTERS (using 3 boolean flags like SoftSeguros)
            $tabCounters = DB::table('cartera_items')
                ->where('broker_id', $brokerId)
                ->where('recibo_anulado', false)
                ->selectRaw("
                    COUNT(*) as total,
                    SUM(CASE WHEN recaudado_en_oficina = 0 AND recaudado_aseguradora = 0 AND recibo_pago_directo = 0 AND es_anticipo = 0 THEN 1 ELSE 0 END) as count_por_cobrar,
                    SUM(CASE WHEN recaudado_en_oficina = 1 AND recaudado_aseguradora = 0 AND recibo_pago_directo = 0 THEN 1 ELSE 0 END) as count_por_pagar,
                    SUM(CASE WHEN recaudado_aseguradora = 1 AND comisionada = 0 THEN 1 ELSE 0 END) as count_comision_por_cobrar,
                    SUM(CASE WHEN recaudado_aseguradora = 1 AND comisionada = 1 THEN 1 ELSE 0 END) as count_comision_recibida,
                    SUM(CASE WHEN recibo_pago_directo = 1 THEN 1 ELSE 0 END) as count_pago_directo,
                    SUM(CASE WHEN es_anticipo = 1 THEN 1 ELSE 0 END) as count_anticipos
                ")
                ->first();

            $countAnulados = (int) DB::table('cartera_items')
                ->where('broker_id', $brokerId)
                ->where('recibo_anulado', true)
                ->count();

            $contadoresTabs = [
                'general' => (int) ($tabCounters->total ?? 0) + $countAnulados,
                'porCobrar' => (int) ($tabCounters->count_por_cobrar ?? 0),
                'porPagar' => (int) ($tabCounters->count_por_pagar ?? 0),
                'comisionPorCobrar' => (int) ($tabCounters->count_comision_por_cobrar ?? 0),
                'comisionRecibida' => (int) ($tabCounters->count_comision_recibida ?? 0),
                'pagoDirecto' => (int) ($tabCounters->count_pago_directo ?? 0),
                'anticipos' => (int) ($tabCounters->count_anticipos ?? 0),
                'anulados' => $countAnulados,
            ];

            // 2. GLOBAL STATISTICS from cartera_items
            // GREATEST(0,...) safeguard: prevents corrupt negative values from skewing totals
            $statsRaw = DB::table('cartera_items')
                ->where('broker_id', $brokerId)
                ->selectRaw("
                    COUNT(*) as total_items,
                    COUNT(DISTINCT poliza_numero) as total_polizas,
                    SUM(GREATEST(0, prima_total_pago)) as total_cartera,
                    SUM(GREATEST(0, comision_a_recibir)) as total_comisiones,
                    SUM(GREATEST(0, valor_recaudado_oficina)) as recaudado_total,
                    SUM(GREATEST(0, saldo_pendiente_oficina)) as por_cobrar_total,
                    SUM(GREATEST(0, saldo_pendiente_aseguradora)) as por_pagar_total,
                    SUM(GREATEST(0, comision_recibida)) as comisiones_recibidas_total
                ")
                ->first();

            $totalCartera = (float) ($statsRaw->total_cartera ?? 0);
            $estadisticas = [
                'totalPolizas' => (int) ($statsRaw->total_polizas ?? 0),
                'totalItems' => (int) ($statsRaw->total_items ?? 0),
                'primaTotal' => $totalCartera,
                'comisionesTotal' => (float) ($statsRaw->total_comisiones ?? 0),
                'recaudadoTotal' => (float) ($statsRaw->recaudado_total ?? 0),
                'porCobrarTotal' => (float) ($statsRaw->por_cobrar_total ?? 0),
                'porPagarTotal' => (float) ($statsRaw->por_pagar_total ?? 0),
                'comisionesRecibidasTotal' => (float) ($statsRaw->comisiones_recibidas_total ?? 0),
                'tasaRecaudo' => $totalCartera > 0
                    ? (((float) ($statsRaw->recaudado_total ?? 0)) / $totalCartera * 100)
                    : 0,
            ];

            // 3. MAIN QUERY on cartera_items
            $query = DB::table('cartera_items')
                ->where('cartera_items.broker_id', $brokerId);

            // Tab filter (using 3 boolean flags like SoftSeguros)
            if ($request->filled('tab')) {
                $tab = trim((string) $request->tab);
                switch ($tab) {
                    case 'porCobrar':
                        // Not collected at office, not direct payment, not advance, not voided, and not recaudado_aseguradora
                        $query->where('cartera_items.recaudado_en_oficina', false)
                              ->where('cartera_items.recaudado_aseguradora', false)
                              ->where('cartera_items.recibo_pago_directo', false)
                              ->where('cartera_items.es_anticipo', false)
                              ->where('cartera_items.recibo_anulado', false);
                        break;
                    case 'porPagar':
                        // Collected at office, not yet paid to insurer
                        $query->where('cartera_items.recaudado_en_oficina', true)
                              ->where('cartera_items.recaudado_aseguradora', false)
                              ->where('cartera_items.recibo_pago_directo', false)
                              ->where('cartera_items.recibo_anulado', false);
                        break;
                    case 'comisionPorCobrar':
                        // Paid to insurer, commission not yet received
                        $query->where('cartera_items.recaudado_aseguradora', true)
                              ->where('cartera_items.comisionada', false)
                              ->where('cartera_items.recibo_anulado', false);
                        break;
                    case 'comisionRecibida':
                        // Fully completed: insurer paid + commission received
                        $query->where('cartera_items.recaudado_aseguradora', true)
                              ->where('cartera_items.comisionada', true)
                              ->where('cartera_items.recibo_anulado', false);
                        break;
                    case 'pagoDirecto':
                        // Direct payment (client paid insurer directly)
                        $query->where('cartera_items.recibo_pago_directo', true)
                              ->where('cartera_items.recibo_anulado', false);
                        break;
                    case 'anticipos':
                        // Advances
                        $query->where('cartera_items.es_anticipo', true)
                              ->where('cartera_items.recibo_anulado', false);
                        break;
                    case 'anulados':
                        // Voided receipts
                        $query->where('cartera_items.recibo_anulado', true);
                        break;
                }
            }

            // Search filter
            if ($request->filled('search')) {
                $search = $request->search;
                $query->leftJoin('polizas', 'cartera_items.poliza_id', '=', 'polizas.id');
                $query->select('cartera_items.*');
                $query->where(function ($q) use ($search) {
                    $q->where('cartera_items.poliza_numero', 'like', "%{$search}%")
                      ->orWhere('cartera_items.cliente_nombre', 'like', "%{$search}%")
                      ->orWhere('cartera_items.cliente_documento', 'like', "%{$search}%")
                      ->orWhere('cartera_items.aseguradora_nombre', 'like', "%{$search}%")
                      ->orWhere('cartera_items.riesgo', 'like', "%{$search}%")
                      ->orWhere('polizas.vehicle_plates', 'like', "%{$search}%")
                      ->orWhere('polizas.insured_name', 'like', "%{$search}%");
                });
            }

            // Aseguradora filter
            if ($request->filled('aseguradora')) {
                $query->where('cartera_items.aseguradora_nombre', $request->aseguradora);
            }

            // Vendedor filter
            if ($request->filled('vendedor')) {
                $query->where('cartera_items.vendedor_nombre', 'like', "%{$request->vendedor}%");
            }

            // Order by dias_vencidos desc (most overdue first) for por_cobrar, else by poliza_numero
            if ($request->input('tab') === 'porCobrar') {
                $query->orderBy('cartera_items.dias_vencidos', 'desc');
            } else {
                $query->orderBy('cartera_items.poliza_numero', 'asc');
            }

            // Pagination
            $perPage = min((int) $request->input('per_page', 25), 100);
            $page = (int) $request->input('page', 1);

            $paginated = $query->paginate($perPage, ['*'], 'page', $page);
            $items = $paginated->getCollection();

            // Batch-lookup recibos for these cartera_items (by poliza_id)
            $polizaIds = $items->pluck('poliza_id')->filter()->unique()->values()->toArray();
            $recibosMap = [];
            if (!empty($polizaIds)) {
                $recibos = DB::table('recibos_caja')
                    ->whereIn('poliza_id', $polizaIds)
                    ->where('broker_id', $brokerId)
                    ->whereNull('deleted_at')
                    ->where('recibo_anulado', false)
                    ->select('id', 'poliza_id', 'numero_recibo', 'fecha_realizo_pago_oficina', 'cliente_nombre', 'cliente_documento', 'poliza_numero', 'aseguradora_nombre', 'ramo_nombre', 'forma_pago', 'valor_recaudado_en_oficina', 'valor_a_pagar', 'es_anticipo', 'tipo_recaudo', 'observaciones')
                    ->orderByDesc('id')
                    ->get();
                foreach ($recibos as $r) {
                    // Keep only the latest recibo per poliza (first one due to orderByDesc)
                    if (!isset($recibosMap[$r->poliza_id])) {
                        $recibosMap[$r->poliza_id] = $r;
                    }
                }
            }

            // Transform to frontend format
            $carteraData = $items->map(function ($item) use ($recibosMap) {
                $recibo = $recibosMap[$item->poliza_id] ?? null;
                return [
                    'id' => $item->id,
                    'poliza_id' => $item->poliza_id,
                    'cliente_id' => $item->cliente_id,
                    'softseguros_pago_id' => $item->softseguros_pago_id,
                    'numero_poliza' => $item->poliza_numero,
                    'numero_renovacion' => (int) ($item->numero_renovacion ?? 0),
                    'anexo_numero' => $item->anexo_numero,
                    'cliente' => $item->cliente_nombre ?: 'Sin nombre',
                    'documento' => $item->cliente_documento ?? '',
                    'aseguradora' => $item->aseguradora_nombre ?? '',
                    'ramo' => $item->ramo_principal ?? $item->subramo ?? '',
                    'subramo' => $item->subramo,
                    'vendedor' => $item->vendedor_nombre ?? '',
                    'sede' => $item->sede,
                    'forma_pago' => $item->forma_pago ?? '',
                    'numero_pago' => $item->numero_pago,
                    'estado_cartera' => $item->estado_cartera,

                    // 3 flags SS-style
                    'recaudado_en_oficina' => (bool) $item->recaudado_en_oficina,
                    'recaudo_parcial_oficina' => (bool) ($item->recaudo_parcial_oficina ?? false),
                    'recaudado_aseguradora' => (bool) $item->recaudado_aseguradora,
                    'comisionada' => (bool) $item->comisionada,
                    'recibo_pago_directo' => (bool) $item->recibo_pago_directo,
                    'es_anticipo' => (bool) $item->es_anticipo,
                    'recibo_anulado' => (bool) $item->recibo_anulado,
                    'split_from_id' => $item->split_from_id ?? null,

                    // Financial
                    'prima_neta' => (float) $item->prima_neta,
                    'valor_neto_a_pagar' => (float) $item->valor_neto_a_pagar,
                    'prima_total_pago' => (float) $item->prima_total_pago,
                    'prima_total' => (float) $item->prima_total,
                    'saldo_pendiente_oficina' => (float) $item->saldo_pendiente_oficina,
                    'saldo_pendiente_aseguradora' => (float) $item->saldo_pendiente_aseguradora,
                    'valor_recaudado_oficina' => (float) $item->valor_recaudado_oficina,
                    'valor_pagado_aseguradora' => (float) $item->valor_pagado_aseguradora,
                    'comision_a_recibir' => (float) $item->comision_a_recibir,
                    'comision_recibida' => (float) $item->comision_recibida,
                    'comision_vendedor' => (float) $item->comision_vendedor,
                    'porcentaje_comision' => $item->porcentaje_comision ? (float) $item->porcentaje_comision : null,

                    // Dates
                    'dias_vencidos' => (int) $item->dias_vencidos,
                    'fecha_limite_pago' => $item->fecha_limite_pago,
                    'fecha_compromiso_pago' => $item->fecha_compromiso_pago,
                    'fecha_recaudado_oficina' => $item->fecha_recaudado_oficina,
                    'fecha_pago_aseguradora' => $item->fecha_pago_aseguradora,
                    'fecha_comisionada' => $item->fecha_comisionada,
                    'fecha_inicio_vigencia' => $item->fecha_inicio_vigencia,
                    'fecha_fin_vigencia' => $item->fecha_fin_vigencia,

                    // Extra
                    'numero_remision' => $item->numero_remision,
                    'observacion_bitacora' => $item->observacion_bitacora,
                    'observaciones_pago' => $item->observaciones_pago,

                    // Recibo asociado (latest non-anulado)
                    'recibo' => $recibo ? [
                        'id' => $recibo->id,
                        'numero_recibo' => $recibo->numero_recibo,
                        'fecha' => $recibo->fecha_realizo_pago_oficina,
                        'cliente_nombre' => $recibo->cliente_nombre,
                        'cliente_documento' => $recibo->cliente_documento,
                        'poliza_numero' => $recibo->poliza_numero,
                        'aseguradora_nombre' => $recibo->aseguradora_nombre,
                        'ramo_nombre' => $recibo->ramo_nombre,
                        'forma_pago' => $recibo->forma_pago,
                        'valor_recaudado_en_oficina' => (float) $recibo->valor_recaudado_en_oficina,
                        'valor_a_pagar' => (float) $recibo->valor_a_pagar,
                        'es_anticipo' => (bool) $recibo->es_anticipo,
                        'tipo_recaudo' => $recibo->tipo_recaudo,
                        'observaciones' => $recibo->observaciones,
                    ] : null,
                ];
            });

            return response()->json([
                'success' => true,
                'message' => 'Cartera obtenida exitosamente',
                'data' => $carteraData,
                'pagination' => [
                    'current_page' => $paginated->currentPage(),
                    'last_page' => $paginated->lastPage(),
                    'per_page' => $paginated->perPage(),
                    'total' => $paginated->total(),
                ],
                'estadisticas' => $estadisticas,
                'contadoresTabs' => $contadoresTabs,
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
            'numero_renovacion' => (int) ($poliza->numero_renovacion ?? 0),
            'porcentaje_comision' => (float) $poliza->commission_percentage,
            'comision' => (int) round((float) $poliza->commission_amount),
            // Forma de pago: SS custom_fields.forma_pago takes priority (Fraccionado/Financiado/Contado)
            // Fallback to payment_method mapping for Guro-native polizas
            'forma_pago' => $this->resolveFormaPago($poliza),
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

            // Partes: Tomador / Asegurado
            'policy_holder_name' => ($poliza->policy_holder_name ?? ($poliza->custom_fields['policy_holder_name'] ?? null)),
            'policy_holder_document' => ($poliza->policy_holder_document ?? ($poliza->custom_fields['policy_holder_document'] ?? null)),
            'policy_holder_doc_type' => $poliza->policy_holder_doc_type,
            'policy_holder_phone' => $poliza->policy_holder_phone,
            'policy_holder_email' => $poliza->policy_holder_email,
            'policy_holder_address' => $poliza->policy_holder_address,
            'policy_holder_city' => $poliza->policy_holder_city,
            'insured_name' => ($poliza->insured_name ?? ($poliza->custom_fields['insured_name'] ?? null)),
            'insured_document' => ($poliza->insured_document ?? ($poliza->custom_fields['insured_document'] ?? null)),

            // Pólizas colectivas: check custom_fields first, fallback to colectiva bool / tipo_poliza column
            'policy_category' => (
                ($poliza->custom_fields['policy_category'] ?? null)
                ?: ($poliza->colectiva ? 'colectiva' : null)
                ?: (($poliza->tipo_poliza === 'colectiva') ? 'colectiva' : null)
                ?: 'individual'
            ),
            'oficina_radicacion' => $poliza->custom_fields['oficina_radicacion'] ?? null,
            'ciudad_expedicion' => $poliza->custom_fields['ciudad_expedicion'] ?? null,
            
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
            'cancellation_reason' => $poliza->cancellation_reason,
            'cancelled_at' => $poliza->cancelled_at?->format('Y-m-d H:i:s'),
            'cancelled_by' => $poliza->cancelled_by,
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
            'beneficiarios' => $poliza->beneficiaries ?? [],
            
            'documents' => $poliza->documents ?? [],
            // Placas de vehículos (aplica para ramos automotores: Automóvil y SOAT)
            'placas' => ($this->mapTypeFromFrontend($poliza->ramo?->nombre ?? $poliza->type) === 'autos') ? $placas : [],

            // Campos SoftSeguros
            'clasificacion_poliza' => $poliza->clasificacion_poliza,
            'periodicidad' => $poliza->periodicidad,
            'soat' => (bool) $poliza->soat,
            'arl' => (bool) $poliza->arl,
            'colectiva' => (bool) $poliza->colectiva,
            'tipo_poliza_db' => $poliza->tipo_poliza,
            // Comisiones detalladas
            'iva_comision' => $poliza->iva_comision,
            'porcentaje_sobrecomision' => $poliza->porcentaje_sobrecomision,
            'sobrecomision' => $poliza->sobrecomision,
            'porcentaje_comision_vendedor' => $poliza->porcentaje_comision_vendedor,
            'comision_vendedor' => $poliza->comision_vendedor,
            'coinsurance_participation' => $poliza->coinsurance_participation,
            // Financiación
            'porcentaje_financiacion' => $poliza->porcentaje_financiacion,
            'valor_financiacion' => $poliza->valor_financiacion,
            'total_poliza_financiada' => $poliza->total_poliza_financiada,
            // Cartera
            'estado_cartera' => $poliza->estado_cartera,
            // Origen: sync vs manual
            'sync_source' => $poliza->custom_fields['_sync_source'] ?? null,
            'sync_at' => $poliza->custom_fields['_sync_at'] ?? null,
            // Impuestos
            'porcentaje_impuesto_bomberos' => $poliza->porcentaje_impuesto_bomberos,
            'impuesto_bomberos' => $poliza->impuesto_bomberos,
            // Moneda
            'tipo_moneda' => $poliza->tipo_moneda,
            'tasa_cambio' => $poliza->tasa_cambio,
            // Notificaciones
            
            
            // Último recibo de caja asociado
            'ultimo_recibo' => (function() use ($poliza) {
                $recibo = DB::table('recibos_caja')
                    ->where('poliza_id', $poliza->id)
                    ->orderByDesc('id')
                    ->first(['id', 'numero_recibo', 'fecha_realizo_pago_oficina', 'cliente_nombre', 'cliente_documento', 'poliza_numero', 'aseguradora_nombre', 'ramo_nombre', 'forma_pago', 'valor_recaudado_en_oficina', 'valor_a_pagar', 'es_anticipo', 'tipo_recaudo', 'observaciones']);
                if (!$recibo) return null;
                return [
                    'id' => $recibo->id,
                    'numero_recibo' => $recibo->numero_recibo,
                    'fecha' => $recibo->fecha_realizo_pago_oficina,
                    'cliente_nombre' => $recibo->cliente_nombre,
                    'cliente_documento' => $recibo->cliente_documento,
                    'poliza_numero' => $recibo->poliza_numero,
                    'aseguradora_nombre' => $recibo->aseguradora_nombre,
                    'ramo_nombre' => $recibo->ramo_nombre,
                    'forma_pago' => $recibo->forma_pago,
                    'valor_recaudado_en_oficina' => (float) $recibo->valor_recaudado_en_oficina,
                    'valor_a_pagar' => (float) $recibo->valor_a_pagar,
                    'es_anticipo' => (bool) $recibo->es_anticipo,
                    'tipo_recaudo' => $recibo->tipo_recaudo,
                    'observaciones' => $recibo->observaciones,
                ];
            })(),

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
            // Solo mostrar pólizas marcadas como renovables
            $query = Poliza::where('broker_id', $brokerId)
                ->where('auto_renewal', true)
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
                                        $subQ->whereRaw('DATEDIFF(end_date, ?) > 7', [$today->toDateString()])
                                             ->where('status', '!=', 'renewed');
                                    });
                                    break;
                                case 'RENOVADO':
                                    $q->orWhere(function($subQ) use ($today) {
                                        // Mode A: póliza reemplazada (permanente)
                                        $subQ->where('status', 'renewed')
                                             // Mode B: renovada in-place pero aún lejos de vencer (>30 días)
                                             ->orWhere(function($subQ2) use ($today) {
                                                 $subQ2->where('is_renewal', true)
                                                       ->where('numero_renovacion', '>', 0)
                                                       ->whereRaw('DATEDIFF(end_date, ?) > 30', [$today->toDateString()]);
                                             });
                                    });
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
            
            // Query base: solo pólizas renovables del broker
            $baseQuery = Poliza::where('broker_id', $brokerId)
                ->where('auto_renewal', true);

            // Total renovaciones: todas las pólizas
            $totalRenovaciones = (clone $baseQuery)->count();

            // Renovaciones críticas: 0-7 días y NO status='renewed' (Mode A)
            // Mode B polizas near expiry naturally return here
            $renovacionesCriticas = (clone $baseQuery)
                ->whereRaw('DATEDIFF(end_date, ?) >= 0 AND DATEDIFF(end_date, ?) <= 7', 
                    [$today->toDateString(), $today->toDateString()])
                ->where('status', '!=', 'renewed')
                ->count();

            // Renovaciones pendientes: >7 días, NO status='renewed', y NO Mode B renovadas con >30 días
            $renovacionesPendientes = (clone $baseQuery)
                ->whereRaw('DATEDIFF(end_date, ?) > 7',
                    [$today->toDateString()])
                ->where('status', '!=', 'renewed')
                ->where(function($q) use ($today) {
                    // Excluir Mode B renovadas con >30 días (esas cuentan como completadas)
                    $q->whereNull('is_renewal')
                       ->orWhere('is_renewal', false)
                       ->orWhere('numero_renovacion', 0)
                       ->orWhereNull('numero_renovacion')
                       ->orWhereRaw('DATEDIFF(end_date, ?) <= 30', [$today->toDateString()]);
                })
                ->count();

            // Renovaciones vencidas: días negativos y NO status='renewed'
            $renovacionesVencidas = (clone $baseQuery)
                ->whereRaw('DATEDIFF(end_date, ?) < 0', [$today->toDateString()])
                ->where('status', '!=', 'renewed')
                ->count();

            // Renovaciones completadas: Mode A (status='renewed') + Mode B (is_renewal + >30 días)
            $renovacionesCompletadas = (clone $baseQuery)
                ->where(function($q) use ($today) {
                    $q->where('status', 'renewed')
                       ->orWhere(function($q2) use ($today) {
                           $q2->where('is_renewal', true)
                              ->where('numero_renovacion', '>', 0)
                              ->whereRaw('DATEDIFF(end_date, ?) > 30', [$today->toDateString()]);
                       });
                })
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
        // Mode A (status='renewed'): póliza reemplazada → siempre RENOVADO
        // Mode B (is_renewal + numero_renovacion > 0): póliza activa renovada in-place
        //   → RENOVADO solo mientras queden >30 días. Cuando se acerque a vencer, vuelve a PENDIENTE/CRITICO/VENCIDO
        if ($poliza->status === 'renewed') {
            $estado = 'RENOVADO';
        } elseif ($poliza->is_renewal && $poliza->numero_renovacion > 0 && $diasVencimiento > 30) {
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
            'intentosContacto' => 0,
            'observaciones' => $poliza->notes ?? 'Sin observaciones',
            'poliza_id' => $poliza->id,
            'fechaInicio' => $poliza->start_date ? ($poliza->start_date instanceof \Carbon\Carbon ? $poliza->start_date->format('Y-m-d') : Carbon::parse($poliza->start_date)->format('Y-m-d')) : null,
            'numeroRenovacion' => (int) ($poliza->numero_renovacion ?? 0),
            'comisionPorcentaje' => (float) ($poliza->commission_percentage ?? 0),
            'isRenewal' => (bool) ($poliza->is_renewal ?? false),
            // Financial fields for renewal modal
            'porcentajeIva' => (float) ($poliza->vat_percentage ?? 19),
            'iva' => (float) ($poliza->vat_amount ?? 0),
            'gastosAdicionales' => (float) ($poliza->gastos_adicionales ?? 0),
            'total' => (float) ($poliza->total_amount ?? 0),
            'aseguradora_id' => $poliza->aseguradora_id,
            'ramo_id' => $poliza->ramo_id,
            'formaPago' => $poliza->payment_frequency,
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

            $payload = $this->transformPolizaToFrontend($poliza) + ['historial' => $historial];
            if (Schema::hasColumn('polizas', 'detail_sync_status')) {
                $payload['detail_sync_status'] = $poliza->detail_sync_status;
                $payload['detail_sync_at'] = $poliza->detail_sync_at?->toIso8601String();
                $payload['detail_sync_error'] = $poliza->detail_sync_error;
            }
            if (Schema::hasTable('poliza_coverages')) {
                $poliza->loadMissing('coverages');
                $payload['coverages'] = $poliza->coverages->map(fn ($c) => [
                    'id' => $c->id,
                    'coverage_type' => $c->coverage_type,
                    'coverage_name' => $c->coverage_name,
                    'coverage_code' => $c->coverage_code,
                    'insured_value' => $c->insured_value,
                    'deductible' => $c->deductible,
                    'deductible_value' => $c->deductible_value,
                    'deductible_percentage' => $c->deductible_percentage,
                    'source_insurer' => $c->source_insurer,
                ])->values()->all();
            }

            return response()->json([
                'success' => true,
                'message' => 'Póliza obtenida exitosamente',
                'data' => $payload,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener la póliza: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Sincroniza detalle de póliza desde el microservicio (coberturas + campos enriquecidos).
     */
    public function syncPolizaDetail(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $request->validate([
                'insurer_connection_id' => 'nullable|integer|exists:insurer_connections,id',
                'async' => 'nullable|boolean',
            ]);
            $async = $request->boolean('async', false);

            if (! Schema::hasColumn('polizas', 'detail_sync_status')) {
                return response()->json([
                    'success' => false,
                    'message' => 'La base de datos no tiene columnas de sincronización de detalle. Ejecuta las migraciones.',
                ], 503);
            }

            $poliza = Poliza::where('broker_id', $brokerId)->where('id', $id)->first();
            if (! $poliza) {
                return response()->json([
                    'success' => false,
                    'message' => 'Póliza no encontrada',
                ], 404);
            }

            $connId = $request->input('insurer_connection_id');
            $conn = $this->resolveInsurerConnectionForPoliza($poliza, (int) $brokerId, $connId !== null && $connId !== '' ? (int) $connId : null);
            if (! $conn) {
                return response()->json([
                    'success' => false,
                    'message' => 'No hay conexión activa con la aseguradora para esta póliza, o la conexión indicada no coincide con el origen de sincronización.',
                ], 422);
            }

            if ($async) {
                SyncPolizaDetailJob::dispatch($poliza->id, $conn->id);

                return response()->json([
                    'success' => true,
                    'message' => 'Sincronización de detalle en cola',
                    'data' => ['async' => true, 'poliza_id' => $poliza->id, 'insurer_connection_id' => $conn->id],
                ], 202);
            }

            SyncPolizaDetailJob::dispatchSync($poliza->id, $conn->id);
            $poliza->refresh();
            $poliza->loadMissing('coverages');

            return response()->json([
                'success' => true,
                'message' => 'Detalle sincronizado',
                'data' => [
                    'detail_sync_status' => $poliza->detail_sync_status,
                    'detail_sync_at' => $poliza->detail_sync_at?->toIso8601String(),
                    'detail_sync_error' => $poliza->detail_sync_error,
                    'coverages_count' => $poliza->coverages->count(),
                ],
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            throw $e;
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al sincronizar detalle: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Descarga la carátula PDF de una póliza desde HDI.
     */
    public function downloadCaratulaPdf(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $poliza = Poliza::where('broker_id', $brokerId)->where('id', $id)->firstOrFail();

            $cf = $poliza->custom_fields ?? [];
            $detail = $cf['_detail'] ?? [];
            $sseguro = $detail['sseguro'] ?? null;
            $productCode = $detail['product_code'] ?? null;

            if (! $sseguro || ! $productCode) {
                return response()->json([
                    'success' => false,
                    'message' => 'No hay datos de sincronización (sseguro/product_code). Resincroniza la póliza primero.',
                ], 422);
            }

            $conn = $this->resolveInsurerConnectionForPoliza($poliza, (int) $brokerId, null);
            if (! $conn || ! $conn->microservice_session_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'No hay sesión activa con HDI. Reconecta la aseguradora.',
                ], 422);
            }

            $url = rtrim((string) config('services.microservicio.base_url'), '/')
                . '/hdi/polizas/' . urlencode($poliza->numero_poliza) . '/pdf'
                . '?sseguro=' . $sseguro . '&product_code=' . $productCode;

            $response = \Illuminate\Support\Facades\Http::withHeaders([
                'X-Session-Id' => $conn->microservice_session_id,
            ])->timeout(90)->get($url);

            if (! $response->successful()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error al obtener el PDF: ' . substr($response->body(), 0, 300),
                ], 502);
            }

            $filename = 'caratula_' . $poliza->numero_poliza . '.pdf';
            return response($response->body(), 200, [
                'Content-Type'        => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                'Cache-Control'       => 'no-store',
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['success' => false, 'message' => 'Póliza no encontrada'], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al descargar carátula: ' . $e->getMessage(),
            ], 500);
        }
    }

    /** Scope: pólizas importadas desde aseguradoras (tienen _sync_source en custom_fields). */
    private function polizasWithSyncSource(int $brokerId, ?string $syncSource = null)
    {
        $q = Poliza::where('broker_id', $brokerId)
            ->whereRaw("JSON_EXTRACT(custom_fields, '\\$._sync_source') IS NOT NULL");
        if ($syncSource) {
            $q->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(custom_fields, '\\$._sync_source')) = ?", [$syncSource]);
        }
        return $q;
    }

    /**
     * Encola sincronización de detalle para TODAS las pólizas importadas del broker.
     * reset=true vuelve a sincronizar incluso las ya completadas.
     */
    public function syncAllPolizasDetail(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            if (! Schema::hasColumn('polizas', 'detail_sync_status')) {
                return response()->json(['success' => false, 'message' => 'Ejecuta las migraciones primero.'], 503);
            }

            $reset = $request->boolean('reset', false);
            $query = $this->polizasWithSyncSource($brokerId, $request->input('sync_source'));

            // Sin reset: solo las no completadas aún
            if (! $reset) {
                $query->whereNotIn('detail_sync_status', ['completed', 'partial']);
            }

            $syncSvc = app(\App\Services\InsurerSyncService::class);

            // Bolívar prefetch: bulk-populate _detail.cod_ramo before queuing (1 API call per connection)
            $bolivarConns = InsurerConnection::where('broker_id', $brokerId)
                ->where('insurer_code', 'bolivar')
                ->whereNotNull('microservice_session_id')
                ->orderByDesc('connected_at')
                ->get();
            foreach ($bolivarConns as $bc) {
                try {
                    $syncSvc->bolivarPrefetchRamoCodes((int) $brokerId, $bc->microservice_session_id);
                } catch (\Throwable) { /* non-fatal – jobs will record individual errors */ }
            }

            // SURA prefetch: derive ramo_codigo from product_name (no API call needed)
            try {
                $syncSvc->suraPrefetchRamoCodes((int) $brokerId);
            } catch (\Throwable) { /* non-fatal */ }

            // Re-fetch so fresh _detail (with ramo codes) is reflected
            $polizas = $query->select('id', 'broker_id', 'custom_fields')->get();
            $queued = 0;
            $skipped = 0;

            foreach ($polizas as $poliza) {
                $conn = $this->resolveInsurerConnectionForPoliza($poliza, (int) $brokerId, null);
                if (! $conn) { $skipped++; continue; }
                DB::table('polizas')->where('id', $poliza->id)->update(['detail_sync_status' => 'pending']);
                SyncPolizaDetailJob::dispatch($poliza->id, $conn->id);
                $queued++;
            }

            return response()->json([
                'success' => true,
                'message' => "Se encolaron {$queued} pólizas para sincronización de detalle.",
                'data' => ['queued' => $queued, 'skipped' => $skipped, 'total' => $polizas->count()],
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Cancela la sincronización de detalle pendiente (marca las no procesadas).
     */
    public function cancelDetailSync(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $cancelled = DB::table('polizas')
                ->where('broker_id', $brokerId)
                ->whereRaw("JSON_EXTRACT(custom_fields, '\\$._sync_source') IS NOT NULL")
                ->whereIn('detail_sync_status', ['pending', 'processing'])
                ->update(['detail_sync_status' => 'cancelled']);

            return response()->json([
                'success' => true,
                'message' => "Se cancelaron {$cancelled} pólizas pendientes.",
                'data' => ['cancelled' => $cancelled],
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Progreso de sincronización de detalles con desglose por fuente y errores de muestra.
     */
    public function detailSyncProgress(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            if (! Schema::hasColumn('polizas', 'detail_sync_status')) {
                return response()->json(['success' => true, 'data' => ['total' => 0, 'synced' => 0, 'failed' => 0, 'cancelled' => 0, 'pending' => 0, 'by_source' => []]]);
            }

            $base      = $this->polizasWithSyncSource($brokerId);
            $total     = (clone $base)->count();
            $done      = (clone $base)->whereIn('detail_sync_status', ['completed', 'partial'])->count();
            $failed    = (clone $base)->where('detail_sync_status', 'failed')->count();
            $cancelled = (clone $base)->where('detail_sync_status', 'cancelled')->count();
            $pending   = $total - $done - $failed - $cancelled;
            $synced    = $done;

            // Desglose por fuente (aseguradora)
            $sources = DB::table('polizas')
                ->where('broker_id', $brokerId)
                ->whereNull('deleted_at')
                ->whereRaw("JSON_EXTRACT(custom_fields, '\\$._sync_source') IS NOT NULL")
                ->selectRaw("
                    JSON_UNQUOTE(JSON_EXTRACT(custom_fields, '\\$._sync_source')) as src,
                    COUNT(*) as total,
                    SUM(CASE WHEN detail_sync_status IN ('completed','partial') THEN 1 ELSE 0 END) as synced,
                    SUM(CASE WHEN detail_sync_status = 'failed' THEN 1 ELSE 0 END) as failed,
                    SUM(CASE WHEN detail_sync_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
                    SUM(CASE WHEN detail_sync_status = 'pending' OR detail_sync_status = 'processing' THEN 1 ELSE 0 END) as pending
                ")
                ->groupBy('src')
                ->get();

            // Errores de muestra por fuente
            $sampleErrors = DB::table('polizas')
                ->where('broker_id', $brokerId)
                ->whereNull('deleted_at')
                ->where('detail_sync_status', 'failed')
                ->whereNotNull('detail_sync_error')
                ->whereRaw("JSON_EXTRACT(custom_fields, '\\$._sync_source') IS NOT NULL")
                ->selectRaw("JSON_UNQUOTE(JSON_EXTRACT(custom_fields, '\\$._sync_source')) as src, detail_sync_error")
                ->orderByDesc('detail_sync_at')
                ->limit(20)
                ->get()
                ->groupBy('src')
                ->map(fn($rows) => $rows->first()?->detail_sync_error);

            $bySource = $sources->mapWithKeys(fn($row) => [
                $row->src => [
                    'total'       => (int) $row->total,
                    'synced'      => (int) $row->synced,
                    'failed'      => (int) $row->failed,
                    'cancelled'   => (int) $row->cancelled,
                    'pending'     => (int) $row->pending,
                    'sample_error'=> $sampleErrors[$row->src] ?? null,
                ],
            ])->toArray();

            return response()->json([
                'success' => true,
                'data' => compact('total', 'synced', 'failed', 'cancelled', 'pending', 'bySource'),
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Sincroniza detalle para varias pólizas (cola o en línea según async).
     */
    public function syncPolizasDetailBatch(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $request->validate([
                'poliza_ids' => 'required|array|max:200',
                'poliza_ids.*' => 'integer',
                'insurer_connection_id' => 'nullable|integer|exists:insurer_connections,id',
                'async' => 'nullable|boolean',
            ]);
            $async = $request->boolean('async', true);

            if (! Schema::hasColumn('polizas', 'detail_sync_status')) {
                return response()->json([
                    'success' => false,
                    'message' => 'La base de datos no tiene columnas de sincronización de detalle. Ejecuta las migraciones.',
                ], 503);
            }

            $ids = array_values(array_unique(array_map('intval', $request->input('poliza_ids', []))));
            $polizas = Poliza::where('broker_id', $brokerId)->whereIn('id', $ids)->get()->keyBy('id');
            $connOverride = $request->input('insurer_connection_id');
            $connOverride = $connOverride !== null && $connOverride !== '' ? (int) $connOverride : null;

            $results = [];
            foreach ($ids as $pid) {
                $poliza = $polizas->get($pid);
                if (! $poliza) {
                    $results[] = ['poliza_id' => $pid, 'success' => false, 'error' => 'Póliza no encontrada'];
                    continue;
                }
                $conn = $this->resolveInsurerConnectionForPoliza($poliza, (int) $brokerId, $connOverride);
                if (! $conn) {
                    $results[] = ['poliza_id' => $pid, 'success' => false, 'error' => 'Sin conexión aseguradora válida'];
                    continue;
                }
                try {
                    if ($async) {
                        SyncPolizaDetailJob::dispatch($poliza->id, $conn->id);
                        $results[] = ['poliza_id' => $pid, 'success' => true, 'queued' => true];
                    } else {
                        SyncPolizaDetailJob::dispatchSync($poliza->id, $conn->id);
                        $poliza->refresh();
                        $results[] = [
                            'poliza_id' => $pid,
                            'success' => true,
                            'detail_sync_status' => $poliza->detail_sync_status,
                            'detail_sync_error' => $poliza->detail_sync_error,
                        ];
                    }
                } catch (\Throwable $e) {
                    $results[] = ['poliza_id' => $pid, 'success' => false, 'error' => substr($e->getMessage(), 0, 300)];
                }
            }

            return response()->json([
                'success' => true,
                'message' => $async ? 'Jobs encolados' : 'Sincronización completada',
                'data' => ['async' => $async, 'results' => $results],
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            throw $e;
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error en sincronización masiva de detalle: ' . $e->getMessage(),
            ], 500);
        }
    }

    private function resolveInsurerConnectionForPoliza(Poliza $poliza, int $brokerId, ?int $insurerConnectionId): ?InsurerConnection
    {
        if ($insurerConnectionId) {
            $conn = InsurerConnection::where('id', $insurerConnectionId)->where('broker_id', $brokerId)->first();
            if (! $conn || ! $conn->microservice_session_id) {
                return null;
            }
            $expected = "{$conn->insurer_code}_sync";
            $src = $poliza->custom_fields['_sync_source'] ?? '';
            if ($src !== $expected) {
                return null;
            }

            return $conn;
        }

        $src = $poliza->custom_fields['_sync_source'] ?? '';
        if ($src === '' || ! str_ends_with($src, '_sync')) {
            return null;
        }
        $code = substr($src, 0, -strlen('_sync'));
        if ($code === '') {
            return null;
        }

        return InsurerConnection::query()
            ->where('broker_id', $brokerId)
            ->where('insurer_code', $code)
            ->whereNotNull('microservice_session_id')
            ->orderByDesc('connected_at')
            ->first();
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
                // Cliente: usar cliente_id o datos básicos (todos opcionales — se puede crear sin cliente)
                'cliente_id' => 'nullable|integer|exists:clientes,id',
                'nombres_cliente' => 'nullable|string|max:255',
                'apellidos_cliente' => 'nullable|string|max:255',
                'dni_cliente' => 'nullable|string|max:50',
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
                'cuotas' => 'nullable|integer|min:1',
                'numero_tarjeta' => ['nullable','string','max:32','regex:/^[0-9]{4,19}$/'],
                'cheque_number' => 'nullable|string|max:64',
                'agreement_term' => 'nullable|string|in:contado,30_45,30_60,60_90',
                'debit_account_number' => 'nullable|string|max:64',
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
                'beneficiarios' => 'nullable|array',
                'beneficiarios.*.nombre' => 'nullable|string|max:255',
                'beneficiarios.*.documento' => 'nullable|string|max:255',
                'beneficiarios.*.parentesco' => 'nullable|string|max:100',
                'beneficiarios.*.porcentaje' => 'nullable|numeric|min:0|max:100',

                // Tomador extra fields
                'policy_holder_name' => 'nullable|string|max:255',
                'policy_holder_document' => 'nullable|string|max:50',
                'policy_holder_doc_type' => 'nullable|string|max:10',
                'policy_holder_phone' => 'nullable|string|max:30',
                'policy_holder_email' => 'nullable|email|max:255',
                'policy_holder_address' => 'nullable|string|max:500',
                'policy_holder_city' => 'nullable|string|max:255',

                // Moneda
                'moneda' => 'nullable|string|max:10',

                // Pólizas colectivas
                'policy_category' => 'nullable|string|in:individual,colectiva,agrupadora,coaseguro',
                'oficina_radicacion' => 'nullable|string|max:255',
                'ciudad_expedicion' => 'nullable|string|max:255',

                // Campos SoftSeguros
                'clasificacion_poliza' => 'nullable|string|max:30',
                'periodicidad' => 'nullable|string|max:30',
                'soat' => 'nullable|boolean',
                'arl' => 'nullable|boolean',
                'colectiva' => 'nullable|boolean',
                'tipo_poliza' => 'nullable|string|max:30',
                // Comisiones detalladas
                'iva_comision' => 'nullable|numeric|min:0',
                'porcentaje_sobrecomision' => 'nullable|numeric|min:0|max:100',
                'sobrecomision' => 'nullable|numeric|min:0',
                'porcentaje_comision_vendedor' => 'nullable|numeric|min:0|max:100',
                'comision_vendedor' => 'nullable|numeric|min:0',
                'coinsurance_participation' => 'nullable|numeric|min:0|max:100',
                // Financiación
                'porcentaje_financiacion' => 'nullable|numeric|min:0|max:100',
                'valor_financiacion' => 'nullable|numeric|min:0',
                'total_poliza_financiada' => 'nullable|numeric|min:0',
                // Cartera / Recaudo
                'estado_cartera' => 'nullable|string|max:50',
                'recaudado' => 'nullable|boolean',
                'recaudado_en_oficina' => 'nullable|boolean',
                'fecha_recaudo' => 'nullable|date',
                // Impuestos
                'porcentaje_impuesto_bomberos' => 'nullable|numeric|min:0|max:100',
                'impuesto_bomberos' => 'nullable|numeric|min:0',
                // Moneda
                'tipo_moneda' => 'nullable|string|max:10',
                'tasa_cambio' => 'nullable|numeric|min:0',
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

            // Resolver cliente por cliente_id o crear/buscar por documento (puede ser null para pólizas sin cliente)
            $cliente = null;
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
            } elseif (!empty($validated['dni_cliente'])) {
                $cliente = Cliente::firstOrCreate([
                    'document_number' => $validated['dni_cliente'],
                    'broker_id' => $brokerId,
                ], [
                    'first_name' => $validated['nombres_cliente'] ?? 'Sin nombre',
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
            // Si no hay cliente, la póliza se crea sin cliente asignado

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
                } elseif ($fp === 'financiado' || $fp === 'fraccionado') {
                    $paymentMethod = 'financing';
                }
            }

            // Si fraccionado/financiado y no se especificó periodicidad, forzar monthly
            $paymentFrequency = $this->mapPaymentFrequencyFromFrontend($validated['periodicidad_pago'] ?? null);
            if (isset($validated['forma_pago'])) {
                $fp = strtolower((string)$validated['forma_pago']);
                if (($fp === 'fraccionado' || $fp === 'financiado') && (!isset($validated['periodicidad_pago']) || empty($validated['periodicidad_pago']))) {
                    $paymentFrequency = 'monthly';
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
                'client_name' => $cliente ? ($cliente->first_name . (empty($cliente->last_name) ? '' : (' ' . $cliente->last_name))) : ($validated['nombres_cliente'] ?? 'Sin cliente asignado'),
                'client_document' => $cliente?->document_number ?? ($validated['dni_cliente'] ?? null),
                'premium_amount' => $validated['prima_neta'],
                'commission_percentage' => $validated['porcentaje_comision'] ?? 0,
                'commission_amount' => $validated['comision'] ?? 0,
                'payment_frequency' => $paymentFrequency,
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
                'client_id' => $cliente?->id,
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
                'policy_holder_doc_type' => $validated['policy_holder_doc_type'] ?? null,
                'policy_holder_phone' => $validated['policy_holder_phone'] ?? null,
                'policy_holder_email' => $validated['policy_holder_email'] ?? null,
                'policy_holder_address' => $validated['policy_holder_address'] ?? null,
                'policy_holder_city' => $validated['policy_holder_city'] ?? null,
                'insured_name' => $validated['insured_name'] ?? null,
                'insured_document' => $validated['insured_document'] ?? null,
                
                'beneficiary_in_remittance' => $validated['beneficiario_en_remision'] ?? false,
                'beneficiaries' => $validated['beneficiarios'] ?? null,
                // Enlace externo
                'external_link' => $validated['enlace_externo'] ?? null,
                // Custom fields: sede, metadata de cliente + pólizas colectivas
                'custom_fields' => array_merge($customFields ?? [], [
                    'policy_category' => $validated['policy_category'] ?? 'individual',
                    'oficina_radicacion' => $validated['oficina_radicacion'] ?? null,
                    'ciudad_expedicion' => $validated['ciudad_expedicion'] ?? null,
                ]),

                // Campos SoftSeguros
                'clasificacion_poliza' => $validated['clasificacion_poliza'] ?? null,
                'periodicidad' => $validated['periodicidad'] ?? null,
                'soat' => $validated['soat'] ?? false,
                'arl' => $validated['arl'] ?? false,
                'colectiva' => $validated['colectiva'] ?? false,
                'tipo_poliza' => $validated['tipo_poliza'] ?? ($validated['policy_category'] ?? 'individual'),
                // Comisiones detalladas
                'iva_comision' => $validated['iva_comision'] ?? null,
                'porcentaje_sobrecomision' => $validated['porcentaje_sobrecomision'] ?? null,
                'sobrecomision' => $validated['sobrecomision'] ?? null,
                'porcentaje_comision_vendedor' => $validated['porcentaje_comision_vendedor'] ?? null,
                'comision_vendedor' => $validated['comision_vendedor'] ?? null,
                'coinsurance_participation' => $validated['coinsurance_participation'] ?? null,
                // Financiación
                'porcentaje_financiacion' => $validated['porcentaje_financiacion'] ?? null,
                'valor_financiacion' => $validated['valor_financiacion'] ?? null,
                'total_poliza_financiada' => $validated['total_poliza_financiada'] ?? null,
                // Cartera
                'estado_cartera' => $validated['estado_cartera'] ?? null,
                // Impuestos
                'porcentaje_impuesto_bomberos' => $validated['porcentaje_impuesto_bomberos'] ?? null,
                'impuesto_bomberos' => $validated['impuesto_bomberos'] ?? null,
                // Moneda
                'tipo_moneda' => $validated['tipo_moneda'] ?? null,
                'tasa_cambio' => $validated['tasa_cambio'] ?? null,
                
            ]);

            // Sincronizar automóviles por placas si aplica (ramo autos)
            if (!empty($validated['placas']) && $poliza->type === 'autos' && $cliente) {
                $this->syncAutomovilesForPoliza($poliza, $validated['placas'], $cliente->id);
            }

            // If total_amount is 0/null but premium_amount has value, auto-calculate
            if ((!$poliza->total_amount || (float)$poliza->total_amount <= 0) && (float)($poliza->premium_amount ?? 0) > 0) {
                $calculatedTotal = (float)$poliza->premium_amount + (float)($poliza->vat_amount ?? 0) + (float)($poliza->gastos_adicionales ?? 0);
                $poliza->update(['total_amount' => $calculatedTotal]);
                $poliza->refresh();
            }

            // Auto-create cartera_item(s) so the poliza appears in cartera immediately
            // For fraccionado/financiado with installments_count > 1, create N cuotas
            try {
                $montoTotal = ((float)($poliza->total_amount ?? 0) > 0)
                    ? (float)$poliza->total_amount
                    : ((float)($poliza->premium_amount ?? 0) + (float)($poliza->vat_amount ?? 0));
                $primaNeta = $poliza->premium_amount ?? 0;
                $comision = $poliza->commission_amount ?? 0;
                $clienteNombre = $cliente ? trim(($cliente->first_name ?? '') . ' ' . ($cliente->last_name ?? '')) : 'Sin cliente asignado';

                $fp = strtolower((string)($validated['forma_pago'] ?? ''));
                $numCuotas = (int)($poliza->installments_count ?? 0);
                $esFraccionado = in_array($fp, ['fraccionado', 'financiado']) && $numCuotas > 1;

                if ($esFraccionado) {
                    // Create N cartera_items (one per cuota) with staggered due dates
                    $montoCuota = round($montoTotal / $numCuotas, 2);
                    $primaNetaCuota = round($primaNeta / $numCuotas, 2);
                    $comisionCuota = round($comision / $numCuotas, 2);
                    $fechaInicio = $poliza->start_date ? \Carbon\Carbon::parse($poliza->start_date) : now();

                    // Determine interval in months from payment_frequency
                    $freqMeses = match($poliza->payment_frequency) {
                        'monthly' => 1,
                        'quarterly' => 3,
                        'semi-annual', 'semiannual' => 6,
                        'annual', 'yearly' => 12,
                        default => 1,
                    };

                    for ($i = 0; $i < $numCuotas; $i++) {
                        // Adjust last cuota to absorb rounding difference
                        $esCuotaFinal = ($i === $numCuotas - 1);
                        $montoCuotaActual = $esCuotaFinal ? ($montoTotal - $montoCuota * ($numCuotas - 1)) : $montoCuota;
                        $primaNetaCuotaActual = $esCuotaFinal ? ($primaNeta - $primaNetaCuota * ($numCuotas - 1)) : $primaNetaCuota;
                        $comisionCuotaActual = $esCuotaFinal ? ($comision - $comisionCuota * ($numCuotas - 1)) : $comisionCuota;

                        $fechaLimite = (clone $fechaInicio)->addMonths($freqMeses * $i);

                        DB::table('cartera_items')->insert([
                            'broker_id' => $brokerId,
                            'poliza_id' => $poliza->id,
                            'cliente_id' => $cliente?->id,
                            'poliza_numero' => $poliza->policy_number,
                            'cliente_nombre' => $clienteNombre,
                            'cliente_documento' => $cliente?->document_number,
                            'aseguradora_nombre' => $rowA->nombre ?? $validated['aseguradora'] ?? null,
                            'ramo_principal' => $rowR->nombre ?? $validated['ramo_principal'] ?? null,
                            'vendedor_nombre' => $validated['vendedor'] ?? null,
                            'forma_pago' => $validated['forma_pago'] ?? null,
                            'numero_pago' => ($i + 1) . '/' . $numCuotas,
                            'prima_neta' => $primaNetaCuotaActual,
                            'valor_neto_a_pagar' => max(0, $montoCuotaActual - $comisionCuotaActual),
                            'prima_total_pago' => $montoCuotaActual,
                            'prima_total' => $montoTotal,
                            'comision_a_recibir' => $comisionCuotaActual,
                            'comision_vendedor' => 0,
                            'estado_cartera' => 'por_cobrar',
                            'valor_recaudado_oficina' => 0,
                            'valor_pagado_aseguradora' => 0,
                            'saldo_pendiente_oficina' => $montoCuotaActual,
                            'saldo_pendiente_aseguradora' => 0,
                            'comision_recibida' => 0,
                            'dias_vencidos' => 0,
                            'fecha_limite_pago' => $fechaLimite->toDateString(),
                            'fecha_inicio_vigencia' => $poliza->start_date ?? null,
                            'fecha_fin_vigencia' => $poliza->end_date ?? null,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                } else {
                    // Single cartera_item for contado/credito or no installments
                    DB::table('cartera_items')->insert([
                        'broker_id' => $brokerId,
                        'poliza_id' => $poliza->id,
                        'cliente_id' => $cliente?->id,
                        'poliza_numero' => $poliza->policy_number,
                        'cliente_nombre' => $clienteNombre,
                        'cliente_documento' => $cliente?->document_number,
                        'aseguradora_nombre' => $rowA->nombre ?? $validated['aseguradora'] ?? null,
                        'ramo_principal' => $rowR->nombre ?? $validated['ramo_principal'] ?? null,
                        'vendedor_nombre' => $validated['vendedor'] ?? null,
                        'forma_pago' => $validated['forma_pago'] ?? null,
                        'prima_neta' => $primaNeta,
                        'valor_neto_a_pagar' => max(0, $montoTotal - $comision),
                        'prima_total_pago' => $montoTotal,
                        'prima_total' => $montoTotal,
                        'comision_a_recibir' => $comision,
                        'comision_vendedor' => 0,
                        'estado_cartera' => 'por_cobrar',
                        'valor_recaudado_oficina' => 0,
                        'valor_pagado_aseguradora' => 0,
                        'saldo_pendiente_oficina' => $montoTotal,
                        'saldo_pendiente_aseguradora' => 0,
                        'comision_recibida' => 0,
                        'dias_vencidos' => 0,
                        'fecha_inicio_vigencia' => $poliza->start_date ?? null,
                        'fecha_fin_vigencia' => $poliza->end_date ?? null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            } catch (\Throwable $e) {
                \Log::warning("Auto-create cartera_item failed for poliza {$poliza->id}: " . $e->getMessage());
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
                'message' => 'Hay datos faltantes o inválidos. Revisa los campos marcados.',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Error al crear póliza: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json([
                'success' => false,
                'message' => 'No se pudo crear la póliza. Inténtalo de nuevo.',
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
                'cuotas' => 'nullable|integer|min:1',
                'numero_tarjeta' => ['nullable','string','max:32','regex:/^[0-9]{4,19}$/'],
                'cheque_number' => 'nullable|string|max:64',
                'agreement_term' => 'nullable|string|in:contado,30_45,30_60,60_90',
                'debit_account_number' => 'nullable|string|max:64',
                // Tomador / Asegurado
                'policy_holder_name' => 'nullable|string|max:255',
                'policy_holder_document' => 'nullable|string|max:100',
                'policy_holder_doc_type' => 'nullable|string|max:10',
                'policy_holder_phone' => 'nullable|string|max:30',
                'policy_holder_email' => 'nullable|email|max:255',
                'policy_holder_address' => 'nullable|string|max:500',
                'policy_holder_city' => 'nullable|string|max:255',
                'insured_name' => 'nullable|string|max:255',
                'insured_document' => 'nullable|string|max:100',
                // Moneda
                'moneda' => 'nullable|string|max:10',
                // Pólizas colectivas
                'policy_category' => 'nullable|string|in:individual,colectiva,agrupadora,coaseguro',
                'oficina_radicacion' => 'nullable|string|max:255',
                'ciudad_expedicion' => 'nullable|string|max:255',
                // Placas (edición)
                'placas' => 'nullable|array',
                'placas.*' => ['nullable','string','max:20','regex:/^[A-Za-z0-9-]{3,20}$/'],
                'renovable' => 'nullable|boolean',

                // Campos SoftSeguros
                'clasificacion_poliza' => 'nullable|string|max:30',
                'periodicidad' => 'nullable|string|max:30',
                'soat' => 'nullable|boolean',
                'arl' => 'nullable|boolean',
                'colectiva' => 'nullable|boolean',
                'tipo_poliza' => 'nullable|string|max:30',
                'iva_comision' => 'nullable|numeric|min:0',
                'porcentaje_sobrecomision' => 'nullable|numeric|min:0|max:100',
                'sobrecomision' => 'nullable|numeric|min:0',
                'porcentaje_comision_vendedor' => 'nullable|numeric|min:0|max:100',
                'comision_vendedor' => 'nullable|numeric|min:0',
                'coinsurance_participation' => 'nullable|numeric|min:0|max:100',
                'porcentaje_financiacion' => 'nullable|numeric|min:0|max:100',
                'valor_financiacion' => 'nullable|numeric|min:0',
                'total_poliza_financiada' => 'nullable|numeric|min:0',
                'estado_cartera' => 'nullable|string|max:50',
                'cartera_pagado_oficina' => 'nullable|boolean',
                'cartera_pagado_aseguradora' => 'nullable|boolean',
                'porcentaje_impuesto_bomberos' => 'nullable|numeric|min:0|max:100',
                'impuesto_bomberos' => 'nullable|numeric|min:0',
                'tipo_moneda' => 'nullable|string|max:10',
                'tasa_cambio' => 'nullable|numeric|min:0',

                'vendedor' => 'nullable|string|max:255',
                'observaciones' => 'nullable|string',
                'observaciones_internas' => 'nullable|string',
                'fecha_expedicion' => 'sometimes|required|date',
                'fecha_inicio' => 'sometimes|required|date',
                'fecha_fin' => 'sometimes|required|date',
                'estado' => 'nullable|in:ACTIVA,VENCIDA,CANCELADA,SUSPENDIDA,COTIZACION,DEVENGADA,EXPEDICION,NO_RENOVADA,PENDIENTE,COTIZACIÓN,EXPEDICIÓN,VIGENTE',
                'cancellation_reason' => 'nullable|string|max:100',
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
                'beneficiarios' => 'nullable|array',
                'beneficiarios.*.nombre' => 'nullable|string|max:255',
                'beneficiarios.*.documento' => 'nullable|string|max:255',
                'beneficiarios.*.parentesco' => 'nullable|string|max:100',
                'beneficiarios.*.porcentaje' => 'nullable|numeric|min:0|max:100',
                
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
                } elseif ($fp === 'financiado' || $fp === 'fraccionado') {
                    $updateData['payment_method'] = 'financing';
                }
                // Fraccionado/financiado sin periodicidad → monthly
                if (($fp === 'fraccionado' || $fp === 'financiado') && (!isset($validated['periodicidad_pago']) || empty($validated['periodicidad_pago']))) {
                    $updateData['payment_frequency'] = 'monthly';
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
            if (isset($validated['policy_holder_doc_type'])) {
                $updateData['policy_holder_doc_type'] = $validated['policy_holder_doc_type'];
            }
            if (isset($validated['policy_holder_phone'])) {
                $updateData['policy_holder_phone'] = $validated['policy_holder_phone'];
            }
            if (isset($validated['policy_holder_email'])) {
                $updateData['policy_holder_email'] = $validated['policy_holder_email'];
            }
            if (isset($validated['policy_holder_address'])) {
                $updateData['policy_holder_address'] = $validated['policy_holder_address'];
            }
            if (isset($validated['policy_holder_city'])) {
                $updateData['policy_holder_city'] = $validated['policy_holder_city'];
            }
            if (isset($validated['insured_name'])) {
                $updateData['insured_name'] = $validated['insured_name'];
            }
            if (isset($validated['insured_document'])) {
                $updateData['insured_document'] = $validated['insured_document'];
            }
            // Pólizas colectivas → guardar en custom_fields + sincronizar columnas DB
            $colectivaFields = [];
            if (isset($validated['policy_category'])) {
                $colectivaFields['policy_category'] = $validated['policy_category'];
                $updateData['colectiva'] = $validated['policy_category'] === 'colectiva';
                $updateData['tipo_poliza'] = $validated['policy_category'];
            }
            if (isset($validated['oficina_radicacion'])) {
                $colectivaFields['oficina_radicacion'] = $validated['oficina_radicacion'];
            }
            if (isset($validated['ciudad_expedicion'])) {
                $colectivaFields['ciudad_expedicion'] = $validated['ciudad_expedicion'];
            }
            if (!empty($colectivaFields)) {
                $existing = is_array($poliza->custom_fields) ? $poliza->custom_fields : [];
                $updateData['custom_fields'] = array_merge($existing, $colectivaFields);
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
                $updateData['beneficiary_name'] = $validated['beneficiario_oneroso_nombre'] ?? null;
                $updateData['beneficiary_document'] = $validated['beneficiario_oneroso_documento'] ?? null;
                $updateData['beneficiary_relationship'] = null;
            }
            // Beneficiarios array (múltiples)
            if (array_key_exists('beneficiarios', $validated)) {
                $updateData['beneficiaries'] = $validated['beneficiarios'];
            }
            // Actualizar custom_fields (sede y metadatos del cliente)
            // IMPORTANTE: usar $updateData['custom_fields'] si ya fue modificado por colectivaFields arriba
            $__cf = isset($updateData['custom_fields']) && is_array($updateData['custom_fields'])
                ? $updateData['custom_fields']
                : (is_array($poliza->custom_fields) ? $poliza->custom_fields : (json_decode($poliza->custom_fields ?? '[]', true) ?: []));
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
                $nuevoStatus = $this->mapStatusFromFrontend($validated['estado']);
                $updateData['status'] = $nuevoStatus;
                
                // Si cambia a CANCELADA, registrar auditoría de cancelación
                if ($nuevoStatus === 'cancelled' && $poliza->status !== 'cancelled') {
                    $updateData['cancelled_at'] = now();
                    $updateData['cancelled_by'] = optional($request->user())->id;
                    $updateData['cancellation_reason'] = $validated['cancellation_reason'] ?? null;
                } elseif (isset($validated['cancellation_reason']) && $nuevoStatus === 'cancelled') {
                    // Permitir actualizar el motivo aunque ya esté cancelada
                    $updateData['cancellation_reason'] = $validated['cancellation_reason'];
                }
            }
            // Fecha de recepción (administrativa)
            if (isset($validated['fecha_recepcion'])) {
                $updateData['reception_date'] = $validated['fecha_recepcion'];
            }
            // Campos SoftSeguros en update
            $softFields = [
                'clasificacion_poliza', 'periodicidad', 'tipo_poliza',
                'estado_cartera', 'tipo_moneda',
            ];
            foreach ($softFields as $sf) {
                if (isset($validated[$sf])) { $updateData[$sf] = $validated[$sf]; }
            }
            $softBooleans = ['soat', 'arl', 'colectiva'];
            foreach ($softBooleans as $sb) {
                if (array_key_exists($sb, $validated)) { $updateData[$sb] = (bool) $validated[$sb]; }
            }
            $softDecimals = [
                'iva_comision', 'porcentaje_sobrecomision', 'sobrecomision',
                'porcentaje_comision_vendedor', 'comision_vendedor', 'coinsurance_participation',
                'porcentaje_financiacion', 'valor_financiacion', 'total_poliza_financiada',
                'porcentaje_impuesto_bomberos', 'impuesto_bomberos', 'tasa_cambio',
            ];
            foreach ($softDecimals as $sd) {
                if (isset($validated[$sd])) { $updateData[$sd] = $validated[$sd]; }
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

            // Sync cartera_items when financial or key fields change
            $carteraFields = [
                'premium_amount', 'vat_amount', 'total_amount', 'commission_amount',
                'commission_percentage', 'payment_frequency', 'start_date', 'end_date',
                'installments_count', 'status', 'policy_number', 'client_name',
                'client_document', 'insurance_company', 'aseguradora_id', 'seller_name',
            ];
            if (!empty(array_intersect($carteraFields, array_keys($updateData)))) {
                try {
                    $poliza->refresh();

                    // Auto-calculate total_amount if 0/null but premium exists
                    if ((!$poliza->total_amount || (float)$poliza->total_amount <= 0) && (float)($poliza->premium_amount ?? 0) > 0) {
                        $calculatedTotal = (float)$poliza->premium_amount + (float)($poliza->vat_amount ?? 0) + (float)($poliza->gastos_adicionales ?? 0);
                        $poliza->update(['total_amount' => $calculatedTotal]);
                        $poliza->refresh();
                    }

                    $montoTotal = ((float)($poliza->total_amount ?? 0) > 0)
                        ? (float)$poliza->total_amount
                        : ((float)($poliza->premium_amount ?? 0) + (float)($poliza->vat_amount ?? 0));
                    $comision = $poliza->commission_amount ?? 0;

                    // Scope payment queries to the current renovation period
                    $currentRenovacion = (int) ($poliza->numero_renovacion ?? 0);

                    // Get current payment totals from pagos_polizas — scoped by numero_renovacion
                    $totalOficina = (float) DB::table('pagos_polizas')
                        ->where('poliza_id', $poliza->id)
                        ->where('numero_renovacion', $currentRenovacion)
                        ->where('tipo_recaudo', 'oficina')->sum('monto_pagado');
                    $totalAseg = (float) DB::table('pagos_polizas')
                        ->where('poliza_id', $poliza->id)
                        ->where('numero_renovacion', $currentRenovacion)
                        ->where('tipo_recaudo', 'aseguradora')
                        ->where('estado', 'pagado')->sum('monto_pagado');
                    $totalComision = (float) DB::table('cobros_comisiones')
                        ->where('poliza_id', $poliza->id)
                        ->where('numero_renovacion', $currentRenovacion)
                        ->sum('monto_cobrado');

                    $valorNeto = max(0, $montoTotal - $comision);

                    // Determine if office collection is complete or partial
                    $saldoPendienteOf = max(0, $montoTotal - $totalOficina);
                    $recaudadoEnOficina = $totalOficina > 0 && $saldoPendienteOf <= 0;

                    // Determine estado_cartera
                    $estadoCartera = 'por_cobrar';
                    if ($totalComision > 0) {
                        $estadoCartera = 'comision_recibida';
                    } elseif ($totalAseg > 0) {
                        $estadoCartera = 'comision_por_cobrar';
                    } elseif ($recaudadoEnOficina) {
                        $estadoCartera = 'por_pagar';
                    }

                    // Resolve display names
                    $clienteNombre = $poliza->client_name;
                    $clienteDoc = $poliza->client_document;
                    if ($poliza->client_id) {
                        $cli = DB::table('clientes')->find($poliza->client_id, ['first_name','last_name','document_number']);
                        if ($cli) {
                            $clienteNombre = trim(($cli->first_name ?? '') . ' ' . ($cli->last_name ?? ''));
                            $clienteDoc = $cli->document_number;
                        }
                    }
                    $asegNombre = $poliza->insurance_company;
                    if ($poliza->aseguradora_id) {
                        $aseg = DB::table('aseguradoras')->find($poliza->aseguradora_id, ['nombre']);
                        if ($aseg) $asegNombre = $aseg->nombre;
                    }
                    $ramoNombre = null;
                    if ($poliza->ramo_id) {
                        $ramo = DB::table('ramos')->find($poliza->ramo_id, ['nombre']);
                        if ($ramo) $ramoNombre = $ramo->nombre;
                    }

                    // Metadata fields safe to update on ALL items (don't affect financial values)
                    $metadataUpdate = [
                        'poliza_numero' => $poliza->policy_number,
                        'cliente_nombre' => $clienteNombre,
                        'cliente_documento' => $clienteDoc,
                        'aseguradora_nombre' => $asegNombre,
                        'ramo_principal' => $ramoNombre,
                        'vendedor_nombre' => $poliza->seller_name,
                        'fecha_inicio_vigencia' => $poliza->start_date,
                        'fecha_fin_vigencia' => $poliza->end_date,
                        'updated_at' => now(),
                    ];

                    // Determine effective renovacion (R=0 fallback for SS imports)
                    $effectiveRenovacion = $currentRenovacion;
                    $countCurrent = DB::table('cartera_items')
                        ->where('poliza_id', $poliza->id)
                        ->where('broker_id', $brokerId)
                        ->where('numero_renovacion', $currentRenovacion)
                        ->count();
                    if ($countCurrent === 0 && $currentRenovacion > 0) {
                        $countR0 = DB::table('cartera_items')
                            ->where('poliza_id', $poliza->id)
                            ->where('broker_id', $brokerId)
                            ->where('numero_renovacion', 0)
                            ->count();
                        if ($countR0 > 0) {
                            $effectiveRenovacion = 0;
                        }
                    }

                    // Check if this poliza has multiple SS-imported items (cuotas/anexos)
                    $ssItemCount = DB::table('cartera_items')
                        ->where('poliza_id', $poliza->id)
                        ->where('broker_id', $brokerId)
                        ->where('numero_renovacion', $effectiveRenovacion)
                        ->whereNotNull('softseguros_pago_id')
                        ->count();

                    if ($ssItemCount > 1) {
                        // MULTI-ITEM: Only update metadata, preserve each item's own financial values
                        $updated = DB::table('cartera_items')
                            ->where('poliza_id', $poliza->id)
                            ->where('broker_id', $brokerId)
                            ->where('numero_renovacion', $effectiveRenovacion)
                            ->update($metadataUpdate);
                    } else {
                        // SINGLE-ITEM or GURO-ONLY: Full update including financial recalculation
                        $fullUpdate = array_merge($metadataUpdate, [
                            'prima_neta' => $poliza->premium_amount ?? 0,
                            'valor_neto_a_pagar' => $valorNeto,
                            'prima_total_pago' => $montoTotal,
                            'prima_total' => $montoTotal,
                            'comision_a_recibir' => $comision,
                            'estado_cartera' => $estadoCartera,
                            'valor_recaudado_oficina' => $totalOficina,
                            'valor_pagado_aseguradora' => $totalAseg,
                            'saldo_pendiente_oficina' => max(0, $montoTotal - $totalOficina),
                            'saldo_pendiente_aseguradora' => $recaudadoEnOficina ? max(0, $valorNeto - $totalAseg) : 0,
                            'comision_recibida' => $totalComision,
                        ]);

                        $updated = DB::table('cartera_items')
                            ->where('poliza_id', $poliza->id)
                            ->where('broker_id', $brokerId)
                            ->where('numero_renovacion', $currentRenovacion)
                            ->update($fullUpdate);

                        // If no cartera_item exists for this renovation, try R=0 fallback (SoftSeguros imports)
                        if ($updated === 0 && $currentRenovacion > 0) {
                            $updated = DB::table('cartera_items')
                                ->where('poliza_id', $poliza->id)
                                ->where('broker_id', $brokerId)
                                ->where('numero_renovacion', 0)
                                ->update(array_merge($fullUpdate, ['numero_renovacion' => $currentRenovacion]));
                        }

                        // If still no cartera_item exists, create one
                        if ($updated === 0) {
                            DB::table('cartera_items')->insert(array_merge($fullUpdate, [
                                'broker_id' => $brokerId,
                                'poliza_id' => $poliza->id,
                                'numero_renovacion' => $currentRenovacion,
                                'cliente_id' => $poliza->client_id,
                                'comision_vendedor' => 0,
                                'dias_vencidos' => 0,
                                'created_at' => now(),
                            ]));
                        }
                    }
                } catch (\Throwable $e) {
                    \Log::warning("Cartera sync on poliza update failed for poliza {$poliza->id}: " . $e->getMessage());
                }
            }

            // Si se marcó estado_cartera = "Pagado": generar el recaudo según el
            // tipo elegido por el usuario (oficina XOR aseguradora). Son mutuamente excluyentes.
            $marcarOficina = $request->boolean('cartera_pagado_oficina');
            $marcarAseguradora = $request->boolean('cartera_pagado_aseguradora');
            $esPagado = isset($updateData['estado_cartera'])
                && is_string($updateData['estado_cartera'])
                && strcasecmp(trim($updateData['estado_cartera']), 'Pagado') === 0;

            if ($esPagado && ($marcarOficina || $marcarAseguradora)) {
                // Si llegan ambos por error, priorizar aseguradora (pago directo = cuota fully paid)
                if ($marcarOficina && $marcarAseguradora) {
                    $marcarOficina = false;
                }
                try {
                    $pagoCtrl = app(\App\Http\Controllers\Api\PagoPolizaController::class);
                    $fakeReq = new Request([
                        'fecha' => now()->toDateString(),
                        'metodo_pago' => 'efectivo',
                        'observaciones' => 'Recaudo automático (cartera marcada como Pagado)',
                        'oficina' => $marcarOficina,
                        'aseguradora' => $marcarAseguradora,
                    ]);
                    $pagoCtrl->marcarPolizaPagada($fakeReq, $poliza->id);
                    \Log::info("Recaudo automático generado", [
                        'poliza_id' => $poliza->id,
                        'tipo' => $marcarOficina ? 'oficina' : 'aseguradora',
                    ]);
                } catch (\Throwable $e) {
                    \Log::warning("Marcar póliza pagada falló para poliza {$poliza->id}: " . $e->getMessage());
                }
            } elseif ($esPagado) {
                \Log::info("Cartera marcada Pagado sin tipo de recaudo (no se generan pagos)", [
                    'poliza_id' => $poliza->id,
                ]);
            }

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
                'message' => 'Hay datos faltantes o inválidos. Revisa los campos marcados.',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Error al actualizar póliza: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json([
                'success' => false,
                'message' => 'No se pudo actualizar la póliza. Inténtalo de nuevo.',
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
     * Bulk delete polizas – supports delete_all or selective ids
     */
    public function bulkDelete(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $deleteAll = $request->input('delete_all', false);
            $polizaIds = $request->input('ids', []);

            \Log::info('🗑️ [POLIZAS BULK DELETE] Iniciando', [
                'broker_id' => $brokerId,
                'delete_all' => $deleteAll,
                'ids_count' => count($polizaIds),
            ]);

            $deletedCount = 0;

            DB::beginTransaction();

            try {
                $query = Poliza::where('broker_id', $brokerId);

                if ($deleteAll) {
                    // nothing extra
                } elseif (!empty($polizaIds)) {
                    $query->whereIn('id', $polizaIds);
                } else {
                    return response()->json([
                        'success' => false,
                        'message' => 'Debe especificar los IDs de pólizas a eliminar o activar delete_all',
                    ], 400);
                }

                $ids = $query->pluck('id')->toArray();
                $deletedCount = count($ids);

                if ($deletedCount > 0) {
                    // Clean up related data
                    DB::table('cartera_items')->whereIn('poliza_id', $ids)->delete();
                    DB::table('recibos_caja')
                        ->whereIn('poliza_id', $ids)
                        ->where('recibo_anulado', false)
                        ->update([
                            'recibo_anulado' => true,
                            'fecha_recibo_anulado' => now(),
                            'observaciones' => DB::raw("CONCAT(COALESCE(observaciones, ''), ' | Anulado por eliminación masiva de pólizas')"),
                            'activo' => false,
                        ]);
                    DB::table('pagos_polizas')->whereIn('poliza_id', $ids)->delete();

                    Poliza::whereIn('id', $ids)->delete();
                }

                DB::commit();

                \Log::info('✅ [POLIZAS BULK DELETE] Completado', [
                    'broker_id' => $brokerId,
                    'deleted_count' => $deletedCount,
                ]);

                return response()->json([
                    'success' => true,
                    'message' => "Se eliminaron {$deletedCount} pólizas exitosamente",
                    'deleted_count' => $deletedCount,
                ]);
            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }
        } catch (\Exception $e) {
            \Log::error('❌ [POLIZAS BULK DELETE] Error', [
                'message' => $e->getMessage(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'No se pudieron eliminar las pólizas. Inténtalo de nuevo.',
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

            // Clean up cartera_items for deleted poliza
            DB::table('cartera_items')->where('poliza_id', $poliza->id)->delete();

            // Anular recibos de caja asociados
            DB::table('recibos_caja')
                ->where('poliza_id', $poliza->id)
                ->where('recibo_anulado', false)
                ->update([
                    'recibo_anulado' => true,
                    'fecha_recibo_anulado' => now(),
                    'observaciones' => DB::raw("CONCAT(COALESCE(observaciones, ''), ' | Anulado por eliminación de póliza')"),
                    'activo' => false,
                ]);

            // Eliminar pagos asociados
            DB::table('pagos_polizas')
                ->where('poliza_id', $poliza->id)
                ->delete();

            $this->logPolizaAction($request, 'eliminar', $poliza, 200);

            return response()->json([
                'success' => true,
                'message' => 'Póliza eliminada exitosamente',
            ]);

        } catch (\Exception $e) {
            \Log::error('Error al eliminar póliza: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json([
                'success' => false,
                'message' => 'No se pudo eliminar la póliza. Inténtalo de nuevo.',
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
                'motivo' => 'nullable|string|max:500',
                'cancellation_reason' => 'nullable|string|max:100',
            ]);

            $estadoAnterior = $this->mapStatusToFrontend($poliza->status);
            $nuevoEstado = $this->mapStatusFromFrontend($validated['estado']);

            $updatePayload = [
                'status' => $nuevoEstado,
                'status_notes' => $validated['motivo'] ?? null,
            ];
            // Si el nuevo estado es CANCELADA, registrar auditoría completa
            if ($nuevoEstado === 'cancelled') {
                $updatePayload['cancelled_at'] = now();
                $updatePayload['cancelled_by'] = optional($request->user())->id;
                $updatePayload['cancellation_reason'] = $validated['cancellation_reason']
                    ?? $validated['motivo']
                    ?? null;
            }

            $poliza->update($updatePayload);

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
                'message' => 'Hay datos faltantes o inválidos. Revisa los campos marcados.',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Error al cambiar estado de póliza: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json([
                'success' => false,
                'message' => 'No se pudo cambiar el estado de la póliza. Inténtalo de nuevo.',
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
            'renewed' => 'RENOVADA'
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
            'RENOVADA' => 'renewed',
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
     * Resolve forma_pago for a poliza.
     * SS-imported polizas store the real forma_pago in custom_fields (Fraccionado/Financiado/Contado).
     * This takes priority over the generic payment_method mapping.
     */
    private function resolveFormaPago($poliza): string
    {
        $cf = is_array($poliza->custom_fields) ? $poliza->custom_fields : (is_string($poliza->custom_fields) ? json_decode($poliza->custom_fields, true) : []);
        $ssFormaPago = $cf['forma_pago'] ?? null;

        if ($ssFormaPago) {
            $lower = strtolower(trim($ssFormaPago));
            $map = [
                'fraccionado' => 'fraccionado',
                'financiado' => 'financiado',
                'contado' => 'contado',
                'credito' => 'credito',
                'crédito' => 'credito',
            ];
            return $map[$lower] ?? $lower;
        }

        return $this->mapPaymentMethodToFormaPagoCode($poliza->payment_method);
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
                'message' => 'Hay datos faltantes o inválidos. Revisa los campos marcados.',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Error al registrar contacto de póliza: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json([
                'success' => false,
                'message' => 'No se pudo registrar el contacto. Inténtalo de nuevo.'
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
                'nuevoNumeroPoliza' => 'nullable|string|min:3|max:255',
                'nuevaAseguradora' => 'nullable|integer|exists:aseguradoras,id',
                'nuevoRamoId' => 'nullable|integer|exists:ramos,id',
                'porcentajeIva' => 'nullable|numeric|min:0|max:100',
                'iva' => 'nullable|numeric|min:0',
                'gastosAdicionales' => 'nullable|numeric|min:0',
                'total' => 'nullable|numeric|min:0',
            ]);

            // Determine effective ramo_id and aseguradora_id for the new poliza
            $newRamoId = !empty($validated['nuevoRamoId']) ? (int)$validated['nuevoRamoId'] : $polizaOriginal->ramo_id;
            $newAseguradoraId = !empty($validated['nuevaAseguradora']) ? (int)$validated['nuevaAseguradora'] : $polizaOriginal->aseguradora_id;

            // Look up configured commission from comisiones_aseguradoras
            $commissionPercentage = $polizaOriginal->commission_percentage;
            if ($newRamoId && $newAseguradoraId) {
                $comisionConfig = DB::table('comisiones_aseguradoras')
                    ->where('ramo_id', $newRamoId)
                    ->where('aseguradora_id', $newAseguradoraId)
                    ->first();
                if ($comisionConfig) {
                    $commissionPercentage = (float) $comisionConfig->porcentaje_comision;
                }
            }
            $commissionAmount = ($validated['nuevoValorPrima'] * $commissionPercentage) / 100;

            // Financial fields from frontend (or defaults from original poliza)
            $vatPercentage = $validated['porcentajeIva'] ?? $polizaOriginal->vat_percentage ?? 19;
            $vatAmount = $validated['iva'] ?? round(($validated['nuevoValorPrima'] * $vatPercentage) / 100, 2);
            $additionalExpenses = $validated['gastosAdicionales'] ?? $polizaOriginal->gastos_adicionales ?? 0;
            $totalAmount = $validated['total'] ?? ($validated['nuevoValorPrima'] + $vatAmount + $additionalExpenses);

            // Update insurance_company name if aseguradora changed
            $insuranceCompany = $polizaOriginal->insurance_company;
            if (!empty($validated['nuevaAseguradora'])) {
                $newAseg = \App\Models\Aseguradora::find($newAseguradoraId);
                if ($newAseg) $insuranceCompany = $newAseg->nombre;
            }

            // Update product_name if ramo changed
            $productName = $polizaOriginal->product_name;
            if (!empty($validated['nuevoRamoId'])) {
                $newRamo = \App\Models\Ramo::find($newRamoId);
                if ($newRamo) $productName = $newRamo->nombre;
            }

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

            // Snapshot of current poliza values before renovation
            $snapshot = [
                'premium_amount' => (float) $polizaOriginal->premium_amount,
                'commission_percentage' => (float) $polizaOriginal->commission_percentage,
                'commission_amount' => (float) $polizaOriginal->commission_amount,
                'start_date' => $polizaOriginal->start_date ? $polizaOriginal->start_date->format('Y-m-d') : null,
                'end_date' => $polizaOriginal->end_date ? $polizaOriginal->end_date->format('Y-m-d') : null,
                'insurance_company' => $polizaOriginal->insurance_company,
                'product_name' => $polizaOriginal->product_name,
                'ramo_id' => $polizaOriginal->ramo_id,
                'aseguradora_id' => $polizaOriginal->aseguradora_id,
                'status' => $polizaOriginal->status,
                'numero_renovacion' => (int) ($polizaOriginal->numero_renovacion ?? 0),
            ];

            $nuevaFechaInicio = Carbon::parse($validated['nuevaFechaVencimiento'])->subYear();
            $observacionesSanitizadas = strip_tags($validated['observaciones'] ?? '');
            $cambioNumeroPoliza = !empty($validated['nuevoNumeroPoliza']) && $validated['nuevoNumeroPoliza'] !== $polizaOriginal->policy_number;

            DB::beginTransaction();

            // Count previous renewals from history for this chain
            $previousRenewals = 0;
            if (Schema::hasTable('renewal_history')) {
                $previousRenewals = RenewalHistory::where('poliza_id', $polizaOriginal->id)
                    ->where('action_type', 'renewal_processed')
                    ->count();
            }
            $currentRenovacion = (int) ($polizaOriginal->numero_renovacion ?? $previousRenewals);

            try {
                if ($cambioNumeroPoliza) {
                    // ── MODO A: Nuevo número de póliza → crear nueva póliza, marcar anterior como RENOVADA ──
                    $polizaOriginal->update([
                        'status' => 'renewed',
                        'status_notes' => 'Póliza renovada con cambio de número/aseguradora el ' . now()->toDateString() . '. Nueva póliza: ' . $validated['nuevoNumeroPoliza'],
                        'updated_at' => now(),
                    ]);

                    $nuevaPoliza = Poliza::create([
                        'policy_number' => $validated['nuevoNumeroPoliza'],
                        'description' => $polizaOriginal->description,
                        'insured_amount' => $polizaOriginal->insured_amount,
                        'insurance_company' => $insuranceCompany,
                        'type' => $polizaOriginal->type,
                        'product_name' => $productName,
                        'client_name' => $polizaOriginal->client_name,
                        'client_document' => $polizaOriginal->client_document,
                        'client_id' => $polizaOriginal->client_id,
                        'premium_amount' => $validated['nuevoValorPrima'],
                        'vat_percentage' => $vatPercentage,
                        'vat_amount' => $vatAmount,
                        'gastos_adicionales' => $additionalExpenses,
                        'total_amount' => $totalAmount,
                        'commission_percentage' => $commissionPercentage,
                        'commission_amount' => $commissionAmount,
                        'issue_date' => now()->toDateString(),
                        'start_date' => $nuevaFechaInicio->toDateString(),
                        'end_date' => $validated['nuevaFechaVencimiento'],
                        'status' => 'active',
                        'payment_frequency' => $polizaOriginal->payment_frequency,
                        'payment_method' => $polizaOriginal->payment_method,
                        'notes' => json_encode([
                            'renovacion_de' => $polizaOriginal->id,
                            'numero_poliza_anterior' => $polizaOriginal->policy_number,
                            'aseguradora_anterior' => $polizaOriginal->insurance_company,
                            'ramo_anterior' => $polizaOriginal->product_name,
                            'observaciones_renovacion' => $observacionesSanitizadas ?: 'Renovación procesada con cambio de número/aseguradora',
                            'fecha_procesamiento' => now()->toDateTimeString(),
                        ]),
                        'broker_id' => $brokerId,
                        'assigned_user_id' => $user ? $user->id : $polizaOriginal->assigned_user_id,
                        'ramo_id' => $newRamoId,
                        'aseguradora_id' => $newAseguradoraId,
                        'auto_renewal' => $polizaOriginal->auto_renewal,
                        'numero_renovacion' => $currentRenovacion + 1,
                        'is_renewal' => true,
                    ]);

                    $resultPoliza = $nuevaPoliza;
                    $resultMode = 'new_poliza';
                } else {
                    // ── MODO B: Mismo número → actualizar póliza en sitio ──
                    $polizaOriginal->update([
                        'premium_amount' => $validated['nuevoValorPrima'],
                        'vat_percentage' => $vatPercentage,
                        'vat_amount' => $vatAmount,
                        'gastos_adicionales' => $additionalExpenses,
                        'total_amount' => $totalAmount,
                        'commission_percentage' => $commissionPercentage,
                        'commission_amount' => $commissionAmount,
                        'start_date' => $nuevaFechaInicio->toDateString(),
                        'end_date' => $validated['nuevaFechaVencimiento'],
                        'issue_date' => now()->toDateString(),
                        'insurance_company' => $insuranceCompany,
                        'product_name' => $productName,
                        'ramo_id' => $newRamoId,
                        'aseguradora_id' => $newAseguradoraId,
                        'status' => 'active',
                        'status_notes' => null,
                        'numero_renovacion' => $currentRenovacion + 1,
                        'is_renewal' => true,
                        'updated_at' => now(),
                    ]);

                    $resultPoliza = $polizaOriginal->fresh();
                    $resultMode = 'updated';
                }

                // Actualizar estadísticas del cliente si existe
                if ($polizaOriginal->client) {
                    $polizaOriginal->client->updatePolicyCounters();
                }

                DB::commit();

                // ── Crear nuevo cartera_item para el nuevo período de renovación ──
                try {
                    $newRenovacion = $resultPoliza->numero_renovacion ?? ($currentRenovacion + 1);
                    $montoTotalPoliza = $totalAmount ?: ($validated['nuevoValorPrima'] + $vatAmount);
                    $comisionPoliza = $commissionAmount;

                    // Get client info
                    $cliente = $resultPoliza->client;
                    $clienteNombre = $cliente
                        ? trim(($cliente->first_name ?? '') . ' ' . ($cliente->last_name ?? ''))
                        : ($resultPoliza->client_name ?? '');

                    DB::table('cartera_items')->insert([
                        'broker_id' => $brokerId,
                        'poliza_id' => $resultPoliza->id,
                        'numero_renovacion' => $newRenovacion,
                        'cliente_id' => $resultPoliza->client_id,
                        'poliza_numero' => $resultPoliza->policy_number,
                        'cliente_nombre' => $clienteNombre,
                        'cliente_documento' => $cliente->document_number ?? ($resultPoliza->client_document ?? null),
                        'aseguradora_nombre' => $insuranceCompany,
                        'ramo_principal' => $productName,
                        'vendedor_nombre' => $resultPoliza->seller_name ?? null,
                        'forma_pago' => $resultPoliza->payment_frequency ?? null,
                        'prima_neta' => $validated['nuevoValorPrima'],
                        'valor_neto_a_pagar' => max(0, $montoTotalPoliza - $comisionPoliza),
                        'prima_total_pago' => $montoTotalPoliza,
                        'prima_total' => $montoTotalPoliza,
                        'comision_a_recibir' => $comisionPoliza,
                        'comision_vendedor' => 0,
                        'estado_cartera' => 'por_cobrar',
                        'valor_recaudado_oficina' => 0,
                        'valor_pagado_aseguradora' => 0,
                        'saldo_pendiente_oficina' => $montoTotalPoliza,
                        'saldo_pendiente_aseguradora' => 0,
                        'comision_recibida' => 0,
                        'dias_vencidos' => 0,
                        'fecha_inicio_vigencia' => $resultPoliza->start_date,
                        'fecha_fin_vigencia' => $resultPoliza->end_date,
                        'porcentaje_comision' => $commissionPercentage > 0 ? ($commissionPercentage / 100) : null,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);

                    \Log::info("Cartera item creado para renovación #{$newRenovacion} de póliza {$resultPoliza->policy_number}");
                } catch (\Throwable $e) {
                    \Log::warning("No se pudo crear cartera_item para renovación: " . $e->getMessage());
                }

                // Log
                \Log::info("Renovación procesada ({$resultMode}) para póliza {$polizaOriginal->policy_number}", [
                    'poliza_id' => $polizaOriginal->id,
                    'result_poliza_id' => $resultPoliza->id,
                    'mode' => $resultMode,
                    'nuevo_valor_prima' => $validated['nuevoValorPrima'],
                    'nueva_fecha_vencimiento' => $validated['nuevaFechaVencimiento'],
                    'broker_id' => $brokerId,
                ]);

                // Auditoría
                $this->logPolizaAction($request, 'procesar_renovacion', $polizaOriginal, 200, [
                    'mode' => $resultMode,
                    'result_poliza_id' => $resultPoliza->id,
                    'nuevo_valor_prima' => $validated['nuevoValorPrima'],
                    'nueva_fecha_vencimiento' => $validated['nuevaFechaVencimiento'],
                    'observaciones' => $observacionesSanitizadas,
                ]);

                // Guardar snapshot en renewal_history (en la póliza original)
                if (Schema::hasTable('renewal_history')) {
                    try {
                        $historyMeta = [
                            'mode' => $resultMode,
                            'snapshot_anterior' => $snapshot,
                            'nuevos_valores' => [
                                'premium_amount' => (float) $validated['nuevoValorPrima'],
                                'commission_percentage' => $commissionPercentage,
                                'commission_amount' => $commissionAmount,
                                'start_date' => $nuevaFechaInicio->toDateString(),
                                'end_date' => $validated['nuevaFechaVencimiento'],
                                'insurance_company' => $insuranceCompany,
                                'product_name' => $productName,
                                'ramo_id' => $newRamoId,
                                'aseguradora_id' => $newAseguradoraId,
                            ],
                            'result_poliza_id' => $resultPoliza->id,
                        ];

                        // History entry on the original poliza
                        RenewalHistory::create([
                            'poliza_id' => $polizaOriginal->id,
                            'broker_id' => $brokerId,
                            'user_id' => Auth::id(),
                            'action_type' => 'renewal_processed',
                            'title' => $cambioNumeroPoliza
                                ? 'Cancelada → nueva póliza ' . $validated['nuevoNumeroPoliza']
                                : 'Renovación #' . ($resultPoliza->numero_renovacion ?? 1),
                            'description' => $observacionesSanitizadas ?: 'Renovación procesada',
                            'metadata' => $historyMeta,
                            'status' => 'completed',
                        ]);

                        // If new poliza was created, also add history on the new poliza
                        if ($cambioNumeroPoliza && $resultPoliza->id !== $polizaOriginal->id) {
                            RenewalHistory::create([
                                'poliza_id' => $resultPoliza->id,
                                'broker_id' => $brokerId,
                                'user_id' => Auth::id(),
                                'action_type' => 'renewal_processed',
                                'title' => 'Renovación #' . ($resultPoliza->numero_renovacion ?? 1) . ' (desde ' . $polizaOriginal->policy_number . ')',
                                'description' => 'Póliza creada por renovación desde ' . $polizaOriginal->policy_number . '. ' . ($observacionesSanitizadas ?: ''),
                                'metadata' => array_merge($historyMeta, [
                                    'poliza_origen_id' => $polizaOriginal->id,
                                    'poliza_origen_numero' => $polizaOriginal->policy_number,
                                ]),
                                'status' => 'completed',
                            ]);
                        }
                    } catch (\Throwable $e) {
                        \Log::warning('No se pudo guardar evento de renovación en renewal_history', ['error' => $e->getMessage()]);
                    }
                }

                // Count total renewals in the chain
                $totalRenovaciones = $resultPoliza->numero_renovacion ?? 0;

                return response()->json([
                    'success' => true,
                    'message' => $cambioNumeroPoliza
                        ? 'Renovación procesada — póliza anterior cancelada, nueva póliza creada (renovación #' . $totalRenovaciones . ')'
                        : 'Póliza renovada exitosamente (renovación #' . $totalRenovaciones . ')',
                    'data' => [
                        'mode' => $resultMode,
                        'poliza_original' => [
                            'id' => $polizaOriginal->id,
                            'numero_poliza' => $polizaOriginal->policy_number,
                            'nuevo_estado' => $cambioNumeroPoliza ? 'cancelada' : 'activa',
                            'aseguradora_anterior' => $snapshot['insurance_company'],
                            'ramo_anterior' => $snapshot['product_name'],
                            'prima_anterior' => $snapshot['premium_amount'],
                            'vigencia_anterior' => $snapshot['start_date'] . ' a ' . $snapshot['end_date'],
                        ],
                        'nueva_poliza' => [
                            'id' => $resultPoliza->id,
                            'numero_poliza' => $resultPoliza->policy_number,
                            'valor_prima' => $resultPoliza->premium_amount,
                            'comision_porcentaje' => $commissionPercentage,
                            'comision_monto' => $commissionAmount,
                            'aseguradora' => $insuranceCompany,
                            'ramo' => $productName,
                            'fecha_inicio' => $resultPoliza->start_date,
                            'fecha_vencimiento' => $resultPoliza->end_date,
                            'estado' => 'activa',
                            'numero_renovacion' => $totalRenovaciones,
                        ],
                    ]
                ]);
                
            } catch (\Exception $e) {
                DB::rollback();
                throw $e;
            }
            
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Hay datos faltantes o inválidos. Revisa los campos marcados.',
                'errors' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Error al procesar renovación de póliza: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json([
                'success' => false,
                'message' => 'No se pudo procesar la renovación. Inténtalo de nuevo.'
            ], 500);
        }
    }

    /**
     * Exportar pólizas en formato Excel/CSV con filtros
     * Usa streaming chunked para manejar 30k+ pólizas sin OOM
     */
    public function exportar(Request $request)
    {
        try {
            // Obtener broker_id dinámicamente (para debug sin auth)
            $brokerId = $request->header('X-Dev-Broker-Id') ?: $this->getBrokerId($request);

            // Construir la query base con aislamiento multi-tenant
            $query = Poliza::where('broker_id', $brokerId);

            // Obtener columnas a exportar
            $columnasParam = $request->get('columnas', '');
            $columnas = !empty($columnasParam) ? explode(',', $columnasParam) : [];
            $allColumns = $this->getExportColumns();
            $defaultColumns = ['numero_poliza', 'cliente', 'documento_cliente', 'aseguradora', 'ramo', 'estado', 'prima_neta', 'fecha_inicio', 'fecha_fin', 'fecha_expedicion', 'fecha_recepcion', 'comision', 'estado_pago', 'vendedor', 'observaciones'];
            $columnas = !empty($columnas) ? array_values(array_filter($columnas, fn($c) => isset($allColumns[$c]))) : $defaultColumns;

            // Solo eager-load relaciones que las columnas seleccionadas necesitan
            $needsClient = !empty(array_intersect($columnas, ['telefono_cliente', 'email_cliente']));
            $needsRamo = !empty(array_intersect($columnas, ['ramo', 'subramo']));
            $needsAssignedUser = in_array('vendedor', $columnas);
            $eagerLoad = [];
            if ($needsClient) $eagerLoad[] = 'client';
            if ($needsRamo) $eagerLoad[] = 'ramo';
            if ($needsAssignedUser) $eagerLoad[] = 'assignedUser';
            if (!empty($eagerLoad)) $query->with($eagerLoad);

            // Aplicar filtros
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
                    $q->where('seller_name', 'like', "%{$vendedor}%")
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

            if ($request->filled('subramo')) {
                $subramoVal = $request->subramo;
                $query->whereHas('ramo', function($q) use ($subramoVal) {
                    $q->where('subramo', 'like', "%{$subramoVal}%");
                });
            }

            // Streaming CSV response — processes in chunks to avoid OOM on 30k+ records
            $filename = 'polizas_' . date('Y-m-d_H-i-s') . '.csv';
            $self = $this;

            return response()->stream(function () use ($query, $columnas, $allColumns, $self) {
                set_time_limit(0);
                if (ob_get_level()) ob_end_clean();

                $handle = fopen('php://output', 'w');

                // BOM for UTF-8 in Excel
                fwrite($handle, "\xEF\xBB\xBF");

                // Header row
                $headers = [];
                foreach ($columnas as $col) {
                    $headers[] = $allColumns[$col]['header'];
                }
                fputcsv($handle, $headers, ';');
                fflush($handle);

                // Data rows — chunked to keep memory low
                $query->orderBy('id')->chunk(500, function ($polizas) use ($handle, $columnas, $allColumns) {
                    foreach ($polizas as $poliza) {
                        $row = [];
                        foreach ($columnas as $col) {
                            try {
                                $value = $allColumns[$col]['getter']($poliza);
                            } catch (\Throwable $e) {
                                $value = '';
                            }
                            if (isset($allColumns[$col]['format']) && $allColumns[$col]['format'] === 'number') {
                                $row[] = number_format((float)$value, 2, ',', '');
                            } else {
                                $row[] = $value;
                            }
                        }
                        fputcsv($handle, $row, ';');
                    }
                    fflush($handle);
                    flush();
                });

                fclose($handle);
            }, 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
                'Pragma' => 'no-cache',
                'Expires' => '0',
            ]);

        } catch (\Exception $e) {
            \Log::error('EXPORTAR: Error', ['message' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
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
            'ramo' => ['header' => 'Ramo', 'getter' => fn($p) => $p->product_name ?: ($p->ramo ? $p->ramo->nombre : $this->mapTypeToFrontend($p->type))],
            'subramo' => ['header' => 'Subramo', 'getter' => fn($p) => $p->ramo ? (is_array($p->ramo->subramo) ? implode(', ', $p->ramo->subramo) : ($p->ramo->subramo ?? '')) : ''],
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
                ->where('auto_renewal', true)
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
                                        $subQ->whereRaw('DATEDIFF(end_date, ?) > 7', [$today->toDateString()])
                                             ->where('status', '!=', 'renewed');
                                    });
                                    break;
                                case 'RENOVADO':
                                    $q->orWhere(function($subQ) use ($today) {
                                        // Mode A: póliza reemplazada (permanente)
                                        $subQ->where('status', 'renewed')
                                             // Mode B: renovada in-place pero aún lejos de vencer (>30 días)
                                             ->orWhere(function($subQ2) use ($today) {
                                                 $subQ2->where('is_renewal', true)
                                                       ->where('numero_renovacion', '>', 0)
                                                       ->whereRaw('DATEDIFF(end_date, ?) > 30', [$today->toDateString()]);
                                             });
                                    });
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

    // ===== VINCULADOS (Riesgos de pólizas colectivas) =====

    /**
     * Listar vinculados de una póliza
     */
    public function vinculadosIndex(Request $request, int $polizaId)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $poliza = Poliza::where('broker_id', $brokerId)->findOrFail($polizaId);

            $vinculados = $poliza->vinculados()
                ->orderBy('nombre_asegurado')
                ->get();

            // Totales
            $totales = [
                'cantidad' => $vinculados->count(),
                'valor' => $vinculados->sum('valor'),
                'valor_iva' => $vinculados->sum('valor_iva'),
                'valor_total' => $vinculados->sum('valor_total'),
            ];

            return response()->json([
                'success' => true,
                'data' => $vinculados,
                'totales' => $totales,
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['success' => false, 'message' => 'Póliza no encontrada'], 404);
        } catch (\Exception $e) {
            \Log::error('Error en operación de vinculados de póliza: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json(['success' => false, 'message' => 'Ocurrió un error al procesar la solicitud. Inténtalo de nuevo.'], 500);
        }
    }

    /**
     * Agregar vinculado a una póliza
     */
    public function vinculadosStore(Request $request, int $polizaId)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $poliza = Poliza::where('broker_id', $brokerId)->findOrFail($polizaId);

            $validated = $request->validate([
                'identificador' => 'nullable|string|max:50',
                'documento' => 'nullable|string|max:50',
                'nombre_asegurado' => 'required|string|max:255',
                'valor' => 'nullable|numeric',
                'valor_iva' => 'nullable|numeric',
                'valor_total' => 'nullable|numeric',
                'estado' => 'nullable|string|in:activo,inactivo,suspendido',
                'tipo_documento' => 'nullable|string|max:10',
                'telefono' => 'nullable|string|max:20',
                'email' => 'nullable|email|max:255',
                'direccion' => 'nullable|string|max:500',
                'ciudad' => 'nullable|string|max:100',
                'observaciones' => 'nullable|string|max:2000',
                'metadata' => 'nullable|array',
            ]);

            $vinculado = $poliza->vinculados()->create(array_merge($validated, [
                'broker_id' => $brokerId,
            ]));

            return response()->json([
                'success' => true,
                'message' => 'Vinculado agregado exitosamente',
                'data' => $vinculado,
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['success' => false, 'message' => 'Hay datos faltantes o inválidos. Revisa los campos marcados.', 'errors' => $e->errors()], 422);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['success' => false, 'message' => 'Póliza no encontrada'], 404);
        } catch (\Exception $e) {
            \Log::error('Error en operación de vinculados de póliza: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json(['success' => false, 'message' => 'Ocurrió un error al procesar la solicitud. Inténtalo de nuevo.'], 500);
        }
    }

    /**
     * Agregar múltiples vinculados a una póliza (bulk)
     */
    public function vinculadosBulkStore(Request $request, int $polizaId)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $poliza = Poliza::where('broker_id', $brokerId)->findOrFail($polizaId);

            $validated = $request->validate([
                'vinculados' => 'required|array|min:1',
                'vinculados.*.identificador' => 'nullable|string|max:50',
                'vinculados.*.documento' => 'nullable|string|max:50',
                'vinculados.*.nombre_asegurado' => 'required|string|max:255',
                'vinculados.*.valor' => 'nullable|numeric',
                'vinculados.*.valor_iva' => 'nullable|numeric',
                'vinculados.*.valor_total' => 'nullable|numeric',
                'vinculados.*.tipo_documento' => 'nullable|string|max:10',
                'vinculados.*.telefono' => 'nullable|string|max:20',
                'vinculados.*.email' => 'nullable|email|max:255',
                'vinculados.*.direccion' => 'nullable|string|max:500',
                'vinculados.*.ciudad' => 'nullable|string|max:100',
                'vinculados.*.observaciones' => 'nullable|string|max:2000',
            ]);

            $created = [];
            foreach ($validated['vinculados'] as $item) {
                $created[] = $poliza->vinculados()->create(array_merge($item, [
                    'broker_id' => $brokerId,
                    'estado' => 'activo',
                ]));
            }

            return response()->json([
                'success' => true,
                'message' => count($created) . ' vinculados agregados exitosamente',
                'data' => $created,
            ], 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['success' => false, 'message' => 'Hay datos faltantes o inválidos. Revisa los campos marcados.', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            \Log::error('Error en operación de vinculados de póliza: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json(['success' => false, 'message' => 'Ocurrió un error al procesar la solicitud. Inténtalo de nuevo.'], 500);
        }
    }

    /**
     * Actualizar un vinculado
     */
    public function vinculadosUpdate(Request $request, int $polizaId, int $vinculadoId)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $poliza = Poliza::where('broker_id', $brokerId)->findOrFail($polizaId);
            $vinculado = $poliza->vinculados()->findOrFail($vinculadoId);

            $validated = $request->validate([
                'identificador' => 'nullable|string|max:50',
                'documento' => 'nullable|string|max:50',
                'nombre_asegurado' => 'sometimes|required|string|max:255',
                'valor' => 'nullable|numeric',
                'valor_iva' => 'nullable|numeric',
                'valor_total' => 'nullable|numeric',
                'estado' => 'nullable|string|in:activo,inactivo,suspendido',
                'tipo_documento' => 'nullable|string|max:10',
                'telefono' => 'nullable|string|max:20',
                'email' => 'nullable|email|max:255',
                'direccion' => 'nullable|string|max:500',
                'ciudad' => 'nullable|string|max:100',
                'observaciones' => 'nullable|string|max:2000',
                'metadata' => 'nullable|array',
            ]);

            $vinculado->update($validated);

            return response()->json([
                'success' => true,
                'message' => 'Vinculado actualizado',
                'data' => $vinculado->fresh(),
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['success' => false, 'message' => 'No encontrado'], 404);
        } catch (\Exception $e) {
            \Log::error('Error en operación de vinculados de póliza: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json(['success' => false, 'message' => 'Ocurrió un error al procesar la solicitud. Inténtalo de nuevo.'], 500);
        }
    }

    /**
     * Eliminar un vinculado
     */
    public function vinculadosDestroy(Request $request, int $polizaId, int $vinculadoId)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $poliza = Poliza::where('broker_id', $brokerId)->findOrFail($polizaId);
            $vinculado = $poliza->vinculados()->findOrFail($vinculadoId);
            $vinculado->delete();

            return response()->json([
                'success' => true,
                'message' => 'Vinculado eliminado',
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['success' => false, 'message' => 'No encontrado'], 404);
        } catch (\Exception $e) {
            \Log::error('Error en operación de vinculados de póliza: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json(['success' => false, 'message' => 'Ocurrió un error al procesar la solicitud. Inténtalo de nuevo.'], 500);
        }
    }

    /**
     * Eliminar múltiples vinculados (bulk delete)
     */
    public function vinculadosBulkDestroy(Request $request, int $polizaId)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $poliza = Poliza::where('broker_id', $brokerId)->findOrFail($polizaId);

            $validated = $request->validate([
                'ids' => 'required|array|min:1',
                'ids.*' => 'integer',
            ]);

            $deleted = $poliza->vinculados()
                ->whereIn('id', $validated['ids'])
                ->delete();

            return response()->json([
                'success' => true,
                'message' => "$deleted vinculado(s) eliminado(s)",
                'deleted_count' => $deleted,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json(['success' => false, 'message' => 'Hay datos faltantes o inválidos. Revisa los campos marcados.', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            \Log::error('Error en operación de vinculados de póliza: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json(['success' => false, 'message' => 'Ocurrió un error al procesar la solicitud. Inténtalo de nuevo.'], 500);
        }
    }

    /**
     * Catálogo estático de motivos de cancelación para el filtro del listado
     * y el modal "Cancelar póliza" en el frontend.
     */
    public function cancellationReasons()
    {
        $reasons = \App\Models\Poliza::CANCELLATION_REASONS;
        return response()->json([
            'success' => true,
            'data' => collect($reasons)
                ->map(fn($label, $key) => ['key' => $key, 'label' => $label])
                ->values(),
        ]);
    }
}
