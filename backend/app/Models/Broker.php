<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Broker extends Model
{
    use HasFactory; // Temporalmente removido SoftDeletes para evitar errores

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'legal_name',
        'document_type',
        'document_number',
        'email',
        'phone',
        'address',
        'city',
        'state',
        'country',
        'postal_code',
        'industry',
        'description',
        'website',
        'business_hours',
        'subdomain',
        'plan',
        'max_users',
        'max_clients',
        'max_policies',
        'features',
        'settings',
        'logo',
        'favicon',
        'brand_colors',
        'theme_settings',
        'status',
        'trial_ends_at',
        'subscription_ends_at',
        'last_activity_at',
        'owner_id',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'business_hours' => 'array',
        'features' => 'array',
        'settings' => 'array',
        'brand_colors' => 'array',
        'theme_settings' => 'array',
        'trial_ends_at' => 'datetime',
        'subscription_ends_at' => 'datetime',
        'last_activity_at' => 'datetime',
    ];

    // ===== RELACIONES =====

    /**
     * Relación con el usuario propietario (MASTER)
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    /**
     * Relación con usuarios del broker (empleados)
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * Relación con clientes del broker
     */
    public function clients(): HasMany
    {
        return $this->hasMany(Cliente::class);
    }

    /**
     * Relación con pólizas del broker
     */
    public function policies(): HasMany
    {
        return $this->hasMany(Poliza::class);
    }

    /**
     * Relación con instancias de WhatsApp del broker
     */
    public function whatsappInstances(): HasMany
    {
        return $this->hasMany(WhatsAppInstance::class);
    }

    /**
     * Obtener la instancia activa de WhatsApp
     */
    public function activeWhatsappInstance()
    {
        return $this->whatsappInstances()->active()->connected()->first();
    }

    // ===== SCOPES =====

    /**
     * Scope para brokers activos
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope para brokers en trial
     */
    public function scopeTrial($query)
    {
        return $query->where('status', 'trial');
    }

    /**
     * Scope para brokers por plan
     */
    public function scopeByPlan($query, $plan)
    {
        return $query->where('plan', $plan);
    }

    /**
     * Scope para búsqueda
     */
    public function scopeSearch($query, $term)
    {
        return $query->where(function ($q) use ($term) {
            $q->where('name', 'like', "%{$term}%")
              ->orWhere('legal_name', 'like', "%{$term}%")
              ->orWhere('document_number', 'like', "%{$term}%")
              ->orWhere('email', 'like', "%{$term}%");
        });
    }

    // ===== MÉTODOS DE UTILIDAD =====

    /**
     * Verificar si el broker está activo
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /**
     * Verificar si el broker está en trial
     */
    public function isTrial(): bool
    {
        return $this->status === 'trial';
    }

    /**
     * Verificar si el broker está suspendido
     */
    public function isSuspended(): bool
    {
        return $this->status === 'suspended';
    }

    /**
     * Verificar si el trial ha expirado
     */
    public function isTrialExpired(): bool
    {
        return $this->trial_ends_at && $this->trial_ends_at->isPast();
    }

    /**
     * Verificar si la suscripción ha expirado
     */
    public function isSubscriptionExpired(): bool
    {
        return $this->subscription_ends_at && $this->subscription_ends_at->isPast();
    }

    /**
     * Obtener días restantes de trial
     */
    public function getTrialDaysRemaining(): int
    {
        if (!$this->trial_ends_at) {
            return 0;
        }
        
        return max(0, now()->diffInDays($this->trial_ends_at, false));
    }

    /**
     * Obtener días restantes de suscripción
     */
    public function getSubscriptionDaysRemaining(): int
    {
        if (!$this->subscription_ends_at) {
            return 0;
        }
        
        return max(0, now()->diffInDays($this->subscription_ends_at, false));
    }

    /**
     * Verificar si puede crear más usuarios
     */
    public function canCreateMoreUsers(): bool
    {
        return $this->users()->count() < $this->max_users;
    }

    /**
     * Verificar si puede crear más clientes
     */
    public function canCreateMoreClients(): bool
    {
        return $this->clients()->count() < $this->max_clients;
    }

    /**
     * Verificar si puede crear más pólizas
     */
    public function canCreateMorePolicies(): bool
    {
        return $this->policies()->count() < $this->max_policies;
    }

    /**
     * Obtener el logo URL
     */
    public function getLogoUrl(): ?string
    {
        return $this->logo ? asset('storage/' . $this->logo) : null;
    }

    /**
     * Obtener el favicon URL
     */
    public function getFaviconUrl(): ?string
    {
        return $this->favicon ? asset('storage/' . $this->favicon) : null;
    }

    /**
     * Obtener configuración completa del tema
     */
    public function getThemeConfig(): array
    {
        return array_merge([
            'primary_color' => '#3b82f6',
            'secondary_color' => '#64748b',
            'accent_color' => '#10b981',
            'logo_url' => $this->getLogoUrl(),
            'favicon_url' => $this->getFaviconUrl(),
        ], $this->brand_colors ?? [], $this->theme_settings ?? []);
    }

    /**
     * Verificar si tiene una característica habilitada
     */
    public function hasFeature(string $feature): bool
    {
        $features = $this->features ?? [];
        return in_array($feature, $features);
    }

    /**
     * Obtener estadísticas del broker
     */
    public function getStats(): array
    {
        return [
            'total_users' => $this->users()->count(),
            'total_clients' => $this->clients()->count(),
            'total_policies' => $this->policies()->count(),
            'active_policies' => $this->policies()->where('status', 'active')->count(),
            'pending_policies' => $this->policies()->where('status', 'pending')->count(),
            'total_premium' => $this->policies()->sum('premium_amount'),
            'total_insured' => $this->policies()->sum('insured_amount'),
            'total_commission' => $this->policies()->sum('commission_amount'),
        ];
    }

    /**
     * Actualizar última actividad
     */
    public function updateLastActivity(): void
    {
        $this->update(['last_activity_at' => now()]);
    }

    /**
     * Obtener nombre para mostrar
     */
    public function getDisplayName(): string
    {
        return $this->name ?: $this->legal_name;
    }

    /**
     * Obtener URL del subdominio
     */
    public function getSubdomainUrl(): ?string
    {
        if (!$this->subdomain) {
            return null;
        }
        
        return "https://{$this->subdomain}.guro.app";
    }

    /**
     * Verificar si el usuario pertenece a este broker
     */
    public function hasUser(User $user): bool
    {
        return $user->broker_id === $this->id || $user->ownedBroker?->id === $this->id;
    }

    /**
     * Obtener usuarios activos
     */
    public function getActiveUsers()
    {
        return $this->users()->active();
    }

    /**
     * Obtener clientes activos
     */
    public function getActiveClients()
    {
        return $this->clients()->where('status', 'active');
    }

    /**
     * Obtener pólizas activas
     */
    public function getActivePolicies()
    {
        return $this->policies()->where('status', 'active');
    }
}
