<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalesGoal extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'sales_goals';

    protected $fillable = [
        'broker_id',
        'user_id',
        'team_id',
        'period',
        'type',
        'target_value',
        'current_value',
        'notes',
        'status',
        'starts_at',
        'ends_at',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function team()
    {
        return $this->belongsTo(SalesTeam::class, 'team_id');
    }

    public function scopeForBroker($query, int $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }
}


