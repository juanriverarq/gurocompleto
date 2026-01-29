<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Chatbot extends Model
{
    use HasFactory;

    protected $fillable = [
        'broker_id',
        'instance_id',
        'name',
        'description',
        'is_active',
        'welcome_message',
        'fallback_message',
        'goodbye_message',
        'out_of_hours_message',
        'ai_enabled',
        'ai_provider',
        'ai_model',
        'ai_system_prompt',
        'ai_temperature',
        'ai_max_tokens',
        'typing_delay_ms',
        'response_delay_ms',
        'session_timeout_minutes',
        'max_fallback_count',
        'business_hours_enabled',
        'business_hours',
        'timezone',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'ai_enabled' => 'boolean',
        'ai_temperature' => 'decimal:1',
        'business_hours_enabled' => 'boolean',
        'business_hours' => 'array',
    ];

    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    public function flows(): HasMany
    {
        return $this->hasMany(ChatbotFlow::class);
    }

    public function triggers(): HasMany
    {
        return $this->hasMany(ChatbotTrigger::class);
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(ChatbotSession::class);
    }

    public function quickResponses(): HasMany
    {
        return $this->hasMany(ChatbotQuickResponse::class);
    }

    public function analytics(): HasMany
    {
        return $this->hasMany(ChatbotAnalytics::class);
    }

    public function defaultFlow()
    {
        return $this->flows()->where('is_default', true)->first();
    }

    public function activeFlows()
    {
        return $this->flows()->where('is_active', true)->orderBy('priority', 'desc');
    }

    public function activeTriggers()
    {
        return $this->triggers()->where('is_active', true)->orderBy('priority', 'desc');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeForBroker($query, $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }

    public function scopeForInstance($query, $instanceId)
    {
        return $query->where('instance_id', $instanceId);
    }
}
