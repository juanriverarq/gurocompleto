<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;
use Carbon\Carbon;

class VoiceCampaignScheduledCall extends Model
{
    use HasFactory;

    protected $table = 'voice_campaign_scheduled_calls';

    const STATUS_PENDING = 'pending';
    const STATUS_QUEUED = 'queued';
    const STATUS_CALLED = 'called';
    const STATUS_COMPLETED = 'completed';
    const STATUS_SKIPPED = 'skipped';
    const STATUS_FAILED = 'failed';
    const STATUS_CANCELLED = 'cancelled';

    // Razones de programación
    const REASON_PAYMENT_DUE_7_DAYS = 'payment_due_7_days';
    const REASON_PAYMENT_DUE_3_DAYS = 'payment_due_3_days';
    const REASON_PAYMENT_DUE_1_DAY = 'payment_due_1_day';
    const REASON_PAYMENT_DUE_TODAY = 'payment_due_today';
    const REASON_PAYMENT_OVERDUE_1_DAY = 'payment_overdue_1_day';
    const REASON_PAYMENT_OVERDUE_3_DAYS = 'payment_overdue_3_days';
    const REASON_PAYMENT_OVERDUE_7_DAYS = 'payment_overdue_7_days';
    const REASON_POLICY_EXPIRY = 'policy_expiry';
    const REASON_NEW_CLIENT = 'new_client';
    const REASON_NEW_POLICY = 'new_policy';
    const REASON_MANUAL = 'manual';

    protected $fillable = [
        'voice_campaign_id',
        'broker_id',
        'client_id',
        'poliza_id',
        'scheduled_date',
        'scheduled_time',
        'reason',
        'status',
        'status_reason',
        'contact_data',
        'queued_at',
        'called_at',
        'voice_campaign_call_id',
        'priority',
        'retry_count',
        'max_retries',
    ];

    protected $casts = [
        'scheduled_date' => 'date',
        'scheduled_time' => 'datetime:H:i:s',
        'contact_data' => 'json',
        'queued_at' => 'datetime',
        'called_at' => 'datetime',
        'priority' => 'integer',
        'retry_count' => 'integer',
        'max_retries' => 'integer',
    ];

    // ==================== RELACIONES ====================

    public function campaign()
    {
        return $this->belongsTo(VoiceCampaign::class, 'voice_campaign_id');
    }

    public function broker()
    {
        return $this->belongsTo(Broker::class);
    }

    public function client()
    {
        return $this->belongsTo(Cliente::class, 'client_id');
    }

    public function poliza()
    {
        return $this->belongsTo(Poliza::class, 'poliza_id');
    }

    public function call()
    {
        return $this->belongsTo(VoiceCampaignCall::class, 'voice_campaign_call_id');
    }

    // ==================== SCOPES ====================

    public function scopeForBroker(Builder $query, int $brokerId): Builder
    {
        return $query->where('broker_id', $brokerId);
    }

    public function scopeForCampaign(Builder $query, int $campaignId): Builder
    {
        return $query->where('voice_campaign_id', $campaignId);
    }

    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    public function scopeScheduledForToday(Builder $query): Builder
    {
        return $query->whereDate('scheduled_date', today());
    }

    public function scopeScheduledForDate(Builder $query, $date): Builder
    {
        return $query->whereDate('scheduled_date', $date);
    }

    public function scopeReadyToCall(Builder $query): Builder
    {
        return $query
            ->where('status', self::STATUS_PENDING)
            ->whereDate('scheduled_date', '<=', today())
            ->orderBy('priority', 'asc')
            ->orderBy('scheduled_date', 'asc')
            ->orderBy('scheduled_time', 'asc');
    }

    // ==================== MÉTODOS ====================

    /**
     * Marca como en cola para llamar
     */
    public function markAsQueued(): void
    {
        $this->update([
            'status' => self::STATUS_QUEUED,
            'queued_at' => now(),
        ]);
    }

    /**
     * Marca como llamada realizada
     */
    public function markAsCalled(int $callId): void
    {
        $this->update([
            'status' => self::STATUS_CALLED,
            'called_at' => now(),
            'voice_campaign_call_id' => $callId,
        ]);
    }

    /**
     * Marca como completada exitosamente
     */
    public function markAsCompleted(): void
    {
        $this->update([
            'status' => self::STATUS_COMPLETED,
        ]);
    }

    /**
     * Marca como omitida
     */
    public function markAsSkipped(string $reason): void
    {
        $this->update([
            'status' => self::STATUS_SKIPPED,
            'status_reason' => $reason,
        ]);
    }

    /**
     * Marca como fallida (puede reintentar)
     */
    public function markAsFailed(string $reason): void
    {
        $this->increment('retry_count');
        
        if ($this->retry_count >= $this->max_retries) {
            $this->update([
                'status' => self::STATUS_FAILED,
                'status_reason' => $reason,
            ]);
        } else {
            // Reprogramar para mañana
            $this->update([
                'status' => self::STATUS_PENDING,
                'status_reason' => "Reintento {$this->retry_count}: {$reason}",
                'scheduled_date' => now()->addDay()->toDateString(),
            ]);
        }
    }

    /**
     * Obtiene el nombre del cliente para mostrar
     */
    public function getClientNameAttribute(): string
    {
        if ($this->contact_data && isset($this->contact_data['name'])) {
            return $this->contact_data['name'];
        }
        
        if ($this->client) {
            return trim("{$this->client->first_name} {$this->client->last_name}");
        }
        
        return 'Cliente desconocido';
    }

    /**
     * Obtiene el teléfono del cliente
     */
    public function getClientPhoneAttribute(): ?string
    {
        if ($this->contact_data && isset($this->contact_data['phone'])) {
            return $this->contact_data['phone'];
        }
        
        return $this->client?->mobile_phone;
    }

    /**
     * Descripción legible de la razón
     */
    public function getReasonDescriptionAttribute(): string
    {
        return match($this->reason) {
            self::REASON_PAYMENT_DUE_7_DAYS => 'Pago vence en 7 días',
            self::REASON_PAYMENT_DUE_3_DAYS => 'Pago vence en 3 días',
            self::REASON_PAYMENT_DUE_1_DAY => 'Pago vence mañana',
            self::REASON_PAYMENT_DUE_TODAY => 'Pago vence hoy',
            self::REASON_PAYMENT_OVERDUE_1_DAY => 'Pago vencido hace 1 día',
            self::REASON_PAYMENT_OVERDUE_3_DAYS => 'Pago vencido hace 3 días',
            self::REASON_PAYMENT_OVERDUE_7_DAYS => 'Pago vencido hace 7 días',
            self::REASON_POLICY_EXPIRY => 'Vencimiento de póliza',
            self::REASON_NEW_CLIENT => 'Nuevo cliente',
            self::REASON_NEW_POLICY => 'Nueva póliza',
            self::REASON_MANUAL => 'Programación manual',
            default => $this->reason ?? 'Sin especificar',
        };
    }

    /**
     * Descripción legible del estado
     */
    public function getStatusDescriptionAttribute(): string
    {
        return match($this->status) {
            self::STATUS_PENDING => 'Pendiente',
            self::STATUS_QUEUED => 'En cola',
            self::STATUS_CALLED => 'Llamando',
            self::STATUS_COMPLETED => 'Completada',
            self::STATUS_SKIPPED => 'Omitida',
            self::STATUS_FAILED => 'Fallida',
            self::STATUS_CANCELLED => 'Cancelada',
            default => $this->status,
        };
    }
}
