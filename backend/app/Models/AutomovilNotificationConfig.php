<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\BrokerScoped;

class AutomovilNotificationConfig extends Model
{
    use HasFactory, SoftDeletes, BrokerScoped;

    protected $fillable = [
        'broker_id',
        'whatsapp_instance_id',
        'is_active',
        'name',
        'description',
        'notify_soat',
        'notify_rtm',
        'soat_days_before',
        'rtm_days_before',
        'soat_days_before_multiple',
        'rtm_days_before_multiple',
        'soat_template',
        'rtm_template',
        'send_time',
        'send_days',
        'excluded_client_ids',
        'excluded_automovil_ids',
        'excluded_vehicle_classes',
        'send_to_client_phone',
        'send_to_client_mobile',
        'send_to_assigned_user',
        'max_notifications_per_day',
        'skip_weekends',
        'skip_holidays',
        'total_sent',
        'total_failed',
        'last_execution_at',
        'next_execution_at',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'notify_soat' => 'boolean',
        'notify_rtm' => 'boolean',
        'send_days' => 'array',
        'soat_days_before_multiple' => 'array',
        'rtm_days_before_multiple' => 'array',
        'excluded_client_ids' => 'array',
        'excluded_automovil_ids' => 'array',
        'excluded_vehicle_classes' => 'array',
        'send_to_client_phone' => 'boolean',
        'send_to_client_mobile' => 'boolean',
        'send_to_assigned_user' => 'boolean',
        'skip_weekends' => 'boolean',
        'skip_holidays' => 'boolean',
        'last_execution_at' => 'datetime',
        'next_execution_at' => 'datetime',
    ];

    // ===== RELACIONES =====

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

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function logs(): HasMany
    {
        return $this->hasMany(AutomovilNotificationLog::class);
    }

    // ===== SCOPES =====

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeForBroker($query, int $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }

    public function scopeReadyToExecute($query)
    {
        return $query->where('is_active', true)
                     ->where(function ($q) {
                         $q->whereNull('next_execution_at')
                           ->orWhere('next_execution_at', '<=', now());
                     });
    }

    // ===== MÉTODOS DE UTILIDAD =====

    public function isWhatsAppConnected(): bool
    {
        if (!$this->whatsappInstance) {
            return false;
        }
        return $this->whatsappInstance->isConnected();
    }

    public function getWhatsAppStatus(): array
    {
        if (!$this->whatsappInstance) {
            return [
                'connected' => false,
                'status' => 'no_instance',
                'message' => 'No hay instancia configurada'
            ];
        }

        $isConnected = $this->whatsappInstance->isConnected();

        return [
            'connected' => $isConnected,
            'status' => $this->whatsappInstance->status,
            'instance_id' => $this->whatsappInstance->instance_id,
            'phone_number' => $this->whatsappInstance->phone_number,
            'message' => $isConnected ? 'Conectado' : 'Desconectado'
        ];
    }

    public function isClientExcluded(int $clientId): bool
    {
        return in_array($clientId, $this->excluded_client_ids ?? []);
    }

    public function isAutomovilExcluded(int $automovilId): bool
    {
        return in_array($automovilId, $this->excluded_automovil_ids ?? []);
    }

    public function isVehicleClassExcluded(?string $class): bool
    {
        if (!$class) return false;
        $excluded = $this->excluded_vehicle_classes ?? [];
        return in_array(strtoupper($class), array_map('strtoupper', $excluded));
    }

    /**
     * Obtener días de anticipación (soporta múltiples)
     */
    public function getDaysBeforeForType(string $type): array
    {
        $multipleField = $type . '_days_before_multiple';
        $singleField = $type . '_days_before';

        if (!empty($this->$multipleField)) {
            return $this->$multipleField;
        }
        if (!empty($this->$singleField)) {
            return [$this->$singleField];
        }

        $defaults = [
            'soat' => [30],
            'rtm' => [30],
        ];

        return $defaults[$type] ?? [30];
    }

    public function getTemplate(string $type): string
    {
        $templates = [
            'soat' => $this->soat_template,
            'rtm' => $this->rtm_template,
        ];

        return $templates[$type] ?? $this->getDefaultTemplate($type);
    }

    private function getDefaultTemplate(string $type): string
    {
        $defaults = [
            'soat' => 'Hola {{client_name}}, te recordamos que el SOAT de tu vehículo {{placa}} vence el {{soat_vencimiento}}. Contáctanos para renovarlo.',
            'rtm' => 'Hola {{client_name}}, te recordamos que la Revisión Técnico-Mecánica (RTM) de tu vehículo {{placa}} vence el {{rtm_vencimiento}}. Contáctanos para renovarla.',
        ];

        return $defaults[$type] ?? 'Notificación de vehículo {{placa}}';
    }

    public function processTemplate(string $template, Automovil $auto): string
    {
        $client = $auto->client;
        $clientName = $client
            ? ($client->full_name ?? trim(($client->first_name ?? '') . ' ' . ($client->last_name ?? '')) ?: 'Cliente')
            : 'Cliente';

        $variables = [
            '{{client_name}}' => $clientName,
            '{{placa}}' => $auto->placa ?? '-',
            '{{marca}}' => $auto->marca ?? '-',
            '{{modelo}}' => $auto->anio ?? '-',
            '{{linea}}' => $auto->linea ?? '-',
            '{{soat_vencimiento}}' => $auto->fecha_vencimiento_soat ? $auto->fecha_vencimiento_soat->format('d/m/Y') : 'N/A',
            '{{rtm_vencimiento}}' => $auto->fecha_vencimiento_rtm ? $auto->fecha_vencimiento_rtm->format('d/m/Y') : 'N/A',
            '{{aseguradora_soat}}' => $auto->aseguradora_soat ?? '-',
        ];

        return str_replace(array_keys($variables), array_values($variables), $template);
    }

    public function incrementSent(): void
    {
        $this->increment('total_sent');
        $this->update(['last_execution_at' => now()]);
    }

    public function incrementFailed(): void
    {
        $this->increment('total_failed');
    }

    /**
     * Calcular próxima ejecución
     */
    public function calculateNextExecution(): void
    {
        if (!$this->is_active) {
            $this->update(['next_execution_at' => null]);
            return;
        }

        $sendDays = $this->send_days ?? [1, 2, 3, 4, 5];
        $sendTime = $this->send_time ?? '09:00:00';

        $nextExecution = now()->copy();
        $todayAtSendTime = now()->copy()->setTimeFromTimeString($sendTime);
        if (now()->gte($todayAtSendTime)) {
            $nextExecution = $nextExecution->addDay();
        }
        $nextExecution->setTimeFromTimeString($sendTime);

        $maxAttempts = 14;
        $attempts = 0;

        while ($attempts < $maxAttempts) {
            $dayOfWeek = $nextExecution->dayOfWeek;

            if (in_array($dayOfWeek, $sendDays)) {
                if ($this->skip_weekends && in_array($dayOfWeek, [0, 6])) {
                    $nextExecution->addDay();
                    $attempts++;
                    continue;
                }
                break;
            }

            $nextExecution->addDay();
            $attempts++;
        }

        $this->update(['next_execution_at' => $nextExecution]);
    }

    /**
     * Obtener próximos envíos programados
     */
    public function getScheduledNotifications(int $limit = 50): array
    {
        if (!$this->is_active || !$this->next_execution_at) {
            return [];
        }

        $scheduled = [];
        $now = now();

        $excludedClientIds = $this->excluded_client_ids ?? [];
        $excludedAutomovilIds = $this->excluded_automovil_ids ?? [];
        $excludedVehicleClasses = array_map('strtoupper', $this->excluded_vehicle_classes ?? []);

        $types = [];
        if ($this->notify_soat) $types[] = 'soat';
        if ($this->notify_rtm) $types[] = 'rtm';

        foreach ($types as $type) {
            $daysArray = $this->getDaysBeforeForType($type);
            $maxDays = max($daysArray);

            $dateField = $type === 'soat' ? 'fecha_vencimiento_soat' : 'fecha_vencimiento_rtm';

            $query = Automovil::forBroker($this->broker_id)
                ->whereNotNull($dateField)
                ->with('client');

            if (!empty($excludedClientIds)) {
                $query->whereNotIn('client_id', $excludedClientIds);
            }
            if (!empty($excludedAutomovilIds)) {
                $query->whereNotIn('id', $excludedAutomovilIds);
            }
            if (!empty($excludedVehicleClasses)) {
                $query->where(function($q) use ($excludedVehicleClasses) {
                    $q->whereNull('clase')
                      ->orWhereNotIn(\DB::raw('UPPER(clase)'), $excludedVehicleClasses);
                });
            }

            $dateFrom = $now->copy()->startOfDay();
            $dateTo = $now->copy()->startOfDay()->addDays($maxDays + 1);

            $query->whereDate($dateField, '>=', $dateFrom)
                  ->whereDate($dateField, '<=', $dateTo);

            // Excluir los ya notificados hoy para este tipo
            $query->whereDoesntHave('notificationLogs', function($q) use ($type) {
                $q->where('notification_type', $type)
                  ->where('created_at', '>=', now()->startOfDay());
            });

            $autos = $query->limit(30)->get();

            foreach ($autos as $auto) {
                $client = $auto->client;
                $eventDate = $auto->{$dateField};
                if (!$eventDate) continue;

                $daysUntilEvent = max(0, (int)$now->diffInDays($eventDate, false));

                $applicableReminder = null;
                foreach ($daysArray as $daysBefore) {
                    if ($daysUntilEvent <= $daysBefore && $daysUntilEvent >= 0) {
                        $applicableReminder = $daysBefore;
                        break;
                    }
                }

                $sendDate = $this->calculateSendDateForAuto($eventDate, $daysArray);

                $scheduled[] = [
                    'automovil_id' => $auto->id,
                    'placa' => $auto->placa ?? '-',
                    'vehiculo' => trim(($auto->marca ?? '') . ' ' . ($auto->linea ?? '') . ' ' . ($auto->anio ?? '')),
                    'client_name' => $client
                        ? ($client->full_name ?? trim(($client->first_name ?? '') . ' ' . ($client->last_name ?? '')) ?: '-')
                        : '-',
                    'notification_type' => $type,
                    'notification_type_label' => $type === 'soat' ? 'SOAT' : 'Técnico-mecánica',
                    'event_date' => $eventDate->format('Y-m-d'),
                    'days_until_event' => $daysUntilEvent,
                    'days_before_reminder' => $applicableReminder ?? $daysUntilEvent,
                    'scheduled_send_at' => $sendDate?->format('Y-m-d H:i:s'),
                    'scheduled_send_at_human' => $sendDate?->diffForHumans() ?? 'Próximamente',
                ];
            }
        }

        usort($scheduled, fn($a, $b) => ($a['days_until_event'] ?? 999) <=> ($b['days_until_event'] ?? 999));

        return array_slice($scheduled, 0, $limit);
    }

    private function calculateSendDateForAuto($eventDate, array $daysArray): ?\Carbon\Carbon
    {
        $now = now();
        $sendDays = $this->send_days ?? [1, 2, 3, 4, 5];
        $sendTime = $this->send_time ?? '09:00:00';

        rsort($daysArray);

        foreach ($daysArray as $daysBefore) {
            $sendDate = $eventDate->copy()->subDays($daysBefore)->setTimeFromTimeString($sendTime);
            if ($sendDate->lt($now)) continue;

            $maxAttempts = 14;
            $attempts = 0;
            while ($attempts < $maxAttempts) {
                $dayOfWeek = $sendDate->dayOfWeek;
                if (in_array($dayOfWeek, $sendDays)) {
                    if (!($this->skip_weekends && in_array($dayOfWeek, [0, 6]))) {
                        return $sendDate;
                    }
                }
                $sendDate->addDay();
                $attempts++;
            }
        }

        return $this->next_execution_at;
    }

    public function getStats(): array
    {
        $recentLogs = $this->logs()
            ->where('created_at', '>=', now()->subDays(30))
            ->selectRaw('
                COUNT(*) as total,
                SUM(CASE WHEN status = "sent" THEN 1 ELSE 0 END) as sent,
                SUM(CASE WHEN status = "failed" THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN status = "skipped" THEN 1 ELSE 0 END) as skipped
            ')
            ->first();

        if ($this->is_active && (!$this->next_execution_at || $this->next_execution_at->isPast())) {
            $this->calculateNextExecution();
            $this->refresh();
        }

        return [
            'total_sent' => $this->total_sent ?? 0,
            'total_failed' => $this->total_failed ?? 0,
            'last_30_days' => [
                'total' => $recentLogs->total ?? 0,
                'sent' => $recentLogs->sent ?? 0,
                'failed' => $recentLogs->failed ?? 0,
                'skipped' => $recentLogs->skipped ?? 0,
            ],
            'success_rate' => ($this->total_sent ?? 0) > 0
                ? round(($this->total_sent / ($this->total_sent + ($this->total_failed ?? 0))) * 100, 2)
                : 0,
            'last_execution' => $this->last_execution_at?->diffForHumans() ?? 'Nunca',
            'last_execution_at' => $this->last_execution_at?->format('Y-m-d H:i:s'),
            'last_execution_formatted' => $this->last_execution_at?->format('d/m/Y H:i'),
            'next_execution' => $this->next_execution_at?->diffForHumans(),
            'next_execution_at' => $this->next_execution_at?->format('Y-m-d H:i:s'),
            'next_execution_formatted' => $this->next_execution_at?->format('d/m/Y H:i'),
            'send_time' => substr($this->send_time ?? '09:00:00', 0, 5),
            'send_days' => $this->send_days ?? [1, 2, 3, 4, 5],
        ];
    }
}
