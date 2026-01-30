<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChatbotSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'chatbot_id',
        'contact_phone',
        'instance_id',
        'current_flow_id',
        'current_node_id',
        'variables',
        'status',
        'fallback_count',
        'conversation_history',
        'started_at',
        'last_activity_at',
        'expires_at',
    ];

    protected $casts = [
        'variables' => 'array',
        'conversation_history' => 'array',
        'started_at' => 'datetime',
        'last_activity_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    const STATUS_ACTIVE = 'active';
    const STATUS_WAITING_INPUT = 'waiting_input';
    const STATUS_TRANSFERRED = 'transferred';
    const STATUS_COMPLETED = 'completed';
    const STATUS_EXPIRED = 'expired';

    public function chatbot(): BelongsTo
    {
        return $this->belongsTo(Chatbot::class);
    }

    public function currentFlow(): BelongsTo
    {
        return $this->belongsTo(ChatbotFlow::class, 'current_flow_id');
    }

    public function currentNode(): BelongsTo
    {
        return $this->belongsTo(ChatbotNode::class, 'current_node_id');
    }

    public function scopeActive($query)
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    public function scopeForContact($query, string $phone, string $instanceId)
    {
        return $query->where('contact_phone', $phone)
                     ->where('instance_id', $instanceId);
    }

    public function isExpired(): bool
    {
        if ($this->expires_at && now()->gt($this->expires_at)) {
            return true;
        }
        
        $timeout = $this->chatbot->session_timeout_minutes ?? 30;
        return $this->last_activity_at->addMinutes($timeout)->lt(now());
    }

    public function setVariable(string $key, $value): void
    {
        $variables = $this->variables ?? [];
        $variables[$key] = $value;
        $this->variables = $variables;
        $this->save();
    }

    public function getVariable(string $key, $default = null)
    {
        return $this->variables[$key] ?? $default;
    }

    public function addToHistory(string $role, string $content): void
    {
        $history = $this->conversation_history ?? [];
        $history[] = [
            'role' => $role,
            'content' => $content,
            'timestamp' => now()->toIso8601String(),
        ];
        $this->conversation_history = $history;
        $this->last_activity_at = now();
        $this->save();
    }
}
