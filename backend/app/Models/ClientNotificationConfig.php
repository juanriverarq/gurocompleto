<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientNotificationConfig extends Model
{
    use HasFactory;

    protected $fillable = [
        'broker_id',
        'whatsapp_instance_id',
        'is_active',
        'name',
        'notify_birthday',
        'notify_workers_day',
        'notify_womens_day',
        'notify_mens_day',
        'notify_advisor_day',
        'birthday_template',
        'workers_day_template',
        'womens_day_template',
        'mens_day_template',
        'advisor_day_template',
        'workers_day_date',
        'womens_day_date',
        'mens_day_date',
        'advisor_day_date',
        'send_time',
        'max_notifications_per_day',
        'send_to_client_phone',
        'send_to_client_mobile',
        'excluded_client_ids',
        'total_sent',
        'total_failed',
        'last_execution_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'notify_birthday' => 'boolean',
        'notify_workers_day' => 'boolean',
        'notify_womens_day' => 'boolean',
        'notify_mens_day' => 'boolean',
        'notify_advisor_day' => 'boolean',
        'send_to_client_phone' => 'boolean',
        'send_to_client_mobile' => 'boolean',
        'excluded_client_ids' => 'array',
        'last_execution_at' => 'datetime',
    ];

    // Tipos de notificación con sus fechas fijas
    const SPECIAL_DATES = [
        'workers_day' => ['name' => 'Día del Trabajador', 'default_date' => '05-01'],
        'womens_day' => ['name' => 'Día de la Mujer', 'default_date' => '03-08'],
        'mens_day' => ['name' => 'Día del Hombre', 'default_date' => '03-19'],
        'advisor_day' => ['name' => 'Día del Asesor', 'default_date' => '09-15'],
    ];

    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    public function whatsappInstance(): BelongsTo
    {
        return $this->belongsTo(WhatsAppInstance::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeForBroker($query, int $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }

    public function incrementSent(): void
    {
        $this->increment('total_sent');
    }

    public function incrementFailed(): void
    {
        $this->increment('total_failed');
    }

    /**
     * Obtener el nombre de plantilla para un tipo de notificación
     */
    public function getTemplateName(string $type): ?string
    {
        $map = [
            'birthday' => $this->birthday_template,
            'workers_day' => $this->workers_day_template,
            'womens_day' => $this->womens_day_template,
            'mens_day' => $this->mens_day_template,
            'advisor_day' => $this->advisor_day_template,
        ];

        return $map[$type] ?? null;
    }

    /**
     * Obtener la fecha del evento especial (mes-día) para el año actual
     */
    public function getSpecialDate(string $type): ?string
    {
        $map = [
            'workers_day' => $this->workers_day_date ?? '05-01',
            'womens_day' => $this->womens_day_date ?? '03-08',
            'mens_day' => $this->mens_day_date ?? '03-19',
            'advisor_day' => $this->advisor_day_date ?? '09-15',
        ];

        return $map[$type] ?? null;
    }

    /**
     * Verificar si un tipo de notificación está habilitado
     */
    public function isTypeEnabled(string $type): bool
    {
        $map = [
            'birthday' => $this->notify_birthday,
            'workers_day' => $this->notify_workers_day,
            'womens_day' => $this->notify_womens_day,
            'mens_day' => $this->notify_mens_day,
            'advisor_day' => $this->notify_advisor_day,
        ];

        return $map[$type] ?? false;
    }
}
