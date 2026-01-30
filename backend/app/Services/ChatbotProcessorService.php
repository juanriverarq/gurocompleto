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
     */
    protected function isFirstMessage(int $chatbotId, string $phone): bool
    {
        $cacheKey = "first_message_{$chatbotId}_{$phone}";
        
        if (Cache::has($cacheKey)) {
            return false;
        }

        // NO marcar aquí - se marca cuando se usa el trigger
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
        if (!empty($session['expected_options'])) {
            $variables['_expected_options'] = $session['expected_options'];
        }
        if (!empty($session['expected_buttons'])) {
            $variables['_expected_buttons'] = $session['expected_buttons'];
        }
        if (!empty($session['expected_sections'])) {
            $variables['_expected_sections'] = $session['expected_sections'];
        }
        if (!empty($session['interactive_type'])) {
            $variables['_interactive_type'] = $session['interactive_type'];
        }
        // Campos para nodo de entrada de datos
        if (!empty($session['waiting_for_input'])) {
            $variables['_waiting_for_input'] = true;
            $variables['_input_variable_name'] = $session['input_variable_name'] ?? null;
            $variables['_input_validation'] = $session['input_validation'] ?? null;
            $variables['_input_node_id'] = $session['input_node_id'] ?? null;
            $variables['_input_contact_field'] = $session['input_contact_field'] ?? null;
        }
        if (!empty($session['options_node_id'])) {
            $variables['_options_node_id'] = $session['options_node_id'];
        }
        if (!empty($session['options_error_message'])) {
            $variables['_options_error_message'] = $session['options_error_message'];
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
                Log::info("💾 [CHATBOT] Guardando sesión (stop)", [
                    'current_node_id' => $session['current_node_id'] ?? null,
                    'waiting_for_response' => $session['waiting_for_response'] ?? false,
                    'waiting_for_input' => $session['waiting_for_input'] ?? false,
                    'input_node_id' => $session['input_node_id'] ?? null,
                ]);
                $this->saveSession($session, $instanceId, $phone);
                break;
            }

            // Ir al siguiente nodo
            if ($currentNode->next_node_id && isset($nodeMap[$currentNode->next_node_id])) {
                $currentNode = $nodeMap[$currentNode->next_node_id];
            } else {
                $currentNode = null;
            }
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
                
                $optionsText = $text . "\n\n";
                foreach ($options as $i => $opt) {
                    $optionsText .= ($i + 1) . ". " . ($opt['text'] ?? $opt['label'] ?? "Opción " . ($i + 1)) . "\n";
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
                $endMessage = $config['message'] ?? null;
                if ($endMessage) {
                    $this->bridge->sendMessage($instanceId, $phone, $endMessage);
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

        // Opciones de configuración del nodo
        $options = [
            'system_prompt' => $config['system_prompt'] ?? null,
            'conversation_history' => $conversationHistory,
            'model' => $config['model'] ?? null,
            'max_tokens' => $config['max_tokens'] ?? 300,
            'temperature' => $config['temperature'] ?? 0.7,
        ];

        // Contexto adicional
        $context = [
            'bot_name' => $session['variables']['bot_name'] ?? 'Asistente',
            'company_name' => $config['company_name'] ?? $session['variables']['company_name'] ?? null,
            'custom_instructions' => $config['custom_instructions'] ?? null,
        ];

        $result = $this->aiService->generateResponse($userMessage, $context, $options);

        if ($result['success'] && $result['response']) {
            $aiResponse = $this->replaceVariables($result['response'], $session['variables']);
            
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
        // PRIMERO: Si hay opciones esperando respuesta, procesarlas (tiene prioridad sobre input)
        if (!empty($session['expected_options'])) {
            return $this->processOptionsResponse($session, $message, $instanceId, $phone, $conversation);
        }
        
        // Si estamos esperando entrada de datos del usuario (nodo input)
        if (!empty($session['waiting_for_input'])) {
            $variableName = $session['input_variable_name'] ?? 'user_input';
            $validationType = $session['input_validation'] ?? null;
            $inputNodeId = $session['input_node_id'] ?? null;
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
                $this->bridge->sendMessage($instanceId, $phone, $errorMessage);
                $conversation->addMessage([
                    'direction' => 'outgoing',
                    'sender_type' => 'bot',
                    'message_type' => 'text',
                    'content' => $errorMessage,
                    'status' => 'sent',
                ]);
                return ['processed' => true, 'reason' => 'Invalid input, waiting for valid response'];
            }
            
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
    protected function executeFlowFromNode(array $session, int $nodeId, string $instanceId, string $phone, WhatsAppConversation $conversation): array
    {
        $flow = ChatbotFlow::find($session['flow_id']);
        if (!$flow) {
            return ['processed' => false, 'reason' => 'Flow not found'];
        }
        
        $nodes = ChatbotNode::where('flow_id', $flow->id)->get();
        $nodeMap = $nodes->keyBy('id');
        
        if (!isset($nodeMap[$nodeId])) {
            return ['processed' => false, 'reason' => 'Node not found'];
        }
        
        $currentNode = $nodeMap[$nodeId];
        $responses = [];
        $maxSteps = 10;
        $step = 0;
        $sessionKey = "chatbot_session_{$instanceId}_{$phone}";
        
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
                $this->saveSession($session, $instanceId, $phone);
                break;
            }
            
            if ($currentNode->next_node_id && isset($nodeMap[$currentNode->next_node_id])) {
                $currentNode = $nodeMap[$currentNode->next_node_id];
            } else {
                $currentNode = null;
            }
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
            Log::info("✅ [CHATBOT] Opción seleccionada", [
                'option' => $selectedOption['text'] ?? 'unknown',
                'transfer_to' => $selectedOption['transfer_to'] ?? null
            ]);
            
            // Limpiar estado de opciones e input
            $session['variables']['selected_option'] = $selectedOption['text'] ?? '';
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
        
        // Opción no válida - mostrar error
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
        
        return ['processed' => true, 'reason' => 'Invalid option, resent options'];
    }
}
