<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class ExternalCredential extends Model
{
    use HasFactory;

    protected $fillable = [
        'broker_id',
        'provider',
        'username',
        'password_encrypted',
        'session_data',
        'session_expires_at',
        'last_sync_at',
        'status',
        'last_error',
    ];

    protected $casts = [
        'session_expires_at' => 'datetime',
        'last_sync_at' => 'datetime',
    ];

    protected $hidden = [
        'password_encrypted',
        'session_data',
    ];

    /**
     * Set and encrypt the password.
     */
    public function setPasswordAttribute(string $value): void
    {
        $this->attributes['password_encrypted'] = Crypt::encryptString($value);
    }

    /**
     * Get and decrypt the password.
     */
    public function getPasswordAttribute(): ?string
    {
        if (empty($this->attributes['password_encrypted'])) {
            return null;
        }
        try {
            return Crypt::decryptString($this->attributes['password_encrypted']);
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Get session data as array.
     */
    public function getSessionAttribute(): ?array
    {
        if (empty($this->attributes['session_data'])) {
            return null;
        }
        try {
            $decrypted = Crypt::decryptString($this->attributes['session_data']);
            return json_decode($decrypted, true);
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Set session data (encrypted).
     */
    public function setSessionAttribute(array $data): void
    {
        $this->attributes['session_data'] = Crypt::encryptString(json_encode($data));
    }

    /**
     * Check if the session is still valid.
     */
    public function hasValidSession(): bool
    {
        if (!$this->session_data || !$this->session_expires_at) {
            return false;
        }
        return $this->session_expires_at->isFuture();
    }

    /**
     * Scope to a specific broker.
     */
    public function scopeForBroker($query, int $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }

    /**
     * Scope to a specific provider.
     */
    public function scopeForProvider($query, string $provider)
    {
        return $query->where('provider', $provider);
    }
}
