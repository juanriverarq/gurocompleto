<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Campaign;
use App\Models\CampaignExecution;
use App\Models\CampaignMessage;
use App\Http\Controllers\WhatsAppBasicController;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Carbon\Carbon;
use App\Traits\RequiresAuth;
use App\Services\AuthService;

class CampaignController extends Controller
{
    use RequiresAuth;
    

    /**
     * Get the broker ID for the current user (DEPRECATED - usar AuthService)
     * @deprecated Usar AuthService::getBrokerId() en su lugar
     */
    private function getBrokerIdOld(Request $request)
    {
        Log::info('🔍 [GET BROKER ID] Iniciando getBrokerId', [
            'timestamp' => now()->toISOString()
        ]);
        
        // Intentar obtener el usuario autenticado (Firebase middleware lo asigna)
        $user = $request->user();
        
        Log::info('🔍 [GET BROKER ID] Usuario desde request->user()', [
            'user_found' => $user !== null,
            'user_data' => $user ? [
                'id' => $user->id,
                'email' => $user->email,
                'broker_id' => $user->broker_id,
                'user_type' => $user->user_type
            ] : null
        ]);
        
        // Si no hay usuario, intentar obtenerlo de Auth (fallback)
        if (!$user) {
            $user = auth()->user();
            Log::info('🔍 [GET BROKER ID] Usuario desde auth()->user() (fallback)', [
                'user_found' => $user !== null,
                'user_data' => $user ? [
                    'id' => $user->id,
                    'email' => $user->email,
                    'broker_id' => $user->broker_id,
                    'user_type' => $user->user_type
                ] : null
            ]);
        }
        
        if ($user && $user->broker_id) {
            Log::info('✅ [GET BROKER ID] Broker ID encontrado', [
                'broker_id' => $user->broker_id,
                'user_id' => $user->id,
                'user_email' => $user->email
            ]);
            return $user->broker_id;
        }
        
        // Si no hay usuario autenticado, lanzar excepción
        if (!$user) {
            Log::error('🚨 [GET BROKER ID] Usuario no autenticado');
            throw new \Exception('Usuario no autenticado');
        }
        
        // Si el usuario no tiene broker_id, lanzar excepción
        if (!$user->broker_id) {
            Log::error('🚨 [GET BROKER ID] Usuario sin broker_id', [
                'user_id' => $user->id,
                'user_email' => $user->email,
                'broker_id' => $user->broker_id
            ]);
            throw new \Exception('Usuario no tiene un broker asignado');
        }
        
        return null; // Nunca debería llegar aquí
    }

    /**
     * Obtener todas las campañas
     */
    public function index(Request $request): JsonResponse
    {
        try {
            // Obtener broker_id dinámicamente (misma lógica que SaasClientesController)
            $brokerId = $this->getBrokerId($request);
            
            // Debug log
            \Log::info('🔍 [DEBUG] CampaignController::index', [
                'broker_id' => $brokerId,
                'user_from_request' => $request->user() ? [
                    'id' => $request->user()->id,
                    'email' => $request->user()->email,
                    'broker_id' => $request->user()->broker_id
                ] : null
            ]);
            
            // Verificar cuántas campañas hay para este broker
            $totalCampaignsForBroker = Campaign::where('broker_id', $brokerId)->count();
            \Log::info('🔍 [DEBUG] Total campañas para broker', [
                'broker_id' => $brokerId,
                'total_campaigns' => $totalCampaignsForBroker
            ]);

            $query = Campaign::forBroker($brokerId);

            // Aplicar filtros
            if ($request->has('type')) {
                $query->ofType($request->type);
            }

            if ($request->has('status')) {
                $query->withStatus($request->status);
            }

            if ($request->has('active')) {
                $query->where('is_active', $request->boolean('active'));
            }

            // Paginación
            $limit = $request->get('limit', 15);
            $offset = $request->get('offset', 0);

            $campaigns = $query->orderBy('created_at', 'desc')
                            ->skip($offset)
                            ->take($limit)
                            ->get();

            $total = $query->count();

            return response()->json([
                'success' => true,
                'data' => $campaigns,
                'total' => $total,
                'limit' => $limit,
                'offset' => $offset
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener campañas',
                'error' => $e->getMessage()
            ], 500);
        }
    }


    /**
     * Obtener una campaña específica
     */
    public function show($id): JsonResponse
    {
        try {
            $campaign = Campaign::with('executions')->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $campaign
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Campaña no encontrada',
                'error' => $e->getMessage()
            ], 404);
        }
    }

    /**
     * Crear campaña inmediata
     */
    public function createImmediate(Request $request): JsonResponse
    {
        try {
            // Debug: Log incoming request data
            \Log::info('🚀 [CAMPAIGN DEBUG] createImmediate called', [
                'request_data' => $request->all(),
                'user' => $request->user() ? [
                    'id' => $request->user()->id,
                    'email' => $request->user()->email,
                    'broker_id' => $request->user()->broker_id
                ] : null
            ]);

            // Obtener el broker_id del usuario autenticado ANTES de la validación
            $brokerId = $this->getBrokerId($request);
            
            if (!$brokerId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Broker no encontrado para el usuario'
                ], 403);
            }

            // Validación dinámica según si se seleccionan todos los clientes o específicos
            $rules = [
                'name' => 'required|string|max:255',
                'description' => 'nullable|string',
                'message_template' => 'required|string',
                'select_all_clients' => 'nullable|boolean',
                'whatsapp_instance_id' => 'nullable|integer|exists:whats_app_instances,id',
                // Media opcional (si ya se subió por /media-upload)
                'media_url' => 'nullable|url',
                'media_type' => 'nullable|in:image'
            ];

            // Solo validar contacts si no se están seleccionando todos los clientes
            if (!$request->boolean('select_all_clients')) {
                $rules['contacts'] = 'required|array|min:1';
                $rules['contacts.*.phone'] = 'required|string';
                $rules['contacts.*.name'] = 'nullable|string';
                $rules['contacts.*.policy_id'] = 'nullable|string';
                $rules['contacts.*.custom_data'] = 'nullable|array';
            }

            $validator = Validator::make($request->all(), $rules);

            if ($validator->fails()) {
                \Log::error('🚀 [CAMPAIGN DEBUG] Validation failed', [
                    'errors' => $validator->errors()->toArray(),
                    'request_data' => $request->all()
                ]);
                return response()->json([
                    'success' => false,
                    'message' => 'Datos de entrada inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Validar que la instancia (si viene) pertenezca al broker autenticado
            if ($request->filled('whatsapp_instance_id')) {
                $selectedInstance = \App\Models\WhatsAppInstance::find($request->whatsapp_instance_id);
                if (!$selectedInstance) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Instancia de WhatsApp no encontrada',
                        'errors' => ['whatsapp_instance_id' => ['not_found']]
                    ], 422);
                }
                if ((int)$selectedInstance->broker_id !== (int)$brokerId) {
                    return response()->json([
                        'success' => false,
                        'message' => 'La instancia seleccionada no pertenece a tu broker',
                        'errors' => ['whatsapp_instance_id' => ['broker_mismatch']]
                    ], 422);
                }
            }

            // Determinar los contactos finales
            $finalContacts = $request->contacts;
            $totalTargets = 0;

            if ($request->boolean('select_all_clients')) {
                // Cargar todos los clientes activos del broker
                $clients = \App\Models\Cliente::where('broker_id', $brokerId)
                    ->whereIn('estado', ['active', 'activo', 'prospect'])
                    ->whereNotNull('celular_principal')
                    ->get();

                $finalContacts = $clients->map(function($client) {
                    return [
                        'id' => $client->id,
                        'name' => $client->nombre . ' ' . $client->apellidos,
                        'phone' => $client->celular_principal,
                        'email' => $client->email_principal,
                        'nombre' => $client->nombre,
                        'apellidos' => $client->apellidos,
                        'email_principal' => $client->email_principal,
                        'celular_principal' => $client->celular_principal,
                        'cuit' => $client->cuit,
                        'fecha_nacimiento' => $client->fecha_nacimiento,
                        'direccion' => $client->direccion,
                        'ciudad' => $client->ciudad,
                        'ocupacion' => $client->ocupacion,
                        'estado' => $client->estado,
                        'tipo_documento' => $client->tipo_documento
                    ];
                })->toArray();

                $totalTargets = count($finalContacts);

                \Log::info('🎯 [CAMPAIGN] Usando todos los clientes del broker', [
                    'broker_id' => $brokerId,
                    'total_clients' => $totalTargets
                ]);
            } else {
                $totalTargets = count($request->contacts ?? []);
                \Log::info('🎯 [CAMPAIGN] Usando clientes específicos', [
                    'total_contacts' => $totalTargets
                ]);
            }

            // 🔄 AUTO-ASIGNACIÓN: Si no se especificó instancia, buscar una automáticamente
            $whatsappInstanceId = $request->whatsapp_instance_id;
            
            if (!$whatsappInstanceId) {
                Log::info('🔍 [CREATE CAMPAIGN] No se especificó instancia, buscando automáticamente...', [
                    'broker_id' => $brokerId
                ]);
                
                $autoInstance = \App\Models\WhatsAppInstance::query()
                    ->where('broker_id', $brokerId)
                    ->whereNotNull('instance_id')
                    ->where('is_active', true)
                    ->orderByDesc('updated_at')
                    ->first();
                
                if ($autoInstance) {
                    $whatsappInstanceId = $autoInstance->id;
                    Log::info('✅ [CREATE CAMPAIGN] Instancia asignada automáticamente', [
                        'whatsapp_instance_id' => $whatsappInstanceId,
                        'instance_id' => $autoInstance->instance_id
                    ]);
                    
                    // Sincronizar con microservicio
                    $this->ensureInstanceExistsInMicroservice($autoInstance);
                } else {
                    Log::warning('⚠️ [CREATE CAMPAIGN] No se encontró instancia automática, campaña sin instancia', [
                        'broker_id' => $brokerId
                    ]);
                }
            }
            
            $campaign = Campaign::create([
                'broker_id' => $brokerId,
                'name' => $request->name,
                'description' => $request->description,
                'campaign_type' => 'immediate',
                'message_template' => $request->message_template,
                'contacts' => $finalContacts,
                'status' => 'draft',
                'total_targets' => $totalTargets,
                'created_by' => auth()->id() ?? null,
                'whatsapp_instance_id' => $whatsappInstanceId
            ]);

            // Guardar media (si viene) para soportar envíos con imagen
            try {
                if ($request->filled('media_url')) {
                    $campaign->media_url = $request->input('media_url');
                    $campaign->media_type = $request->input('media_type', 'image');
                    $campaign->save();
                }
            } catch (\Throwable $e) {
                \Log::warning('⚠️ [CREATE IMMEDIATE] No se pudo guardar media en campaña', [
                    'campaign_id' => $campaign->id,
                    'error' => $e->getMessage()
                ]);
            }

            \Log::info('🚀 [CREATE IMMEDIATE] Campaña creada, iniciando ejecución automática', [
                'campaign_id' => $campaign->id,
                'total_targets' => $totalTargets,
                'broker_id' => $brokerId
            ]);

            // NUEVO: Para campañas inmediatas, ejecutar automáticamente usando ElevenLabs
            try {
                // Crear nueva ejecución
                $execution = CampaignExecution::create([
                    'campaign_id' => $campaign->id,
                    'broker_id' => $brokerId,
                    'execution_date' => now(),
                    'status' => 'pending',
                    'started_at' => now(),
                    'targets_found' => $totalTargets
                ]);

                // Actualizar estado a activa y ejecutar usando ElevenLabs
                $campaign->update([
                    'status' => 'active',
                    'is_active' => true,
                    'last_execution' => now()
                ]);

                // Ejecutar envío de WhatsApp para cada contacto
                return $this->executeImmediateCampaign($campaign, $execution);

            } catch (\Exception $executionError) {
                \Log::error('❌ [CREATE IMMEDIATE] Error ejecutando campaña', [
                    'campaign_id' => $campaign->id,
                    'error' => $executionError->getMessage(),
                    'trace' => $executionError->getTraceAsString()
                ]);

                // Marcar campaña como fallida
                $campaign->update(['status' => 'failed']);

                return response()->json([
                    'success' => false,
                    'message' => 'Campaña creada pero falló la ejecución: ' . $executionError->getMessage(),
                    'campaign' => $campaign,
                    'error' => $executionError->getMessage()
                ], 500);
            }

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al crear campaña inmediata',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Crear campaña programada
     */
    public function createScheduled(Request $request): JsonResponse
    {
        try {
            // Obtener el broker_id del usuario autenticado ANTES de la validación
            $brokerId = $this->getBrokerId($request);
            
            if (!$brokerId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Broker no encontrado para el usuario'
                ], 403);
            }

            // Validación dinámica según si se seleccionan todos los clientes o específicos
            $rules = [
                'name' => 'required|string|max:255',
                'description' => 'nullable|string',
                'campaign_type' => 'required|in:scheduled',
                'message_template' => 'required|string',
                'scheduled_date' => 'required|date|after:5 minutes',
                'select_all_clients' => 'nullable|boolean',
                'whatsapp_instance_id' => 'nullable|integer|exists:whats_app_instances,id',
                // Media opcional (para ejecución futura)
                'media_url' => 'nullable|url',
                'media_type' => 'nullable|in:image'
            ];

            // Solo validar contacts si no se están seleccionando todos los clientes
            if (!$request->boolean('select_all_clients')) {
                $rules['contacts'] = 'required|array|min:1';
                $rules['contacts.*.phone'] = 'required|string';
                $rules['contacts.*.name'] = 'nullable|string';
                $rules['contacts.*.policy_id'] = 'nullable|string';
                $rules['contacts.*.custom_data'] = 'nullable|array';
            }

            $validator = Validator::make($request->all(), $rules);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Datos de entrada inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Validar que la instancia (si viene) pertenezca al broker autenticado
            if ($request->filled('whatsapp_instance_id')) {
                $selectedInstance = \App\Models\WhatsAppInstance::find($request->whatsapp_instance_id);
                if (!$selectedInstance) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Instancia de WhatsApp no encontrada',
                        'errors' => ['whatsapp_instance_id' => ['not_found']]
                    ], 422);
                }
                if ((int)$selectedInstance->broker_id !== (int)$brokerId) {
                    return response()->json([
                        'success' => false,
                        'message' => 'La instancia seleccionada no pertenece a tu broker',
                        'errors' => ['whatsapp_instance_id' => ['broker_mismatch']]
                    ], 422);
                }
            }

            // Determinar los contactos finales (misma lógica que createImmediate)
            $finalContacts = $request->contacts;
            $totalTargets = 0;

            if ($request->boolean('select_all_clients')) {
                // Cargar todos los clientes activos del broker
                $clients = \App\Models\Cliente::where('broker_id', $brokerId)
                    ->whereIn('estado', ['active', 'activo', 'prospect'])
                    ->whereNotNull('celular_principal')
                    ->get();

                $finalContacts = $clients->map(function($client) {
                    return [
                        'id' => $client->id,
                        'name' => $client->nombre . ' ' . $client->apellidos,
                        'phone' => $client->celular_principal,
                        'email' => $client->email_principal,
                        'nombre' => $client->nombre,
                        'apellidos' => $client->apellidos,
                        'email_principal' => $client->email_principal,
                        'celular_principal' => $client->celular_principal,
                        'cuit' => $client->cuit,
                        'fecha_nacimiento' => $client->fecha_nacimiento,
                        'direccion' => $client->direccion,
                        'ciudad' => $client->ciudad,
                        'ocupacion' => $client->ocupacion,
                        'estado' => $client->estado,
                        'tipo_documento' => $client->tipo_documento
                    ];
                })->toArray();

                $totalTargets = count($finalContacts);

                \Log::info('🎯 [SCHEDULED CAMPAIGN] Usando todos los clientes del broker', [
                    'broker_id' => $brokerId,
                    'total_clients' => $totalTargets
                ]);
            } else {
                $totalTargets = count($request->contacts ?? []);
                \Log::info('🎯 [SCHEDULED CAMPAIGN] Usando clientes específicos', [
                    'total_contacts' => $totalTargets
                ]);
            }

            // 🔄 AUTO-ASIGNACIÓN: Si no se especificó instancia, buscar una automáticamente
            $whatsappInstanceId = $request->whatsapp_instance_id;
            
            if (!$whatsappInstanceId) {
                Log::info('🔍 [CREATE SCHEDULED] No se especificó instancia, buscando automáticamente...', [
                    'broker_id' => $brokerId
                ]);
                
                $autoInstance = \App\Models\WhatsAppInstance::query()
                    ->where('broker_id', $brokerId)
                    ->whereNotNull('instance_id')
                    ->where('is_active', true)
                    ->orderByDesc('updated_at')
                    ->first();
                
                if ($autoInstance) {
                    $whatsappInstanceId = $autoInstance->id;
                    Log::info('✅ [CREATE SCHEDULED] Instancia asignada automáticamente', [
                        'whatsapp_instance_id' => $whatsappInstanceId,
                        'instance_id' => $autoInstance->instance_id
                    ]);
                }
            }
            
            $campaign = Campaign::create([
                'broker_id' => $brokerId,
                'name' => $request->name,
                'description' => $request->description,
                'campaign_type' => 'scheduled',
                'message_template' => $request->message_template,
                'contacts' => $finalContacts,
                'scheduled_date' => $request->scheduled_date,
                'status' => 'scheduled',
                'total_targets' => $totalTargets,
                'next_execution' => $request->scheduled_date,
                'created_by' => auth()->id() ?? null,
                'whatsapp_instance_id' => $whatsappInstanceId
            ]);

            // Guardar media (si viene) para que el scheduler la use
            try {
                if ($request->filled('media_url')) {
                    $campaign->media_url = $request->input('media_url');
                    $campaign->media_type = $request->input('media_type', 'image');
                    $campaign->save();
                }
            } catch (\Throwable $e) {
                \Log::warning('⚠️ [CREATE SCHEDULED] No se pudo guardar media en campaña', [
                    'campaign_id' => $campaign->id,
                    'error' => $e->getMessage()
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Campaña programada creada exitosamente',
                'data' => $campaign
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al crear campaña programada',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Crear campaña basada en pólizas
     */
    public function createPolicyBased(Request $request): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'name' => 'required|string|max:255',
                'description' => 'nullable|string',
                'campaign_type' => 'required|in:policy_reminder,expired_policy,about_to_expire',
                'message_template' => 'required|string',
                'trigger_conditions' => 'required|array',
                'schedule_config' => 'required|array',
                'target_filters' => 'nullable|array'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Datos de entrada inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Obtener el broker_id del usuario autenticado (misma lógica que index())
            $brokerId = $this->getBrokerId($request);
            
            if (!$brokerId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Broker no encontrado para el usuario'
                ], 403);
            }

            $campaign = Campaign::create([
                'broker_id' => $brokerId,
                'name' => $request->name,
                'description' => $request->description,
                'campaign_type' => $request->campaign_type,
                'message_template' => $request->message_template,
                'trigger_conditions' => $request->trigger_conditions,
                'schedule_config' => $request->schedule_config,
                'target_filters' => $request->target_filters,
                'status' => 'draft',
                'created_by' => auth()->id() ?? null
            ]);

            // Si es ejecución inmediata, programar la próxima ejecución
            if ($request->schedule_config['execution_type'] === 'immediate') {
                $campaign->update(['next_execution' => now()]);
            } elseif ($request->schedule_config['execution_type'] === 'scheduled') {
                $campaign->update(['next_execution' => $request->schedule_config['scheduled_date']]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Campaña de pólizas creada exitosamente',
                'data' => $campaign
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al crear campaña de pólizas',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener historial de envíos de campañas - USANDO SISTEMA CENTRALIZADO
     */
    public function getSendHistory(Request $request): JsonResponse
    {
        // Usar el wrapper centralizado para autenticación
        return $this->executeWithAuth($request, function ($user, $brokerId, $broker) use ($request) {
            Log::info('✅ [SEND HISTORY] Método getSendHistory con AuthService', [
                'url' => $request->fullUrl(),
                'method' => $request->method(),
                'broker_id' => $brokerId,
                'user_id' => $user->id,
                'user_email' => $user->email,
                'timestamp' => now()->toISOString()
            ]);

            // Construir query principal para obtener mensajes con información de campaña y ejecución
            $query = CampaignMessage::query()
                ->join('campaigns', 'campaign_messages.campaign_id', '=', 'campaigns.id')
                ->leftJoin('campaign_executions', 'campaign_messages.campaign_execution_id', '=', 'campaign_executions.id')
                ->where('campaign_messages.broker_id', $brokerId)
                ->select([
                    'campaign_messages.*',
                    'campaigns.name as campaign_name',
                    'campaigns.campaign_type',
                    'campaigns.description as campaign_description',
                    'campaign_executions.execution_date',
                    'campaign_executions.status as execution_status'
                ]);

            // Filtros opcionales
            if ($request->has('campaign_id')) {
                $query->where('campaign_messages.campaign_id', $request->campaign_id);
            }

            if ($request->has('status')) {
                $query->where('campaign_messages.status', $request->status);
            }

            if ($request->has('phone')) {
                $query->where('campaign_messages.recipient_phone', 'LIKE', '%' . $request->phone . '%');
            }

            if ($request->has('date_from')) {
                $query->whereDate('campaign_messages.created_at', '>=', $request->date_from);
            }

            if ($request->has('date_to')) {
                $query->whereDate('campaign_messages.created_at', '<=', $request->date_to);
            }

            // Paginación
            $limit = $request->get('limit', 15);
            $offset = $request->get('offset', 0);

            $messages = $query->orderBy('campaign_messages.created_at', 'desc')
                             ->skip($offset)
                             ->take($limit)
                             ->get()
                             ->map(function ($message) {
                                 return [
                                     'id' => $message->id,
                                     'campaign_id' => $message->campaign_id,
                                     'campaign_name' => $message->campaign_name,
                                     'campaign_type' => $message->campaign_type,
                                     'campaign_description' => $message->campaign_description,
                                     'execution_id' => $message->campaign_execution_id,
                                     'execution_date' => $message->execution_date,
                                     'execution_status' => $message->execution_status,
                                     'recipient_phone' => $message->recipient_phone,
                                     'recipient_name' => $message->recipient_name,
                                     'message_content' => $message->message_content,
                                     'status' => $message->status,
                                     'sent_at' => $message->sent_at,
                                     'delivered_at' => $message->delivered_at,
                                     'read_at' => $message->read_at,
                                     'failed_at' => $message->failed_at,
                                     'whatsapp_message_id' => $message->whatsapp_message_id,
                                     'error_message' => $message->error_message,
                                     'created_at' => $message->created_at,
                                     'updated_at' => $message->updated_at,
                                     // Campos calculados
                                     'delivery_time' => $message->sent_at && $message->delivered_at ? 
                                         \Carbon\Carbon::parse($message->sent_at)->diffInSeconds(\Carbon\Carbon::parse($message->delivered_at)) : null,
                                     'is_recent' => $message->created_at ? 
                                         \Carbon\Carbon::parse($message->created_at)->diffInHours(now()) < 24 : false
                                 ];
                             });

            $total = $query->count();

            // Estadísticas adicionales para el historial
            $stats = [
                'total_messages' => $total,
                'sent_count' => CampaignMessage::where('broker_id', $brokerId)->where('status', 'sent')->count(),
                'delivered_count' => CampaignMessage::where('broker_id', $brokerId)->where('status', 'delivered')->count(),
                'failed_count' => CampaignMessage::where('broker_id', $brokerId)->where('status', 'failed')->count(),
                'pending_count' => CampaignMessage::where('broker_id', $brokerId)->where('status', 'pending')->count(),
                'read_count' => CampaignMessage::where('broker_id', $brokerId)->whereNotNull('read_at')->count(),
                'delivery_rate' => 0,
                'recent_messages_24h' => CampaignMessage::where('broker_id', $brokerId)
                    ->where('created_at', '>=', now()->subHours(24))->count()
            ];

            // Calcular tasa de entrega
            if ($stats['sent_count'] > 0) {
                $stats['delivery_rate'] = round(($stats['delivered_count'] / $stats['sent_count']) * 100, 2);
            }

            return response()->json([
                'success' => true,
                'data' => $messages,
                'total' => $total,
                'limit' => $limit,
                'offset' => $offset,
                'stats' => $stats
            ]);
        });
    }

    /**
     * Actualizar campaña
     */
    public function update(Request $request, $id): JsonResponse
    {
        try {
            $campaign = Campaign::findOrFail($id);

            // No permitir actualizar campañas en ejecución o completadas
            if (in_array($campaign->status, ['sending', 'completed'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se puede actualizar una campaña en ejecución o completada'
                ], 422);
            }

            $campaign->update($request->only([
                'name', 'description', 'message_template', 'contacts',
                'scheduled_date', 'trigger_conditions', 'schedule_config',
                'target_filters', 'status', 'is_active'
            ]));

            return response()->json([
                'success' => true,
                'message' => 'Campaña actualizada exitosamente',
                'data' => $campaign
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar campaña',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Eliminar campaña
     * - Permite eliminar campañas en estado: draft, scheduled, active, paused, completed, cancelled, failed
     * - Bloquea únicamente si está "sending"
     * - Elimina en cascada mensajes y ejecuciones para evitar errores por FK
     */
    public function destroy($id): JsonResponse
    {
        try {
            $campaign = Campaign::findOrFail($id);

            // No permitir eliminar campañas en ejecución activa
            if ($campaign->status === 'sending') {
                return response()->json([
                    'success' => false,
                    'message' => 'No se puede eliminar una campaña en ejecución'
                ], 422);
            }

            // Eliminar en cascada para evitar restricciones de FK en campañas "enviadas" o "finalizadas"
            DB::transaction(function () use ($campaign) {
                CampaignMessage::where('campaign_id', $campaign->id)->delete();
                CampaignExecution::where('campaign_id', $campaign->id)->delete();
                $campaign->delete();
            });

            return response()->json([
                'success' => true,
                'message' => 'Campaña eliminada exitosamente'
            ]);

        } catch (\Throwable $e) {
            \Log::error('❌ [CAMPAIGNS] Error al eliminar campaña', [
                'campaign_id' => $id,
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar campaña',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Activar/Pausar campaña
     */
    public function toggle($id): JsonResponse
    {
        try {
            Log::info('🎯 [CAMPAIGN] Toggle endpoint called', [
                'campaign_id' => $id,
                'method' => request()->getMethod(),
                'url' => request()->fullUrl(),
                'user_id' => auth()->id(),
                'timestamp' => now()->toISOString()
            ]);

            $campaign = Campaign::findOrFail($id);

            $wasActive = $campaign->is_active;
            $newIsActive = !$campaign->is_active;
            
            // Lógica correcta para el estado
            $newStatus = $newIsActive ? 'active' : 'paused';
            
            $campaign->update([
                'is_active' => $newIsActive,
                'status' => $newStatus
            ]);

            Log::info('🎯 [CAMPAIGN] Campaign status updated', [
                'campaign_id' => $id,
                'was_active' => $wasActive,
                'now_active' => $campaign->is_active,
                'old_status' => $campaign->getOriginal('status'),
                'new_status' => $campaign->status
            ]);

            // Si se está activando la campaña, ejecutarla automáticamente
            if (!$wasActive && $campaign->is_active) {
                Log::info('🎯 [CAMPAIGN] Activating and executing campaign', [
                    'campaign_id' => $id
                ]);
                return $this->activateAndExecute($campaign);
            }

            return response()->json([
                'success' => true,
                'message' => $campaign->is_active ? 'Campaña activada' : 'Campaña pausada',
                'is_active' => $campaign->is_active
            ]);

        } catch (\Exception $e) {
            Log::error('🎯 [CAMPAIGN] Error in toggle endpoint', [
                'campaign_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al cambiar estado de campaña',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Activar campaña y ejecutarla automáticamente
     */
    public function activate($id): JsonResponse
    {
        try {
            $campaign = Campaign::findOrFail($id);
            
            // Activar la campaña
            $campaign->update([
                'is_active' => true,
                'status' => 'active'
            ]);

            return $this->activateAndExecute($campaign);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al activar campaña',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Lógica interna para activar y ejecutar campaña
     */
    private function activateAndExecute(Campaign $campaign): JsonResponse
    {
        try {
            Log::info('Activando campaña y iniciando ejecución', [
                'campaign_id' => $campaign->id,
                'campaign_type' => $campaign->campaign_type,
                'campaign_name' => $campaign->name
            ]);

            // Crear nueva ejecución
            $execution = CampaignExecution::create([
                'campaign_id' => $campaign->id,
                'broker_id' => $campaign->broker_id,
                'execution_date' => now(),
                'status' => 'pending',
                'started_at' => now(),
                'targets_found' => $campaign->total_targets ?? 0
            ]);

            // Según el tipo de campaña, ejecutar inmediatamente o programar
            if ($campaign->campaign_type === 'immediate') {
                return $this->executeImmediateCampaign($campaign, $execution);
            } elseif ($campaign->campaign_type === 'scheduled') {
                return $this->scheduleExecution($campaign, $execution);
            } else {
                // Campañas basadas en pólizas (policy_reminder, expired_policy, about_to_expire)
                return $this->executePolicyBasedCampaign($campaign, $execution);
            }

        } catch (\Exception $e) {
            Log::error('Error en activateAndExecute', [
                'campaign_id' => $campaign->id,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al ejecutar campaña',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Ejecutar campaña inmediata
     */
    private function executeImmediateCampaign(Campaign $campaign, CampaignExecution $execution): JsonResponse
    {
        try {
            // Preparar contactos para envío masivo según formato del microservicio
            $contacts = [];
            $campaignContacts = $campaign->contacts ?? [];

            foreach ($campaignContacts as $contact) {
                $formattedPhone = $this->formatPhoneNumber($contact['phone']);
                
                // Verificar si ya existe un mensaje enviado para este contacto en esta campaña
                $existingMessage = CampaignMessage::existsForCampaignAndPhone($campaign->id, $formattedPhone);
                
                if ($existingMessage) {
                    Log::info('Mensaje ya existe para este contacto, omitiendo', [
                        'campaign_id' => $campaign->id,
                        'phone' => $formattedPhone
                    ]);
                    continue;
                }
                
                // Crear mensaje personalizado para este contacto (soporta {nombre} y {{name}})
                $personalizedMessage = $this->processMessageVariables(
                    $campaign->message_template,
                    $contact
                );
                
                // Incluir mensaje personalizado directamente en el payload por contacto
                $contacts[] = [
                    'phone' => $formattedPhone,
                    'name' => $contact['name'] ?? null,
                    'message' => $personalizedMessage
                ];
                
                // Crear registro de mensaje para tracking
                CampaignMessage::create([
                    'campaign_id' => $campaign->id,
                    'campaign_execution_id' => $execution->id,
                    'broker_id' => $campaign->broker_id,
                    'recipient_phone' => $formattedPhone,
                    'recipient_name' => $contact['name'] ?? null,
                    'message_content' => $personalizedMessage,
                    'status' => CampaignMessage::STATUS_PENDING
                ]);
            }

            // Si no hay contactos válidos, finalizar sin enviar
            if (count($contacts) === 0) {
                $execution->update([
                    'status' => 'completed',
                    'targets_found' => 0,
                    'messages_sent' => 0,
                    'messages_failed' => 0,
                    'completed_at' => now()
                ]);

                $campaign->update([
                    'status' => 'completed',
                    'last_execution' => now()
                ]);

                Log::info('ℹ️ [CAMPAIGN] Ejecución finalizada sin contactos, no se envía al microservicio', [
                    'campaign_id' => $campaign->id,
                    'execution_id' => $execution->id
                ]);

                return response()->json([
                    'success' => true,
                    'message' => 'Campaña sin contactos válidos. Marcada como completada.',
                    'campaign_id' => $campaign->id,
                    'execution_id' => $execution->id,
                    'total_messages' => 0,
                    'campaign' => $campaign->fresh()
                ]);
            }

            // Actualizar estado de la ejecución
            $execution->update([
                'status' => 'running',
                'targets_found' => count($contacts)
            ]);

            $campaign->update([
                'status' => 'sending',
                'last_execution' => now()
            ]);

            // Personalizar mensaje template
            $messageTemplate = $campaign->message_template;

            // Llamar al servicio de WhatsApp para envío masivo
            $whatsappResponse = $this->sendBulkWhatsAppMessagesToMicroservice($contacts, $messageTemplate, $campaign->id, $execution->id);

            if ($whatsappResponse['success']) {
                Log::info('Campaña inmediata iniciada exitosamente', [
                    'campaign_id' => $campaign->id,
                    'execution_id' => $execution->id,
                    'total_messages' => count($contacts)
                ]);

                return response()->json([
                    'success' => true,
                    'message' => 'Campaña activada y envío iniciado',
                    'campaign_id' => $campaign->id,
                    'execution_id' => $execution->id,
                    'total_messages' => count($contacts),
                    'campaign' => $campaign->fresh()
                ]);
            } else {
                // Error en el envío
                $execution->update([
                    'status' => 'failed',
                    'error_message' => $whatsappResponse['error'] ?? 'Error desconocido',
                    'completed_at' => now()
                ]);

                $campaign->update(['status' => 'failed']);

                return response()->json([
                    'success' => false,
                    'message' => 'Error al iniciar envío masivo',
                    'error' => $whatsappResponse['error'] ?? 'Error desconocido',
                    'campaign' => $campaign->fresh()
                ], 500);
            }

        } catch (\Exception $e) {
            Log::error('Error ejecutando campaña inmediata', [
                'campaign_id' => $campaign->id,
                'execution_id' => $execution->id,
                'error' => $e->getMessage()
            ]);

            $execution->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'completed_at' => now()
            ]);

            $campaign->update(['status' => 'failed']);

            throw $e;
        }
    }

    /**
     * Programar ejecución para campaña programada
     */
    private function scheduleExecution(Campaign $campaign, CampaignExecution $execution): JsonResponse
    {
        try {
            $scheduledDate = Carbon::parse($campaign->scheduled_date);
            
            if ($scheduledDate->isPast()) {
                // Si la fecha programada ya pasó, ejecutar inmediatamente
                return $this->executeImmediateCampaign($campaign, $execution);
            }

            // Programar para más tarde (esto se manejaría con jobs/cron)
            $execution->update([
                'status' => 'scheduled',
                'execution_date' => $scheduledDate
            ]);

            $campaign->update([
                'status' => 'scheduled',
                'next_execution' => $scheduledDate
            ]);

            Log::info('Campaña programada para ejecución futura', [
                'campaign_id' => $campaign->id,
                'execution_id' => $execution->id,
                'scheduled_date' => $scheduledDate->toISOString()
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Campaña activada y programada para: ' . $scheduledDate->format('d/m/Y H:i'),
                'campaign_id' => $campaign->id,
                'execution_id' => $execution->id,
                'scheduled_date' => $scheduledDate->toISOString()
            ]);

        } catch (\Exception $e) {
            Log::error('Error programando campaña', [
                'campaign_id' => $campaign->id,
                'error' => $e->getMessage()
            ]);

            throw $e;
        }
    }

    /**
     * Ejecutar campaña basada en pólizas
     */
    private function executePolicyBasedCampaign(Campaign $campaign, CampaignExecution $execution): JsonResponse
    {
        try {
            // TODO: Implementar lógica para obtener clientes según condiciones de pólizas
            // Por ahora simulamos algunos contactos
            $contacts = $this->getPolicyBasedContacts($campaign);

            if (empty($contacts)) {
                $execution->update([
                    'status' => 'completed',
                    'targets_found' => 0,
                    'messages_sent' => 0,
                    'completed_at' => now()
                ]);

                $campaign->update(['status' => 'completed']);

                return response()->json([
                    'success' => true,
                    'message' => 'Campaña activada pero no se encontraron objetivos que cumplan las condiciones',
                    'campaign_id' => $campaign->id,
                    'execution_id' => $execution->id,
                    'targets_found' => 0
                ]);
            }

            // Preparar mensajes
            $messages = [];
            foreach ($contacts as $contact) {
                // Usar el mismo procesador robusto que soporta {nombre}, {name}, {{name}}, etc.
                $personalizedMessage = $this->processMessageVariables(
                    $campaign->message_template,
                    $contact
                );

                $messages[] = [
                    'phone' => $this->formatPhoneNumber($contact['phone']),
                    'message' => $personalizedMessage,
                    'name' => $contact['name'] ?? null
                ];
            }

            // Ejecutar igual que campaña inmediata
            $execution->update([
                'status' => 'running',
                'targets_found' => count($messages)
            ]);

            $campaign->update([
                'status' => 'sending',
                'last_execution' => now(),
                'total_targets' => count($messages)
            ]);

            $whatsappResponse = $this->sendBulkWhatsAppMessages($messages, $campaign->id, $execution->id);

            if ($whatsappResponse['success']) {
                return response()->json([
                    'success' => true,
                    'message' => 'Campaña de pólizas activada y envío iniciado',
                    'campaign_id' => $campaign->id,
                    'execution_id' => $execution->id,
                    'total_messages' => count($messages),
                    'work_file' => $whatsappResponse['work_file'] ?? null
                ]);
            } else {
                $execution->update([
                    'status' => 'failed',
                    'error_message' => $whatsappResponse['error'] ?? 'Error desconocido',
                    'completed_at' => now()
                ]);

                $campaign->update(['status' => 'failed']);

                return response()->json([
                    'success' => false,
                    'message' => 'Error al iniciar envío masivo',
                    'error' => $whatsappResponse['error'] ?? 'Error desconocido'
                ], 500);
            }

        } catch (\Exception $e) {
            Log::error('Error ejecutando campaña basada en pólizas', [
                'campaign_id' => $campaign->id,
                'error' => $e->getMessage()
            ]);

            throw $e;
        }
    }

    /**
     * Obtener contactos basados en condiciones de pólizas
     */
    private function getPolicyBasedContacts(Campaign $campaign): array
    {
        // TODO: Implementar consulta real a base de datos de pólizas
        // Por ahora retornamos datos simulados
        return [
            [
                'name' => 'Juan Pérez',
                'phone' => '573001234567',
                'policy_number' => 'POL-2024-001',
                'policy_type' => 'Auto',
                'expiry_date' => '2024-08-15'
            ],
            [
                'name' => 'María García', 
                'phone' => '573009876543',
                'policy_number' => 'POL-2024-002',
                'policy_type' => 'Hogar',
                'expiry_date' => '2024-08-20'
            ]
        ];
    }

    /**
     * Personalizar mensaje con datos del contacto
     */
    private function personalizeMessage(string $template, array $contact): string
    {
        $replacements = [
            '{{name}}' => $contact['name'] ?? 'Cliente',
            '{{policy_number}}' => $contact['policy_number'] ?? '',
            '{{policy_type}}' => $contact['policy_type'] ?? '',
            '{{expiry_date}}' => $contact['expiry_date'] ?? '',
            '{{phone}}' => $contact['phone'] ?? ''
        ];

        return str_replace(array_keys($replacements), array_values($replacements), $template);
    }

    /**
     * Formatear número de teléfono
     */
    private function formatPhoneNumber(string $phone): string
    {
        // Remover espacios y caracteres especiales excepto el +
        $phone = preg_replace('/[^0-9+]/', '', $phone);
        
        // Si ya tiene +, devolverlo tal como está
        if (substr($phone, 0, 1) === '+') {
            return $phone;
        }
        
        // Si ya empieza con 57, agregar solo el +
        if (substr($phone, 0, 2) === '57' && strlen($phone) == 12) {
            return '+' . $phone;
        }
        
        // Si no tiene código de país, agregar +57 para Colombia
        if (strlen($phone) == 10 && substr($phone, 0, 1) == '3') {
            $phone = '+57' . $phone;
        }
        
        \Log::info('🔧 [PHONE FORMAT] Número formateado', [
            'input' => func_get_args()[0] ?? 'N/A',
            'output' => $phone
        ]);
        
        return $phone;
    }

    /**
     * Enviar mensajes masivos al microservicio de WhatsApp usando el endpoint bulk
     */
    private function sendBulkWhatsAppMessagesToMicroservice(array $contacts, string $messageTemplate, int $campaignId, int $executionId): array
    {
        try {
            // Obtener la campaña para verificar si tiene una instancia asignada
            $campaign = Campaign::find($campaignId);
            $instanceId = null;
            $whatsappInstance = null;

            if ($campaign && $campaign->whatsapp_instance_id) {
                // Obtener el instance_id de la instancia de WhatsApp asignada a la campaña
                $whatsappInstance = $campaign->whatsappInstance;
                if ($whatsappInstance) {
                    $instanceId = $whatsappInstance->instance_id;
                    Log::info('✅ [CAMPAIGN SEND] Usando instancia específica para campaña', [
                        'campaign_id' => $campaignId,
                        'whatsapp_instance_id' => $campaign->whatsapp_instance_id,
                        'instance_id' => $instanceId,
                        'status' => $whatsappInstance->status
                    ]);
                    
                    // 🔄 SINCRONIZACIÓN AUTOMÁTICA: Verificar que la instancia existe en el microservicio
                    $this->ensureInstanceExistsInMicroservice($whatsappInstance);
                    
                } else {
                    Log::warning('⚠️ [CAMPAIGN SEND] Instancia WhatsApp asignada no encontrada', [
                        'campaign_id' => $campaignId,
                        'whatsapp_instance_id' => $campaign->whatsapp_instance_id
                    ]);
                }
            }

            // Si no hay instancia específica válida, intentar usar una instancia conectada del broker
            if (!$instanceId && $campaign) {
                Log::info('🔍 [CAMPAIGN SEND] Buscando instancia automática para broker', [
                    'broker_id' => $campaign->broker_id,
                    'campaign_id' => $campaignId
                ]);
                
                $autoInstance = \App\Models\WhatsAppInstance::query()
                    ->where('broker_id', $campaign->broker_id)
                    ->whereNotNull('instance_id')
                    ->where('is_active', true)
                    ->orderByDesc('updated_at')
                    ->first();

                if ($autoInstance) {
                    $instanceId = $autoInstance->instance_id;
                    $whatsappInstance = $autoInstance;
                    
                    Log::info('✅ [CAMPAIGN SEND] Instancia encontrada en BD', [
                        'campaign_id' => $campaignId,
                        'broker_id' => $campaign->broker_id,
                        'auto_instance_id' => $autoInstance->id,
                        'instance_id' => $instanceId,
                        'db_status' => $autoInstance->status
                    ]);
                    
                    // 🔄 ASIGNACIÓN AUTOMÁTICA: Guardar la instancia en la campaña para futuras ejecuciones
                    if (!$campaign->whatsapp_instance_id) {
                        Log::info('💾 [CAMPAIGN SEND] Asignando instancia automáticamente a la campaña', [
                            'campaign_id' => $campaignId,
                            'whatsapp_instance_id' => $autoInstance->id
                        ]);
                        
                        $campaign->update(['whatsapp_instance_id' => $autoInstance->id]);
                    }
                    
                    // 🔄 SINCRONIZACIÓN AUTOMÁTICA: Asegurar que existe en microservicio
                    $syncResult = $this->ensureInstanceExistsInMicroservice($autoInstance);
                    
                    if (!$syncResult) {
                        Log::warning('⚠️ [CAMPAIGN SEND] No se pudo sincronizar instancia automática', [
                            'instance_id' => $instanceId
                        ]);
                    }
                    
                } else {
                    Log::error('❌ [CAMPAIGN SEND] No se encontró ninguna instancia para el broker', [
                        'campaign_id' => $campaignId,
                        'broker_id' => $campaign->broker_id
                    ]);

                    return [
                        'success' => false,
                        'error' => 'No hay instancias de WhatsApp disponibles. Por favor, crea una instancia antes de enviar mensajes.'
                    ];
                }
            }

            // Validar que tenemos una instancia
            if (!$instanceId) {
                Log::error('❌ [CAMPAIGN SEND] No se pudo determinar instance_id', [
                    'campaign_id' => $campaignId
                ]);

                return [
                    'success' => false,
                    'error' => 'No se pudo determinar la instancia de WhatsApp para enviar mensajes.'
                ];
            }

            // Verificar estado de la instancia en el microservicio antes de enviar
            try {
                $serviceUrl = env('WHATSAPP_SERVICE_URL', 'http://127.0.0.1:3000/api/v1');
                $statusCheck = Http::timeout(5)->get("{$serviceUrl}/instances/{$instanceId}/status");

                if (!$statusCheck->successful()) {
                    Log::warning('⚠️ [CAMPAIGN SEND] Instancia no disponible en microservicio, intentando fallback', [
                        'instance_id' => $instanceId,
                        'status_code' => $statusCheck->status()
                    ]);

                    // Intentar fallback a otra instancia conectada del mismo broker
                    if ($campaign) {
                        $fallback = $this->findConnectedInstanceForBroker($campaign->broker_id);
                        if ($fallback) {
                            $campaign->update(['whatsapp_instance_id' => $fallback->id]);
                            $whatsappInstance = $fallback;
                            $instanceId = $fallback->instance_id;

                            Log::info('✅ [CAMPAIGN SEND] Fallback a instancia conectada', [
                                'campaign_id' => $campaignId,
                                'new_instance_db_id' => $fallback->id,
                                'instance_id' => $instanceId
                            ]);
                        } else {
                            return [
                                'success' => false,
                                'error' => 'No se encontró ninguna instancia conectada para este broker.'
                            ];
                        }
                    }
                } else {
                    $statusData = $statusCheck->json();
                    if (!($statusData['connected'] ?? false) && !in_array($statusData['status'] ?? '', ['connected', 'authenticated'])) {
                        Log::warning('⚠️ [CAMPAIGN SEND] Instancia no conectada, intentando fallback', [
                            'instance_id' => $instanceId,
                            'status' => $statusData['status'] ?? 'unknown'
                        ]);

                        // Intentar fallback a otra instancia conectada del mismo broker
                        $fallback = $this->findConnectedInstanceForBroker($campaign->broker_id);
                        if ($fallback) {
                            $campaign->update(['whatsapp_instance_id' => $fallback->id]);
                            $whatsappInstance = $fallback;
                            $instanceId = $fallback->instance_id;

                            Log::info('✅ [CAMPAIGN SEND] Fallback a instancia conectada', [
                                'campaign_id' => $campaignId,
                                'new_instance_db_id' => $fallback->id,
                                'instance_id' => $instanceId
                            ]);
                        } else {
                            return [
                                'success' => false,
                                'error' => 'No hay instancias de WhatsApp conectadas. Por favor, conecta una instancia (escanea el QR).'
                            ];
                        }
                    } else {
                        Log::info('✅ [CAMPAIGN SEND] Instancia verificada y conectada', [
                            'instance_id' => $instanceId,
                            'status' => $statusData['status'] ?? 'connected'
                        ]);
                    }
                }

            } catch (\Exception $statusError) {
                Log::error('❌ [CAMPAIGN SEND] Error verificando estado de instancia', [
                    'instance_id' => $instanceId,
                    'error' => $statusError->getMessage()
                ]);

                return [
                    'success' => false,
                    'error' => 'No se pudo verificar el estado de la instancia de WhatsApp. Verifica que el microservicio esté funcionando.'
                ];
            }

            // Preparar contactos para envío masivo (con mensaje personalizado por contacto)
            $bulkContacts = [];
            foreach ($contacts as $contact) {
                $formattedPhone = $this->formatPhoneNumber($contact['phone'] ?? '');
                // Usar mensaje ya calculado si viene, o procesar variables con datos del contacto
                $baseMessage = (isset($contact['message']) && is_string($contact['message']) && trim($contact['message']) !== '')
                    ? $contact['message']
                    : $messageTemplate;
                $personalized = $this->processMessageVariables($baseMessage, is_array($contact) ? $contact : []);
                $bulkContacts[] = [
                    'phone' => $formattedPhone,
                    'message' => $personalized,
                ];
            }

            // Preview del primer mensaje para logging
            $firstPreview = $bulkContacts[0]['message'] ?? '';

            // Construir URL del microservicio para envío masivo
            $serviceUrl = isset($serviceUrl) ? $serviceUrl : env('WHATSAPP_SERVICE_URL', 'http://127.0.0.1:3000/api/v1');
            $microserviceUrl = "{$serviceUrl}/instances/{$instanceId}/send-bulk";
            $totalContacts = count($bulkContacts);

            // Si no hay contactos, no llamar al microservicio; cerrar ejecución/campaña
            if ($totalContacts === 0) {
                Log::info('ℹ️ [WHATSAPP BULK SEND] Sin contactos. Finalizando ejecución sin envío', [
                    'campaign_id' => $campaignId,
                    'execution_id' => $executionId
                ]);

                try {
                    CampaignExecution::where('id', $executionId)->update([
                        'status' => 'completed',
                        'messages_sent' => 0,
                        'messages_failed' => 0,
                        'completed_at' => now()
                    ]);

                    Campaign::where('id', $campaignId)->update([
                        'status' => 'completed'
                    ]);
                } catch (\Throwable $e) {
                    Log::warning('⚠️ [WHATSAPP BULK SEND] Error cerrando ejecución/campaña sin contactos', [
                        'campaign_id' => $campaignId,
                        'execution_id' => $executionId,
                        'error' => $e->getMessage()
                    ]);
                }

                return [
                    'success' => true,
                    'queued' => false,
                    'message' => 'Sin contactos para enviar; campaña marcada como completada',
                    'data' => [
                        'total_contacts' => 0,
                        'status' => 'completed'
                    ]
                ];
            }

            Log::info('🚀 [WHATSAPP BULK SEND] ========== INICIANDO ENVÍO MASIVO ==========');
            Log::info('🚀 [WHATSAPP BULK SEND] Configuración:', [
                'url' => $microserviceUrl,
                'total_contacts' => $totalContacts,
                'campaign_id' => $campaignId,
                'execution_id' => $executionId,
                'instance_id' => $instanceId,
                'whatsapp_instance_db_id' => $campaign->whatsapp_instance_id ?? 'auto',
                'message_preview' => substr($firstPreview, 0, 100) . '...'
            ]);

            // Enviar todos los mensajes en una sola petición bulk
            $options = [
                'minDelay' => 8000,  // 8 segundos mínimo entre mensajes
                'maxDelay' => 15000, // 15 segundos máximo entre mensajes
                'maxPerSession' => 50 // máximo 50 mensajes por sesión
            ];

            // Adjuntar media si la campaña tiene media_url definida (normalizar URL absoluta para Baileys)
            if ($campaign && !empty($campaign->media_url)) {
                $mediaUrl = $campaign->media_url;

                // Normalizar a URL absoluta si viene relativa o sin esquema
                if (!(is_string($mediaUrl) && preg_match('#^https?://#i', $mediaUrl))) {
                    $base = rtrim(env('APP_URL', ''), '/');
                    if (empty($base)) {
                        try {
                            $base = rtrim(request()->getSchemeAndHttpHost(), '/');
                        } catch (\Throwable $e) {
                            // Fallback explícito en desarrollo si no hay request()
                            $base = 'http://127.0.0.1:8001';
                        }
                    }
                    $mediaUrl = $base . '/' . ltrim($mediaUrl, '/');
                }

                // Preflight ligero para detectar URLs inalcanzables (solo logging, no bloquear)
                try {
                    $probe = Http::timeout(3)->get($mediaUrl, ['_ping' => '1']);
                    if (!$probe->successful()) {
                        Log::warning('⚠️ [WHATSAPP BULK SEND] Media URL no alcanzable en preflight', [
                            'media_url' => $mediaUrl,
                            'status' => $probe->status(),
                        ]);
                    }
                } catch (\Throwable $e) {
                    Log::warning('⚠️ [WHATSAPP BULK SEND] Error accediendo a media_url en preflight', [
                        'media_url' => $mediaUrl,
                        'error' => $e->getMessage(),
                    ]);
                }

                $options['media'] = [
                    'type' => $campaign->media_type ?: 'image',
                    'url' => $mediaUrl,
                ];
            }

            // Determinar base para webhook del microservicio -> Laravel
            $webhookBaseUrl = rtrim(env('WHATSAPP_WEBHOOK_BASE_URL', ''), '/');
            if (empty($webhookBaseUrl)) {
                if (app()->environment('local', 'development', 'testing')) {
                    $webhookBaseUrl = 'http://127.0.0.1:8001';
                } else {
                    $webhookBaseUrl = rtrim(config('app.url') ?: env('APP_URL', ''), '/');
                    if (empty($webhookBaseUrl)) {
                        try {
                            $webhookBaseUrl = rtrim(request()->getSchemeAndHttpHost(), '/');
                        } catch (\Throwable $e) {
                            $webhookBaseUrl = 'http://127.0.0.1:8001';
                        }
                    }
                }
            }

            $payload = [
                'contacts' => $bulkContacts,
                // Compatibilidad: algunos despliegues del microservicio exigen un "message" global no vacío.
                // Usamos el preview del primer contacto como fallback; si no existe, un espacio.
                'message' => $firstPreview !== '' ? $firstPreview : ' ',
                'options' => array_merge($options, [
                    'campaign_id' => $campaignId,
                    'execution_id' => $executionId,
                    'webhook_url' => $webhookBaseUrl . '/api/saas/whatsapp/webhook/bulk-send-complete'
                ])
            ];

            Log::info('📤 [WHATSAPP BULK SEND] Payload preparado:', [
                'contacts_count' => count($payload['contacts']),
                'first_contact' => $payload['contacts'][0] ?? null,
                'message_length' => strlen($payload['message']),
                'options' => $payload['options']
            ]);

            Log::info('🌐 [WHATSAPP BULK SEND] Enviando petición HTTP POST...');
            // Timeout corto: solo esperamos confirmación de que el microservicio recibió la solicitud
            // El envío real se hace en background y se trackea vía stats
            $httpTimeout = (int) env('WHATSAPP_BULK_TIMEOUT', 10);
            $connectTimeout = (int) env('WHATSAPP_BULK_CONNECT_TIMEOUT', 5);
            
            try {
                $response = Http::timeout($httpTimeout)->connectTimeout($connectTimeout)->post($microserviceUrl, $payload);
            } catch (\Illuminate\Http\Client\ConnectionException $timeoutEx) {
                // Si hay timeout, asumir que el microservicio está procesando en background
                Log::warning('⏱️ [WHATSAPP BULK SEND] Timeout esperando respuesta (normal con media), asumiendo procesamiento en background', [
                    'campaign_id' => $campaignId,
                    'execution_id' => $executionId,
                    'timeout' => $httpTimeout
                ]);
                
                // Marcar como en proceso y retornar éxito
                return [
                    'success' => true,
                    'queued' => true,
                    'message' => 'Envío delegado al microservicio (procesando en background)',
                    'data' => [
                        'total_contacts' => $totalContacts,
                        'status' => 'processing'
                    ]
                ];
            }
            
            Log::info('📨 [WHATSAPP BULK SEND] Respuesta recibida:', [
                'status_code' => $response->status(),
                'successful' => $response->successful(),
                'body_preview' => substr($response->body(), 0, 200)
            ]);

            if ($response->successful()) {
                $responseData = $response->json();

                if ($responseData['success'] ?? false) {
                    $results = $responseData['results'] ?? [];
                    $stats = $responseData['stats'] ?? ['successful' => 0, 'failed' => 0, 'total' => 0];

                    Log::info('✅ [WHATSAPP BULK SEND] Envío masivo exitoso', [
                        'campaign_id' => $campaignId,
                        'execution_id' => $executionId,
                        'total_contacts' => $totalContacts,
                        'successful' => $stats['successful'] ?? 0,
                        'failed' => $stats['failed'] ?? 0,
                        'results_count' => count($results)
                    ]);

                    // Actualizar mensajes en la base de datos según los resultados detallados
                    if (!empty($results)) {
                        foreach ($results as $result) {
                            // Normalizar teléfono del resultado para que coincida con lo que guardamos en DB
                            $phoneRaw = (string)($result['phone'] ?? '');
                            $phoneNormalized = $this->formatPhoneNumber($phoneRaw);
                            $status = $result['success'] ? CampaignMessage::STATUS_SENT : CampaignMessage::STATUS_FAILED;

                            // Considerar equivalentes con y sin '+' para evitar desajustes con el microservicio
                            $candidates = [$phoneNormalized];
                            if (substr($phoneNormalized, 0, 1) === '+') {
                                $candidates[] = ltrim($phoneNormalized, '+');
                            }

                            CampaignMessage::where('campaign_id', $campaignId)
                                ->where('campaign_execution_id', $executionId)
                                ->whereIn('recipient_phone', $candidates)
                                ->where('status', CampaignMessage::STATUS_PENDING)
                                ->update([
                                    'status' => $status,
                                    'sent_at' => $result['success'] ? now() : null,
                                    'failed_at' => !$result['success'] ? now() : null,
                                    'whatsapp_message_id' => $result['messageId'] ?? null,
                                    'error_message' => $result['error'] ?? null
                                ]);
                        }
                    }

                    // SIEMPRE aplicar fallback basado en stats para cerrar estados correctamente
                    // Esto es especialmente importante cuando hay media, ya que results puede venir vacío
                    $successFromStats = (int)($stats['successful'] ?? 0);
                    $failedFromStats = (int)($stats['failed'] ?? 0);
                    
                    if ($successFromStats > 0 || $failedFromStats > 0) {
                        Log::info('🔄 [WHATSAPP BULK SEND] Aplicando actualización basada en stats', [
                            'campaign_id' => $campaignId,
                            'execution_id' => $executionId,
                            'success_from_stats' => $successFromStats,
                            'failed_from_stats' => $failedFromStats,
                            'total_contacts' => $totalContacts,
                            'had_results' => !empty($results)
                        ]);
                        
                        // Actualizar mensajes exitosos si stats lo indica
                        if ($successFromStats > 0) {
                            $updated = CampaignMessage::where('campaign_id', $campaignId)
                                ->where('campaign_execution_id', $executionId)
                                ->where('status', CampaignMessage::STATUS_PENDING)
                                ->limit($successFromStats)
                                ->update([
                                    'status' => CampaignMessage::STATUS_SENT,
                                    'sent_at' => now()
                                ]);
                            
                            Log::info('✅ [WHATSAPP BULK SEND] Mensajes marcados como enviados desde stats', [
                                'updated_count' => $updated,
                                'expected' => $successFromStats
                            ]);
                        }
                        
                        // Actualizar mensajes fallidos si stats lo indica
                        if ($failedFromStats > 0) {
                            $updatedFailed = CampaignMessage::where('campaign_id', $campaignId)
                                ->where('campaign_execution_id', $executionId)
                                ->where('status', CampaignMessage::STATUS_PENDING)
                                ->limit($failedFromStats)
                                ->update([
                                    'status' => CampaignMessage::STATUS_FAILED,
                                    'failed_at' => now(),
                                    'error_message' => 'Error reportado por microservicio'
                                ]);
                            
                            Log::info('❌ [WHATSAPP BULK SEND] Mensajes marcados como fallidos desde stats', [
                                'updated_count' => $updatedFailed,
                                'expected' => $failedFromStats
                            ]);
                        }
                    }

                    // Actualizar contadores finales
                    $this->updateCampaignCounters($campaignId, $executionId);

                    // Verificar si todos los mensajes han sido procesados
                    // Importante: contar pendientes SOLO de esta ejecución para no quedar bloqueados por ejecuciones anteriores
                    $pendingMessages = CampaignMessage::where('campaign_id', $campaignId)
                        ->where('campaign_execution_id', $executionId)
                        ->where('status', CampaignMessage::STATUS_PENDING)
                        ->count();

                    $sentMessages = CampaignMessage::where('campaign_id', $campaignId)
                        ->where('campaign_execution_id', $executionId)
                        ->where('status', CampaignMessage::STATUS_SENT)
                        ->count();

                    $failedMessages = CampaignMessage::where('campaign_id', $campaignId)
                        ->where('campaign_execution_id', $executionId)
                        ->where('status', CampaignMessage::STATUS_FAILED)
                        ->count();

                    $totalProcessed = $sentMessages + $failedMessages;

                    Log::info('📊 [CAMPAIGN] Estado de mensajes después de actualización', [
                        'campaign_id' => $campaignId,
                        'execution_id' => $executionId,
                        'pending' => $pendingMessages,
                        'sent' => $sentMessages,
                        'failed' => $failedMessages,
                        'total_processed' => $totalProcessed,
                        'total_expected' => $totalContacts
                    ]);

                    // Marcar como completada si no hay pendientes O si todos fueron procesados según stats
                    if ($pendingMessages === 0 || $totalProcessed >= $totalContacts) {
                        CampaignExecution::where('id', $executionId)->update([
                            'status' => 'completed',
                            'completed_at' => now()
                        ]);

                        Campaign::where('id', $campaignId)->update([
                            'status' => 'completed'
                        ]);

                        Log::info('🎯 [CAMPAIGN] Campaña completada - todos los mensajes procesados', [
                            'campaign_id' => $campaignId,
                            'execution_id' => $executionId,
                            'final_sent' => $sentMessages,
                            'final_failed' => $failedMessages
                        ]);
                    } else {
                        CampaignExecution::where('id', $executionId)->update([
                            'status' => 'running'
                        ]);

                        Campaign::where('id', $campaignId)->update([
                            'status' => 'sending'
                        ]);

                        Log::info('📋 [CAMPAIGN] Campaña en proceso - mensajes pendientes', [
                            'campaign_id' => $campaignId,
                            'execution_id' => $executionId,
                            'pending' => $pendingMessages,
                            'processed' => $totalProcessed,
                            'expected' => $totalContacts
                        ]);
                    }

                    return [
                        'success' => true,
                        'data' => [
                            'total_contacts' => $totalContacts,
                            'success_count' => $stats['successful'] ?? 0,
                            'failed_count' => $stats['failed'] ?? 0,
                            'results' => $results
                        ]
                    ];
                } else {
                    Log::error('❌ [WHATSAPP BULK SEND] Microservicio devolvió error', [
                        'campaign_id' => $campaignId,
                        'error' => $responseData['error'] ?? 'Error desconocido'
                    ]);

                    return [
                        'success' => false,
                        'error' => $responseData['error'] ?? 'Error en el envío masivo'
                    ];
                }
            } else {
                $errorMsg = 'HTTP ' . $response->status() . ': ' . $response->body();
                Log::warning('⚠️ [WHATSAPP BULK SEND] Microservicio no confirmó, se mantiene ejecución en curso', [
                    'campaign_id' => $campaignId,
                    'status' => $response->status(),
                    'error' => $errorMsg
                ]);

                // No forzamos cambios de estado ni marcamos mensajes como enviados.
                // Dejamos la ejecución y campaña en curso para que el microservicio complete el envío.
                return [
                    'success' => true,
                    'queued' => true,
                    'message' => 'Microservicio no confirmó a tiempo; envío en proceso',
                    'http_status' => $response->status()
                ];
            }

        } catch (\Exception $e) {
            Log::warning('⚠️ [WHATSAPP BULK SEND] Error general en envío masivo (delegado como en proceso)', [
                'error' => $e->getMessage(),
                'campaign_id' => $campaignId,
                'execution_id' => $executionId,
                'trace' => $e->getTraceAsString()
            ]);

            // No forzamos cambios en DB. Dejamos ejecución/campaña en curso.
            return [
                'success' => true,
                'queued' => true,
                'message' => 'Envío delegado (no se obtuvo confirmación inmediata): ' . $e->getMessage()
            ];
        }
    }

    /**
     * Actualizar mensajes de campaña como enviados
     */
    private function updateCampaignMessagesAsSent(int $campaignId, int $executionId): void
    {
        try {
            $messagesUpdated = CampaignMessage::where('campaign_id', $campaignId)
                ->where('campaign_execution_id', $executionId)
                ->where('status', CampaignMessage::STATUS_PENDING)
                ->update([
                    'status' => CampaignMessage::STATUS_SENT,
                    'sent_at' => now()
                ]);

            Log::info('Mensajes actualizados como enviados', [
                'campaign_id' => $campaignId,
                'execution_id' => $executionId,
                'messages_updated' => $messagesUpdated
            ]);

            // Actualizar contadores en la campaña y ejecución
            $this->updateCampaignCounters($campaignId, $executionId);
            
        } catch (\Exception $e) {
            Log::error('Error actualizando mensajes como enviados', [
                'error' => $e->getMessage(),
                'campaign_id' => $campaignId,
                'execution_id' => $executionId
            ]);
        }
    }

    /**
     * Actualizar contadores de campaña y ejecución
     */
    private function updateCampaignCounters(int $campaignId, int $executionId): void
    {
        try {
            $sentCount = CampaignMessage::where('campaign_id', $campaignId)
                ->where('status', CampaignMessage::STATUS_SENT)
                ->count();
            
            $deliveredCount = CampaignMessage::where('campaign_id', $campaignId)
                ->where('status', CampaignMessage::STATUS_DELIVERED)
                ->count();
            
            $failedCount = CampaignMessage::where('campaign_id', $campaignId)
                ->where('status', CampaignMessage::STATUS_FAILED)
                ->count();

            // Actualizar campaña
            Campaign::where('id', $campaignId)->update([
                'sent_count' => $sentCount,
                'delivered_count' => $deliveredCount,
                'failed_count' => $failedCount
            ]);

            // Actualizar ejecución
            $executionSentCount = CampaignMessage::where('campaign_execution_id', $executionId)
                ->where('status', CampaignMessage::STATUS_SENT)
                ->count();
                
            $executionDeliveredCount = CampaignMessage::where('campaign_execution_id', $executionId)
                ->where('status', CampaignMessage::STATUS_DELIVERED)
                ->count();
                
            $executionFailedCount = CampaignMessage::where('campaign_execution_id', $executionId)
                ->where('status', CampaignMessage::STATUS_FAILED)
                ->count();

            CampaignExecution::where('id', $executionId)->update([
                'messages_sent' => $executionSentCount,
                'messages_delivered' => $executionDeliveredCount,
                'messages_failed' => $executionFailedCount
            ]);

            Log::info('Contadores actualizados', [
                'campaign_id' => $campaignId,
                'execution_id' => $executionId,
                'sent' => $sentCount,
                'delivered' => $deliveredCount,
                'failed' => $failedCount
            ]);
            
        } catch (\Exception $e) {
            Log::error('Error actualizando contadores', [
                'error' => $e->getMessage(),
                'campaign_id' => $campaignId,
                'execution_id' => $executionId
            ]);
        }
    }

    /**
     * Enviar mensajes masivos vía WhatsApp usando el endpoint existente
     */
    private function sendBulkWhatsAppMessages(array $messages, int $campaignId, int $executionId): array
    {
        try {
            // Usar el controlador existente de WhatsApp directamente
            $whatsappController = new \App\Http\Controllers\WhatsAppBasicController();
            
            // Crear un request simulado con los datos necesarios
            $request = new \Illuminate\Http\Request();
            $request->merge([
                'messages' => $messages,
                'campaign_id' => $campaignId,
                'execution_id' => $executionId
            ]);

            // Llamar al método directamente
            $response = $whatsappController->sendBulkMessages($request);
            $responseData = json_decode($response->getContent(), true);

            if ($response->getStatusCode() === 200 && ($responseData['success'] ?? false)) {
                return [
                    'success' => true,
                    'work_file' => $responseData['work_file'] ?? null,
                    'total_messages' => $responseData['total_messages'] ?? 0
                ];
            } else {
                Log::error('Error en respuesta de WhatsApp Controller', [
                    'status' => $response->getStatusCode(),
                    'data' => $responseData
                ]);

                return [
                    'success' => false,
                    'error' => $responseData['error'] ?? 'Error desconocido en WhatsApp'
                ];
            }

        } catch (\Exception $e) {
            Log::error('Error enviando mensajes masivos WhatsApp', [
                'error' => $e->getMessage(),
                'campaign_id' => $campaignId,
                'execution_id' => $executionId
            ]);

            return [
                'success' => false,
                'error' => 'Error interno: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Ejecutar campaña inmediatamente
     */
    public function executeNow($id, Request $request): JsonResponse
    {
        try {
            \Log::info('🚀 [EXECUTE NOW] ========== INICIANDO EJECUCIÓN ==========');
            \Log::info('🚀 [EXECUTE NOW] Campaign ID', ['campaign_id' => $id]);
            
            // ✅ OBTENER BROKER_ID DEL USUARIO AUTENTICADO
            $brokerId = $this->getBrokerId($request);
            \Log::info('🚀 [EXECUTE NOW] Broker ID obtenido', ['broker_id' => $brokerId]);
            
            \Log::info('🚀 [EXECUTE NOW] Buscando campaña en base de datos...');
            $campaign = Campaign::findOrFail($id);
            \Log::info('🚀 [EXECUTE NOW] Campaña encontrada en DB');

            // ✅ VERIFICAR QUE LA CAMPAÑA PERTENECE AL BROKER
            \Log::info('🚀 [EXECUTE NOW] Verificando permisos de broker...');
            if ($campaign->broker_id !== $brokerId) {
                \Log::error('❌ [EXECUTE NOW] Broker mismatch', [
                    'campaign_broker_id' => $campaign->broker_id,
                    'user_broker_id' => $brokerId
                ]);
                return response()->json([
                    'success' => false,
                    'message' => 'No tienes permisos para ejecutar esta campaña'
                ], 403);
            }
            \Log::info('✅ [EXECUTE NOW] Permisos verificados OK');

            \Log::info('🚀 [EXECUTE NOW] Datos de campaña', [
                'campaign_id' => $campaign->id,
                'name' => $campaign->name,
                'status' => $campaign->status,
                'is_active' => $campaign->is_active,
                'total_targets' => $campaign->total_targets,
                'broker_id' => $campaign->broker_id,
                'whatsapp_instance_id' => $campaign->whatsapp_instance_id,
                'contacts_count' => is_array($campaign->contacts) ? count($campaign->contacts) : 0
            ]);

            // ✅ CORREGIDO: Validar por status en lugar de solo is_active
            \Log::info('🚀 [EXECUTE NOW] Validando estado de campaña...');
            if ($campaign->status === 'sending') {
                \Log::error('❌ [EXECUTE NOW] No se puede ejecutar mientras está enviando', [
                    'status' => $campaign->status,
                    'is_active' => $campaign->is_active
                ]);
                return response()->json([
                    'success' => false,
                    'message' => 'La campaña está enviando actualmente. Detén o cancela antes de re-ejecutar.'
                ], 422);
            }
            \Log::info('✅ [EXECUTE NOW] Estado de campaña válido para re-ejecución', [
                'status' => $campaign->status,
                'is_active' => $campaign->is_active
            ]);

            // Verificar que tenga contactos para enviar
            \Log::info('🚀 [EXECUTE NOW] Verificando contactos...');
            $contacts = $campaign->contacts;
            if (empty($contacts)) {
                \Log::error('❌ [EXECUTE NOW] Campaña sin contactos');
                return response()->json([
                    'success' => false,
                    'message' => 'La campaña no tiene contactos configurados'
                ], 422);
            }
            \Log::info('✅ [EXECUTE NOW] Contactos encontrados', ['count' => count($contacts)]);

            \Log::info('🚀 [EXECUTE NOW] Iniciando ejecución real de campaña', [
                'campaign_id' => $campaign->id,
                'total_contacts' => count($contacts),
                'broker_id' => $brokerId
            ]);

            // ✅ CREAR NUEVA EJECUCIÓN CON BROKER_ID
            $execution = CampaignExecution::create([
                'campaign_id' => $campaign->id,
                'broker_id' => $brokerId, // ✅ CAMPO REQUERIDO AGREGADO
                'execution_date' => now(),
                'status' => 'pending',
                'started_at' => now(),
                'targets_found' => count($contacts)
            ]);

            // ✅ IMPLEMENTAR ENVÍO REAL usando la lógica existente
            try {
                // ✅ CREAR REGISTROS DE CAMPAIGNMESSAGE PARA TRACKING
                \Log::info('🚀 [EXECUTE NOW] Creando registros de CampaignMessage', [
                    'campaign_id' => $campaign->id,
                    'execution_id' => $execution->id,
                    'total_contacts' => count($contacts)
                ]);

                foreach ($contacts as $contact) {
                    // Formatear teléfono
                    $formattedPhone = $this->formatPhoneNumber($contact['phone'] ?? '');
                    
                    // Procesar variables dinámicas en el mensaje
                    $personalizedMessage = $this->processMessageVariables($campaign->message_template, $contact);
                    
                    // Crear registro de mensaje para tracking
                    CampaignMessage::create([
                        'campaign_id' => $campaign->id,
                        'campaign_execution_id' => $execution->id,
                        'broker_id' => $brokerId,
                        'recipient_phone' => $formattedPhone,
                        'recipient_name' => $contact['name'] ?? null,
                        'message_content' => $personalizedMessage,
                        'status' => CampaignMessage::STATUS_PENDING
                    ]);
                }

                \Log::info('🚀 [EXECUTE NOW] Registros de CampaignMessage creados', [
                    'campaign_id' => $campaign->id,
                    'execution_id' => $execution->id,
                    'messages_created' => count($contacts)
                ]);

                // Actualizar estado de la campaña y ejecución
                $execution->update(['status' => 'running']);
                $campaign->update([
                    'status' => 'active',
                    'is_active' => true,
                    'last_execution' => now()
                ]);

                // Llamar al método de envío que ya existe
                $whatsappResponse = $this->sendBulkWhatsAppMessagesToMicroservice(
                    $contacts, 
                    $campaign->message_template, 
                    $campaign->id, 
                    $execution->id
                );

                \Log::info('🚀 [EXECUTE NOW] Resultado del envío', [
                    'campaign_id' => $campaign->id,
                    'execution_id' => $execution->id,
                    'whatsapp_response' => $whatsappResponse
                ]);

                // Si el microservicio devolvió error, marcar como fallida y responder 500
                if (!(is_array($whatsappResponse) ? ($whatsappResponse['success'] ?? false) : false)) {
                    $errorMsg = is_array($whatsappResponse) ? ($whatsappResponse['error'] ?? 'Error desconocido') : 'Error desconocido';
                    \Log::error('❌ [EXECUTE NOW] Microservicio devolvió error', [
                        'campaign_id' => $campaign->id,
                        'execution_id' => $execution->id,
                        'error' => $errorMsg
                    ]);

                    $execution->update([
                        'status' => 'failed',
                        'error_message' => $errorMsg,
                        'completed_at' => now()
                    ]);

                    $campaign->update([
                        'status' => 'failed',
                        'last_execution' => now()
                    ]);

                    return response()->json([
                        'success' => false,
                        'message' => 'Error al iniciar envío masivo: ' . $errorMsg,
                        'execution_id' => $execution->id
                    ], 500);
                }

                // Recalcular resultados desde BD para evitar falsos positivos (respuesta del microservicio puede ser incompleta)
                $createdTotal = is_array($contacts) ? count($contacts) : 0;
                $dbSent = \App\Models\CampaignMessage::where('campaign_execution_id', $execution->id)
                    ->where('status', \App\Models\CampaignMessage::STATUS_SENT)
                    ->count();
                $dbFailed = \App\Models\CampaignMessage::where('campaign_execution_id', $execution->id)
                    ->where('status', \App\Models\CampaignMessage::STATUS_FAILED)
                    ->count();
                $dbPending = \App\Models\CampaignMessage::where('campaign_execution_id', $execution->id)
                    ->where('status', \App\Models\CampaignMessage::STATUS_PENDING)
                    ->count();

                // Si aún hay pendientes, dejamos ejecución en "running" y campaña en "sending"
                $allProcessed = ($dbPending === 0) && (($dbSent + $dbFailed) >= $createdTotal && $createdTotal > 0);
                $execStatus = $allProcessed ? 'completed' : 'running';
                $campStatus = $allProcessed ? 'completed' : 'sending';

                // Actualizar ejecución con recuento real
                $execution->update([
                    'status' => $execStatus,
                    'completed_at' => $allProcessed ? now() : null,
                    'messages_sent' => $dbSent,
                    'messages_failed' => $dbFailed,
                ]);

                // Actualizar campaña acorde al progreso
                $campaign->update([
                    'status' => $campStatus,
                    'last_execution' => now(),
                    'sent_count' => $dbSent,
                    'failed_count' => $dbFailed
                ]);

                return response()->json([
                    'success' => true,
                    'message' => $allProcessed ? 'Campaña ejecutada exitosamente' : 'Campaña activada y envío en curso',
                    'execution_id' => $execution->id,
                    'results' => [
                        'sent' => $dbSent,
                        'failed' => $dbFailed,
                        'pending' => $dbPending,
                        'total' => $createdTotal
                    ]
                ]);

            } catch (\Exception $sendError) {
                \Log::error('❌ [EXECUTE NOW] Error en el envío', [
                    'campaign_id' => $campaign->id,
                    'execution_id' => $execution->id,
                    'error' => $sendError->getMessage()
                ]);

                // Actualizar ejecución como fallida
                $execution->update([
                    'status' => 'failed',
                    'completed_at' => now(),
                    'error_message' => $sendError->getMessage()
                ]);

                $campaign->update(['status' => 'failed']);

                return response()->json([
                    'success' => false,
                    'message' => 'Error al enviar mensajes: ' . $sendError->getMessage(),
                    'execution_id' => $execution->id
                ], 500);
            }

        } catch (\Exception $e) {
            \Log::error('❌ [EXECUTE NOW] Error general', [
                'campaign_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al ejecutar campaña: ' . $e->getMessage(),
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener ejecuciones de una campaña
     */
    public function getExecutions($id, Request $request): JsonResponse
    {
        try {
            $campaign = Campaign::findOrFail($id);

            $query = $campaign->executions();

            if ($request->has('status')) {
                $query->where('status', $request->status);
            }

            $limit = $request->get('limit', 15);
            $offset = $request->get('offset', 0);

            $executions = $query->orderBy('execution_date', 'desc')
                               ->skip($offset)
                               ->take($limit)
                               ->get();

            $total = $query->count();

            return response()->json([
                'success' => true,
                'data' => $executions,
                'total' => $total
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener ejecuciones',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener estadísticas de campañas (filtradas por broker) con métricas temporales
     */
    public function getStats(Request $request): JsonResponse
    {
        try {
            // Obtener broker_id del usuario autenticado
            $brokerId = $this->getBrokerId($request);
            
            if (!$brokerId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Broker no encontrado para el usuario'
                ], 403);
            }

            Log::info('📊 [CAMPAIGN STATS] Obteniendo estadísticas para broker', [
                'broker_id' => $brokerId
            ]);

            $now = \Carbon\Carbon::now();
            $today = $now->copy()->startOfDay();
            $yesterday = $now->copy()->subDay()->startOfDay();
            $thisWeekStart = $now->copy()->startOfWeek();
            $lastWeekStart = $now->copy()->subWeek()->startOfWeek();
            $thisMonthStart = $now->copy()->startOfMonth();
            $lastMonthStart = $now->copy()->subMonth()->startOfMonth();

            // Métricas de campañas
            $stats = [
                'total_campaigns' => Campaign::where('broker_id', $brokerId)->count(),
                'active_campaigns' => Campaign::where('broker_id', $brokerId)->active()->count(),
                'paused_campaigns' => Campaign::where('broker_id', $brokerId)->where('is_active', false)->count(),
                'completed_campaigns' => Campaign::where('broker_id', $brokerId)->withStatus('completed')->count(),
                'total_messages_sent' => Campaign::where('broker_id', $brokerId)->sum('sent_count'),
                'total_messages_delivered' => Campaign::where('broker_id', $brokerId)->sum('delivered_count'),
                
                // Métricas temporales de mensajes
                'messages_today' => CampaignMessage::where('broker_id', $brokerId)
                    ->whereDate('created_at', $today)
                    ->count(),
                'messages_yesterday' => CampaignMessage::where('broker_id', $brokerId)
                    ->whereDate('created_at', $yesterday)
                    ->count(),
                'messages_this_week' => CampaignMessage::where('broker_id', $brokerId)
                    ->where('created_at', '>=', $thisWeekStart)
                    ->count(),
                'messages_last_week' => CampaignMessage::where('broker_id', $brokerId)
                    ->whereBetween('created_at', [$lastWeekStart, $thisWeekStart])
                    ->count(),
                
                // Métricas de entrega temporal
                'delivered_today' => CampaignMessage::where('broker_id', $brokerId)
                    ->whereDate('created_at', $today)
                    ->where('status', CampaignMessage::STATUS_DELIVERED)
                    ->count(),
                'delivered_yesterday' => CampaignMessage::where('broker_id', $brokerId)
                    ->whereDate('created_at', $yesterday)
                    ->where('status', CampaignMessage::STATUS_DELIVERED)
                    ->count(),
                
                // Métricas de lectura
                'read_today' => CampaignMessage::where('broker_id', $brokerId)
                    ->whereDate('created_at', $today)
                    ->whereNotNull('read_at')
                    ->count(),
                'read_total' => CampaignMessage::where('broker_id', $brokerId)
                    ->whereNotNull('read_at')
                    ->count(),
                
                // Mensajes pendientes
                'pending_messages' => CampaignMessage::where('broker_id', $brokerId)
                    ->where('status', CampaignMessage::STATUS_PENDING)
                    ->count(),
                
                // Mensajes fallidos
                'failed_today' => CampaignMessage::where('broker_id', $brokerId)
                    ->whereDate('created_at', $today)
                    ->where('status', CampaignMessage::STATUS_FAILED)
                    ->count(),
                
                'campaigns_by_type' => Campaign::where('broker_id', $brokerId)
                                            ->select('campaign_type', DB::raw('count(*) as total'))
                                            ->groupBy('campaign_type')
                                            ->pluck('total', 'campaign_type'),
                'recent_executions' => CampaignExecution::with('campaign')
                                                      ->where('broker_id', $brokerId)
                                                      ->orderBy('execution_date', 'desc')
                                                      ->take(10)
                                                      ->get()
                                                      ->map(function ($execution) {
                                                          return [
                                                              'campaign_name' => $execution->campaign->name,
                                                              'execution_date' => $execution->execution_date->toISOString(),
                                                              'messages_sent' => $execution->messages_sent,
                                                              'delivery_rate' => $execution->messages_sent > 0 ?
                                                                  round(($execution->messages_delivered / $execution->messages_sent) * 100, 2) : 0
                                                          ];
                                                      })
            ];

            // Calcular tasas de entrega
            $stats['overall_delivery_rate'] = $stats['total_messages_sent'] > 0 ?
                round(($stats['total_messages_delivered'] / $stats['total_messages_sent']) * 100, 2) : 0;
            
            $stats['delivery_rate_today'] = $stats['messages_today'] > 0 ?
                round(($stats['delivered_today'] / $stats['messages_today']) * 100, 2) : 0;
            
            $stats['delivery_rate_yesterday'] = $stats['messages_yesterday'] > 0 ?
                round(($stats['delivered_yesterday'] / $stats['messages_yesterday']) * 100, 2) : 0;
            
            // Calcular tasa de lectura
            $totalSentAndDelivered = CampaignMessage::where('broker_id', $brokerId)
                ->whereIn('status', [CampaignMessage::STATUS_SENT, CampaignMessage::STATUS_DELIVERED])
                ->count();
            
            $stats['read_rate'] = $totalSentAndDelivered > 0 ?
                round(($stats['read_total'] / $totalSentAndDelivered) * 100, 2) : 0;
            
            // Calcular tendencias (comparativas)
            $stats['messages_trend'] = $stats['messages_yesterday'] > 0 ?
                round((($stats['messages_today'] - $stats['messages_yesterday']) / $stats['messages_yesterday']) * 100, 1) :
                ($stats['messages_today'] > 0 ? 100 : 0);
            
            $stats['delivery_rate_trend'] = $stats['delivery_rate_yesterday'] > 0 ?
                round($stats['delivery_rate_today'] - $stats['delivery_rate_yesterday'], 1) : 0;

            Log::info('📊 [CAMPAIGN STATS] Estadísticas calculadas', [
                'broker_id' => $brokerId,
                'stats' => $stats
            ]);

            return response()->json([
                'success' => true,
                'data' => $stats
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [CAMPAIGN STATS] Error al obtener estadísticas', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener estadísticas',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Previsualizar objetivos para campañas basadas en pólizas
     */
    public function previewTargets(Request $request): JsonResponse
    {
        try {
            // Aquí iría la lógica para previsualizar objetivos basados en las condiciones
            // Por ahora retornamos datos simulados
            
            $preview = [
                'total_targets' => 150,
                'sample_targets' => [
                    [
                        'client_name' => 'Juan Pérez',
                        'phone' => '573001234567',
                        'policy_number' => 'POL-2024-001',
                        'policy_type' => 'Auto',
                        'expiry_date' => '2024-08-15',
                        'days_until_expiry' => 15
                    ],
                    [
                        'client_name' => 'María García',
                        'phone' => '573009876543',
                        'policy_number' => 'POL-2024-002',
                        'policy_type' => 'Hogar',
                        'expiry_date' => '2024-08-20',
                        'days_until_expiry' => 20
                    ]
                ]
            ];

            return response()->json([
                'success' => true,
                'data' => $preview
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al previsualizar objetivos',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Obtener instancias de WhatsApp disponibles para campañas
     */
    public function getAvailableWhatsAppInstances(Request $request): JsonResponse
    {
        try {
            // Obtener el broker_id del usuario autenticado
            $brokerId = $this->getBrokerId($request);
            
            if (!$brokerId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Broker no encontrado para el usuario'
                ], 403);
            }

                        // Filtrar SOLO instancias del broker y activas; permitir estados útiles para selección
                        $query = \App\Models\WhatsAppInstance::query()
                            ->where('broker_id', $brokerId)
                            ->where('is_active', true)
                            ->whereNotNull('instance_id')
                            ->whereIn('status', ['connected', 'authenticated', 'connecting', 'qr_pending', 'disconnected']) // permitir selección de instancias en conexión/QR
                            ->select('id', 'instance_id', 'phone_number', 'status');

            $instancesRaw = $query->orderByDesc('updated_at')->get();

            // Consultar estado en tiempo real desde el microservicio para cada instancia
            $serviceUrl = rtrim(env('WHATSAPP_SERVICE_URL', 'http://127.0.0.1:3000/api/v1'), '/');

            $instances = $instancesRaw->map(function ($instance) use ($serviceUrl) {
                $liveStatus = $instance->status;

                try {
                    $statusResp = Http::timeout(5)->get("{$serviceUrl}/instances/{$instance->instance_id}/status");
                    if ($statusResp->successful()) {
                        $data = $statusResp->json();
                        if (($data['connected'] ?? false) || in_array($data['status'] ?? '', ['connected', 'authenticated'])) {
                            $liveStatus = 'connected';
                        } elseif ($data['connecting'] ?? false) {
                            $liveStatus = 'connecting';
                        } elseif ($data['hasQR'] ?? false) {
                            $liveStatus = 'qr_pending';
                        } else {
                            $liveStatus = $data['status'] ?? $liveStatus;
                        }
                    }
                } catch (\Throwable $e) {
                    Log::warning('⚠️ [CAMPAIGNS] No se pudo obtener estado en microservicio para instancia', [
                        'instance_id' => $instance->instance_id,
                        'error' => $e->getMessage()
                    ]);
                }

                return [
                    'id' => $instance->id,
                    'instance_id' => $instance->instance_id,
                    'phone_number' => $instance->phone_number,
                    'status' => $liveStatus,
                    'name' => $instance->phone_number ?: $instance->instance_id,
                    'display_name' => $instance->phone_number ?: $instance->instance_id,
                    'connected' => in_array($liveStatus, ['connected', 'authenticated'])
                ];
            });

            // Logs de diagnóstico para confirmar scoping por broker
            Log::info('📦 [CAMPAIGNS] Instancias WhatsApp disponibles (filtradas)', [
                'broker_id' => $brokerId,
                'total_instances' => $instances->count(),
                'status_breakdown' => \App\Models\WhatsAppInstance::query()
                    ->where('broker_id', $brokerId)
                    ->selectRaw('status, COUNT(*) as total')
                    ->groupBy('status')
                    ->pluck('total', 'status'),
            ]);

            return response()->json([
                'success' => true,
                'data' => $instances,
                'total' => $instances->count()
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [CAMPAIGNS] Error obteniendo instancias WhatsApp disponibles', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener instancias de WhatsApp disponibles',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Ejecutar campaña manualmente (endpoint público)
     */
    public function executeCampaign(Request $request, $campaignId): JsonResponse
    {
        try {
            // Obtener broker_id del usuario autenticado
            $brokerId = $this->getBrokerId($request);
            
            if (!$brokerId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Broker no encontrado para el usuario'
                ], 403);
            }

            // Buscar la campaña
            $campaign = Campaign::where('id', $campaignId)
                              ->where('broker_id', $brokerId)
                              ->first();

            if (!$campaign) {
                return response()->json([
                    'success' => false,
                    'message' => 'Campaña no encontrada'
                ], 404);
            }

            // Verificar que la campaña no esté ya ejecutándose
            if ($campaign->status === 'active') {
                return response()->json([
                    'success' => false,
                    'message' => 'La campaña ya se está ejecutando'
                ], 400);
            }

            // Verificar que tenga contactos
            if (empty($campaign->contacts) || count($campaign->contacts) === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'La campaña no tiene contactos para ejecutar'
                ], 400);
            }

            \Log::info('🚀 [EXECUTE MANUAL] Iniciando ejecución manual de campaña', [
                'campaign_id' => $campaign->id,
                'campaign_name' => $campaign->name,
                'total_contacts' => count($campaign->contacts),
                'broker_id' => $brokerId
            ]);

            // Crear nueva ejecución
            $execution = CampaignExecution::create([
                'campaign_id' => $campaign->id,
                'broker_id' => $brokerId,
                'execution_date' => now(),
                'status' => 'pending',
                'started_at' => now(),
                'targets_found' => count($campaign->contacts)
            ]);

            // Actualizar estado de la campaña
            $campaign->update([
                'status' => 'active',
                'is_active' => true,
                'last_execution' => now()
            ]);

            // Ejecutar envío de WhatsApp usando la lógica inmediata
            return $this->executeImmediateCampaign($campaign, $execution);

        } catch (\Exception $e) {
            \Log::error('❌ [EXECUTE MANUAL] Error ejecutando campaña', [
                'campaign_id' => $campaignId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error ejecutando campaña: ' . $e->getMessage(),
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Prueba de llamada con ElevenLabs
     */
    public function testCall(Request $request): JsonResponse
    {
        try {
            // Validar datos de entrada
            $validator = \Validator::make($request->all(), [
                'phone' => 'required|string',
                'customer_name' => 'required|string',
                'agent_id' => 'nullable|string',
                'message' => 'nullable|string'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Datos de entrada inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            $phone = $this->formatPhoneNumber($request->phone);
            $customerName = $request->customer_name;
            $agentId = $request->agent_id ?: env('ELEVENLABS_AGENT_ID', 'agent_01k02pehqgfywb54fz2z8ts74h');
            $message = $request->message ?: "Hola {$customerName}, esta es una llamada de prueba desde nuestro sistema de seguros para verificar la funcionalidad.";

            \Log::info('📞 [TEST CALL] Iniciando prueba de llamada', [
                'phone' => $phone,
                'customer_name' => $customerName,
                'agent_id' => $agentId,
                'message_preview' => substr($message, 0, 100) . '...'
            ]);

            // Crear datos de contacto simulados para la prueba
            $contactData = [
                'name' => $customerName,
                'phone' => $phone,
                'email' => 'test@example.com',
                'test_call' => true
            ];

            // Realizar llamada de prueba usando el mismo método que las campañas
            $callResult = $this->makeElevenLabsCall($phone, $message, $contactData);
            
            if ($callResult['success']) {
                return response()->json([
                    'success' => true,
                    'message' => 'Llamada de prueba iniciada exitosamente',
                    'call_id' => $callResult['call_id'] ?? null,
                    'phone' => $phone,
                    'customer_name' => $customerName,
                    'agent_id' => $agentId,
                    'response_data' => $callResult['response_data'] ?? null
                ]);
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Error en la llamada de prueba: ' . ($callResult['error'] ?? 'Error desconocido'),
                    'error' => $callResult['error'] ?? 'Error desconocido',
                    'status_code' => $callResult['status_code'] ?? null
                ], 400);
            }

        } catch (\Exception $e) {
            \Log::error('❌ [TEST CALL] Error en llamada de prueba', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error en llamada de prueba: ' . $e->getMessage(),
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Ejecutar campaña usando ElevenLabs para llamadas de voz
     */
    private function executeElevenLabsCampaign(Campaign $campaign, CampaignExecution $execution, array $contacts): void
    {
        try {
            \Log::info('📞 [ELEVENLABS] Iniciando ejecución de campaña con ElevenLabs', [
                'campaign_id' => $campaign->id,
                'execution_id' => $execution->id,
                'total_contacts' => count($contacts),
                'broker_id' => $campaign->broker_id
            ]);

            $successCount = 0;
            $failedCount = 0;

            foreach ($contacts as $contact) {
                try {
                    // Formatear teléfono para ElevenLabs
                    $formattedPhone = $this->formatPhoneNumber($contact['phone'] ?? '');
                    
                    // Procesar variables dinámicas en el mensaje
                    $personalizedMessage = $this->processMessageVariables($campaign->message_template, $contact);
                    
                    \Log::info('📞 [ELEVENLABS] Procesando contacto', [
                        'name' => $contact['name'] ?? 'Sin nombre',
                        'phone' => $formattedPhone,
                        'message_preview' => substr($personalizedMessage, 0, 100) . '...'
                    ]);

                    // Crear registro de mensaje para tracking
                    $campaignMessage = CampaignMessage::create([
                        'campaign_id' => $campaign->id,
                        'campaign_execution_id' => $execution->id,
                        'broker_id' => $campaign->broker_id,
                        'recipient_phone' => $formattedPhone,
                        'recipient_name' => $contact['name'] ?? null,
                        'message_content' => $personalizedMessage,
                        'status' => CampaignMessage::STATUS_PENDING,
                        'message_type' => 'voice_call' // Indicar que es llamada de voz
                    ]);

                    // Realizar llamada con ElevenLabs
                    $callResult = $this->makeElevenLabsCall($formattedPhone, $personalizedMessage, $contact);
                    
                    if ($callResult['success']) {
                        $successCount++;
                        
                        // Actualizar mensaje como enviado
                        $campaignMessage->update([
                            'status' => CampaignMessage::STATUS_SENT,
                            'sent_at' => now(),
                            'whatsapp_message_id' => $callResult['call_id'] ?? null // Usar call_id de ElevenLabs
                        ]);
                        
                        \Log::info('✅ [ELEVENLABS] Llamada exitosa', [
                            'phone' => $formattedPhone,
                            'call_id' => $callResult['call_id'] ?? null
                        ]);
                    } else {
                        $failedCount++;
                        
                        // Marcar mensaje como fallido
                        $campaignMessage->update([
                            'status' => CampaignMessage::STATUS_FAILED,
                            'failed_at' => now(),
                            'error_message' => $callResult['error'] ?? 'Error desconocido'
                        ]);
                        
                        \Log::warning('⚠️ [ELEVENLABS] Llamada fallida', [
                            'phone' => $formattedPhone,
                            'error' => $callResult['error'] ?? 'Error desconocido'
                        ]);
                    }
                    
                    // Pausa entre llamadas para no sobrecargar
                    usleep(500000); // 0.5 segundos
                    
                } catch (\Exception $contactError) {
                    $failedCount++;
                    \Log::error('❌ [ELEVENLABS] Error procesando contacto', [
                        'contact' => $contact,
                        'error' => $contactError->getMessage()
                    ]);
                }
            }

            // Actualizar contadores finales
            $execution->update([
                'status' => 'completed',
                'completed_at' => now(),
                'messages_sent' => $successCount,
                'messages_failed' => $failedCount
            ]);

            $campaign->update([
                'status' => 'completed',
                'sent_count' => $successCount,
                'failed_count' => $failedCount,
                'last_execution' => now()
            ]);

            \Log::info('🎯 [ELEVENLABS] Campaña completada', [
                'campaign_id' => $campaign->id,
                'execution_id' => $execution->id,
                'total_contacts' => count($contacts),
                'success_count' => $successCount,
                'failed_count' => $failedCount
            ]);

        } catch (\Exception $e) {
            \Log::error('❌ [ELEVENLABS] Error ejecutando campaña', [
                'campaign_id' => $campaign->id,
                'execution_id' => $execution->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            // Marcar ejecución como fallida
            $execution->update([
                'status' => 'failed',
                'completed_at' => now(),
                'error_message' => $e->getMessage()
            ]);
            
            throw $e;
        }
    }

    /**
     * Realizar llamada usando ElevenLabs ConvoAI
     */
    private function makeElevenLabsCall(string $phone, string $message, array $contact): array
    {
        try {
            \Log::info('📞 [ELEVENLABS API] Iniciando llamada', [
                'phone' => $phone,
                'message_length' => strlen($message)
            ]);

            // Configuración de ElevenLabs
            $elevenLabsApiKey = env('ELEVENLABS_API_KEY');
            $agentId = env('ELEVENLABS_AGENT_ID', 'your-agent-id-here');
            
            if (!$elevenLabsApiKey) {
                throw new \Exception('API key de ElevenLabs no configurada');
            }
            
            if (!$agentId) {
                throw new \Exception('Agent ID de ElevenLabs no configurado');
            }

            // Payload para ElevenLabs ConvoAI usando Twilio
            $payload = [
                'agent_id' => $agentId,
                'agent_phone_number_id' => env('ELEVENLABS_PHONE_NUMBER_ID', 'pn_60af9b3f5b4e4f001f0e1e1f'),
                'to_number' => $phone,
                'conversation_initiation_client_data' => [
                    'system_prompt' => "Eres un asistente virtual amigable que llama en nombre de una compañía de seguros. Tu mensaje principal es: {$message}. Mantén la conversación breve y profesional. Si la persona no está interesada, respeta su decisión y termina la llamada cordialmente.",
                    'temperature' => 0.7
                ],
                'metadata' => [
                    'contact_name' => $contact['name'] ?? 'Cliente',
                    'campaign_type' => 'insurance_campaign',
                    'message_content' => $message
                ]
            ];

            \Log::info('📞 [ELEVENLABS API] Enviando request', [
                'url' => 'https://api.elevenlabs.io/v1/convai/conversations/outbound',
                'agent_id' => $agentId,
                'phone' => $phone
            ]);

            // Realizar request a ElevenLabs usando el endpoint correcto de Twilio
            $response = Http::withHeaders([
                'xi-api-key' => $elevenLabsApiKey,
                'Content-Type' => 'application/json'
            ])->timeout(30)->post('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', $payload);

            \Log::info('📞 [ELEVENLABS API] Respuesta recibida', [
                'status' => $response->status(),
                'response_body' => $response->body()
            ]);

            if ($response->successful()) {
                $responseData = $response->json();
                
                return [
                    'success' => true,
                    'call_id' => $responseData['conversation_id'] ?? $responseData['id'] ?? null,
                    'status' => $responseData['status'] ?? 'initiated',
                    'response_data' => $responseData
                ];
            } else {
                $errorMessage = $response->json()['detail'] ?? 'Error en API de ElevenLabs';
                
                \Log::error('❌ [ELEVENLABS API] Error en respuesta', [
                    'status' => $response->status(),
                    'error' => $errorMessage,
                    'response_body' => $response->body()
                ]);
                
                return [
                    'success' => false,
                    'error' => $errorMessage,
                    'status_code' => $response->status()
                ];
            }

        } catch (\Exception $e) {
            \Log::error('❌ [ELEVENLABS API] Exception en llamada', [
                'phone' => $phone,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return [
                'success' => false,
                'error' => 'Error de conexión: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Procesar variables dinámicas en un mensaje de campaña
     * 
     * @param string $messageTemplate El mensaje template con variables {nombre}, {apellidos}, etc.
     * @param array $contact Los datos del contacto
     * @return string El mensaje con las variables reemplazadas
     */
    private function processMessageVariables(string $messageTemplate, array $contact): string
    {
        try {
            Log::info('🔄 [MESSAGE VARIABLES] Procesando variables en mensaje', [
                'template_preview' => mb_substr($messageTemplate, 0, 160) . (mb_strlen($messageTemplate) > 160 ? '…' : ''),
                'contact_keys' => array_keys($contact)
            ]);

            // Normalizar origen de datos del contacto (preferir campos comunes)
            $nombre      = $contact['name'] ?? $contact['nombre'] ?? '';
            $apellidos   = $contact['apellidos'] ?? $contact['last_name'] ?? '';
            $email       = $contact['email'] ?? $contact['email_principal'] ?? '';
            $telefono    = $contact['phone'] ?? $contact['celular_principal'] ?? '';
            $cuit        = $contact['cuit'] ?? $contact['documento'] ?? '';
            $fnac        = $contact['fecha_nacimiento'] ?? $contact['birth_date'] ?? '';
            $direccion   = $contact['direccion'] ?? $contact['address'] ?? '';
            $ciudad      = $contact['ciudad'] ?? $contact['city'] ?? '';
            $ocupacion   = $contact['ocupacion'] ?? $contact['occupation'] ?? '';
            $estado      = $contact['estado'] ?? $contact['status'] ?? '';
            $tipoDoc     = $contact['tipo_documento'] ?? $contact['document_type'] ?? '';
            $policyNum   = $contact['policy_number'] ?? '';
            $policyType  = $contact['policy_type'] ?? '';

            // Mapeo de variables soportadas (ES y EN)
            $available = [
                // Español
                'nombre'            => $nombre,
                'apellidos'         => $apellidos,
                'email_principal'   => $email,
                'celular_principal' => $telefono,
                'cuit'              => $cuit,
                'fecha_nacimiento'  => $fnac,
                'direccion'         => $direccion,
                'ciudad'            => $ciudad,
                'ocupacion'         => $ocupacion,
                'estado'            => $estado,
                'tipo_documento'    => $tipoDoc,
                'numero_poliza'     => $policyNum,
                'tipo_poliza'       => $policyType,

                // Inglés / alias comunes
                'name'              => $nombre,
                'last_name'         => $apellidos,
                'email'             => $email,
                'phone'             => $telefono,
                'policy_number'     => $policyNum,
                'policy_type'       => $policyType,
                'birth_date'        => $fnac,
                'address'           => $direccion,
                'city'              => $ciudad,
                'document_type'     => $tipoDoc,
                'status'            => $estado,
            ];

            $processed = $messageTemplate;

            // Reemplazar soportando {var} y {{var}} (con espacios opcionales), case-insensitive para nombres en inglés
            foreach ($available as $var => $val) {
                $val = is_scalar($val) ? (string) $val : '';
                $quoted = preg_quote($var, '/');

                // {{ var }}
                $patternMustache = '/\{\{\s*' . $quoted . '\s*\}\}/i';
                $processed = preg_replace($patternMustache, $val, $processed);

                // { var }
                $patternBrace = '/\{\s*' . $quoted . '\s*\}/i';
                $processed = preg_replace($patternBrace, $val, $processed);
            }

            Log::info('✅ [MESSAGE VARIABLES] Variables procesadas', [
                'processed_preview' => mb_substr($processed, 0, 160) . (mb_strlen($processed) > 160 ? '…' : ''),
            ]);

            return $processed;
        } catch (\Exception $e) {
            Log::error('❌ [MESSAGE VARIABLES] Error procesando variables', [
                'error' => $e->getMessage(),
            ]);
            return $messageTemplate;
        }
    }

    /**
     * Buscar una instancia CONECTADA para un broker (con fallback y verificación en microservicio)
     */
    private function findConnectedInstanceForBroker(int $brokerId): ?\App\Models\WhatsAppInstance
    {
        try {
            $serviceUrl = env('WHATSAPP_SERVICE_URL', 'http://127.0.0.1:3000/api/v1');

            $candidates = \App\Models\WhatsAppInstance::query()
                ->where('broker_id', $brokerId)
                ->where('is_active', true)
                ->whereNotNull('instance_id')
                ->orderByDesc('updated_at')
                ->get();

            foreach ($candidates as $candidate) {
                // Asegurar que exista en el microservicio
                $this->ensureInstanceExistsInMicroservicio($candidate); // typo fixed below in final function call

                try {
                    $statusResp = Http::timeout(5)->get("{$serviceUrl}/instances/{$candidate->instance_id}/status");
                    if ($statusResp->successful()) {
                        $data = $statusResp->json();
                        if (($data['connected'] ?? false) || in_array($data['status'] ?? '', ['connected', 'authenticated'])) {
                            Log::info('✅ [FIND CONNECTED INSTANCE] Instancia conectada encontrada', [
                                'broker_id' => $brokerId,
                                'instance_db_id' => $candidate->id,
                                'instance_id' => $candidate->instance_id
                            ]);
                            return $candidate;
                        }
                    }
                } catch (\Exception $e) {
                    Log::warning('⚠️ [FIND CONNECTED INSTANCE] Error consultando status de instancia', [
                        'instance_id' => $candidate->instance_id,
                        'error' => $e->getMessage()
                    ]);
                }
            }

            Log::warning('⚠️ [FIND CONNECTED INSTANCE] No se encontraron instancias conectadas', [
                'broker_id' => $brokerId,
                'total_candidates' => $candidates->count()
            ]);
            return null;
        } catch (\Exception $e) {
            Log::error('❌ [FIND CONNECTED INSTANCE] Error buscando instancia conectada', [
                'broker_id' => $brokerId,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Asegurar que una instancia existe en el microservicio (sincronización automática)
     */
    private function ensureInstanceExistsInMicroservicio(\App\Models\WhatsAppInstance $instance): bool
    {
        // Wrapper para mantener compatibilidad con la llamada anterior
        return $this->ensureInstanceExistsInMicroservice($instance);
    }

    /**
     * Asegurar que una instancia existe en el microservicio (sincronización automática)
     */
    private function ensureInstanceExistsInMicroservice(\App\Models\WhatsAppInstance $instance): bool
    {
        try {
            $microserviceUrl = env('WHATSAPP_SERVICE_URL', 'http://127.0.0.1:3000/api/v1');
            
            Log::info('🔄 [AUTO SYNC] Verificando existencia de instancia en microservicio', [
                'instance_id' => $instance->instance_id,
                'db_id' => $instance->id
            ]);
            
            // Verificar si la instancia existe en el microservicio
            $statusResponse = Http::timeout(5)->get("{$microserviceUrl}/instances/{$instance->instance_id}/status");
            
            if ($statusResponse->successful()) {
                Log::info('✅ [AUTO SYNC] Instancia ya existe en microservicio', [
                    'instance_id' => $instance->instance_id
                ]);
                return true;
            }
            
            // Si no existe (404), crearla automáticamente
            if ($statusResponse->status() === 404) {
                Log::info('🆕 [AUTO SYNC] Instancia no existe, creando en microservicio...', [
                    'instance_id' => $instance->instance_id
                ]);
                
                $createResponse = Http::timeout(10)->post("{$microserviceUrl}/instances", [
                    'instanceId' => $instance->instance_id,
                    'webhook' => $instance->webhook_url,
                    'settings' => $instance->settings ?? []
                ]);
                
                if ($createResponse->successful()) {
                    Log::info('✅ [AUTO SYNC] Instancia creada exitosamente en microservicio', [
                        'instance_id' => $instance->instance_id
                    ]);
                    
                    // Actualizar estado en BD
                    $instance->update([
                        'status' => 'connecting',
                        'last_activity_at' => now()
                    ]);
                    
                    // Esperar un momento para que se conecte
                    sleep(2);
                    
                    // Verificar si se conectó automáticamente
                    $newStatusResponse = Http::timeout(5)->get("{$microserviceUrl}/instances/{$instance->instance_id}/status");
                    if ($newStatusResponse->successful()) {
                        $statusData = $newStatusResponse->json();
                        $connected = $statusData['connected'] ?? false;
                        
                        Log::info('📊 [AUTO SYNC] Estado de instancia después de crear', [
                            'instance_id' => $instance->instance_id,
                            'connected' => $connected,
                            'status' => $statusData['status'] ?? 'unknown'
                        ]);
                        
                        $instance->update([
                            'status' => $connected ? 'connected' : 'connecting',
                            'last_activity_at' => now()
                        ]);
                    }
                    
                    return true;
                } else {
                    Log::error('❌ [AUTO SYNC] Error al crear instancia en microservicio', [
                        'instance_id' => $instance->instance_id,
                        'status_code' => $createResponse->status(),
                        'response' => $createResponse->body()
                    ]);
                    return false;
                }
            }
            
            return false;
            
        } catch (\Exception $e) {
            Log::error('❌ [AUTO SYNC] Exception verificando/creando instancia', [
                'instance_id' => $instance->instance_id,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }
    /**
     * Subir media para campañas (solo imágenes)
     * Acepta multipart/form-data con campo "media"
     * Retorna { media_url, media_type }
     */
    public function uploadMedia(Request $request): JsonResponse
    {
        try {
            // Autenticación/broker (lanza excepción si falla)
            $this->getBrokerId($request);

            // Diagnóstico de límites del servidor
            $limits = [
                'upload_max_filesize' => ini_get('upload_max_filesize'),
                'post_max_size' => ini_get('post_max_size'),
            ];

            // Verificar presencia del archivo
            if (!$request->hasFile('media')) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se recibió ningún archivo',
                    'errors' => ['media' => ['missing_file']],
                    'limits' => $limits,
                ], 422);
            }

            /** @var \Illuminate\Http\UploadedFile $file */
            $file = $request->file('media');

            // Verificar error de carga PHP (antes de validar)
            if (!$file->isValid()) {
                $errorCode = $file->getError();
                if (in_array($errorCode, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
                    return response()->json([
                        'success' => false,
                        'message' => 'El archivo excede el tamaño permitido por el servidor',
                        'errors' => ['media' => ['file_too_large_by_server_limits']],
                        'limits' => $limits,
                    ], 413);
                }

                return response()->json([
                    'success' => false,
                    'message' => 'Error al recibir el archivo',
                    'errors' => ['media' => ['upload_failed', 'code_'.$errorCode]],
                    'limits' => $limits,
                ], 422);
            }

            // Validaciones explícitas (tipo y tamaño máx 5MB)
            $mime = $file->getMimeType() ?: '';
            $allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
            if (!in_array(strtolower($mime), $allowedMimes, true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Tipo de archivo no soportado',
                    'errors' => ['media' => ['invalid_mime', $mime]],
                ], 422);
            }

            $maxBytes = 5 * 1024 * 1024; // 5MB
            if (is_numeric($file->getSize()) && (int)$file->getSize() > $maxBytes) {
                return response()->json([
                    'success' => false,
                    'message' => 'El archivo supera el límite de 5MB',
                    'errors' => ['media' => ['too_large_5mb']],
                ], 413);
            }

            // Rutas/URLs base
            $schemeHost = $request->getSchemeAndHttpHost(); // incluye puerto (p.ej. 127.0.0.1:8001)

            // Asegurar directorio del disco público y guardar usando disk('public')
            try {
                \Storage::disk('public')->makeDirectory('campaign-media');
            } catch (\Throwable $mkEx) {
                \Log::warning('⚠️ [MEDIA UPLOAD] No se pudo crear directorio en disk(public)', [
                    'error' => $mkEx->getMessage()
                ]);
            }

            // Guardar en storage/app/public/campaign-media usando el disco 'public'
            $path = \Storage::disk('public')->putFile('campaign-media', $file); // e.g. 'campaign-media/abc.png'
            if (!$path) {
                \Log::error('❌ [MEDIA UPLOAD] putFile() devolvió false');
                return response()->json([
                    'success' => false,
                    'message' => 'No se pudo guardar el archivo en el storage público',
                ], 500);
            }

            $absStoragePath = storage_path('app/public/' . ltrim($path, '/'));
            $filename = basename($path);
            $storageUrl = rtrim($schemeHost, '/') . '/storage/' . ltrim($path, '/');

            // Validar que el archivo realmente exista
            $exists = is_file($absStoragePath);
            \Log::info('📦 [MEDIA UPLOAD] Archivo guardado en disk(public)', [
                'path' => $path,
                'abs' => $absStoragePath,
                'exists' => $exists,
                'size_bytes' => $exists ? @filesize($absStoragePath) : null,
            ]);

            // Fallback: copiar a public/campaign-media para servir sin symlink (artisan serve puede dar 403 con /storage)
            $finalUrl = $storageUrl;
            try {
                $publicDir = public_path('campaign-media');
                if (!is_dir($publicDir)) {
                    @mkdir($publicDir, 0775, true);
                }
                $publicPath = $publicDir . DIRECTORY_SEPARATOR . $filename;

                if ($exists && @copy($absStoragePath, $publicPath)) {
                    @chmod($publicPath, 0644);
                    $publicUrl = rtrim($schemeHost, '/') . '/campaign-media/' . $filename;
                    $finalUrl = $publicUrl;
                    \Log::info('🟢 [MEDIA UPLOAD] Copia pública creada', [
                        'public_path' => $publicPath,
                        'url' => $publicUrl,
                    ]);
                } else {
                    \Log::warning('⚠️ [MEDIA UPLOAD] No se pudo crear copia pública o archivo no existe', [
                        'exists' => $exists,
                        'public_dest' => $publicPath ?? null,
                    ]);
                }
            } catch (\Throwable $copyEx) {
                \Log::warning('⚠️ [MEDIA UPLOAD] Error creando copia pública', [
                    'error' => $copyEx->getMessage(),
                ]);
            }

            // Responder con URL final (prioriza público directo; si falla, usa /storage)
            return response()->json([
                'success' => true,
                'media_url' => $finalUrl,
                'media_type' => 'image',
                // Solo para depuración local
                'debug' => app()->environment('local') ? [
                    'disk_public_path' => $path,
                    'abs_storage_path' => $absStoragePath,
                    'storage_url' => $storageUrl,
                    'served_url' => $finalUrl,
                ] : null,
            ], 201);
        } catch (\Throwable $e) {
            \Log::error('❌ [CAMPAIGN MEDIA UPLOAD] Error subiendo media', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al subir media',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Detener una campaña en envío (pausar)
     */
    public function stop($id, Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $campaign = Campaign::findOrFail($id);

            if ((int)$campaign->broker_id !== (int)$brokerId) {
                return response()->json(['success' => false, 'message' => 'No autorizado para esta campaña'], 403);
            }

            $prevStatus = $campaign->status;

            // Idempotencia si ya está pausada
            if ($campaign->status === 'paused') {
                return response()->json([
                    'success' => true,
                    'message' => 'Campaña ya está pausada',
                    'data' => $campaign
                ]);
            }

            // No detener estados finales
            if (in_array($campaign->status, ['completed', 'cancelled', 'failed'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se puede detener una campaña en estado: ' . $campaign->status
                ], 422);
            }

            $campaign->update([
                'status' => 'paused',
                'is_active' => false
            ]);

            $execution = CampaignExecution::where('campaign_id', $campaign->id)
                ->orderByDesc('id')
                ->first();

            if ($execution && in_array($execution->status, ['running', 'pending', 'scheduled'])) {
                $execution->update(['status' => 'paused']);
            }

            Log::info('⏸️ [CAMPAIGN STOP] Campaña detenida', [
                'campaign_id' => $campaign->id,
                'previous_status' => $prevStatus,
                'new_status' => 'paused',
                'execution_id' => $execution?->id
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Campaña detenida (pausada) correctamente',
                'data' => $campaign->fresh(),
                'execution_id' => $execution?->id
            ]);
        } catch (\Throwable $e) {
            Log::error('❌ [CAMPAIGN STOP] Error deteniendo campaña', [
                'campaign_id' => $id,
                'error' => $e->getMessage()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Error al detener campaña',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Cancelar una campaña en envío (marcar pendientes como fallidos y cerrar)
     */
    public function cancel($id, Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $campaign = Campaign::findOrFail($id);

            if ((int)$campaign->broker_id !== (int)$brokerId) {
                return response()->json(['success' => false, 'message' => 'No autorizado para esta campaña'], 403);
            }

            // Idempotencia
            if ($campaign->status === 'cancelled') {
                return response()->json([
                    'success' => true,
                    'message' => 'Campaña ya está cancelada',
                    'data' => $campaign
                ]);
            }

            $campaign->update([
                'status' => 'cancelled',
                'is_active' => false
            ]);

            $execution = CampaignExecution::where('campaign_id', $campaign->id)
                ->orderByDesc('id')
                ->first();

            if ($execution && in_array($execution->status, ['running', 'pending', 'scheduled'])) {
                $execution->update([
                    'status' => 'cancelled',
                    'completed_at' => now(),
                    'error_message' => 'Cancelado por el usuario'
                ]);
            }

            // Marcar mensajes pendientes como fallidos (solo de la ejecución actual si existe)\ntry {\n    $query = CampaignMessage::where('campaign_id', $campaign->id)\n        ->where('status', CampaignMessage::STATUS_PENDING);\n\n    if ($execution) {\n        $query->where('campaign_execution_id', $execution->id);\n    }\n\n    $updated = $query->update([\n        'status' => CampaignMessage::STATUS_FAILED,\n        'failed_at' => now(),\n        'error_message' => 'Cancelado por el usuario'\n    ]);\n} catch (\\Throwable $e) {\n    Log::warning('⚠️ [CAMPAIGN CANCEL] Falló actualización de mensajes pendientes', [\n        'campaign_id' => $campaign->id,\n        'error' => $e->getMessage()\n    ]);\n    $updated = 0;\n}\n\n// Actualizar contadores de forma tolerante a errores\ntry {\n    if ($execution) {\n        $this->updateCampaignCounters($campaign->id, $execution->id);\n    }\n} catch (\\Throwable $e) {\n    Log::warning('⚠️ [CAMPAIGN CANCEL] Falló actualización de contadores', [\n        'campaign_id' => $campaign->id,\n        'execution_id' => $execution?->id,\n        'error' => $e->getMessage()\n    ]);\n}

            Log::info('🛑 [CAMPAIGN CANCEL] Campaña cancelada', [
                'campaign_id' => $campaign->id,
                'execution_id' => $execution?->id,
                'pending_marked_failed' => $updated
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Campaña cancelada correctamente',
                'data' => $campaign->fresh(),
                'execution_id' => $execution?->id,
                'pending_to_failed' => $updated
            ]);

        } catch (\Throwable $e) {
            Log::error('❌ [CAMPAIGN CANCEL] Error cancelando campaña', [
                'campaign_id' => $id,
                'error' => $e->getMessage()
            ]);

            // Fallback: si ya se marcó como cancelada antes del error, responder 200 para no romper la UI
            try {
                $current = Campaign::find($id);
                if ($current && $current->status === 'cancelled') {
                    return response()->json([
                        'success' => true,
                        'message' => 'Campaña cancelada con advertencias',
                        'warning' => $e->getMessage()
                    ]);
                }
            } catch (\Throwable $inner) {
                Log::warning('⚠️ [CAMPAIGN CANCEL] Error verificando estado tras excepción', [
                    'campaign_id' => $id,
                    'error' => $inner->getMessage()
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Error al cancelar campaña',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
