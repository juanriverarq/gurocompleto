<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;
use Carbon\Carbon;

class VoiceCampaignCall extends Model
{
    use HasFactory;

    protected $fillable = [
        'voice_campaign_id',
        'voice_campaign_execution_id',
        'broker_id',
        'recipient_phone',
        'recipient_name',
        'voice_message_content',
        'status',
        'call_initiated_at',
        'call_answered_at',
        'call_ended_at',
        'duration_seconds',
        'elevenlabs_conversation_id',
        'elevenlabs_call_id',
        'elevenlabs_agent_id',
        'elevenlabs_phone_number_id',
        'call_result',
        'call_transcript',
        'call_recording_url',
        'error_message',
        'retry_count',
        'call_metadata',
        // Campos ligeros persistidos
        'transcript_excerpt',
        'has_audio',
        'is_enriched',
        // Costos persistidos
        'elevenlabs_cost_usd',
        'elevenlabs_cost_cop',
        'elevenlabs_credits',
        'twilio_minutes',
        'twilio_cost_usd',
        'twilio_cost_cop',
        'total_cost_usd',
        'total_cost_cop',
        'total_cost_with_markup_usd',
        'total_cost_with_markup_cop'
    ];

    protected $casts = [
        'call_initiated_at' => 'datetime',
        'call_answered_at' => 'datetime',
        'call_ended_at' => 'datetime',
        'duration_seconds' => 'integer',
        'call_result' => 'json',
        'call_metadata' => 'json',
        'retry_count' => 'integer',
        'has_audio' => 'boolean',
        'is_enriched' => 'boolean',
        'elevenlabs_cost_usd' => 'float',
        'elevenlabs_cost_cop' => 'float',
        'elevenlabs_credits' => 'float',
        'twilio_minutes' => 'integer',
        'twilio_cost_usd' => 'float',
        'twilio_cost_cop' => 'float',
        'total_cost_usd' => 'float',
        'total_cost_cop' => 'float',
        'total_cost_with_markup_usd' => 'float',
        'total_cost_with_markup_cop' => 'float'
    ];

    // Estados de llamada
    const STATUS_PENDING = 'pending';
    const STATUS_INITIATED = 'initiated';
    const STATUS_RINGING = 'ringing';
    const STATUS_ANSWERED = 'answered';
    const STATUS_IN_PROGRESS = 'in_progress';
    const STATUS_COMPLETED = 'completed';
    const STATUS_FAILED = 'failed';
    const STATUS_NO_ANSWER = 'no_answer';
    const STATUS_BUSY = 'busy';
    const STATUS_CANCELLED = 'cancelled';

    // Resultados de llamada
    const RESULT_SUCCESS = 'success';
    const RESULT_NO_ANSWER = 'no_answer';
    const RESULT_BUSY = 'busy';
    const RESULT_INVALID_NUMBER = 'invalid_number';
    const RESULT_NETWORK_ERROR = 'network_error';
    const RESULT_API_ERROR = 'api_error';
    const RESULT_REJECTED = 'rejected';
    const RESULT_VOICEMAIL = 'voicemail';
    const RESULT_UNKNOWN = 'unknown';

    /**
     * Relación con la campaña de voz
     */
    public function voiceCampaign()
    {
        return $this->belongsTo(VoiceCampaign::class);
    }

    /**
     * Relación con la ejecución de campaña
     */
    public function execution()
    {
        return $this->belongsTo(VoiceCampaignExecution::class, 'voice_campaign_execution_id');
    }

    /**
     * Relación con el broker
     */
    public function broker()
    {
        return $this->belongsTo(Broker::class);
    }

    /**
     * Scope para filtrar por broker
     */
    public function scopeForBroker(Builder $query, int $brokerId): Builder
    {
        return $query->where('broker_id', $brokerId);
    }

    /**
     * Scope para llamadas completadas exitosamente
     */
    public function scopeSuccessful(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_COMPLETED)
                    ->whereJsonContains('call_result->result', self::RESULT_SUCCESS);
    }

    /**
     * Scope para llamadas fallidas
     */
    public function scopeFailed(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_FAILED);
    }

    /**
     * Scope para llamadas sin respuesta
     */
    public function scopeNoAnswer(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_NO_ANSWER);
    }

    /**
     * Scope para llamadas en progreso
     */
    public function scopeInProgress(Builder $query): Builder
    {
        return $query->whereIn('status', [
            self::STATUS_INITIATED,
            self::STATUS_RINGING,
            self::STATUS_ANSWERED,
            self::STATUS_IN_PROGRESS
        ]);
    }

    /**
     * Scope para llamadas por teléfono
     */
    public function scopeByPhone(Builder $query, string $phone): Builder
    {
        return $query->where('recipient_phone', $phone);
    }

    /**
     * Scope para llamadas recientes
     */
    public function scopeRecent(Builder $query, int $hours = 24): Builder
    {
        return $query->where('created_at', '>=', now()->subHours($hours));
    }

    /**
     * Scope para llamadas con duración mínima
     */
    public function scopeWithMinDuration(Builder $query, int $minSeconds): Builder
    {
        return $query->where('duration_seconds', '>=', $minSeconds);
    }

    /**
     * Verificar si existe una llamada para una campaña y teléfono específico
     */
    public static function existsForCampaignAndPhone(int $campaignId, string $phone): bool
    {
        return self::where('voice_campaign_id', $campaignId)
                   ->where('recipient_phone', $phone)
                   ->exists();
    }

    /**
     * Obtener la duración formateada de la llamada
     */
    public function getDurationFormattedAttribute(): string
    {
        if (!$this->duration_seconds) {
            return '0s';
        }

        return $this->formatDuration($this->duration_seconds);
    }

    /**
     * Obtener el tiempo transcurrido desde la iniciación
     */
    public function getTimeFromInitiationAttribute(): ?int
    {
        if (!$this->call_initiated_at) {
            return null;
        }

        $endTime = $this->call_ended_at ?: now();
        return $this->call_initiated_at->diffInSeconds($endTime);
    }

    /**
     * Obtener el tiempo de respuesta (ring time)
     */
    public function getRingTimeAttribute(): ?int
    {
        if (!$this->call_initiated_at || !$this->call_answered_at) {
            return null;
        }

        return $this->call_initiated_at->diffInSeconds($this->call_answered_at);
    }

    /**
     * Verificar si la llamada fue exitosa
     */
    public function isSuccessful(): bool
    {
        return $this->status === self::STATUS_COMPLETED && 
               isset($this->call_result['result']) && 
               $this->call_result['result'] === self::RESULT_SUCCESS;
    }

    /**
     * Verificar si la llamada falló
     */
    public function isFailed(): bool
    {
        return $this->status === self::STATUS_FAILED;
    }

    /**
     * Verificar si la llamada está en progreso
     */
    public function isInProgress(): bool
    {
        return in_array($this->status, [
            self::STATUS_INITIATED,
            self::STATUS_RINGING,
            self::STATUS_ANSWERED,
            self::STATUS_IN_PROGRESS
        ]);
    }

    /**
     * Verificar si la llamada puede reintentarse
     */
    public function canRetry(): bool
    {
        return $this->isFailed() && $this->retry_count < 3;
    }

    /**
     * Marcar llamada como iniciada
     */
    public function markAsInitiated(?string $elevenLabsCallId = null): void
    {
        $this->update([
            'status' => self::STATUS_INITIATED,
            'call_initiated_at' => now(),
            'elevenlabs_call_id' => $elevenLabsCallId
        ]);
    }

    /**
     * Marcar llamada como contestada
     */
    public function markAsAnswered(): void
    {
        $this->update([
            'status' => self::STATUS_ANSWERED,
            'call_answered_at' => now()
        ]);
    }

    /**
     * Marcar llamada como en progreso
     */
    public function markAsInProgress(): void
    {
        $this->update([
            'status' => self::STATUS_IN_PROGRESS
        ]);
    }

    /**
     * Marcar llamada como completada
     */
    public function markAsCompleted(array $result = [], int $durationSeconds = 0): void
    {
        $this->update([
            'status' => self::STATUS_COMPLETED,
            'call_ended_at' => now(),
            'duration_seconds' => $durationSeconds,
            'call_result' => array_merge(['result' => self::RESULT_SUCCESS], $result)
        ]);
    }

    /**
     * Marcar llamada como fallida
     */
    public function markAsFailed(string $reason, ?string $errorMessage = null): void
    {
        $this->update([
            'status' => self::STATUS_FAILED,
            'call_ended_at' => now(),
            'call_result' => ['result' => $reason],
            'error_message' => $errorMessage
        ]);
    }

    /**
     * Marcar llamada sin respuesta
     */
    public function markAsNoAnswer(): void
    {
        $this->update([
            'status' => self::STATUS_NO_ANSWER,
            'call_ended_at' => now(),
            'call_result' => ['result' => self::RESULT_NO_ANSWER]
        ]);
    }

    /**
     * Marcar llamada como ocupada
     */
    public function markAsBusy(): void
    {
        $this->update([
            'status' => self::STATUS_BUSY,
            'call_ended_at' => now(),
            'call_result' => ['result' => self::RESULT_BUSY]
        ]);
    }

    /**
     * Incrementar contador de reintentos
     */
    public function incrementRetryCount(): void
    {
        $this->increment('retry_count');
    }

    /**
     * Actualizar metadatos de la llamada
     */
    public function updateMetadata(array $metadata): void
    {
        $this->update([
            'call_metadata' => array_merge($this->call_metadata ?: [], $metadata)
        ]);
    }

    /**
     * Actualizar información de ElevenLabs/VAPI
     */
    public function updateElevenLabsInfo(array $info): void
    {
        $updateData = [];
        
        // VAPI devuelve 'id' directamente, ElevenLabs usa 'conversation_id'
        $conversationId = $info['conversation_id'] ?? $info['id'] ?? null;
        if ($conversationId) {
            $updateData['elevenlabs_conversation_id'] = $conversationId;
        }
        
        if (isset($info['call_id'])) {
            $updateData['elevenlabs_call_id'] = $info['call_id'];
        }
        
        if (isset($info['agent_id'])) {
            $updateData['elevenlabs_agent_id'] = $info['agent_id'];
        }
        
        if (isset($info['phone_number_id'])) {
            $updateData['elevenlabs_phone_number_id'] = $info['phone_number_id'];
        }

        if (!empty($updateData)) {
            $this->update($updateData);
        }
    }

    /**
     * Obtener estadísticas de la llamada
     */
    public function getStats(): array
    {
        $trm = (float) (env('COP_TRM_RATE', 4500));
        $elevenUsd = (float) ($this->elevenlabs_cost_usd ?? 0);
        $twilioUsd = (float) ($this->twilio_cost_usd ?? 0);
        $totalUsd = (float) ($this->total_cost_usd ?? ($elevenUsd + $twilioUsd));
        $totalWithMarkupUsd = (float) ($this->total_cost_with_markup_usd ?? $totalUsd);

        return [
            'id' => $this->id,
            'voice_campaign_id' => $this->voice_campaign_id,
            'execution_id' => $this->voice_campaign_execution_id,
            'recipient_phone' => $this->recipient_phone,
            'recipient_name' => $this->recipient_name,
            'agent_name' => $this->voiceCampaign?->agent_name ?? 'Agente IA',
            'agent_id' => $this->elevenlabs_agent_id,
            'status' => $this->status,
            'call_initiated_at' => $this->call_initiated_at,
            'call_answered_at' => $this->call_answered_at,
            'call_ended_at' => $this->call_ended_at,
            'duration_seconds' => $this->duration_seconds,
            'duration_formatted' => $this->duration_formatted,
            'ring_time' => $this->ring_time,
            'time_from_initiation' => $this->time_from_initiation,
            'call_result' => $this->call_result,
            'is_successful' => $this->isSuccessful(),
            'is_failed' => $this->isFailed(),
            'is_in_progress' => $this->isInProgress(),
            'can_retry' => $this->canRetry(),
            'retry_count' => $this->retry_count,
            'error_message' => $this->error_message,
            'elevenlabs_conversation_id' => $this->elevenlabs_conversation_id,
            'elevenlabs_call_id' => $this->elevenlabs_call_id,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            // Ligeros
            'transcript_excerpt' => $this->transcript_excerpt,
            'has_audio' => $this->has_audio,
            'is_enriched' => $this->is_enriched,
            // Costos persistidos
            'elevenlabs_cost_usd' => $this->elevenlabs_cost_usd,
            'elevenlabs_credits' => $this->elevenlabs_credits,
            'twilio_minutes' => $this->twilio_minutes,
            'twilio_cost_usd' => $this->twilio_cost_usd,
            'total_cost_usd' => $this->total_cost_usd,
            'total_cost_with_markup_usd' => $this->total_cost_with_markup_usd,
            // Conversión a COP (valores derivados, no persistidos)
            'cop_rate' => $trm,
            'elevenlabs_cost_cop' => round($elevenUsd * $trm, 2),
            'twilio_cost_cop' => round($twilioUsd * $trm, 2),
            'total_cost_cop' => round($totalUsd * $trm, 2),
            'total_cost_with_markup_cop' => round($totalWithMarkupUsd * $trm, 2),
        ];
    }

    /**
     * Formatear duración en segundos a formato legible
     */
    private function formatDuration(int $seconds): string
    {
        if ($seconds < 60) {
            return "{$seconds}s";
        } elseif ($seconds < 3600) {
            $minutes = floor($seconds / 60);
            $remainingSeconds = $seconds % 60;
            return "{$minutes}m {$remainingSeconds}s";
        } else {
            $hours = floor($seconds / 3600);
            $minutes = floor(($seconds % 3600) / 60);
            return "{$hours}h {$minutes}m";
        }
    }
}
