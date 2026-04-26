<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Campaign extends Model
{
    use HasFactory;

    protected $fillable = [
        'broker_id',
        'name',
        'description',
        'campaign_type',
        'message_template',
        'contacts',
        'scheduled_date',
        'trigger_conditions',
        'schedule_config',
        'target_filters',
        'status',
        'is_active',
        'total_targets',
        'sent_count',
        'delivered_count',
        'failed_count',
        'last_execution',
        'next_execution',
        'created_by',
        'whatsapp_instance_id',
        'template_name',
        'template_language',
        'media_url',
        'media_type',
    ];

    protected $casts = [
        'contacts' => 'array',
        'trigger_conditions' => 'array',
        'schedule_config' => 'array',
        'target_filters' => 'array',
        'is_active' => 'boolean',
        'scheduled_date' => 'datetime',
        'last_execution' => 'datetime',
        'next_execution' => 'datetime',
    ];

    protected $appends = ['stats'];

    /**
     * Relación con el broker propietario
     */
    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    /**
     * Relación con las ejecuciones de la campaña
     */
    public function executions(): HasMany
    {
        return $this->hasMany(CampaignExecution::class);
    }

    /**
     * Relación con los mensajes de la campaña
     */
    public function messages(): HasMany
    {
        return $this->hasMany(CampaignMessage::class);
    }

    /**
     * Obtener estadísticas de la campaña
     */
    public function getStatsAttribute(): array
    {
        return [
            'total_targets' => $this->total_targets,
            'sent_count' => $this->sent_count,
            'delivered_count' => $this->delivered_count,
            'failed_count' => $this->failed_count,
            'delivery_rate' => $this->sent_count > 0 ? round(($this->delivered_count / $this->sent_count) * 100, 2) : 0,
            'last_execution' => $this->last_execution?->toISOString(),
            'next_execution' => $this->next_execution?->toISOString(),
        ];
    }

    /**
     * Scope para campañas activas
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope para tipo de campaña
     */
    public function scopeOfType($query, string $type)
    {
        return $query->where('campaign_type', $type);
    }

    /**
     * Scope para estado de campaña
     */
    public function scopeWithStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Scope para filtrar por broker
     */
    public function scopeForBroker($query, int $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }

    /** 
     * Relación con la instancia de WhatsApp
     */
    public function whatsappInstance(): BelongsTo
    {
        return $this->belongsTo(WhatsAppInstance::class, 'whatsapp_instance_id');
    }
}
