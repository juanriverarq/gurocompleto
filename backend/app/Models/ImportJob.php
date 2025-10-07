<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ImportJob extends Model
{
    use HasFactory;

    protected $fillable = [
        'broker_id','user_id','entity','filename','status','inserted','updated','failed','errors_count','mapping','errors','started_at','finished_at'
    ];

    protected $casts = [
        'mapping' => 'array',
        'errors' => 'array',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
    ];
}


