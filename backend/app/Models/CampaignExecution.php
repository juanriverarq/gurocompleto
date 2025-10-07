<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CampaignExecution extends Model
{
    use HasFactory;

    protected $fillable = [
        'broker_id',
        'campaign_id',
        'execution_date',
        'status',
        'targets_found',
        'messages_sent',
        'messages_delivered',
        'messages_failed',
        'started_at',
        'completed_at',
        'error_message',
        'execution_details'
    ];

    protected $casts = [
        'execution_date' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'execution_details' => 'array',
    ];

    /**
     * Relación con el broker propietario
     */
    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    /**
     * Relación con la campaña
     */
    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }

    /**
     * Relación con los mensajes de esta ejecución
     */
    public function messages(): HasMany
    {
        return $this->hasMany(CampaignMessage::class);
    }

    /**
     * Scope para ejecuciones completadas
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    /**
     * Scope para ejecuciones fallidas
     */
    public function scopeFailed($query)
    {
        return $query->where('status', 'failed');
    }

    /**
     * Scope para ejecuciones en progreso
     */
    public function scopeRunning($query)
    {
        return $query->where('status', 'running');
    }

    /**
     * Scope para filtrar por broker
     */
    public function scopeForBroker($query, int $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }
}
