<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ChatbotFlow extends Model
{
    use HasFactory;

    protected $fillable = [
        'chatbot_id',
        'name',
        'description',
        'is_default',
        'priority',
        'is_active',
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function chatbot(): BelongsTo
    {
        return $this->belongsTo(Chatbot::class);
    }

    public function nodes(): HasMany
    {
        return $this->hasMany(ChatbotNode::class, 'flow_id');
    }

    public function triggers(): HasMany
    {
        return $this->hasMany(ChatbotTrigger::class, 'flow_id');
    }

    public function startNode()
    {
        return $this->nodes()->where('node_type', 'start')->first();
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeDefault($query)
    {
        return $query->where('is_default', true);
    }
}
