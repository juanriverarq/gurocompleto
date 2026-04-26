<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Chatbot;
use App\Models\ChatbotFlow;
use App\Models\ChatbotNode;
use App\Models\ChatbotTrigger;
use App\Models\ChatbotSession;
use App\Models\ChatbotQuickResponse;
use App\Models\ChatbotAnalytics;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Controlador para gestión de Chatbots de WhatsApp
 */
class WhatsAppChatbotController extends Controller
{
    /**
     * Listar todos los chatbots del broker
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            if (!$brokerId) {
                return response()->json(['success' => false, 'message' => 'Broker no identificado'], 401);
            }

            $chatbots = Chatbot::forBroker($brokerId)
                ->withCount(['flows', 'triggers', 'sessions' => function ($query) {
                    $query->where('status', 'active');
                }])
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $chatbots
            ]);
        } catch (\Exception $e) {
            Log::error('Error listando chatbots: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Error al listar chatbots'], 500);
        }
    }

    /**
     * Crear un nuevo chatbot
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'description' => 'nullable|string',
            'instance_id' => 'nullable|string|max:100',
            'welcome_message' => 'nullable|string',
            'fallback_message' => 'nullable|string',
            'ai_enabled' => 'nullable|boolean',
            'ai_provider' => 'nullable|in:openai,claude,none',
            'ai_model' => 'nullable|string|max:50',
            'ai_system_prompt' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        try {
            $brokerId = $this->getBrokerId($request);
            
            if (!$brokerId) {
                return response()->json(['success' => false, 'message' => 'Broker no identificado'], 401);
            }

            // Validar que no haya otro chatbot activo en la misma línea
            if ($request->instance_id) {
                $existingActive = Chatbot::forBroker($brokerId)
                    ->where('instance_id', $request->instance_id)
                    ->where('is_active', true)
                    ->first();

                if ($existingActive) {
                    return response()->json([
                        'success' => false,
                        'message' => "Ya existe un chatbot activo en esta línea: \"{$existingActive->name}\". Solo puede haber un chatbot activo por línea. Desactívalo primero.",
                        'active_chatbot_id' => $existingActive->id,
                        'active_chatbot_name' => $existingActive->name,
                    ], 409);
                }
            }

            DB::beginTransaction();

            $chatbot = Chatbot::create([
                'broker_id' => $brokerId,
                'name' => $request->name,
                'description' => $request->description,
                'instance_id' => $request->instance_id,
                'welcome_message' => $request->welcome_message ?? '¡Hola! 👋 Soy un asistente virtual. ¿En qué puedo ayudarte?',
                'fallback_message' => $request->fallback_message ?? 'Lo siento, no entendí tu mensaje. Por favor, intenta de nuevo.',
                'ai_enabled' => $request->ai_enabled ?? false,
                'ai_provider' => $request->ai_provider ?? 'none',
                'ai_model' => $request->ai_model,
                'ai_system_prompt' => $request->ai_system_prompt,
            ]);

            // Crear flujo por defecto
            $flow = ChatbotFlow::create([
                'chatbot_id' => $chatbot->id,
                'name' => 'Flujo Principal',
                'description' => 'Flujo de bienvenida por defecto',
                'is_default' => true,
                'is_active' => true,
            ]);

            // Crear nodo de inicio
            $startNode = ChatbotNode::create([
                'flow_id' => $flow->id,
                'node_type' => 'start',
                'name' => 'Inicio',
                'position_x' => 100,
                'position_y' => 100,
                'config' => [],
            ]);

            // Crear nodo de mensaje de bienvenida
            $welcomeNode = ChatbotNode::create([
                'flow_id' => $flow->id,
                'node_type' => 'message',
                'name' => 'Bienvenida',
                'position_x' => 100,
                'position_y' => 250,
                'config' => [
                    'text' => $chatbot->welcome_message,
                ],
            ]);

            // Conectar nodos
            $startNode->update(['next_node_id' => $welcomeNode->id]);

            // Crear trigger de primer mensaje
            ChatbotTrigger::create([
                'chatbot_id' => $chatbot->id,
                'flow_id' => $flow->id,
                'trigger_type' => 'first_message',
                'trigger_value' => null,
                'priority' => 100,
                'is_active' => true,
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Chatbot creado exitosamente',
                'data' => $chatbot->load(['flows', 'triggers'])
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error creando chatbot: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Error al crear chatbot'], 500);
        }
    }

    /**
     * Obtener un chatbot específico con todos sus datos
     */
    public function show(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $chatbot = Chatbot::forBroker($brokerId)
                ->with(['flows.nodes', 'triggers', 'quickResponses'])
                ->withCount(['sessions' => function ($query) {
                    $query->where('status', 'active');
                }])
                ->findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $chatbot
            ]);
        } catch (\Exception $e) {
            Log::error('Error obteniendo chatbot: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Chatbot no encontrado'], 404);
        }
    }

    /**
     * Actualizar un chatbot
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:100',
            'description' => 'nullable|string',
            'instance_id' => 'nullable|string|max:100',
            'is_active' => 'sometimes|boolean',
            'welcome_message' => 'nullable|string',
            'fallback_message' => 'nullable|string',
            'goodbye_message' => 'nullable|string',
            'out_of_hours_message' => 'nullable|string',
            'ai_enabled' => 'nullable|boolean',
            'ai_provider' => 'nullable|in:openai,claude,none',
            'ai_model' => 'nullable|string|max:50',
            'ai_system_prompt' => 'nullable|string',
            'ai_temperature' => 'nullable|numeric|min:0|max:2',
            'ai_max_tokens' => 'nullable|integer|min:50|max:4000',
            'typing_delay_ms' => 'nullable|integer|min:0|max:5000',
            'response_delay_ms' => 'nullable|integer|min:0|max:5000',
            'session_timeout_minutes' => 'nullable|integer|min:1|max:1440',
            'max_fallback_count' => 'nullable|integer|min:1|max:10',
            'business_hours_enabled' => 'nullable|boolean',
            'business_hours' => 'nullable|array',
            'timezone' => 'nullable|string|max:50',
            'client_inactivity_enabled' => 'nullable|boolean',
            'client_inactivity_minutes' => 'nullable|integer|min:1|max:1380',
            'client_inactivity_message' => 'nullable|string',
            'agent_inactivity_enabled' => 'nullable|boolean',
            'agent_inactivity_minutes' => 'nullable|integer|min:1|max:1380',
            'agent_inactivity_message' => 'nullable|string',
            'escape_enabled' => 'nullable|boolean',
            'escape_keywords' => 'nullable|string|max:500',
            'escape_message' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        try {
            $brokerId = $this->getBrokerId($request);
            $chatbot = Chatbot::forBroker($brokerId)->findOrFail($id);

            // Validar que no haya otro chatbot activo en la misma línea
            $willBeActive = $request->has('is_active') ? $request->is_active : $chatbot->is_active;
            $instanceId = $request->has('instance_id') ? $request->instance_id : $chatbot->instance_id;

            if ($willBeActive && $instanceId) {
                $existingActive = Chatbot::forBroker($brokerId)
                    ->where('instance_id', $instanceId)
                    ->where('is_active', true)
                    ->where('id', '!=', $chatbot->id)
                    ->first();

                $deactivatedName = null;
                if ($existingActive) {
                    if ($request->boolean('force_deactivate_other')) {
                        $deactivatedName = $existingActive->name;
                        $existingActive->update(['is_active' => false]);
                        Log::info("🔄 [CHATBOT] Desactivado chatbot #{$existingActive->id} ({$existingActive->name}) para activar #{$chatbot->id} ({$chatbot->name})");
                    } else {
                        return response()->json([
                            'success' => false,
                            'message' => "Ya existe un chatbot activo en esta línea: \"{$existingActive->name}\". Solo puede haber un chatbot activo por línea.",
                            'active_chatbot_id' => $existingActive->id,
                            'active_chatbot_name' => $existingActive->name,
                        ], 409);
                    }
                }
            }
            
            $chatbot->update($request->only([
                'name', 'description', 'instance_id', 'is_active',
                'welcome_message', 'fallback_message', 'goodbye_message', 'out_of_hours_message',
                'ai_enabled', 'ai_provider', 'ai_model', 'ai_system_prompt',
                'ai_temperature', 'ai_max_tokens',
                'typing_delay_ms', 'response_delay_ms', 'session_timeout_minutes', 'max_fallback_count',
                'business_hours_enabled', 'business_hours', 'timezone',
                'client_inactivity_enabled', 'client_inactivity_minutes', 'client_inactivity_message',
                'agent_inactivity_enabled', 'agent_inactivity_minutes', 'agent_inactivity_message',
                'escape_enabled', 'escape_keywords', 'escape_message'
            ]));

            $response = [
                'success' => true,
                'message' => 'Chatbot actualizado exitosamente',
                'data' => $chatbot,
            ];

            if (!empty($deactivatedName)) {
                $response['deactivated_chatbot_name'] = $deactivatedName;
            }

            return response()->json($response);
        } catch (\Exception $e) {
            Log::error('Error actualizando chatbot: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Error al actualizar chatbot'], 500);
        }
    }

    /**
     * Eliminar un chatbot
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $chatbot = Chatbot::forBroker($brokerId)->findOrFail($id);
            
            $chatbot->delete();

            return response()->json([
                'success' => true,
                'message' => 'Chatbot eliminado exitosamente'
            ]);
        } catch (\Exception $e) {
            Log::error('Error eliminando chatbot: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Error al eliminar chatbot'], 500);
        }
    }

    /**
     * Duplicar un chatbot
     */
    public function duplicate(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $original = Chatbot::forBroker($brokerId)
                ->with(['flows.nodes', 'triggers', 'quickResponses'])
                ->findOrFail($id);

            DB::beginTransaction();

            // Duplicar chatbot
            $newChatbot = $original->replicate();
            $newChatbot->name = $original->name . ' (Copia)';
            $newChatbot->is_active = false;
            $newChatbot->save();

            // Mapeo de IDs antiguos a nuevos para nodos
            $nodeMapping = [];

            // Duplicar flujos y nodos
            foreach ($original->flows as $flow) {
                $newFlow = $flow->replicate();
                $newFlow->chatbot_id = $newChatbot->id;
                $newFlow->save();

                foreach ($flow->nodes as $node) {
                    $newNode = $node->replicate();
                    $newNode->flow_id = $newFlow->id;
                    $newNode->next_node_id = null; // Se actualizará después
                    $newNode->save();
                    
                    $nodeMapping[$node->id] = $newNode->id;
                }
            }

            // Actualizar referencias de next_node_id
            foreach ($original->flows as $flow) {
                foreach ($flow->nodes as $node) {
                    if ($node->next_node_id && isset($nodeMapping[$node->next_node_id])) {
                        $newNodeId = $nodeMapping[$node->id];
                        ChatbotNode::where('id', $newNodeId)
                            ->update(['next_node_id' => $nodeMapping[$node->next_node_id]]);
                    }
                }
            }

            // Duplicar triggers
            foreach ($original->triggers as $trigger) {
                $newTrigger = $trigger->replicate();
                $newTrigger->chatbot_id = $newChatbot->id;
                if ($trigger->flow_id) {
                    // Buscar el nuevo flow_id correspondiente
                    $originalFlow = $original->flows->find($trigger->flow_id);
                    if ($originalFlow) {
                        $newFlow = $newChatbot->flows()->where('name', $originalFlow->name)->first();
                        $newTrigger->flow_id = $newFlow?->id;
                    }
                }
                $newTrigger->save();
            }

            // Duplicar respuestas rápidas
            foreach ($original->quickResponses as $qr) {
                $newQr = $qr->replicate();
                $newQr->chatbot_id = $newChatbot->id;
                $newQr->usage_count = 0;
                $newQr->save();
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Chatbot duplicado exitosamente',
                'data' => $newChatbot->load(['flows', 'triggers'])
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Error duplicando chatbot: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Error al duplicar chatbot'], 500);
        }
    }

    // ==================== FLOWS ====================

    /**
     * Listar flujos de un chatbot
     */
    public function getFlows(Request $request, int $chatbotId): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $chatbot = Chatbot::forBroker($brokerId)->findOrFail($chatbotId);
            
            $flows = $chatbot->flows()->with('nodes')->orderBy('priority', 'desc')->get();

            return response()->json([
                'success' => true,
                'data' => $flows
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error al obtener flujos'], 500);
        }
    }

    /**
     * Crear un flujo
     */
    public function createFlow(Request $request, int $chatbotId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'description' => 'nullable|string',
            'is_default' => 'nullable|boolean',
            'priority' => 'nullable|integer',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        try {
            $brokerId = $this->getBrokerId($request);
            $chatbot = Chatbot::forBroker($brokerId)->findOrFail($chatbotId);

            DB::beginTransaction();

            // Si es default, quitar default de otros
            if ($request->is_default) {
                $chatbot->flows()->update(['is_default' => false]);
            }

            $flow = ChatbotFlow::create([
                'chatbot_id' => $chatbot->id,
                'name' => $request->name,
                'description' => $request->description,
                'is_default' => $request->is_default ?? false,
                'priority' => $request->priority ?? 0,
                'is_active' => true,
            ]);

            // Crear nodo de inicio automáticamente
            ChatbotNode::create([
                'flow_id' => $flow->id,
                'node_type' => 'start',
                'name' => 'Inicio',
                'position_x' => 100,
                'position_y' => 100,
                'config' => [],
            ]);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Flujo creado exitosamente',
                'data' => $flow->load('nodes')
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => 'Error al crear flujo'], 500);
        }
    }

    /**
     * Actualizar un flujo
     */
    public function updateFlow(Request $request, int $flowId): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $flow = ChatbotFlow::whereHas('chatbot', function ($q) use ($brokerId) {
                $q->where('broker_id', $brokerId);
            })->findOrFail($flowId);

            if ($request->is_default) {
                $flow->chatbot->flows()->where('id', '!=', $flowId)->update(['is_default' => false]);
            }

            $flow->update($request->only(['name', 'description', 'is_default', 'priority', 'is_active']));

            return response()->json([
                'success' => true,
                'message' => 'Flujo actualizado',
                'data' => $flow
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error al actualizar flujo'], 500);
        }
    }

    /**
     * Eliminar un flujo
     */
    public function deleteFlow(Request $request, int $flowId): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $flow = ChatbotFlow::whereHas('chatbot', function ($q) use ($brokerId) {
                $q->where('broker_id', $brokerId);
            })->findOrFail($flowId);

            $flow->delete();

            return response()->json([
                'success' => true,
                'message' => 'Flujo eliminado'
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error al eliminar flujo'], 500);
        }
    }

    // ==================== NODES ====================

    /**
     * Crear un nodo
     */
    public function createNode(Request $request, int $flowId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'node_type' => 'required|in:start,message,question,options,input,user_input,collect_data,condition,action,ai_response,transfer,delay,end,media,image,document,audio,video,interactive,buttons,list,set_variable,add_tag,remove_tag,webhook,policy_lookup',
            'name' => 'nullable|string|max:100',
            'position_x' => 'nullable|integer',
            'position_y' => 'nullable|integer',
            'config' => 'required|array',
            'next_node_id' => 'nullable|integer|exists:chatbot_nodes,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        try {
            $brokerId = $this->getBrokerId($request);
            $flow = ChatbotFlow::whereHas('chatbot', function ($q) use ($brokerId) {
                $q->where('broker_id', $brokerId);
            })->findOrFail($flowId);

            $node = ChatbotNode::create([
                'flow_id' => $flow->id,
                'node_type' => $request->node_type,
                'name' => $request->name,
                'position_x' => $request->position_x ?? 0,
                'position_y' => $request->position_y ?? 0,
                'config' => $request->config,
                'next_node_id' => $request->next_node_id,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Nodo creado',
                'data' => $node
            ], 201);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error al crear nodo'], 500);
        }
    }

    /**
     * Actualizar un nodo
     */
    public function updateNode(Request $request, int $nodeId): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $node = ChatbotNode::whereHas('flow.chatbot', function ($q) use ($brokerId) {
                $q->where('broker_id', $brokerId);
            })->findOrFail($nodeId);

            $node->update($request->only(['name', 'position_x', 'position_y', 'config', 'next_node_id']));

            return response()->json([
                'success' => true,
                'message' => 'Nodo actualizado',
                'data' => $node
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error al actualizar nodo'], 500);
        }
    }

    /**
     * Actualizar/crear nodos en lote (para el editor visual)
     * Sincroniza los nodos del flujo con los enviados desde el editor
     */
    public function updateNodesBulk(Request $request, int $flowId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'nodes' => 'required|array',
            'nodes.*.id' => 'nullable|integer',
            'nodes.*.temp_id' => 'nullable|string',
            'nodes.*.temp_index' => 'nullable|integer',
            'nodes.*.node_type' => 'required|string',
            'nodes.*.name' => 'nullable|string|max:100',
            'nodes.*.position_x' => 'required|integer',
            'nodes.*.position_y' => 'required|integer',
            'nodes.*.config' => 'nullable|array',
            'nodes.*.next_node_id' => 'nullable|integer',
            'nodes.*.next_node_index' => 'nullable|integer',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        try {
            $brokerId = $this->getBrokerId($request);
            $flow = ChatbotFlow::whereHas('chatbot', function ($q) use ($brokerId) {
                $q->where('broker_id', $brokerId);
            })->findOrFail($flowId);

            DB::beginTransaction();

            // Eliminar nodos existentes y recrear (sincronización completa)
            ChatbotNode::where('flow_id', $flow->id)->delete();

            $createdNodes = [];
            foreach ($request->nodes as $index => $nodeData) {
                $node = ChatbotNode::create([
                    'flow_id' => $flow->id,
                    'node_type' => $nodeData['node_type'],
                    'name' => $nodeData['name'] ?? null,
                    'position_x' => $nodeData['position_x'],
                    'position_y' => $nodeData['position_y'],
                    'config' => $nodeData['config'] ?? [],
                    'next_node_id' => null,
                ]);
                $createdNodes[$index] = $node;
            }

            // Actualizar conexiones (next_node_id) basándose en next_node_index
            foreach ($request->nodes as $index => $nodeData) {
                $updates = [];
                $configUpdated = false;
                $config = $createdNodes[$index]->config ?? [];

                // 1) Linear connection: next_node_index → next_node_id
                if (isset($nodeData['next_node_index']) && isset($createdNodes[$nodeData['next_node_index']])) {
                    $updates['next_node_id'] = $createdNodes[$nodeData['next_node_index']]->id;
                }

                // 2) Options: remap options[].next_node_index → options[].next_node_id
                if (!empty($config['options']) && is_array($config['options'])) {
                    foreach ($config['options'] as $optIdx => &$opt) {
                        if (isset($opt['next_node_index']) && isset($createdNodes[$opt['next_node_index']])) {
                            $opt['next_node_id'] = (string) $createdNodes[$opt['next_node_index']]->id;
                            $configUpdated = true;
                        }
                        // Clean up temp field
                        unset($opt['next_node_index']);
                    }
                    unset($opt);
                }

                // 3) Conditions: remap true_node_index/false_node_index → true_node_id/false_node_id
                if (isset($config['true_node_index']) && isset($createdNodes[$config['true_node_index']])) {
                    $config['true_node_id'] = (string) $createdNodes[$config['true_node_index']]->id;
                    unset($config['true_node_index']);
                    $configUpdated = true;
                }
                if (isset($config['false_node_index']) && isset($createdNodes[$config['false_node_index']])) {
                    $config['false_node_id'] = (string) $createdNodes[$config['false_node_index']]->id;
                    unset($config['false_node_index']);
                    $configUpdated = true;
                }

                if ($configUpdated) {
                    $updates['config'] = $config;
                }

                if (!empty($updates)) {
                    $createdNodes[$index]->update($updates);
                    Log::info("🔗 [CHATBOT] Conexiones guardadas", [
                        'node_id' => $createdNodes[$index]->id,
                        'node_type' => $createdNodes[$index]->node_type,
                        'next_node_id' => $updates['next_node_id'] ?? null,
                        'options_remapped' => !empty($config['options']),
                        'conditions_remapped' => isset($updates['config']['true_node_id']) || isset($updates['config']['false_node_id']),
                    ]);
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Nodos sincronizados correctamente',
                'data' => $flow->fresh()->nodes
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error actualizando nodos: ' . $e->getMessage());
            return response()->json(['success' => false, 'message' => 'Error al actualizar nodos: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Eliminar un nodo
     */
    public function deleteNode(Request $request, int $nodeId): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $node = ChatbotNode::whereHas('flow.chatbot', function ($q) use ($brokerId) {
                $q->where('broker_id', $brokerId);
            })->findOrFail($nodeId);

            // No permitir eliminar nodo de inicio
            if ($node->node_type === 'start') {
                return response()->json(['success' => false, 'message' => 'No se puede eliminar el nodo de inicio'], 400);
            }

            $node->delete();

            return response()->json([
                'success' => true,
                'message' => 'Nodo eliminado'
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error al eliminar nodo'], 500);
        }
    }

    // ==================== TRIGGERS ====================

    /**
     * Listar triggers de un chatbot
     */
    public function getTriggers(Request $request, int $chatbotId): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $chatbot = Chatbot::forBroker($brokerId)->findOrFail($chatbotId);
            
            $triggers = $chatbot->triggers()->with('flow')->orderBy('priority', 'desc')->get();

            return response()->json([
                'success' => true,
                'data' => $triggers
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error al obtener triggers'], 500);
        }
    }

    /**
     * Crear un trigger
     */
    public function createTrigger(Request $request, int $chatbotId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'flow_id' => 'nullable|integer|exists:chatbot_flows,id',
            'trigger_type' => 'required|in:keyword,contains,regex,starts_with,first_message,button_reply,list_reply,media,location,schedule',
            'trigger_value' => 'nullable|string|max:500',
            'is_case_sensitive' => 'nullable|boolean',
            'priority' => 'nullable|integer',
            'conditions' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        try {
            $brokerId = $this->getBrokerId($request);
            $chatbot = Chatbot::forBroker($brokerId)->findOrFail($chatbotId);

            $trigger = ChatbotTrigger::create([
                'chatbot_id' => $chatbot->id,
                'flow_id' => $request->flow_id,
                'trigger_type' => $request->trigger_type,
                'trigger_value' => $request->trigger_value,
                'is_case_sensitive' => $request->is_case_sensitive ?? false,
                'priority' => $request->priority ?? 0,
                'is_active' => true,
                'conditions' => $request->conditions,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Trigger creado',
                'data' => $trigger->load('flow')
            ], 201);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error al crear trigger'], 500);
        }
    }

    /**
     * Actualizar un trigger
     */
    public function updateTrigger(Request $request, int $triggerId): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $trigger = ChatbotTrigger::whereHas('chatbot', function ($q) use ($brokerId) {
                $q->where('broker_id', $brokerId);
            })->findOrFail($triggerId);

            $trigger->update($request->only([
                'flow_id', 'trigger_type', 'trigger_value', 
                'is_case_sensitive', 'priority', 'is_active', 'conditions'
            ]));

            return response()->json([
                'success' => true,
                'message' => 'Trigger actualizado',
                'data' => $trigger
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error al actualizar trigger'], 500);
        }
    }

    /**
     * Eliminar un trigger
     */
    public function deleteTrigger(Request $request, int $triggerId): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $trigger = ChatbotTrigger::whereHas('chatbot', function ($q) use ($brokerId) {
                $q->where('broker_id', $brokerId);
            })->findOrFail($triggerId);

            $trigger->delete();

            return response()->json([
                'success' => true,
                'message' => 'Trigger eliminado'
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error al eliminar trigger'], 500);
        }
    }

    // ==================== SESSIONS ====================

    /**
     * Listar sesiones activas de un chatbot
     */
    public function getSessions(Request $request, int $chatbotId): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $chatbot = Chatbot::forBroker($brokerId)->findOrFail($chatbotId);
            
            $sessions = $chatbot->sessions()
                ->with(['currentFlow', 'currentNode'])
                ->orderBy('last_activity_at', 'desc')
                ->paginate(20);

            return response()->json([
                'success' => true,
                'data' => $sessions
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error al obtener sesiones'], 500);
        }
    }

    /**
     * Terminar una sesión
     */
    public function endSession(Request $request, int $sessionId): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $session = ChatbotSession::whereHas('chatbot', function ($q) use ($brokerId) {
                $q->where('broker_id', $brokerId);
            })->findOrFail($sessionId);

            $session->update(['status' => ChatbotSession::STATUS_COMPLETED]);

            return response()->json([
                'success' => true,
                'message' => 'Sesión terminada'
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error al terminar sesión'], 500);
        }
    }

    // ==================== ANALYTICS ====================

    /**
     * Obtener analytics de un chatbot
     */
    public function getAnalytics(Request $request, int $chatbotId): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $chatbot = Chatbot::forBroker($brokerId)->findOrFail($chatbotId);
            
            $from = $request->get('from', now()->subDays(30)->format('Y-m-d'));
            $to = $request->get('to', now()->format('Y-m-d'));

            $analytics = $chatbot->analytics()
                ->forDateRange($from, $to)
                ->orderBy('date')
                ->get();

            // Calcular totales
            $totals = [
                'total_sessions' => $analytics->sum('total_sessions'),
                'completed_sessions' => $analytics->sum('completed_sessions'),
                'transferred_sessions' => $analytics->sum('transferred_sessions'),
                'avg_duration' => $analytics->avg('avg_session_duration_seconds'),
            ];

            return response()->json([
                'success' => true,
                'data' => [
                    'daily' => $analytics,
                    'totals' => $totals
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error al obtener analytics'], 500);
        }
    }

    /**
     * Obtener analytics detallados de un chatbot (sesiones, nodos, comportamiento)
     */
    public function getDetailedAnalytics(Request $request, int $chatbotId): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $chatbot = Chatbot::forBroker($brokerId)->findOrFail($chatbotId);
            
            $range = $request->get('range', 'week');
            
            // Calcular fechas según el rango
            $startDate = match($range) {
                'today' => now()->startOfDay(),
                'week' => now()->subDays(7),
                'month' => now()->subDays(30),
                default => null, // 'all'
            };

            // Verificar si la tabla existe y tiene datos
            if (!Schema::hasTable('chatbot_sessions')) {
                return response()->json([
                    'success' => true,
                    'data' => $this->getEmptyAnalytics()
                ]);
            }

            // Contar sesiones por estado
            $totalSessions = ChatbotSession::where('chatbot_id', $chatbotId)
                ->when($startDate, fn($q) => $q->where('started_at', '>=', $startDate))
                ->count();
                
            $activeSessions = ChatbotSession::where('chatbot_id', $chatbotId)
                ->whereIn('status', ['active', 'waiting_input'])
                ->when($startDate, fn($q) => $q->where('started_at', '>=', $startDate))
                ->count();
                
            $completedSessions = ChatbotSession::where('chatbot_id', $chatbotId)
                ->where('status', 'completed')
                ->when($startDate, fn($q) => $q->where('started_at', '>=', $startDate))
                ->count();
                
            $transferredSessions = ChatbotSession::where('chatbot_id', $chatbotId)
                ->where('status', 'transferred')
                ->when($startDate, fn($q) => $q->where('started_at', '>=', $startDate))
                ->count();
                
            $expiredSessions = ChatbotSession::where('chatbot_id', $chatbotId)
                ->where('status', 'expired')
                ->when($startDate, fn($q) => $q->where('started_at', '>=', $startDate))
                ->count();

            // Sesiones de hoy
            $sessionsToday = ChatbotSession::where('chatbot_id', $chatbotId)
                ->whereDate('started_at', today())
                ->count();

            // Sesiones esta semana
            $sessionsThisWeek = ChatbotSession::where('chatbot_id', $chatbotId)
                ->where('started_at', '>=', now()->startOfWeek())
                ->count();

            // Duración promedio (en minutos) - simplificado
            $avgDuration = 0;
            try {
                $avgDuration = ChatbotSession::where('chatbot_id', $chatbotId)
                    ->whereNotNull('last_activity_at')
                    ->whereNotNull('started_at')
                    ->selectRaw('AVG(TIMESTAMPDIFF(MINUTE, started_at, last_activity_at)) as avg_minutes')
                    ->value('avg_minutes') ?? 0;
            } catch (\Exception $e) {
                // Ignorar error de duración
            }

            // Precargar nodos y flujos del chatbot para resolver nombres
            $flowIds = ChatbotFlow::where('chatbot_id', $chatbotId)->pluck('id', 'id');
            $flowNames = ChatbotFlow::where('chatbot_id', $chatbotId)->pluck('name', 'id');
            $allNodes = ChatbotNode::whereIn('flow_id', $flowIds->keys())->get()->keyBy('id');

            // Node stats: contar sesiones activas/waiting por nodo actual
            $activeByNode = ChatbotSession::where('chatbot_id', $chatbotId)
                ->whereIn('status', ['active', 'waiting_input'])
                ->whereNotNull('current_node_id')
                ->selectRaw('current_node_id, COUNT(*) as active_count')
                ->groupBy('current_node_id')
                ->pluck('active_count', 'current_node_id');

            // Contar sesiones completadas/expiradas/transferidas por último nodo conocido
            $droppedByNode = ChatbotSession::where('chatbot_id', $chatbotId)
                ->whereIn('status', ['expired', 'completed', 'transferred'])
                ->whereNotNull('current_node_id')
                ->when($startDate, fn($q) => $q->where('started_at', '>=', $startDate))
                ->selectRaw('current_node_id, COUNT(*) as drop_count')
                ->groupBy('current_node_id')
                ->pluck('drop_count', 'current_node_id');

            // Construir node_stats con todos los nodos del chatbot
            $nodeStats = $allNodes->map(function ($node) use ($activeByNode, $droppedByNode) {
                $active = $activeByNode->get($node->id, 0);
                $dropped = $droppedByNode->get($node->id, 0);
                return [
                    'node_id' => $node->id,
                    'node_name' => $node->name ?: 'Nodo ' . $node->id,
                    'node_type' => $node->node_type,
                    'visits' => $active + $dropped,
                    'drop_offs' => $dropped,
                    'active_users' => $active,
                ];
            })->filter(fn($s) => $s['visits'] > 0)->values()->toArray();

            // Sesiones recientes con detalles resueltos
            $recentSessions = ChatbotSession::where('chatbot_id', $chatbotId)
                ->orderByDesc('id')
                ->limit(20)
                ->get()
                ->map(function ($session) use ($flowNames, $allNodes) {
                    $node = $session->current_node_id ? $allNodes->get($session->current_node_id) : null;
                    return [
                        'id' => $session->id,
                        'contact_phone' => $session->contact_phone ?? 'N/A',
                        'status' => $session->status ?? 'unknown',
                        'current_flow_id' => $session->current_flow_id,
                        'current_node_id' => $session->current_node_id,
                        'variables' => $session->variables ?? [],
                        'started_at' => $session->started_at ? $session->started_at->toISOString() : null,
                        'last_activity_at' => $session->last_activity_at ? $session->last_activity_at->toISOString() : null,
                        'flow' => $session->current_flow_id && $flowNames->has($session->current_flow_id)
                            ? ['name' => $flowNames->get($session->current_flow_id)]
                            : null,
                        'node' => $node
                            ? ['name' => $node->name, 'node_type' => $node->node_type]
                            : null,
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => [
                    'total_sessions' => $totalSessions,
                    'active_sessions' => $activeSessions,
                    'completed_sessions' => $completedSessions,
                    'transferred_sessions' => $transferredSessions,
                    'expired_sessions' => $expiredSessions,
                    'avg_session_duration_minutes' => round((float)$avgDuration, 1),
                    'sessions_today' => $sessionsToday,
                    'sessions_this_week' => $sessionsThisWeek,
                    'node_stats' => $nodeStats,
                    'recent_sessions' => $recentSessions,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Error obteniendo analytics detallados: ' . $e->getMessage(), [
                'chatbot_id' => $chatbotId,
                'trace' => $e->getTraceAsString()
            ]);
            
            // Devolver datos vacíos en lugar de error
            return response()->json([
                'success' => true,
                'data' => $this->getEmptyAnalytics(),
                'warning' => config('app.debug') ? $e->getMessage() : null
            ]);
        }
    }
    
    private function getEmptyAnalytics(): array
    {
        return [
            'total_sessions' => 0,
            'active_sessions' => 0,
            'completed_sessions' => 0,
            'transferred_sessions' => 0,
            'expired_sessions' => 0,
            'avg_session_duration_minutes' => 0,
            'sessions_today' => 0,
            'sessions_this_week' => 0,
            'node_stats' => [],
            'recent_sessions' => [],
        ];
    }

    // ==================== HELPERS ====================

    private function getBrokerId(Request $request): ?int
    {
        // 1. Del request (inyectado por middleware unified.auth)
        if ($request->has('authenticated_broker_id')) {
            return (int) $request->get('authenticated_broker_id');
        }

        // 2. Del broker_id directo en request
        if ($request->has('broker_id')) {
            return (int) $request->get('broker_id');
        }

        // 3. Del empleado autenticado
        $empleado = $request->get('authenticated_empleado');
        if ($empleado && isset($empleado->broker_id)) {
            return (int) $empleado->broker_id;
        }

        // 4. Del broker autenticado
        $broker = $request->get('authenticated_broker');
        if ($broker && isset($broker->id)) {
            return (int) $broker->id;
        }

        // 5. Del usuario autenticado (Firebase/Sanctum)
        $user = $request->user();
        if ($user && isset($user->broker_id)) {
            return (int) $user->broker_id;
        }

        // 6. Usar servicio de autenticación de broker
        $brokerId = \App\Services\BrokerAuthService::getCurrentBrokerId();
        if ($brokerId) {
            return (int) $brokerId;
        }

        return null;
    }
}
