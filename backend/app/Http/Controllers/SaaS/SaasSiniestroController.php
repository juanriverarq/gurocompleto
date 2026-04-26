<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\Siniestro;
use App\Models\User;
use App\Models\Poliza;
use App\Models\Cliente;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class SaasSiniestroController extends Controller
{
    /**
     * Get the broker ID for the current user (supports both Firebase users and employees)
     */
    private function getBrokerId(Request $request)
    {
        \Log::info('🔍 [DEBUG] SaasSiniestroController::getBrokerId - INICIANDO', [
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

        // Solo en desarrollo: Header de desarrollo
        if (app()->environment('local', 'development')) {
            $devBrokerId = $request->header('X-Dev-Broker-Id');
            if ($devBrokerId) {
                \Log::info('✅ [DEBUG] getBrokerId - ENCONTRADO desde header desarrollo', [
                    'broker_id' => (int) $devBrokerId,
                    'source' => 'dev_header'
                ]);
                return (int) $devBrokerId;
            }

            // Solo en desarrollo: Primer broker como último recurso
            $firstBroker = \App\Models\Broker::first();
            if ($firstBroker) {
                \Log::info('✅ [DEBUG] getBrokerId - ENCONTRADO primer broker desarrollo', [
                    'broker_id' => $firstBroker->id,
                    'source' => 'first_broker_dev'
                ]);
                return $firstBroker->id;
            }
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
     * Resolver cliente_id desde el request, permite tanto ID numérico como documento
     */
    private function resolveClienteId(Request $request, $brokerId)
    {
        $clienteId = $request->get('cliente_id');
        
        // Si no se proporciona cliente_id, retornar error
        if (!$clienteId) {
            throw new \Exception('Se requiere cliente_id');
        }
        
        // Si es un número, asumimos que es un ID válido
        if (is_numeric($clienteId)) {
            // Verificar que el cliente existe y pertenece al broker
            $cliente = Cliente::where('id', $clienteId)
                             ->where('broker_id', $brokerId)
                             ->first();
            
            if ($cliente) {
                return $clienteId;
            }
            
            // Si no se encuentra, intentar como documento
            $cliente = Cliente::where('document_number', $clienteId)
                             ->where('broker_id', $brokerId)
                             ->first();
            
            if ($cliente) {
                return $cliente->id;
            }
        } else {
            // Es un string, buscar como documento
            $cliente = Cliente::where('document_number', $clienteId)
                             ->where('broker_id', $brokerId)
                             ->first();
            
            if ($cliente) {
                return $cliente->id;
            }
        }
        
        throw new \Exception('Cliente no encontrado: ' . $clienteId);
    }
    
    /**
     * Normaliza el tipo_seguro recibido desde el frontend o derivado de la póliza
     * para que coincida con los valores permitidos por el ENUM de la BD.
     *
     * ENUM permitido (BD): auto, hogar, vida, salud, empresarial,
     * responsabilidad_civil, transporte, construccion, agropecuario, fianza
     *
     * Mapeos aceptados desde UI:
     *  - automovil/automóvil/autos -> auto
     *  - accidentes -> vida (fallback razonable)
     *  - otros -> empresarial (fallback razonable)
     * Si no se reconoce, se intenta con el tipo de la póliza. Si tampoco, se usa 'auto'.
     */
    private function normalizeTipoSeguro($tipoSeguroInput, $poliza): string
    {
        $map = [
            'autos' => 'auto',
            'automovil' => 'auto',
            'automóvil' => 'auto',
            'otros' => 'empresarial',
            'accidentes' => 'vida',
        ];

        $allowed = array_keys(\App\Models\Siniestro::TIPOS_SEGURO);

        if (!empty($tipoSeguroInput)) {
            $normalized = $map[strtolower((string) $tipoSeguroInput)] ?? strtolower((string) $tipoSeguroInput);
            if (in_array($normalized, $allowed, true)) {
                return $normalized;
            }
        }

        $tipoFromPoliza = $poliza->type ?? null;
        if (!empty($tipoFromPoliza)) {
            $normalizedPoliza = $map[strtolower((string) $tipoFromPoliza)] ?? strtolower((string) $tipoFromPoliza);
            if (in_array($normalizedPoliza, $allowed, true)) {
                return $normalizedPoliza;
            }
        }

        return 'auto';
    }
    /**
     * Display a listing of siniestros with filters and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            // OPTIMIZACIÓN: Eager loading selectivo para mejor rendimiento
            $query = Siniestro::forBroker($brokerId)
                ->with([
                    'cliente:id,first_name,last_name,email,phone',
                    'poliza:id,policy_number,insurance_company,type',
                    'assignedAdjuster:id,name,email',
                    'createdBy:id,name,email'
                ]);

            // Aplicar filtros
            if ($request->filled('search')) {
                $query->searchText($request->search);
            }

            if ($request->filled('estado')) {
                $query->byEstado($request->estado);
            }

            if ($request->filled('tipo_seguro')) {
                $query->byTipoSeguro($request->tipo_seguro);
            }

            if ($request->filled('tipo_siniestro')) {
                $query->byTipoSiniestro($request->tipo_siniestro);
            }

            if ($request->filled('prioridad')) {
                $query->byPrioridad($request->prioridad);
            }

            if ($request->filled('aseguradora')) {
                $query->byAseguradora($request->aseguradora);
            }

            if ($request->filled('assigned_adjuster_id')) {
                $query->forAdjuster($request->assigned_adjuster_id);
            }

            // Filtros de fecha
            if ($request->filled('fecha_desde')) {
                $query->where('fecha_aviso', '>=', $request->fecha_desde);
            }

            if ($request->filled('fecha_hasta')) {
                $query->where('fecha_aviso', '<=', $request->fecha_hasta);
            }

            // Filtros de monto
            if ($request->filled('monto_min')) {
                $query->where('monto_reclamo', '>=', $request->monto_min);
            }

            if ($request->filled('monto_max')) {
                $query->where('monto_reclamo', '<=', $request->monto_max);
            }

            // Filtros booleanos
            if ($request->boolean('active_only')) {
                $query->activeOnly();
            }

            if ($request->boolean('needing_attention')) {
                $query->needingAttention();
            }

            if ($request->boolean('overdue')) {
                $query->overdue();
            }

            if ($request->boolean('high_value')) {
                $query->highValue();
            }

            if ($request->boolean('with_terceros')) {
                $query->withTerceros();
            }

            if ($request->boolean('with_heridos')) {
                $query->withHeridos();
            }

            if ($request->boolean('critical_only')) {
                $query->byPrioridad('critica');
            }

            if ($request->boolean('recently_reported')) {
                $query->recentlyReported();
            }

            // Ordenamiento
            $sortBy = $request->get('sort_by', 'fecha_aviso');
            $sortDirection = $request->get('sort_direction', 'desc');
            $query->orderBy($sortBy, $sortDirection);

            // Paginación
            $perPage = $request->get('per_page', 15);
            $siniestros = $query->paginate($perPage);

            return response()->json($siniestros);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al obtener siniestros',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store a newly created siniestro.
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $authUser = $request->get('authenticated_user') ?? Auth::user();
            $createdById = $authUser?->id;
            if (!$createdById) {
                // Fallback: usar cualquier usuario del broker para mantener integridad referencial
                $createdById = \App\Models\User::where('broker_id', $brokerId)->value('id');
            }
            if (!$createdById) {
                \Log::error('❌ [Siniestros@store] No se encontró usuario para created_by', [
                    'broker_id' => $brokerId,
                    'auth_type' => $request->get('auth_type'),
                    'has_authenticated_user' => (bool) $request->get('authenticated_user'),
                    'has_empleado' => (bool) $request->get('authenticated_empleado')
                ]);
                return response()->json([
                    'error' => 'No se pudo registrar auditoría',
                    'message' => 'No existe un usuario asociado al broker para asignar en created_by. Cree al menos un usuario del broker.'
                ], 500);
            }

            // Resolver cliente_id si se proporciona como documento
            $clienteId = $this->resolveClienteId($request, $brokerId);
            
            // Preparar datos con cliente_id resuelto
            $requestData = $request->all();
            $requestData['cliente_id'] = $clienteId;

            $validator = Validator::make($requestData, [
                'poliza_id' => 'required|exists:polizas,id',
                'cliente_id' => 'required|exists:clientes,id',
                // Permitir que el usuario asigne manualmente el número de siniestro; si no se envía, se autogenera
                'numero_siniestro' => 'nullable|string|max:100|unique:siniestros,numero_siniestro',
                'numero_siniestro_compania' => [
                    'nullable',
                    'string',
                    'max:100',
                    'unique:siniestros,numero_siniestro_compania,NULL,id,broker_id,' . $brokerId
                ],
                'tipo_siniestro' => 'required|in:' . implode(',', array_keys(Siniestro::TIPOS_SINIESTRO_DISPONIBLES)),
                'fecha_ocurrencia' => 'required|date|before_or_equal:today',
                'fecha_aviso' => 'required|date|after_or_equal:fecha_ocurrencia|before_or_equal:today',
                'fecha_notificacion_aseguradora' => 'required|date|after_or_equal:fecha_aviso|before_or_equal:today',
                'proveedor_asignado' => 'nullable|string|max:255',
                'descripcion_hechos' => 'required|string|min:10|max:2000',
                'valor_indemnizacion' => 'nullable|numeric|min:0|max:999999999999',
                'deducible' => 'nullable|numeric|min:0|max:999999999999',
                'resolucion' => 'nullable|string|max:2000',
                'monto_reclamo' => 'required|numeric|min:1|max:999999999999',
                'coaseguros' => 'nullable|numeric|min:0|max:100',
                'finalizado' => 'boolean',
                'estado' => 'nullable|in:' . implode(',', array_keys(Siniestro::ESTADOS)),
                'aseguradora' => 'required|string|max:100',
                'amparos_afectados' => 'nullable|array|max:20',
                'amparos_afectados.*.nombre_reclamante' => 'nullable|string|max:255',
                'amparos_afectados.*.amparo' => 'required|string|max:255',
                'amparos_afectados.*.valor' => 'required|numeric|min:0|max:999999999999',
            ], [
                'fecha_ocurrencia.before_or_equal' => 'La fecha de ocurrencia no puede ser futura',
                'fecha_aviso.after_or_equal' => 'La fecha de aviso debe ser posterior o igual a la fecha de ocurrencia',
                'fecha_notificacion_aseguradora.after_or_equal' => 'La fecha de notificación debe ser posterior o igual a la fecha de aviso',
                'monto_reclamo.min' => 'El monto reclamado debe ser mayor a 0',
                'numero_siniestro_compania.unique' => 'Este número de siniestro ya existe para este broker',
                'descripcion_hechos.min' => 'La descripción debe tener al menos 10 caracteres',
                'coaseguros.max' => 'El coaseguro no puede superar el 100%',
                'amparos_afectados.max' => 'No se pueden registrar más de 20 amparos afectados'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos inválidos',
                    'messages' => $validator->errors()
                ], 422);
            }

            // Verificar que la póliza pertenece al broker y está activa
            $poliza = Poliza::where('id', $request->poliza_id)
                           ->where('broker_id', $brokerId)
                           ->where('status', 'active')
                           ->first();

            if (!$poliza) {
                return response()->json([
                    'error' => 'Póliza no encontrada, no pertenece al broker o no está activa',
                    'detalles' => 'La póliza debe tener status "active" para poder crear un siniestro'
                ], 404);
            }

            // Verificar que no existe un siniestro activo para esta póliza
            $siniestroExistente = Siniestro::where('poliza_id', $request->poliza_id)
                                         ->where('broker_id', $brokerId)
                                         ->whereNotIn('estado', ['rechazado', 'pagado', 'cerrado'])
                                         ->first();

            if ($siniestroExistente) {
                return response()->json([
                    'error' => 'Ya existe un siniestro activo para esta póliza',
                    'siniestro_existente' => [
                        'id' => $siniestroExistente->id,
                        'numero_siniestro' => $siniestroExistente->numero_siniestro,
                        'estado' => $siniestroExistente->estado
                    ]
                ], 409);
            }

            // Determinar tipo_seguro usando normalización contra ENUM de BD
            $tipoSeguro = $this->normalizeTipoSeguro($requestData['tipo_seguro'] ?? null, $poliza);

            // Tomar número de siniestro proporcionado o autogenerar si no viene en el request
            $numeroSiniestro = $requestData['numero_siniestro'] ?? null;
            if (!$numeroSiniestro) {
                $numeroSiniestro = Siniestro::generateSiniestroNumber();
            }

            // Preparar datos para el siniestro
            $siniestroData = [
                'broker_id' => $brokerId,
                'created_by' => $createdById,
                'numero_siniestro' => $numeroSiniestro,
                'numero_poliza' => $poliza->policy_number,
                'poliza_id' => $requestData['poliza_id'],
                'cliente_id' => $requestData['cliente_id'],
                'numero_siniestro_compania' => $requestData['numero_siniestro_compania'] ?? null,
                'tipo_seguro' => $tipoSeguro,
                'tipo_siniestro' => $requestData['tipo_siniestro'],
                'fecha_ocurrencia' => $requestData['fecha_ocurrencia'],
                'fecha_aviso' => $requestData['fecha_aviso'],
                'fecha_notificacion_aseguradora' => $requestData['fecha_notificacion_aseguradora'],
                'fecha_reporte' => $requestData['fecha_reporte'] ?? now(),
                'proveedor_asignado' => $requestData['proveedor_asignado'] ?? null,
                'descripcion_hechos' => $requestData['descripcion_hechos'],
                'descripcion_evento' => $requestData['descripcion_hechos'],
                'valor_indemnizacion' => $requestData['valor_indemnizacion'] ?? 0,
                'deducible' => $requestData['deducible'] ?? 0,
                'resolucion' => $requestData['resolucion'] ?? null,
                'monto_reclamo' => $requestData['monto_reclamo'],
                'monto_reclamado' => $requestData['monto_reclamo'], // Compatibilidad con BD
                'coaseguros' => $requestData['coaseguros'] ?? 0,
                'finalizado' => $requestData['finalizado'] ?? false,
                'estado' => $requestData['estado'] ?? 'reportado',
                'aseguradora' => $requestData['aseguradora'],
                'lugar_ocurrencia' => $requestData['lugar_ocurrencia'] ?? 'No especificado',
                'ciudad_ocurrencia' => $requestData['ciudad_ocurrencia'] ?? 'No especificada',
                'departamento_ocurrencia' => $requestData['departamento_ocurrencia'] ?? 'No especificado',
                'amparos_afectados' => $requestData['amparos_afectados'] ?? [],
            ];

            $siniestro = Siniestro::create($siniestroData);

            // Crear historial inicial usando el método privado
            $historial = $siniestro->historial_estados ?? [];
            $historial[] = [
                'estado_anterior' => '',
                'nuevo_estado' => $siniestro->estado,
                'fecha' => now()->toISOString(),
                'observacion' => 'Siniestro creado con estado: ' . $siniestro->estado,
                'usuario_id' => $createdById,
            ];
            $siniestro->update(['historial_estados' => $historial]);

            $siniestro->load(['cliente', 'poliza', 'assignedAdjuster', 'createdBy']);

            return response()->json([
                'message' => 'Siniestro creado exitosamente',
                'siniestro' => $siniestro
            ], 201);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'error' => 'Hay datos faltantes o inválidos. Revisa los campos marcados.',
                'messages' => $e->errors()
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Error al crear siniestro: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json([
                'error' => 'No se pudo crear el siniestro. Inténtalo de nuevo.'
            ], 500);
        }
    }

    /**
     * Display the specified siniestro.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $siniestro = Siniestro::forBroker($brokerId)
                ->with(['cliente', 'poliza', 'assignedAdjuster', 'createdBy', 'updatedBy', 'auditedBy'])
                ->findOrFail($id);

            return response()->json($siniestro);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Siniestro no encontrado',
                'message' => $e->getMessage()
            ], 404);
        }
    }

    /**
     * Update the specified siniestro.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            // Obtener el usuario autenticado para auditoría
            $user = $request->get('authenticated_user') ?? Auth::user();
            if (!$user) {
                return response()->json([
                    'error' => 'Usuario no autenticado',
                    'message' => 'Debe estar autenticado para realizar esta acción'
                ], 401);
            }

            $siniestro = Siniestro::forBroker($brokerId)->findOrFail($id);

            $validator = Validator::make($request->all(), [
                // Campos básicos del siniestro
                'tipo_seguro' => 'in:auto,hogar,vida,salud,empresarial,responsabilidad_civil,transporte,construccion,agropecuario,fianza',
                'tipo_siniestro' => 'in:' . implode(',', array_keys(Siniestro::TIPOS_SINIESTRO_DISPONIBLES)),
                'fecha_ocurrencia' => 'date|before_or_equal:today',
                'fecha_reporte' => 'date',
                'monto_reclamado' => 'numeric|min:0|max:999999999999',
                'descripcion_evento' => 'string|min:10|max:2000',
                'resolucion' => 'nullable|string|max:2000',
                'lugar_ocurrencia' => 'string|max:255',
                'ciudad_ocurrencia' => 'string|max:100',
                'departamento_ocurrencia' => 'string|max:100',
                'pais_ocurrencia' => 'string|max:100',
                'aseguradora' => 'string|max:100',
                'proveedor_asignado' => 'nullable|string|max:255',
                'prioridad' => 'in:baja,media,alta,critica',
                'estado' => 'in:reportado,asignado,en_revision,investigacion,peritaje,documentos_pendientes,aprobado,aprobado_parcial,rechazado,pagado,cerrado',
                // Permitir actualizar número de siniestro de compañía (único por broker)
                'numero_siniestro_compania' => 'nullable|string|max:100|unique:siniestros,numero_siniestro_compania,' . $id . ',id,broker_id,' . $brokerId,
                
                // Campos relacionados
                'assigned_adjuster_id' => 'nullable|exists:users,id',
                'broker_id' => 'nullable|exists:brokers,id',
                'poliza_id' => 'nullable|exists:polizas,id',
                'cliente_id' => 'nullable|exists:clientes,id',
                
                // Campos de terceros
                'involucra_terceros' => 'boolean',
                'hay_heridos' => 'boolean',
                'hay_danos_materiales' => 'boolean',
                'datos_terceros' => 'nullable|string|max:2000',
                'informacion_heridos' => 'nullable|string|max:2000',
                'danos_materiales' => 'nullable|string|max:2000',
                'causa_siniestro' => 'nullable|string|max:2000',
                
                // Campos de montos
                'monto_aprobado' => 'nullable|numeric|min:0|max:999999999999',
                'monto_pagado' => 'nullable|numeric|min:0|max:999999999999',
                'monto_reserva' => 'nullable|numeric|min:0|max:999999999999',
                'monto_deducible' => 'nullable|numeric|min:0|max:999999999999',
                'monto_coaseguro' => 'nullable|numeric|min:0|max:999999999999',
                // Montos visibles en UI
                'valor_indemnizacion' => 'nullable|numeric|min:0|max:999999999999',
                'deducible' => 'nullable|numeric|min:0|max:999999999999',
                'coaseguros' => 'nullable|numeric|min:0|max:100',
                
                // Campos de evaluación
                'evaluacion_inicial' => 'nullable|string|max:2000',
                'informe_investigacion' => 'nullable|string|max:2000',
                'informe_peritaje' => 'nullable|string|max:2000',
                'dictamen_final' => 'nullable|string|max:2000',
                
                // Campos de rechazo
                'motivo_rechazo' => 'nullable|string|max:2000',
                'tipo_rechazo' => 'nullable|in:documentos_insuficientes,fuera_cobertura,fraude,exclusion_poliza,prescripcion,causa_no_cubierta,falta_pago_prima,otro',
                
                // Campos de pago
                'metodo_pago' => 'nullable|string|max:100',
                'numero_cheque' => 'nullable|string|max:100',
                'numero_transferencia' => 'nullable|string|max:100',
                'cuenta_destino' => 'nullable|string|max:100',
                'beneficiario_pago' => 'nullable|string|max:100',
                
                // Campos de aseguradora
                'numero_poliza_aseguradora' => 'nullable|string|max:100',
                'contacto_aseguradora' => 'nullable|string|max:100',
                'email_aseguradora' => 'nullable|email|max:100',
                'telefono_aseguradora' => 'nullable|string|max:20',
                
                // Campos de ajustador
                'nombre_ajustador' => 'nullable|string|max:255',
                'empresa_ajustadora' => 'nullable|string|max:255',
                'contacto_ajustador' => 'nullable|string|max:100',
                'email_ajustador' => 'nullable|email|max:100',
                'telefono_ajustador' => 'nullable|string|max:20',
                
                // Campos JSON
                'testigos' => 'nullable|array|max:10',
                'testigos.*.nombre' => 'required|string|max:255',
                'testigos.*.telefono' => 'required|string|max:20',
                'testigos.*.cedula' => 'required|string|max:20',
                'datos_vehiculo' => 'nullable|array',
                'datos_inmueble' => 'nullable|array',
                'datos_medicos' => 'nullable|array',
                'datos_empresa' => 'nullable|array',
                'custom_fields' => 'nullable|array',
                
                // Campos de calidad
                'calificacion_servicio' => 'nullable|integer|min:1|max:5',
                'comentarios_cliente' => 'nullable|string|max:2000',
                'cliente_satisfecho' => 'nullable|boolean',
                
                // Campos de recuperación
                'tiene_recuperacion' => 'nullable|boolean',
                'monto_recuperado' => 'nullable|numeric|min:0|max:999999999999',
                'detalles_recuperacion' => 'nullable|string|max:2000',
                
                // Campos de reapertura
                'reabierto' => 'nullable|boolean',
                'motivo_reapertura' => 'nullable|string|max:2000',
                'fecha_reapertura' => 'nullable|date',
            ], [
                'fecha_ocurrencia.before_or_equal' => 'La fecha de ocurrencia no puede ser futura',
                'monto_reclamado.max' => 'El monto reclamado excede el límite permitido',
                'descripcion_evento.min' => 'La descripción debe tener al menos 10 caracteres',
                'testigos.max' => 'No se pueden registrar más de 10 testigos',
                'calificacion_servicio.min' => 'La calificación debe ser entre 1 y 5',
                'calificacion_servicio.max' => 'La calificación debe ser entre 1 y 5',
                'email_aseguradora.email' => 'El email de la aseguradora debe ser válido',
                'email_ajustador.email' => 'El email del ajustador debe ser válido',
                'numero_siniestro_compania.unique' => 'Este número de siniestro ya existe para este broker',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos inválidos',
                    'messages' => $validator->errors()
                ], 422);
            }

            $validated = $validator->validated();
            $siniestro->update(array_merge($validated, ['updated_by' => $user->id]));

            $siniestro->load(['cliente', 'poliza', 'assignedAdjuster', 'createdBy', 'updatedBy']);

            return response()->json([
                'message' => 'Siniestro actualizado exitosamente',
                'siniestro' => $siniestro
            ]);

        } catch (\Exception $e) {
            \Log::error('Error al actualizar siniestro: ' . $e->getMessage(), ['exception' => $e]);
            return response()->json([
                'error' => 'No se pudo actualizar el siniestro. Inténtalo de nuevo.'
            ], 500);
        }
    }

    /**
     * Remove the specified siniestro.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        try {
            $user = Auth::user();
            $brokerId = $this->getBrokerId($request);

            $siniestro = Siniestro::forBroker($brokerId)->findOrFail($id);

            // No permitir eliminar siniestros pagados
            if ($siniestro->estado === 'pagado') {
                return response()->json([
                    'error' => 'No se puede eliminar un siniestro pagado'
                ], 400);
            }

            $siniestro->delete();

            return response()->json([
                'message' => 'Siniestro eliminado exitosamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al eliminar siniestro',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get statistics for siniestros.
     */
    public function statistics(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $statistics = Siniestro::getStatistics($brokerId);

            return response()->json($statistics);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al obtener estadísticas',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get siniestros needing attention.
     */
    public function needingAttention(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $siniestros = Siniestro::forBroker($brokerId)
                ->needingAttention()
                ->with(['cliente', 'poliza', 'assignedAdjuster'])
                ->orderBy('prioridad', 'desc')
                ->orderBy('fecha_aviso', 'asc')
                ->get();

            return response()->json($siniestros);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al obtener siniestros que necesitan atención',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Change siniestro state.
     */
    public function changeState(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $validator = Validator::make($request->all(), [
                'estado' => 'required|in:' . implode(',', array_keys(Siniestro::ESTADOS)),
                'observacion' => 'nullable|string|max:500',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos inválidos',
                    'messages' => $validator->errors()
                ], 422);
            }

            $siniestro = Siniestro::forBroker($brokerId)->findOrFail($id);

            // Validar que la transición de estado sea permitida
            if (!$siniestro->canTransitionTo($request->estado)) {
                return response()->json([
                    'error' => 'Transición de estado no permitida',
                    'estado_actual' => $siniestro->estado,
                    'estado_solicitado' => $request->estado,
                    'message' => 'No se puede cambiar del estado actual al estado solicitado'
                ], 400);
            }

            $siniestro->changeEstado($request->estado, $request->observacion);

            $siniestro->load(['cliente', 'poliza', 'assignedAdjuster']);

            return response()->json([
                'message' => 'Estado cambiado exitosamente',
                'siniestro' => $siniestro
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al cambiar estado',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Assign adjuster to siniestro.
     */
    public function assignAdjuster(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $validator = Validator::make($request->all(), [
                'adjuster_id' => 'required|exists:users,id',
                'observacion' => 'nullable|string|max:500',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos inválidos',
                    'messages' => $validator->errors()
                ], 422);
            }

            $siniestro = Siniestro::forBroker($brokerId)->findOrFail($id);

            $siniestro->assignAdjuster($request->adjuster_id, $request->observacion);

            $siniestro->load(['cliente', 'poliza', 'assignedAdjuster']);

            return response()->json([
                'message' => 'Ajustador asignado exitosamente',
                'siniestro' => $siniestro
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al asignar ajustador',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Approve siniestro.
     */
    public function approve(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $validator = Validator::make($request->all(), [
                'monto_aprobado' => 'required|numeric|min:0',
                'observacion' => 'nullable|string|max:500',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos inválidos',
                    'messages' => $validator->errors()
                ], 422);
            }

            $siniestro = Siniestro::forBroker($brokerId)->findOrFail($id);

            if (!$siniestro->can_approve) {
                return response()->json([
                    'error' => 'El siniestro no puede ser aprobado en su estado actual'
                ], 400);
            }

            $siniestro->approve($request->monto_aprobado, $request->observacion);

            $siniestro->load(['cliente', 'poliza', 'assignedAdjuster']);

            return response()->json([
                'message' => 'Siniestro aprobado exitosamente',
                'siniestro' => $siniestro
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al aprobar siniestro',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reject siniestro.
     */
    public function reject(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $validator = Validator::make($request->all(), [
                'motivo' => 'required|string|max:500',
                'tipo_rechazo' => 'nullable|in:' . implode(',', array_keys(Siniestro::TIPOS_RECHAZO)),
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos inválidos',
                    'messages' => $validator->errors()
                ], 422);
            }

            $siniestro = Siniestro::forBroker($brokerId)->findOrFail($id);

            if (!$siniestro->can_reject) {
                return response()->json([
                    'error' => 'El siniestro no puede ser rechazado en su estado actual'
                ], 400);
            }

            $siniestro->reject($request->motivo, $request->tipo_rechazo);

            $siniestro->load(['cliente', 'poliza', 'assignedAdjuster']);

            return response()->json([
                'message' => 'Siniestro rechazado exitosamente',
                'siniestro' => $siniestro
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al rechazar siniestro',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Pay siniestro.
     */
    public function pay(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $validator = Validator::make($request->all(), [
                'monto_pagado' => 'required|numeric|min:0',
                'metodo_pago' => 'required|string|max:50',
                'numero_cheque' => 'nullable|string|max:100',
                'numero_transferencia' => 'nullable|string|max:100',
                'cuenta_destino' => 'nullable|string|max:100',
                'beneficiario_pago' => 'nullable|string|max:100',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos inválidos',
                    'messages' => $validator->errors()
                ], 422);
            }

            $siniestro = Siniestro::forBroker($brokerId)->findOrFail($id);

            if (!$siniestro->can_pay) {
                return response()->json([
                    'error' => 'El siniestro no puede ser pagado en su estado actual'
                ], 400);
            }

            $datosPago = $request->only([
                'numero_cheque', 'numero_transferencia', 
                'cuenta_destino', 'beneficiario_pago'
            ]);

            $siniestro->pay($request->monto_pagado, $request->metodo_pago, $datosPago);

            $siniestro->load(['cliente', 'poliza', 'assignedAdjuster']);

            return response()->json([
                'message' => 'Siniestro pagado exitosamente',
                'siniestro' => $siniestro
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al pagar siniestro',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reopen siniestro.
     */
    public function reopen(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $validator = Validator::make($request->all(), [
                'motivo' => 'required|string|max:500',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos inválidos',
                    'messages' => $validator->errors()
                ], 422);
            }

            $siniestro = Siniestro::forBroker($brokerId)->findOrFail($id);

            if (!$siniestro->can_reopen) {
                return response()->json([
                    'error' => 'El siniestro no puede ser reabierto'
                ], 400);
            }

            $siniestro->reopen($request->motivo);

            $siniestro->load(['cliente', 'poliza', 'assignedAdjuster']);

            return response()->json([
                'message' => 'Siniestro reabierto exitosamente',
                'siniestro' => $siniestro
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al reabrir siniestro',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Close siniestro.
     */
    public function close(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $validator = Validator::make($request->all(), [
                'observacion' => 'nullable|string|max:500',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos inválidos',
                    'messages' => $validator->errors()
                ], 422);
            }

            $siniestro = Siniestro::forBroker($brokerId)->findOrFail($id);

            $siniestro->close($request->observacion);

            $siniestro->load(['cliente', 'poliza', 'assignedAdjuster']);

            return response()->json([
                'message' => 'Siniestro cerrado exitosamente',
                'siniestro' => $siniestro
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al cerrar siniestro',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Add communication to siniestro.
     */
    public function addCommunication(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $user = Auth::user();

            $validator = Validator::make($request->all(), [
                'tipo' => 'required|string|max:50',
                'contenido' => 'required|string|max:1000',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos inválidos',
                    'messages' => $validator->errors()
                ], 422);
            }

            $siniestro = Siniestro::forBroker($brokerId)->findOrFail($id);

            $siniestro->addComunicacion($request->tipo, $request->contenido, $user->id);

            return response()->json([
                'message' => 'Comunicación agregada exitosamente',
                'siniestro' => $siniestro
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al agregar comunicación',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Add observation to siniestro.
     */
    public function addObservation(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $user = Auth::user();

            $validator = Validator::make($request->all(), [
                'observacion' => 'required|string|max:1000',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos inválidos',
                    'messages' => $validator->errors()
                ], 422);
            }

            $siniestro = Siniestro::forBroker($brokerId)->findOrFail($id);

            $siniestro->addObservacion($request->observacion, $user->id);

            return response()->json([
                'message' => 'Observación agregada exitosamente',
                'siniestro' => $siniestro
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al agregar observación',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get available adjusters.
     */
    public function getAvailableAdjusters(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $adjusters = User::where('broker_id', $brokerId)
                ->where('is_active', true)
                ->whereHas('roles', function ($query) {
                    $query->where('name', 'adjuster');
                })
                ->select('id', 'name', 'email')
                ->get();

            return response()->json($adjusters);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al obtener ajustadores',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get constants for siniestros.
     */
    public function getConstants(Request $request): JsonResponse
    {
        try {
            return response()->json([
                'tipos_siniestro_disponibles' => Siniestro::TIPOS_SINIESTRO_DISPONIBLES,
                'tipos_siniestro' => Siniestro::TIPOS_SINIESTRO,
                'estados' => Siniestro::ESTADOS,
                'prioridades' => Siniestro::PRIORIDADES,
                'tipos_rechazo' => Siniestro::TIPOS_RECHAZO,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al obtener constantes',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Exportar siniestros en formato Excel o CSV
     */
    public function exportarSiniestros(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            // OPTIMIZACIÓN: Eager loading selectivo para mejor rendimiento
            $query = Siniestro::forBroker($brokerId)
                ->with([
                    'cliente:id,first_name,last_name,email,phone',
                    'poliza:id,policy_number,insurance_company,type',
                    'assignedAdjuster:id,name,email',
                    'createdBy:id,name,email'
                ]);

            // Aplicar filtros (copiado del método index)
            if ($request->filled('search')) {
                $query->searchText($request->search);
            }

            if ($request->filled('estado')) {
                $query->byEstado($request->estado);
            }

            if ($request->filled('tipo_seguro')) {
                $query->byTipoSeguro($request->tipo_seguro);
            }

            if ($request->filled('tipo_siniestro')) {
                $query->byTipoSiniestro($request->tipo_siniestro);
            }

            if ($request->filled('prioridad')) {
                $query->byPrioridad($request->prioridad);
            }

            if ($request->filled('aseguradora')) {
                $query->byAseguradora($request->aseguradora);
            }

            if ($request->filled('assigned_adjuster_id')) {
                $query->forAdjuster($request->assigned_adjuster_id);
            }

            // Filtros de fecha
            if ($request->filled('fecha_desde')) {
                $query->where('fecha_reporte', '>=', $request->fecha_desde);
            }

            if ($request->filled('fecha_hasta')) {
                $query->where('fecha_reporte', '<=', $request->fecha_hasta);
            }

            // Filtros de monto
            if ($request->filled('monto_min')) {
                $query->where('monto_reclamo', '>=', $request->monto_min);
            }

            if ($request->filled('monto_max')) {
                $query->where('monto_reclamo', '<=', $request->monto_max);
            }

            // Filtros booleanos
            if ($request->boolean('active_only')) {
                $query->activeOnly();
            }

            if ($request->boolean('needing_attention')) {
                $query->needingAttention();
            }

            if ($request->boolean('overdue')) {
                $query->overdue();
            }

            if ($request->boolean('high_value')) {
                $query->highValue();
            }

            if ($request->boolean('with_terceros')) {
                $query->withTerceros();
            }

            if ($request->boolean('with_heridos')) {
                $query->withHeridos();
            }

            if ($request->boolean('critical_only')) {
                $query->byPrioridad('critica');
            }

            if ($request->boolean('recently_reported')) {
                $query->recentlyReported();
            }

            // Obtener siniestros
            $siniestros = $query->get();

            // Determinar formato
            $formato = $request->get('formato', 'excel');

            if ($formato === 'csv') {
                return $this->exportarSiniestrosCSV($siniestros);
            } else {
                return $this->exportarSiniestrosExcel($siniestros);
            }

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al exportar siniestros',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Exportar siniestros a CSV
     */
    private function exportarSiniestrosCSV($siniestros)
    {
        $csvData = [];
        $csvData[] = [
            'Número Siniestro',
            'Número Póliza',
            'Cliente',
            'Documento Cliente',
            'Aseguradora',
            'Tipo Seguro',
            'Tipo Siniestro',
            'Fecha Ocurrencia',
            'Fecha Reporte',
            'Estado',
            'Prioridad',
            'Monto Reclamado',
            'Monto Aprobado',
            'Monto Pagado',
            'Ajustador Asignado',
            'Días Trámite',
            'Lugar Ocurrencia',
            'Ciudad Ocurrencia',
            'Descripción',
            'Fecha Creación',
        ];

        foreach ($siniestros as $siniestro) {
            $csvData[] = [
                $siniestro->numero_siniestro,
                $siniestro->numero_poliza,
                $siniestro->cliente ? trim(($siniestro->cliente->first_name ?? '') . ' ' . ($siniestro->cliente->last_name ?? '')) : '',
                $siniestro->cliente ? $siniestro->cliente->document_number : '',
                $siniestro->aseguradora,
                $siniestro->tipo_seguro_name ?? $siniestro->tipo_seguro,
                $siniestro->tipo_siniestro_name ?? $siniestro->tipo_siniestro,
                $siniestro->fecha_ocurrencia ? Carbon::parse($siniestro->fecha_ocurrencia)->format('Y-m-d') : '',
                $siniestro->fecha_reporte ? Carbon::parse($siniestro->fecha_reporte)->format('Y-m-d H:i:s') : '',
                $siniestro->estado_name ?? $siniestro->estado,
                $siniestro->prioridad_name ?? $siniestro->prioridad,
                $siniestro->monto_reclamado ?? 0,
                $siniestro->monto_aprobado ?? 0,
                $siniestro->monto_pagado ?? 0,
                $siniestro->assignedAdjuster ? $siniestro->assignedAdjuster->name : '',
                $siniestro->dias_tramite ?? 0,
                $siniestro->lugar_ocurrencia ?? '',
                $siniestro->ciudad_ocurrencia ?? '',
                substr($siniestro->descripcion_hechos ?? '', 0, 500), // Limitar descripción
                $siniestro->created_at ? Carbon::parse($siniestro->created_at)->format('Y-m-d H:i:s') : '',
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
            'Content-Disposition' => 'attachment; filename="siniestros_' . date('Y-m-d_H-i-s') . '.csv"',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0'
        ]);
    }

    /**
     * Exportar siniestros a Excel
     */
    private function exportarSiniestrosExcel($siniestros)
    {
        // Verificar si tenemos la librería PhpSpreadsheet
        if (!class_exists('\PhpOffice\PhpSpreadsheet\Spreadsheet')) {
            throw new \Exception('La librería PhpSpreadsheet no está instalada. Instale con: composer require phpoffice/phpspreadsheet');
        }

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();

        // Encabezados
        $headers = [
            'Número Siniestro',
            'Número Póliza',
            'Cliente',
            'Documento Cliente',
            'Aseguradora',
            'Tipo Seguro',
            'Tipo Siniestro',
            'Fecha Ocurrencia',
            'Fecha Reporte',
            'Estado',
            'Prioridad',
            'Monto Reclamado',
            'Monto Aprobado',
            'Monto Pagado',
            'Ajustador Asignado',
            'Días Trámite',
            'Lugar Ocurrencia',
            'Ciudad Ocurrencia',
            'Descripción',
            'Fecha Creación',
        ];

        foreach ($headers as $col => $header) {
            $sheet->setCellValueByColumnAndRow($col + 1, 1, $header);
            $sheet->getStyleByColumnAndRow($col + 1, 1)->getFont()->setBold(true);
        }

        // Datos
        $row = 2;
        foreach ($siniestros as $siniestro) {
            $sheet->setCellValueByColumnAndRow(1, $row, $siniestro->numero_siniestro);
            $sheet->setCellValueByColumnAndRow(2, $row, $siniestro->numero_poliza);
            $sheet->setCellValueByColumnAndRow(3, $row, $siniestro->cliente ? trim(($siniestro->cliente->first_name ?? '') . ' ' . ($siniestro->cliente->last_name ?? '')) : '');
            $sheet->setCellValueByColumnAndRow(4, $row, $siniestro->cliente ? $siniestro->cliente->document_number : '');
            $sheet->setCellValueByColumnAndRow(5, $row, $siniestro->aseguradora);
            $sheet->setCellValueByColumnAndRow(6, $row, $siniestro->tipo_seguro_name ?? $siniestro->tipo_seguro);
            $sheet->setCellValueByColumnAndRow(7, $row, $siniestro->tipo_siniestro_name ?? $siniestro->tipo_siniestro);
            $sheet->setCellValueByColumnAndRow(8, $row, $siniestro->fecha_ocurrencia ? Carbon::parse($siniestro->fecha_ocurrencia)->format('Y-m-d') : '');
            $sheet->setCellValueByColumnAndRow(9, $row, $siniestro->fecha_reporte ? Carbon::parse($siniestro->fecha_reporte)->format('Y-m-d H:i:s') : '');
            $sheet->setCellValueByColumnAndRow(10, $row, $siniestro->estado_name ?? $siniestro->estado);
            $sheet->setCellValueByColumnAndRow(11, $row, $siniestro->prioridad_name ?? $siniestro->prioridad);
            $sheet->setCellValueByColumnAndRow(12, $row, $siniestro->monto_reclamado ?? 0);
            $sheet->setCellValueByColumnAndRow(13, $row, $siniestro->monto_aprobado ?? 0);
            $sheet->setCellValueByColumnAndRow(14, $row, $siniestro->monto_pagado ?? 0);
            $sheet->setCellValueByColumnAndRow(15, $row, $siniestro->assignedAdjuster ? $siniestro->assignedAdjuster->name : '');
            $sheet->setCellValueByColumnAndRow(16, $row, $siniestro->dias_tramite ?? 0);
            $sheet->setCellValueByColumnAndRow(17, $row, $siniestro->lugar_ocurrencia ?? '');
            $sheet->setCellValueByColumnAndRow(18, $row, $siniestro->ciudad_ocurrencia ?? '');
            $sheet->setCellValueByColumnAndRow(19, $row, substr($siniestro->descripcion_hechos ?? '', 0, 500));
            $sheet->setCellValueByColumnAndRow(20, $row, $siniestro->created_at ? Carbon::parse($siniestro->created_at)->format('Y-m-d H:i:s') : '');

            // Formato de números para montos
            $sheet->getStyleByColumnAndRow(12, $row)->getNumberFormat()->setFormatCode('#,##0');
            $sheet->getStyleByColumnAndRow(13, $row)->getNumberFormat()->setFormatCode('#,##0');
            $sheet->getStyleByColumnAndRow(14, $row)->getNumberFormat()->setFormatCode('#,##0');

            $row++;
        }

        // Autoajustar columnas
        foreach (range('A', 'T') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        // Crear archivo Excel
        $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
        $filename = 'siniestros_' . date('Y-m-d_H-i-s') . '.xlsx';

        // Guardar en memoria y devolver
        ob_start();
        $writer->save('php://output');
        $excelContent = ob_get_clean();

        return response($excelContent, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0'
        ]);
    }


    /**
     * Display a listing of siniestros without authentication (Development version)
     */
    public function indexDev(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            // OPTIMIZACIÓN: Eager loading selectivo para mejor rendimiento
            $query = Siniestro::forBroker($brokerId)
                ->with([
                    'cliente:id,first_name,last_name,email,phone',
                    'poliza:id,policy_number,insurance_company,type',
                    'assignedAdjuster:id,name,email',
                    'createdBy:id,name,email'
                ]);

            // Aplicar filtros (copiado del método index original)
            if ($request->filled('search')) {
                $query->searchText($request->search);
            }

            if ($request->filled('estado')) {
                $query->byEstado($request->estado);
            }

            if ($request->filled('tipo_seguro')) {
                $query->byTipoSeguro($request->tipo_seguro);
            }

            if ($request->filled('tipo_siniestro')) {
                $query->byTipoSiniestro($request->tipo_siniestro);
            }

            if ($request->filled('prioridad')) {
                $query->byPrioridad($request->prioridad);
            }

            if ($request->filled('aseguradora')) {
                $query->byAseguradora($request->aseguradora);
            }

            if ($request->filled('assigned_adjuster_id')) {
                $query->forAdjuster($request->assigned_adjuster_id);
            }

            // Filtros de fecha
            if ($request->filled('fecha_desde')) {
                $query->where('fecha_reporte', '>=', $request->fecha_desde);
            }

            if ($request->filled('fecha_hasta')) {
                $query->where('fecha_reporte', '<=', $request->fecha_hasta);
            }

            // Filtros booleanos
            if ($request->boolean('active_only')) {
                $query->activeOnly();
            }

            if ($request->boolean('needing_attention')) {
                $query->needingAttention();
            }

            if ($request->boolean('overdue')) {
                $query->overdue();
            }

            // Ordenamiento
            $sortBy = $request->get('sort_by', 'fecha_reporte');
            $sortDirection = $request->get('sort_direction', 'desc');
            $query->orderBy($sortBy, $sortDirection);

            // Paginación
            $perPage = $request->get('per_page', 15);
            $siniestros = $query->paginate($perPage);

            return response()->json($siniestros);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al obtener siniestros',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store a newly created siniestro without authentication (Development version)
     */
    public function storeDev(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            // Obtener el usuario autenticado actual
            $user = Auth::user();
            if (!$user) {
                return response()->json([
                    'error' => 'Usuario no autenticado',
                    'message' => 'Debe estar autenticado para realizar esta acción'
                ], 401);
            }

            $validator = Validator::make($request->all(), [
                'poliza_id' => 'required|exists:polizas,id',
                'cliente_id' => 'required|exists:clientes,id',
                'tipo_seguro' => 'nullable|in:' . implode(',', array_keys(Siniestro::TIPOS_SEGURO)),
                'tipo_siniestro' => 'required|in:' . implode(',', array_keys(Siniestro::TIPOS_SINIESTRO_DISPONIBLES)),
                'fecha_ocurrencia' => 'required|date',
                'fecha_reporte' => 'nullable|date',
                'monto_reclamo' => 'required|numeric|min:0',
                'descripcion_hechos' => 'required|string|max:1000',
                'lugar_ocurrencia' => 'nullable|string|max:255',
                'ciudad_ocurrencia' => 'nullable|string|max:100',
                'departamento_ocurrencia' => 'nullable|string|max:100',
                'aseguradora' => 'required|string|max:100',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos inválidos',
                    'messages' => $validator->errors()
                ], 422);
            }

            // Obtener la póliza para extraer el número de póliza
            $poliza = \App\Models\Poliza::findOrFail($request->poliza_id);

            // Generar número de siniestro
            $numeroSiniestro = Siniestro::generateSiniestroNumber();

            $siniestro = Siniestro::create([
                'broker_id' => $brokerId,
                'created_by' => $user->id,
                'numero_siniestro' => $numeroSiniestro,
                'numero_poliza' => $poliza->policy_number,
                'poliza_id' => $request->poliza_id,
                'cliente_id' => $request->cliente_id,
                'tipo_siniestro' => $request->tipo_siniestro,
                'fecha_ocurrencia' => $request->fecha_ocurrencia,
                'fecha_aviso' => $request->fecha_ocurrencia,
                'fecha_reporte' => now(),
                'monto_reclamo' => $request->monto_reclamo,
                'monto_reclamado' => $request->monto_reclamo, // Mapear a campo de BD
                'descripcion_hechos' => $request->descripcion_hechos,
                'descripcion_evento' => $request->descripcion_hechos, // Mapear a campo de BD
                'aseguradora' => $request->aseguradora,
                'estado' => 'reportado',
                'prioridad' => 'media',
                'pais_ocurrencia' => 'Colombia',
                'total_documentos' => 0,
                'dias_tramite' => 0,
                'lugar_ocurrencia' => $request->lugar_ocurrencia ?? 'No especificado',
                'ciudad_ocurrencia' => $request->ciudad_ocurrencia ?? 'No especificada',
                'departamento_ocurrencia' => $request->departamento_ocurrencia ?? 'No especificado',
            ]);

            $siniestro->load(['cliente', 'poliza', 'assignedAdjuster', 'createdBy']);

            return response()->json([
                'message' => 'Siniestro creado exitosamente',
                'siniestro' => $siniestro
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al crear siniestro',
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ], 500);
        }
    }

    /**
     * Get statistics without authentication (Development version)
     */
    public function statisticsDev(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $statistics = Siniestro::getStatistics($brokerId);
            return response()->json($statistics);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al obtener estadísticas',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Show siniestro without authentication (Development version)
     */
    public function showDev(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $siniestro = Siniestro::forBroker($brokerId)
                ->with(['cliente', 'poliza', 'assignedAdjuster', 'createdBy'])
                ->findOrFail($id);

            return response()->json($siniestro);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Siniestro no encontrado',
                'message' => $e->getMessage()
            ], 404);
        }
    }

    // Agregar los demás métodos Dev usando el mismo patrón...
    public function updateDev(Request $request, int $id): JsonResponse 
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            // Obtener el usuario autenticado actual
            $user = Auth::user();
            if (!$user) {
                return response()->json([
                    'error' => 'Usuario no autenticado',
                    'message' => 'Debe estar autenticado para realizar esta acción'
                ], 401);
            }

            $siniestro = Siniestro::forBroker($brokerId)->findOrFail($id);

            $validator = Validator::make($request->all(), [
                'tipo_seguro' => 'in:' . implode(',', array_keys(Siniestro::TIPOS_SEGURO)),
                'tipo_siniestro' => 'in:' . implode(',', array_keys(Siniestro::TIPOS_SINIESTRO)),
                'fecha_ocurrencia' => 'date|before_or_equal:today',
                'monto_reclamado' => 'numeric|min:0|max:999999999999',
                'descripcion_evento' => 'string|min:10|max:1000',
                'lugar_ocurrencia' => 'string|max:255',
                'ciudad_ocurrencia' => 'string|max:100',
                'departamento_ocurrencia' => 'string|max:100',
                'aseguradora' => 'string|max:100',
                'prioridad' => 'in:' . implode(',', array_keys(Siniestro::PRIORIDADES)),
                'assigned_adjuster_id' => 'nullable|exists:users,id',
                'involucra_terceros' => 'boolean',
                'hay_heridos' => 'boolean',
                'hay_danos_materiales' => 'boolean',
                'datos_terceros' => 'nullable|string|max:1000',
                'informacion_heridos' => 'nullable|string|max:1000',
                'danos_materiales' => 'nullable|string|max:1000',
                'causa_siniestro' => 'nullable|string|max:500',
                'testigos' => 'nullable|array|max:10',
                'testigos.*.nombre' => 'required|string|max:255',
                'testigos.*.telefono' => 'required|string|max:20',
                'testigos.*.cedula' => 'required|string|max:20',
                'datos_vehiculo' => 'nullable|array',
                'datos_vehiculo.marca' => 'required_with:datos_vehiculo|string|max:50',
                'datos_vehiculo.modelo' => 'required_with:datos_vehiculo|string|max:50',
                'datos_vehiculo.año' => 'required_with:datos_vehiculo|integer|min:1900|max:' . (date('Y') + 1),
                'datos_vehiculo.placa' => 'required_with:datos_vehiculo|string|max:20',
                'datos_inmueble' => 'nullable|array',
                'datos_medicos' => 'nullable|array',
                'datos_empresa' => 'nullable|array',
            ], [
                'fecha_ocurrencia.before_or_equal' => 'La fecha de ocurrencia no puede ser futura',
                'monto_reclamado.max' => 'El monto reclamado excede el límite permitido',
                'descripcion_evento.min' => 'La descripción debe tener al menos 10 caracteres',
                'testigos.max' => 'No se pueden registrar más de 10 testigos',
                'datos_vehiculo.año.max' => 'El año del vehículo no puede ser futuro'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos inválidos',
                    'messages' => $validator->errors()
                ], 422);
            }

            $siniestro->update($request->all() + ['updated_by' => $user->id]);

            $siniestro->load(['cliente', 'poliza', 'assignedAdjuster', 'createdBy', 'updatedBy']);

            return response()->json([
                'message' => 'Siniestro actualizado exitosamente',
                'siniestro' => $siniestro
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al actualizar siniestro',
                'message' => $e->getMessage()
            ], 500);
        }
    }
    public function destroyDev(Request $request, int $id): JsonResponse { return $this->destroy($request, $id); }
    public function needingAttentionDev(Request $request): JsonResponse { return $this->needingAttention($request); }
    public function getAvailableAdjustersDev(Request $request): JsonResponse { return $this->getAvailableAdjusters($request); }
    public function getConstantsDev(Request $request): JsonResponse { return $this->getConstants($request); }
    public function changeStateDev(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $validator = Validator::make($request->all(), [
                'estado' => 'required|in:' . implode(',', array_keys(Siniestro::ESTADOS)),
                'observacion' => 'nullable|string|max:500',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos inválidos',
                    'messages' => $validator->errors()
                ], 422);
            }

            $siniestro = Siniestro::forBroker($brokerId)->findOrFail($id);

            $siniestro->changeEstado($request->estado, $request->observacion);

            $siniestro->load(['cliente', 'poliza', 'assignedAdjuster']);

            return response()->json([
                'message' => 'Estado cambiado exitosamente',
                'siniestro' => $siniestro
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al cambiar estado',
                'message' => $e->getMessage()
            ], 500);
        }
    }
    public function assignAdjusterDev(Request $request, int $id): JsonResponse { return $this->assignAdjuster($request, $id); }
    public function approveDev(Request $request, int $id): JsonResponse { return $this->approve($request, $id); }
    public function rejectDev(Request $request, int $id): JsonResponse { return $this->reject($request, $id); }
    public function payDev(Request $request, int $id): JsonResponse { return $this->pay($request, $id); }
    public function reopenDev(Request $request, int $id): JsonResponse { return $this->reopen($request, $id); }
    public function closeDev(Request $request, int $id): JsonResponse { return $this->close($request, $id); }
    public function addCommunicationDev(Request $request, int $id): JsonResponse { return $this->addCommunication($request, $id); }
    public function addObservationDev(Request $request, int $id): JsonResponse { return $this->addObservation($request, $id); }

    /**
     * Método de debug para crear siniestro sin validaciones de seguridad (solo para testing)
     */
    public function storeDebug(Request $request): JsonResponse
    {
        try {
            // Usar broker_id fijo para testing
            $brokerId = 21; // Broker ID del error reportado

            // Obtener el usuario autenticado actual
            $user = Auth::user();
            if (!$user) {
                return response()->json([
                    'error' => 'Usuario no autenticado',
                    'message' => 'Debe estar autenticado para realizar esta acción'
                ], 401);
            }

            // Validación básica
            $validator = Validator::make($request->all(), [
                'poliza_id' => 'required|exists:polizas,id',
                'cliente_id' => 'required|exists:clientes,id',
                'tipo_siniestro' => 'required|in:' . implode(',', array_keys(Siniestro::TIPOS_SINIESTRO)),
                'fecha_ocurrencia' => 'required|date',
                'monto_reclamo' => 'required|numeric|min:0',
                'descripcion_hechos' => 'required|string',
                'aseguradora' => 'required|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos inválidos',
                    'messages' => $validator->errors()
                ], 422);
            }

            // Obtener la póliza SIN validación de status para debug
            $poliza = \App\Models\Poliza::findOrFail($request->poliza_id);

            // Generar número de siniestro
            $numeroSiniestro = Siniestro::generateSiniestroNumber();

            $siniestro = Siniestro::create([
                'broker_id' => $brokerId,
                'created_by' => $user->id,
                'numero_siniestro' => $numeroSiniestro,
                'numero_poliza' => $poliza->policy_number,
                'poliza_id' => $request->poliza_id,
                'cliente_id' => $request->cliente_id,
                'tipo_siniestro' => $request->tipo_siniestro,
                'fecha_ocurrencia' => $request->fecha_ocurrencia,
                'fecha_aviso' => $request->fecha_ocurrencia,
                'fecha_reporte' => now(),
                'monto_reclamo' => $request->monto_reclamo,
                'monto_reclamado' => $request->monto_reclamo, // Mapear a campo de BD
                'descripcion_hechos' => $request->descripcion_hechos,
                'descripcion_evento' => $request->descripcion_hechos, // Mapear a campo de BD
                'aseguradora' => $request->aseguradora,
                'estado' => 'reportado',
                'prioridad' => 'media',
                'lugar_ocurrencia' => $request->lugar_ocurrencia ?? 'No especificado',
                'ciudad_ocurrencia' => $request->ciudad_ocurrencia ?? 'No especificada',
                'departamento_ocurrencia' => $request->departamento_ocurrencia ?? 'No especificado',
            ]);

            $siniestro->load(['cliente', 'poliza']);

            return response()->json([
                'message' => 'Siniestro creado exitosamente (modo debug)',
                'siniestro' => $siniestro,
                'debug_info' => [
                    'broker_id_used' => $brokerId,
                    'poliza_status' => $poliza->status,
                    'user_id' => $user->id
                ]
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al crear siniestro (modo debug)',
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'line' => $e->getLine(),
                'file' => basename($e->getFile())
            ], 500);
        }
    }
}
