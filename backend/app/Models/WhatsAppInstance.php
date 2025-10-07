<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Carbon\Carbon;

class WhatsAppInstance extends Model
{
    use HasFactory;

    // Usar el nombre correcto de la tabla en la base de datos
    protected $table = 'whats_app_instances';

    protected $fillable = [
        'broker_id',
        'instance_id',
        'session_id',
        'phone_number',
        'status',
        'qr_code',
        'qr_expires_at',
        'session_data',
        'connection_info',
        'webhook_url',
        'settings',
        'last_connected_at',
        'last_activity_at',
        'error_message',
        'reconnect_attempts',
        'is_active',
    ];

    protected $casts = [
        'qr_expires_at' => 'datetime',
        'session_data' => 'array',
        'connection_info' => 'array',
        'settings' => 'array',
        'last_connected_at' => 'datetime',
        'last_activity_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    // Relaciones
    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeConnected($query)
    {
        return $query->whereIn('status', ['connected', 'authenticated']);
    }

    public function scopeByBroker($query, $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }

    // Métodos utilitarios
    public function isConnected(): bool
    {
        return in_array($this->status, ['connected', 'authenticated']);
    }

    public function isQrExpired(): bool
    {
        return $this->qr_expires_at && $this->qr_expires_at->isPast();
    }

    public function needsReconnection(): bool
    {
        return $this->status === 'disconnected' || $this->status === 'error';
    }

    public function updateLastActivity(): void
    {
        $this->update(['last_activity_at' => now()]);
    }

    public function setConnected(array $connectionInfo = []): void
    {
        $this->update([
            'status' => 'connected',
            'connection_info' => $connectionInfo,
            'last_connected_at' => now(),
            'last_activity_at' => now(),
            'error_message' => null,
            'reconnect_attempts' => 0,
        ]);
    }

    public function setDisconnected(string $errorMessage = null): void
    {
        $this->update([
            'status' => 'disconnected',
            'error_message' => $errorMessage,
            'qr_code' => null,
            'qr_expires_at' => null,
        ]);
    }

    public function setQrCode(string $qrCode, int $expiresInMinutes = 5): void
    {
        $this->update([
            'status' => 'qr_pending',
            'qr_code' => $qrCode,
            'qr_expires_at' => now()->addMinutes($expiresInMinutes),
        ]);
    }

    public function incrementReconnectAttempts(): void
    {
        $this->increment('reconnect_attempts');
    }
}
