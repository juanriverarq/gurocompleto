<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmailCampaignRecipient extends Model
{
    protected $table = 'email_campaign_recipients';

    protected $guarded = [];

    protected $casts = [
        'variables_resolved' => 'array',
        'sent_at' => 'datetime',
        'delivered_at' => 'datetime',
        'opened_at' => 'datetime',
        'clicked_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // Relaciones
    public function campaign()
    {
        return $this->belongsTo(EmailCampaign::class, 'campaign_id');
    }

    public function cliente()
    {
        return $this->belongsTo(\App\Models\Cliente::class, 'cliente_id');
    }

    // Scopes comunes
    public function scopeForCampaign($query, int $campaignId)
    {
        return $query->where('campaign_id', $campaignId);
    }

    public function scopeWithStatus($query, string $status)
    {
        return $query->where('status', $status);
    }
}