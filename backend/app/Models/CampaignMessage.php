<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Carbon\Carbon;

class CampaignMessage extends Model
{
    use HasFactory;

    protected $fillable = [
        'broker_id',
        'campaign_id',
        'campaign_execution_id',
        'recipient_phone',
        'recipient_name',
        'message_content',
        'message_type',
        'status',
        'sent_at',
        'delivered_at',
        'read_at',
        'failed_at',
        'whatsapp_message_id',
        'error_message',
        'metadata'
    ];

    protected $casts = [
        'sent_at' => 'datetime',
        'delivered_at' => 'datetime',
        'read_at' => 'datetime',
        'failed_at' => 'datetime',
        'metadata' => 'array'
    ];

    /**
     * Estados posibles del mensaje
     */
    const STATUS_PENDING = 'pending';
    const STATUS_SENT = 'sent';
    const STATUS_DELIVERED = 'delivered';
    const STATUS_FAILED = 'failed';
    const STATUS_READ = 'read';

    /**
     * Relación con el broker propietario
     */
    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    /**
     * Relación con la campaña
     */
    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }

    /**
     * Relación con la ejecución de campaña
     */
    public function execution(): BelongsTo
    {
        return $this->belongsTo(CampaignExecution::class, 'campaign_execution_id');
    }

    /**
     * Marcar mensaje como enviado
     */
    public function markAsSent(string $whatsappMessageId = null): void
    {
        $this->update([
            'status' => self::STATUS_SENT,
            'sent_at' => now(),
            'whatsapp_message_id' => $whatsappMessageId
        ]);
    }

    /**
     * Marcar mensaje como entregado
     */
    public function markAsDelivered(): void
    {
        $this->update([
            'status' => self::STATUS_DELIVERED,
            'delivered_at' => now()
        ]);
    }

    /**
     * Marcar mensaje como leído
     */
    public function markAsRead(): void
    {
        $this->update([
            'status' => self::STATUS_READ,
            'read_at' => now()
        ]);
    }

    /**
     * Marcar mensaje como fallido
     */
    public function markAsFailed(string $errorMessage = null): void
    {
        $this->update([
            'status' => self::STATUS_FAILED,
            'failed_at' => now(),
            'error_message' => $errorMessage
        ]);
    }

    /**
     * Scope para mensajes enviados
     */
    public function scopeSent($query)
    {
        return $query->where('status', self::STATUS_SENT);
    }

    /**
     * Scope para mensajes entregados
     */
    public function scopeDelivered($query)
    {
        return $query->where('status', self::STATUS_DELIVERED);
    }

    /**
     * Scope para mensajes fallidos
     */
    public function scopeFailed($query)
    {
        return $query->where('status', self::STATUS_FAILED);
    }

    /**
     * Scope para mensajes pendientes
     */
    public function scopePending($query)
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    /**
     * Verificar si ya existe un mensaje para este teléfono y campaña
     */
    public static function existsForCampaignAndPhone(int $campaignId, string $phone): bool
    {
        return self::where('campaign_id', $campaignId)
                   ->where('recipient_phone', $phone)
                   ->exists();
    }

    /**
     * Obtener el último mensaje enviado a un teléfono para una campaña
     */
    public static function getLastMessageForCampaignAndPhone(int $campaignId, string $phone): ?self
    {
        return self::where('campaign_id', $campaignId)
                   ->where('recipient_phone', $phone)
                   ->orderBy('created_at', 'desc')
                   ->first();
    }

    /**
     * Scope para filtrar por broker
     */
    public function scopeForBroker($query, int $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }
}
