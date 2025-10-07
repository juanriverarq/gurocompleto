<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WalletTransaction extends Model
{
    protected $fillable = [
        'wallet_id',
        'broker_id',
        'user_id',
        'type',
        'amount_cop',
        'amount_usd',
        'currency',
        'description',
        'reference_type',
        'reference_id',
        'metadata',
        'balance_cop_after',
    ];

    protected $casts = [
        'amount_cop' => 'float',
        'amount_usd' => 'float',
        'metadata' => 'array',
        'balance_cop_after' => 'float',
    ];
}


