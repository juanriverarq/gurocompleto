<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\BrokerScoped;
use App\Events\ClienteCreated;
use App\Models\SalesFunnel;

class Cliente extends Model
{
    use HasFactory, SoftDeletes, BrokerScoped;

    /**
     * The event map for the model.
     *
     * @var array
     */
    protected $dispatchesEvents = [
        'created' => ClienteCreated::class,
    ];

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'broker_id',
        'client_type',
        'first_name',
        'last_name',
        'document_type',
        'document_number',
        'document_issue_date',
        'email',
        'phone',
        'branch_name',
        'mobile_phone',
        'birth_date',
        'gender',
        'marital_status',
        'address',
        'city',
        'department',
        'country',
        'postal_code',
        'occupation',
        'company',
        'company_legal_name',
        'legal_representative_name',
        'legal_representative_document_type',
        'legal_representative_document_number',
        'monthly_income',
        'work_address',
        'emergency_contact_name',
        'emergency_contact_phone',
        'emergency_contact_relationship',
        'assigned_user_id',
        'status',
        'priority',
        'notes',
        'documents',
        'tags',
        'custom_fields',
        'source',
        'total_policies_value',
        'total_policies_count',
        'last_contact_at',
        'next_follow_up_at',
        'created_by',
        'updated_by',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'birth_date' => 'date',
        'document_issue_date' => 'date',
        'tags' => 'array',
        'custom_fields' => 'array',
        'documents' => 'array',
        'monthly_income' => 'decimal:2',
        'total_policies_value' => 'decimal:2',
        'last_contact_at' => 'datetime',
        'next_follow_up_at' => 'datetime',
    ];

    /**
     * Boot del modelo - actualizar llamadas programadas cuando cambia el teléfono
     */
    protected static function boot()
    {
        parent::boot();

        static::updated(function (Cliente $cliente) {
            // Si cambió el teléfono móvil, actualizar llamadas programadas pendientes
            if ($cliente->isDirty('mobile_phone') && !empty($cliente->mobile_phone)) {
                VoiceCampaignScheduledCall::where('client_id', $cliente->id)
                    ->where('status', VoiceCampaignScheduledCall::STATUS_PENDING)
                    ->each(function ($call) use ($cliente) {
                        $contactData = is_array($call->contact_data) ? $call->contact_data : [];
                        $contactData['phone'] = $cliente->mobile_phone;
                        $call->update(['contact_data' => $contactData]);
                    });
            }

            // También actualizar el nombre si cambió
            if ($cliente->isDirty(['first_name', 'last_name'])) {
                $fullName = trim("{$cliente->first_name} {$cliente->last_name}");
                VoiceCampaignScheduledCall::where('client_id', $cliente->id)
                    ->where('status', VoiceCampaignScheduledCall::STATUS_PENDING)
                    ->each(function ($call) use ($fullName) {
                        $contactData = is_array($call->contact_data) ? $call->contact_data : [];
                        $contactData['name'] = $fullName;
                        $contactData['customer_name'] = $fullName;
                        $call->update(['contact_data' => $contactData]);
                    });
            }
        });
    }

    // ===== RELACIONES =====

    /**
     * Relación con el broker
     */
    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    /**
     * Relación con el usuario asignado
     */
    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    /**
     * Relación con el usuario que creó el cliente
     */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Relación con el usuario que actualizó el cliente
     */
    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Relación con las pólizas del cliente
     */
    public function policies(): HasMany
    {
        return $this->hasMany(Poliza::class, 'client_id');
    }

    public function leads(): HasMany
    {
        return $this->hasMany(SalesFunnel::class, 'client_id');
    }

    // ===== SCOPES =====

    /**
     * Scope para clientes activos
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope para prospectos
     */
    public function scopeProspects($query)
    {
        return $query->where('status', 'prospect');
    }

    /**
     * Scope para clientes por broker
     */
    public function scopeByBroker($query, $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }

    /**
     * Scope para clientes por usuario asignado
     */
    public function scopeByAssignedUser($query, $userId)
    {
        return $query->where('assigned_user_id', $userId);
    }

    /**
     * Scope para clientes por prioridad
     */
    public function scopeByPriority($query, $priority)
    {
        return $query->where('priority', $priority);
    }

    /**
     * Scope para búsqueda
     */
    public function scopeSearch($query, $term)
    {
        return $query->where(function ($q) use ($term) {
            $q->where('first_name', 'like', "%{$term}%")
              ->orWhere('last_name', 'like', "%{$term}%")
              ->orWhere('document_number', 'like', "%{$term}%")
              ->orWhere('email', 'like', "%{$term}%")
              ->orWhere('phone', 'like', "%{$term}%")
              ->orWhere('mobile_phone', 'like', "%{$term}%");
        });
    }

    /**
     * Scope para clientes con seguimiento pendiente
     */
    public function scopeWithFollowUp($query)
    {
        return $query->whereNotNull('next_follow_up_at')
                     ->where('next_follow_up_at', '<=', now());
    }

    /**
     * Scope para clientes sin contacto reciente
     */
    public function scopeWithoutRecentContact($query, $days = 30)
    {
        return $query->where(function ($q) use ($days) {
            $q->whereNull('last_contact_at')
              ->orWhere('last_contact_at', '<=', now()->subDays($days));
        });
    }

    // ===== MÉTODOS DE UTILIDAD =====

    /**
     * Obtener nombre completo
     */
    public function getFullNameAttribute(): string
    {
        return "{$this->first_name} {$this->last_name}";
    }

    /**
     * Obtener nombre corto (nombre + inicial del apellido)
     */
    public function getShortNameAttribute(): string
    {
        return "{$this->first_name} " . strtoupper(substr($this->last_name, 0, 1)) . ".";
    }

    /**
     * Obtener iniciales
     */
    public function getInitials(): string
    {
        $firstInitial = strtoupper(substr($this->first_name, 0, 1));
        $lastInitial = strtoupper(substr($this->last_name, 0, 1));
        return $firstInitial . $lastInitial;
    }

    /**
     * Verificar si el cliente está activo
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /**
     * Verificar si es un prospecto
     */
    public function isProspect(): bool
    {
        return $this->status === 'prospect';
    }

    /**
     * Verificar si está bloqueado
     */
    public function isBlocked(): bool
    {
        return $this->status === 'blocked';
    }

    /**
     * Obtener edad
     */
    public function getAge(): ?int
    {
        if (!$this->birth_date) {
            return null;
        }
        
        return $this->birth_date->diffInYears(now());
    }

    /**
     * Obtener el nombre del documento
     */
    public function getDocumentTypeNameAttribute(): string
    {
        $types = [
            'CC' => 'Cédula de Ciudadanía',
            'CE' => 'Cédula de Extranjería',
            'NIT' => 'NIT',
            'TI' => 'Tarjeta de Identidad',
            'RC' => 'Registro Civil',
            'PA' => 'Pasaporte',
        ];
        
        return $types[$this->document_type] ?? $this->document_type;
    }

    /**
     * Obtener el nombre del estado civil
     */
    public function getMaritalStatusNameAttribute(): string
    {
        $statuses = [
            'soltero' => 'Soltero(a)',
            'casado' => 'Casado(a)',
            'divorciado' => 'Divorciado(a)',
            'viudo' => 'Viudo(a)',
            'union_libre' => 'Unión Libre',
        ];
        
        return $statuses[$this->marital_status] ?? $this->marital_status;
    }

    /**
     * Obtener el nombre de la prioridad
     */
    public function getPriorityNameAttribute(): string
    {
        $priorities = [
            'low' => 'Baja',
            'medium' => 'Media',
            'high' => 'Alta',
        ];
        
        return $priorities[$this->priority] ?? $this->priority;
    }

    /**
     * Obtener el nombre del estado
     */
    public function getStatusNameAttribute(): string
    {
        $statuses = [
            'active' => 'Activo',
            'inactive' => 'Inactivo',
            'prospect' => 'Prospecto',
            'blocked' => 'Bloqueado',
        ];
        
        return $statuses[$this->status] ?? $this->status;
    }

    /**
     * Verificar si tiene pólizas activas
     */
    public function hasActivePolicies(): bool
    {
        return $this->policies()->where('status', 'active')->exists();
    }

    /**
     * Obtener pólizas activas
     */
    public function getActivePolicies()
    {
        return $this->policies()->where('status', 'active');
    }

    /**
     * Obtener valor total de pólizas activas
     */
    public function getTotalActivePoliciesValue(): float
    {
        return $this->getActivePolicies()->sum('premium_amount');
    }

    /**
     * Actualizar contadores de pólizas
     */
    public function updatePolicyCounters(): void
    {
        $this->update([
            'total_policies_count' => $this->policies()->count(),
            'total_policies_value' => $this->policies()->sum('premium_amount'),
        ]);
    }

    /**
     * Actualizar último contacto
     */
    public function updateLastContact(): void
    {
        $this->update(['last_contact_at' => now()]);
    }

    /**
     * Programar seguimiento
     */
    public function scheduleFollowUp(\DateTime $date): void
    {
        $this->update(['next_follow_up_at' => $date]);
    }

    /**
     * Verificar si requiere seguimiento
     */
    public function requiresFollowUp(): bool
    {
        return $this->next_follow_up_at && $this->next_follow_up_at->isPast();
    }

    /**
     * Obtener días sin contacto
     */
    public function getDaysWithoutContact(): int
    {
        if (!$this->last_contact_at) {
            return $this->created_at->diffInDays(now());
        }
        
        return $this->last_contact_at->diffInDays(now());
    }

    /**
     * Obtener el próximo cumpleaños
     */
    public function getNextBirthday(): ?\Carbon\Carbon
    {
        if (!$this->birth_date) {
            return null;
        }
        
        $birthday = $this->birth_date->copy()->setYear(now()->year);
        
        if ($birthday->isPast()) {
            $birthday->addYear();
        }
        
        return $birthday;
    }

    /**
     * Verificar si es cumpleaños pronto
     */
    public function isBirthdaySoon(int $days = 30): bool
    {
        $nextBirthday = $this->getNextBirthday();
        
        if (!$nextBirthday) {
            return false;
        }
        
        return $nextBirthday->diffInDays(now()) <= $days;
    }

    /**
     * Obtener dirección completa
     */
    public function getFullAddress(): string
    {
        $parts = array_filter([
            $this->address,
            $this->city,
            $this->department,
            $this->country,
        ]);
        
        return implode(', ', $parts);
    }

    /**
     * Verificar si pertenece al broker
     */
    public function belongsToBroker(int $brokerId): bool
    {
        return $this->broker_id === $brokerId;
    }

    /**
     * Verificar si está asignado al usuario
     */
    public function isAssignedToUser(int $userId): bool
    {
        return $this->assigned_user_id === $userId;
    }
}
