<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class VoiceCampaignExecution extends Model
{
    use HasFactory;

    protected $fillable = [
        'voice_campaign_id',
        'broker_id',
        'execution_date',
        'status',
        'started_at',
        'completed_at',
        'targets_found',
        'calls_made',
        'calls_successful',
        'calls_failed',
        'total_duration_seconds',
        'average_duration_seconds',
        'error_message',
        'execution_details',
        'elevenlabs_agent_id_used',
        'elevenlabs_phone_number_id_used'
    ];

    protected $casts = [
        'execution_date' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'execution_details' => 'json',
        'targets_found' => 'integer',
        'calls_made' => 'integer',
        'calls_successful' => 'integer',
        'calls_failed' => 'integer',
        'total_duration_seconds' => 'integer',
        'average_duration_seconds' => 'integer'
    ];

    // Estados de ejecución
    const STATUS_PENDING = 'pending';
    const STATUS_RUNNING = 'running';
    const STATUS_COMPLETED = 'completed';
    const STATUS_FAILED = 'failed';
    const STATUS_CANCELLED = 'cancelled';
    const STATUS_SCHEDULED = 'scheduled';

    /**
     * Relación con la campaña de voz
     */
    public function voiceCampaign()
    {
        return $this->belongsTo(VoiceCampaign::class);
    }

    /**
     * Relación con el broker
     */
    public function broker()
    {
        return $this->belongsTo(Broker::class);
    }

    /**
     * Relación con las llamadas de esta ejecución
     */
    public function calls()
    {
        return $this->hasMany(VoiceCampaignCall::class);
    }

    /**
     * Scope para filtrar por broker
     */
    public function scopeForBroker(Builder $query, int $brokerId): Builder
    {
        return $query->where('broker_id', $brokerId);
    }

    /**
     * Scope para ejecuciones completadas
     */
    public function scopeCompleted(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_COMPLETED);
    }

    /**
     * Scope para ejecuciones en progreso
     */
    public function scopeInProgress(Builder $query): Builder
    {
        return $query->whereIn('status', [self::STATUS_PENDING, self::STATUS_RUNNING]);
    }

    /**
     * Scope para ejecuciones fallidas
     */
    public function scopeFailed(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_FAILED);
    }

    /**
     * Scope para ejecuciones recientes
     */
    public function scopeRecent(Builder $query, int $days = 7): Builder
    {
        return $query->where('execution_date', '>=', now()->subDays($days));
    }

    /**
     * Obtener la tasa de éxito de la ejecución
     */
    public function getSuccessRateAttribute(): float
    {
        if ($this->calls_made === 0) {
            return 0.0;
        }

        return round(($this->calls_successful / $this->calls_made) * 100, 2);
    }

    /**
     * Obtener la duración total formateada
     */
    public function getTotalDurationFormattedAttribute(): string
    {
        return $this->formatDuration($this->total_duration_seconds);
    }

    /**
     * Obtener la duración promedio formateada
     */
    public function getAverageDurationFormattedAttribute(): string
    {
        return $this->formatDuration($this->average_duration_seconds);
    }

    /**
     * Obtener el tiempo total de ejecución
     */
    public function getExecutionTimeAttribute(): ?int
    {
        if (!$this->started_at || !$this->completed_at) {
            return null;
        }

        return $this->completed_at->diffInSeconds($this->started_at);
    }

    /**
     * Obtener el tiempo de ejecución formateado
     */
    public function getExecutionTimeFormattedAttribute(): ?string
    {
        $executionTime = $this->execution_time;
        return $executionTime ? $this->formatDuration($executionTime) : null;
    }

    /**
     * Verificar si la ejecución está en progreso
     */
    public function isInProgress(): bool
    {
        return in_array($this->status, [self::STATUS_PENDING, self::STATUS_RUNNING]);
    }

    /**
     * Verificar si la ejecución está completada
     */
    public function isCompleted(): bool
    {
        return $this->status === self::STATUS_COMPLETED;
    }

    /**
     * Verificar si la ejecución falló
     */
    public function isFailed(): bool
    {
        return $this->status === self::STATUS_FAILED;
    }

    /**
     * Marcar ejecución como iniciada
     */
    public function markAsStarted(): void
    {
        $this->update([
            'status' => self::STATUS_RUNNING,
            'started_at' => now()
        ]);
    }

    /**
     * Marcar ejecución como completada
     */
    public function markAsCompleted(): void
    {
        $this->update([
            'status' => self::STATUS_COMPLETED,
            'completed_at' => now()
        ]);

        // Actualizar contadores
        $this->updateCounters();
    }

    /**
     * Marcar ejecución como fallida
     */
    public function markAsFailed(string $errorMessage = null): void
    {
        $this->update([
            'status' => self::STATUS_FAILED,
            'completed_at' => now(),
            'error_message' => $errorMessage
        ]);
    }

    /**
     * Actualizar contadores de la ejecución
     */
    public function updateCounters(): void
    {
        $calls = $this->calls();
        
        $this->update([
            'calls_made' => $calls->count(),
            'calls_successful' => $calls->where('status', VoiceCampaignCall::STATUS_COMPLETED)->count(),
            'calls_failed' => $calls->where('status', VoiceCampaignCall::STATUS_FAILED)->count(),
            'total_duration_seconds' => $calls->sum('duration_seconds'),
            'average_duration_seconds' => $calls->avg('duration_seconds') ?: 0
        ]);
    }

    /**
     * Obtener estadísticas de la ejecución
     */
    public function getStats(): array
    {
        return [
            'id' => $this->id,
            'voice_campaign_id' => $this->voice_campaign_id,
            'execution_date' => $this->execution_date,
            'status' => $this->status,
            'started_at' => $this->started_at,
            'completed_at' => $this->completed_at,
            'execution_time' => $this->execution_time,
            'execution_time_formatted' => $this->execution_time_formatted,
            'targets_found' => $this->targets_found,
            'calls_made' => $this->calls_made,
            'calls_successful' => $this->calls_successful,
            'calls_failed' => $this->calls_failed,
            'success_rate' => $this->success_rate,
            'total_duration_seconds' => $this->total_duration_seconds,
            'total_duration_formatted' => $this->total_duration_formatted,
            'average_duration_seconds' => $this->average_duration_seconds,
            'average_duration_formatted' => $this->average_duration_formatted,
            'error_message' => $this->error_message,
            'elevenlabs_agent_id_used' => $this->elevenlabs_agent_id_used,
            'elevenlabs_phone_number_id_used' => $this->elevenlabs_phone_number_id_used
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
