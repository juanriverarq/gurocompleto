<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChatbotTriggerLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'trigger_id',
        'chatbot_id',
        'instance_id',
        'contact_phone',
        'trigger_count',
        'first_triggered_at',
        'last_triggered_at',
        'next_available_at',
        'metadata',
    ];

    protected $casts = [
        'first_triggered_at' => 'datetime',
        'last_triggered_at' => 'datetime',
        'next_available_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function trigger(): BelongsTo
    {
        return $this->belongsTo(ChatbotTrigger::class, 'trigger_id');
    }

    public function chatbot(): BelongsTo
    {
        return $this->belongsTo(Chatbot::class);
    }

    /**
     * Verificar si el trigger puede ser disparado según el modo de re-disparo
     */
    public function canRetrigger(): bool
    {
        if (!$this->next_available_at) {
            return true;
        }
        return now()->gte($this->next_available_at);
    }

    /**
     * Registrar un nuevo disparo
     */
    public function recordTrigger(int $cooldownMinutes = null): void
    {
        $this->trigger_count++;
        $this->last_triggered_at = now();
        
        if ($cooldownMinutes) {
            $this->next_available_at = now()->addMinutes($cooldownMinutes);
        }
        
        $this->save();
    }

    /**
     * Resetear el log (para cuando se resuelve/transfiere la conversación)
     */
    public function reset(): void
    {
        $this->next_available_at = null;
        $this->save();
    }

    /**
     * Scope para buscar por contacto
     */
    public function scopeForContact($query, string $instanceId, string $phone)
    {
        return $query->where('instance_id', $instanceId)
                     ->where('contact_phone', $phone);
    }
}
