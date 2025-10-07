<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmailCampaign extends Model
{
    protected $table = 'email_campaigns';

    protected $guarded = [];

    protected $casts = [
        'segment_filters' => 'array',
        'stats_json' => 'array',
        'last_execution' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    // Relaciones
    public function recipients()
    {
        return $this->hasMany(EmailCampaignRecipient::class, 'campaign_id');
    }

    public function csvUpload()
    {
        return $this->belongsTo(UploadCsv::class, 'csv_upload_id');
    }

    // Scopes
    public function scopeForBroker($query, int $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }

    public function scopeWithStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    // Utilidad: actualizar métricas agregadas
    public function refreshStats(): void
    {
        $sent = $this->recipients()->where('status', 'sent')->count();
        $delivered = $this->recipients()->where('status', 'delivered')->count();
        $failed = $this->recipients()->where('status', 'failed')->count();
        $opened = $this->recipients()->where('status', 'opened')->count();
        $clicked = $this->recipients()->where('status', 'clicked')->count();
        $total = $this->recipients()->count();

        $stats = [
            'total' => $total,
            'sent' => $sent,
            'delivered' => $delivered,
            'failed' => $failed,
            'opened' => $opened,
            'clicked' => $clicked,
            'delivery_rate' => $sent > 0 ? round(($delivered / $sent) * 100, 2) : 0,
            'open_rate' => $total > 0 ? round(($opened / $total) * 100, 2) : 0,
            'click_rate' => $total > 0 ? round(($clicked / $total) * 100, 2) : 0,
        ];

        $this->update([
            'stats_json' => $stats,
        ]);
    }
}