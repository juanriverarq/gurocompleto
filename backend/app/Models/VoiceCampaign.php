<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Builder;
use Carbon\Carbon;

class VoiceCampaign extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'broker_id',
        'name',
        'description',
        'campaign_type',
        'voice_message_template',
        'contacts',
        'status',
        'is_active',
        'scheduled_date',
        'total_targets',
        'calls_made',
        'calls_successful',
        'calls_failed',
        'total_duration_seconds',
        'average_duration_seconds',
        'last_execution',
        'next_execution',
        'trigger_conditions',
        'schedule_config',
        'target_filters',
        'elevenlabs_agent_id',
        'elevenlabs_phone_number_id',
        'elevenlabs_voice_id',
        'agent_name',
        'voice_settings',
        'settings',
        'created_by'
    ];

    protected $casts = [
        'contacts' => 'json',
        'is_active' => 'boolean',
        'scheduled_date' => 'datetime',
        'last_execution' => 'datetime',
        'next_execution' => 'datetime',
        'trigger_conditions' => 'json',
        'schedule_config' => 'json',
        'target_filters' => 'json',
        'voice_settings' => 'json',
        'settings' => 'json',
        'total_duration_seconds' => 'integer',
        'average_duration_seconds' => 'integer',
        'calls_made' => 'integer',
        'calls_successful' => 'integer',
        'calls_failed' => 'integer'
    ];

    // Estados de campaña
    const STATUS_DRAFT = 'draft';
    const STATUS_SCHEDULED = 'scheduled';
    const STATUS_ACTIVE = 'active';
    const STATUS_RUNNING = 'running';
    const STATUS_PAUSED = 'paused';
    const STATUS_COMPLETED = 'completed';
    const STATUS_FAILED = 'failed';
    const STATUS_CANCELLED = 'cancelled';

    // Tipos de campaña
    const TYPE_IMMEDIATE = 'immediate';
    const TYPE_SCHEDULED = 'scheduled';
    const TYPE_POLICY_REMINDER = 'policy_reminder';
    const TYPE_EXPIRED_POLICY = 'expired_policy';
    const TYPE_ABOUT_TO_EXPIRE = 'about_to_expire';
    const TYPE_FOLLOW_UP = 'follow_up';
    const TYPE_SURVEY = 'survey';

    /**
     * Relación con el broker
     */
    public function broker()
    {
        return $this->belongsTo(Broker::class);
    }

    /**
     * Relación con las ejecuciones de la campaña
     */
    public function executions()
    {
        return $this->hasMany(VoiceCampaignExecution::class);
    }

    /**
     * Relación con las llamadas de la campaña
     */
    public function calls()
    {
        return $this->hasMany(VoiceCampaignCall::class);
    }

    /**
     * Relación con el usuario creador
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Scope para filtrar por broker
     */
    public function scopeForBroker(Builder $query, int $brokerId): Builder
    {
        return $query->where('broker_id', $brokerId);
    }

    /**
     * Scope para filtrar por tipo
     */
    public function scopeOfType(Builder $query, string $type): Builder
    {
        return $query->where('campaign_type', $type);
    }

    /**
     * Scope para filtrar por estado
     */
    public function scopeWithStatus(Builder $query, string $status): Builder
    {
        return $query->where('status', $status);
    }

    /**
     * Scope para campañas activas
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope para campañas programadas que deben ejecutarse
     */
    public function scopeScheduledToRun(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_SCHEDULED)
                    ->where('scheduled_date', '<=', now())
                    ->where('is_active', true);
    }

    /**
     * Scope para campañas recientes (últimos 30 días)
     */
    public function scopeRecent(Builder $query): Builder
    {
        return $query->where('created_at', '>=', now()->subDays(30));
    }

    /**
     * Obtener la tasa de éxito de la campaña
     */
    public function getSuccessRateAttribute(): float
    {
        $callsMade = (int) ($this->calls_made ?? 0);
        $callsSuccessful = (int) ($this->calls_successful ?? 0);
        
        if ($callsMade === 0 || $callsMade <= 0) {
            return 0.0;
        }

        return round(($callsSuccessful / $callsMade) * 100, 2);
    }

    /**
     * Obtener el progreso de la campaña como porcentaje
     */
    public function getProgressPercentageAttribute(): float
    {
        $totalTargets = (int) ($this->total_targets ?? 0);
        $callsMade = (int) ($this->calls_made ?? 0);
        
        if ($totalTargets === 0 || $totalTargets <= 0) {
            return 0.0;
        }

        return round(($callsMade / $totalTargets) * 100, 2);
    }

    /**
     * Verificar si la campaña puede ser ejecutada
     */
    public function canBeExecuted(): bool
    {
        // Permitir ejecutar si el estado es válido, sin requerir is_active previamente
        return in_array($this->status, [
            self::STATUS_DRAFT,
            self::STATUS_SCHEDULED,
            self::STATUS_PAUSED
        ]);
    }

    /**
     * Verificar si la campaña está en progreso
     */
    public function isInProgress(): bool
    {
        return in_array($this->status, [
            self::STATUS_ACTIVE,
            self::STATUS_RUNNING
        ]);
    }

    /**
     * Verificar si la campaña está completada
     */
    public function isCompleted(): bool
    {
        return $this->status === self::STATUS_COMPLETED;
    }

    /**
     * Verificar si la campaña puede ser editada
     */
    public function canBeEdited(): bool
    {
        return !in_array($this->status, [
            self::STATUS_RUNNING,
            self::STATUS_COMPLETED,
            self::STATUS_CANCELLED
        ]);
    }

    /**
     * Marcar campaña como iniciada
     */
    public function markAsStarted(): void
    {
        $this->update([
            'status' => self::STATUS_RUNNING,
            'is_active' => true,
            'last_execution' => now()
        ]);
    }

    /**
     * Marcar campaña como completada
     */
    public function markAsCompleted(): void
    {
        $this->update([
            'status' => self::STATUS_COMPLETED,
            'is_active' => false,
            'last_execution' => now()
        ]);
    }

    /**
     * Marcar campaña como fallida
     */
    public function markAsFailed(string $reason = null): void
    {
        $this->update([
            'status' => self::STATUS_FAILED,
            'is_active' => false,
            'last_execution' => now()
        ]);
    }

    /**
     * Actualizar contadores de llamadas
     */
    public function updateCallCounters(): void
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
     * Obtener la próxima fecha de ejecución programada
     */
    public function getNextScheduledExecution(): ?Carbon
    {
        if ($this->campaign_type === self::TYPE_SCHEDULED && $this->scheduled_date) {
            return $this->scheduled_date->isFuture() ? $this->scheduled_date : null;
        }

        return $this->next_execution;
    }

    /**
     * Generar estadísticas de la campaña
     */
    public function getStats(): array
    {
        // Agregados de costos a partir de las llamadas asociadas
        $callsQuery = $this->calls();
        $sumElevenUsd = (float) $callsQuery->sum('elevenlabs_cost_usd');
        $sumTwilioUsd = (float) $callsQuery->sum('twilio_cost_usd');
        $sumTotalUsd = (float) $callsQuery->sum('total_cost_usd');
        $sumTotalWithMarkupUsd = (float) $callsQuery->sum('total_cost_with_markup_usd');

        $trm = (float) env('COP_TRM_RATE', 4500);
        $sumElevenCop = round($sumElevenUsd * $trm, 2);
        $sumTwilioCop = round($sumTwilioUsd * $trm, 2);
        $sumTotalCop = round($sumTotalUsd * $trm, 2);
        $sumTotalWithMarkupCop = round($sumTotalWithMarkupUsd * $trm, 2);

        return [
            'total_targets' => $this->total_targets,
            'calls_made' => $this->calls_made,
            'calls_successful' => $this->calls_successful,
            'calls_failed' => $this->calls_failed,
            'success_rate' => $this->success_rate,
            'progress_percentage' => $this->progress_percentage,
            'total_duration_seconds' => $this->total_duration_seconds,
            'average_duration_seconds' => $this->average_duration_seconds,
            'average_duration_formatted' => $this->formatDuration($this->average_duration_seconds),
            'total_duration_formatted' => $this->formatDuration($this->total_duration_seconds),
            // Costos agregados de la campaña
            'costs' => [
                'elevenlabs' => [
                    'usd' => round($sumElevenUsd, 4),
                    'cop' => $sumElevenCop,
                ],
                'twilio' => [
                    'usd' => round($sumTwilioUsd, 4),
                    'cop' => $sumTwilioCop,
                    'minutes' => (int) $callsQuery->sum('twilio_minutes'),
                ],
                'total' => [
                    'usd' => round($sumTotalUsd, 4),
                    'cop' => $sumTotalCop,
                ],
                'total_with_markup' => [
                    'usd' => round($sumTotalWithMarkupUsd, 4),
                    'cop' => $sumTotalWithMarkupCop,
                ],
                'cop_rate' => $trm,
            ],
            'status' => $this->status,
            'is_active' => $this->is_active,
            'created_at' => $this->created_at,
            'last_execution' => $this->last_execution,
            'next_execution' => $this->getNextScheduledExecution()
        ];
    }

    /**
     * Formatear duración en segundos a formato legible
     */
    private function formatDuration(?int $seconds): string
    {
        if ($seconds === null || $seconds === 0) {
            return '0s';
        }
        
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
