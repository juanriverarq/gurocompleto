<?php

namespace App\Services;

use App\Models\Chatbot;
use App\Models\ChatbotFlow;
use App\Models\ChatbotNode;
use App\Models\ChatbotSession;
use App\Models\ChatbotTrigger;
use App\Models\ChatbotTriggerLog;
use App\Models\WhatsAppConversation;
use App\Models\WhatsAppDepartment;
use App\Models\WhatsAppInstance;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * ChatbotProcessorService
 * =======================
 * Procesa mensajes entrantes y ejecuta flujos de chatbot.
 * Toda la lógica de chatbot está en Laravel, no en el microservicio.
 * 
 * Soporta:
 * - Nodos de mensaje, opciones, transferencia, fin
 * - Nodo ai_response para respuestas inteligentes con OpenAI/Claude
 * - Nodo media para enviar imágenes, documentos, audio
 * - Nodo interactive para botones y listas
 * - Persistencia de sesiones en base de datos
 */
class ChatbotProcessorService
{
    protected WhatsAppBridgeService $bridge;
    protected WhatsAppClassificationService $classifier;
    protected AIResponseService $aiService;
    protected bool $useDbSessions;

    public function __construct(
        WhatsAppBridgeService $bridge,
        WhatsAppClassificationService $classifier,
        AIResponseService $aiService
    ) {
        $this->bridge = $bridge;
        $this->classifier = $classifier;
        $this->aiService = $aiService;
        $this->useDbSessions = env('CHATBOT_USE_DB_SESSIONS', true);
    }

    /**
     * Procesar mensaje entrante desde webhook
     */
    public function processIncomingMessage(array $data): array
    {
        $instanceId = $data['instanceId'] ?? null;
        $phone = $data['phone'] ?? null;
        $message = $data['message'] ?? '';
        $messageType = $data['type'] ?? 'text';
        $pushName = $data['pushName'] ?? null;

        if (!$instanceId || !$phone) {
            return ['processed' => false, 'reason' => 'Missing instanceId or phone'];
        }

        // Ignorar mensajes de grupos y broadcasts
        if (str_contains($phone, '@g.us') || str_contains($phone, 'broadcast')) {
            return ['processed' => false, 'reason' => 'Group or broadcast message ignored'];
        }

        Log::info("📥 [CHATBOT] Mensaje recibido", [
            'instanceId' => $instanceId,
            'phone' => $phone,
            'message' => substr($message, 0, 50),
        ]);

        // Buscar instancia en la base de datos
        $instance = WhatsAppInstance::where('instance_id', $instanceId)->first();
        if (!$instance) {
            return ['processed' => false, 'reason' => 'Instance not found in database'];
        }

        // Obtener o crear conversación (SIEMPRE, independientemente del chatbot)
        $conversation = WhatsAppConversation::findOrCreateByPhone(
            $instance->broker_id,
            $instance->id,
            $phone,
            $pushName
        );

        // Guardar mensaje entrante (solo si NO viene de Cloud API, ya que el webhook ya lo guardó)
        $isCloudApi = $data['isCloudApi'] ?? false;
        if (!$isCloudApi) {
            $conversation->addMessage([
                'message_id' => $data['messageId'] ?? null,
                'direction' => 'incoming',
                'sender_type' => 'client',
                'message_type' => $messageType,
                'content' => $message,
                'media' => $data['media'] ?? null,
            ]);
        }

        // Buscar chatbot activo para esta instancia
        $chatbot = Chatbot::where('instance_id', $instanceId)
            ->where('is_active', true)
            ->first();

        if (!$chatbot) {
            Log::info("📥 [CHATBOT] No hay chatbot activo para instancia {$instanceId}");
            return ['processed' => false, 'reason' => 'No active chatbot for instance', 'conversation_id' => $conversation->id];
        }

        // Human Takeover Guard: bloquear bot cuando un asesor está manejando la conversación.
        // El bot se reactiva automáticamente si pasan 2h sin respuesta del asesor.
        // También se reactiva cuando el asesor marca como resuelta (status → closed via resolveConversation).
        if (in_array($conversation->status, ['assigned', 'in_progress'])) {
            $hoursSinceAssignment = $conversation->assigned_at
                ? $conversation->assigned_at->diffInHours(now())
                : 0;

            if ($hoursSinceAssignment < 2) {
                Log::info("🚫 [CHATBOT] Bot bloqueado: asesor humano activo", [
                    'conversation_id' => $conversation->id,
                    'status' => $conversation->status,
                    'hours_since_assignment' => $hoursSinceAssignment,
                ]);
                return ['processed' => false, 'reason' => 'Human agent handling conversation', 'conversation_id' => $conversation->id];
            }

            // Han pasado 2h sin actividad del asesor → reactivar bot y resetear asignación
            Log::info("⏰ [CHATBOT] 2h sin respuesta del asesor, reactivando bot", [
                'conversation_id' => $conversation->id,
                'hours_since_assignment' => $hoursSinceAssignment,
            ]);
            $conversation->update([
                'status' => 'pending',
                'assigned_to' => null,
                'assigned_at' => null,
            ]);
        }

        // Verificar horario de atención
        if ($chatbot->business_hours_enabled && !$chatbot->isWithinBusinessHours()) {
            $outOfHoursMsg = $chatbot->out_of_hours_message;
            if ($outOfHoursMsg) {
                // Enviar mensaje fuera de horario (máximo 1 vez cada 30 min por conversación)
                $cacheKey = "out_of_hours_{$instanceId}_{$phone}";
                if (!Cache::has($cacheKey)) {
                    $this->bridge->sendMessage($instanceId, $phone, $outOfHoursMsg);
                    $conversation->addMessage([
                        'direction' => 'outgoing',
                        'sender_type' => 'bot',
                        'message_type' => 'text',
                        'content' => $outOfHoursMsg,
                        'status' => 'sent',
                    ]);
                    Cache::put($cacheKey, true, now()->addMinutes(30));
                }
            }
            Log::info("🕐 [CHATBOT] Fuera de horario de atención", [
                'chatbot_id' => $chatbot->id,
                'timezone' => $chatbot->timezone,
            ]);
            return ['processed' => false, 'reason' => 'Outside business hours', 'conversation_id' => $conversation->id];
        }

        // Verificar si hay una sesión activa (BD o Cache según configuración)
        $session = $this->getSession($chatbot->id, $instanceId, $phone);
        
        Log::info("🔍 [CHATBOT] Buscando sesión", [
            'chatbot_id' => $chatbot->id,
            'instance_id' => $instanceId,
            'phone' => $phone,
            'session_found' => $session ? true : false,
            'waiting_for_input' => $session['waiting_for_input'] ?? false,
            'input_node_id' => $session['input_node_id'] ?? null,
        ]);

        if ($session && !$this->isSessionExpired($session)) {
            // Guardar último mensaje del usuario para nodos AI
            $session['last_user_message'] = $message;
            $session['conversation_history'][] = ['role' => 'user', 'content' => $message];
            
            Log::info("➡️ [CHATBOT] Continuando flujo existente", [
                'session_id' => $session['db_session_id'] ?? 'cache',
                'waiting_for_input' => $session['waiting_for_input'] ?? false,
            ]);
            
            // Continuar flujo existente
            return $this->continueFlow($session, $message, $instanceId, $phone, $conversation);
        }

        // Buscar trigger que coincida
        $matchedTrigger = $this->findMatchingTrigger($chatbot, $message, $phone, $instanceId);

        if (!$matchedTrigger) {
            Log::info("📥 [CHATBOT] No se encontró trigger para: {$message}");
            return ['processed' => false, 'reason' => 'No matching trigger'];
        }

        Log::info("🎯 [CHATBOT] Trigger encontrado", [
            'type' => $matchedTrigger->trigger_type,
            'flowId' => $matchedTrigger->flow_id,
        ]);

        // Crear nueva sesión
        $session = $this->createSession($chatbot, $matchedTrigger, $phone, $instanceId);
        $session['last_user_message'] = $message;
        $session['conversation_history'] = [['role' => 'user', 'content' => $message]];
        
        $this->saveSession($session, $instanceId, $phone);

        // Ejecutar flujo
        return $this->executeFlow($session, $instanceId, $phone, $conversation, $message);
    }

    /**
     * Buscar trigger que coincida con el mensaje
     */
    protected function findMatchingTrigger(Chatbot $chatbot, string $message, string $phone, string $instanceId = null): ?ChatbotTrigger
    {
        $triggers = ChatbotTrigger::where('chatbot_id', $chatbot->id)
            ->where('is_active', true)
            ->orderBy('priority', 'desc')
            ->get();

        $messageLower = strtolower(trim($message));

        // Primero buscar triggers específicos (keyword, exact, regex) - tienen prioridad
        $firstMessageTrigger = null;
        
        foreach ($triggers as $trigger) {
            // Verificar si el trigger puede ser disparado según configuración de re-disparo
            if ($instanceId && !$trigger->canTriggerFor($instanceId, $phone)) {
                Log::debug("🚫 [CHATBOT] Trigger {$trigger->id} bloqueado por configuración de re-disparo", [
                    'trigger_type' => $trigger->trigger_type,
                    'retrigger_mode' => $trigger->retrigger_mode,
                    'phone' => $phone
                ]);
                continue;
            }

            switch ($trigger->trigger_type) {
                case 'first_message':
                    // Guardar para usar después si no hay match específico
                    if ($this->isFirstMessage($chatbot->id, $phone)) {
                        $firstMessageTrigger = $trigger;
                    }
                    break;

                case 'keyword':
                    // Buscar keywords en config['keywords'] (array) o trigger_value (string separado por comas)
                    $config = $trigger->config ?? [];
                    $keywords = $config['keywords'] ?? [];
                    
                    // Si no hay keywords en config, usar trigger_value
                    if (empty($keywords) && !empty($trigger->trigger_value)) {
                        $keywords = array_map('trim', explode(',', $trigger->trigger_value));
                    }
                    
                    foreach ($keywords as $keyword) {
                        if (!empty($keyword) && str_contains($messageLower, strtolower($keyword))) {
                            // Keyword match tiene prioridad - marcar first_message como usado
                            $this->markFirstMessageUsed($chatbot->id, $phone);
                            // Registrar el disparo
                            if ($instanceId) {
                                $trigger->recordTrigger($instanceId, $phone);
                            }
                            return $trigger;
                        }
                    }
                    break;

                case 'exact':
                    if ($messageLower === strtolower($trigger->trigger_value ?? '')) {
                        $this->markFirstMessageUsed($chatbot->id, $phone);
                        if ($instanceId) {
                            $trigger->recordTrigger($instanceId, $phone);
                        }
                        return $trigger;
                    }
                    break;

                case 'regex':
                    $pattern = $trigger->trigger_value ?? '';
                    if ($pattern && preg_match($pattern, $message)) {
                        $this->markFirstMessageUsed($chatbot->id, $phone);
                        if ($instanceId) {
                            $trigger->recordTrigger($instanceId, $phone);
                        }
                        return $trigger;
                    }
                    break;

                case 'all':
                    if ($instanceId) {
                        $trigger->recordTrigger($instanceId, $phone);
                    }
                    return $trigger;
            }
        }

        // Si no hubo match específico, usar first_message si está disponible
        if ($firstMessageTrigger) {
            // Marcar como usado
            $this->markFirstMessageUsed($chatbot->id, $phone);
            if ($instanceId) {
                $firstMessageTrigger->recordTrigger($instanceId, $phone);
            }
            return $firstMessageTrigger;
        }

        return null;
    }

    /**
     * Verificar si es el primer mensaje del usuario
     * Usa ChatbotTriggerLog (BD persistente) + cache para performance
     */
    protected function isFirstMessage(int $chatbotId, string $phone): bool
    {
        $cacheKey = "first_message_{$chatbotId}_{$phone}";
        
        // Fast path: cache dice que ya interactuó
        if (Cache::has($cacheKey)) {
            return false;
        }

        // Verificar en BD: ¿hay algún trigger log de first_message para este contacto+chatbot?
        $hasLog = ChatbotTriggerLog::whereHas('trigger', function ($q) use ($chatbotId) {
            $q->where('chatbot_id', $chatbotId)
              ->where('trigger_type', 'first_message');
        })->where('contact_phone', $phone)->exists();

        if ($hasLog) {
            // Existe en BD pero no en cache — restaurar cache y retornar false
            Cache::put($cacheKey, true, now()->addHours(24));
            return false;
        }

        // Verificar también si hay sesiones previas (otro indicador de interacción previa)
        $hasSession = ChatbotSession::where('chatbot_id', $chatbotId)
            ->where('contact_phone', $phone)
            ->exists();

        if ($hasSession) {
            Cache::put($cacheKey, true, now()->addHours(24));
            return false;
        }

        return true;
    }
    
    /**
     * Marcar que el primer mensaje ya fue procesado
     */
    protected function markFirstMessageUsed(int $chatbotId, string $phone): void
    {
        $cacheKey = "first_message_{$chatbotId}_{$phone}";
        Cache::put($cacheKey, true, now()->addHours(24));
    }

    /**
     * Crear sesión de chatbot
     */
    protected function createSession(Chatbot $chatbot, ChatbotTrigger $trigger, string $phone, string $instanceId): array
    {
        return [
            'chatbot_id' => $chatbot->id,
            'flow_id' => $trigger->flow_id,
            'instance_id' => $instanceId,
            'current_step' => 0,
            'phone' => $phone,
            'variables' => [
                'phone' => $phone,
                'bot_name' => $chatbot->name,
            ],
            'conversation_history' => [],
            'waiting_for_response' => false,
            'created_at' => now()->timestamp,
            'last_activity' => now()->timestamp,
        ];
    }

    /**
     * Verificar si la sesión expiró
     */
    protected function isSessionExpired(array $session): bool
    {
        $timeout = 30 * 60; // 30 minutos
        return (now()->timestamp - ($session['last_activity'] ?? 0)) > $timeout;
    }

    // =========================================================================
    // GESTIÓN DE SESIONES (BD o Cache)
    // =========================================================================

    /**
     * Obtener sesión activa
     */
    protected function getSession(int $chatbotId, string $instanceId, string $phone): ?array
    {
        if ($this->useDbSessions) {
            return $this->getSessionFromDb($chatbotId, $instanceId, $phone);
        }
        
        $sessionKey = "chatbot_session_{$instanceId}_{$phone}";
        return Cache::get($sessionKey);
    }

    /**
     * Guardar sesión
     */
    protected function saveSession(array $session, string $instanceId, string $phone): void
    {
        $session['last_activity'] = now()->timestamp;
        
        if ($this->useDbSessions) {
            $this->saveSessionToDb($session, $instanceId, $phone);
        } else {
            $sessionKey = "chatbot_session_{$instanceId}_{$phone}";
            Cache::put($sessionKey, $session, now()->addMinutes(30));
        }
    }

    /**
     * Eliminar sesión
     */
    protected function deleteSession(string $instanceId, string $phone): void
    {
        if ($this->useDbSessions) {
            ChatbotSession::where('instance_id', $instanceId)
                ->where('contact_phone', $phone)
                ->delete();
        } else {
            $sessionKey = "chatbot_session_{$instanceId}_{$phone}";
            Cache::forget($sessionKey);
        }
    }

    /**
     * Obtener sesión desde base de datos
     */
    protected function getSessionFromDb(int $chatbotId, string $instanceId, string $phone): ?array
    {
        $dbSession = ChatbotSession::where('chatbot_id', $chatbotId)
            ->where('instance_id', $instanceId)
            ->where('contact_phone', $phone)
            ->whereIn('status', [ChatbotSession::STATUS_ACTIVE, ChatbotSession::STATUS_WAITING_INPUT])
            ->first();

        if (!$dbSession) {
            return null;
        }

        // Verificar si expiró
        if ($dbSession->isExpired()) {
            $dbSession->update(['status' => ChatbotSession::STATUS_EXPIRED]);
            return null;
        }

        // Convertir modelo a array compatible
        $vars = $dbSession->variables ?? [];
        return [
            'db_session_id' => $dbSession->id,
            'chatbot_id' => $dbSession->chatbot_id,
            'flow_id' => $dbSession->current_flow_id,
            'current_node_id' => $dbSession->current_node_id,
            'instance_id' => $dbSession->instance_id,
            'phone' => $dbSession->contact_phone,
            'variables' => $vars,
            'conversation_history' => $dbSession->conversation_history ?? [],
            'waiting_for_response' => $dbSession->status === ChatbotSession::STATUS_WAITING_INPUT,
            'expected_options' => $vars['_expected_options'] ?? null,
            'expected_buttons' => $vars['_expected_buttons'] ?? null,
            'expected_sections' => $vars['_expected_sections'] ?? null,
            'interactive_type' => $vars['_interactive_type'] ?? null,
            // Campos para nodo de entrada de datos
            'waiting_for_input' => $vars['_waiting_for_input'] ?? false,
            'input_variable_name' => $vars['_input_variable_name'] ?? null,
            'input_validation' => $vars['_input_validation'] ?? null,
            'input_node_id' => $vars['_input_node_id'] ?? null,
            'input_contact_field' => $vars['_input_contact_field'] ?? null,
            'options_node_id' => $vars['_options_node_id'] ?? null,
            'options_error_message' => $vars['_options_error_message'] ?? null,
            // Campos para nodo de consentimiento de datos
            'waiting_for_consent' => $vars['_waiting_for_consent'] ?? false,
            'consent_node_id' => $vars['_consent_node_id'] ?? null,
            'consent_next_node_id' => $vars['_consent_next_node_id'] ?? null,
            'consent_reject_node_id' => $vars['_consent_reject_node_id'] ?? null,
            'consent_reject_message' => $vars['_consent_reject_message'] ?? null,
            'created_at' => $dbSession->started_at?->timestamp ?? now()->timestamp,
            'last_activity' => $dbSession->last_activity_at?->timestamp ?? now()->timestamp,
        ];
    }

    /**
     * Guardar sesión en base de datos
     */
    protected function saveSessionToDb(array $session, string $instanceId, string $phone): void
    {
        $dbSessionId = $session['db_session_id'] ?? null;
        
        // Preparar variables incluyendo estado interno
        $variables = $session['variables'] ?? [];
        
        // Sincronizar estado de opciones (guardar o limpiar)
        if (!empty($session['expected_options'])) {
            $variables['_expected_options'] = $session['expected_options'];
        } else {
            unset($variables['_expected_options']);
        }
        if (!empty($session['expected_buttons'])) {
            $variables['_expected_buttons'] = $session['expected_buttons'];
        } else {
            unset($variables['_expected_buttons']);
        }
        if (!empty($session['expected_sections'])) {
            $variables['_expected_sections'] = $session['expected_sections'];
        } else {
            unset($variables['_expected_sections']);
        }
        if (!empty($session['interactive_type'])) {
            $variables['_interactive_type'] = $session['interactive_type'];
        } else {
            unset($variables['_interactive_type']);
        }
        if (!empty($session['options_node_id'])) {
            $variables['_options_node_id'] = $session['options_node_id'];
        } else {
            unset($variables['_options_node_id']);
        }
        if (!empty($session['options_error_message'])) {
            $variables['_options_error_message'] = $session['options_error_message'];
        } else {
            unset($variables['_options_error_message']);
        }
        
        // Campos para nodo de entrada de datos
        if (!empty($session['waiting_for_input'])) {
            $variables['_waiting_for_input'] = true;
            $variables['_input_variable_name'] = $session['input_variable_name'] ?? null;
            $variables['_input_validation'] = $session['input_validation'] ?? null;
            $variables['_input_node_id'] = $session['input_node_id'] ?? null;
            $variables['_input_contact_field'] = $session['input_contact_field'] ?? null;
        } else {
            unset($variables['_waiting_for_input']);
            unset($variables['_input_variable_name']);
            unset($variables['_input_validation']);
            unset($variables['_input_node_id']);
            unset($variables['_input_contact_field']);
        }

        // Campos para nodo de consentimiento de datos
        if (!empty($session['waiting_for_consent'])) {
            $variables['_waiting_for_consent'] = true;
            $variables['_consent_node_id'] = $session['consent_node_id'] ?? null;
            $variables['_consent_next_node_id'] = $session['consent_next_node_id'] ?? null;
            $variables['_consent_reject_node_id'] = $session['consent_reject_node_id'] ?? null;
            $variables['_consent_reject_message'] = $session['consent_reject_message'] ?? null;
        } else {
            unset($variables['_waiting_for_consent']);
            unset($variables['_consent_node_id']);
            unset($variables['_consent_next_node_id']);
            unset($variables['_consent_reject_node_id']);
            unset($variables['_consent_reject_message']);
        }

        $status = ($session['waiting_for_response'] ?? false) 
            ? ChatbotSession::STATUS_WAITING_INPUT 
            : ChatbotSession::STATUS_ACTIVE;

        Log::info("💾 [CHATBOT] saveSessionToDb", [
            'db_session_id' => $dbSessionId,
            'status' => $status,
            'waiting_for_response' => $session['waiting_for_response'] ?? false,
            'waiting_for_input' => $session['waiting_for_input'] ?? false,
            'variables_has_input' => isset($variables['_waiting_for_input']),
        ]);

        $data = [
            'chatbot_id' => $session['chatbot_id'],
            'contact_phone' => $phone,
            'instance_id' => $instanceId,
            'current_flow_id' => $session['flow_id'] ?? null,
            'current_node_id' => $session['current_node_id'] ?? null,
            'variables' => $variables,
            'conversation_history' => $session['conversation_history'] ?? [],
            'status' => $status,
            'last_activity_at' => now(),
        ];

        if ($dbSessionId) {
            $updated = ChatbotSession::where('id', $dbSessionId)->update($data);
            Log::info("💾 [CHATBOT] Sesión actualizada", ['id' => $dbSessionId, 'rows_affected' => $updated]);
        } else {
            // Buscar si ya existe una sesión para este contacto/instancia
            $existingSession = ChatbotSession::where('chatbot_id', $session['chatbot_id'])
                ->where('instance_id', $instanceId)
                ->where('contact_phone', $phone)
                ->whereIn('status', [ChatbotSession::STATUS_ACTIVE, ChatbotSession::STATUS_WAITING_INPUT])
                ->first();
            
            if ($existingSession) {
                // Actualizar sesión existente
                $existingSession->update($data);
                Log::info("💾 [CHATBOT] Sesión existente actualizada", ['id' => $existingSession->id]);
            } else {
                // Crear nueva sesión
                $data['started_at'] = now();
                $data['expires_at'] = now()->addMinutes(30);
                $newSession = ChatbotSession::create($data);
                Log::info("💾 [CHATBOT] Nueva sesión creada", ['id' => $newSession->id]);
            }
        }
    }

    /**
     * Ejecutar flujo de chatbot
     */
    protected function executeFlow(array $session, string $instanceId, string $phone, WhatsAppConversation $conversation, ?string $userMessage = null): array
    {
        $flow = ChatbotFlow::find($session['flow_id']);
        
        if (!$flow) {
            return ['processed' => false, 'reason' => 'Flow not found'];
        }

        // Obtener nodos del flujo
        $nodes = ChatbotNode::where('flow_id', $flow->id)
            ->orderBy('id')
            ->get();

        if ($nodes->isEmpty()) {
            return ['processed' => false, 'reason' => 'Flow has no nodes'];
        }

        // Encontrar nodo de inicio
        $startNode = $nodes->firstWhere('node_type', 'start');
        if (!$startNode) {
            return ['processed' => false, 'reason' => 'No start node found'];
        }

        // Construir mapa de nodos
        $nodeMap = $nodes->keyBy('id');

        // Ejecutar desde el nodo de inicio
        $responses = [];
        $currentNode = $startNode;
        $maxSteps = 10;
        $step = 0;

        $sessionKey = "chatbot_session_{$instanceId}_{$phone}";
        
        $stopped = false;
        while ($currentNode && $step < $maxSteps) {
            $step++;

            // Guardar el nodo actual en la sesión
            $session['current_node_id'] = $currentNode->id;

            // Procesar nodo actual
            $result = $this->processNode($currentNode, $session, $instanceId, $phone, $conversation);
            
            if ($result['response']) {
                $responses[] = $result['response'];
            }

            if ($result['stop']) {
                // Guardar sesión cuando se detiene (esperando respuesta)
                $stopped = true;
                Log::info("💾 [CHATBOT] Guardando sesión (stop)", [
                    'current_node_id' => $session['current_node_id'] ?? null,
                    'waiting_for_response' => $session['waiting_for_response'] ?? false,
                    'waiting_for_input' => $session['waiting_for_input'] ?? false,
                    'input_node_id' => $session['input_node_id'] ?? null,
                ]);
                $this->saveSession($session, $instanceId, $phone);
                break;
            }

            // Ir al siguiente nodo (con soporte cross-flow)
            if ($currentNode->next_node_id) {
                if (isset($nodeMap[$currentNode->next_node_id])) {
                    $currentNode = $nodeMap[$currentNode->next_node_id];
                } else {
                    // Cross-flow: el siguiente nodo está en otro flujo
                    $crossNode = ChatbotNode::find($currentNode->next_node_id);
                    if ($crossNode) {
                        $crossFlow = ChatbotFlow::find($crossNode->flow_id);
                        if ($crossFlow && $crossFlow->chatbot_id == $session['chatbot_id']) {
                            $session['flow_id'] = $crossFlow->id;
                            $nodes = ChatbotNode::where('flow_id', $crossFlow->id)->get();
                            $nodeMap = $nodes->keyBy('id');
                            $currentNode = $nodeMap[$crossNode->id] ?? null;
                        } else {
                            $currentNode = null;
                        }
                    } else {
                        $currentNode = null;
                    }
                }
            } else {
                $currentNode = null;
            }
        }

        // If the flow ended naturally (no stop = not waiting for response),
        // delete the session so the user isn't stuck.
        if (!$stopped) {
            $this->deleteSession($instanceId, $phone);
        }

        return [
            'processed' => true,
            'responses' => $responses,
            'session' => $session,
        ];
    }

    /**
     * Procesar un nodo individual
     */
    protected function processNode(ChatbotNode $node, array &$session, string $instanceId, string $phone, WhatsAppConversation $conversation): array
    {
        $config = $node->config ?? [];
        $response = null;
        $stop = false;

        switch ($node->node_type) {
            case 'start':
                // Nodo de inicio - no hace nada, solo marca el comienzo
                break;

            case 'message':
                // Enviar mensaje de texto
                $text = $config['text'] ?? $config['message'] ?? '';
                if ($text) {
                    $text = $this->replaceVariables($text, $session['variables']);
                    $result = $this->bridge->sendMessage($instanceId, $phone, $text);
                    
                    if ($result['success']) {
                        $conversation->addMessage([
                            'message_id' => $result['messageId'] ?? null,
                            'direction' => 'outgoing',
                            'sender_type' => 'bot',
                            'message_type' => 'text',
                            'content' => $text,
                            'status' => 'sent',
                        ]);
                        $response = $text;
                    }
                }
                break;

            case 'input':
            case 'user_input':
            case 'collect_data':
                // Nodo de entrada de datos - espera que el usuario escriba algo
                $text = $config['text'] ?? $config['prompt'] ?? $config['message'] ?? 'Por favor, escribe tu respuesta:';
                $variableName = $config['variable_name'] ?? $config['variable'] ?? $config['save_as'] ?? 'user_input';
                $validationType = $config['validation'] ?? null; // email, phone, number, text
                
                // Campo de contacto predefinido (first_name, last_name, document_id, email, phone_secondary, company, city, notes)
                $contactField = $config['contact_field'] ?? null;
                
                // Si hay un campo de contacto, usar su validación por defecto
                if ($contactField && isset(WhatsAppConversation::CONTACT_FIELDS[$contactField])) {
                    $fieldConfig = WhatsAppConversation::CONTACT_FIELDS[$contactField];
                    $validationType = $validationType ?? $fieldConfig['validation'];
                }
                
                $text = $this->replaceVariables($text, $session['variables']);
                
                $result = $this->bridge->sendMessage($instanceId, $phone, $text);
                if ($result['success']) {
                    $conversation->addMessage([
                        'message_id' => $result['messageId'] ?? null,
                        'direction' => 'outgoing',
                        'sender_type' => 'bot',
                        'message_type' => 'text',
                        'content' => $text,
                        'status' => 'sent',
                    ]);
                    $response = $text;
                    
                    // Limpiar estado de opciones previas para que no interfieran
                    $session['expected_options'] = null;
                    $session['expected_buttons'] = null;
                    $session['expected_sections'] = null;
                    $session['interactive_type'] = null;
                    $session['options_node_id'] = null;
                    $session['options_error_message'] = null;
                    
                    // Marcar que esperamos entrada de datos
                    $session['waiting_for_response'] = true;
                    $session['waiting_for_input'] = true;
                    $session['input_variable_name'] = $variableName;
                    $session['input_validation'] = $validationType;
                    $session['input_node_id'] = $node->id;
                    $session['input_contact_field'] = $contactField; // Campo de contacto a guardar
                }
                $stop = true; // Esperar respuesta del usuario
                break;

            case 'options':
            case 'question':
                // Enviar mensaje con opciones
                $text = $config['text'] ?? 'Selecciona una opción:';
                $options = $config['options'] ?? [];
                $errorMessage = $config['error_message'] ?? null; // Mensaje de error personalizado
                
                $numberEmojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','1️⃣1️⃣','1️⃣2️⃣','1️⃣3️⃣','1️⃣4️⃣','1️⃣5️⃣','1️⃣6️⃣','1️⃣7️⃣','1️⃣8️⃣','1️⃣9️⃣','2️⃣0️⃣'];
                $optionsText = $text . "\n";
                foreach ($options as $i => $opt) {
                    $emoji = $numberEmojis[$i] ?? (($i + 1) . '.');
                    $optionText = $opt['text'] ?? $opt['label'] ?? "Opción " . ($i + 1);
                    $optionsText .= "\n" . $emoji . " " . $optionText;
                }

                $result = $this->bridge->sendMessage($instanceId, $phone, $optionsText);
                if ($result['success']) {
                    $conversation->addMessage([
                        'message_id' => $result['messageId'] ?? null,
                        'direction' => 'outgoing',
                        'sender_type' => 'bot',
                        'message_type' => 'text',
                        'content' => $optionsText,
                        'status' => 'sent',
                    ]);
                    $response = $optionsText;
                    
                    // Marcar que esperamos respuesta
                    $session['waiting_for_response'] = true;
                    $session['expected_options'] = $options;
                    $session['options_node_id'] = $node->id;
                    $session['options_error_message'] = $errorMessage; // Guardar mensaje de error personalizado
                }
                $stop = true; // Esperar respuesta del usuario
                break;

            case 'transfer':
                // Transferir a humano
                $departmentId = $config['department_id'] ?? null;
                $userId = $config['transfer_to_user_id'] ?? null;
                
                if ($departmentId) {
                    $department = WhatsAppDepartment::find($departmentId);
                    if ($department) {
                        $conversation->classifyAndAssign($department, 'Transferido por chatbot');
                    }
                }
                
                // Asignar a usuario específico si está configurado
                if ($userId) {
                    $conversation->update([
                        'assigned_to' => $userId,
                        'status' => 'assigned',
                        'assigned_at' => now(),
                    ]);
                }
                
                // Usar transfer_message o message o default
                $transferMessage = $config['transfer_message'] ?? $config['message'] ?? 'Te estamos transfiriendo con un asesor...';
                $transferMessage = $this->replaceVariables($transferMessage, $session['variables']);
                
                $this->bridge->sendMessage($instanceId, $phone, $transferMessage);
                $conversation->addMessage([
                    'direction' => 'outgoing',
                    'sender_type' => 'bot',
                    'message_type' => 'text',
                    'content' => $transferMessage,
                    'status' => 'sent',
                ]);
                $stop = true;
                break;

            case 'end':
                // Fin del flujo
                $endMessage = $config['goodbye_message'] ?? $config['text'] ?? $config['message'] ?? null;
                if ($endMessage) {
                    $endMessage = $this->replaceVariables($endMessage, $session['variables']);
                    $result = $this->bridge->sendMessage($instanceId, $phone, $endMessage);
                    if ($result['success']) {
                        $conversation->addMessage([
                            'message_id' => $result['messageId'] ?? null,
                            'direction' => 'outgoing',
                            'sender_type' => 'bot',
                            'message_type' => 'text',
                            'content' => $endMessage,
                            'status' => 'sent',
                        ]);
                        $response = $endMessage;
                    }
                }
                $stop = true;
                break;

            // =========================================================================
            // NUEVOS TIPOS DE NODOS
            // =========================================================================

            case 'ai_response':
                // Generar respuesta inteligente con IA
                $result = $this->processAIResponseNode($node, $session, $instanceId, $phone, $conversation);
                $response = $result['response'];
                $stop = $result['stop'];
                break;

            case 'media':
            case 'image':
            case 'document':
            case 'audio':
            case 'video':
                // Enviar contenido multimedia
                $result = $this->processMediaNode($node, $session, $instanceId, $phone, $conversation);
                $response = $result['response'];
                $stop = $result['stop'];
                break;

            case 'interactive':
            case 'buttons':
            case 'list':
                // Enviar mensaje interactivo (botones o lista)
                $result = $this->processInteractiveNode($node, $session, $instanceId, $phone, $conversation);
                $response = $result['response'];
                $stop = $result['stop'];
                break;

            case 'condition':
                // Nodo condicional - evaluar y decidir siguiente nodo
                $result = $this->processConditionNode($node, $session);
                if ($result['next_node_id']) {
                    $node->next_node_id = $result['next_node_id'];
                }
                break;

            case 'set_variable':
                // Establecer variable en la sesión
                $varName = $config['variable_name'] ?? $config['name'] ?? null;
                $varValue = $config['variable_value'] ?? $config['value'] ?? null;
                if ($varName) {
                    $session['variables'][$varName] = $this->replaceVariables($varValue ?? '', $session['variables']);
                }
                break;

            case 'add_tag':
                // Agregar etiqueta a la conversación
                $tagName = $config['tag_name'] ?? $config['tag'] ?? null;
                if ($tagName) {
                    $tagName = $this->replaceVariables($tagName, $session['variables']);
                    $tags = $conversation->tags ?? [];
                    if (!in_array($tagName, $tags)) {
                        $tags[] = $tagName;
                        $conversation->update(['tags' => $tags]);
                    }
                    // Auto-crear tag en el catálogo del broker
                    $tagColor = $config['tag_color'] ?? 'blue';
                    \App\Models\WhatsAppTag::firstOrCreate(
                        ['broker_id' => $conversation->broker_id, 'name' => $tagName],
                        ['color' => $tagColor]
                    );
                    Log::info('🏷️ [CHATBOT] Tag agregado', ['tag' => $tagName, 'conversation_id' => $conversation->id]);
                }
                break;

            case 'remove_tag':
                // Quitar etiqueta de la conversación
                $tagName = $config['tag_name'] ?? $config['tag'] ?? null;
                if ($tagName) {
                    $tagName = $this->replaceVariables($tagName, $session['variables']);
                    $tags = $conversation->tags ?? [];
                    $tags = array_values(array_filter($tags, fn($t) => $t !== $tagName));
                    $conversation->update(['tags' => $tags]);
                }
                break;

            case 'delay':
                // Esperar antes de continuar (en segundos)
                $seconds = min((int)($config['seconds'] ?? 1), 10); // Max 10 segundos
                sleep($seconds);
                break;

            case 'webhook':
                // Llamar webhook externo
                $result = $this->processWebhookNode($node, $session, $conversation);
                if (!empty($result['variables'])) {
                    $session['variables'] = array_merge($session['variables'], $result['variables']);
                }
                break;

            case 'policy_lookup':
                // Consulta de pólizas: pide documento + campo validación, muestra info y envía carátula
                $result = $this->processPolicyLookupNode($node, $session, $instanceId, $phone, $conversation);
                $response = $result['response'];
                $stop = $result['stop'];
                break;

            case 'consent':
                // Nodo de consentimiento de datos: solicita autorización al cliente
                $baseText = $config['message'] ?? "Para continuar necesitamos tu autorización para el tratamiento de tus datos personales según nuestra política de privacidad.";
                $acceptLabel = $config['accept_label'] ?? 'Sí, acepto';
                $rejectLabel = $config['reject_label'] ?? 'No, no acepto';
                $consentText = $this->replaceVariables($baseText, $session['variables'])
                    . "\n\n✅ 1. {$acceptLabel}\n❌ 2. {$rejectLabel}";
                $consentText = $this->replaceVariables($consentText, $session['variables']);
                $result = $this->bridge->sendMessage($instanceId, $phone, $consentText);
                if ($result['success']) {
                    $conversation->addMessage([
                        'message_id' => $result['messageId'] ?? null,
                        'direction' => 'outgoing',
                        'sender_type' => 'bot',
                        'message_type' => 'text',
                        'content' => $consentText,
                        'status' => 'sent',
                    ]);
                    $response = $consentText;

                    // Limpiar estado de opciones/input previas
                    $session['expected_options'] = null;
                    $session['waiting_for_input'] = false;
                    $session['options_node_id'] = null;

                    // Marcar que esperamos confirmación de consentimiento
                    $session['waiting_for_response'] = true;
                    $session['waiting_for_consent'] = true;
                    $session['consent_node_id'] = $node->id;
                    $session['consent_next_node_id'] = $node->next_node_id;
                    $session['consent_reject_node_id'] = $config['reject_node_id'] ?? null;
                    $session['consent_reject_message'] = $config['reject_message'] ?? null;
                }
                $stop = true;
                break;
        }

        return ['response' => $response, 'stop' => $stop];
    }

    /**
     * Procesar nodo de respuesta IA
     */
    protected function processAIResponseNode(ChatbotNode $node, array &$session, string $instanceId, string $phone, WhatsAppConversation $conversation): array
    {
        $config = $node->config ?? [];
        
        if (!$this->aiService->isConfigured()) {
            Log::warning('[CHATBOT] AI service not configured, skipping ai_response node');
            return ['response' => null, 'stop' => false];
        }

        // Obtener el último mensaje del usuario
        $userMessage = $session['last_user_message'] ?? '';
        
        // Construir historial de conversación para contexto
        $conversationHistory = [];
        if (!empty($session['conversation_history'])) {
            $conversationHistory = array_slice($session['conversation_history'], -10); // Últimos 10 mensajes
        }

        // Determinar system_prompt: nodo (ai_prompt o system_prompt) > chatbot.ai_system_prompt > default
        $systemPrompt = $config['ai_prompt'] ?? $config['system_prompt'] ?? null;
        if (!$systemPrompt) {
            $chatbot = Chatbot::find($session['chatbot_id'] ?? null);
            if ($chatbot && $chatbot->ai_system_prompt) {
                $systemPrompt = $chatbot->ai_system_prompt;
            }
        }
        // Reemplazar variables en el system prompt
        if ($systemPrompt) {
            $systemPrompt = $this->replaceVariables($systemPrompt, $session['variables']);
        }

        // Contexto adicional del nodo (ai_context en la UI)
        $aiContext = $config['ai_context'] ?? $config['custom_instructions'] ?? null;
        if ($aiContext) {
            $aiContext = $this->replaceVariables($aiContext, $session['variables']);
        }

        // Reglas de transferencia: inyectar en system_prompt para que la IA sepa cuándo/cómo transferir
        $transferRules = is_array($config['transfer_rules'] ?? null) ? $config['transfer_rules'] : [];
        if (!empty($transferRules)) {
            $rulesBlock = "\n\nREGLAS DE TRANSFERENCIA A ASESOR (IMPORTANTE):\n" .
                "Si detectas que el cliente necesita ser transferido a un asesor humano, incluye UNA de estas etiquetas AL FINAL de tu respuesta (el cliente NO verá la etiqueta):\n";
            foreach ($transferRules as $rule) {
                $id = trim((string) ($rule['id'] ?? ''));
                $desc = trim((string) ($rule['description'] ?? ''));
                if ($id === '' || $desc === '') continue;
                $rulesBlock .= "- [TRANSFER:{$id}] → {$desc}\n";
            }
            $rulesBlock .= "- [TRANSFER] → Para cualquier otro caso que requiera asesor humano (fallback genérico).\n";
            $rulesBlock .= "Usa SOLO UNA etiqueta por respuesta. No inventes etiquetas nuevas.";
            $systemPrompt = ($systemPrompt ?? '') . $rulesBlock;
        }

        // Opciones de configuración del nodo
        $options = [
            'system_prompt' => $systemPrompt,
            'conversation_history' => $conversationHistory,
            'model' => $config['model'] ?? null,
            'max_tokens' => $config['max_tokens'] ?? 300,
            'temperature' => $config['temperature'] ?? 0.7,
        ];

        // Contexto adicional
        $context = [
            'bot_name' => $session['variables']['bot_name'] ?? 'Asistente',
            'company_name' => $config['company_name'] ?? $session['variables']['company_name'] ?? null,
            'custom_instructions' => $aiContext,
        ];

        $result = $this->aiService->generateResponse($userMessage, $context, $options);

        if ($result['success'] && $result['response']) {
            $aiResponse = $result['response'];

            // Detectar etiquetas de transferencia específicas [TRANSFER:id] antes del genérico [TRANSFER]
            $matchedRule = null;
            $wantsTransfer = false;
            if (!empty($transferRules) && preg_match('/\[TRANSFER:([a-zA-Z0-9_\-]+)\]/', $aiResponse, $m)) {
                $ruleId = $m[1];
                foreach ($transferRules as $rule) {
                    if (($rule['id'] ?? null) === $ruleId) {
                        $matchedRule = $rule;
                        break;
                    }
                }
                $aiResponse = preg_replace('/\[TRANSFER:[a-zA-Z0-9_\-]+\]/', '', $aiResponse);
                $aiResponse = trim($aiResponse);
                $wantsTransfer = true;
            } elseif (str_contains($aiResponse, '[TRANSFER]')) {
                $aiResponse = str_replace('[TRANSFER]', '', $aiResponse);
                $aiResponse = trim($aiResponse);
                $wantsTransfer = true;
            }

            $aiResponse = $this->replaceVariables($aiResponse, $session['variables']);
            
            $sendResult = $this->bridge->sendMessage($instanceId, $phone, $aiResponse);
            
            if ($sendResult['success']) {
                $conversation->addMessage([
                    'message_id' => $sendResult['messageId'] ?? null,
                    'direction' => 'outgoing',
                    'sender_type' => 'bot',
                    'message_type' => 'text',
                    'content' => $aiResponse,
                    'status' => 'sent',
                    'metadata' => ['ai_generated' => true, 'model' => $result['model'] ?? null],
                ]);

                // Guardar en historial de sesión
                $session['conversation_history'][] = ['role' => 'assistant', 'content' => $aiResponse];

                // Si la IA pidió transferir, escalar a asesor
                if ($wantsTransfer) {
                    $targetUserId = null;
                    $customMessage = $config['transfer_default_message'] ?? null;
                    $reason = 'La IA determinó que el cliente necesita atención de un asesor humano';
                    if ($matchedRule) {
                        $targetUserId = isset($matchedRule['user_id']) ? (int) $matchedRule['user_id'] : null;
                        if (!empty($matchedRule['message'])) {
                            $customMessage = $matchedRule['message'];
                        }
                        $reason = 'Regla: ' . ($matchedRule['name'] ?? $matchedRule['id'] ?? 'transferencia');
                    }
                    return $this->escalateToAgent($session, $instanceId, $phone, $conversation, $reason, $targetUserId, $customMessage);
                }

                // Modo conversacional: el nodo se queda esperando la siguiente respuesta del usuario
                $isConversational = $config['conversational'] ?? $config['loop'] ?? false;
                if ($isConversational) {
                    $session['waiting_for_response'] = true;
                    $session['waiting_for_input'] = true;
                    $session['input_node_id'] = $node->id;
                    $session['input_variable_name'] = '_ai_user_message';
                    $session['input_validation'] = null;
                    $session['input_contact_field'] = null;
                    // Limpiar opciones para evitar conflictos
                    $session['expected_options'] = null;
                    $session['expected_buttons'] = null;
                    return ['response' => $aiResponse, 'stop' => true];
                }

                return ['response' => $aiResponse, 'stop' => false];
            }
        }

        Log::warning('[CHATBOT] AI response failed', ['error' => $result['error'] ?? 'Unknown']);
        return ['response' => null, 'stop' => false];
    }

    /**
     * Procesar nodo de multimedia
     */
    protected function processMediaNode(ChatbotNode $node, array &$session, string $instanceId, string $phone, WhatsAppConversation $conversation): array
    {
        $config = $node->config ?? [];
        $mediaType = $config['media_type'] ?? $node->node_type ?? 'image';
        $mediaUrl = $config['url'] ?? $config['media_url'] ?? null;
        $caption = $config['caption'] ?? null;
        
        if (!$mediaUrl) {
            Log::warning('[CHATBOT] Media node missing URL');
            return ['response' => null, 'stop' => false];
        }

        $mediaUrl = $this->replaceVariables($mediaUrl, $session['variables']);
        if ($caption) {
            $caption = $this->replaceVariables($caption, $session['variables']);
        }

        $result = ['success' => false];

        switch ($mediaType) {
            case 'image':
                $result = $this->bridge->sendImage($instanceId, $phone, $mediaUrl, $caption);
                break;
            case 'document':
                $filename = $config['filename'] ?? null;
                $result = $this->bridge->sendDocument($instanceId, $phone, $mediaUrl, $filename, $caption);
                break;
            case 'audio':
                $ptt = $config['ptt'] ?? false; // Push-to-talk (nota de voz)
                $result = $this->bridge->sendAudio($instanceId, $phone, $mediaUrl, $ptt);
                break;
            case 'video':
                $result = $this->bridge->sendVideo($instanceId, $phone, $mediaUrl, $caption);
                break;
        }

        if ($result['success']) {
            $conversation->addMessage([
                'message_id' => $result['messageId'] ?? null,
                'direction' => 'outgoing',
                'sender_type' => 'bot',
                'message_type' => $mediaType,
                'content' => $caption,
                'media' => ['url' => $mediaUrl, 'type' => $mediaType],
                'status' => 'sent',
            ]);

            return ['response' => "[{$mediaType}] {$caption}", 'stop' => false];
        }

        return ['response' => null, 'stop' => false];
    }

    /**
     * Procesar nodo interactivo (botones/lista)
     */
    protected function processInteractiveNode(ChatbotNode $node, array &$session, string $instanceId, string $phone, WhatsAppConversation $conversation): array
    {
        $config = $node->config ?? [];
        $interactiveType = $config['interactive_type'] ?? $node->node_type ?? 'buttons';

        $result = ['success' => false];

        if ($interactiveType === 'list') {
            $title = $config['title'] ?? 'Menú';
            $body = $config['body'] ?? $config['text'] ?? 'Selecciona una opción:';
            $buttonText = $config['button_text'] ?? 'Ver opciones';
            $sections = $config['sections'] ?? [];

            $result = $this->bridge->sendListMessage($instanceId, $phone, $title, $body, $buttonText, $sections);
            
            // Guardar opciones para procesar respuesta
            $session['waiting_for_response'] = true;
            $session['interactive_type'] = 'list';
            $session['expected_sections'] = $sections;
        } else {
            // Botones
            $body = $config['body'] ?? $config['text'] ?? 'Selecciona:';
            $buttons = $config['buttons'] ?? [];
            $header = $config['header'] ?? null;
            $footer = $config['footer'] ?? null;

            $result = $this->bridge->sendButtonMessage($instanceId, $phone, $body, $buttons, $header, $footer);
            
            $session['waiting_for_response'] = true;
            $session['interactive_type'] = 'buttons';
            $session['expected_buttons'] = $buttons;
        }

        if ($result['success']) {
            $conversation->addMessage([
                'message_id' => $result['messageId'] ?? null,
                'direction' => 'outgoing',
                'sender_type' => 'bot',
                'message_type' => 'interactive',
                'content' => $config['body'] ?? $config['text'] ?? '',
                'metadata' => ['interactive_type' => $interactiveType],
                'status' => 'sent',
            ]);

            return ['response' => "[interactive:{$interactiveType}]", 'stop' => true];
        }

        return ['response' => null, 'stop' => false];
    }

    /**
     * Procesar nodo condicional
     */
    protected function processConditionNode(ChatbotNode $node, array $session): array
    {
        $config = $node->config ?? [];
        $conditions = $config['conditions'] ?? [];
        $defaultNextNode = $config['default_next_node_id'] ?? $node->next_node_id;

        foreach ($conditions as $condition) {
            $variable = $condition['variable'] ?? null;
            $operator = $condition['operator'] ?? 'equals';
            $value = $condition['value'] ?? null;
            $nextNodeId = $condition['next_node_id'] ?? null;

            if (!$variable || !$nextNodeId) continue;

            $actualValue = $session['variables'][$variable] ?? null;

            $matches = false;
            switch ($operator) {
                case 'equals':
                case '==':
                    $matches = $actualValue == $value;
                    break;
                case 'not_equals':
                case '!=':
                    $matches = $actualValue != $value;
                    break;
                case 'contains':
                    $matches = str_contains(strtolower($actualValue ?? ''), strtolower($value ?? ''));
                    break;
                case 'greater_than':
                case '>':
                    $matches = (float)$actualValue > (float)$value;
                    break;
                case 'less_than':
                case '<':
                    $matches = (float)$actualValue < (float)$value;
                    break;
                case 'is_set':
                    $matches = !empty($actualValue);
                    break;
                case 'is_empty':
                    $matches = empty($actualValue);
                    break;
            }

            if ($matches) {
                return ['next_node_id' => $nextNodeId];
            }
        }

        return ['next_node_id' => $defaultNextNode];
    }

    /**
     * Procesar nodo de webhook
     */
    protected function processWebhookNode(ChatbotNode $node, array $session, WhatsAppConversation $conversation): array
    {
        $config = $node->config ?? [];
        $url = $config['url'] ?? null;
        $method = strtoupper($config['method'] ?? 'POST');
        $headers = $config['headers'] ?? [];
        $bodyTemplate = $config['body'] ?? [];

        if (!$url) {
            return ['variables' => []];
        }

        // Reemplazar variables en URL y body
        $url = $this->replaceVariables($url, $session['variables']);
        $body = [];
        foreach ($bodyTemplate as $key => $value) {
            $body[$key] = $this->replaceVariables($value, $session['variables']);
        }

        try {
            $http = \Illuminate\Support\Facades\Http::timeout(10)->withHeaders($headers);
            
            $response = $method === 'GET' 
                ? $http->get($url, $body)
                : $http->post($url, $body);

            if ($response->successful()) {
                $responseData = $response->json();
                
                // Extraer variables de la respuesta según configuración
                $extractVariables = $config['extract_variables'] ?? [];
                $extractedVars = [];
                
                foreach ($extractVariables as $varConfig) {
                    $varName = $varConfig['name'] ?? null;
                    $jsonPath = $varConfig['path'] ?? null;
                    
                    if ($varName && $jsonPath) {
                        $extractedVars[$varName] = data_get($responseData, $jsonPath);
                    }
                }

                return ['variables' => $extractedVars];
            }
        } catch (\Exception $e) {
            Log::warning('[CHATBOT] Webhook node failed', ['url' => $url, 'error' => $e->getMessage()]);
        }

        return ['variables' => []];
    }

    /**
     * Continuar flujo existente (cuando el usuario responde)
     */
    protected function continueFlow(array $session, string $message, string $instanceId, string $phone, WhatsAppConversation $conversation): array
    {
        // ── ESCAPE GLOBAL: detectar si el usuario pide ayuda/asesor en cualquier paso ──
        $chatbot = Chatbot::find($session['chatbot_id'] ?? null);
        if ($chatbot && ($chatbot->escape_enabled ?? true)) {
            $defaultKw = 'asesor,ayuda,agente,humano,hablar con alguien,no puedo,no se,no sé,operador';
            $keywords = array_map('trim', explode(',', strtolower($chatbot->escape_keywords ?: $defaultKw)));
            $msgLower = strtolower(trim($message));

            foreach ($keywords as $kw) {
                if (!empty($kw) && str_contains($msgLower, $kw)) {
                    $escapeMsg = $chatbot->escape_message
                        ?: '🙋 Entendido, te vamos a comunicar con un asesor que podrá ayudarte. Por favor espera un momento.';

                    $this->bridge->sendMessage($instanceId, $phone, $escapeMsg);
                    $conversation->addMessage([
                        'direction' => 'outgoing', 'sender_type' => 'bot',
                        'message_type' => 'text', 'content' => $escapeMsg, 'status' => 'sent',
                    ]);

                    $conversation->update(['status' => 'pending', 'assigned_at' => now()]);
                    $this->deleteSession($instanceId, $phone);

                    Log::info('🚪 [CHATBOT] Escape global activado', [
                        'phone' => $phone, 'keyword' => $kw, 'chatbot_id' => $chatbot->id,
                    ]);

                    return ['processed' => true, 'reason' => 'Escape to agent triggered'];
                }
            }
        }

        // Si estamos esperando confirmación de consentimiento de datos
        if (!empty($session['waiting_for_consent'])) {
            return $this->processConsentResponse($session, $message, $instanceId, $phone, $conversation);
        }

        // PRIMERO: Si hay opciones esperando respuesta, procesarlas (tiene prioridad sobre input)
        if (!empty($session['expected_options'])) {
            return $this->processOptionsResponse($session, $message, $instanceId, $phone, $conversation);
        }
        
        // Si estamos esperando entrada de datos del usuario (nodo input)
        if (!empty($session['waiting_for_input'])) {
            $inputNodeId = $session['input_node_id'] ?? null;
            
            // Si el nodo es ai_response conversacional, re-procesar con IA
            if ($inputNodeId) {
                $inputNode = ChatbotNode::find($inputNodeId);
                if ($inputNode && $inputNode->node_type === 'ai_response') {
                    $session['last_user_message'] = $message;
                    $session['waiting_for_response'] = false;
                    $session['waiting_for_input'] = false;
                    $result = $this->processAIResponseNode($inputNode, $session, $instanceId, $phone, $conversation);
                    $this->saveSession($session, $instanceId, $phone);
                    return ['processed' => true, 'reason' => 'AI conversational response'];
                }
            }

            // Si el nodo es policy_lookup, delegar al procesador de pólizas
            if ($inputNodeId) {
                $inputNode = ChatbotNode::find($inputNodeId);
                if ($inputNode && $inputNode->node_type === 'policy_lookup') {
                    $session['last_user_message'] = $message;
                    $result = $this->processPolicyLookupNode($inputNode, $session, $instanceId, $phone, $conversation);
                    $this->saveSession($session, $instanceId, $phone);
                    // Si stop=false, continuar al siguiente nodo del policy_lookup
                    if (!$result['stop'] && $inputNode->next_node_id) {
                        return $this->executeFlowFromNode($session, $inputNode->next_node_id, $instanceId, $phone, $conversation);
                    }
                    return ['processed' => true, 'reason' => 'Policy lookup step processed'];
                }
            }

            $variableName = $session['input_variable_name'] ?? 'user_input';
            $validationType = $session['input_validation'] ?? null;
            $contactField = $session['input_contact_field'] ?? null;
            
            // Validar entrada si es necesario
            $isValid = true;
            $errorMessage = null;
            
            if ($validationType) {
                switch ($validationType) {
                    case 'email':
                        $isValid = filter_var($message, FILTER_VALIDATE_EMAIL) !== false;
                        $errorMessage = 'Por favor, ingresa un correo electrónico válido.';
                        break;
                    case 'phone':
                        $isValid = preg_match('/^[\d\s\+\-\(\)]{7,20}$/', $message);
                        $errorMessage = 'Por favor, ingresa un número de teléfono válido.';
                        break;
                    case 'number':
                        $isValid = is_numeric($message);
                        $errorMessage = 'Por favor, ingresa un número válido.';
                        break;
                    case 'not_empty':
                        $isValid = !empty(trim($message));
                        $errorMessage = 'Por favor, escribe una respuesta.';
                        break;
                }
            }
            
            if (!$isValid && $errorMessage) {
                // Incrementar contador de intentos fallidos
                $inputAttempts = ($session['variables']['_input_invalid_attempts'] ?? 0) + 1;
                $session['variables']['_input_invalid_attempts'] = $inputAttempts;

                if ($inputAttempts >= 2) {
                    $this->saveSession($session, $instanceId, $phone);
                    return $this->escalateToAgent($session, $instanceId, $phone, $conversation,
                        'El cliente no pudo ingresar un dato válido (' . ($validationType ?? 'text') . ') después de ' . $inputAttempts . ' intentos');
                }

                $this->bridge->sendMessage($instanceId, $phone, $errorMessage);
                $conversation->addMessage([
                    'direction' => 'outgoing',
                    'sender_type' => 'bot',
                    'message_type' => 'text',
                    'content' => $errorMessage,
                    'status' => 'sent',
                ]);
                $this->saveSession($session, $instanceId, $phone);
                return ['processed' => true, 'reason' => 'Invalid input, waiting for valid response'];
            }
            
            // Resetear contador de intentos cuando la entrada es válida
            unset($session['variables']['_input_invalid_attempts']);
            
            Log::info("📝 [CHATBOT] Entrada de datos recibida", [
                'variable' => $variableName,
                'value' => substr($message, 0, 50),
                'contact_field' => $contactField
            ]);
            
            // Guardar el valor en variables
            $session['variables'][$variableName] = $message;
            
            // *** GUARDAR EN CAMPO DE CONTACTO DE LA CONVERSACIÓN ***
            if ($contactField && isset(WhatsAppConversation::CONTACT_FIELDS[$contactField])) {
                $fieldConfig = WhatsAppConversation::CONTACT_FIELDS[$contactField];
                $columnName = $fieldConfig['column'];
                
                $conversation->update([$columnName => $message]);
                
                Log::info("📇 [CHATBOT] Dato de contacto guardado", [
                    'field' => $contactField,
                    'column' => $columnName,
                    'value' => substr($message, 0, 50),
                    'conversation_id' => $conversation->id
                ]);
            }
            
            $session['waiting_for_response'] = false;
            $session['waiting_for_input'] = false;
            $session['input_variable_name'] = null;
            $session['input_validation'] = null;
            $session['input_contact_field'] = null;
            
            // Continuar al siguiente nodo
            if ($inputNodeId) {
                $inputNode = ChatbotNode::find($inputNodeId);
                Log::info("📍 [CHATBOT] Buscando siguiente nodo después de input", [
                    'input_node_id' => $inputNodeId,
                    'input_node_found' => $inputNode ? true : false,
                    'next_node_id' => $inputNode?->next_node_id
                ]);
                
                if ($inputNode && $inputNode->next_node_id) {
                    $this->saveSession($session, $instanceId, $phone);
                    Log::info("➡️ [CHATBOT] Continuando al siguiente nodo", [
                        'next_node_id' => $inputNode->next_node_id
                    ]);
                    return $this->executeFlowFromNode($session, $inputNode->next_node_id, $instanceId, $phone, $conversation);
                } else {
                    Log::warning("⚠️ [CHATBOT] Nodo input sin siguiente nodo configurado", [
                        'input_node_id' => $inputNodeId,
                        'node_type' => $inputNode?->node_type
                    ]);
                }
            }
            
            $this->deleteSession($instanceId, $phone);
            return ['processed' => true, 'reason' => 'Flow completed after input - no next node'];
        }

        // Si estamos esperando una respuesta a opciones (fallback - normalmente se procesa arriba)
        if (!empty($session['expected_options'])) {
            return $this->processOptionsResponse($session, $message, $instanceId, $phone, $conversation);
        }
        
        // Código legacy - ya no debería llegar aquí
        if (false && !empty($session['waiting_for_response']) && !empty($session['expected_options'])) {
            $options = $session['expected_options'];
            $selectedOption = null;
            $messageLower = strtolower(trim($message));
            
            // Buscar la opción seleccionada por número o texto
            foreach ($options as $i => $opt) {
                $optionNumber = (string)($i + 1);
                $optionText = strtolower($opt['text'] ?? $opt['label'] ?? '');
                
                if ($message === $optionNumber || $messageLower === $optionText) {
                    $selectedOption = $opt;
                    break;
                }
            }
            
            if ($selectedOption) {
                Log::info("🎯 [CHATBOT] Opción seleccionada", [
                    'option' => $selectedOption['text'] ?? 'unknown',
                    'next_node_id' => $selectedOption['next_node_id'] ?? null,
                    'transfer_to' => $selectedOption['transfer_to'] ?? null
                ]);
                
                // Guardar la selección en variables
                $session['variables']['selected_option'] = $selectedOption['text'] ?? '';
                $session['waiting_for_response'] = false;
                $session['expected_options'] = null;
                $session['options_error_message'] = null;
                
                // *** MENSAJE POST-SELECCIÓN ***
                // Si la opción tiene un mensaje de confirmación, enviarlo
                $confirmationMessage = $selectedOption['confirmation_message'] ?? $selectedOption['response_message'] ?? null;
                if ($confirmationMessage) {
                    $confirmationMessage = $this->replaceVariables($confirmationMessage, $session['variables']);
                    $this->bridge->sendMessage($instanceId, $phone, $confirmationMessage);
                    $conversation->addMessage([
                        'direction' => 'outgoing',
                        'sender_type' => 'bot',
                        'message_type' => 'text',
                        'content' => $confirmationMessage,
                        'status' => 'sent',
                    ]);
                }
                
                // *** TRANSFERENCIA AUTOMÁTICA ***
                // Si la opción tiene transfer_to (department_id o user_id), transferir
                if (!empty($selectedOption['transfer_to'])) {
                    $transferConfig = $selectedOption['transfer_to'];
                    $transferMessage = $selectedOption['transfer_message'] ?? 'Te estamos transfiriendo con un asesor...';
                    
                    // Enviar mensaje de transferencia
                    $this->bridge->sendMessage($instanceId, $phone, $transferMessage);
                    $conversation->addMessage([
                        'direction' => 'outgoing',
                        'sender_type' => 'bot',
                        'message_type' => 'text',
                        'content' => $transferMessage,
                        'status' => 'sent',
                    ]);
                    
                    // Transferir a departamento
                    if (!empty($transferConfig['department_id'])) {
                        $department = WhatsAppDepartment::find($transferConfig['department_id']);
                        if ($department) {
                            $conversation->classifyAndAssign($department, 'Transferido por chatbot - opción: ' . ($selectedOption['text'] ?? ''));
                        }
                    }
                    
                    // Transferir a usuario específico
                    if (!empty($transferConfig['user_id'])) {
                        $conversation->update([
                            'assigned_to' => $transferConfig['user_id'],
                            'status' => 'assigned',
                            'assigned_at' => now(),
                        ]);
                    }
                    
                    // Limpiar sesión después de transferir
                    $this->deleteSession($instanceId, $phone);
                    return ['processed' => true, 'reason' => 'Transferred to agent from option'];
                }
                
                // Si la opción tiene un next_node_id, ir a ese nodo
                if (!empty($selectedOption['next_node_id'])) {
                    $session['current_node_id'] = $selectedOption['next_node_id'];
                    $this->saveSession($session, $instanceId, $phone);
                    return $this->executeFlowFromNode($session, $selectedOption['next_node_id'], $instanceId, $phone, $conversation);
                }
                
                // Si no hay next_node_id en la opción, usar el next_node_id del nodo options
                $optionsNodeId = $session['options_node_id'] ?? $session['current_node_id'] ?? null;
                if ($optionsNodeId) {
                    $currentNode = ChatbotNode::find($optionsNodeId);
                    if ($currentNode && $currentNode->next_node_id) {
                        $this->saveSession($session, $instanceId, $phone);
                        return $this->executeFlowFromNode($session, $currentNode->next_node_id, $instanceId, $phone, $conversation);
                    }
                }
                
                // Limpiar sesión si no hay más nodos
                $this->deleteSession($instanceId, $phone);
                return ['processed' => true, 'reason' => 'Flow completed after option selection'];
            }
            
            // Opción no válida - usar mensaje de error personalizado o default
            $customErrorMessage = $session['options_error_message'] ?? null;
            
            if ($customErrorMessage) {
                // Mensaje de error personalizado
                $errorText = $this->replaceVariables($customErrorMessage, $session['variables']);
            } else {
                // Mensaje de error por defecto con las opciones
                $errorText = "Por favor, selecciona una opción válida:\n\n";
                foreach ($options as $i => $opt) {
                    $errorText .= ($i + 1) . ". " . ($opt['text'] ?? $opt['label'] ?? "Opción " . ($i + 1)) . "\n";
                }
            }
            
            $this->bridge->sendMessage($instanceId, $phone, $errorText);
            $conversation->addMessage([
                'direction' => 'outgoing',
                'sender_type' => 'bot',
                'message_type' => 'text',
                'content' => $errorText,
                'status' => 'sent',
            ]);
            
            return ['processed' => true, 'reason' => 'Invalid option, resent options'];
        }
        
        // Si no estamos esperando respuesta, buscar un nuevo trigger
        $chatbot = Chatbot::find($session['chatbot_id']);
        if (!$chatbot) {
            return ['processed' => false, 'reason' => 'Chatbot not found'];
        }

        $matchedTrigger = $this->findMatchingTrigger($chatbot, $message, $phone, $instanceId);
        
        if ($matchedTrigger) {
            $session['flow_id'] = $matchedTrigger->flow_id;
            $session['current_step'] = 0;
            
            $this->saveSession($session, $instanceId, $phone);
            
            return $this->executeFlow($session, $instanceId, $phone, $conversation, $message);
        }

        return ['processed' => false, 'reason' => 'No matching trigger for response'];
    }
    
    /**
     * Ejecutar flujo desde un nodo específico
     */
    /**
     * Procesar respuesta al nodo de consentimiento de datos
     */
    protected function processConsentResponse(array &$session, string $message, string $instanceId, string $phone, WhatsAppConversation $conversation): array
    {
        $msgLower = strtolower(trim($message));
        $acceptTerms = ['1', 'si', 'sí', 'yes', 'acepto', 'ok', 'okay', 'claro', 'dale', 'de acuerdo', 'conforme'];
        $rejectTerms = ['2', 'no', 'nop', 'nope', 'rechazar', 'no acepto', 'no autorizo'];

        $accepted = in_array($msgLower, $acceptTerms);
        $rejected = in_array($msgLower, $rejectTerms);

        if ($accepted) {
            $conversation->update(['data_consent_at' => now()]);

            $session['waiting_for_consent'] = false;
            $session['waiting_for_response'] = false;
            $session['variables']['_data_consent'] = 'accepted';

            Log::info('✅ [CHATBOT] Consentimiento aceptado', ['phone' => $phone, 'conversation_id' => $conversation->id]);

            $nextNodeId = $session['consent_next_node_id'] ?? null;
            if ($nextNodeId) {
                // El nodo siguiente (ej: menú) actúa como confirmación — no enviar mensaje extra
                return $this->executeFlowFromNode($session, $nextNodeId, $instanceId, $phone, $conversation);
            }

            // Sin nodo siguiente: enviar confirmación genérica y terminar
            $confirmMsg = '✅ ¡Gracias! Tu autorización ha sido registrada.';
            $result = $this->bridge->sendMessage($instanceId, $phone, $confirmMsg);
            if ($result['success']) {
                $conversation->addMessage([
                    'message_id' => $result['messageId'] ?? null,
                    'direction' => 'outgoing',
                    'sender_type' => 'bot',
                    'message_type' => 'text',
                    'content' => $confirmMsg,
                    'status' => 'sent',
                ]);
            }
            $this->deleteSession($instanceId, $phone);
            return ['processed' => true, 'reason' => 'Consent accepted, flow complete'];
        }

        if ($rejected) {
            $session['waiting_for_consent'] = false;
            $session['variables']['_data_consent'] = 'rejected';

            Log::info('❌ [CHATBOT] Consentimiento rechazado', ['phone' => $phone, 'conversation_id' => $conversation->id]);

            // Resetear conversación a pending para que el bot pueda reiniciarse si el cliente escribe de nuevo
            $conversation->update([
                'status' => 'pending',
                'assigned_to' => null,
                'assigned_at' => null,
            ]);

            $rejectNodeId = $session['consent_reject_node_id'] ?? null;
            if ($rejectNodeId) {
                // El nodo de rechazo (ej: despedida) envía el mensaje — no duplicar aquí
                $session['waiting_for_response'] = false;
                return $this->executeFlowFromNode($session, (int) $rejectNodeId, $instanceId, $phone, $conversation);
            }

            // Sin nodo de rechazo configurado: enviar mensaje genérico y terminar
            $rejectMsg = $session['consent_reject_message']
                ?? '❌ Entendido. Sin tu autorización no podemos continuar. Si cambias de opinión, escríbenos nuevamente.';
            $result = $this->bridge->sendMessage($instanceId, $phone, $rejectMsg);
            if ($result['success']) {
                $conversation->addMessage([
                    'message_id' => $result['messageId'] ?? null,
                    'direction' => 'outgoing',
                    'sender_type' => 'bot',
                    'message_type' => 'text',
                    'content' => $rejectMsg,
                    'status' => 'sent',
                ]);
            }
            $this->deleteSession($instanceId, $phone);
            return ['processed' => true, 'reason' => 'Consent rejected, flow ended'];
        }

        // Respuesta no reconocida — volver a pedir
        $retryMsg = 'Por favor responde *1* para aceptar o *2* para no aceptar.';
        $result = $this->bridge->sendMessage($instanceId, $phone, $retryMsg);
        if ($result['success']) {
            $conversation->addMessage([
                'message_id' => $result['messageId'] ?? null,
                'direction' => 'outgoing',
                'sender_type' => 'bot',
                'message_type' => 'text',
                'content' => $retryMsg,
                'status' => 'sent',
            ]);
        }
        $this->saveSession($session, $instanceId, $phone);
        return ['processed' => true, 'reason' => 'Consent response not recognized, waiting'];
    }

    protected function executeFlowFromNode(array $session, int $nodeId, string $instanceId, string $phone, WhatsAppConversation $conversation): array
    {
        $flow = ChatbotFlow::find($session['flow_id']);
        if (!$flow) {
            return ['processed' => false, 'reason' => 'Flow not found'];
        }
        
        $nodes = ChatbotNode::where('flow_id', $flow->id)->get();
        $nodeMap = $nodes->keyBy('id');
        
        // Cross-flow navigation: if the target node is in a different flow, switch to it
        if (!isset($nodeMap[$nodeId])) {
            $targetNode = ChatbotNode::find($nodeId);
            if (!$targetNode) {
                return ['processed' => false, 'reason' => 'Node not found'];
            }
            // Verify the target flow belongs to the same chatbot
            $targetFlow = ChatbotFlow::find($targetNode->flow_id);
            if (!$targetFlow || $targetFlow->chatbot_id !== $flow->chatbot_id) {
                return ['processed' => false, 'reason' => 'Cross-flow node not in same chatbot'];
            }
            Log::info("🔀 [CHATBOT] Cross-flow navigation", [
                'from_flow' => $flow->id,
                'to_flow' => $targetFlow->id,
                'to_flow_name' => $targetFlow->name,
                'target_node' => $nodeId,
            ]);
            $flow = $targetFlow;
            $session['flow_id'] = $flow->id;
            $nodes = ChatbotNode::where('flow_id', $flow->id)->get();
            $nodeMap = $nodes->keyBy('id');
            if (!isset($nodeMap[$nodeId])) {
                return ['processed' => false, 'reason' => 'Node not found in target flow'];
            }
        }
        
        $currentNode = $nodeMap[$nodeId];
        $responses = [];
        $maxSteps = 10;
        $step = 0;
        $sessionKey = "chatbot_session_{$instanceId}_{$phone}";
        
        $stopped = false;
        while ($currentNode && $step < $maxSteps) {
            $step++;
            
            // Guardar el nodo actual en la sesión
            $session['current_node_id'] = $currentNode->id;
            
            $result = $this->processNode($currentNode, $session, $instanceId, $phone, $conversation);
            
            if ($result['response']) {
                $responses[] = $result['response'];
            }
            
            if ($result['stop']) {
                // Guardar sesión si estamos esperando respuesta
                $stopped = true;
                $this->saveSession($session, $instanceId, $phone);
                break;
            }
            
            // Ir al siguiente nodo (con soporte cross-flow)
            if ($currentNode->next_node_id) {
                if (isset($nodeMap[$currentNode->next_node_id])) {
                    $currentNode = $nodeMap[$currentNode->next_node_id];
                } else {
                    $crossNode = ChatbotNode::find($currentNode->next_node_id);
                    if ($crossNode) {
                        $crossFlow = ChatbotFlow::find($crossNode->flow_id);
                        if ($crossFlow && $crossFlow->chatbot_id == $session['chatbot_id']) {
                            $session['flow_id'] = $crossFlow->id;
                            $nodes = ChatbotNode::where('flow_id', $crossFlow->id)->get();
                            $nodeMap = $nodes->keyBy('id');
                            $currentNode = $nodeMap[$crossNode->id] ?? null;
                        } else {
                            $currentNode = null;
                        }
                    } else {
                        $currentNode = null;
                    }
                }
            } else {
                $currentNode = null;
            }
        }
        
        // If the flow ended naturally (no stop = not waiting for response),
        // delete the session so the user isn't stuck.
        if (!$stopped) {
            $this->deleteSession($instanceId, $phone);
        }
        
        return [
            'processed' => true,
            'responses' => $responses,
            'session' => $session,
        ];
    }

    /**
     * Reemplazar variables en texto
     */
    protected function replaceVariables(string $text, array $variables): string
    {
        foreach ($variables as $key => $value) {
            // Solo reemplazar si el valor es string o número
            if (is_string($value) || is_numeric($value)) {
                $text = str_replace("{{$key}}", (string)$value, $text);
                $text = str_replace("{{ $key }}", (string)$value, $text);
            }
        }
        // Convertir \n literales a saltos de línea reales
        $text = str_replace('\\n', "\n", $text);
        return $text;
    }
    
    /**
     * Procesar respuesta a opciones
     */
    protected function processOptionsResponse(array $session, string $message, string $instanceId, string $phone, WhatsAppConversation $conversation): array
    {
        $options = $session['expected_options'];
        $selectedOption = null;
        $messageLower = strtolower(trim($message));
        
        Log::info("🎯 [CHATBOT] Procesando respuesta a opciones", [
            'message' => $message,
            'options_count' => count($options)
        ]);
        
        // Normalize message: strip emoji numbers (1️⃣→1), trim whitespace
        $normalizedMsg = trim($message);
        // Strip keycap emoji variants: "1️⃣" → "1", "🔟" → "10"
        $emojiMap = ['1️⃣'=>'1','2️⃣'=>'2','3️⃣'=>'3','4️⃣'=>'4','5️⃣'=>'5','6️⃣'=>'6','7️⃣'=>'7','8️⃣'=>'8','9️⃣'=>'9','🔟'=>'10'];
        foreach ($emojiMap as $emoji => $num) {
            if (mb_strpos($normalizedMsg, $emoji) !== false) {
                $normalizedMsg = trim(str_replace($emoji, $num, $normalizedMsg));
            }
        }
        // Also strip standalone Unicode variation selectors / combining enclosing keycap
        $normalizedMsg = preg_replace('/[\x{FE0F}\x{20E3}]/u', '', $normalizedMsg);
        $normalizedMsg = trim($normalizedMsg);
        $normalizedLower = strtolower($normalizedMsg);
        
        // Buscar la opción seleccionada por número, texto exacto, o texto parcial
        foreach ($options as $i => $opt) {
            $optionNumber = (string)($i + 1);
            $optionText = strtolower(trim($opt['text'] ?? $opt['label'] ?? ''));
            
            // Match by number ("3") or exact text ("volver")
            if ($normalizedMsg === $optionNumber || $normalizedLower === $optionText) {
                $selectedOption = $opt;
                break;
            }
        }
        
        // Fallback: partial/fuzzy text match (e.g., "volver" matches "Volver al menú")
        if (!$selectedOption) {
            foreach ($options as $i => $opt) {
                $optionText = strtolower(trim($opt['text'] ?? $opt['label'] ?? ''));
                if (!empty($normalizedLower) && strlen($normalizedLower) >= 3) {
                    if (str_contains($optionText, $normalizedLower) || str_contains($normalizedLower, $optionText)) {
                        $selectedOption = $opt;
                        break;
                    }
                }
            }
        }
        
        if ($selectedOption) {
            Log::info("✅ [CHATBOT] Opción seleccionada", [
                'option' => $selectedOption['text'] ?? 'unknown',
                'transfer_to' => $selectedOption['transfer_to'] ?? null
            ]);
            
            // Limpiar estado de opciones e input
            $session['variables']['selected_option'] = $selectedOption['text'] ?? '';
            unset($session['variables']['_invalid_attempts']);
            $session['waiting_for_response'] = false;
            $session['waiting_for_input'] = false;
            $session['expected_options'] = null;
            $session['options_error_message'] = null;
            
            // Mensaje de confirmación
            $confirmationMessage = $selectedOption['confirmation_message'] ?? $selectedOption['transfer_message'] ?? null;
            if ($confirmationMessage) {
                $confirmationMessage = $this->replaceVariables($confirmationMessage, $session['variables']);
                $this->bridge->sendMessage($instanceId, $phone, $confirmationMessage);
                $conversation->addMessage([
                    'direction' => 'outgoing',
                    'sender_type' => 'bot',
                    'message_type' => 'text',
                    'content' => $confirmationMessage,
                    'status' => 'sent',
                ]);
            }
            
            // TRANSFERENCIA AUTOMÁTICA
            if (!empty($selectedOption['transfer_to'])) {
                $transferConfig = $selectedOption['transfer_to'];
                
                // Transferir a departamento
                if (!empty($transferConfig['department_id'])) {
                    $department = WhatsAppDepartment::find($transferConfig['department_id']);
                    if ($department) {
                        $conversation->classifyAndAssign($department, 'Transferido por chatbot - opción: ' . ($selectedOption['text'] ?? ''));
                    }
                }
                
                // Transferir a usuario específico
                if (!empty($transferConfig['user_id'])) {
                    $agent = \App\Models\User::find($transferConfig['user_id']);
                    $conversation->update([
                        'assigned_to' => $transferConfig['user_id'],
                        'status' => 'assigned',
                        'assigned_at' => now(),
                    ]);
                    Log::info("👤 [CHATBOT] Transferido a usuario", ['user_id' => $transferConfig['user_id']]);
                    
                    // Emitir evento de asignación via Socket.IO
                    $this->bridge->emitSocketEvent('conversation_assigned', [
                        'conversationId' => $conversation->id,
                        'assignedTo' => $transferConfig['user_id'],
                        'assignedToName' => $agent?->name ?? 'Agente',
                        'assignedBy' => 0,
                        'assignedByName' => 'Chatbot',
                        'phone' => $phone,
                        'contactName' => $conversation->contact_push_name ?? $conversation->contact_name ?? $phone,
                        'fromChatbot' => true,
                    ]);
                }
                
                // Limpiar sesión después de transferir
                $this->deleteSession($instanceId, $phone);
                return ['processed' => true, 'reason' => 'Transferred to agent from option'];
            }
            
            // Si la opción tiene un next_node_id, ir a ese nodo
            if (!empty($selectedOption['next_node_id'])) {
                $this->saveSession($session, $instanceId, $phone);
                return $this->executeFlowFromNode($session, $selectedOption['next_node_id'], $instanceId, $phone, $conversation);
            }
            
            // Si no hay next_node_id, usar el del nodo options
            $optionsNodeId = $session['options_node_id'] ?? null;
            if ($optionsNodeId) {
                $currentNode = ChatbotNode::find($optionsNodeId);
                if ($currentNode && $currentNode->next_node_id) {
                    $this->saveSession($session, $instanceId, $phone);
                    return $this->executeFlowFromNode($session, $currentNode->next_node_id, $instanceId, $phone, $conversation);
                }
            }
            
            // Limpiar sesión si no hay más nodos
            $this->deleteSession($instanceId, $phone);
            return ['processed' => true, 'reason' => 'Flow completed after option selection'];
        }
        
        // Opción no válida - incrementar contador de intentos fallidos
        $invalidAttempts = ($session['variables']['_invalid_attempts'] ?? 0) + 1;
        $session['variables']['_invalid_attempts'] = $invalidAttempts;
        $maxAttempts = 2;

        Log::info("⚠️ [CHATBOT] Respuesta inválida a opciones", [
            'message' => $message,
            'attempt' => $invalidAttempts,
            'max' => $maxAttempts,
        ]);

        // Si superó el máximo de intentos, transferir a asesor
        if ($invalidAttempts >= $maxAttempts) {
            return $this->escalateToAgent($session, $instanceId, $phone, $conversation,
                'El cliente no pudo seleccionar una opción válida después de ' . $invalidAttempts . ' intentos');
        }

        $errorText = "Por favor, selecciona una opción válida:\n\n";
        foreach ($options as $i => $opt) {
            $errorText .= ($i + 1) . ". " . ($opt['text'] ?? $opt['label'] ?? "Opción " . ($i + 1)) . "\n";
        }
        
        $this->bridge->sendMessage($instanceId, $phone, $errorText);
        $conversation->addMessage([
            'direction' => 'outgoing',
            'sender_type' => 'bot',
            'message_type' => 'text',
            'content' => $errorText,
            'status' => 'sent',
        ]);

        $this->saveSession($session, $instanceId, $phone);
        return ['processed' => true, 'reason' => 'Invalid option, resent options'];
    }

    // =========================================================================
    // ESCALAMIENTO AUTOMÁTICO A ASESOR
    // =========================================================================

    /**
     * Escalar conversación a un asesor humano cuando el cliente se enreda.
     * Se activa tras N respuestas inválidas consecutivas.
     */
    protected function escalateToAgent(array $session, string $instanceId, string $phone, WhatsAppConversation $conversation, string $reason, ?int $targetUserId = null, ?string $customMessage = null): array
    {
        Log::info("🚨 [CHATBOT] Escalando a asesor", [
            'phone' => $phone,
            'reason' => $reason,
            'conversation_id' => $conversation->id,
            'target_user_id' => $targetUserId,
        ]);

        // Mensaje al cliente (custom o default)
        $escalationMsg = $customMessage ?: "Un momento, te voy a comunicar con un asesor para ayudarte mejor. 🙂";
        $escalationMsg = $this->replaceVariables($escalationMsg, $session['variables'] ?? []);
        $this->bridge->sendMessage($instanceId, $phone, $escalationMsg);
        $conversation->addMessage([
            'direction' => 'outgoing',
            'sender_type' => 'bot',
            'message_type' => 'text',
            'content' => $escalationMsg,
            'status' => 'sent',
        ]);

        // Asignar a un agente: prioridad 1) targetUserId explícito 2) departamento 3) primer admin del broker
        $assignedUserId = null;
        $assignedUserName = null;

        // 0. Si se especificó un usuario objetivo (desde regla), usarlo directamente
        if ($targetUserId) {
            $agent = \App\Models\User::find($targetUserId);
            if ($agent) {
                $assignedUserId = $agent->id;
                $assignedUserName = $agent->name;
            }
        }

        // 1. Si no hay objetivo explícito y la conversación tiene departamento, buscar un agente del departamento
        if (!$assignedUserId && $conversation->department_id) {
            $dept = WhatsAppDepartment::find($conversation->department_id);
            if ($dept) {
                $conversation->classifyAndAssign($dept, 'Escalado por chatbot: ' . $reason);
                $conversation->refresh();
                $assignedUserId = $conversation->assigned_to;
                if ($assignedUserId) {
                    $agent = \App\Models\User::find($assignedUserId);
                    $assignedUserName = $agent?->name ?? 'Agente';
                }
            }
        }

        // 2. Si no se asignó por departamento, asignar al primer agente/admin del broker
        if (!$assignedUserId) {
            $brokerUser = DB::table('users')
                ->join('brokers', 'brokers.user_id', '=', 'users.id')
                ->where('brokers.id', $conversation->broker_id)
                ->select('users.id', 'users.name')
                ->first();

            if ($brokerUser) {
                $assignedUserId = $brokerUser->id;
                $assignedUserName = $brokerUser->name;
            }
        }

        // Actualizar conversación
        $updateData = [
            'status' => $assignedUserId ? 'assigned' : 'pending',
            'assigned_at' => now(),
        ];
        if ($assignedUserId) {
            $updateData['assigned_to'] = $assignedUserId;
        }
        $conversation->update($updateData);

        // Agregar nota interna sobre el escalamiento
        $conversation->addMessage([
            'direction' => 'incoming',
            'sender_type' => 'bot',
            'message_type' => 'text',
            'content' => "[Sistema] Conversación escalada automáticamente. Razón: {$reason}",
            'metadata' => ['system_note' => true, 'escalation_reason' => $reason],
            'status' => 'delivered',
        ]);

        // Emitir evento de asignación via Socket.IO para notificación en pantalla
        if ($assignedUserId) {
            $this->bridge->emitSocketEvent('conversation_assigned', [
                'conversationId' => $conversation->id,
                'assignedTo' => $assignedUserId,
                'assignedToName' => $assignedUserName ?? 'Agente',
                'assignedBy' => 0,
                'assignedByName' => 'Chatbot (auto-escalamiento)',
                'phone' => $phone,
                'contactName' => $conversation->contact_push_name ?? $conversation->contact_name ?? $phone,
                'fromChatbot' => true,
                'escalation' => true,
                'escalationReason' => $reason,
            ]);
        }

        // Limpiar sesión de chatbot
        $this->deleteSession($instanceId, $phone);

        return ['processed' => true, 'reason' => 'Escalated to agent: ' . $reason];
    }

    // =========================================================================
    // NODO: CONSULTA DE PÓLIZAS (policy_lookup)
    // =========================================================================

    /**
     * Procesar nodo de consulta de pólizas.
     * 
     * Multi-step stateful:
     *   step=null  → enviar prompt pidiendo documento
     *   step=1     → recibir documento, pedir campo de validación
     *   step=2     → recibir validación, buscar pólizas, mostrar listado
     *   step=3     → recibir selección de póliza, enviar carátula
     *
     * Config del nodo:
     *   ask_document_message  → Mensaje para pedir documento
     *   validation_field      → Campo de validación: email, phone, birth_date, policy_number
     *   ask_validation_message→ Mensaje para pedir el campo de validación
     *   no_results_message    → Mensaje cuando no hay pólizas
     *   validation_error_message → Mensaje cuando la validación falla
     *   success_message       → Mensaje introductorio cuando se encuentran pólizas
     *   send_documents        → bool: si enviar archivos/carátulas
     */
    protected function processPolicyLookupNode(
        ChatbotNode $node,
        array &$session,
        string $instanceId,
        string $phone,
        WhatsAppConversation $conversation
    ): array {
        $config = $node->config ?? [];
        $step = $session['variables']['_policy_lookup_step'] ?? null;
        $userMessage = trim($session['last_user_message'] ?? '');

        // ── STEP 0: Primera vez → pedir documento ──
        if ($step === null) {
            $msg = $config['ask_document_message']
                ?? '📋 Para consultar tus pólizas, por favor escribe tu número de documento (cédula):';
            $msg = $this->replaceVariables($msg, $session['variables']);

            $this->bridge->sendMessage($instanceId, $phone, $msg);
            $conversation->addMessage([
                'direction' => 'outgoing', 'sender_type' => 'bot',
                'message_type' => 'text', 'content' => $msg, 'status' => 'sent',
            ]);

            $session['variables']['_policy_lookup_step'] = 1;
            $session['variables']['_policy_lookup_node_id'] = $node->id;
            $session['waiting_for_response'] = true;
            $session['waiting_for_input'] = true;
            $session['input_node_id'] = $node->id;
            // Limpiar campos de opciones para evitar conflictos
            $session['expected_options'] = null;
            $session['expected_buttons'] = null;

            return ['response' => $msg, 'stop' => true];
        }

        // ── STEP 1: Recibir documento → pedir campo de validación ──
        if ($step == 1) {
            $document = preg_replace('/[^0-9]/', '', $userMessage);
            if (strlen($document) < 4) {
                $errorMsg = 'Por favor escribe un número de documento válido:';
                $this->bridge->sendMessage($instanceId, $phone, $errorMsg);
                $conversation->addMessage([
                    'direction' => 'outgoing', 'sender_type' => 'bot',
                    'message_type' => 'text', 'content' => $errorMsg, 'status' => 'sent',
                ]);
                return ['response' => $errorMsg, 'stop' => true];
            }

            $session['variables']['_policy_lookup_document'] = $document;

            $validationField = $config['validation_field'] ?? 'email';
            $validationLabels = [
                'email' => 'correo electrónico',
                'phone' => 'número de teléfono',
                'birth_date' => 'fecha de nacimiento (DD/MM/AAAA)',
                'policy_number' => 'número de póliza',
            ];
            $fieldLabel = $validationLabels[$validationField] ?? $validationField;

            $msg = $config['ask_validation_message']
                ?? "🔐 Para verificar tu identidad, por favor escribe tu {$fieldLabel}:";
            $msg = str_replace('{field_label}', $fieldLabel, $msg);
            $msg = $this->replaceVariables($msg, $session['variables']);

            $this->bridge->sendMessage($instanceId, $phone, $msg);
            $conversation->addMessage([
                'direction' => 'outgoing', 'sender_type' => 'bot',
                'message_type' => 'text', 'content' => $msg, 'status' => 'sent',
            ]);

            $session['variables']['_policy_lookup_step'] = 2;
            $session['waiting_for_response'] = true;
            $session['waiting_for_input'] = true;
            $session['input_node_id'] = $node->id;

            return ['response' => $msg, 'stop' => true];
        }

        // ── STEP 2: Recibir validación → buscar pólizas ──
        if ($step == 2) {
            $document = $session['variables']['_policy_lookup_document'] ?? '';
            $validationField = $config['validation_field'] ?? 'email';
            $validationValue = trim($userMessage);

            // Obtener broker_id desde la instancia
            $instance = WhatsAppInstance::where('instance_id', $instanceId)->first();
            if (!$instance) {
                return ['response' => null, 'stop' => true];
            }
            $brokerId = $instance->broker_id;

            // Buscar pólizas por documento del cliente
            $polizas = \App\Models\Poliza::where('broker_id', $brokerId)
                ->where('client_document', $document)
                ->whereIn('status', ['active', 'vigente', 'Vigente', 'VIGENTE'])
                ->with(['client:id,first_name,last_name,document_number,email,phone,mobile_phone,birth_date'])
                ->get();

            if ($polizas->isEmpty()) {
                $msg = $config['no_results_message']
                    ?? '❌ No encontramos pólizas activas asociadas a ese documento. Verifica e intenta de nuevo o comunícate con tu asesor.';
                $this->bridge->sendMessage($instanceId, $phone, $msg);
                $conversation->addMessage([
                    'direction' => 'outgoing', 'sender_type' => 'bot',
                    'message_type' => 'text', 'content' => $msg, 'status' => 'sent',
                ]);
                // Limpiar estado y continuar flujo
                $this->cleanupPolicyLookupState($session);
                return ['response' => $msg, 'stop' => false];
            }

            // Validar campo de verificación
            $validated = false;
            $client = $polizas->first()->client;

            switch ($validationField) {
                case 'email':
                    $validated = $client && strtolower(trim($client->email ?? '')) === strtolower($validationValue);
                    break;
                case 'phone':
                    $cleanPhone = preg_replace('/[^0-9]/', '', $validationValue);
                    $clientPhone = preg_replace('/[^0-9]/', '', $client->phone ?? $client->mobile_phone ?? '');
                    $validated = $client && strlen($cleanPhone) >= 7 && str_contains($clientPhone, $cleanPhone);
                    break;
                case 'birth_date':
                    // Aceptar DD/MM/AAAA, DD-MM-AAAA, AAAA-MM-DD
                    $parsed = null;
                    foreach (['d/m/Y', 'd-m-Y', 'Y-m-d', 'd/m/y'] as $fmt) {
                        $parsed = \DateTime::createFromFormat($fmt, $validationValue);
                        if ($parsed) break;
                    }
                    $validated = $client && $parsed && $client->birth_date
                        && $parsed->format('Y-m-d') === \Carbon\Carbon::parse($client->birth_date)->format('Y-m-d');
                    break;
                case 'policy_number':
                    $validated = $polizas->contains(function ($p) use ($validationValue) {
                        return strtolower(trim($p->policy_number)) === strtolower(trim($validationValue));
                    });
                    break;
                default:
                    $validated = true;
            }

            if (!$validated) {
                $msg = $config['validation_error_message']
                    ?? '❌ Los datos de verificación no coinciden. Intenta de nuevo o comunícate con tu asesor.';
                $this->bridge->sendMessage($instanceId, $phone, $msg);
                $conversation->addMessage([
                    'direction' => 'outgoing', 'sender_type' => 'bot',
                    'message_type' => 'text', 'content' => $msg, 'status' => 'sent',
                ]);
                $this->cleanupPolicyLookupState($session);
                return ['response' => $msg, 'stop' => false];
            }

            // ✅ Validación exitosa — mostrar listado de pólizas
            $successMsg = $config['success_message'] ?? '✅ Identidad verificada. Estas son tus pólizas activas:';
            $this->bridge->sendMessage($instanceId, $phone, $successMsg);
            $conversation->addMessage([
                'direction' => 'outgoing', 'sender_type' => 'bot',
                'message_type' => 'text', 'content' => $successMsg, 'status' => 'sent',
            ]);

            $polizaList = '';
            $polizaIds = [];
            foreach ($polizas as $i => $p) {
                $num = $i + 1;
                $endDate = $p->end_date ? \Carbon\Carbon::parse($p->end_date)->format('d/m/Y') : 'N/A';
                $startDate = $p->start_date ? \Carbon\Carbon::parse($p->start_date)->format('d/m/Y') : 'N/A';
                $premium = $p->premium_amount ? '$' . number_format($p->premium_amount, 0, ',', '.') : 'N/A';
                $company = $p->insurance_company ?? 'N/A';
                $product = $p->product_name ?? $p->type ?? 'N/A';

                $polizaList .= "{$num}️⃣ *{$p->policy_number}*\n";
                $polizaList .= "   📦 {$product}\n";
                $polizaList .= "   🏢 {$company}\n";
                $polizaList .= "   📅 {$startDate} - {$endDate}\n";
                $polizaList .= "   💰 Prima: {$premium}\n\n";

                $polizaIds[] = $p->id;
            }

            $sendDocs = $config['send_documents'] ?? true;
            if ($sendDocs) {
                $polizaList .= "📄 Escribe el *número* de la póliza de la lista para recibir el documento (carátula).";
            }

            $this->bridge->sendMessage($instanceId, $phone, $polizaList);
            $conversation->addMessage([
                'direction' => 'outgoing', 'sender_type' => 'bot',
                'message_type' => 'text', 'content' => $polizaList, 'status' => 'sent',
            ]);

            // Guardar IDs de pólizas encontradas para step 3
            if ($sendDocs && count($polizaIds) > 0) {
                $session['variables']['_policy_lookup_step'] = 3;
                $session['variables']['_policy_lookup_ids'] = $polizaIds;
                $session['waiting_for_response'] = true;
                $session['waiting_for_input'] = true;
                $session['input_node_id'] = $node->id;
                return ['response' => $polizaList, 'stop' => true];
            }

            // Si no se envían docs, limpiar y continuar flujo
            $this->cleanupPolicyLookupState($session);
            return ['response' => $polizaList, 'stop' => false];
        }

        // ── STEP 3: Recibir selección de póliza → enviar carátula ──
        if ($step == 3) {
            $polizaIds = $session['variables']['_policy_lookup_ids'] ?? [];
            $selection = (int) preg_replace('/[^0-9]/', '', $userMessage);

            if ($selection < 1 || $selection > count($polizaIds)) {
                $msg = "Por favor escribe un número del 1 al " . count($polizaIds) . ":";
                $this->bridge->sendMessage($instanceId, $phone, $msg);
                $conversation->addMessage([
                    'direction' => 'outgoing', 'sender_type' => 'bot',
                    'message_type' => 'text', 'content' => $msg, 'status' => 'sent',
                ]);
                return ['response' => $msg, 'stop' => true];
            }

            $polizaId = $polizaIds[$selection - 1];
            $poliza = \App\Models\Poliza::find($polizaId);

            if (!$poliza) {
                $this->cleanupPolicyLookupState($session);
                return ['response' => null, 'stop' => false];
            }

            // Buscar documento tipo carátula o el primer documento disponible
            $documents = is_array($poliza->documents) ? $poliza->documents : [];
            $caratula = null;
            foreach ($documents as $doc) {
                $type = strtolower($doc['type'] ?? '');
                $name = strtolower($doc['name'] ?? '');
                if ($type === 'caratula' || $type === 'carátula' || str_contains($name, 'caratula') || str_contains($name, 'carátula')) {
                    $caratula = $doc;
                    break;
                }
            }
            // Fallback: primer documento PDF
            if (!$caratula) {
                foreach ($documents as $doc) {
                    $mime = strtolower($doc['contentType'] ?? '');
                    if (str_contains($mime, 'pdf') || str_contains(strtolower($doc['name'] ?? ''), '.pdf')) {
                        $caratula = $doc;
                        break;
                    }
                }
            }
            // Fallback: primer documento disponible
            if (!$caratula && !empty($documents)) {
                $caratula = $documents[0];
            }

            if ($caratula) {
                // Intentar obtener URL firmada
                $docUrl = $caratula['url'] ?? null;
                if (!empty($caratula['path'])) {
                    try {
                        $firebaseStorage = app(\Kreait\Firebase\Contract\Storage::class);
                        $bucketName = env('FIREBASE_STORAGE_BUCKET') ?: config('firebase.storage_bucket');
                        $projectId = config('firebase.project_id') ?: env('FIREBASE_PROJECT_ID');
                        $bucket = null;
                        foreach (array_filter([$bucketName, $projectId ? ($projectId . '.appspot.com') : null, $projectId ? ($projectId . '.firebasestorage.app') : null]) as $name) {
                            try {
                                $b = $firebaseStorage->getBucket($name);
                                if (method_exists($b, 'exists') && $b->exists()) { $bucket = $b; break; }
                            } catch (\Throwable $e) {}
                        }
                        if (!$bucket) $bucket = $firebaseStorage->getBucket();
                        
                        $object = $bucket->object($caratula['path']);
                        if ($object->exists()) {
                            $docUrl = $object->signedUrl(new \DateTimeImmutable('+1 hour'), ['version' => 'v4']);
                        }
                    } catch (\Throwable $e) {
                        Log::warning('📄 [POLICY_LOOKUP] Error generando URL firmada', ['error' => $e->getMessage()]);
                    }
                }

                if ($docUrl) {
                    $fileName = $caratula['name'] ?? ('Poliza_' . $poliza->policy_number . '.pdf');
                    $mime = $caratula['contentType'] ?? 'application/pdf';

                    // Enviar documento vía WhatsApp
                    $this->bridge->sendDocument($instanceId, $phone, $docUrl, $fileName);
                    $conversation->addMessage([
                        'direction' => 'outgoing', 'sender_type' => 'bot',
                        'message_type' => 'document', 'content' => "📄 {$fileName}",
                        'media' => ['url' => $docUrl, 'filename' => $fileName, 'mimetype' => $mime],
                        'status' => 'sent',
                    ]);

                    $msg = "📄 Aquí tienes el documento de tu póliza *{$poliza->policy_number}*.";
                    $this->bridge->sendMessage($instanceId, $phone, $msg);
                    $conversation->addMessage([
                        'direction' => 'outgoing', 'sender_type' => 'bot',
                        'message_type' => 'text', 'content' => $msg, 'status' => 'sent',
                    ]);
                } else {
                    $msg = "⚠️ No se pudo obtener el documento en este momento. Comunícate con tu asesor para recibirlo.";
                    $this->bridge->sendMessage($instanceId, $phone, $msg);
                    $conversation->addMessage([
                        'direction' => 'outgoing', 'sender_type' => 'bot',
                        'message_type' => 'text', 'content' => $msg, 'status' => 'sent',
                    ]);
                }
            } else {
                $msg = "📋 La póliza *{$poliza->policy_number}* no tiene documentos adjuntos en este momento. Comunícate con tu asesor.";
                $this->bridge->sendMessage($instanceId, $phone, $msg);
                $conversation->addMessage([
                    'direction' => 'outgoing', 'sender_type' => 'bot',
                    'message_type' => 'text', 'content' => $msg, 'status' => 'sent',
                ]);
            }

            $this->cleanupPolicyLookupState($session);
            return ['response' => null, 'stop' => false];
        }

        // Fallback: limpiar estado
        $this->cleanupPolicyLookupState($session);
        return ['response' => null, 'stop' => false];
    }

    /**
     * Limpiar variables temporales del flujo policy_lookup
     */
    private function cleanupPolicyLookupState(array &$session): void
    {
        unset(
            $session['variables']['_policy_lookup_step'],
            $session['variables']['_policy_lookup_node_id'],
            $session['variables']['_policy_lookup_document'],
            $session['variables']['_policy_lookup_ids']
        );
        $session['waiting_for_response'] = false;
        $session['waiting_for_input'] = false;
        $session['input_node_id'] = null;
    }
}
