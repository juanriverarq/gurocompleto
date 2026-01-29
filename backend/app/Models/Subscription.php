<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Subscription extends Model
{
    protected $fillable = [
        'user_id',
        'broker_id',
        'status',
        'period',
        'users_count',
        'storage_gb',
        'modules',
        'totals',
        'intent_id',
        'starts_at',
        'current_period_end',
        'canceled_at',
        'auto_renew',
    ];

    protected $casts = [
        'modules' => 'array',
        'totals' => 'array',
        'starts_at' => 'datetime',
        'current_period_end' => 'datetime',
        'canceled_at' => 'datetime',
        'auto_renew' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }
}


