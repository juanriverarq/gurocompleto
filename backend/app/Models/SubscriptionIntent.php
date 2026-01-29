<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionIntent extends Model
{
    protected $table = 'subscription_intents';

    protected $fillable = [
        'user_id',
        'broker_id',
        'users_count',
        'period',
        'storage_gb',
        'modules',
        'totals',
        'status',
        'source',
        'coupon',
        'is_renewal',
        'previous_subscription_id',
    ];

    protected $casts = [
        'modules' => 'array',
        'totals' => 'array',
        'coupon' => 'array',
        'is_renewal' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    public function previousSubscription(): BelongsTo
    {
        return $this->belongsTo(Subscription::class, 'previous_subscription_id');
    }
}


