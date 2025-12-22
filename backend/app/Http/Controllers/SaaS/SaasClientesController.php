<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\Cliente;
use App\Models\Broker;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class SaasClientesController extends Controller
{
    /**
     * Get the broker ID for the current user
     */
    private function getBrokerId(Request $request)
    {
        // 1) Verificar si GlobalBrokerAuth ya estableció el broker_id
        $authenticatedBrokerId = $request->get('authenticated_broker_id');
        if ($authenticatedBrokerId) {
            return $authenticatedBrokerId;
        }

        // 2) Usar broker_id proporcionado por autenticación unificada (empleado o firebase)
        if (method_exists(\App\Http\Middleware\UnifiedAuthMiddleware::class, 'getBrokerId')) {
            $brokerId = \App\Http\Middleware\UnifiedAuthMiddleware::getBrokerId($request);
            if ($brokerId) {
                return $brokerId;
            }
        }

        // 3) Intentar obtener el usuario autenticado (Firebase middleware lo asigna)
        $user = $request->user();

        // 4) Fallback a Auth::user()
        if (!$user) {
            $user = Auth::user();
        }

        if ($user && $user->broker_id) {
            return $user->broker_id;
        }

        throw new \Exception('No se pudo determinar el broker para el usuario');
    }

    /**
     * Get all clientes without pagination (limited to 1000 for security)
     */
    public function all(Request $request)
    {
        try {
            // Get broker_id dynamically
            $brokerId = $this->getBrokerId($request);
            
            // Debug log
            \Log::info('🔍 [DEBUG] SaasClientesController::all', [
                'broker_id' => $brokerId,
                'user_from_request' => $request->user() ? [
                    'id' => $request->user()->id,
                    'email' => $request->user()->email,
                    'broker_id' => $request->user()->broker_id
                ] : null
            ]);
            
            // Get all clients of the broker (increased limit for campaigns)
            $clientes = Cliente::where('broker_id', $brokerId)
                ->orderBy('first_name')
                ->orderBy('last_name')
                ->limit(20000) // Increased limit to handle more clients
                ->get();
            
            // Transform data for frontend
            $transformedClientes = $clientes->map(function ($cliente) {
                return $this->transformClienteToFrontend($cliente);
            });
            
            // Always return success with appropriate message
            $message = $clientes->count() > 0
                ? 'Clientes obtenidos exitosamente'
                : 'No hay clientes registrados para este broker';
            
            return response()->json([
                'success' => true,
                'message' => $message,
                'data' => $transformedClientes,
                'total' => $clientes->count()
            ]);
            
        } catch (\Exception $e) {
            \Log::error('🚨 [ERROR] SaasClientesController::all', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener los clientes: ' . $e->getMessage(),
                'data' => []
            ], 500);
        }
    }

    /**
     * Display a listing of clientes with filters and pagination
     */
    public function index(Request $request)
    {
        try {
            // Obtener broker_id dinámicamente
            $brokerId = $this->getBrokerId($request);
            
            // Log de debugging para verificar qué broker está siendo usado
            \Log::info('🔍 [DEBUG] SaasClientesController::index', [
                'broker_id' => $brokerId,
                'user_from_request' => $request->user() ? [
                    'id' => $request->user()->id,
                    'email' => $request->user()->email,
                    'broker_id' => $request->user()->broker_id
                ] : null,
                'filters' => $request->only(['search', 'tipo', 'estado', 'ciudad', 'priority']),
                'pagination' => $request->only(['per_page', 'page'])
            ]);
            
            // Construir la query base con aislamiento multi-tenant
            $query = Cliente::where('broker_id', $brokerId);
            
            // Log para verificar cuántos clientes hay en total para este broker
            $totalClientesParaBroker = Cliente::where('broker_id', $brokerId)->count();
            \Log::info('🔍 [DEBUG] Total clientes para broker', [
                'broker_id' => $brokerId,
                'total_clientes' => $totalClientesParaBroker
            ]);

            // Aplicar filtros (usando la estructura real de la base de datos)
            if ($request->has('search') && !empty($request->search)) {
                $searchOriginal = $request->search;
                $search = trim($searchOriginal);
                $tokens = preg_split('/\s+/', $search);
                $digitsOnly = preg_replace('/\D+/', '', $search);
                
                $query->where(function($q) use ($search, $tokens, $digitsOnly) {
                    // Búsqueda simple por campos individuales
                    $q->where('first_name', 'like', "%{$search}%")
                      ->orWhere('last_name', 'like', "%{$search}%")
                      ->orWhere('document_number', 'like', "%{$search}%")
                      ->orWhere('email', 'like', "%{$search}%")
                      ->orWhere('phone', 'like', "%{$search}%")
                      ->orWhere('mobile_phone', 'like', "%{$search}%");
                    
                    // Documento normalizado (remover separadores como puntos, guiones, espacios)
                    if (!empty($digitsOnly) && strlen($digitsOnly) >= 5) {
                        $q->orWhere('document_number', 'like', "%{$digitsOnly}%");
                    }
                    
                    // Coincidencia por "nombre apellido" y también "apellido nombre"
                    if (is_array($tokens) && count($tokens) >= 2) {
                        $first = $tokens[0] ?? '';
                        $last = trim(implode(' ', array_slice($tokens, 1)));
                        
                        if ($first !== '' && $last !== '') {
                            // nombre ~ first AND apellidos ~ last
                            $q->orWhere(function($qq) use ($first, $last) {
                                $qq->where('first_name', 'like', "%{$first}%")
                                   ->where('last_name', 'like', "%{$last}%");
                            });
                            
                            // apellido ~ first AND nombre ~ last (orden invertido)
                            $q->orWhere(function($qq) use ($first, $last) {
                                $qq->where('last_name', 'like', "%{$first}%")
                                   ->where('first_name', 'like', "%{$last}%");
                            });
                            
                            // Concatenación directa "first last" por si aplica
                            $q->orWhere(\Illuminate\Support\Facades\DB::raw("CONCAT(first_name, ' ', last_name)"), 'like', "%{$first} {$last}%");
                        }
                    }
                });
                
                \Log::info('🔍 [DEBUG] Filtro de búsqueda aplicado (avanzado)', [
                    'search' => $search,
                    'tokens' => $tokens,
                    'digitsOnly' => $digitsOnly
                ]);
            }

            // Filtro por tipo de documento (alias: tipo | tipo_documento)
            if (($request->has('tipo') && !empty($request->tipo)) || ($request->has('tipo_documento') && !empty($request->tipo_documento))) {
                $docType = $request->get('tipo', $request->get('tipo_documento'));
                $query->where('document_type', $docType);
                \Log::info('🔍 [DEBUG] Filtro de tipo_documento aplicado', ['document_type' => $docType]);
            }

            if ($request->has('estado') && !empty($request->estado)) {
                $query->where('status', $request->estado);
                \Log::info('🔍 [DEBUG] Filtro de estado aplicado', ['estado' => $request->estado]);
            }

            if ($request->has('ciudad') && !empty($request->ciudad)) {
                $query->where('city', $request->ciudad);
                \Log::info('🔍 [DEBUG] Filtro de ciudad aplicado', ['ciudad' => $request->ciudad]);
            }

            // Filtro por departamento (department)
            if ($request->has('departamento') && !empty($request->departamento)) {
                $query->where('department', $request->departamento);
                \Log::info('🔍 [DEBUG] Filtro de departamento aplicado', ['departamento' => $request->departamento]);
            }

            if ($request->has('priority') && !empty($request->priority)) {
                $query->where('priority', $request->priority);
                \Log::info('🔍 [DEBUG] Filtro de prioridad aplicado', ['priority' => $request->priority]);
            }

            // Filtro por género (aceptar M/F/O o Masculino/Femenino/Otro)
            if ($request->has('genero') && !empty($request->genero)) {
                $genero = strtoupper(trim($request->genero));
                if (in_array($genero, ['M', 'F', 'O'])) {
                    $query->where('gender', $genero);
                } else {
                    // Normalizar palabras al código
                    $map = [
                        'MASCULINO' => 'M',
                        'FEMENINO' => 'F',
                        'OTRO' => 'O',
                    ];
                    $code = $map[$genero] ?? null;
                    if ($code) {
                        $query->where('gender', $code);
                    }
                }
                \Log::info('🔍 [DEBUG] Filtro de genero aplicado', ['genero' => $request->genero]);
            }

            // Filtros por rango de fechas (created_at)
            if (!empty($request->fecha_desde)) {
                $query->whereDate('created_at', '>=', $request->fecha_desde);
                \Log::info('🔍 [DEBUG] Filtro fecha_desde aplicado', ['fecha_desde' => $request->fecha_desde]);
            }
            if (!empty($request->fecha_hasta)) {
                $query->whereDate('created_at', '<=', $request->fecha_hasta);
                \Log::info('🔍 [DEBUG] Filtro fecha_hasta aplicado', ['fecha_hasta' => $request->fecha_hasta]);
            }

            // OPTIMIZACIÓN: Filtros por edad usando cálculo más eficiente
            if (!empty($request->edad_min) || !empty($request->edad_max)) {
                $currentDate = now()->toDateString();

                if (!empty($request->edad_min)) {
                    // Calcular fecha máxima de nacimiento para edad mínima
                    $maxBirthDate = now()->subYears((int) $request->edad_min)->toDateString();
                    $query->where('birth_date', '<=', $maxBirthDate);
                }
                if (!empty($request->edad_max)) {
                    // Calcular fecha mínima de nacimiento para edad máxima
                    $minBirthDate = now()->subYears((int) $request->edad_max + 1)->addDay()->toDateString();
                    $query->where('birth_date', '>=', $minBirthDate);
                }
                \Log::info('🔍 [DEBUG] Filtro de edad aplicado (optimizado)', [
                    'edad_min' => $request->edad_min,
                    'edad_max' => $request->edad_max
                ]);
            }

            // Filtro por tipo de cliente (persona/empresa)
            if ($request->has('client_type') && !empty($request->client_type)) {
                $clientType = strtolower($request->client_type);
                \Log::info('🔍 [DEBUG] Filtro de client_type solicitado', ['client_type' => $clientType]);
                if ($clientType === 'empresa') {
                    // Preferir columna client_type si existe, fallback por heurística
                    $query->where(function($q) {
                        $q->where('client_type', 'empresa')
                          ->orWhere('document_type', 'NIT')
                          ->orWhereNotNull('company');
                    });
                } elseif ($clientType === 'persona') {
                    $query->where(function($q) {
                        $q->where('client_type', 'persona')
                          ->orWhere(function($s) {
                              $s->where('document_type', '!=', 'NIT')
                                ->whereNull('company');
                          });
                    });
                }
                \Log::info('🔍 [DEBUG] Filtro de client_type aplicado');
            }

            // Ordenamiento
            $sortField = $request->get('sort_field', 'created_at');
            $sortDirection = $request->get('sort_direction', 'desc');
            
            $query->orderBy($sortField, $sortDirection);
            
            // Log de la query SQL para debugging
            $sql = $query->toSql();
            $bindings = $query->getBindings();
            \Log::info('🔍 [DEBUG] Query SQL generada', [
                'sql' => $sql,
                'bindings' => $bindings
            ]);
            
            // Verificar cuántos resultados tendría la query antes de paginar
            $totalResultados = $query->count();
            \Log::info('🔍 [DEBUG] Total resultados después de filtros', [
                'total_resultados' => $totalResultados
            ]);

            // Paginación
            // Limitar per_page para evitar paginaciones muy grandes
            $perPage = (int) $request->get('per_page', 15);
            if ($perPage <= 0) { $perPage = 15; }
            $perPage = min($perPage, (int) env('API_MAX_PER_PAGE', 20000));
            $clientes = $query->paginate($perPage);
            
            \Log::info('🔍 [DEBUG] Resultados paginados', [
                'per_page' => $perPage,
                'current_page' => $clientes->currentPage(),
                'total_pages' => $clientes->lastPage(),
                'total_items' => $clientes->total(),
                'items_in_current_page' => $clientes->count()
            ]);

            // Transformar los datos para el frontend
            $transformedData = $clientes->through(function ($cliente) {
                return $this->transformClienteToFrontend($cliente);
            });

            // Devolver formato compatible con el frontend
            $response = $transformedData->toArray();
            $response['success'] = true;
            
            // Mensaje dinámico basado en si hay clientes o no
            if ($clientes->total() === 0) {
                $response['message'] = 'No hay clientes registrados para este broker';
            } else {
                $response['message'] = 'Clientes obtenidos exitosamente';
            }

            return response()->json($response);

        } catch (\Exception $e) {
            \Log::error('🚨 [ERROR] SaasClientesController::index', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener los clientes: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store a newly created cliente in storage.
     */
    public function store(Request $request)
    {
        try {
            // Log para debug - ver qué datos recibe el backend
            // Sanitizar logs (evitar payloads completos)
            \Log::info('Datos recibidos del frontend (sanitizado)', [
                'keys' => array_keys($request->all()),
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
            
            // Obtener broker_id dinámicamente
            $brokerId = $this->getBrokerId($request);
            
            // Primero mapear campos del frontend a la estructura de la base de datos
            $mappedData = [];
            
            // Mapear campos obligatorios
            // Tipo de cliente
            $mappedData['client_type'] = $request->input('client_type', 'persona');

            // Campos según tipo
            if ($mappedData['client_type'] === 'empresa') {
                // Empresa
                $mappedData['company'] = $request->input('company', $request->input('empresa', $request->input('nombre_empresa')));
                $mappedData['company_legal_name'] = $request->input('company_legal_name', $request->input('razon_social'));
                $mappedData['legal_representative_name'] = $request->input('legal_representative_name', $request->input('representante_legal'));
                $mappedData['legal_representative_document_type'] = $request->input('legal_representative_document_type', $request->input('representante_legal_tipo_documento'));
                $mappedData['legal_representative_document_number'] = $request->input('legal_representative_document_number', $request->input('representante_legal_documento'));
                // Documentos empresa
                $mappedData['document_type'] = $request->input('tipo_documento', $request->input('document_type', 'NIT'));
                $mappedData['document_number'] = $request->input('documento', $request->input('document_number'));
                // Contacto principal (opcional) - Convertir null a vacío para empresas
                $mappedData['first_name'] = $request->input('first_name', $request->input('contacto_nombres', '')) ?? '';
                $mappedData['last_name'] = $request->input('last_name', $request->input('contacto_apellidos', '')) ?? '';
            } else {
                // Persona natural
                $mappedData['first_name'] = $request->input('nombre', $request->input('first_name'));
                $mappedData['last_name'] = $request->input('apellidos', $request->input('last_name'));
                $mappedData['document_type'] = $request->input('tipo_documento', $request->input('document_type', 'CC'));
                $mappedData['document_number'] = $request->input('documento', $request->input('document_number'));
            }
            $mappedData['address'] = $request->input('direccion', $request->input('domicilio_principal', $request->input('address')));
            $mappedData['mobile_phone'] = $request->input('celular_principal', $request->input('mobile_phone'));
            $mappedData['email'] = $request->input('email_principal', $request->input('email'));
            // Teléfono secundario
            if ($request->has('telefono_secundario') || $request->has('telefono') || $request->has('phone')) {
                $mappedData['phone'] = $request->input('telefono_secundario', $request->input('telefono', $request->input('phone')));
            }
            
            // Normalizar estado
            $statusValue = $request->input('estado', $request->input('status', 'active'));
            $mappedData['status'] = $this->normalizeStatus($statusValue);
            
            // Mapear campos opcionales
            if ($request->has('fecha_nacimiento') || $request->has('birth_date')) {
                $mappedData['birth_date'] = $request->input('fecha_nacimiento', $request->input('birth_date'));
            }
            if ($request->has('fecha_expedicion_documento') || $request->has('document_issue_date')) {
                $mappedData['document_issue_date'] = $request->input('fecha_expedicion_documento', $request->input('document_issue_date'));
            }
            if ($request->has('genero') || $request->has('gender')) {
                $genderValue = $request->input('genero', $request->input('gender'));
                // Normalizar valores de género
                $mappedData['gender'] = $this->normalizeGender($genderValue);
            }
            if ($request->has('actividad') || $request->has('occupation')) {
                $mappedData['occupation'] = $request->input('actividad', $request->input('occupation'));
            }
            if ($request->has('ciudad') || $request->has('city')) {
                $mappedData['city'] = $request->input('ciudad', $request->input('city'));
            }
            if ($request->has('departamento') || $request->has('department') || $request->has('state')) {
                $mappedData['department'] = $request->input('departamento', $request->input('department', $request->input('state')));
            }
            if ($request->has('branch_name') || $request->has('sede')) {
                $mappedData['branch_name'] = $request->input('branch_name', $request->input('sede'));
            }
            if ($request->has('pais') || $request->has('country')) {
                $mappedData['country'] = $request->input('pais', $request->input('country'));
            }
            if ($request->has('observaciones') || $request->has('notes')) {
                $mappedData['notes'] = $request->input('observaciones', $request->input('notes'));
            }
            if ($request->has('marital_status')) {
                $mappedData['marital_status'] = $request->input('marital_status');
            }
            if ($request->has('company')) {
                $mappedData['company'] = $request->input('company');
            }
            if ($request->has('monthly_income')) {
                $mappedData['monthly_income'] = $request->input('monthly_income');
            }
            if ($request->has('priority')) {
                $mappedData['priority'] = $request->input('priority');
            }
            
            // Log para debug - ver datos después del mapeo
            \Log::info('Datos después del mapeo (sanitizado)', [
                'campos' => array_keys($mappedData)
            ]);
            
            // Crear request temporal con los datos mapeados
            $tempRequest = new \Illuminate\Http\Request();
            $tempRequest->merge($mappedData);
            
            // Validar los datos mapeados
            $validatedData = $tempRequest->validate([
                'client_type' => 'required|in:persona,empresa',
                'first_name' => 'nullable|string|max:255',
                'last_name' => 'nullable|string|max:255',
                'document_number' => 'required|string|max:255',
                'document_type' => 'required|string|max:50',
                'document_issue_date' => 'nullable|date',
                'birth_date' => 'nullable|date',
                'gender' => 'nullable|string|in:M,F,O,MASCULINO,FEMENINO,OTRO',
                'address' => 'required|string',
                'mobile_phone' => 'required|string|max:50',
                'email' => 'required|email|max:255',
                'occupation' => 'nullable|string|max:255',
                'city' => 'nullable|string|max:255',
                'department' => 'nullable|string|max:255',
                'branch_name' => 'nullable|string|max:255',
                'status' => 'required|in:active,inactive,prospect,blocked',
                'notes' => 'nullable|string',
                'phone' => 'nullable|string|max:50',
                'marital_status' => 'nullable|in:soltero,casado,divorciado,viudo,union_libre',
                'company' => 'nullable|string|max:255',
                'company_legal_name' => 'nullable|string|max:255',
                'legal_representative_name' => 'nullable|string|max:255',
                'legal_representative_document_type' => 'nullable|string|max:20',
                'legal_representative_document_number' => 'nullable|string|max:100',
                'monthly_income' => 'nullable|numeric',
                'priority' => 'nullable|in:low,medium,high',
            ]);

            // Reglas condicionales
            if ($validatedData['client_type'] === 'persona') {
                if (empty($validatedData['first_name']) || empty($validatedData['last_name'])) {
                    throw new \Exception('Nombre y apellidos son obligatorios para cliente persona');
                }
            } else {
                // Para empresas, solo razón social y NIT son obligatorios
                // Los datos del representante legal son opcionales
                if (empty($validatedData['company']) || empty($validatedData['document_number'])) {
                    throw new \Exception('Razón social y NIT son obligatorios para cliente empresa');
                }
            }

            // Agregar el broker_id
            $validatedData['broker_id'] = $brokerId;

            // Prevenir duplicados por (broker_id, document_number)
            $existing = Cliente::where('broker_id', $brokerId)
                ->where('document_number', $validatedData['document_number'])
                ->first();

            if ($existing) {
                \Log::warning('⚠️ [CLIENTES] Intento de crear cliente duplicado por documento', [
                    'broker_id' => $brokerId,
                    'document_number' => $validatedData['document_number'],
                    'existing_id' => $existing->id,
                ]);

                return response()->json([
                    'success' => false,
                    'code' => 'DUPLICATE_DOCUMENT',
                    'message' => 'Ya existe un cliente con este documento para este broker',
                    'data' => $this->transformClienteToFrontend($existing)
                ], 409);
            }

            // Crear el cliente
            $cliente = Cliente::create($validatedData);

            return response()->json([
                'success' => true,
                'message' => 'Cliente creado exitosamente',
                'data' => $this->transformClienteToFrontend($cliente)
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al crear el cliente: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Display the specified cliente.
     */
    public function show($id)
    {
        try {
            $brokerId = $this->getBrokerId(request());
            
            $cliente = Cliente::where('broker_id', $brokerId)->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $this->transformClienteToFrontend($cliente)
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Cliente no encontrado',
            ], 404);
        }
    }

    /**
     * Update the specified cliente in storage.
     */
    public function update(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $cliente = Cliente::where('broker_id', $brokerId)->findOrFail($id);

            // Log para debug - ver qué datos recibe el backend
            \Log::info('Datos recibidos para actualización (sanitizado):', [
                'keys' => array_keys($request->all()),
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
            
            // Mapear campos del frontend a la estructura de la base de datos (aceptando claves en ES y EN)
            $mappedData = [];

            // Tipo de cliente
            if ($request->has('client_type')) $mappedData['client_type'] = $request->input('client_type');
            if ($request->has('client_type') === false && $request->has('tipo')) $mappedData['client_type'] = $request->input('tipo');

            // Nombres y apellidos
            // Evitar forzar validación "required" cuando el campo viene vacío en empresas:
            // usar filled() en lugar de has() para solo mapear si trae contenido.
            if ($request->filled('first_name') || $request->filled('nombre')) {
                $mappedData['first_name'] = $request->input('first_name', $request->input('nombre')) ?? '';
            }
            if ($request->filled('last_name') || $request->filled('apellidos')) {
                $mappedData['last_name'] = $request->input('last_name', $request->input('apellidos')) ?? '';
            }

            // Documento
            if ($request->has('document_number') || $request->has('documento')) {
                $mappedData['document_number'] = $request->input('document_number', $request->input('documento'));
            }
            if ($request->has('document_type') || $request->has('tipo_documento')) {
                $mappedData['document_type'] = $request->input('document_type', $request->input('tipo_documento'));
            }

            // Contacto
            if ($request->has('email') || $request->has('email_principal')) {
                $mappedData['email'] = $request->input('email', $request->input('email_principal'));
            }
            if ($request->has('mobile_phone') || $request->has('celular_principal')) {
                $mappedData['mobile_phone'] = $request->input('mobile_phone', $request->input('celular_principal'));
            }
            if ($request->has('telefono_secundario') || $request->has('telefono') || $request->has('phone')) {
                $mappedData['phone'] = $request->input('telefono_secundario', $request->input('telefono', $request->input('phone')));
            }

            // Dirección
            if ($request->has('address') || $request->has('domicilio_principal')) {
                $mappedData['address'] = $request->input('address', $request->input('domicilio_principal'));
            }
            if ($request->has('city') || $request->has('ciudad')) {
                $mappedData['city'] = $request->input('city', $request->input('ciudad'));
            }
            if ($request->has('department') || $request->has('departamento') || $request->has('state')) {
                $mappedData['department'] = $request->input('department', $request->input('departamento', $request->input('state')));
            }
            if ($request->has('branch_name') || $request->has('sede')) {
                $mappedData['branch_name'] = $request->input('branch_name', $request->input('sede'));
            }

            // Datos adicionales
            if ($request->has('occupation') || $request->has('actividad')) {
                $mappedData['occupation'] = $request->input('occupation', $request->input('actividad'));
            }
            if ($request->has('notes') || $request->has('observaciones')) {
                $mappedData['notes'] = $request->input('notes', $request->input('observaciones'));
            }
            if ($request->has('birth_date') || $request->has('fecha_nacimiento')) {
                $mappedData['birth_date'] = $request->input('birth_date', $request->input('fecha_nacimiento'));
            }
            if ($request->has('document_issue_date') || $request->has('fecha_expedicion_documento')) {
                $mappedData['document_issue_date'] = $request->input('document_issue_date', $request->input('fecha_expedicion_documento'));
            }
            if ($request->has('gender') || $request->has('genero')) {
                $mappedData['gender'] = $this->normalizeGender($request->input('gender', $request->input('genero')));
            }
            if ($request->has('marital_status')) $mappedData['marital_status'] = $request->input('marital_status');

            // Empresa
            if ($request->has('company') || $request->has('razon_social') || $request->has('empresa')) {
                $mappedData['company'] = $request->input('company', $request->input('razon_social', $request->input('empresa')));
            }
            if ($request->has('company_legal_name') || $request->has('razon_social')) {
                $mappedData['company_legal_name'] = $request->input('company_legal_name', $request->input('razon_social'));
            }
            if ($request->has('legal_representative_name') || $request->has('representante_legal')) {
                $mappedData['legal_representative_name'] = $request->input('legal_representative_name', $request->input('representante_legal'));
            }
            if ($request->has('legal_representative_document_type') || $request->has('representante_legal_tipo_documento')) {
                $mappedData['legal_representative_document_type'] = $request->input('legal_representative_document_type', $request->input('representante_legal_tipo_documento'));
            }
            if ($request->has('legal_representative_document_number') || $request->has('representante_legal_documento')) {
                $mappedData['legal_representative_document_number'] = $request->input('legal_representative_document_number', $request->input('representante_legal_documento'));
            }

            if ($request->has('monthly_income')) $mappedData['monthly_income'] = $request->input('monthly_income');
            if ($request->has('priority')) $mappedData['priority'] = $request->input('priority');

            // Normalizar estado (aceptar 'status' o 'estado')
            if ($request->has('status') || $request->has('estado')) {
                $mappedData['status'] = $this->normalizeStatus($request->input('status', $request->input('estado')));
            }
            
            // Log para debug - ver datos después del mapeo
            \Log::info('Datos después del mapeo para actualización (sanitizado):', [
                'campos' => array_keys($mappedData)
            ]);
            
            // Crear request temporal con los datos mapeados
            $tempRequest = new \Illuminate\Http\Request();
            $tempRequest->merge($mappedData);
            
            // Validar los datos mapeados (reglas dependientes del tipo de cliente)
            $clientTypeForValidation = $tempRequest->input(
                'client_type',
                $cliente->client_type ?? (($cliente->document_type === 'NIT' || !empty($cliente->company)) ? 'empresa' : 'persona')
            );

            // Si se está editando una empresa y llegan nombres vacíos desde el frontend,
            // eliminarlos para evitar que "sometimes|required" dispare validaciones innecesarias.
            if ($clientTypeForValidation === 'empresa') {
                foreach (['first_name', 'last_name'] as $k) {
                    if ($tempRequest->has($k) && trim((string)$tempRequest->input($k)) === '') {
                        $tempRequest->request->remove($k);
                    }
                }
            }

            $rules = [
                'client_type' => 'sometimes|in:persona,empresa',
                'document_number' => 'sometimes|required|string|max:255',
                'document_type' => 'sometimes|required|string|max:50',
                'document_issue_date' => 'nullable|date',
                'birth_date' => 'nullable|date',
                'gender' => 'nullable|string|in:M,F,O',
                'address' => 'sometimes|required|string',
                'mobile_phone' => 'sometimes|required|string|max:50',
                'email' => 'sometimes|required|email|max:255',
                'occupation' => 'nullable|string|max:255',
                'city' => 'nullable|string|max:255',
                'department' => 'nullable|string|max:255',
                'branch_name' => 'nullable|string|max:255',
                'status' => 'sometimes|required|in:active,inactive,prospect,blocked',
                'notes' => 'nullable|string',
                'phone' => 'nullable|string|max:50',
                'marital_status' => 'nullable|in:soltero,casado,divorciado,viudo,union_libre',
                'company' => 'nullable|string|max:255',
                'company_legal_name' => 'nullable|string|max:255',
                'legal_representative_name' => 'nullable|string|max:255',
                'legal_representative_document_type' => 'nullable|string|max:20',
                'legal_representative_document_number' => 'nullable|string|max:100',
                'monthly_income' => 'nullable|numeric',
                'priority' => 'nullable|in:low,medium,high',
            ];

            if ($clientTypeForValidation === 'persona') {
                // Para persona natural, si los campos vienen en el payload deben tener contenido
                $rules['first_name'] = 'sometimes|required|string|max:255';
                $rules['last_name']  = 'sometimes|required|string|max:255';
            } else {
                // Para empresas, los nombres son opcionales
                $rules['first_name'] = 'nullable|string|max:255';
                $rules['last_name']  = 'nullable|string|max:255';
            }

            $validatedData = $tempRequest->validate($rules);

            // Actualizar el cliente
            $cliente->update($validatedData);

            return response()->json([
                'success' => true,
                'message' => 'Cliente actualizado exitosamente',
                'data' => $this->transformClienteToFrontend($cliente)
            ]);

        } catch (\Exception $e) {
            \Log::error('Error al actualizar cliente: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar el cliente: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Remove the specified cliente from storage.
     */
    public function destroy(Request $request, $id)
    {
        try {
            // Log para debugging
            \Log::info('🗑️ [DEBUG] SaasClientesController::destroy', [
                'cliente_id' => $id,
                'user_from_request' => $request->user() ? [
                    'id' => $request->user()->id,
                    'email' => $request->user()->email,
                    'broker_id' => $request->user()->broker_id
                ] : null,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);
            
            $brokerId = $this->getBrokerId($request);
            
            $cliente = Cliente::where('broker_id', $brokerId)->findOrFail($id);
            
            \Log::info('🗑️ [DEBUG] Cliente encontrado para eliminar', [
                'cliente_id' => $cliente->id,
                'cliente_name' => $cliente->first_name . ' ' . $cliente->last_name,
                'broker_id' => $cliente->broker_id
            ]);
            
            $cliente->delete();
            
            \Log::info('✅ [DEBUG] Cliente eliminado exitosamente', [
                'cliente_id' => $id
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Cliente eliminado exitosamente'
            ]);

        } catch (\Exception $e) {
            \Log::error('🚨 [ERROR] SaasClientesController::destroy', [
                'cliente_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar el cliente: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Borrado masivo de clientes
     * Puede eliminar todos los clientes del broker o solo los seleccionados
     */
    public function bulkDelete(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            // Verificar si se quieren eliminar todos o solo algunos
            $deleteAll = $request->input('delete_all', false);
            $clienteIds = $request->input('ids', []);
            
            \Log::info('🗑️ [BULK DELETE] Iniciando borrado masivo', [
                'broker_id' => $brokerId,
                'delete_all' => $deleteAll,
                'ids_count' => count($clienteIds),
            ]);
            
            $deletedCount = 0;
            
            DB::beginTransaction();
            
            try {
                if ($deleteAll) {
                    // Eliminar TODOS los clientes del broker
                    $deletedCount = Cliente::where('broker_id', $brokerId)->count();
                    Cliente::where('broker_id', $brokerId)->delete();
                    
                    \Log::info('✅ [BULK DELETE] Todos los clientes eliminados', [
                        'broker_id' => $brokerId,
                        'deleted_count' => $deletedCount,
                    ]);
                } elseif (!empty($clienteIds)) {
                    // Eliminar solo los clientes seleccionados
                    $deletedCount = Cliente::where('broker_id', $brokerId)
                        ->whereIn('id', $clienteIds)
                        ->count();
                    
                    Cliente::where('broker_id', $brokerId)
                        ->whereIn('id', $clienteIds)
                        ->delete();
                    
                    \Log::info('✅ [BULK DELETE] Clientes seleccionados eliminados', [
                        'broker_id' => $brokerId,
                        'requested_ids' => count($clienteIds),
                        'deleted_count' => $deletedCount,
                    ]);
                } else {
                    return response()->json([
                        'success' => false,
                        'message' => 'Debe especificar los IDs de clientes a eliminar o activar delete_all',
                    ], 400);
                }
                
                DB::commit();
                
                return response()->json([
                    'success' => true,
                    'message' => "Se eliminaron {$deletedCount} clientes exitosamente",
                    'deleted_count' => $deletedCount,
                ]);
                
            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }
            
        } catch (\Exception $e) {
            \Log::error('🚨 [BULK DELETE ERROR]', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar clientes: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Normalizar valores de estado
     */
    private function normalizeStatus($status) {
        if (empty($status) || is_null($status)) {
            return 'active';
        }
        
        switch (strtolower(trim($status))) {
            case 'activo':
            case 'active':
                return 'active';
            case 'inactivo':
            case 'inactive':
                return 'inactive';
            case 'prospecto':
            case 'prospect':
                return 'prospect';
            case 'bloqueado':
            case 'blocked':
                return 'blocked';
            // Casos adicionales que el frontend podría enviar
            case 'nuevo':
            case 'new':
                return 'prospect';
            case 'potencial':
            case 'potential':
                return 'prospect';
            default:
                // Si no coincide con ninguno, intentar devolver 'active' por defecto
                return 'active';
        }
    }
    
    /**
     * Normalizar valores de género
     */
    private function normalizeGender($gender) {
        switch (strtoupper($gender)) {
            case 'MASCULINO':
                return 'M';
            case 'FEMENINO':
                return 'F';
            case 'OTRO':
                return 'O';
            default:
                return $gender;
        }
    }

    /**
     * Get clientes statistics (Development version without auth)
     */
    public function estadisticasDev(Request $request)
    {
        try {
            // Obtener broker_id dinámicamente
            $brokerId = $this->getBrokerId($request);
            
            // Estadísticas básicas de clientes
            $totalClientes = Cliente::where('broker_id', $brokerId)->count();
            $clientesActivos = Cliente::where('broker_id', $brokerId)->where('status', 'active')->count();
            $clientesInactivos = Cliente::where('broker_id', $brokerId)->where('status', 'inactive')->count();
            $clientesProspectos = Cliente::where('broker_id', $brokerId)->where('status', 'prospect')->count();
            $clientesBloqueados = Cliente::where('broker_id', $brokerId)->where('status', 'blocked')->count();

            // Si no hay clientes, devolver ceros reales
            if ($totalClientes === 0) {
                return response()->json([
                    'success' => true,
                    'message' => 'No hay clientes registrados para este broker',
                    'data' => [
                        'total_clientes' => 0,
                        'clientes_activos' => 0,
                        'clientes_inactivos' => 0,
                        'clientes_prospectos' => 0,
                        'clientes_bloqueados' => 0,
                        'nuevos_este_mes' => 0,
                        'tasa_conversion' => 0,
                    ]
                ]);
            }

            // Clientes nuevos este mes
            $nuevosEsteMes = Cliente::where('broker_id', $brokerId)
                ->whereMonth('created_at', now()->month)
                ->whereYear('created_at', now()->year)
                ->count();

            // Tasa de conversión (activos vs prospectos)
            $tasaConversion = $clientesProspectos > 0 ? 
                round(($clientesActivos / ($clientesActivos + $clientesProspectos)) * 100, 2) : 0;

            return response()->json([
                'success' => true,
                'message' => 'Estadísticas de clientes obtenidas exitosamente',
                'data' => [
                    'total_clientes' => $totalClientes,
                    'clientes_activos' => $clientesActivos,
                    'clientes_inactivos' => $clientesInactivos,
                    'clientes_prospectos' => $clientesProspectos,
                    'clientes_bloqueados' => $clientesBloqueados,
                    'nuevos_este_mes' => $nuevosEsteMes,
                    'tasa_conversion' => $tasaConversion,
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener las estadísticas de clientes: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get clientes statistics (Production version with auth) - OPTIMIZED
     */
    public function estadisticas(Request $request)
    {
        try {
            // Usar el método getBrokerId que maneja correctamente empleados y Firebase
            $brokerId = $this->getBrokerId($request);

            // OPTIMIZACIÓN: Estadísticas básicas de clientes en una sola consulta
            $basicStats = Cliente::where('broker_id', $brokerId)
                ->selectRaw('
                    COUNT(*) as total_clientes,
                    COUNT(CASE WHEN status = "active" THEN 1 END) as clientes_activos,
                    COUNT(CASE WHEN status = "inactive" THEN 1 END) as clientes_inactivos,
                    COUNT(CASE WHEN status = "prospect" THEN 1 END) as clientes_prospectos,
                    COUNT(CASE WHEN status = "blocked" THEN 1 END) as clientes_bloqueados,
                    COUNT(CASE WHEN client_type = "persona" THEN 1 END) as clientes_personas,
                    COUNT(CASE WHEN client_type = "empresa" THEN 1 END) as clientes_empresas,
                    COUNT(CASE WHEN MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN 1 END) as nuevos_este_mes
                ')
                ->first();

            // OPTIMIZACIÓN: Estadísticas de pólizas activas (valor cartera y total pólizas)
            $polizasStats = DB::table('polizas')
                ->where('broker_id', $brokerId)
                ->where('status', 'active')
                ->whereNull('deleted_at')
                ->selectRaw('
                    COUNT(*) as total_polizas_activas,
                    COALESCE(SUM(premium_amount), 0) as valor_total_cartera
                ')
                ->first();

            // OPTIMIZACIÓN: Estadísticas por mes, estado y ciudad en una sola consulta
            $groupedStats = DB::table('clientes')
                ->where('broker_id', $brokerId)
                ->selectRaw('
                    YEAR(created_at) as year,
                    MONTH(created_at) as month,
                    status,
                    city,
                    COUNT(*) as count
                ')
                ->where('created_at', '>=', Carbon::now()->subMonths(12))
                ->groupByRaw('YEAR(created_at), MONTH(created_at), status, city')
                ->get();

            // Procesar estadísticas agrupadas
            $clientesPorMes = collect($groupedStats)->groupBy(function ($item) {
                return $item->year . '-' . $item->month;
            })->map(function ($items, $key) {
                [$year, $month] = explode('-', $key);
                return [
                    'year' => (int) $year,
                    'month' => (int) $month,
                    'total' => $items->sum('count')
                ];
            })->sortBy(['year', 'month'])->values();

            $clientesPorEstado = collect($groupedStats)->groupBy('status')
                ->map(function ($items) {
                    return ['status' => $items->first()->status, 'total' => $items->sum('count')];
                })->values();

            $clientesPorCiudad = collect($groupedStats)->whereNotNull('city')
                ->groupBy('city')
                ->map(function ($items) {
                    return ['city' => $items->first()->city, 'total' => $items->sum('count')];
                })->sortByDesc('total')->take(10)->values();

            // Calcular tasa de conversión
            $activos = (int) $basicStats->clientes_activos;
            $prospectos = (int) $basicStats->clientes_prospectos;
            $tasaConversion = $prospectos > 0 ?
                round(($activos / ($activos + $prospectos)) * 100, 2) : 0;

            return response()->json([
                'success' => true,
                'message' => 'Estadísticas de clientes obtenidas exitosamente',
                'data' => [
                    'total_clientes' => (int) $basicStats->total_clientes,
                    'clientes_activos' => $activos,
                    'clientes_inactivos' => (int) $basicStats->clientes_inactivos,
                    'clientes_prospectos' => $prospectos,
                    'clientes_bloqueados' => (int) $basicStats->clientes_bloqueados,
                    'clientes_personas' => (int) $basicStats->clientes_personas,
                    'clientes_empresas' => (int) $basicStats->clientes_empresas,
                    'nuevos_este_mes' => (int) $basicStats->nuevos_este_mes,
                    'tasa_conversion' => $tasaConversion,
                    // Estadísticas de pólizas
                    'total_polizas_activas' => (int) ($polizasStats->total_polizas_activas ?? 0),
                    'valor_total_cartera' => (float) ($polizasStats->valor_total_cartera ?? 0),
                    // Estadísticas agrupadas
                    'clientes_por_mes' => $clientesPorMes,
                    'clientes_por_estado' => $clientesPorEstado,
                    'clientes_por_ciudad' => $clientesPorCiudad,
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener estadísticas de clientes: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Transform cliente model to frontend format
     */
    private function transformClienteToFrontend($cliente)
    {
        return [
            'id' => $cliente->id,
            'client_type' => $cliente->client_type ?? (($cliente->document_type === 'NIT' || !empty($cliente->company)) ? 'empresa' : 'persona'),
            'nombre' => $cliente->first_name,
            'apellidos' => $cliente->last_name,
            'cuit' => $cliente->document_number,
            'tipo_documento' => $cliente->document_type,
            'fecha_expedicion_documento' => $cliente->document_issue_date ? $cliente->document_issue_date->format('Y-m-d') : null,
            'fecha_nacimiento' => $cliente->birth_date,
            'genero' => $cliente->gender,
            'domicilio_principal' => $cliente->address,
            'celular_principal' => $cliente->mobile_phone,
            'email_principal' => $cliente->email,
            'actividad' => $cliente->occupation,
            'ciudad' => $cliente->city,
            'departamento' => $cliente->department, // requerido por frontend (nuevo campo)
            'department' => $cliente->department, // alias para clientes modernos
            'branch_name' => $cliente->branch_name,
            'sede' => $cliente->branch_name, // alias por compatibilidad
            'estado' => $cliente->status,
            'observaciones' => $cliente->notes,
            'telefono' => $cliente->phone,
            'empresa' => $cliente->company,
            'razon_social' => $cliente->company_legal_name ?? $cliente->company,
            'representante_legal' => $cliente->legal_representative_name,
            'representante_legal_tipo_documento' => $cliente->legal_representative_document_type,
            'representante_legal_documento' => $cliente->legal_representative_document_number,
            'ingresos_mensuales' => $cliente->monthly_income,
            'prioridad' => $cliente->priority,
            'estado_civil' => $cliente->marital_status,
            'created_at' => $cliente->created_at,
            'updated_at' => $cliente->updated_at,
        ];
    }

    /**
     * Exportar clientes en formato Excel/CSV con filtros
     */
    public function exportar(Request $request)
    {
        try {
            \Log::info('EXPORTAR CLIENTES: Iniciando exportación', [
                'request_all' => $request->all(),
                'headers' => $request->headers->all()
            ]);

            // Obtener broker_id dinámicamente (para debug sin auth)
            $brokerId = $request->header('X-Dev-Broker-Id') ?: $this->getBrokerId($request);

            \Log::info('EXPORTAR CLIENTES: Broker ID obtenido', ['broker_id' => $brokerId]);

            // Determinar formato (excel por defecto, csv alternativo)
            $formato = $request->get('formato', 'excel');

            // OPTIMIZACIÓN: Construir la query base con aislamiento multi-tenant
            $query = Cliente::where('broker_id', $brokerId);

            // OPTIMIZACIÓN: Aplicar filtros con índices optimizados (igual que index)
            if ($request->has('search') && !empty($request->search)) {
                $searchOriginal = $request->search;
                $search = trim($searchOriginal);
                $tokens = preg_split('/\s+/', $search);
                $digitsOnly = preg_replace('/\D+/', '', $search);
                
                $query->where(function($q) use ($search, $tokens, $digitsOnly) {
                    // Búsqueda simple por campos individuales
                    $q->where('first_name', 'like', "%{$search}%")
                      ->orWhere('last_name', 'like', "%{$search}%")
                      ->orWhere('document_number', 'like', "%{$search}%")
                      ->orWhere('email', 'like', "%{$search}%")
                      ->orWhere('phone', 'like', "%{$search}%")
                      ->orWhere('mobile_phone', 'like', "%{$search}%");
                    
                    // Documento normalizado
                    if (!empty($digitsOnly) && strlen($digitsOnly) >= 5) {
                        $q->orWhere('document_number', 'like', "%{$digitsOnly}%");
                    }
                    
                    // Coincidencia por "nombre apellido" y "apellido nombre"
                    if (is_array($tokens) && count($tokens) >= 2) {
                        $first = $tokens[0] ?? '';
                        $last = trim(implode(' ', array_slice($tokens, 1)));
                        
                        if ($first !== '' && $last !== '') {
                            $q->orWhere(function($qq) use ($first, $last) {
                                $qq->where('first_name', 'like', "%{$first}%")
                                   ->where('last_name', 'like', "%{$last}%");
                            });
                            
                            $q->orWhere(function($qq) use ($first, $last) {
                                $qq->where('last_name', 'like', "%{$first}%")
                                   ->where('first_name', 'like', "%{$last}%");
                            });
                            
                            $q->orWhere(\Illuminate\Support\Facades\DB::raw("CONCAT(first_name, ' ', last_name)"), 'like', "%{$first} {$last}%");
                        }
                    }
                });
            }

            if (($request->has('tipo') && !empty($request->tipo)) || ($request->has('tipo_documento') && !empty($request->tipo_documento))) {
                $docType = $request->get('tipo', $request->get('tipo_documento'));
                $query->where('document_type', $docType);
            }

            if ($request->has('estado') && !empty($request->estado)) {
                $query->where('status', $request->estado);
            }

            if ($request->has('ciudad') && !empty($request->ciudad)) {
                $query->where('city', $request->ciudad);
            }

            if ($request->has('departamento') && !empty($request->departamento)) {
                $query->where('department', $request->departamento);
            }

            if ($request->has('priority') && !empty($request->priority)) {
                $query->where('priority', $request->priority);
            }

            if ($request->has('genero') && !empty($request->genero)) {
                $genero = strtoupper(trim($request->genero));
                if (in_array($genero, ['M', 'F', 'O'])) {
                    $query->where('gender', $genero);
                } else {
                    $map = [
                        'MASCULINO' => 'M',
                        'FEMENINO' => 'F',
                        'OTRO' => 'O',
                    ];
                    $code = $map[$genero] ?? null;
                    if ($code) {
                        $query->where('gender', $code);
                    }
                }
            }

            if (!empty($request->fecha_desde)) {
                $query->whereDate('created_at', '>=', $request->fecha_desde);
            }
            if (!empty($request->fecha_hasta)) {
                $query->whereDate('created_at', '<=', $request->fecha_hasta);
            }

            if (!empty($request->edad_min) || !empty($request->edad_max)) {
                $currentDate = now()->toDateString();

                if (!empty($request->edad_min)) {
                    $maxBirthDate = now()->subYears((int) $request->edad_min)->toDateString();
                    $query->where('birth_date', '<=', $maxBirthDate);
                }
                if (!empty($request->edad_max)) {
                    $minBirthDate = now()->subYears((int) $request->edad_max + 1)->addDay()->toDateString();
                    $query->where('birth_date', '>=', $minBirthDate);
                }
            }

            if ($request->has('client_type') && !empty($request->client_type)) {
                $clientType = strtolower($request->client_type);
                if ($clientType === 'empresa') {
                    $query->where(function($q) {
                        $q->where('client_type', 'empresa')
                          ->orWhere('document_type', 'NIT')
                          ->orWhereNotNull('company');
                    });
                } elseif ($clientType === 'persona') {
                    $query->where(function($q) {
                        $q->where('client_type', 'persona')
                          ->orWhere(function($s) {
                              $s->where('document_type', '!=', 'NIT')
                                ->whereNull('company');
                          });
                    });
                }
            }

            // Obtener todas las clientes sin paginación
            \Log::info('EXPORTAR CLIENTES: Ejecutando query', ['broker_id' => $brokerId]);
            $clientes = $query->get();
            \Log::info('EXPORTAR CLIENTES: Query ejecutada', ['count' => $clientes->count()]);

            if ($formato === 'csv') {
                \Log::info('EXPORTAR CLIENTES: Exportando CSV');
                return $this->exportarCSV($clientes);
            } else {
                \Log::info('EXPORTAR CLIENTES: Exportando Excel');
                return $this->exportarExcel($clientes);
            }

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al exportar clientes: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Exportar clientes a formato CSV
     */
    private function exportarCSV($clientes)
    {
        // Generar CSV
        $csvData = [];
        $csvData[] = [
            'Tipo Cliente',
            'Nombre',
            'Apellidos',
            'Tipo Documento',
            'Documento',
            'Email',
            'Teléfono',
            'Celular',
            'Dirección',
            'Ciudad',
            'Departamento',
            'Estado',
            'Prioridad',
            'Fecha Nacimiento',
            'Género',
            'Estado Civil',
            'Ocupación',
            'Empresa',
            'Razón Social',
            'Representante Legal',
            'Ingresos Mensuales',
            'Observaciones',
            'Fecha Creación'
        ];

        foreach ($clientes as $cliente) {
            $csvData[] = [
                $cliente->client_type ?? (($cliente->document_type === 'NIT' || !empty($cliente->company)) ? 'empresa' : 'persona'),
                $cliente->first_name,
                $cliente->last_name,
                $cliente->document_type,
                $cliente->document_number,
                $cliente->email,
                $cliente->phone,
                $cliente->mobile_phone,
                $cliente->address,
                $cliente->city,
                $cliente->department,
                $cliente->status,
                $cliente->priority,
                $cliente->birth_date ? $cliente->birth_date->format('Y-m-d') : '',
                $cliente->gender,
                $cliente->marital_status,
                $cliente->occupation,
                $cliente->company,
                $cliente->company_legal_name,
                $cliente->legal_representative_name,
                $cliente->monthly_income,
                $cliente->notes,
                $cliente->created_at ? $cliente->created_at->format('Y-m-d H:i:s') : ''
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
            'Content-Disposition' => 'attachment; filename="clientes_' . date('Y-m-d_H-i-s') . '.csv"',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0'
        ]);
    }

    /**
     * Exportar clientes a formato Excel
     */
    private function exportarExcel($clientes)
    {
        // Verificar si tenemos la librería PHPExcel/PhpSpreadsheet
        if (!class_exists('\PhpOffice\PhpSpreadsheet\Spreadsheet')) {
            // Fallback a CSV si no hay Excel
            return $this->exportarCSV($clientes);
        }

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();

        // Headers
        $headers = [
            'A1' => 'Tipo Cliente',
            'B1' => 'Nombre',
            'C1' => 'Apellidos',
            'D1' => 'Tipo Documento',
            'E1' => 'Documento',
            'F1' => 'Email',
            'G1' => 'Teléfono',
            'H1' => 'Celular',
            'I1' => 'Dirección',
            'J1' => 'Ciudad',
            'K1' => 'Departamento',
            'L1' => 'Estado',
            'M1' => 'Prioridad',
            'N1' => 'Fecha Nacimiento',
            'O1' => 'Género',
            'P1' => 'Estado Civil',
            'Q1' => 'Ocupación',
            'R1' => 'Empresa',
            'S1' => 'Razón Social',
            'T1' => 'Representante Legal',
            'U1' => 'Ingresos Mensuales',
            'V1' => 'Observaciones',
            'W1' => 'Fecha Creación'
        ];

        foreach ($headers as $cell => $header) {
            $sheet->setCellValue($cell, $header);
            $sheet->getStyle($cell)->getFont()->setBold(true);
        }

        // Datos
        $row = 2;
        foreach ($clientes as $cliente) {
            $sheet->setCellValue('A' . $row, $cliente->client_type ?? (($cliente->document_type === 'NIT' || !empty($cliente->company)) ? 'empresa' : 'persona'));
            $sheet->setCellValue('B' . $row, $cliente->first_name);
            $sheet->setCellValue('C' . $row, $cliente->last_name);
            $sheet->setCellValue('D' . $row, $cliente->document_type);
            $sheet->setCellValue('E' . $row, $cliente->document_number);
            $sheet->setCellValue('F' . $row, $cliente->email);
            $sheet->setCellValue('G' . $row, $cliente->phone);
            $sheet->setCellValue('H' . $row, $cliente->mobile_phone);
            $sheet->setCellValue('I' . $row, $cliente->address);
            $sheet->setCellValue('J' . $row, $cliente->city);
            $sheet->setCellValue('K' . $row, $cliente->department);
            $sheet->setCellValue('L' . $row, $cliente->status);
            $sheet->setCellValue('M' . $row, $cliente->priority);
            $sheet->setCellValue('N' . $row, $cliente->birth_date ? $cliente->birth_date->format('Y-m-d') : '');
            $sheet->setCellValue('O' . $row, $cliente->gender);
            $sheet->setCellValue('P' . $row, $cliente->marital_status);
            $sheet->setCellValue('Q' . $row, $cliente->occupation);
            $sheet->setCellValue('R' . $row, $cliente->company);
            $sheet->setCellValue('S' . $row, $cliente->company_legal_name);
            $sheet->setCellValue('T' . $row, $cliente->legal_representative_name);
            $sheet->setCellValue('U' . $row, $cliente->monthly_income);
            $sheet->setCellValue('V' . $row, $cliente->notes);
            $sheet->setCellValue('W' . $row, $cliente->created_at ? $cliente->created_at->format('Y-m-d H:i:s') : '');

            // Formato de números
            $sheet->getStyle('U' . $row)->getNumberFormat()->setFormatCode('#,##0');

            $row++;
        }

        // Auto-size columns
        foreach (range('A', 'W') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        // Crear archivo Excel
        $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
        $tempFile = tempnam(sys_get_temp_dir(), 'clientes_export');
        $writer->save($tempFile);

        $excelContent = file_get_contents($tempFile);
        unlink($tempFile);

        return response($excelContent, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="clientes_' . date('Y-m-d_H-i-s') . '.xlsx"',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0'
        ]);
    }

    /**
     * Get customer information by phone number for ElevenLabs webhook
     * This endpoint is used by ElevenLabs to get dynamic variables during voice calls
     */
    public function getCustomerByPhone($phone)
    {
        try {
            // Log de debug para ElevenLabs
            \Log::info('🎙️ [ELEVENLABS] Webhook request for phone: ' . $phone);
            
            // Limpiar el número de teléfono (remover espacios, guiones, etc.)
            $cleanPhone = preg_replace('/[^0-9+]/', '', $phone);
            
            // Extraer solo los dígitos del número (sin + ni código de país)
            $digitsOnly = preg_replace('/[^0-9]/', '', $phone);
            
            // Si el número empieza con código de país común (57 para Colombia), remover el prefijo
            if (str_starts_with($digitsOnly, '57') && strlen($digitsOnly) >= 12) {
                $localNumber = substr($digitsOnly, 2); // Remover '57'
            } else {
                $localNumber = $digitsOnly;
            }
            
            // Buscar cliente por número de teléfono (celular o fijo)
            // Buscar en todos los brokers ya que ElevenLabs necesita acceder sin autenticación
            $cliente = Cliente::where(function($query) use ($cleanPhone, $digitsOnly, $localNumber) {
                $query->where('mobile_phone', 'LIKE', '%' . $cleanPhone . '%')
                      ->orWhere('phone', 'LIKE', '%' . $cleanPhone . '%')
                      ->orWhere('mobile_phone', 'LIKE', '%' . $digitsOnly . '%')
                      ->orWhere('phone', 'LIKE', '%' . $digitsOnly . '%')
                      ->orWhere('mobile_phone', 'LIKE', '%' . $localNumber . '%')
                      ->orWhere('phone', 'LIKE', '%' . $localNumber . '%');
            })->first();
            
            if (!$cliente) {
                // Si no se encuentra, intentar una búsqueda aún más flexible
                $cliente = Cliente::where(function($query) use ($phone) {
                    // Buscar con el número original
                    $query->where('mobile_phone', 'LIKE', '%' . $phone . '%')
                          ->orWhere('phone', 'LIKE', '%' . $phone . '%');
                })->first();
            }
            
            if (!$cliente) {
                \Log::warning('🎙️ [ELEVENLABS] Customer not found for phone: ' . $phone);
                return response()->json([
                    'success' => false,
                    'message' => 'Customer not found',
                    'user_name' => 'Cliente',
                    'account_type' => 'general',
                    'phone_number' => $phone
                ], 404);
            }
            
            // Determinar el tipo de cuenta basado en el estado del cliente
            $accountType = 'general';
            if ($cliente->status === 'active') {
                $accountType = 'premium';
            } elseif ($cliente->status === 'prospect') {
                $accountType = 'prospecto';
            }
            
            \Log::info('🎙️ [ELEVENLABS] Customer found:', [
                'id' => $cliente->id,
                'name' => $cliente->first_name . ' ' . $cliente->last_name,
                'phone' => $phone,
                'account_type' => $accountType
            ]);
            
            // Formato requerido por ElevenLabs
            return response()->json([
                'success' => true,
                'user_name' => trim($cliente->first_name . ' ' . $cliente->last_name),
                'account_type' => $accountType,
                'phone_number' => $phone,
                'customer_id' => $cliente->id,
                'email' => $cliente->email,
                'city' => $cliente->city ?? 'No especificada',
                'status' => $cliente->status,
                'company' => $cliente->company ?? null
            ]);
            
        } catch (\Exception $e) {
            \Log::error('🚨 [ELEVENLABS ERROR] Error getting customer by phone:', [
                'phone' => $phone,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Error retrieving customer information',
                'user_name' => 'Cliente',
                'account_type' => 'general',
                'phone_number' => $phone
            ], 500);
        }
    }
}
