<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Models\SaaS\BrokerTenant;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, HasApiTokens;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'firebase_uid',
        'provider',
        'avatar',
        'phone',
        'user_type',
        'broker_id',
        'role',
        'permissions',
        'settings',
        'status',
        'last_login_at',
        'two_factor_enabled',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_enabled' => 'boolean',
            'permissions' => 'array',
            'settings' => 'array',
        ];
    }

    /**
     * Relación con códigos de verificación
     */
    public function verificationCodes()
    {
        return $this->hasMany(VerificationCode::class);
    }

    /**
     * Relación con el broker que posee (para usuarios MASTER)
     */
    public function ownedBroker(): HasOne
    {
        return $this->hasOne(Broker::class, 'owner_id');
    }

    /**
     * Relación con el broker al que pertenece (para empleados)
     */
    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    /**
     * Relación con clientes asignados
     */
    public function assignedClients(): HasMany
    {
        return $this->hasMany(Cliente::class, 'assigned_user_id');
    }

    /**
     * Relación con clientes creados
     */
    public function createdClients(): HasMany
    {
        return $this->hasMany(Cliente::class, 'created_by');
    }

    /**
     * Relación con pólizas asignadas
     */
    public function assignedPolicies(): HasMany
    {
        return $this->hasMany(Poliza::class, 'assigned_user_id');
    }

    /**
     * Relación con pólizas creadas
     */
    public function createdPolicies(): HasMany
    {
        return $this->hasMany(Poliza::class, 'created_by');
    }

    // ===== SCOPES =====

    /**
     * Scope para usuarios master (propietarios de brokers)
     */
    public function scopeMaster($query)
    {
        return $query->where('user_type', 'MASTER');
    }

    /**
     * Scope para administradores
     */
    public function scopeAdmin($query)
    {
        return $query->where('user_type', 'ADMIN');
    }

    /**
     * Scope para empleados
     */
    public function scopeEmpleado($query)
    {
        return $query->where('user_type', 'EMPLEADO');
    }

    /**
     * Scope para usuarios activos
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }

    /**
     * Scope para usuarios por broker
     */
    public function scopeByBroker($query, $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }

    /**
     * Scope para búsqueda
     */
    public function scopeSearch($query, $term)
    {
        return $query->where(function ($q) use ($term) {
            $q->where('name', 'like', "%{$term}%")
              ->orWhere('email', 'like', "%{$term}%");
        });
    }

    // ===== MÉTODOS DE UTILIDAD =====

    /**
     * Verificar si el usuario es master
     */
    public function isMaster(): bool
    {
        return $this->user_type === 'MASTER';
    }

    /**
     * Verificar si el usuario es admin
     */
    public function isAdmin(): bool
    {
        return $this->user_type === 'ADMIN';
    }

    /**
     * Verificar si el usuario es empleado
     */
    public function isEmpleado(): bool
    {
        return $this->user_type === 'EMPLEADO';
    }

    /**
     * Verificar si el usuario está activo
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    /**
     * Obtener el broker principal del usuario
     */
    public function getPrimaryBroker()
    {
        if ($this->isMaster()) {
            return $this->ownedBroker;
        } else {
            return $this->broker;
        }
    }

    /**
     * Verificar si el usuario tiene un permiso específico
     */
    public function hasPermission(string $permission): bool
    {
        $permissions = $this->permissions ?? [];
        return in_array($permission, $permissions) || $this->isMaster();
    }

    /**
     * Verificar si el usuario puede acceder a un módulo
     */
    public function canAccessModule(string $module): bool
    {
        $permissions = $this->permissions ?? [];
        
        // Los masters pueden acceder a todo
        if ($this->isMaster()) {
            return true;
    }

        // Verificar permisos específicos del módulo
        foreach ($permissions as $permission) {
            if (str_starts_with($permission, $module . '.')) {
                return true;
            }
        }
        
        return false;
        }
        
    /**
     * Actualizar último login
     */
    public function updateLastLogin(): void
    {
        $this->update(['last_login_at' => now()]);
    }

    /**
     * Obtener nombre completo
     */
    public function getFullNameAttribute(): string
    {
        return $this->name;
    }

    /**
     * Obtener iniciales
     */
    public function getInitials(): string
    {
        $words = explode(' ', $this->name);
        $initials = '';
        foreach ($words as $word) {
            $initials .= strtoupper(substr($word, 0, 1));
        }
        return substr($initials, 0, 2);
    }

    /**
     * Verificar si el usuario puede gestionar otro usuario
     */
    public function canManageUser(User $otherUser): bool
    {
        // Los masters pueden gestionar usuarios de su broker
        if ($this->isMaster() && $this->ownedBroker) {
            return $otherUser->broker_id === $this->ownedBroker->id;
        }
        
        // Los admins pueden gestionar usuarios de su mismo broker
        if ($this->isAdmin() && $this->broker_id) {
            return $otherUser->broker_id === $this->broker_id;
        }
        
        return false;
    }

    /**
     * Verificar si el usuario puede ver otro usuario
     */
    public function canViewUser(User $otherUser): bool
    {
        // Mismo broker
        if ($this->broker_id === $otherUser->broker_id) {
            return true;
        }
        
        // Master puede ver usuarios de su broker
        if ($this->isMaster() && $this->ownedBroker) {
            return $otherUser->broker_id === $this->ownedBroker->id;
        }
        
        return false;
    }

    // ===== MÉTODOS DE PERMISOS (SOLO PARA EMPLEADOS) =====

    /**
     * Verificar si tiene un permiso específico
     */
    public function tienePermiso(string $modulo, string $accion): bool
    {
        if ($this->user_type === 'MASTER') {
            return true; // Los masters tienen todos los permisos
        }

        if ($this->role === 'super_admin') {
            return true;
        }

        return $this->permissions[$modulo][$accion] ?? false;
    }

    /**
     * Verificar si puede acceder a un módulo
     */
    public function puedeAccederModulo(string $modulo): bool
    {
        if ($this->user_type === 'MASTER') {
            return true;
        }

        if ($this->role === 'super_admin') {
            return true;
        }

        $permisos = $this->permissions[$modulo] ?? [];
        return collect($permisos)->contains(true);
    }

    /**
     * Verificar si es de un rol específico
     */
    public function esRol(string $rol): bool
    {
        return $this->role === $rol;
    }

    /**
     * Verificar si es super admin
     */
    public function esSuperAdmin(): bool
    {
        return $this->role === 'super_admin';
    }

    /**
     * Verificar si es admin
     */
    public function esAdmin(): bool
    {
        return in_array($this->role, ['super_admin', 'admin']);
    }

    /**
     * Actualizar último acceso
     */
    public function actualizarUltimoAcceso(): void
    {
        $this->update(['last_login_at' => now()]);
    }

    // ===== MÉTODOS DE CONFIGURACIÓN =====

    /**
     * Obtener configuraciones con valores por defecto
     */
    public function getSettingsAttribute($value)
    {
        if ($this->user_type === 'MASTER') {
            return $value ? json_decode($value, true) : [];
        }

        $default = [
            'notificaciones' => [
                'email' => true,
                'sms' => false,
                'push' => true
            ],
            'dashboard_layout' => null,
            'tema' => 'light'
        ];

        return $value ? array_merge($default, json_decode($value, true)) : $default;
    }

    /**
     * Obtener permisos por defecto según rol (solo para empleados)
     */
    public function getPermissionsPorDefecto(): array
    {
        if ($this->user_type === 'MASTER') {
            return [];
        }

        $permisos = [
            'dashboard' => [
                'ver_metricas_generales' => false,
                'ver_metricas_equipo' => false,
                'ver_metricas_propias' => true
            ],
            'clientes' => [
                'ver_todos' => false,
                'ver_propios' => true,
                'ver_equipo' => false,
                'crear' => false,
                'editar' => false,
                'eliminar' => false,
                'exportar' => false,
                'importar' => false
            ],
            'polizas' => [
                'ver_todas' => false,
                'ver_propias' => true,
                'ver_equipo' => false,
                'crear' => false,
                'editar' => false,
                'eliminar' => false,
                'renovar' => false,
                'cancelar' => false
            ],
            'siniestros' => [
                'ver_todos' => false,
                'ver_propios' => true,
                'crear' => false,
                'gestionar' => false
            ],
            'comisiones' => [
                'ver_propias' => true,
                'ver_equipo' => false,
                'ver_todas' => false,
                'gestionar' => false
            ],
            'reportes' => [
                'generar' => false,
                'ver_financieros' => false,
                'exportar' => false
            ],
            'usuarios' => [
                'ver' => false,
                'crear' => false,
                'editar' => false,
                'eliminar' => false,
                'gestionar_roles' => false
            ],
            'configuracion' => [
                'empresa' => false,
                'sistema' => false,
                'integraciones' => false,
                'facturacion' => false
            ]
        ];

        switch ($this->role) {
            case 'super_admin':
                return $this->habilitarTodosLosPermisos($permisos);
                
            case 'admin':
                $permisos['dashboard']['ver_metricas_generales'] = true;
                $permisos['dashboard']['ver_metricas_equipo'] = true;
                $permisos['clientes']['ver_todos'] = true;
                $permisos['clientes']['crear'] = true;
                $permisos['clientes']['editar'] = true;
                $permisos['clientes']['exportar'] = true;
                $permisos['polizas']['ver_todas'] = true;
                $permisos['polizas']['crear'] = true;
                $permisos['polizas']['editar'] = true;
                $permisos['usuarios']['ver'] = true;
                $permisos['usuarios']['crear'] = true;
                $permisos['usuarios']['editar'] = true;
                $permisos['configuracion']['empresa'] = true;
                break;
                
            case 'supervisor':
                $permisos['dashboard']['ver_metricas_equipo'] = true;
                $permisos['clientes']['ver_equipo'] = true;
                $permisos['clientes']['crear'] = true;
                $permisos['clientes']['editar'] = true;
                $permisos['polizas']['ver_equipo'] = true;
                $permisos['polizas']['crear'] = true;
                $permisos['comisiones']['ver_equipo'] = true;
                break;
                
            case 'asesor':
                $permisos['clientes']['crear'] = true;
                $permisos['clientes']['editar'] = true;
                $permisos['polizas']['crear'] = true;
                $permisos['polizas']['editar'] = true;
                $permisos['polizas']['renovar'] = true;
                break;
                
            case 'vendedor':
                $permisos['clientes']['crear'] = true;
                $permisos['polizas']['crear'] = true;
                break;
        }

        return $permisos;
    }

    /**
     * Habilitar todos los permisos
     */
    private function habilitarTodosLosPermisos(array $permisos): array
    {
        foreach ($permisos as $modulo => $acciones) {
            foreach ($acciones as $accion => $valor) {
                $permisos[$modulo][$accion] = true;
            }
        }
        return $permisos;
    }

    // ===== EVENTOS DEL MODELO =====

    protected static function boot()
    {
        parent::boot();
        
        static::creating(function ($model) {
            // Asignar permisos por defecto para empleados
            if ($model->user_type === 'EMPLEADO' && empty($model->permissions)) {
                $model->permissions = $model->getPermissionsPorDefecto();
            }
        });
    }

    /**
     * Verificar si el usuario tiene un rol específico
     */
    public function hasRole($role)
    {
        return $this->role === $role;
    }

    /**
     * Verificar si el usuario está suspendido
     */
    public function isSuspended()
    {
        return $this->status === 'suspended';
    }

    /**
     * Verificar si el usuario está inactivo
     */
    public function isInactive()
    {
        return $this->status === 'inactive';
    }

    /**
     * Obtener usuarios del mismo broker
     */
    public function colegas()
    {
        return self::where('broker_id', $this->broker_id)
                  ->where('user_type', 'EMPLEADO')
                  ->where('id', '!=', $this->id);
    }
}
