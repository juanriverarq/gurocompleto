<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WhatsAppConversation;
use App\Models\WhatsAppConversationMessage;
use App\Models\WhatsAppDepartment;
use App\Models\WhatsAppDepartmentMember;
use App\Models\WhatsAppQuickReply;
use App\Models\WhatsAppInstance;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use App\Http\Middleware\UnifiedAuthMiddleware;
use App\Models\EmpleadoBroker;

class WhatsAppInboxController extends Controller
{
    /**
     * Obtener usuario autenticado y su broker (compatible con Firebase + Empleados)
     */
    private function resolveUserAndBroker(Request $request): array
    {
        $user = UnifiedAuthMiddleware::getAuthenticatedUser($request);
        if (!$user) {
            return [null, null];
        }
        $broker = ($user instanceof EmpleadoBroker)
            ? $user->broker
            : $user->getPrimaryBroker();
        return [$user, $broker];
    }

    // ==========================================
    // DEPARTAMENTOS
    // ==========================================

    public function getDepartments(Request $request): Response
    {
        [$user, $broker_resolved] = $this->resolveUserAndBroker($request);
        $broker = $broker_resolved;

        if (!$broker) {
            return response(['error' => 'Broker no encontrado'], 403);
        }

        $departments = WhatsAppDepartment::where('broker_id', $broker->id)
            ->withCount(['conversations as active_conversations' => function ($q) {
                $q->whereNotIn('status', ['closed', 'resolved']);
            }])
            ->withCount('members')
            ->orderBy('priority')
            ->get();

        return response(['departments' => $departments], 200);
    }

    public function createDepartment(Request $request): Response
    {
        [$user, $broker_resolved] = $this->resolveUserAndBroker($request);
        $broker = $broker_resolved;

        if (!$broker) {
            return response(['error' => 'Broker no encontrado'], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'icon' => 'nullable|string',
            'color' => 'nullable|string',
            'priority' => 'nullable|integer',
        ]);

        $department = WhatsAppDepartment::create([
            'broker_id' => $broker->id,
            ...$validated,
        ]);

        return response(['department' => $department], 201);
    }

    public function updateDepartment(Request $request, WhatsAppDepartment $department): Response
    {
        [$user, $broker_resolved] = $this->resolveUserAndBroker($request);
        $broker = $broker_resolved;

        if (!$broker || $department->broker_id !== $broker->id) {
            return response(['error' => 'No autorizado'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'icon' => 'nullable|string',
            'color' => 'nullable|string',
            'is_active' => 'sometimes|boolean',
            'priority' => 'nullable|integer',
        ]);

        $department->update($validated);

        return response(['department' => $department], 200);
    }

    public function deleteDepartment(WhatsAppDepartment $department, Request $request): Response
    {
        [$user, $broker_resolved] = $this->resolveUserAndBroker($request);
        $broker = $broker_resolved;

        if (!$broker || $department->broker_id !== $broker->id) {
            return response(['error' => 'No autorizado'], 403);
        }

        $department->delete();

        return response(['message' => 'Departamento eliminado'], 200);
    }

    public function addMemberToDepartment(Request $request, WhatsAppDepartment $department): Response
    {
        [$user, $broker_resolved] = $this->resolveUserAndBroker($request);
        $broker = $broker_resolved;

        if (!$broker || $department->broker_id !== $broker->id) {
            return response(['error' => 'No autorizado'], 403);
        }

        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
            'is_supervisor' => 'nullable|boolean',
            'max_concurrent_conversations' => 'nullable|integer|min:1|max:50',
        ]);

        $member = WhatsAppDepartmentMember::updateOrCreate(
            [
                'department_id' => $department->id,
                'user_id' => $validated['user_id'],
            ],
            [
                'is_supervisor' => $validated['is_supervisor'] ?? false,
                'max_concurrent_conversations' => $validated['max_concurrent_conversations'] ?? 10,
                'can_receive_assignments' => true,
            ]
        );

        return response(['member' => $member->load('user')], 201);
    }

    public function removeMemberFromDepartment(Request $request, WhatsAppDepartment $department, int $userId): Response
    {
        [$user, $broker_resolved] = $this->resolveUserAndBroker($request);
        $broker = $broker_resolved;

        if (!$broker || $department->broker_id !== $broker->id) {
            return response(['error' => 'No autorizado'], 403);
        }

        WhatsAppDepartmentMember::where('department_id', $department->id)
            ->where('user_id', $userId)
            ->delete();

        return response(['message' => 'Miembro eliminado'], 200);
    }

    // ==========================================
    // CONVERSACIONES
    // ==========================================

    public function getConversations(Request $request): Response
    {
        [$user, $broker_resolved] = $this->resolveUserAndBroker($request);
        $broker = $broker_resolved;

        Log::info('📋 [INBOX DEBUG] getConversations', [
            'user_class' => $user ? get_class($user) : 'null',
            'user_id' => $user->id ?? null,
            'broker_id' => $broker->id ?? null,
        ]);

        if (!$broker) {
            return response(['error' => 'Broker no encontrado'], 403);
        }

        $query = WhatsAppConversation::where('broker_id', $broker->id)
            ->with(['department', 'assignedAgent', 'instance', 'latestMessage'])
            ->withCount('messages');

        // Filtros
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('department_id')) {
            $query->where('department_id', $request->department_id);
        }

        if ($request->has('assigned_to')) {
            if ($request->assigned_to === 'me') {
                $query->where('assigned_to', $user->id);
            } elseif ($request->assigned_to === 'unassigned') {
                $query->whereNull('assigned_to');
            } else {
                $query->where('assigned_to', $request->assigned_to);
            }
        }

        if ($request->has('priority')) {
            $query->where('priority', $request->priority);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('phone', 'like', "%{$search}%")
                    ->orWhere('contact_name', 'like', "%{$search}%")
                    ->orWhere('contact_push_name', 'like', "%{$search}%")
                    ->orWhere('subject', 'like', "%{$search}%");
            });
        }

        $conversations = $query->orderBy('last_message_at', 'desc')
            ->paginate($request->per_page ?? 20);

        return response($conversations, 200);
    }

    public function getMyConversations(Request $request): Response
    {
        [$user, $broker_resolved] = $this->resolveUserAndBroker($request);
        $broker = $broker_resolved;

        if (!$broker) {
            return response(['error' => 'Broker no encontrado'], 403);
        }

        $conversations = WhatsAppConversation::where('broker_id', $broker->id)
            ->where('assigned_to', $user->id)
            ->active()
            ->with(['department', 'instance'])
            ->withCount('messages')
            ->orderBy('last_message_at', 'desc')
            ->get();

        return response(['conversations' => $conversations], 200);
    }

    public function getConversation(WhatsAppConversation $conversation, Request $request): Response
    {
        [$user, $broker_resolved] = $this->resolveUserAndBroker($request);
        $broker = $broker_resolved;

        if (!$broker || $conversation->broker_id !== $broker->id) {
            return response(['error' => 'No autorizado'], 403);
        }

        $conversation->load(['department', 'assignedAgent', 'instance', 'notes.user', 'assignments.assignedTo']);

        return response(['conversation' => $conversation], 200);
    }

    public function getConversationMessages(WhatsAppConversation $conversation, Request $request): Response
    {
        [$user, $broker_resolved] = $this->resolveUserAndBroker($request);
        $broker = $broker_resolved;

        if (!$broker || $conversation->broker_id !== $broker->id) {
            return response(['error' => 'No autorizado'], 403);
        }

        $messages = $conversation->messages()
            ->with('sender')
            ->orderBy('created_at', 'asc')
            ->orderBy('id', 'asc')
            ->paginate($request->per_page ?? 50);

        // Marcar como leídos
        if ($request->boolean('mark_read', true)) {
            $conversation->markAsRead();
        }

        return response($messages, 200);
    }

    public function assignConversation(WhatsAppConversation $conversation, Request $request): Response
    {
        [$user, $broker_resolved] = $this->resolveUserAndBroker($request);
        $broker = $broker_resolved;

        if (!$broker || $conversation->broker_id !== $broker->id) {
            return response(['error' => 'No autorizado'], 403);
        }

        $validated = $request->validate([
            'user_id' => 'required|integer',
            'reason' => 'nullable|string',
        ]);

        // Si user_id es 0, asignar al usuario actual
        $agentId = $validated['user_id'] == 0 ? $user->id : $validated['user_id'];
        $agent = \App\Models\User::find($agentId);
        
        if (!$agent) {
            return response(['error' => 'Usuario no encontrado'], 404);
        }
        
        $conversation->assignTo($agent, $user, 'manual', $validated['reason'] ?? null);

        // Resetear triggers de chatbot que tienen reset_on_transfer = true
        if ($conversation->instance) {
            \App\Models\ChatbotTrigger::resetForContact(
                $conversation->instance->instance_id,
                $conversation->phone,
                true,  // onlyResetOnTransfer
                false  // onlyResetOnResolve
            );
        }

        // Emitir evento de asignación via Socket.IO
        $bridge = app(\App\Services\WhatsAppBridgeService::class);
        $bridge->emitSocketEvent('conversation_assigned', [
            'conversationId' => $conversation->id,
            'assignedTo' => $agent->id,
            'assignedToName' => $agent->name,
            'assignedBy' => $user->id,
            'assignedByName' => $user->name,
            'phone' => $conversation->phone,
            'contactName' => $conversation->contact_push_name ?? $conversation->contact_name ?? $conversation->phone,
        ]);

        return response([
            'message' => 'Conversación asignada',
            'conversation' => $conversation->fresh(['assignedAgent', 'department']),
        ], 200);
    }

    public function assignToDepartment(WhatsAppConversation $conversation, Request $request): Response
    {
        [$user, $broker_resolved] = $this->resolveUserAndBroker($request);
        $broker = $broker_resolved;

        if (!$broker || $conversation->broker_id !== $broker->id) {
            return response(['error' => 'No autorizado'], 403);
        }

        $validated = $request->validate([
            'department_id' => 'required|exists:whatsapp_departments,id',
            'auto_assign' => 'nullable|boolean',
            'reason' => 'nullable|string',
        ]);

        $department = WhatsAppDepartment::find($validated['department_id']);

        if ($validated['auto_assign'] ?? true) {
            $conversation->classifyAndAssign($department, $validated['reason'] ?? null);
        } else {
            $conversation->update([
                'department_id' => $department->id,
                'classification_reason' => $validated['reason'] ?? null,
            ]);
        }

        return response([
            'message' => 'Conversación asignada a departamento',
            'conversation' => $conversation->fresh(['assignedAgent', 'department']),
        ], 200);
    }

    public function sendMessage(WhatsAppConversation $conversation, Request $request): Response
    {
        [$user, $broker_resolved] = $this->resolveUserAndBroker($request);
        $broker = $broker_resolved;

        if (!$broker || $conversation->broker_id !== $broker->id) {
            return response(['error' => 'No autorizado'], 403);
        }

        $validated = $request->validate([
            'message' => 'required|string',
            'message_type' => 'nullable|in:text,image,document',
            'media_url' => 'nullable|url',
        ]);

        // Obtener instancia
        $instance = $conversation->instance;
        
        if (!$instance) {
            return response(['error' => 'Instancia de WhatsApp no encontrada'], 400);
        }

        try {
            // Usar WhatsAppBridgeService que detecta automáticamente Cloud API vs Baileys
            $bridge = app(\App\Services\WhatsAppBridgeService::class);
            
            $result = $bridge->sendMessage(
                $instance->instance_id,
                $conversation->phone,
                $validated['message']
            );

            if ($result['success']) {
                // Guardar mensaje en la conversación
                $message = $conversation->addMessage([
                    'message_id' => $result['messageId'] ?? null,
                    'direction' => 'outgoing',
                    'sender_type' => 'agent',
                    'sender_user_id' => $user->id,
                    'message_type' => $validated['message_type'] ?? 'text',
                    'content' => $validated['message'],
                    'status' => 'sent',
                ]);

                return response([
                    'message' => 'Mensaje enviado',
                    'data' => $message,
                ], 200);
            }

            return response([
                'error' => 'Error al enviar mensaje',
                'details' => $result['error'] ?? 'Error desconocido',
            ], 400);

        } catch (\Exception $e) {
            Log::error('Error enviando mensaje desde inbox', [
                'conversation_id' => $conversation->id,
                'error' => $e->getMessage(),
            ]);

            return response(['error' => 'Error de conexión: ' . $e->getMessage()], 500);
        }
    }

    public function sendMediaMessage(WhatsAppConversation $conversation, Request $request): Response
    {
        [$user, $broker_resolved] = $this->resolveUserAndBroker($request);
        $broker = $broker_resolved;

        if (!$broker || $conversation->broker_id !== $broker->id) {
            return response(['error' => 'No autorizado'], 403);
        }

        $request->validate([
            'file' => 'required|file|max:16384', // 16MB max
            'caption' => 'nullable|string|max:1024',
            'message_type' => 'required|in:image,video,audio,document',
        ]);

        $file = $request->file('file');
        $caption = $request->input('caption', '');
        $messageType = $request->input('message_type');

        // Obtener instancia
        $instance = $conversation->instance;
        
        if (!$instance) {
            return response(['error' => 'Instancia de WhatsApp no encontrada'], 400);
        }

        try {
            // Subir archivo a storage público
            $path = $file->store('whatsapp-media', 'public');
            
            // URL relativa para guardar en DB (el frontend la resuelve)
            $localRelativeUrl = '/storage/' . $path;
            
            // URL pública para enviar a Meta Cloud API
            $publicMediaUrl = rtrim(config('app.url') ?: env('APP_URL', ''), '/') . $localRelativeUrl;
            if (app()->environment('local', 'development', 'testing')) {
                $ngrokUrl = env('NGROK_URL', '');
                if ($ngrokUrl) {
                    $publicMediaUrl = rtrim($ngrokUrl, '/') . $localRelativeUrl;
                }
            }

            // Corregir mime_type para audio (PHP detecta .webm como video/webm)
            $mimeType = $file->getMimeType();
            if ($messageType === 'audio' && str_contains($mimeType, 'video/')) {
                $mimeType = str_replace('video/', 'audio/', $mimeType);
            }
            
            \Log::info('📤 [MEDIA] Enviando archivo multimedia via Cloud API', [
                'type' => $messageType,
                'path' => $path,
                'publicMediaUrl' => $publicMediaUrl,
                'localRelativeUrl' => $localRelativeUrl,
                'phone' => $conversation->phone,
                'mimeType' => $mimeType,
            ]);

            // Usar WhatsAppCloudApiService para enviar (con URL pública para Meta)
            $cloudApi = app(\App\Services\WhatsAppCloudApiService::class);
            
            $result = null;
            switch ($messageType) {
                case 'image':
                    $result = $cloudApi->sendImageMessage($instance, $conversation->phone, $publicMediaUrl, $caption ?: null);
                    break;
                case 'video':
                    $result = $cloudApi->sendVideo($instance, $conversation->phone, $publicMediaUrl, $caption ?: null);
                    break;
                case 'audio':
                    $result = $cloudApi->sendAudio($instance, $conversation->phone, $publicMediaUrl);
                    break;
                case 'document':
                    $result = $cloudApi->sendDocumentMessage($instance, $conversation->phone, $publicMediaUrl, $file->getClientOriginalName(), $caption ?: null);
                    break;
            }

            \Log::info('📤 [MEDIA] Resultado Cloud API', ['result' => $result]);

            $messageId = $result['message_id'] ?? ($result['messages'][0]['id'] ?? null);
            $success = ($result['success'] ?? false) || isset($result['messages']);

            if ($success) {
                // Guardar mensaje con URL relativa (el frontend la resuelve)
                $message = $conversation->addMessage([
                    'message_id' => $messageId,
                    'direction' => 'outgoing',
                    'sender_type' => 'agent',
                    'sender_user_id' => $user->id,
                    'message_type' => $messageType,
                    'content' => $caption ?: "[{$messageType}]",
                    'media' => [
                        'type' => $messageType,
                        'url' => $localRelativeUrl,
                        'filename' => $file->getClientOriginalName(),
                        'mime_type' => $mimeType,
                        'size' => $file->getSize(),
                    ],
                    'status' => 'sent',
                ]);

                return response([
                    'message' => 'Archivo enviado',
                    'data' => $message,
                ], 200);
            }

            return response([
                'error' => 'Error al enviar archivo via Cloud API',
                'details' => $result['error']['message'] ?? json_encode($result),
            ], 400);

        } catch (\Exception $e) {
            Log::error('Error enviando archivo multimedia desde inbox', [
                'conversation_id' => $conversation->id,
                'error' => $e->getMessage(),
            ]);

            return response(['error' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    public function resolveConversation(WhatsAppConversation $conversation, Request $request): Response
    {
        [$user, $broker_resolved] = $this->resolveUserAndBroker($request);
        $broker = $broker_resolved;

        if (!$broker || $conversation->broker_id !== $broker->id) {
            return response(['error' => 'No autorizado'], 403);
        }

        // Cerrar la conversación (status = closed) para que el chatbot pueda re-dispararse
        $conversation->update(['status' => 'closed', 'resolved_at' => now()]);

        // Resetear triggers de chatbot que tienen reset_on_resolve = true
        if ($conversation->instance) {
            \App\Models\ChatbotTrigger::resetForContact(
                $conversation->instance->instance_id,
                $conversation->phone,
                false, // onlyResetOnTransfer
                true   // onlyResetOnResolve
            );
            
            // Eliminar sesiones activas del chatbot para este contacto
            \App\Models\ChatbotSession::where('instance_id', $conversation->instance->instance_id)
                ->where('contact_phone', $conversation->phone)
                ->delete();
                
            // Limpiar logs de triggers para permitir re-disparo
            $chatbots = \App\Models\Chatbot::where('instance_id', $conversation->instance->instance_id)->pluck('id');
            $triggerIds = \App\Models\ChatbotTrigger::whereIn('chatbot_id', $chatbots)->pluck('id');
            \DB::table('chatbot_trigger_logs')
                ->whereIn('trigger_id', $triggerIds)
                ->where('contact_phone', $conversation->phone)
                ->delete();
        }

        return response([
            'message' => 'Conversación cerrada',
            'conversation' => $conversation->fresh(),
        ], 200);
    }

    public function updateConversation(WhatsAppConversation $conversation, Request $request): Response
    {
        [$user, $broker_resolved] = $this->resolveUserAndBroker($request);
        $broker = $broker_resolved;

        if (!$broker || $conversation->broker_id !== $broker->id) {
            return response(['error' => 'No autorizado'], 403);
        }

        $validated = $request->validate([
            'priority' => 'sometimes|in:low,medium,high,urgent',
            'subject' => 'nullable|string|max:255',
            'contact_name' => 'nullable|string|max:255',
            'tags' => 'nullable|array',
            'status' => 'sometimes|in:pending,assigned,in_progress,waiting_client,resolved,closed',
        ]);

        $conversation->update($validated);

        return response(['conversation' => $conversation->fresh()], 200);
    }

    // ==========================================
    // NOTAS
    // ==========================================

    public function addNote(WhatsAppConversation $conversation, Request $request): Response
    {
        [$user, $broker_resolved] = $this->resolveUserAndBroker($request);
        $broker = $broker_resolved;

        if (!$broker || $conversation->broker_id !== $broker->id) {
            return response(['error' => 'No autorizado'], 403);
        }

        $validated = $request->validate([
            'content' => 'required|string',
            'is_pinned' => 'nullable|boolean',
        ]);

        $note = $conversation->notes()->create([
            'user_id' => $user->id,
            'content' => $validated['content'],
            'is_pinned' => $validated['is_pinned'] ?? false,
        ]);

        return response(['note' => $note->load('user')], 201);
    }

    // ==========================================
    // RESPUESTAS RÁPIDAS
    // ==========================================

    public function getQuickReplies(Request $request): Response
    {
        [$user, $broker_resolved] = $this->resolveUserAndBroker($request);
        $broker = $broker_resolved;

        if (!$broker) {
            return response(['error' => 'Broker no encontrado'], 403);
        }

        $query = WhatsAppQuickReply::where('broker_id', $broker->id)
            ->where('is_active', true);

        if ($request->has('department_id')) {
            $query->where(function ($q) use ($request) {
                $q->where('department_id', $request->department_id)
                    ->orWhereNull('department_id');
            });
        }

        $replies = $query->orderBy('usage_count', 'desc')->get();

        return response(['quick_replies' => $replies], 200);
    }

    public function createQuickReply(Request $request): Response
    {
        [$user, $broker_resolved] = $this->resolveUserAndBroker($request);
        $broker = $broker_resolved;

        if (!$broker) {
            return response(['error' => 'Broker no encontrado'], 403);
        }

        $validated = $request->validate([
            'shortcut' => 'required|string|max:50',
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'department_id' => 'nullable|exists:whatsapp_departments,id',
        ]);

        $reply = WhatsAppQuickReply::create([
            'broker_id' => $broker->id,
            ...$validated,
        ]);

        return response(['quick_reply' => $reply], 201);
    }

    // ==========================================
    // ESTADÍSTICAS
    // ==========================================

    public function getStats(Request $request): Response
    {
        [$user, $broker_resolved] = $this->resolveUserAndBroker($request);
        $broker = $broker_resolved;

        if (!$broker) {
            return response(['error' => 'Broker no encontrado'], 403);
        }

        $stats = [
            'total_conversations' => WhatsAppConversation::where('broker_id', $broker->id)->count(),
            'pending' => WhatsAppConversation::where('broker_id', $broker->id)->where('status', 'pending')->count(),
            'in_progress' => WhatsAppConversation::where('broker_id', $broker->id)->where('status', 'in_progress')->count(),
            'resolved_today' => WhatsAppConversation::where('broker_id', $broker->id)
                ->where('status', 'resolved')
                ->whereDate('resolved_at', today())
                ->count(),
            'unassigned' => WhatsAppConversation::where('broker_id', $broker->id)
                ->whereNull('assigned_to')
                ->whereNotIn('status', ['closed', 'resolved'])
                ->count(),
            'my_conversations' => WhatsAppConversation::where('broker_id', $broker->id)
                ->where('assigned_to', $user->id)
                ->active()
                ->count(),
            'my_unread' => WhatsAppConversation::where('broker_id', $broker->id)
                ->where('assigned_to', $user->id)
                ->where('unread_count', '>', 0)
                ->count(),
        ];

        return response(['stats' => $stats], 200);
    }

    // ==========================================
    // CONTACTOS (Cloud API - Meta registered contacts)
    // ==========================================

    /**
     * Obtener lista de contactos únicos extraídos de conversaciones.
     * Cada contacto representa un número de teléfono único que ha interactuado
     * con la instancia de WhatsApp Cloud API.
     */
    public function getContacts(Request $request): Response
    {
        [$user, $broker_resolved] = $this->resolveUserAndBroker($request);
        $broker = $broker_resolved;

        if (!$broker) {
            return response(['error' => 'Broker no encontrado'], 403);
        }

        $search = $request->query('search');
        $perPage = min((int) $request->query('per_page', 25), 100);

        $query = WhatsAppConversation::where('broker_id', $broker->id)
            ->select([
                'phone',
                \DB::raw('MAX(id) as latest_conversation_id'),
                \DB::raw("MAX(contact_push_name) as contact_push_name"),
                \DB::raw("MAX(contact_first_name) as contact_first_name"),
                \DB::raw("MAX(contact_last_name) as contact_last_name"),
                \DB::raw("MAX(contact_email) as contact_email"),
                \DB::raw("MAX(contact_company) as contact_company"),
                \DB::raw("MAX(contact_city) as contact_city"),
                \DB::raw("MAX(contact_document_id) as contact_document_id"),
                \DB::raw("MAX(contact_notes) as contact_notes"),
                \DB::raw('COUNT(DISTINCT id) as total_conversations'),
                \DB::raw('SUM(message_count) as total_messages'),
                \DB::raw('MAX(last_message_at) as last_interaction_at'),
                \DB::raw('MIN(first_message_at) as first_interaction_at'),
                \DB::raw("SUM(CASE WHEN status NOT IN ('closed','resolved') THEN 1 ELSE 0 END) as open_conversations"),
            ])
            ->groupBy('phone');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('phone', 'LIKE', "%{$search}%")
                  ->orWhere('contact_push_name', 'LIKE', "%{$search}%")
                  ->orWhere('contact_first_name', 'LIKE', "%{$search}%")
                  ->orWhere('contact_last_name', 'LIKE', "%{$search}%")
                  ->orWhere('contact_email', 'LIKE', "%{$search}%")
                  ->orWhere('contact_company', 'LIKE', "%{$search}%");
            });
        }

        $contacts = $query->orderByDesc('last_interaction_at')
            ->paginate($perPage);

        // Enrich with 24h window status
        $contacts->getCollection()->transform(function ($contact) {
            $lastInteraction = $contact->last_interaction_at 
                ? \Carbon\Carbon::parse($contact->last_interaction_at) 
                : null;

            $contact->conversation_window_open = $lastInteraction 
                ? $lastInteraction->diffInHours(now()) < 24 
                : false;

            $contact->display_name = $contact->contact_first_name 
                ? trim("{$contact->contact_first_name} {$contact->contact_last_name}")
                : ($contact->contact_push_name ?: $contact->phone);

            return $contact;
        });

        // Summary stats
        $totalContacts = WhatsAppConversation::where('broker_id', $broker->id)
            ->distinct('phone')
            ->count('phone');

        $activeContacts = WhatsAppConversation::where('broker_id', $broker->id)
            ->where('last_message_at', '>=', now()->subHours(24))
            ->distinct('phone')
            ->count('phone');

        $newContactsThisMonth = WhatsAppConversation::where('broker_id', $broker->id)
            ->where('first_message_at', '>=', now()->startOfMonth())
            ->distinct('phone')
            ->count('phone');

        return response([
            'contacts' => $contacts->items(),
            'pagination' => [
                'current_page' => $contacts->currentPage(),
                'last_page' => $contacts->lastPage(),
                'per_page' => $contacts->perPage(),
                'total' => $contacts->total(),
            ],
            'stats' => [
                'total_contacts' => $totalContacts,
                'active_contacts_24h' => $activeContacts,
                'new_contacts_this_month' => $newContactsThisMonth,
            ],
        ], 200);
    }

    /**
     * Obtener detalle de un contacto específico por teléfono.
     */
    public function getContact(Request $request, string $phone): Response
    {
        [$user, $broker_resolved] = $this->resolveUserAndBroker($request);
        $broker = $broker_resolved;

        if (!$broker) {
            return response(['error' => 'Broker no encontrado'], 403);
        }

        $conversations = WhatsAppConversation::where('broker_id', $broker->id)
            ->where('phone', $phone)
            ->orderByDesc('last_message_at')
            ->get();

        if ($conversations->isEmpty()) {
            return response(['error' => 'Contacto no encontrado'], 404);
        }

        $latest = $conversations->first();

        $contact = [
            'phone' => $phone,
            'display_name' => $latest->contact_first_name 
                ? trim("{$latest->contact_first_name} {$latest->contact_last_name}")
                : ($latest->contact_push_name ?: $phone),
            'contact_push_name' => $latest->contact_push_name,
            'contact_first_name' => $latest->contact_first_name,
            'contact_last_name' => $latest->contact_last_name,
            'contact_email' => $latest->contact_email,
            'contact_company' => $latest->contact_company,
            'contact_city' => $latest->contact_city,
            'contact_document_id' => $latest->contact_document_id,
            'contact_notes' => $latest->contact_notes,
            'total_conversations' => $conversations->count(),
            'total_messages' => $conversations->sum('message_count'),
            'first_interaction_at' => $conversations->min('first_message_at'),
            'last_interaction_at' => $conversations->max('last_message_at'),
            'open_conversations' => $conversations->whereNotIn('status', ['closed', 'resolved'])->count(),
            'conversation_window_open' => $latest->last_message_at 
                ? \Carbon\Carbon::parse($latest->last_message_at)->diffInHours(now()) < 24 
                : false,
            'conversations' => $conversations->map(fn($c) => [
                'id' => $c->id,
                'status' => $c->status,
                'priority' => $c->priority,
                'message_count' => $c->message_count,
                'last_message_at' => $c->last_message_at,
                'created_at' => $c->created_at,
            ]),
        ];

        return response(['contact' => $contact], 200);
    }

    /**
     * Actualizar datos de contacto (actualiza la conversación más reciente).
     */
    public function updateContact(Request $request, string $phone): Response
    {
        [$user, $broker_resolved] = $this->resolveUserAndBroker($request);
        $broker = $broker_resolved;

        if (!$broker) {
            return response(['error' => 'Broker no encontrado'], 403);
        }

        $validated = $request->validate([
            'contact_first_name' => 'nullable|string|max:255',
            'contact_last_name' => 'nullable|string|max:255',
            'contact_email' => 'nullable|email|max:255',
            'contact_company' => 'nullable|string|max:255',
            'contact_city' => 'nullable|string|max:255',
            'contact_document_id' => 'nullable|string|max:50',
            'contact_notes' => 'nullable|string|max:2000',
        ]);

        // Update all conversations for this phone number
        $updated = WhatsAppConversation::where('broker_id', $broker->id)
            ->where('phone', $phone)
            ->update($validated);

        if (!$updated) {
            return response(['error' => 'Contacto no encontrado'], 404);
        }

        return response(['success' => true, 'message' => 'Contacto actualizado'], 200);
    }

    /**
     * Servir archivos multimedia con headers correctos para streaming (iOS AVFoundation)
     */
    public function serveMedia(string $filename)
    {
        $path = storage_path('app/public/whatsapp-media/' . $filename);
        
        if (!file_exists($path)) {
            return response(['error' => 'Archivo no encontrado'], 404);
        }

        $mimeTypes = [
            'webm' => 'audio/webm',
            'ogg' => 'audio/ogg',
            'm4a' => 'audio/mp4',
            'mp3' => 'audio/mpeg',
            'aac' => 'audio/aac',
            'mp4' => 'video/mp4',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png' => 'image/png',
            'gif' => 'image/gif',
            'pdf' => 'application/pdf',
            'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];

        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        $mime = $mimeTypes[$ext] ?? mime_content_type($path);
        $size = filesize($path);

        // Handle range requests (required for iOS AVFoundation audio/video playback)
        $headers = [
            'Content-Type' => $mime,
            'Accept-Ranges' => 'bytes',
            'Cache-Control' => 'public, max-age=86400',
            'Access-Control-Allow-Origin' => '*',
        ];

        if (request()->hasHeader('Range')) {
            $range = request()->header('Range');
            preg_match('/bytes=(\d+)-(\d*)/', $range, $matches);
            $start = intval($matches[1]);
            $end = !empty($matches[2]) ? intval($matches[2]) : $size - 1;
            $length = $end - $start + 1;

            $headers['Content-Range'] = "bytes {$start}-{$end}/{$size}";
            $headers['Content-Length'] = $length;

            $stream = fopen($path, 'rb');
            fseek($stream, $start);
            $data = fread($stream, $length);
            fclose($stream);

            return response($data, 206, $headers);
        }

        $headers['Content-Length'] = $size;
        return response()->file($path, $headers);
    }
}
