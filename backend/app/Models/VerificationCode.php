<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Carbon\Carbon;

class VerificationCode extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'code',
        'type',
        'expires_at',
        'used_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'used_at' => 'datetime',
    ];

    /**
     * Relación con usuario
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Verificar si el código ha expirado
     */
    public function isExpired()
    {
        return $this->expires_at->isPast();
    }

    /**
     * Verificar si el código ya fue usado
     */
    public function isUsed()
    {
        return !is_null($this->used_at);
    }

    /**
     * Marcar código como usado
     */
    public function markAsUsed()
    {
        $this->used_at = now();
        $this->save();
    }

    /**
     * Scope para códigos válidos (no expirados y no usados)
     */
    public function scopeValid($query)
    {
        return $query->where('expires_at', '>', now())
                    ->whereNull('used_at');
    }

    /**
     * Scope para códigos por tipo
     */
    public function scopeOfType($query, $type)
    {
        return $query->where('type', $type);
    }
}
