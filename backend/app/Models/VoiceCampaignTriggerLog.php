<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class VoiceCampaignTriggerLog extends Model
{
    use HasFactory;

    protected $table = 'voice_campaign_trigger_logs';

    public const RESULT_SUCCESS     = 'success';
    public const RESULT_SKIP_DEDUP  = 'skip_dedup';
    public const RESULT_SKIP_WINDOW = 'skip_window';
    public const RESULT_SKIP_FILTERS= 'skip_filters';
    public const RESULT_SKIP_QUOTA  = 'skip_quota';
    public const RESULT_ERROR       = 'error';

    protected $fillable = [
        'broker_id',
        'voice_campaign_id',
        'trigger_id',
        'entity_type',
        'entity_id',
        'dedup_hash',
        'fired_at',
        'result',
        'reason',
        'voice_campaign_call_id',
        'payload',
    ];

    protected $casts = [
        'fired_at' => 'datetime',
        'payload'  => 'array',
    ];

    /**
     * Campaña asociada.
     */
    public function campaign()
    {
        return $this->belongsTo(VoiceCampaign::class, 'voice_campaign_id');
    }

    /**
     * Trigger asociado.
     */
    public function trigger()
    {
        return $this->belongsTo(VoiceCampaignTrigger::class, 'trigger_id');
    }

    /**
     * Llamada de campaña asociada (si se llegó a ejecutar).
     */
    public function call()
    {
        return $this->belongsTo(VoiceCampaignCall::class, 'voice_campaign_call_id');
    }

    /**
     * Scope: por broker.
     */
    public function scopeForBroker(Builder $query, int $brokerId): Builder
    {
        return $query->where('broker_id', $brokerId);
    }

    /**
     * Scope: por campaña.
     */
    public function scopeForCampaign(Builder $query, int $campaignId): Builder
    {
        return $query->where('voice_campaign_id', $campaignId);
    }

    /**
     * Scope: por resultado.
     */
    public function scopeByResult(Builder $query, string $result): Builder
    {
        return $query->where('result', $result);
    }

    /**
     * Scope: por hash de deduplicación.
     */
    public function scopeWithDedup(Builder $query, string $hash): Builder
    {
        return $query->where('dedup_hash', $hash);
    }
}