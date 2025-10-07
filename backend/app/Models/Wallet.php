<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\WalletTransaction;

class Wallet extends Model
{
    protected $fillable = [
        'user_id',
        'broker_id',
        'balance_cop',
        'balance_usd',
        'pending_balance',
        'total_earnings',
        'is_active',
    ];

    protected $casts = [
        'balance_cop' => 'decimal:2',
        'balance_usd' => 'decimal:2',
        'pending_balance' => 'decimal:2',
        'total_earnings' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    /**
     * Relación con el usuario
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class);
    }

    /**
     * Relación con el broker (si existe)
     */
    public function broker(): BelongsTo
    {
        return $this->belongsTo(\App\Models\Broker::class);
    }

    /**
     * Obtener saldo total disponible en COP
     */
    public function getAvailableBalanceCopAttribute(): float
    {
        return $this->balance_cop;
    }

    /**
     * Obtener saldo formateado en COP
     */
    public function getFormattedBalanceCopAttribute(): string
    {
        return '$' . number_format((float) $this->balance_cop, 0, ',', '.') . ' COP';
    }

    /**
     * Agregar fondos al wallet
     */
    public function addFunds(float $amount, string $currency = 'COP', ?string $description = null, ?array $metadata = null): bool
    {
        if ($currency === 'COP') {
            $this->balance_cop += $amount;
            $this->total_earnings += $amount;
        } elseif ($currency === 'USD') {
            $this->balance_usd += $amount;
        }
        
        $saved = $this->save();
        if ($saved) {
            WalletTransaction::create([
                'wallet_id' => $this->id,
                'broker_id' => $this->broker_id,
                'user_id' => $this->user_id,
                'type' => 'credit',
                'amount_cop' => $currency === 'COP' ? $amount : 0,
                'amount_usd' => $currency === 'USD' ? $amount : 0,
                'currency' => $currency,
                'description' => $description ?: 'Fondos agregados',
                'balance_cop_after' => $this->balance_cop,
                'metadata' => $metadata,
            ]);
        }
        return $saved;
    }

    /**
     * Retirar fondos del wallet
     */
    public function withdrawFunds(float $amount, string $currency = 'COP'): bool
    {
        if ($currency === 'COP' && $this->balance_cop >= $amount) {
            $this->balance_cop -= $amount;
            $saved = $this->save();
            if ($saved) {
                WalletTransaction::create([
                    'wallet_id' => $this->id,
                    'broker_id' => $this->broker_id,
                    'user_id' => $this->user_id,
                    'type' => 'debit',
                    'amount_cop' => $amount,
                    'amount_usd' => 0,
                    'currency' => 'COP',
                    'description' => 'Retiro de fondos',
                    'balance_cop_after' => $this->balance_cop,
                ]);
            }
            return $saved;
        } elseif ($currency === 'USD' && $this->balance_usd >= $amount) {
            $this->balance_usd -= $amount;
            $saved = $this->save();
            if ($saved) {
                WalletTransaction::create([
                    'wallet_id' => $this->id,
                    'broker_id' => $this->broker_id,
                    'user_id' => $this->user_id,
                    'type' => 'debit',
                    'amount_cop' => 0,
                    'amount_usd' => $amount,
                    'currency' => 'USD',
                    'description' => 'Retiro de fondos',
                    'balance_cop_after' => $this->balance_cop,
                ]);
            }
            return $saved;
        }
        
        return false;
    }

    /**
     * Scope para wallets activos
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope por broker
     */
    public function scopeForBroker($query, $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }

    /**
     * Scope por usuario
     */
    public function scopeForUser($query, $userId)
    {
        return $query->where('user_id', $userId);
    }
}
