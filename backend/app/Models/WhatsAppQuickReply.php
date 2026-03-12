<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WhatsAppQuickReply extends Model
{
    use HasFactory;

    protected $table = 'whatsapp_quick_replies';

    protected $fillable = [
        'broker_id',
        'department_id',
        'shortcut',
        'title',
        'content',
        'media_url',
        'media_type',
        'is_active',
        'usage_count',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(WhatsAppDepartment::class, 'department_id');
    }

    public function incrementUsage(): void
    {
        $this->increment('usage_count');
    }
}
