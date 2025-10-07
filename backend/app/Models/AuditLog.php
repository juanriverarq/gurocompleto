<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'broker_id',
        'user_id',
        'user_type',
        'action',
        'module',
        'ip_address',
        'user_agent',
        'path',
        'method',
        'request_payload',
        'response_status',
        'metadata',
    ];

    protected $casts = [
        'request_payload' => 'array',
        'metadata' => 'array',
    ];
}


