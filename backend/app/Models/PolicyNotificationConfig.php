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
            '{{end_date}}' => $policy->end_date ? $policy->end_date->format('d/m/Y') : 'N/A',
            '{{renewal_date}}' => $policy->renewal_date ? $policy->renewal_date->format('d/m/Y') : 'N/A',
            '{{payment_due_date}}' => $policy->payment_due_date ? $policy->payment_due_date->format('d/m/Y') : 'N/A',
            '{{premium_amount}}' => number_format($policy->premium_amount, 0, ',', '.'),
            '{{total_amount}}' => number_format($policy->total_amount, 0, ',', '.'),
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
     * Calcular próxima ejecución
     */
    public function calculateNextExecution(): void
    {
        $this->update([
            'next_execution_at' => now()->addDay()->setTimeFromTimeString($this->send_time)
        ]);
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

        return [
            'total_sent' => $this->total_sent,
            'total_failed' => $this->total_failed,
            'last_30_days' => [
                'total' => $recentLogs->total ?? 0,
                'sent' => $recentLogs->sent ?? 0,
                'failed' => $recentLogs->failed ?? 0,
                'skipped' => $recentLogs->skipped ?? 0,
            ],
            'success_rate' => $this->total_sent > 0 
                ? round(($this->total_sent / ($this->total_sent + $this->total_failed)) * 100, 2)
                : 0,
            'last_execution' => $this->last_execution_at?->diffForHumans(),
            'next_execution' => $this->next_execution_at?->diffForHumans(),
        ];
    }
}