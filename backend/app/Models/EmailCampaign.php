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
        'last_stats_sync' => 'datetime',
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
        // Los estados progresan: pending -> sent -> delivered -> opened -> clicked
        // También puede haber: failed (en cualquier momento antes de delivered)
        // Contamos cada estado considerando la progresión
        
        $total = $this->recipients()->count();
        
        // Enviados: todos los que NO están en pending o failed
        $sent = $this->recipients()
            ->whereIn('status', ['sent', 'delivered', 'opened', 'clicked'])
            ->count();
        
        // Entregados: delivered, opened, clicked (progresión exitosa)
        $delivered = $this->recipients()
            ->whereIn('status', ['delivered', 'opened', 'clicked'])
            ->count();
        
        // Fallidos: solo los que tienen status failed
        $failed = $this->recipients()
            ->where('status', 'failed')
            ->count();
        
        // Abiertos: opened, clicked (clicked implica que se abrió)
        $opened = $this->recipients()
            ->whereIn('status', ['opened', 'clicked'])
            ->count();
        
        // Clicks: solo clicked
        $clicked = $this->recipients()
            ->where('status', 'clicked')
            ->count();
        
        // Pendientes: aún no enviados
        $pending = $this->recipients()
            ->where('status', 'pending')
            ->count();

        $stats = [
            'total' => $total,
            'pending' => $pending,
            'sent' => $sent,
            'delivered' => $delivered,
            'failed' => $failed,
            'opened' => $opened,
            'clicked' => $clicked,
            'bounced' => $failed, // Alias para compatibilidad
            'delivery_rate' => $sent > 0 ? round(($delivered / $sent) * 100, 2) : 0,
            'open_rate' => $delivered > 0 ? round(($opened / $delivered) * 100, 2) : 0,
            'click_rate' => $opened > 0 ? round(($clicked / $opened) * 100, 2) : 0,
        ];

        // Determinar si la campaña debe marcarse como completada
        // Una campaña está completada cuando no hay recipients pendientes
        $shouldComplete = $pending === 0 && $total > 0 && $this->status === 'running';
        
        $updateData = [
            'stats_json' => $stats,
            'last_stats_sync' => now(),
        ];
        
        if ($shouldComplete) {
            $updateData['status'] = 'completed';
            $updateData['is_active'] = false;
        }
        
        $this->update($updateData);
    }
}