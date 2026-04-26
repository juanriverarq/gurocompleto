<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class InsurerConnection extends Model
{
    use HasFactory;

    protected $fillable = [
        'broker_id',
        'insurer_code',
        'status',
        'microservice_session_id',
        'credentials_encrypted',
        'session_payload',
        'connected_at',
        'expires_at',
        'last_healthcheck_at',
        'last_error',
        'last_sync_at',
        'last_sync_clientes_count',
        'last_sync_polizas_count',
        'reconnect_count',
        'last_reconnect_at',
        'credentials_valid',
        'connect_job_status',
        'connect_job_id',
        'connect_job_mode',
        'connect_job_message',
        'connect_job_error',
        'connect_job_challenge_id',
        'connect_job_started_at',
        'connect_job_finished_at',
    ];

    protected $casts = [
        'session_payload' => 'array',
        'connected_at' => 'datetime',
        'expires_at' => 'datetime',
        'last_healthcheck_at' => 'datetime',
        'last_sync_at' => 'datetime',
        'last_reconnect_at' => 'datetime',
        'credentials_valid' => 'boolean',
        'connect_job_started_at' => 'datetime',
        'connect_job_finished_at' => 'datetime',
    ];

    protected $hidden = [
        'credentials_encrypted',
    ];

    public function broker()
    {
        return $this->belongsTo(Broker::class);
    }

    public function scopeForBroker($query, int $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }

    public function getCredentialsAttribute(): ?array
    {
        if (empty($this->attributes['credentials_encrypted'])) {
            return null;
        }

        try {
            $decrypted = Crypt::decryptString($this->attributes['credentials_encrypted']);
            return json_decode($decrypted, true);
        } catch (\Throwable $e) {
            return null;
        }
    }

    public function setCredentialsAttribute(?array $value): void
    {
        if (empty($value)) {
            $this->attributes['credentials_encrypted'] = null;
            return;
        }

        $this->attributes['credentials_encrypted'] = Crypt::encryptString(json_encode($value));
    }
}

