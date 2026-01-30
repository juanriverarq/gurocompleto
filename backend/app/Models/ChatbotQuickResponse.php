<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChatbotQuickResponse extends Model
{
    use HasFactory;

    protected $fillable = [
        'chatbot_id',
        'shortcut',
        'title',
        'response_text',
        'media_url',
        'is_active',
        'usage_count',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function chatbot(): BelongsTo
    {
        return $this->belongsTo(Chatbot::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function incrementUsage(): void
    {
        $this->increment('usage_count');
    }
}
