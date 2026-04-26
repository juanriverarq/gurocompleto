<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\BrokerScoped;

class PolicyNotificationConfig extends Model
{
    use HasFactory, SoftDeletes, BrokerScoped;

    protected $fillable = [
        'broker_id',
        'whatsapp_instance_id',
        'is_active',
        'name',
        'description',
        'notify_expiration',
        'notify_renewal',
        'notify_payment_due',
        'expiration_days_before',
        'renewal_days_before',
        'payment_days_before',
        'expiration_days_before_multiple',
        'renewal_days_before_multiple',
        'payment_days_before_multiple',
        'expiration_template',
        'renewal_template',
        'payment_template',
        'send_time',
        'send_days',
        'excluded_client_ids',
        'excluded_policy_types',
        'excluded_policy_statuses',
        'excluded_ramo_ids',
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
        'notify_expiration' => 'boolean',
        'notify_renewal' => 'boolean',
        'notify_payment_due' => 'boolean',
        'send_days' => 'array',
        'expiration_days_before_multiple' => 'array',
        'renewal_days_before_multiple' => 'array',
        'payment_days_before_multiple' => 'array',
        'excluded_client_ids' => 'array',
        'excluded_policy_types' => 'array',
        'excluded_policy_statuses' => 'array',
        'excluded_ramo_ids' => 'array',
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
        return $this->hasMany(PolicyNotificationLog::class);
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

    /**
     * Verificar si la instancia de WhatsApp está conectada
     */
    public function isWhatsAppConnected(): bool
    {
        if (!$this->whatsappInstance) {
            return false;
        }

        return $this->whatsappInstance->isConnected();
    }

    /**
     * Obtener el estado de la instancia de WhatsApp
     */
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

    /**
     * Verificar si un cliente está excluido
     */
    public function isClientExcluded(int $clientId): bool
    {
        $excluded = $this->excluded_client_ids ?? [];
        return in_array($clientId, $excluded);
    }

    /**
     * Verificar si un tipo de póliza está excluido
     */
    public function isPolicyTypeExcluded(string $policyType): bool
    {
        $excluded = $this->excluded_policy_types ?? [];
        return in_array($policyType, $excluded);
    }

    /**
     * Verificar si un estado de póliza está excluido
     */
    public function isPolicyStatusExcluded(string $policyStatus): bool
    {
        $excluded = $this->excluded_policy_statuses ?? [];
        return in_array($policyStatus, $excluded);
    }

    /**
     * Verificar si debe enviar hoy
     */
    public function shouldSendToday(): bool
    {
        if (!$this->is_active) {
            return false;
        }

        $today = now()->dayOfWeek; // 0 = Domingo, 6 = Sábado

        // Verificar si es fin de semana y debe saltarse
        if ($this->skip_weekends && in_array($today, [0, 6])) {
            return false;
        }

        // Verificar días permitidos
        $sendDays = $this->send_days ?? [1, 2, 3, 4, 5]; // Por defecto Lun-Vie
        if (!in_array($today, $sendDays)) {
            return false;
        }

        // Verificar hora de envío (con margen de 1 minuto)
        $currentTime = now()->format('H:i');
        $sendTime = substr($this->send_time, 0, 5); // Obtener solo HH:mm
        
        return $currentTime === $sendTime;
    }

    /**
     * Obtener días de anticipación (soporta múltiples)
     */
    public function getDaysBeforeForType(string $type): array
    {
        $multipleField = $type . '_days_before_multiple';
        $singleField = $type . '_days_before';
        
        // Preferir el campo múltiple si existe
        if (!empty($this->$multipleField)) {
            return $this->$multipleField;
        }
        
        // Fallback al campo único
        if (!empty($this->$singleField)) {
            return [$this->$singleField];
        }
        
        // Valores por defecto
        $defaults = [
            'expiration' => [30],
            'renewal' => [45],
            'payment' => [7],
        ];
        
        return $defaults[$type] ?? [30];
    }

    /**
     * Obtener plantilla de mensaje según tipo
     */
    public function getTemplate(string $type): string
    {
        $templates = [
            'expiration' => $this->expiration_template,
            'renewal' => $this->renewal_template,
            'payment_due' => $this->payment_template,
        ];

        return $templates[$type] ?? $this->getDefaultTemplate($type);
    }

    /**
     * Obtener plantilla por defecto
     */
    private function getDefaultTemplate(string $type): string
    {
        $defaults = [
            'expiration' => 'Hola {{client_name}}, te recordamos que tu póliza {{policy_number}} de {{insurance_company}} vence el {{end_date}}. Contáctanos para renovarla.',
            'renewal' => 'Hola {{client_name}}, es momento de renovar tu póliza {{policy_number}}. La fecha de renovación es {{renewal_date}}. ¿Te gustaría que te ayudemos?',
            'payment_due' => 'Hola {{client_name}}, te recordamos que el pago de tu póliza {{policy_number}} vence el {{payment_due_date}}. Monto: ${{premium_amount}}.',
        ];

        return $defaults[$type] ?? 'Notificación de póliza {{policy_number}}';
    }

    /**
     * Procesar variables en plantilla
     */
    public function processTemplate(string $template, Poliza $policy): string
    {
        $client = $policy->client;
        
        $variables = [
            '{{client_name}}' => $client ? $client->full_name : $policy->client_name,
            '{{policy_number}}' => $policy->policy_number,
            '{{insurance_company}}' => $policy->insurance_company,
            '{{product_name}}' => $policy->product_name,
            '{{ramo_name}}' => $policy->ramo ? ($policy->ramo->nombre ?? '-') : ($policy->product_name ?? '-'),
            '{{end_date}}' => $policy->end_date ? $policy->end_date->format('d/m/Y') : 'N/A',
            '{{renewal_date}}' => $policy->renewal_date ? $policy->renewal_date->format('d/m/Y') : 'N/A',
            '{{payment_due_date}}' => $policy->payment_due_date ? $policy->payment_due_date->format('d/m/Y') : 'N/A',
            '{{premium_amount}}' => number_format($policy->premium_amount, 0, ',', '.'),
            '{{total_amount}}' => number_format($policy->total_amount, 0, ',', '.'),
            '{{riesgo}}' => $policy->description ?? '-',
            '{{days_until_expiration}}' => $policy->getDaysUntilExpiration(),
            '{{days_until_renewal}}' => $policy->getDaysUntilRenewal(),
            '{{days_until_payment}}' => $policy->getDaysUntilPaymentDue(),
        ];

        return str_replace(array_keys($variables), array_values($variables), $template);
    }

    /**
     * Actualizar estadísticas
     */
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
     * Calcular próxima ejecución basada en la configuración actual
     * Considera: hora de envío, días permitidos, skip weekends
     */
    public function calculateNextExecution(): void
    {
        if (!$this->is_active) {
            $this->update(['next_execution_at' => null]);
            return;
        }

        $sendDays = $this->send_days ?? [1, 2, 3, 4, 5]; // Por defecto Lun-Vie
        $sendTime = $this->send_time ?? '09:00:00';
        
        // Empezar desde ahora
        $nextExecution = now()->copy();
        
        // Si ya pasó la hora de hoy, empezar desde mañana
        $todayAtSendTime = now()->copy()->setTimeFromTimeString($sendTime);
        if (now()->gte($todayAtSendTime)) {
            $nextExecution = $nextExecution->addDay();
        }
        
        // Establecer la hora de envío
        $nextExecution->setTimeFromTimeString($sendTime);
        
        // Buscar el próximo día válido (máximo 14 días para evitar loops infinitos)
        $maxAttempts = 14;
        $attempts = 0;
        
        while ($attempts < $maxAttempts) {
            $dayOfWeek = $nextExecution->dayOfWeek; // 0 = Domingo, 6 = Sábado
            
            // Verificar si es un día permitido
            if (in_array($dayOfWeek, $sendDays)) {
                // Verificar skip_weekends
                if ($this->skip_weekends && in_array($dayOfWeek, [0, 6])) {
                    $nextExecution->addDay();
                    $attempts++;
                    continue;
                }
                
                // Encontramos un día válido
                break;
            }
            
            $nextExecution->addDay();
            $attempts++;
        }
        
        $this->update(['next_execution_at' => $nextExecution]);
    }

    /**
     * Obtener próximos envíos programados con detalle
     * Retorna las pólizas que se notificarán y cuándo
     */
    public function getScheduledNotifications(int $limit = 50): array
    {
        if (!$this->is_active || !$this->next_execution_at) {
            return [];
        }

        $scheduled = [];
        $now = now();

        // Obtener exclusiones
        $excludedClientIds = $this->excluded_client_ids ?? [];
        $excludedPolicyTypes = $this->excluded_policy_types ?? [];
        $excludedPolicyStatuses = $this->excluded_policy_statuses ?? [];
        $excludedRamoIds = $this->excluded_ramo_ids ?? [];

        // Para cada tipo de notificación habilitado
        $types = [];
        if ($this->notify_expiration) $types[] = 'expiration';
        if ($this->notify_renewal) $types[] = 'renewal';
        if ($this->notify_payment_due) $types[] = 'payment_due';

        foreach ($types as $type) {
            $daysArray = $this->getDaysBeforeForType($type);
            $maxDays = max($daysArray);
            
            // Buscar todas las pólizas que vencen/renuevan/pagan dentro del rango máximo de días
            // Incluir múltiples variantes de estados activos
            $activeStatuses = ['active', 'issued', 'accrued', 'vigente', 'activa', 'emitida', 'devengada', 'pending', 'pendiente'];
            $query = \App\Models\Poliza::forBroker($this->broker_id)
                ->where(function($q) use ($activeStatuses) {
                    $q->whereIn('status', $activeStatuses)
                      ->orWhereIn(\DB::raw('LOWER(status)'), $activeStatuses);
                })
                ->with('client');

            // Excluir clientes
            if (!empty($excludedClientIds)) {
                $query->whereNotIn('client_id', $excludedClientIds);
            }

            // Excluir tipos de póliza (ramos)
            if (!empty($excludedPolicyTypes)) {
                $query->where(function($q) use ($excludedPolicyTypes) {
                    $q->whereNull('type')
                      ->orWhereNotIn('type', $excludedPolicyTypes);
                });
            }

            // Excluir estados de póliza
            if (!empty($excludedPolicyStatuses)) {
                $query->whereNotIn('status', array_map('strtolower', $excludedPolicyStatuses));
            }

            // Excluir ramos por ID
            if (!empty($excludedRamoIds)) {
                $query->where(function($q) use ($excludedRamoIds) {
                    $q->whereNull('ramo_id')
                      ->orWhereNotIn('ramo_id', $excludedRamoIds);
                });
            }

            // Calcular rango de fechas (desde hoy a las 00:00 hasta maxDays+1 días)
            // Esto incluye: día 0 = hoy, día 1 = mañana, etc.
            $dateFrom = $now->copy()->startOfDay();
            $dateTo = $now->copy()->startOfDay()->addDays($maxDays + 1);

            // Filtrar por fecha según tipo - buscar todas las pólizas dentro del rango máximo
            switch ($type) {
                case 'expiration':
                    $query->whereNotNull('end_date')
                          ->whereDate('end_date', '>=', $dateFrom)
                          ->whereDate('end_date', '<=', $dateTo);
                    break;
                case 'renewal':
                    $query->where(function($q) use ($dateFrom, $dateTo) {
                        $q->where(function($q2) use ($dateFrom, $dateTo) {
                            $q2->whereNotNull('renewal_date')
                               ->whereDate('renewal_date', '>=', $dateFrom)
                               ->whereDate('renewal_date', '<=', $dateTo);
                        })->orWhere(function($q2) use ($dateFrom, $dateTo) {
                            $q2->whereNotNull('end_date')
                               ->whereDate('end_date', '>=', $dateFrom)
                               ->whereDate('end_date', '<=', $dateTo);
                        });
                    });
                    break;
                case 'payment_due':
                    $query->whereNotNull('payment_due_date')
                          ->whereDate('payment_due_date', '>=', $dateFrom)
                          ->whereDate('payment_due_date', '<=', $dateTo);
                    break;
            }

            // Excluir pólizas ya notificadas hoy para este tipo
            $query->whereDoesntHave('notificationLogs', function($q) use ($type) {
                $q->where('notification_type', $type)
                  ->where('created_at', '>=', now()->startOfDay());
            });

            $policies = $query->limit(30)->get();
            
            foreach ($policies as $policy) {
                $client = $policy->client;
                $eventDate = match($type) {
                    'expiration' => $policy->end_date,
                    'renewal' => $policy->renewal_date ?? $policy->end_date,
                    'payment_due' => $policy->payment_due_date,
                    default => null
                };
                
                if (!$eventDate) continue;
                
                $daysUntilEvent = max(0, (int)$now->diffInDays($eventDate, false));
                
                // Encontrar cuál recordatorio aplica para esta póliza
                $applicableReminder = null;
                foreach ($daysArray as $daysBefore) {
                    if ($daysUntilEvent <= $daysBefore && $daysUntilEvent >= 0) {
                        $applicableReminder = $daysBefore;
                        break;
                    }
                }
                
                // Calcular cuándo se enviará esta notificación
                $sendDate = $this->calculateSendDateForPolicy($eventDate, $daysArray);

                $scheduled[] = [
                    'policy_id' => $policy->id,
                    'policy_number' => $policy->policy_number ?? $policy->numero_poliza ?? '-',
                    'client_name' => $client 
                        ? ($client->full_name ?? $client->nombre_completo ?? 
                           trim(($client->first_name ?? '') . ' ' . ($client->last_name ?? '')) ?: '-')
                        : '-',
                    'notification_type' => $type,
                    'notification_type_label' => match($type) {
                        'expiration' => 'Vencimiento',
                        'renewal' => 'Renovación',
                        'payment_due' => 'Pago',
                        default => $type
                    },
                    'event_date' => $eventDate->format('Y-m-d'),
                    'days_until_event' => $daysUntilEvent,
                    'days_before_reminder' => $applicableReminder ?? $daysUntilEvent,
                    'scheduled_send_at' => $sendDate?->format('Y-m-d H:i:s'),
                    'scheduled_send_at_human' => $sendDate?->diffForHumans() ?? 'Próximamente',
                ];
            }
        }

        // Ordenar por fecha de evento
        usort($scheduled, fn($a, $b) => ($a['days_until_event'] ?? 999) <=> ($b['days_until_event'] ?? 999));

        return array_slice($scheduled, 0, $limit);
    }

    /**
     * Calcular cuándo se enviará la notificación para una póliza específica
     */
    private function calculateSendDateForPolicy($eventDate, array $daysArray): ?\Carbon\Carbon
    {
        $now = now();
        $sendDays = $this->send_days ?? [1, 2, 3, 4, 5];
        $sendTime = $this->send_time ?? '09:00:00';
        
        // Ordenar días de anticipación de mayor a menor
        rsort($daysArray);
        
        foreach ($daysArray as $daysBefore) {
            $sendDate = $eventDate->copy()->subDays($daysBefore)->setTimeFromTimeString($sendTime);
            
            // Si la fecha de envío ya pasó, continuar al siguiente recordatorio
            if ($sendDate->lt($now)) {
                continue;
            }
            
            // Buscar el próximo día válido desde la fecha de envío
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

    /**
     * Obtener estadísticas
     */
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

        // Recalcular próxima ejecución si es necesario
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
            // Última ejecución
            'last_execution' => $this->last_execution_at?->diffForHumans() ?? 'Nunca',
            'last_execution_at' => $this->last_execution_at?->format('Y-m-d H:i:s'),
            'last_execution_formatted' => $this->last_execution_at?->format('d/m/Y H:i') ?? 'Nunca',
            // Próxima ejecución
            'next_execution' => $this->next_execution_at?->diffForHumans() ?? 'No programada',
            'next_execution_at' => $this->next_execution_at?->format('Y-m-d H:i:s'),
            'next_execution_formatted' => $this->next_execution_at?->format('d/m/Y H:i') ?? 'No programada',
            // Configuración de envío
            'send_time' => $this->send_time,
            'send_days' => $this->send_days ?? [1, 2, 3, 4, 5],
        ];
    }
}