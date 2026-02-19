<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

class RolBroker extends Model
{
    use HasFactory;

    protected $table = 'roles_broker';

    protected $fillable = [
        'nombre',
        'slug',
        'descripcion',
        'permisos',
        'color',
        'activo',
        'nivel_acceso',
        'es_admin',
        'broker_id',
    ];

    protected $casts = [
        'permisos' => 'array',
        'activo' => 'boolean',
        'es_admin' => 'boolean',
        'nivel_acceso' => 'integer',
    ];

    // Constantes para niveles de acceso
    const NIVEL_BASICO = 1;
    const NIVEL_MEDIO = 2;
    const NIVEL_ALTO = 3;
    const NIVEL_ADMIN = 4;

    const NIVELES_ACCESO = [
        self::NIVEL_BASICO => 'Básico',
        self::NIVEL_MEDIO => 'Medio',
        self::NIVEL_ALTO => 'Alto',
        self::NIVEL_ADMIN => 'Administrador',
    ];

    // Permisos predefinidos
    const PERMISOS_DISPONIBLES = [
        'dashboard' => [
            'label' => 'Dashboard',
            'icon' => 'solar:widget-2-bold-duotone',
            'permisos' => ['ver']
        ],
        
        // OPERACIONES DE SEGUROS
        'clientes' => [
            'label' => 'Clientes',
            'icon' => 'solar:users-group-two-rounded-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar', 'exportar', 'importar']
        ],
        'seguimiento_comercial' => [
            'label' => 'Seguimiento Comercial',
            'icon' => 'solar:target-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar']
        ],
        'embudo_ventas' => [
            'label' => 'Embudo de Conversión',
            'icon' => 'solar:chart-2-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar']
        ],
        'cotizaciones' => [
            'label' => 'Cotizaciones',
            'icon' => 'solar:calculator-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar', 'aprobar', 'enviar']
        ],
        'polizas' => [
            'label' => 'Pólizas',
            'icon' => 'solar:shield-check-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar', 'emitir', 'renovar', 'anular']
        ],
        'renovaciones' => [
            'label' => 'Renovaciones',
            'icon' => 'solar:refresh-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar', 'procesar']
        ],
        'automoviles' => [
            'label' => 'Automóviles',
            'icon' => 'solar:car-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar']
        ],
        'anexos_condiciones' => [
            'label' => 'Anexos y Condiciones',
            'icon' => 'solar:document-text-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar']
        ],
        'siniestros' => [
            'label' => 'Siniestros',
            'icon' => 'solar:danger-triangle-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar', 'reportar', 'procesar', 'cerrar']
        ],
        
        // GESTIÓN COMERCIAL
        'pipeline_ventas' => [
            'label' => 'Pipeline de Ventas',
            'icon' => 'solar:chart-2-bold-duotone',
            'permisos' => ['ver', 'editar', 'gestionar']
        ],
        'metas_objetivos' => [
            'label' => 'Metas y Objetivos',
            'icon' => 'solar:target-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar']
        ],
        'equipos_ventas' => [
            'label' => 'Equipos de Ventas',
            'icon' => 'solar:users-group-rounded-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar', 'asignar']
        ],
        'analisis_rendimiento' => [
            'label' => 'Análisis de Rendimiento',
            'icon' => 'solar:graph-up-bold-duotone',
            'permisos' => ['ver', 'exportar']
        ],
        
        // MARKETING DIGITAL
        'leads' => [
            'label' => 'Gestión de Leads',
            'icon' => 'solar:target-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar', 'calificar', 'convertir']
        ],
        'email_marketing' => [
            'label' => 'Email Marketing',
            'icon' => 'solar:letter-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar', 'enviar']
        ],
        'whatsapp_business' => [
            'label' => 'WhatsApp Business',
            'icon' => 'solar:chat-round-dots-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar', 'enviar']
        ],
        'sms_marketing' => [
            'label' => 'SMS Marketing',
            'icon' => 'solar:phone-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar', 'enviar']
        ],
        'enlaces_cotizacion' => [
            'label' => 'Enlaces de Cotización',
            'icon' => 'solar:link-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar']
        ],
        'plantillas_campana' => [
            'label' => 'Plantillas de Campaña',
            'icon' => 'solar:document-text-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar']
        ],
        'recordatorios_automaticos' => [
            'label' => 'Recordatorios Automáticos',
            'icon' => 'solar:clock-circle-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar']
        ],
        'mini_web' => [
            'label' => 'Mini Web',
            'icon' => 'solar:smartphone-2-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar']
        ],
        'creador_contenido' => [
            'label' => 'Creador de Contenido',
            'icon' => 'solar:pallete-2-bold-duotone',
            'permisos' => ['ver', 'usar']
        ],
        'configuracion_masiva' => [
            'label' => 'Configuración Masiva',
            'icon' => 'solar:chat-round-dots-bold-duotone',
            'permisos' => ['ver', 'ejecutar']
        ],
        
        // INTELIGENCIA ARTIFICIAL
        'asistentes_ia' => [
            'label' => 'Asistentes IA',
            'icon' => 'solar:cpu-bolt-bold-duotone',
            'permisos' => ['ver', 'usar', 'configurar']
        ],
        'voice_ai' => [
            'label' => 'Voice AI (ElevenLabs)',
            'icon' => 'solar:microphone-bold-duotone',
            'permisos' => ['ver', 'usar', 'configurar']
        ],
        'analytics_predictivo' => [
            'label' => 'Analytics Predictivo',
            'icon' => 'solar:chart-square-bold-duotone',
            'permisos' => ['ver', 'usar', 'configurar']
        ],
        
        // GESTIÓN FINANCIERA
        'comisiones' => [
            'label' => 'Comisiones',
            'icon' => 'solar:dollar-minimalistic-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar', 'calcular', 'pagar']
        ],
        'cartera' => [
            'label' => 'Cartera General',
            'icon' => 'solar:wallet-bold-duotone',
            'permisos' => ['ver', 'gestionar']
        ],
        'cartera_clientes' => [
            'label' => 'Cartera de Clientes',
            'icon' => 'solar:wallet-money-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar', 'importar', 'exportar']
        ],
        'recaudos' => [
            'label' => 'Recaudos',
            'icon' => 'solar:hand-money-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar', 'importar', 'revertir']
        ],
        'pagos_polizas' => [
            'label' => 'Pagos de Pólizas',
            'icon' => 'solar:card-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar']
        ],
        'liquidar_vendedores' => [
            'label' => 'Liquidar Vendedores',
            'icon' => 'solar:money-bag-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar']
        ],
        'estados_cuenta' => [
            'label' => 'Estados de Cuenta',
            'icon' => 'solar:document-text-bold-duotone',
            'permisos' => ['ver', 'generar', 'enviar']
        ],
        'reportes_financieros' => [
            'label' => 'Reportes Financieros',
            'icon' => 'solar:chart-square-bold-duotone',
            'permisos' => ['ver', 'generar', 'exportar']
        ],
        
        // GESTIÓN DOCUMENTAL
        'contratos' => [
            'label' => 'Contratos',
            'icon' => 'solar:document-medicine-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar', 'firmar']
        ],
        // Nuevos módulos documentales alineados al frontend
        'documentos_poliza' => [
            'label' => 'Documentos de Póliza',
            'icon' => 'solar:folder-with-files-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar', 'descargar']
        ],
        'documentos_siniestro' => [
            'label' => 'Documentos de Siniestro',
            'icon' => 'solar:folder-with-files-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar', 'descargar']
        ],
        'proteccion_datos' => [
            'label' => 'Protección de Datos',
            'icon' => 'solar:shield-user-bold-duotone',
            'permisos' => ['ver', 'gestionar']
        ],
        'documentos_clientes' => [
            'label' => 'Documentos de Clientes',
            'icon' => 'solar:folder-with-files-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar', 'descargar']
        ],
        'cumplimiento_legal' => [
            'label' => 'Cumplimiento Legal',
            'icon' => 'solar:security-safe-bold-duotone',
            'permisos' => ['ver', 'gestionar']
        ],
        
        // TIENDA DE APPS
        'tienda_apps' => [
            'label' => 'Tienda de Apps',
            'icon' => 'solar:widget-6-bold-duotone',
            'permisos' => ['ver', 'instalar', 'desinstalar']
        ],
        
        // INTEGRACIONES
        'integraciones_externas' => [
            'label' => 'Integraciones Externas',
            'icon' => 'solar:programming-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar', 'configurar']
        ],
        'sincronizacion' => [
            'label' => 'Sincronización',
            'icon' => 'solar:refresh-bold-duotone',
            'permisos' => ['ver', 'ejecutar', 'configurar']
        ],
        
        // ADMINISTRACIÓN
        'gestion_usuarios' => [
            'label' => 'Gestión de Usuarios',
            'icon' => 'solar:users-group-rounded-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar', 'asignar_roles']
        ],
        'roles_permisos' => [
            'label' => 'Roles y Permisos',
            'icon' => 'solar:shield-user-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar', 'asignar']
        ],
        'auditoria_accesos' => [
            'label' => 'Auditoría de Accesos',
            'icon' => 'solar:eye-bold-duotone',
            'permisos' => ['ver', 'exportar']
        ],
        'informacion_agencia' => [
            'label' => 'Información de Agencia',
            'icon' => 'solar:buildings-3-bold-duotone',
            'permisos' => ['ver', 'editar']
        ],
        'sedes' => [
            'label' => 'Sedes',
            'icon' => 'solar:buildings-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar']
        ],
        'aseguradoras' => [
            'label' => 'Aseguradoras',
            'icon' => 'solar:buildings-2-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar']
        ],
        'ramos' => [
            'label' => 'Ramos',
            'icon' => 'solar:widget-3-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar']
        ],
        'vendedores' => [
            'label' => 'Vendedores',
            'icon' => 'solar:user-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar']
        ],
        'coberturas' => [
            'label' => 'Coberturas',
            'icon' => 'solar:shield-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar']
        ],
        'tipos_afiliacion' => [
            'label' => 'Tipos de Afiliación',
            'icon' => 'solar:user-plus-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar']
        ],
        'estados_siniestros' => [
            'label' => 'Estados de Siniestros',
            'icon' => 'solar:flag-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar']
        ],
        'motivos_estados_poliza' => [
            'label' => 'Motivos Estados Póliza',
            'icon' => 'solar:question-circle-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar']
        ],
        'mensajeros' => [
            'label' => 'Mensajeros',
            'icon' => 'solar:delivery-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar']
        ],
        'configuracion_sistema' => [
            'label' => 'Configuración del Sistema',
            'icon' => 'solar:settings-bold-duotone',
            'permisos' => ['ver', 'editar']
        ],
        'monitoreo_logs' => [
            'label' => 'Monitoreo y Logs',
            'icon' => 'solar:chart-square-bold-duotone',
            'permisos' => ['ver', 'exportar']
        ],
        // Recursos Humanos (módulo general para todas las pantallas de RR.HH.)
        'rrhh' => [
            'label' => 'Recursos Humanos',
            'icon' => 'solar:users-group-two-rounded-bold-duotone',
            'permisos' => ['ver', 'crear', 'editar', 'eliminar']
        ]
    ];

    /**
     * Relación con Broker (Multi-tenancy)
     */
    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    /**
     * Relación con EmpleadoBroker
     */
    public function empleados(): HasMany
    {
        return $this->hasMany(EmpleadoBroker::class, 'rol_id');
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
            $q->where('nombre', 'like', "%{$search}%")
              ->orWhere('descripcion', 'like', "%{$search}%")
              ->orWhere('slug', 'like', "%{$search}%");
        });
    }

    /**
     * Scope para roles activos
     */
    public function scopeActivos(Builder $query): Builder
    {
        return $query->where('activo', true);
    }

    /**
     * Scope para roles inactivos
     */
    public function scopeInactivos(Builder $query): Builder
    {
        return $query->where('activo', false);
    }

    /**
     * Scope para roles de administrador
     */
    public function scopeAdmins(Builder $query): Builder
    {
        return $query->where('es_admin', true);
    }

    /**
     * Scope para filtrar por nivel de acceso
     */
    public function scopeByNivelAcceso(Builder $query, int $nivel): Builder
    {
        return $query->where('nivel_acceso', $nivel);
    }

    /**
     * Scope para ordenar por nivel de acceso
     */
    public function scopeOrderByNivel(Builder $query, string $direction = 'asc'): Builder
    {
        return $query->orderBy('nivel_acceso', $direction);
    }

    /**
     * Accessor para obtener el nombre del nivel de acceso
     */
    public function getNivelAccesoNombreAttribute(): string
    {
        return self::NIVELES_ACCESO[$this->nivel_acceso] ?? 'Desconocido';
    }

    /**
     * Accessor para el estado en texto
     */
    public function getEstadoTextAttribute(): string
    {
        return $this->activo ? 'Activo' : 'Inactivo';
    }

    /**
     * Accessor para obtener el conteo de empleados
     */
    public function getCantidadEmpleadosAttribute(): int
    {
        return $this->empleados()->count();
    }

    /**
     * Verificar si el rol tiene un permiso específico
     */
    public function tienePermiso(string $permiso): bool
    {
        // Si tiene todos los permisos
        if (in_array('*', $this->permisos ?? [])) {
            return true;
        }
        
        // Verificar permiso específico
        if (in_array($permiso, $this->permisos ?? [])) {
            return true;
        }
        
        // Verificar permiso por módulo (ej: clientes.ver)
        if (str_contains($permiso, '.')) {
            $partes = explode('.', $permiso);
            $modulo = $partes[0];
            $accion = $partes[1];
            
            // Verificar si tiene acceso completo al módulo
            if (in_array($modulo . '.*', $this->permisos ?? [])) {
                return true;
            }
            
            // Verificar si tiene el permiso específico
            if (in_array($permiso, $this->permisos ?? [])) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Verificar si el rol puede acceder a un módulo específico
     */
    public function puedeAccederModulo(string $modulo): bool
    {
        // Si tiene todos los permisos
        if (in_array('*', $this->permisos ?? [])) {
            return true;
        }
        
        // Verificar si tiene acceso completo al módulo
        if (in_array($modulo . '.*', $this->permisos ?? [])) {
            return true;
        }
        
        // Verificar si tiene al menos un permiso del módulo
        $permisosModulo = array_filter($this->permisos ?? [], function($permiso) use ($modulo) {
            return str_starts_with($permiso, $modulo . '.');
        });
        
        return !empty($permisosModulo);
    }

    /**
     * Obtener todos los permisos del rol organizados por módulo
     */
    public function obtenerPermisosPorModulo(): array
    {
        $permisosPorModulo = [];
        
        // Si tiene todos los permisos, devolver todos los módulos disponibles
        if (in_array('*', $this->permisos ?? [])) {
            foreach (self::PERMISOS_DISPONIBLES as $modulo => $config) {
                $permisosPorModulo[$modulo] = $config['permisos'];
            }
            return $permisosPorModulo;
        }
        
        // Procesar cada permiso del rol
        foreach ($this->permisos ?? [] as $permiso) {
            if (str_contains($permiso, '.')) {
                $partes = explode('.', $permiso);
                $modulo = $partes[0];
                $accion = $partes[1];
                
                if (!isset($permisosPorModulo[$modulo])) {
                    $permisosPorModulo[$modulo] = [];
                }
                
                if ($accion === '*') {
                    // Si tiene acceso completo al módulo
                    if (isset(self::PERMISOS_DISPONIBLES[$modulo])) {
                        $permisosPorModulo[$modulo] = self::PERMISOS_DISPONIBLES[$modulo]['permisos'];
                    }
                } else {
                    // Agregar permiso específico
                    $permisosPorModulo[$modulo][] = $accion;
                }
            }
        }
        
        return $permisosPorModulo;
    }

    /**
     * Obtener lista simple de todos los permisos
     */
    public function obtenerPermisos(): array
    {
        if (in_array('*', $this->permisos ?? [])) {
            $todosPermisos = [];
            foreach (self::PERMISOS_DISPONIBLES as $modulo => $config) {
                foreach ($config['permisos'] as $permiso) {
                    $todosPermisos[] = $modulo . '.' . $permiso;
                }
            }
            return $todosPermisos;
        }
        
        return $this->permisos ?? [];
    }

    /**
     * Boot method para generar slug automáticamente
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->slug)) {
                $model->slug = Str::slug($model->nombre);
            }
        });

        static::updating(function ($model) {
            if ($model->isDirty('nombre') && empty($model->slug)) {
                $model->slug = Str::slug($model->nombre);
            }
        });
    }
}
