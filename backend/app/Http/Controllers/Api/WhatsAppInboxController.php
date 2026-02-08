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

class WhatsAppInboxController extends Controller
{
    // ==========================================
    // DEPARTAMENTOS
    // ==========================================

    public function getDepartments(Request $request): Response
    {
        $user = $request->user();
        $broker = $user->getPrimaryBroker();

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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();

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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();

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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();

        if (!$broker || $department->broker_id !== $broker->id) {
            return response(['error' => 'No autorizado'], 403);
        }

        $department->delete();

        return response(['message' => 'Departamento eliminado'], 200);
    }

    public function addMemberToDepartment(Request $request, WhatsAppDepartment $department): Response
    {
        $user = $request->user();
        $broker = $user->getPrimaryBroker();

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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();

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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();

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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();

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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();

        if (!$broker || $conversation->broker_id !== $broker->id) {
            return response(['error' => 'No autorizado'], 403);
        }

        $conversation->load(['department', 'assignedAgent', 'instance', 'notes.user', 'assignments.assignedTo']);

        return response(['conversation' => $conversation], 200);
    }

    public function getConversationMessages(WhatsAppConversation $conversation, Request $request): Response
    {
        $user = $request->user();
        $broker = $user->getPrimaryBroker();

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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();

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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();

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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();

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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();

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
            // Usar URL pública de ngrok para que WhatsApp pueda acceder al archivo
            // TODO: En producción, usar config('app.url') con un dominio público
            $ngrokUrl = env('NGROK_URL', 'https://hookless-kaylynn-greasily.ngrok-free.dev');
            $mediaUrl = rtrim($ngrokUrl, '/') . '/storage/' . $path;
            
            \Log::info('📤 [MEDIA] Enviando archivo multimedia', [
                'type' => $messageType,
                'path' => $path,
                'mediaUrl' => $mediaUrl,
                'phone' => $conversation->phone,
            ]);

            // Usar WhatsAppBridgeService para enviar
            $bridge = app(\App\Services\WhatsAppBridgeService::class);
            
            $result = null;
            \Log::info("📤 [MEDIA] Enviando {$messageType} a WhatsApp", [
                'instance_id' => $instance->instance_id,
                'phone' => $conversation->phone,
                'mediaUrl' => $mediaUrl,
            ]);
            
            switch ($messageType) {
                case 'image':
                    $result = $bridge->sendImage($instance->instance_id, $conversation->phone, $mediaUrl, $caption ?: null);
                    \Log::info('📤 [MEDIA] Resultado envío imagen', ['result' => $result]);
                    break;
                case 'video':
                    $result = $bridge->sendVideo($instance->instance_id, $conversation->phone, $mediaUrl, $caption ?: null);
                    break;
                case 'audio':
                    $result = $bridge->sendAudio($instance->instance_id, $conversation->phone, $mediaUrl);
                    break;
                case 'document':
                    $result = $bridge->sendDocument($instance->instance_id, $conversation->phone, $mediaUrl, $file->getClientOriginalName(), $caption ?: null);
                    break;
            }

            if ($result && $result['success']) {
                // Guardar mensaje en la conversación
                $message = $conversation->addMessage([
                    'message_id' => $result['messageId'] ?? null,
                    'direction' => 'outgoing',
                    'sender_type' => 'agent',
                    'sender_user_id' => $user->id,
                    'message_type' => $messageType,
                    'content' => $caption ?: "[{$messageType}]",
                    'media' => [
                        'type' => $messageType,
                        'url' => $mediaUrl,
                        'filename' => $file->getClientOriginalName(),
                        'mime_type' => $file->getMimeType(),
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
                'error' => 'Error al enviar archivo',
                'details' => $result['error'] ?? 'Error desconocido',
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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();

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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();

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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();

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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();

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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();

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
        $user = $request->user();
        $broker = $user->getPrimaryBroker();

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
}
