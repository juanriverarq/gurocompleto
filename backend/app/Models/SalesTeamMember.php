<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SalesTeamMember extends Model
{
    use HasFactory;

    protected $table = 'sales_team_members';

    protected $fillable = [
        'team_id',
        'user_id',
        'role',
        'monthly_goal',
        'status',
    ];

    public function team()
    {
        return $this->belongsTo(SalesTeam::class, 'team_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}


