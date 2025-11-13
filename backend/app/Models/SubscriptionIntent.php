<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubscriptionIntent extends Model
{
    protected $table = 'subscription_intents';

    protected $fillable = [
        'user_id',
        'users_count',
        'period',
        'storage_gb',
        'modules',
        'totals',
        'status',
        'source',
    ];

    protected $casts = [
        'modules' => 'array',
        'totals' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}


