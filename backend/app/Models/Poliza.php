<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\BrokerScoped;
use App\Models\PagoPoliza;
use App\Models\CobroComision;
use App\Models\PolicyNotificationLog;
use App\Events\PolizaCreated;

class Poliza extends Model
{
    use HasFactory, SoftDeletes, BrokerScoped;

    /**
     * The event map for the model.
     *
     * @var array
     */
    protected $dispatchesEvents = [
        'created' => PolizaCreated::class,
    ];

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'broker_id',
        'policy_number',
        'internal_number',
        'type',
        'product_name',
        'insurance_company',
        'aseguradora_id',
        'ramo_id',
        'description',
        'client_id',
        'client_name',
        'client_document',
        'issue_date',
        'start_date',
        'end_date',
        'payment_due_date',
        'renewal_date',
        'premium_amount',
        'insured_amount',
        'deductible',
        'commission_percentage',
        'commission_amount',
        'vat_percentage',
        'vat_amount',
        'total_amount',
        'gastos_adicionales',
        'gastos_adicionales_aplica_iva',
        'payment_frequency',
        'payment_method',
        'bank_name',
        'half_payment',
        'installments_count',
        'card_last4',
        'cheque_number',
        'agreement_term',
        'debit_account_number',
        'status',
        'payment_status',
        'status_notes',
        'beneficiary_name',
        'beneficiary_document',
        'beneficiary_relationship',
        'beneficiary_phone',
        'beneficiaries',
        'policy_holder_name',
        'policy_holder_document',
        'policy_holder_doc_type',
        'policy_holder_phone',
        'policy_holder_email',
        'policy_holder_address',
        'policy_holder_city',
        'insured_name',
        'insured_document',
        'assigned_user_id',
        'seller_name',
        'seller_id',
        'seller_id_2',
        'seller_name_2',
        'external_link',
        'created_by',
        'notes',
        'custom_fields',
        'documents',
        'vehicle_plates',
        'auto_renewal',
        'renewal_days_notice',
        'last_renewal_notice_sent',
        'updated_by',
        'cancelled_at',
        'cancelled_by',
        'cancellation_reason',
        'non_renewal_reason',
        // Nuevos campos agregados por migración 2025_08_11
        'reception_date',
        
        'reason',
        'pri_a_pre',
        'participation',
        'co_brokerage',
        'agency_commission',
        'withholding_percentage',
        'reteiva_percentage',
        
        'beneficiary_in_remittance',

        // Campos SoftSeguros migración 2026_02_28
        // Comisiones detalladas
        'iva_comision',
        'porcentaje_sobrecomision',
        'sobrecomision',
        'porcentaje_comision_vendedor',
        'comision_vendedor',
        'porcentaje_comision_tecnico',
        'comision_tecnico',
        'porcentaje_comision_sede',
        'comision_sede',
        'comision_recibida',
        'total_pagado',
        // Financiación
        'porcentaje_financiacion',
        'valor_financiacion',
        'total_poliza_financiada',
        'financiacion_incluye_comision',
        'financiacion_calcular_iva',
        // Cartera / Recaudo
        'estado_cartera',
        'comisionada',
        'recaudado',
        'recaudado_en_oficina',
        'fecha_recaudo',
        // Tipo de póliza
        'tipo_poliza',
        'colectiva',
        'masiva',
        // SOAT / ARL
        'soat',
        'arl',
        // Moneda
        'tipo_moneda',
        'tasa_cambio',
        // Impuestos adicionales
        'porcentaje_impuesto_bomberos',
        'impuesto_bomberos',
        'aporte_sbs',
        'aporte_seguro_campesino',
        'prima_asistencia',
        'otros_cargos',
        // Periodicidad / Clasificación
        'periodicidad',
        'clasificacion_poliza',
        'numero_renovacion',
        'is_renewal',
        // Coaseguro
        'coinsurance_participation',
        // Notificaciones
        'notification_preferences',
        // Objeto asegurado
        'datos_objeto_asegurado',
        'accesorios',
        'lugar_expedicion',
        // Forma pago detallada
        'forma_pago_detalle',
        // Relaciones extra
        'sede_nombre',
        'softseguros_id',
        // Eliminación SoftSeguros
        'motivo_eliminacion',
        'fecha_eliminacion',

        // Sincronización detalle (microservicio aseguradoras)
        'detail_sync_status',
        'detail_sync_at',
        'detail_sync_error',
        'detail_sync_insurer_connection_id',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'issue_date' => 'date',
        'start_date' => 'date',
        'end_date' => 'date',
        'payment_due_date' => 'date',
        'renewal_date' => 'date',
        'premium_amount' => 'decimal:2',
        'insured_amount' => 'decimal:2',
        'deductible' => 'decimal:2',
        'commission_percentage' => 'decimal:2',
        'commission_amount' => 'decimal:2',
        'vat_percentage' => 'decimal:2',
        'vat_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'gastos_adicionales' => 'decimal:2',
        'gastos_adicionales_aplica_iva' => 'boolean',
        'custom_fields' => 'array',
        'documents' => 'array',
        'vehicle_plates' => 'array',
        'beneficiaries' => 'array',
        'auto_renewal' => 'boolean',
        'last_renewal_notice_sent' => 'datetime',
        'cancelled_at' => 'datetime',
        // Nuevos casts
        'reception_date' => 'date',
        
        'beneficiary_in_remittance' => 'boolean',

        // Casts SoftSeguros migración 2026_02_28
        'iva_comision' => 'decimal:2',
        'porcentaje_sobrecomision' => 'decimal:2',
        'sobrecomision' => 'decimal:2',
        'porcentaje_comision_vendedor' => 'decimal:2',
        'comision_vendedor' => 'decimal:2',
        'porcentaje_comision_tecnico' => 'decimal:2',
        'comision_tecnico' => 'decimal:2',
        'porcentaje_comision_sede' => 'decimal:2',
        'comision_sede' => 'decimal:2',
        'comision_recibida' => 'decimal:2',
        'total_pagado' => 'decimal:2',
        'porcentaje_financiacion' => 'decimal:2',
        'valor_financiacion' => 'decimal:2',
        'total_poliza_financiada' => 'decimal:2',
        'financiacion_incluye_comision' => 'boolean',
        'financiacion_calcular_iva' => 'boolean',
        'comisionada' => 'boolean',
        'recaudado' => 'boolean',
        'recaudado_en_oficina' => 'boolean',
        'fecha_recaudo' => 'date',
        'colectiva' => 'boolean',
        'masiva' => 'boolean',
        'soat' => 'boolean',
        'arl' => 'boolean',
        'tasa_cambio' => 'decimal:4',
        'porcentaje_impuesto_bomberos' => 'decimal:2',
        'impuesto_bomberos' => 'decimal:2',
        'aporte_sbs' => 'decimal:2',
        'aporte_seguro_campesino' => 'decimal:2',
        'prima_asistencia' => 'decimal:2',
        'otros_cargos' => 'decimal:2',
        'is_renewal' => 'boolean',
        'coinsurance_participation' => 'decimal:2',
        'notification_preferences' => 'array',
        'forma_pago_detalle' => 'array',
        'fecha_eliminacion' => 'datetime',

        'detail_sync_at' => 'datetime',
    ];

    // ===== RELACIONES =====

    public function coverages(): HasMany
    {
        return $this->hasMany(PolizaCoverage::class);
    }

    /**
     * Relación con el broker
     */
    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    /**
     * Relación con el cliente
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Cliente::class);
    }

    /**
     * Relación con la aseguradora (catálogo)
     */
    public function aseguradora(): BelongsTo
    {
        return $this->belongsTo(Aseguradora::class, 'aseguradora_id');
    }

    /**
     * Relación con el ramo (catálogo)
     */
    public function ramo(): BelongsTo
    {
        return $this->belongsTo(Ramo::class, 'ramo_id');
    }

    /**
     * Relación con el vendedor principal
     */
    public function vendedor(): BelongsTo
    {
        return $this->belongsTo(Vendedor::class, 'seller_id');
    }

    /**
     * Relación con el segundo vendedor (opcional)
     */
    public function vendedor2(): BelongsTo
    {
        return $this->belongsTo(Vendedor::class, 'seller_id_2');
    }

    /**
     * Relación con automóviles asociados por poliza_id
     */
    public function automoviles(): HasMany
    {
        return $this->hasMany(Automovil::class, 'poliza_id');
    }

    /**
     * Relación con vinculados (riesgos de pólizas colectivas)
     */
    public function vinculados(): HasMany
    {
        return $this->hasMany(PolizaVinculado::class, 'poliza_id');
    }

    /**
     * Verificar si es póliza colectiva
     */
    public function isColectiva(): bool
    {
        $cf = is_array($this->custom_fields) ? $this->custom_fields : [];
        return ($cf['policy_category'] ?? null) === 'colectiva'
            || (bool) $this->colectiva
            || $this->tipo_poliza === 'colectiva';
    }

    /**
     * Relación con pagos de póliza
     */
    public function pagos(): HasMany
    {
        return $this->hasMany(PagoPoliza::class, 'poliza_id');
    }

    /**
     * Relación con cobros de comisión
     */
    public function cobrosComision(): HasMany
    {
        return $this->hasMany(CobroComision::class, 'poliza_id');
    }

    /**
     * Relación con detalles de liquidaciones de vendedores
     */
    public function liquidacionesDetalle(): HasMany
    {
        return $this->hasMany(LiquidacionVendedorDetalle::class, 'poliza_id');
    }

    /**
     * Relación con el usuario asignado
     */
    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    /**
     * Relación con el usuario que creó la póliza
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Relación con el usuario que actualizó la póliza
     */
    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Relación con el usuario que canceló la póliza
     */
    public function cancelledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }

    /**
     * Relación con logs de notificaciones
     */
    public function notificationLogs(): HasMany
    {
        return $this->hasMany(PolicyNotificationLog::class, 'poliza_id');
    }

    // ===== SCOPES =====

    /**
     * Scope para pólizas activas
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope para pólizas pendientes
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    /**
     * Scope para pólizas expiradas
     */
    public function scopeExpired($query)
    {
        return $query->where('status', 'expired');
    }

    /**
     * Scope para pólizas canceladas
     */
    public function scopeCancelled($query)
    {
        return $query->where('status', 'cancelled');
    }

    /**
     * Scope para pólizas por broker
     */
    public function scopeByBroker($query, $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }

    /**
     * Scope para pólizas por cliente
     */
    public function scopeByClient($query, $clientId)
    {
        return $query->where('client_id', $clientId);
    }

    /**
     * Scope para pólizas por usuario asignado
     */
    public function scopeByAssignedUser($query, $userId)
    {
        return $query->where('assigned_user_id', $userId);
    }

    /**
     * Scope para pólizas por tipo
     */
    public function scopeByType($query, $type)
    {
        return $query->where('type', $type);
    }

    /**
     * Scope para pólizas por compañía
     */
    public function scopeByInsuranceCompany($query, $company)
    {
        return $query->where('insurance_company', $company);
    }

    /**
     * Scope para búsqueda
     */
    public function scopeSearch($query, $term)
    {
        return $query->where(function ($q) use ($term) {
            $q->where('policy_number', 'like', "%{$term}%")
              ->orWhere('internal_number', 'like', "%{$term}%")
              ->orWhere('client_name', 'like', "%{$term}%")
              ->orWhere('client_document', 'like', "%{$term}%")
              ->orWhere('product_name', 'like', "%{$term}%")
              ->orWhere('insurance_company', 'like', "%{$term}%");
        });
    }

    /**
     * Scope para pólizas próximas a vencer
     */
    public function scopeExpiringSoon($query, $days = 30)
    {
        return $query->where('end_date', '>=', now())
                     ->where('end_date', '<=', now()->addDays($days));
    }

    /**
     * Scope para pólizas con pago vencido
     */
    public function scopePaymentOverdue($query)
    {
        return $query->where('payment_status', 'overdue')
                     ->orWhere(function ($q) {
                         $q->where('payment_status', 'pending')
                           ->where('payment_due_date', '<', now());
                     });
    }

    /**
     * Scope para pólizas que necesitan renovación
     */
    public function scopeNeedsRenewal($query, $days = 30)
    {
        return $query->where('renewal_date', '>=', now())
                     ->where('renewal_date', '<=', now()->addDays($days));
    }

    // ===== MÉTODOS DE UTILIDAD =====

    /**
     * Verificar si la póliza está activa
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /**
     * Verificar si la póliza está pendiente
     */
    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    /**
     * Verificar si la póliza está expirada
     */
    public function isExpired(): bool
    {
        return $this->status === 'expired' || $this->end_date->isPast();
    }

    /**
     * Verificar si la póliza está cancelada
     */
    public function isCancelled(): bool
    {
        return $this->status === 'cancelled';
    }

    /**
     * Verificar si el pago está al día
     */
    public function isPaymentCurrent(): bool
    {
        return $this->payment_status === 'paid';
    }

    /**
     * Verificar si el pago está vencido
     */
    public function isPaymentOverdue(): bool
    {
        return $this->payment_status === 'overdue' || 
               ($this->payment_status === 'pending' && $this->payment_due_date && $this->payment_due_date->isPast());
    }

    /**
     * Obtener el nombre del tipo de póliza
     */
    public function getTypeNameAttribute(): string
    {
        $types = [
            'vida' => 'Vida',
            'autos' => 'Autos',
            'hogar' => 'Hogar',
            'empresarial' => 'Empresarial',
            'salud' => 'Salud',
            'accidentes' => 'Accidentes',
            'responsabilidad_civil' => 'Responsabilidad Civil',
            'otros' => 'Otros',
        ];
        
        return $types[$this->type] ?? $this->type;
    }

    /**
     * Obtener el nombre del estado
     */
    public function getStatusNameAttribute(): string
    {
        $statuses = [
            'active' => 'Activa',
            'inactive' => 'Inactiva',
            'expired' => 'Expirada',
            'cancelled' => 'Cancelada',
            'suspended' => 'Suspendida',
            'pending' => 'Pendiente',
        ];
        
        return $statuses[$this->status] ?? $this->status;
    }

    /**
     * Obtener el nombre del estado de pago
     */
    public function getPaymentStatusNameAttribute(): string
    {
        $statuses = [
            'paid' => 'Pagada',
            'pending' => 'Pendiente',
            'overdue' => 'Vencida',
            'cancelled' => 'Cancelada',
        ];
        
        return $statuses[$this->payment_status] ?? $this->payment_status;
    }

    /**
     * Obtener el nombre de la frecuencia de pago
     */
    public function getPaymentFrequencyNameAttribute(): string
    {
        $frequencies = [
            'monthly' => 'Mensual',
            'quarterly' => 'Trimestral',
            'biannual' => 'Semestral',
            'annual' => 'Anual',
        ];
        
        return $frequencies[$this->payment_frequency] ?? $this->payment_frequency;
    }

    /**
     * Obtener días hasta el vencimiento
     */
    public function getDaysUntilExpiration(): int
    {
        if (!$this->end_date) {
            return 0;
        }
        
        return (int) round(max(0, now()->diffInDays($this->end_date, false)));
    }

    /**
     * Obtener días hasta la renovación
     */
    public function getDaysUntilRenewal(): int
    {
        if (!$this->renewal_date) {
            return 0;
        }
        
        return (int) round(max(0, now()->diffInDays($this->renewal_date, false)));
    }

    /**
     * Obtener días hasta el vencimiento del pago
     */
    public function getDaysUntilPaymentDue(): int
    {
        if (!$this->payment_due_date) {
            return 0;
        }
        
        return (int) round(max(0, now()->diffInDays($this->payment_due_date, false)));
    }

    /**
     * Verificar si está próxima a vencer
     */
    public function isExpiringSoon(int $days = 30): bool
    {
        return $this->getDaysUntilExpiration() <= $days && $this->getDaysUntilExpiration() > 0;
    }

    /**
     * Verificar si necesita renovación
     */
    public function needsRenewal(int $days = 30): bool
    {
        return $this->getDaysUntilRenewal() <= $days && $this->getDaysUntilRenewal() > 0;
    }

    /**
     * Calcular la comisión automáticamente
     */
    public function calculateCommission(): void
    {
        if ($this->commission_percentage && $this->premium_amount) {
            $this->commission_amount = ($this->premium_amount * $this->commission_percentage) / 100;
        }
    }

    /**
     * Activar la póliza
     */
    public function activate(): bool
    {
        return $this->update([
            'status' => 'active',
            'status_notes' => 'Póliza activada el ' . now()->format('Y-m-d H:i:s'),
        ]);
    }

    /**
     * Motivos estándar de cancelación. Otros motivos libres se permiten
     * como texto en `cancellation_reason` (no hay constraint enum en BD).
     */
    const CANCELLATION_REASONS = [
        'motivo_economico' => 'Motivo económico',
        'no_confirmo' => 'No confirmó',
        'pago_credito' => 'Pago crédito',
        'perdida_total' => 'Pérdida total',
        'politicas_compania' => 'Políticas compañía',
        'por_no_pago' => 'Por no pago',
        'vendio_objeto' => 'Vendió el objeto',
        'viaje' => 'Viaje',
        'cambio_a_colectiva' => 'Cambio a colectiva',
        'cambio_poliza_salud' => 'Cambio a póliza salud',
        'cambio_asesor' => 'Cambio asesor',
        'cambio_compania' => 'Cambio de compañía',
        'cambio_plan' => 'Cambio de plan',
        'cambio_plan_autos' => 'Cambio de plan autos',
        'cambio_propietario' => 'Cambio propietario',
        'fallecio_asegurado' => 'Falleció asegurado',
        'otro' => 'Otro',
    ];

    const NON_RENEWAL_REASONS = [
        'motivo_economico' => 'Motivo económico',
        'no_confirmo' => 'No confirmó',
        'pago_credito' => 'Pago crédito',
        'perdida_total' => 'Pérdida total',
        'politicas_compania' => 'Políticas compañía',
        'por_no_pago' => 'Por no pago',
        'vendio_objeto' => 'Vendió el objeto',
        'viaje' => 'Viaje',
        'cambio_a_colectiva' => 'Cambio a colectiva',
        'cambio_poliza_salud' => 'Cambio a póliza salud',
        'cambio_asesor' => 'Cambio asesor',
        'cambio_compania' => 'Cambio de compañía',
        'cambio_plan' => 'Cambio de plan',
        'cambio_plan_autos' => 'Cambio de plan autos',
        'cambio_propietario' => 'Cambio propietario',
        'fallecio_asegurado' => 'Falleció asegurado',
        'otro' => 'Otro',
    ];

    /**
     * Cancelar la póliza
     */
    public function cancel(?string $reason = null, ?int $cancelledBy = null): bool
    {
        return $this->update([
            'status' => 'cancelled',
            'cancelled_at' => now(),
            'cancelled_by' => $cancelledBy,
            'cancellation_reason' => $reason,
            'status_notes' => 'Póliza cancelada el ' . now()->format('Y-m-d H:i:s'),
        ]);
    }

    /**
     * Suspender la póliza
     */
    public function suspend(?string $reason = null): bool
    {
        return $this->update([
            'status' => 'suspended',
            'status_notes' => $reason ?: 'Póliza suspendida el ' . now()->format('Y-m-d H:i:s'),
        ]);
    }

    /**
     * Marcar pago como realizado
     */
    public function markPaymentAsPaid(): bool
    {
        return $this->update([
            'payment_status' => 'paid',
            'payment_due_date' => $this->getNextPaymentDueDate(),
        ]);
    }

    /**
     * Obtener la siguiente fecha de pago
     */
    public function getNextPaymentDueDate(): ?\Carbon\Carbon
    {
        if (!$this->payment_due_date) {
            return null;
        }
        
        $nextDate = $this->payment_due_date->copy();
        
        switch ($this->payment_frequency) {
            case 'monthly':
                $nextDate->addMonth();
                break;
            case 'quarterly':
                $nextDate->addMonths(3);
                break;
            case 'biannual':
                $nextDate->addMonths(6);
                break;
            case 'annual':
                $nextDate->addYear();
                break;
        }
        
        return $nextDate;
    }

    /**
     * Renovar la póliza
     */
    public function renew(array $data = []): bool
    {
        $renewalData = array_merge([
            'start_date' => $this->end_date->copy()->addDay(),
            'end_date' => $this->end_date->copy()->addYear(),
            'renewal_date' => $this->renewal_date ? $this->renewal_date->copy()->addYear() : null,
            'status' => 'active',
            'payment_status' => 'pending',
        ], $data);
        
        return $this->update($renewalData);
    }

    /**
     * Verificar si pertenece al broker
     */
    public function belongsToBroker(int $brokerId): bool
    {
        return $this->broker_id === $brokerId;
    }

    /**
     * Verificar si está asignada al usuario
     */
    public function isAssignedToUser(int $userId): bool
    {
        return $this->assigned_user_id === $userId;
    }

    /**
     * Obtener el próximo evento importante (vencimiento, renovación, pago)
     */
    public function getNextImportantEvent(): array
    {
        $events = [];
        
        if ($this->end_date && $this->end_date->isFuture()) {
            $events[] = [
                'type' => 'expiration',
                'date' => $this->end_date,
                'days' => $this->getDaysUntilExpiration(),
                'message' => 'Vence en ' . $this->getDaysUntilExpiration() . ' días',
            ];
        }
        
        if ($this->renewal_date && $this->renewal_date->isFuture()) {
            $events[] = [
                'type' => 'renewal',
                'date' => $this->renewal_date,
                'days' => $this->getDaysUntilRenewal(),
                'message' => 'Renovación en ' . $this->getDaysUntilRenewal() . ' días',
            ];
        }
        
        if ($this->payment_due_date && $this->payment_due_date->isFuture() && $this->payment_status !== 'paid') {
            $events[] = [
                'type' => 'payment',
                'date' => $this->payment_due_date,
                'days' => $this->getDaysUntilPaymentDue(),
                'message' => 'Pago vence en ' . $this->getDaysUntilPaymentDue() . ' días',
            ];
        }
        
        // Ordenar por fecha más próxima
        usort($events, function ($a, $b) {
            return $a['days'] <=> $b['days'];
        });
        
        return $events[0] ?? [];
    }
}
