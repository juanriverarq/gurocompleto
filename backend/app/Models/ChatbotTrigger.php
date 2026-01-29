<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChatbotTrigger extends Model
{
    use HasFactory;

    protected $fillable = [
        'chatbot_id',
        'flow_id',
        'trigger_type',
        'trigger_value',
        'is_case_sensitive',
        'priority',
        'is_active',
        'conditions',
        'retrigger_mode',
        'cooldown_minutes',
        'schedule',
        'reset_on_transfer',
        'reset_on_resolve',
        'config',
    ];

    protected $casts = [
        'is_case_sensitive' => 'boolean',
        'is_active' => 'boolean',
        'conditions' => 'array',
        'schedule' => 'array',
        'reset_on_transfer' => 'boolean',
        'reset_on_resolve' => 'boolean',
        'config' => 'array',
    ];

    // Modos de re-disparo
    const RETRIGGER_ALWAYS = 'always';                    // Siempre dispara
    const RETRIGGER_SESSION_EXPIRED = 'session_expired';  // Solo si la sesión expiró
    const RETRIGGER_COOLDOWN = 'cooldown';                // Después de X minutos
    const RETRIGGER_ONCE_PER_DAY = 'once_per_day';        // Una vez al día
    const RETRIGGER_ONCE_EVER = 'once_ever';              // Solo una vez por contacto
    const RETRIGGER_MANUAL_RESET = 'manual_reset';        // Solo cuando se resetea manualmente

    const TYPE_KEYWORD = 'keyword';
    const TYPE_CONTAINS = 'contains';
    const TYPE_REGEX = 'regex';
    const TYPE_STARTS_WITH = 'starts_with';
    const TYPE_FIRST_MESSAGE = 'first_message';
    const TYPE_BUTTON_REPLY = 'button_reply';
    const TYPE_LIST_REPLY = 'list_reply';
    const TYPE_MEDIA = 'media';
    const TYPE_LOCATION = 'location';
    const TYPE_SCHEDULE = 'schedule';

    public function chatbot(): BelongsTo
    {
        return $this->belongsTo(Chatbot::class);
    }

    public function flow(): BelongsTo
    {
        return $this->belongsTo(ChatbotFlow::class, 'flow_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeByPriority($query)
    {
        return $query->orderBy('priority', 'desc');
    }

    public function logs(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(ChatbotTriggerLog::class, 'trigger_id');
    }

    /**
     * Verifica si el mensaje coincide con este trigger
     */
    public function matches(string $message): bool
    {
        $value = $this->trigger_value;
        $text = $this->is_case_sensitive ? $message : strtolower($message);
        $pattern = $this->is_case_sensitive ? $value : strtolower($value);

        return match ($this->trigger_type) {
            self::TYPE_KEYWORD => $text === $pattern,
            self::TYPE_CONTAINS => str_contains($text, $pattern),
            self::TYPE_STARTS_WITH => str_starts_with($text, $pattern),
            self::TYPE_REGEX => (bool) preg_match($value, $message),
            self::TYPE_FIRST_MESSAGE => true,
            default => false,
        };
    }

    /**
     * Verificar si el trigger puede ser disparado para un contacto
     */
    public function canTriggerFor(string $instanceId, string $phone): bool
    {
        // Verificar horario si está configurado
        if ($this->schedule && !$this->isWithinSchedule()) {
            return false;
        }

        // Obtener log de este trigger para el contacto
        $log = ChatbotTriggerLog::where('trigger_id', $this->id)
            ->where('instance_id', $instanceId)
            ->where('contact_phone', $phone)
            ->first();

        // Si no hay log, es la primera vez - permitir
        if (!$log) {
            return true;
        }

        // Verificar según modo de re-disparo
        return match ($this->retrigger_mode) {
            self::RETRIGGER_ALWAYS => true,
            self::RETRIGGER_SESSION_EXPIRED => true, // La sesión se verifica en otro lugar
            self::RETRIGGER_COOLDOWN => $log->canRetrigger(),
            self::RETRIGGER_ONCE_PER_DAY => !$log->last_triggered_at || !$log->last_triggered_at->isToday(),
            self::RETRIGGER_ONCE_EVER => false,
            self::RETRIGGER_MANUAL_RESET => $log->canRetrigger(),
            default => true,
        };
    }

    /**
     * Verificar si estamos dentro del horario configurado
     */
    public function isWithinSchedule(): bool
    {
        if (!$this->schedule) {
            return true;
        }

        $now = now();
        $schedule = $this->schedule;

        // Verificar día de la semana (1=Lunes, 7=Domingo)
        if (isset($schedule['days']) && !in_array($now->dayOfWeekIso, $schedule['days'])) {
            return false;
        }

        // Verificar hora
        if (isset($schedule['start']) && isset($schedule['end'])) {
            $currentTime = $now->format('H:i');
            if ($currentTime < $schedule['start'] || $currentTime > $schedule['end']) {
                return false;
            }
        }

        return true;
    }

    /**
     * Registrar que el trigger fue disparado
     */
    public function recordTrigger(string $instanceId, string $phone): ChatbotTriggerLog
    {
        $log = ChatbotTriggerLog::firstOrCreate(
            [
                'trigger_id' => $this->id,
                'instance_id' => $instanceId,
                'contact_phone' => $phone,
            ],
            [
                'chatbot_id' => $this->chatbot_id,
                'first_triggered_at' => now(),
                'trigger_count' => 0,
            ]
        );

        $log->recordTrigger($this->cooldown_minutes);

        return $log;
    }

    /**
     * Resetear el estado del trigger para un contacto
     */
    public static function resetForContact(string $instanceId, string $phone, bool $onlyResetOnTransfer = false, bool $onlyResetOnResolve = false): void
    {
        $query = ChatbotTriggerLog::where('instance_id', $instanceId)
            ->where('contact_phone', $phone);

        if ($onlyResetOnTransfer) {
            $query->whereHas('trigger', fn($q) => $q->where('reset_on_transfer', true));
        }

        if ($onlyResetOnResolve) {
            $query->whereHas('trigger', fn($q) => $q->where('reset_on_resolve', true));
        }

        $query->update(['next_available_at' => null]);
    }
}
