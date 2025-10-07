<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;
use App\Traits\BrokerScoped;

class EmpleadoBroker extends Authenticatable
{
    use HasFactory, Notifiable, BrokerScoped;

    protected $table = 'empleados_broker';

    protected $fillable = [
        'nombres',
        'apellidos',
        'tipo_documento',
        'numero_documento',
        'email',
        'telefono',
        'celular',
        'fecha_nacimiento',
        'direccion',
        'ciudad',
        'cargo',
        'departamento',
        'fecha_ingreso',
        'fecha_salida',
        'estado',
        'tipo_vinculacion',
        'salario',
        'usuario',
        'password',
        'email_verified_at',
        'password_changed_at',
        'requiere_cambio_password',
        'first_login',
        'ultimo_acceso',
        'acceso_activo',
        'reset_password_token',
        'reset_password_expires_at',
        'rol_id',
        'broker_id',
        'avatar',
        'permisos_adicionales',
        'observaciones',
        'creado_por',
        'actualizado_por',
    ];

    protected $casts = [
        'fecha_nacimiento' => 'date',
        'fecha_ingreso' => 'date',
        'fecha_salida' => 'date',
        'salario' => 'decimal:2',
        'email_verified_at' => 'datetime',
        'password_changed_at' => 'datetime',
        'ultimo_acceso' => 'datetime',
        'reset_password_expires_at' => 'datetime',
        'requiere_cambio_password' => 'boolean',
        'first_login' => 'boolean',
        'acceso_activo' => 'boolean',
        'permisos_adicionales' => 'array',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'reset_password_token',
    ];

    // Constantes para tipos de documento
    const TIPOS_DOCUMENTO = [
        'cedula' => 'Cédula de Ciudadanía',
        'cedula_extranjeria' => 'Cédula de Extranjería',
        'pasaporte' => 'Pasaporte',
        'tarjeta_identidad' => 'Tarjeta de Identidad',
    ];

    // Constantes para estados
    const ESTADO_ACTIVO = 'activo';
    const ESTADO_INACTIVO = 'inactivo';
    const ESTADO_SUSPENDIDO = 'suspendido';
    const ESTADO_RETIRADO = 'retirado';

    const ESTADOS = [
        self::ESTADO_ACTIVO => 'Activo',
        self::ESTADO_INACTIVO => 'Inactivo',
        self::ESTADO_SUSPENDIDO => 'Suspendido',
        self::ESTADO_RETIRADO => 'Retirado',
    ];

    // Constantes para tipos de vinculación
    const TIPO_EMPLEADO = 'empleado';
    const TIPO_CONTRATISTA = 'contratista';
    const TIPO_PRACTICANTE = 'practicante';
    const TIPO_TEMPORAL = 'temporal';

    const TIPOS_VINCULACION = [
        self::TIPO_EMPLEADO => 'Empleado',
        self::TIPO_CONTRATISTA => 'Contratista',
        self::TIPO_PRACTICANTE => 'Practicante',
        self::TIPO_TEMPORAL => 'Temporal',
    ];

    /**
     * Get the name of the unique identifier for the user.
     */
    public function getAuthIdentifierName()
    {
        return 'id';
    }

    /**
     * Get the unique identifier for the user.
     */
    public function getAuthIdentifier()
    {
        return $this->getKey();
    }

    /**
     * Get the password for the user.
     */
    public function getAuthPassword()
    {
        return $this->password;
    }

    /**
     * Get the token value for the "remember me" session.
     */
    public function getRememberToken()
    {
        return $this->remember_token;
    }

    /**
     * Set the token value for the "remember me" session.
     */
    public function setRememberToken($value)
    {
        $this->remember_token = $value;
    }

    /**
     * Get the column name for the "remember me" token.
     */
    public function getRememberTokenName()
    {
        return 'remember_token';
    }

    /**
     * Hash the password when setting it
     */
    public function setPasswordAttribute($value)
    {
        if ($value) {
            $this->attributes['password'] = Hash::make($value);
            $this->attributes['password_changed_at'] = now();
        }
    }

    /**
     * Find user by email or username for authentication
     */
    public static function findForAuth($identifier)
    {
        return static::where(function ($query) use ($identifier) {
            $query->where('email', $identifier)
                  ->orWhere('usuario', $identifier);
        })
        ->where('acceso_activo', true)
        ->where('estado', self::ESTADO_ACTIVO)
        ->first();
    }

    /**
     * Relación con Broker (Multi-tenancy)
     */
    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    /**
     * Relación con RolBroker
     */
    public function rol(): BelongsTo
    {
        return $this->belongsTo(RolBroker::class, 'rol_id');
    }

    /**
     * Relación con quien lo creó
     */
    public function creadoPor(): BelongsTo
    {
        return $this->belongsTo(self::class, 'creado_por');
    }

    /**
     * Relación con quien lo actualizó
     */
    public function actualizadoPor(): BelongsTo
    {
        return $this->belongsTo(self::class, 'actualizado_por');
    }

    /**
     * Scope para filtrar por broker (Multi-tenancy)
     */
    public function scopeForBroker(Builder $query, int $brokerId): Builder
    {
        return $query->where('broker_id', $brokerId);
    }

    /**
     * Scope para búsqueda
     */
    public function scopeSearch(Builder $query, string $search): Builder
    {
        return $query->where(function ($q) use ($search) {
            $q->where('nombres', 'like', "%{$search}%")
              ->orWhere('apellidos', 'like', "%{$search}%")
              ->orWhere('numero_documento', 'like', "%{$search}%")
              ->orWhere('email', 'like', "%{$search}%")
              ->orWhere('usuario', 'like', "%{$search}%")
              ->orWhere('cargo', 'like', "%{$search}%")
              ->orWhere('departamento', 'like', "%{$search}%");
        });
    }

    /**
     * Scope para empleados activos
     */
    public function scopeActivos(Builder $query): Builder
    {
        return $query->where('estado', self::ESTADO_ACTIVO);
    }

    /**
     * Scope para empleados inactivos
     */
    public function scopeInactivos(Builder $query): Builder
    {
        return $query->where('estado', '!=', self::ESTADO_ACTIVO);
    }

    /**
     * Scope para filtrar por estado
     */
    public function scopeByEstado(Builder $query, string $estado): Builder
    {
        return $query->where('estado', $estado);
    }

    /**
     * Scope para filtrar por tipo de vinculación
     */
    public function scopeByTipoVinculacion(Builder $query, string $tipo): Builder
    {
        return $query->where('tipo_vinculacion', $tipo);
    }

    /**
     * Scope para filtrar por rol
     */
    public function scopeByRol(Builder $query, int $rolId): Builder
    {
        return $query->where('rol_id', $rolId);
    }

    /**
     * Scope para empleados con acceso activo
     */
    public function scopeConAccesoActivo(Builder $query): Builder
    {
        return $query->where('acceso_activo', true);
    }

    /**
     * Scope para empleados que requieren cambio de contraseña
     */
    public function scopeRequierenCambioPassword(Builder $query): Builder
    {
        return $query->where('requiere_cambio_password', true);
    }

    /**
     * Scope para ordenar por nombre completo
     */
    public function scopeOrderByName(Builder $query, string $direction = 'asc'): Builder
    {
        return $query->orderBy('nombres', $direction)
                    ->orderBy('apellidos', $direction);
    }

    /**
     * Accessor para nombre completo
     */
    public function getNombreCompletoAttribute(): string
    {
        return trim($this->nombres . ' ' . $this->apellidos);
    }

    /**
     * Accessor para obtener el nombre del tipo de documento
     */
    public function getTipoDocumentoNombreAttribute(): string
    {
        return self::TIPOS_DOCUMENTO[$this->tipo_documento] ?? $this->tipo_documento;
    }

    /**
     * Accessor para obtener el nombre del estado
     */
    public function getEstadoNombreAttribute(): string
    {
        return self::ESTADOS[$this->estado] ?? $this->estado;
    }

    /**
     * Accessor para obtener el nombre del tipo de vinculación
     */
    public function getTipoVinculacionNombreAttribute(): string
    {
        return self::TIPOS_VINCULACION[$this->tipo_vinculacion] ?? $this->tipo_vinculacion;
    }

    /**
     * Accessor para obtener el teléfono principal
     */
    public function getTelefonoPrincipalAttribute(): string
    {
        if ($this->celular) {
            return $this->celular;
        }
        
        if ($this->telefono) {
            return $this->telefono;
        }
        
        return 'No disponible';
    }

    /**
     * Accessor para calcular años de antigüedad
     */
    public function getAntiguedadAttribute(): ?int
    {
        if (!$this->fecha_ingreso) {
            return null;
        }

        $fechaFin = $this->fecha_salida ?? now();
        return $this->fecha_ingreso->diffInYears($fechaFin);
    }

    /**
     * Accessor para calcular edad
     */
    public function getEdadAttribute(): ?int
    {
        if (!$this->fecha_nacimiento) {
            return null;
        }

        return $this->fecha_nacimiento->diffInYears(now());
    }

    /**
     * Verificar si el empleado tiene un permiso específico
     */
    public function tienePermiso(string $permiso): bool
    {
        // Si no tiene rol asignado, no tiene permisos
        if (!$this->rol) {
            return false;
        }
        
        // Verificar a través del rol
        if ($this->rol->tienePermiso($permiso)) {
            return true;
        }
        
        // Verificar permisos adicionales específicos del empleado
        if ($this->permisos_adicionales) {
            $permisosAdicionales = is_string($this->permisos_adicionales) 
                ? json_decode($this->permisos_adicionales, true) 
                : $this->permisos_adicionales;
                
            if (in_array('*', $permisosAdicionales ?? [])) {
                return true;
            }
            
            if (in_array($permiso, $permisosAdicionales ?? [])) {
                return true;
            }
            
            // Verificar permiso por módulo
            if (str_contains($permiso, '.')) {
                $partes = explode('.', $permiso);
                $modulo = $partes[0];
                
                if (in_array($modulo . '.*', $permisosAdicionales ?? [])) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Verificar si el empleado puede acceder a un módulo específico
     */
    public function puedeAccederModulo(string $modulo): bool
    {
        if (!$this->rol) {
            return false;
        }
        
        return $this->rol->puedeAccederModulo($modulo) || 
               $this->tienePermiso($modulo . '.*') ||
               $this->tienePermiso($modulo . '.ver');
    }

    /**
     * Obtener todos los permisos del empleado (rol + permisos adicionales)
     */
    public function obtenerPermisos(): array
    {
        $permisos = [];
        
        // Permisos del rol
        if ($this->rol) {
            $permisos = array_merge($permisos, $this->rol->obtenerPermisos());
        }
        
        // Permisos adicionales del empleado
        if ($this->permisos_adicionales) {
            $permisosAdicionales = is_string($this->permisos_adicionales) 
                ? json_decode($this->permisos_adicionales, true) 
                : $this->permisos_adicionales;
                
            $permisos = array_merge($permisos, $permisosAdicionales ?? []);
        }
        
        return array_unique($permisos);
    }

    /**
     * Obtener permisos organizados por módulo
     */
    public function obtenerPermisosPorModulo(): array
    {
        $permisosPorModulo = [];
        
        // Permisos del rol
        if ($this->rol) {
            $permisosPorModulo = $this->rol->obtenerPermisosPorModulo();
        }
        
        // Permisos adicionales del empleado
        if ($this->permisos_adicionales) {
            $permisosAdicionales = is_string($this->permisos_adicionales) 
                ? json_decode($this->permisos_adicionales, true) 
                : $this->permisos_adicionales;
                
            foreach ($permisosAdicionales ?? [] as $permiso) {
                if ($permiso === '*') {
                    // Si tiene todos los permisos
                    foreach (\App\Models\RolBroker::PERMISOS_DISPONIBLES as $modulo => $config) {
                        $permisosPorModulo[$modulo] = $config['permisos'];
                    }
                    break;
                } elseif (str_contains($permiso, '.')) {
                    $partes = explode('.', $permiso);
                    $modulo = $partes[0];
                    $accion = $partes[1];
                    
                    if (!isset($permisosPorModulo[$modulo])) {
                        $permisosPorModulo[$modulo] = [];
                    }
                    
                    if ($accion === '*') {
                        if (isset(\App\Models\RolBroker::PERMISOS_DISPONIBLES[$modulo])) {
                            $permisosPorModulo[$modulo] = \App\Models\RolBroker::PERMISOS_DISPONIBLES[$modulo]['permisos'];
                        }
                    } else {
                        if (!in_array($accion, $permisosPorModulo[$modulo])) {
                            $permisosPorModulo[$modulo][] = $accion;
                        }
                    }
                }
            }
        }
        
        return $permisosPorModulo;
    }

    /**
     * Verificar si el empleado puede acceder al sistema
     */
    public function puedeAcceder(): bool
    {
        // Verificar si está activo
        if ($this->estado !== 'activo') {
            return false;
        }
        
        // Verificar si tiene acceso activo
        if (!$this->acceso_activo) {
            return false;
        }
        
        // Verificar si tiene un rol asignado
        if (!$this->rol_id) {
            return false;
        }
        
        // Verificar si el rol está activo
        if ($this->rol && !$this->rol->activo) {
            return false;
        }
        
        return true;
    }

    /**
     * Método para registrar último acceso
     */
    public function registrarAcceso(): void
    {
        $this->update([
            'ultimo_acceso' => now(),
            'first_login' => false,
        ]);
    }

    /**
     * Método para generar contraseña temporal
     */
    public function generarPasswordTemporal(): string
    {
        $password = 'temp' . random_int(1000, 9999);
        $this->update([
            'password' => $password,
            'requiere_cambio_password' => true,
            'first_login' => true,
        ]);
        
        return $password;
    }

    /**
     * Scope para empleados que cumplen años hoy
     */
    public function scopeCumpleanosHoy(Builder $query): Builder
    {
        $hoy = now();
        return $query->whereMonth('fecha_nacimiento', $hoy->month)
                    ->whereDay('fecha_nacimiento', $hoy->day);
    }

    /**
     * Scope para empleados con aniversario laboral
     */
    public function scopeAniversarioHoy(Builder $query): Builder
    {
        $hoy = now();
        return $query->whereMonth('fecha_ingreso', $hoy->month)
                    ->whereDay('fecha_ingreso', $hoy->day);
    }
}
