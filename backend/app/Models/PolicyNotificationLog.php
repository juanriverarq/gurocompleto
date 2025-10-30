<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Traits\BrokerScoped;

class PolicyNotificationLog extends Model
{
    use HasFactory, BrokerScoped;

    protected $fillable = [
        'broker_id',
        'policy_notification_config_id',
        'poliza_id',
        'client_id',
        'whatsapp_instance_id',
        'notification_type',
        'recipient_phone',
        'message_sent',
        'status',
        'whatsapp_message_id',
        'error_message',
        'sent_at',
        'failed_at',
        'policy_data',
        'metadata',
    ];

    protected $casts = [
        'policy_data' => 'array',
        'metadata' => 'array',
        'sent_at' => 'datetime',
        'failed_at' => 'datetime',
    ];

    // ===== RELACIONES =====

    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    public function config(): BelongsTo
    {
        return $this->belongsTo(PolicyNotificationConfig::class, 'policy_notification_config_id');
    }

    public function poliza(): BelongsTo
    {
        return $this->belongsTo(Poliza::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Cliente::class);
    }

    public function whatsappInstance(): BelongsTo
    {
        return $this->belongsTo(WhatsAppInstance::class);
    }

    // ===== SCOPES =====

    public function scopeForBroker($query, int $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }

    public function scopeSent($query)
    {
        return $query->where('status', 'sent');
    }

    public function scopeFailed($query)
    {
        return $query->where('status', 'failed');
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeByType($query, string $type)
    {
        return $query->where('notification_type', $type);
    }

    public function scopeRecent($query, int $days = 30)
    {
        return $query->where('created_at', '>=', now()->subDays($days));
    }

    // ===== MÉTODOS DE UTILIDAD =====

    /**
     * Marcar como enviado
     */
    public function markAsSent(string $messageId): void
    {
        $this->update([
            'status' => 'sent',
            'whatsapp_message_id' => $messageId,
            'sent_at' => now(),
            'error_message' => null,
        ]);
    }

    /**
     * Marcar como fallido
     */
    public function markAsFailed(string $errorMessage): void
    {
        $this->update([
            'status' => 'failed',
            'error_message' => $errorMessage,
            'failed_at' => now(),
        ]);
    }

    /**
     * Marcar como saltado
     */
    public function markAsSkipped(string $reason): void
    {
        $this->update([
            'status' => 'skipped',
            'error_message' => $reason,
        ]);
    }

    /**
     * Verificar si fue enviado exitosamente
     */
    public function wasSent(): bool
    {
        return $this->status === 'sent';
    }

    /**
     * Verificar si falló
     */
    public function hasFailed(): bool
    {
        return $this->status === 'failed';
    }

    /**
     * Obtener el nombre del tipo de notificación
     */
    public function getTypeNameAttribute(): string
    {
        $types = [
            'expiration' => 'Vencimiento',
            'renewal' => 'Renovación',
            'payment_due' => 'Pago Pendiente',
        ];

        return $types[$this->notification_type] ?? $this->notification_type;
    }

    /**
     * Obtener el nombre del estado
     */
    public function getStatusNameAttribute(): string
    {
        $statuses = [
            'pending' => 'Pendiente',
            'sent' => 'Enviado',
            'failed' => 'Fallido',
            'skipped' => 'Omitido',
        ];

        return $statuses[$this->status] ?? $this->status;
    }
}