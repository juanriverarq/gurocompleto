<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Traits\BrokerScoped;

class AutomovilNotificationLog extends Model
{
    use HasFactory, BrokerScoped;

    protected $fillable = [
        'broker_id',
        'automovil_notification_config_id',
        'automovil_id',
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
        'automovil_data',
        'metadata',
    ];

    protected $casts = [
        'automovil_data' => 'array',
        'metadata' => 'array',
        'sent_at' => 'datetime',
        'failed_at' => 'datetime',
    ];

    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    public function config(): BelongsTo
    {
        return $this->belongsTo(AutomovilNotificationConfig::class, 'automovil_notification_config_id');
    }

    public function automovil(): BelongsTo
    {
        return $this->belongsTo(Automovil::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Cliente::class, 'client_id');
    }

    public function whatsappInstance(): BelongsTo
    {
        return $this->belongsTo(WhatsAppInstance::class);
    }

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

    public function markAsSent(string $messageId): void
    {
        $this->update([
            'status' => 'sent',
            'whatsapp_message_id' => $messageId,
            'sent_at' => now(),
            'error_message' => null,
        ]);
    }

    public function markAsFailed(string $errorMessage): void
    {
        $this->update([
            'status' => 'failed',
            'error_message' => $errorMessage,
            'failed_at' => now(),
        ]);
    }

    public function markAsSkipped(string $reason): void
    {
        $this->update([
            'status' => 'skipped',
            'error_message' => $reason,
        ]);
    }
}
