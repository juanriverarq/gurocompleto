<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalesTeam extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'sales_teams';

    protected $fillable = [
        'broker_id',
        'name',
        'description',
        'territory',
        'specialty',
        'leader_user_id',
        'status',
    ];

    public function members()
    {
        return $this->hasMany(SalesTeamMember::class, 'team_id');
    }

    public function leader()
    {
        return $this->belongsTo(User::class, 'leader_user_id');
    }

    public function scopeForBroker($query, int $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }
}


