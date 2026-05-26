<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class WhatsAppConversation extends Model
{
    use HasFactory;

    protected $table = 'whatsapp_conversations';

    protected $fillable = [
        'broker_id',
        'whatsapp_instance_id',
        'department_id',
        'assigned_to',
        'client_id',
        'phone',
        'contact_name',
        'contact_push_name',
        'contact_first_name',
        'contact_last_name',
        'contact_document_id',
        'contact_email',
        'contact_phone_secondary',
        'contact_company',
        'contact_city',
        'contact_notes',
        'contact_custom_fields',
        'status',
        'priority',
        'subject',
        'classification_reason',
        'first_message_at',
        'last_message_at',
        'assigned_at',
        'first_response_at',
        'resolved_at',
        'unread_count',
        'message_count',
        'metadata',
        'tags',
        'client_reminder_sent_at',
        'agent_reminder_sent_at',
        'data_consent_at',
    ];

    protected $casts = [
        'first_message_at' => 'datetime',
        'last_message_at' => 'datetime',
        'assigned_at' => 'datetime',
        'first_response_at' => 'datetime',
        'resolved_at' => 'datetime',
        'client_reminder_sent_at' => 'datetime',
        'agent_reminder_sent_at' => 'datetime',
        'data_consent_at' => 'datetime',
        'metadata' => 'array',
        'tags' => 'array',
        'contact_custom_fields' => 'array',
    ];

    // Campos de contacto predefinidos para el chatbot
    const CONTACT_FIELDS = [
        'first_name' => ['label' => 'Nombre', 'column' => 'contact_first_name', 'validation' => 'not_empty'],
        'last_name' => ['label' => 'Apellido', 'column' => 'contact_last_name', 'validation' => 'not_empty'],
        'document_id' => ['label' => 'Cédula/DNI', 'column' => 'contact_document_id', 'validation' => 'not_empty'],
        'email' => ['label' => 'Correo electrónico', 'column' => 'contact_email', 'validation' => 'email'],
        'phone_secondary' => ['label' => 'Teléfono secundario', 'column' => 'contact_phone_secondary', 'validation' => 'phone'],
        'company' => ['label' => 'Empresa', 'column' => 'contact_company', 'validation' => null],
        'city' => ['label' => 'Ciudad', 'column' => 'contact_city', 'validation' => null],
        'notes' => ['label' => 'Notas', 'column' => 'contact_notes', 'validation' => null],
    ];

    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    public function instance(): BelongsTo
    {
        return $this->belongsTo(WhatsAppInstance::class, 'whatsapp_instance_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(WhatsAppDepartment::class, 'department_id');
    }

    public function assignedAgent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(WhatsAppConversationMessage::class, 'conversation_id');
    }

    public function latestMessage(): HasOne
    {
        return $this->hasOne(WhatsAppConversationMessage::class, 'conversation_id')->latestOfMany();
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(WhatsAppConversationAssignment::class, 'conversation_id');
    }

    public function notes(): HasMany
    {
        return $this->hasMany(WhatsAppConversationNote::class, 'conversation_id');
    }

    /**
     * Asignar conversación a un agente
     */
    public function assignTo(User $agent, ?User $assignedBy = null, string $type = 'manual', ?string $reason = null): void
    {
        $previousAgent = $this->assigned_to;

        $this->update([
            'assigned_to' => $agent->id,
            'assigned_at' => now(),
            'status' => 'assigned',
        ]);

        // Registrar asignación
        $this->assignments()->create([
            'assigned_from' => $assignedBy?->id ?? $previousAgent,
            'assigned_to' => $agent->id,
            'department_id' => $this->department_id,
            'assignment_type' => $type,
            'reason' => $reason,
        ]);

        // Actualizar contador del agente
        $member = WhatsAppDepartmentMember::where('user_id', $agent->id)
            ->where('department_id', $this->department_id)
            ->first();
        
        if ($member) {
            $member->incrementConversations();
        }

        // Decrementar del agente anterior
        if ($previousAgent) {
            $prevMember = WhatsAppDepartmentMember::where('user_id', $previousAgent)
                ->where('department_id', $this->department_id)
                ->first();
            
            if ($prevMember) {
                $prevMember->decrementConversations();
            }
        }
    }

    /**
     * Clasificar y asignar automáticamente
     */
    public function classifyAndAssign(WhatsAppDepartment $department, ?string $reason = null): void
    {
        $this->update([
            'department_id' => $department->id,
            'classification_reason' => $reason,
        ]);

        // Buscar agente disponible
        $agent = $department->getNextAvailableAgent();
        
        if ($agent) {
            $this->assignTo($agent, null, 'automatic', $reason);
        }
    }

    /**
     * Marcar como resuelta
     */
    public function resolve(): void
    {
        $this->update([
            'status' => 'resolved',
            'resolved_at' => now(),
        ]);

        // Decrementar contador del agente
        if ($this->assigned_to) {
            $member = WhatsAppDepartmentMember::where('user_id', $this->assigned_to)
                ->where('department_id', $this->department_id)
                ->first();
            
            if ($member) {
                $member->decrementConversations();
            }
        }
    }

    /**
     * Agregar mensaje a la conversación
     */
    public function addMessage(array $data): WhatsAppConversationMessage
    {
        $message = $this->messages()->create($data);

        $updates = [
            'last_message_at' => now(),
            'message_count' => $this->message_count + 1,
        ];

        if ($data['direction'] === 'incoming') {
            $updates['unread_count'] = $this->unread_count + 1;
            // Resetear flags de recordatorio cuando el cliente envía un nuevo mensaje
            $updates['client_reminder_sent_at'] = null;
            $updates['agent_reminder_sent_at'] = null;
            
            if (!$this->first_message_at) {
                $updates['first_message_at'] = now();
            }
        } elseif ($data['direction'] === 'outgoing' && $data['sender_type'] === 'agent') {
            if (!$this->first_response_at && $this->status !== 'pending') {
                $updates['first_response_at'] = now();
            }
            $updates['status'] = 'in_progress';
        }

        $this->update($updates);

        return $message;
    }

    /**
     * Marcar mensajes como leídos
     */
    public function markAsRead(): void
    {
        $this->messages()
            ->where('is_read', false)
            ->where('direction', 'incoming')
            ->update([
                'is_read' => true,
                'read_at' => now(),
            ]);

        $this->update(['unread_count' => 0]);
    }

    /**
     * Obtener o crear conversación por teléfono
     */
    public static function findOrCreateByPhone(int $brokerId, int $instanceId, string $phone, ?string $pushName = null): self
    {
        // Normalize phone: strip leading + to avoid duplicates (YCloud sends +57... Meta sends 57...)
        $phone = ltrim($phone, '+');

        // Buscar conversación abierta más reciente (priorizar in_progress sobre pending)
        $conversation = self::where('broker_id', $brokerId)
            ->where('whatsapp_instance_id', $instanceId)
            ->where('phone', $phone)
            ->whereNotIn('status', ['closed'])
            ->orderByRaw("CASE WHEN status = 'in_progress' THEN 0 WHEN status = 'assigned' THEN 1 ELSE 2 END")
            ->orderBy('last_message_at', 'desc')
            ->first();

        if (!$conversation) {
            $conversation = self::create([
                'broker_id' => $brokerId,
                'whatsapp_instance_id' => $instanceId,
                'phone' => $phone,
                'contact_push_name' => $pushName,
                'status' => 'pending',
                'first_message_at' => now(),
            ]);
        } elseif ($pushName && !$conversation->contact_push_name) {
            $conversation->update(['contact_push_name' => $pushName]);
        }

        return $conversation;
    }

    /**
     * Calcular estado de la ventana de conversación de 24h de Meta.
     * Según la política de Meta, solo se pueden enviar mensajes de texto libre
     * dentro de las 24h del último mensaje entrante del cliente.
     */
    public function getConversationWindow(): array
    {
        $instance = $this->instance;
        $connectionType = $instance->connection_type ?? 'baileys';

        // Baileys no tiene restricción de ventana 24h de Meta
        if ($connectionType === 'baileys') {
            return [
                'is_open' => true,
                'hours_remaining' => 24,
                'last_client_message_at' => null,
                'closes_at' => null,
                'connection_type' => 'baileys',
            ];
        }

        $lastIncoming = $this->messages()
            ->where('direction', 'incoming')
            ->orderBy('created_at', 'desc')
            ->first();

        if (!$lastIncoming) {
            return [
                'is_open' => false,
                'hours_remaining' => 0,
                'last_client_message_at' => null,
                'closes_at' => null,
                'connection_type' => $connectionType,
            ];
        }

        $lastTime = $lastIncoming->created_at;
        $closesAt = $lastTime->copy()->addHours(24);
        $now = now();
        $isOpen = $now->lt($closesAt);
        $hoursRemaining = $isOpen ? round($now->diffInMinutes($closesAt) / 60, 1) : 0;

        return [
            'is_open' => $isOpen,
            'hours_remaining' => $hoursRemaining,
            'last_client_message_at' => $lastTime->toIso8601String(),
            'closes_at' => $closesAt->toIso8601String(),
            'connection_type' => $connectionType,
        ];
    }

    /**
     * Scope para conversaciones pendientes
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    /**
     * Scope para conversaciones asignadas a un usuario
     */
    public function scopeAssignedTo($query, int $userId)
    {
        return $query->where('assigned_to', $userId);
    }

    /**
     * Scope para conversaciones activas (no cerradas)
     */
    public function scopeActive($query)
    {
        return $query->whereNotIn('status', ['closed', 'resolved']);
    }
}
