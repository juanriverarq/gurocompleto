<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Builder;
use Carbon\Carbon;
use App\Traits\BrokerScoped;

class Siniestro extends Model
{
    use HasFactory, SoftDeletes, BrokerScoped;

    protected $fillable = [
        // Relaciones
        'broker_id',
        'poliza_id',
        'cliente_id',
        'assigned_adjuster_id',
        'created_by',
        'updated_by',
        'auditado_por',
        
        // Información básica
        'numero_siniestro',
        'numero_siniestro_compania',
        'numero_poliza',
        'numero_referencia_aseguradora',
        
        // Tipo de siniestro
        'tipo_seguro',
        'tipo_siniestro',
        
        // Fechas
        'fecha_ocurrencia',
        'fecha_aviso',
        'fecha_notificacion_aseguradora',
        'fecha_reporte',
        'fecha_asignacion',
        'fecha_inspeccion',
        'fecha_aprobacion',
        'fecha_rechazo',
        'fecha_pago',
        'fecha_cierre',
        'fecha_ultimo_estado',
        'fecha_reapertura',
        'fecha_auditoria',
        
        // Estados
        'estado',
        'prioridad',
        'finalizado',
        'auditado',
        
        // Montos
        'monto_reclamado',
        'monto_aprobado',
        'monto_pagado',
        'monto_reserva',
        'monto_deducible',
        'monto_coaseguro',
        'valor_indemnizacion',
        'deducible',
        'monto_reclamo',
        'coaseguros',
        'monto_recuperado',
        'porcentaje_aprobacion',
        
        // Información del evento
        'descripcion_evento',
        'descripcion_hechos',
        'causa_siniestro',
        'lugar_ocurrencia',
        'ciudad_ocurrencia',
        'departamento_ocurrencia',
        'pais_ocurrencia',
        'resolucion',
        
        // Aseguradora
        'aseguradora',
        'numero_poliza_aseguradora',
        'contacto_aseguradora',
        'email_aseguradora',
        'telefono_aseguradora',
        
        // Ajustador
        'nombre_ajustador',
        'empresa_ajustadora',
        'contacto_ajustador',
        'email_ajustador',
        'telefono_ajustador',
        
        // Terceros
        'involucra_terceros',
        'datos_terceros',
        'hay_heridos',
        'informacion_heridos',
        'hay_danos_materiales',
        'danos_materiales',
        
        // Evaluaciones
        'evaluacion_inicial',
        'informe_investigacion',
        'informe_peritaje',
        'dictamen_final',
        
        // Rechazo
        'motivo_rechazo',
        'tipo_rechazo',
        
        // Pago
        'metodo_pago',
        'numero_cheque',
        'numero_transferencia',
        'cuenta_destino',
        'beneficiario_pago',
        
        // Métricas
        'dias_tramite',
        'dias_investigacion',
        'dias_aprobacion',
        'dias_pago',
        'total_documentos',
        
        // Calidad
        'calificacion_servicio',
        'comentarios_cliente',
        'cliente_satisfecho',
        
        // Recuperación
        'tiene_recuperacion',
        'detalles_recuperacion',
        
        // Reapertura
        'reabierto',
        'motivo_reapertura',
        
        // Otros
        'proveedor_asignado',
        'observaciones_auditoria',
        
        // Campos JSON
        'testigos',
        'documentos_recibidos',
        'documentos_pendientes',
        'historial_estados',
        'comunicaciones',
        'observaciones',
        'datos_vehiculo',
        'datos_inmueble',
        'datos_medicos',
        'datos_empresa',
        'custom_fields',
        'archivos_adjuntos',
        'amparos_afectados',
    ];

    protected $casts = [
        // Fechas
        'fecha_ocurrencia' => 'date',
        'fecha_aviso' => 'date',
        'fecha_notificacion_aseguradora' => 'date',
        'fecha_reporte' => 'datetime',
        'fecha_asignacion' => 'datetime',
        'fecha_inspeccion' => 'datetime',
        'fecha_aprobacion' => 'datetime',
        'fecha_rechazo' => 'datetime',
        'fecha_pago' => 'datetime',
        'fecha_cierre' => 'datetime',
        'fecha_ultimo_estado' => 'datetime',
        'fecha_reapertura' => 'datetime',
        'fecha_auditoria' => 'datetime',
        
        // Montos
        'monto_reclamado' => 'decimal:2',
        'monto_aprobado' => 'decimal:2',
        'monto_pagado' => 'decimal:2',
        'monto_reserva' => 'decimal:2',
        'monto_deducible' => 'decimal:2',
        'monto_coaseguro' => 'decimal:2',
        'valor_indemnizacion' => 'decimal:2',
        'deducible' => 'decimal:2',
        'monto_reclamo' => 'decimal:2',
        'coaseguros' => 'decimal:2',
        'monto_recuperado' => 'decimal:2',
        'porcentaje_aprobacion' => 'decimal:2',
        
        // Booleanos
        'finalizado' => 'boolean',
        'auditado' => 'boolean',
        'involucra_terceros' => 'boolean',
        'hay_heridos' => 'boolean',
        'hay_danos_materiales' => 'boolean',
        'cliente_satisfecho' => 'boolean',
        'tiene_recuperacion' => 'boolean',
        'reabierto' => 'boolean',
        
        // Enteros
        'dias_tramite' => 'integer',
        'dias_investigacion' => 'integer',
        'dias_aprobacion' => 'integer',
        'dias_pago' => 'integer',
        'total_documentos' => 'integer',
        'calificacion_servicio' => 'integer',
        
        // JSON
        'testigos' => 'array',
        'documentos_recibidos' => 'array',
        'documentos_pendientes' => 'array',
        'historial_estados' => 'array',
        'comunicaciones' => 'array',
        'observaciones' => 'array',
        'datos_vehiculo' => 'array',
        'datos_inmueble' => 'array',
        'datos_medicos' => 'array',
        'datos_empresa' => 'array',
        'custom_fields' => 'array',
        'archivos_adjuntos' => 'array',
        'amparos_afectados' => 'array',
    ];

    // Constantes para enums - Actualizadas según la base de datos real
    const TIPOS_SINIESTRO = [
        'colision' => 'Colisión',
        'robo_total' => 'Robo Total',
        'robo_parcial' => 'Robo Parcial',
        'incendio' => 'Incendio',
        'vandalismo' => 'Vandalismo',
        'fenomenos_naturales' => 'Fenómenos Naturales',
        'accidente_laboral' => 'Accidente Laboral',
        'responsabilidad_civil' => 'Responsabilidad Civil',
        'daños_terceros' => 'Daños a Terceros',
        'muerte' => 'Muerte',
        'incapacidad' => 'Incapacidad',
        'enfermedad' => 'Enfermedad',
        'hospitalizacion' => 'Hospitalización',
        'cirugia' => 'Cirugía',
        'daños_agua' => 'Daños por Agua',
        'explosion' => 'Explosión',
        'terremoto' => 'Terremoto',
        'inundacion' => 'Inundación',
        'granizo' => 'Granizo',
        'vientos_fuertes' => 'Vientos Fuertes',
        'otro' => 'Otro',
    ];

    // Alias para compatibilidad - apunta a la constante principal
    const TIPOS_SINIESTRO_DISPONIBLES = self::TIPOS_SINIESTRO;

    const ESTADOS = [
        'reportado' => 'Reportado',
        'asignado' => 'Asignado',
        'en_revision' => 'En Revisión',
        'investigacion' => 'Investigación',
        'peritaje' => 'Peritaje',
        'documentos_pendientes' => 'Documentos Pendientes',
        'aprobado' => 'Aprobado',
        'rechazado' => 'Rechazado',
        'pagado' => 'Pagado',
        'cerrado' => 'Cerrado',
    ];

    const PRIORIDADES = [
        'baja' => 'Baja',
        'media' => 'Media',
        'alta' => 'Alta',
        'critica' => 'Crítica',
    ];

    const TIPOS_RECHAZO = [
        'documentos_insuficientes' => 'Documentos Insuficientes',
        'fuera_cobertura' => 'Fuera de Cobertura',
        'fraude' => 'Fraude',
        'exclusion_poliza' => 'Exclusión de Póliza',
        'prescripcion' => 'Prescripción',
        'causa_no_cubierta' => 'Causa No Cubierta',
        'falta_pago_prima' => 'Falta de Pago de Prima',
        'otro' => 'Otro',
    ];

    const TIPOS_SEGURO = [
        'auto' => 'Automóvil',
        'hogar' => 'Hogar',
        'vida' => 'Vida',
        'salud' => 'Salud',
        'empresarial' => 'Empresarial',
        'responsabilidad_civil' => 'Responsabilidad Civil',
        'transporte' => 'Transporte',
        'construccion' => 'Construcción',
        'agropecuario' => 'Agropecuario',
        'fianza' => 'Fianza',
    ];

    // Relaciones
    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    public function poliza(): BelongsTo
    {
        return $this->belongsTo(Poliza::class);
    }

    public function cliente(): BelongsTo
    {
        return $this->belongsTo(Cliente::class);
    }

    public function assignedAdjuster(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_adjuster_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function auditedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'auditado_por');
    }

    // Scopes
    public function scopeForBroker(Builder $query, int $brokerId): Builder
    {
        return $query->where('broker_id', $brokerId);
    }

    public function scopeByEstado(Builder $query, string $estado): Builder
    {
        return $query->where('estado', $estado);
    }

    public function scopeByPrioridad(Builder $query, string $prioridad): Builder
    {
        return $query->where('prioridad', $prioridad);
    }

    public function scopeByTipoSeguro(Builder $query, string $tipoSeguro): Builder
    {
        return $query->where('tipo_seguro', $tipoSeguro);
    }

    public function scopeByTipoSiniestro(Builder $query, string $tipoSiniestro): Builder
    {
        return $query->where('tipo_siniestro', $tipoSiniestro);
    }

    public function scopeByAseguradora(Builder $query, string $aseguradora): Builder
    {
        return $query->where('aseguradora', 'like', '%' . $aseguradora . '%');
    }

    public function scopeActiveOnly(Builder $query): Builder
    {
        return $query->whereNotIn('estado', ['rechazado', 'pagado', 'cerrado']);
    }

    public function scopeNeedingAttention(Builder $query): Builder
    {
        return $query->where(function ($q) {
            $q->where('estado', 'solicitado')
              ->where('fecha_aviso', '<=', now()->subDays(7));
        });
    }

    public function scopeOverdue(Builder $query): Builder
    {
        return $query->where(function ($q) {
            $q->where('fecha_aviso', '<=', now()->subDays(30))
              ->whereNotIn('estado', ['pagado', 'cerrado']);
        });
    }

    public function scopeHighValue(Builder $query, float $threshold = 10000000): Builder
    {
        return $query->where('monto_reclamo', '>=', $threshold);
    }

    public function scopeWithTerceros(Builder $query): Builder
    {
        // Como ya no tenemos el campo involucra_terceros, podemos buscar en amparos_afectados
        return $query->whereNotNull('amparos_afectados')
                    ->where('amparos_afectados', '!=', '[]');
    }

    public function scopeWithHeridos(Builder $query): Builder
    {
        // Como ya no tenemos el campo hay_heridos, lo omitimos o buscamos en descripción
        return $query->where('descripcion_hechos', 'like', '%herido%')
                    ->orWhere('descripcion_hechos', 'like', '%lesion%');
    }

    public function scopeForAdjuster(Builder $query, int $adjusterId): Builder
    {
        return $query->where('assigned_adjuster_id', $adjusterId);
    }

    public function scopeRecentlyReported(Builder $query, int $days = 7): Builder
    {
        return $query->where('fecha_aviso', '>=', now()->subDays($days));
    }

    public function scopeSearchText(Builder $query, string $search): Builder
    {
        return $query->where(function ($q) use ($search) {
            $q->where('numero_siniestro', 'like', '%' . $search . '%')
              ->orWhere('numero_siniestro_compania', 'like', '%' . $search . '%')
              ->orWhere('numero_poliza', 'like', '%' . $search . '%')
              ->orWhere('descripcion_hechos', 'like', '%' . $search . '%')
              ->orWhere('proveedor_asignado', 'like', '%' . $search . '%')
              ->orWhere('aseguradora', 'like', '%' . $search . '%')
              ->orWhereHas('cliente', function ($clienteQuery) use ($search) {
                  $clienteQuery->where('first_name', 'like', '%' . $search . '%')
                               ->orWhere('last_name', 'like', '%' . $search . '%')
                               ->orWhere('email', 'like', '%' . $search . '%')
                               ->orWhere('document_number', 'like', '%' . $search . '%');
              });
        });
    }

    // Accessors
    public function getFullDescriptionAttribute(): string
    {
        return $this->numero_siniestro . ' - ' . $this->descripcion_hechos;
    }

    public function getEstadoNameAttribute(): string
    {
        return self::ESTADOS[$this->estado] ?? $this->estado;
    }

    public function getPrioridadNameAttribute(): string
    {
        return self::PRIORIDADES[$this->prioridad] ?? $this->prioridad;
    }

    public function getTipoSeguroNameAttribute(): string
    {
        return self::TIPOS_SEGURO[$this->tipo_seguro] ?? $this->tipo_seguro;
    }

    public function getTipoSiniestroNameAttribute(): string
    {
        return self::TIPOS_SINIESTRO[$this->tipo_siniestro] ?? $this->tipo_siniestro;
    }

    public function getDiasTramiteAttribute(): int
    {
        if (!$this->fecha_aviso) {
            return 0;
        }
        
        if ($this->estado === 'pagado' || $this->estado === 'cerrado') {
            $fechaFin = $this->fecha_cierre ?? $this->fecha_pago;
            return $fechaFin ? $this->fecha_aviso->diffInDays($fechaFin) : 0;
        }
        return $this->fecha_aviso->diffInDays(now());
    }

    public function getIsOverdueAttribute(): bool
    {
        if (in_array($this->estado, ['pagado', 'cerrado', 'rechazado'])) {
            return false;
        }
        
        if (!$this->fecha_aviso) {
            return false;
        }
        
        return $this->fecha_aviso->diffInDays(now()) > 30;
    }

    public function getIsCriticalAttribute(): bool
    {
        return $this->prioridad === 'critica' || 
               $this->monto_reclamo > 50000000;
    }

    public function getProgressPercentageAttribute(): float
    {
        $estados = ['reportado', 'asignado', 'en_revision', 'investigacion', 'peritaje', 'aprobado', 'pagado'];
        $estadoIndex = array_search($this->estado, $estados);
        
        if ($this->estado === 'rechazado' || $this->estado === 'cerrado') {
            return 100;
        }
        
        return $estadoIndex !== false ? (($estadoIndex + 1) / count($estados)) * 100 : 0;
    }

    public function getHasDocumentsPendingAttribute(): bool
    {
        return !empty($this->documentos_pendientes) || $this->estado === 'documentos_pendientes';
    }

    public function getCanApproveAttribute(): bool
    {
        return in_array($this->estado, ['investigacion', 'peritaje']);
    }

    public function getCanRejectAttribute(): bool
    {
        return !in_array($this->estado, ['pagado', 'cerrado', 'rechazado']);
    }

    public function getCanPayAttribute(): bool
    {
        return in_array($this->estado, ['aprobado', 'aprobado_parcial']);
    }

    public function getCanReopenAttribute(): bool
    {
        return in_array($this->estado, ['rechazado', 'cerrado']);
    }

    /**
     * Validar si una transición de estado es permitida
     * Para usuarios administrativos, permitir todas las transiciones
     * Para usuarios normales, usar reglas de negocio más flexibles
     */
    public function canTransitionTo(string $nuevoEstado): bool
    {
        // Si el estado es el mismo, no permitir (no tiene sentido)
        if ($this->estado === $nuevoEstado) {
            return false;
        }

        // Estados finales no se pueden cambiar
        if (in_array($this->estado, ['cerrado'])) {
            return false;
        }

        // Para usuarios administrativos (MASTER/ADMIN), permitir todas las transiciones
        $user = auth()->user();
        if ($user) {
            // Si es usuario MASTER, permitir todas las transiciones
            if ($user->user_type === 'MASTER') {
                return true;
            }

            // Si es usuario ADMIN, permitir todas las transiciones
            if ($user->user_type === 'ADMIN') {
                return true;
            }

            // Si es empleado con rol admin
            if ($user->user_type === 'EMPLEADO' && ($user->role === 'super_admin' || $user->role === 'admin')) {
                return true;
            }
        }

        // Transiciones permitidas para usuarios normales (más flexibles)
        $transicionesPermitidas = [
            'reportado' => ['asignado', 'en_revision', 'investigacion', 'peritaje', 'aprobado', 'aprobado_parcial', 'rechazado'],
            'asignado' => ['en_revision', 'investigacion', 'peritaje', 'aprobado', 'aprobado_parcial', 'rechazado'],
            'en_revision' => ['investigacion', 'peritaje', 'aprobado', 'aprobado_parcial', 'rechazado'],
            'investigacion' => ['peritaje', 'aprobado', 'aprobado_parcial', 'rechazado'],
            'peritaje' => ['aprobado', 'aprobado_parcial', 'rechazado'],
            'documentos_pendientes' => ['aprobado', 'aprobado_parcial', 'rechazado'],
            'aprobado' => ['pagado', 'rechazado'],
            'aprobado_parcial' => ['pagado', 'rechazado'],
            'pagado' => ['cerrado'],
            'rechazado' => ['cerrado', 'en_revision'], // Permitir reapertura
        ];

        return isset($transicionesPermitidas[$this->estado]) &&
               in_array($nuevoEstado, $transicionesPermitidas[$this->estado]);
    }

    // Métodos de negocio
    public function changeEstado(string $nuevoEstado, string $observacion = null): bool
    {
        $estadoAnterior = $this->estado;
        $fechaAnterior = $this->fecha_ultimo_estado;
        
        $this->estado = $nuevoEstado;
        $this->fecha_ultimo_estado = now();
        
        // Actualizar fecha específica del estado
        switch ($nuevoEstado) {
            case 'asignado':
                $this->fecha_asignacion = now();
                break;
            case 'aprobado':
            case 'aprobado_parcial':
                $this->fecha_aprobacion = now();
                break;
            case 'rechazado':
                $this->fecha_rechazo = now();
                break;
            case 'pagado':
                $this->fecha_pago = now();
                break;
            case 'cerrado':
                $this->fecha_cierre = now();
                break;
        }
        
        // Actualizar historial
        $this->addToHistorial($estadoAnterior, $nuevoEstado, $observacion);
        
        return $this->save();
    }

    public function assignAdjuster(int $adjusterId, string $observacion = null): bool
    {
        $this->assigned_adjuster_id = $adjusterId;
        $this->fecha_asignacion = now();
        
        if ($this->estado === 'reportado') {
            $this->changeEstado('asignado', $observacion);
        }
        
        return $this->save();
    }

    public function approve(float $montoAprobado = null, string $observacion = null): bool
    {
        $this->monto_aprobado = $montoAprobado ?? $this->monto_reclamo;
        $this->porcentaje_aprobacion = ($this->monto_aprobado / $this->monto_reclamo) * 100;
        
        $estado = $this->monto_aprobado == $this->monto_reclamo ? 'aprobado' : 'aprobado_parcial';
        
        return $this->changeEstado($estado, $observacion);
    }

    public function reject(string $motivo, string $tipoRechazo = null): bool
    {
        $this->motivo_rechazo = $motivo;
        $this->tipo_rechazo = $tipoRechazo;
        
        return $this->changeEstado('rechazado', $motivo);
    }

    public function pay(float $montoPagado = null, string $metodoPago = null, array $datosPago = []): bool
    {
        $this->monto_pagado = $montoPagado ?? $this->monto_aprobado;
        $this->metodo_pago = $metodoPago;
        
        if (!empty($datosPago)) {
            $this->numero_cheque = $datosPago['numero_cheque'] ?? null;
            $this->numero_transferencia = $datosPago['numero_transferencia'] ?? null;
            $this->cuenta_destino = $datosPago['cuenta_destino'] ?? null;
            $this->beneficiario_pago = $datosPago['beneficiario_pago'] ?? null;
        }
        
        return $this->changeEstado('pagado', 'Siniestro pagado por ' . number_format($this->monto_pagado, 2));
    }

    public function reopen(string $motivo): bool
    {
        $this->reabierto = true;
        $this->motivo_reapertura = $motivo;
        $this->fecha_reapertura = now();
        
        return $this->changeEstado('en_revision', $motivo);
    }

    public function close(string $observacion = null): bool
    {
        return $this->changeEstado('cerrado', $observacion);
    }

    public function addComunicacion(string $tipo, string $contenido, int $userId = null): bool
    {
        $comunicaciones = $this->comunicaciones ?? [];
        $comunicaciones[] = [
            'tipo' => $tipo,
            'contenido' => $contenido,
            'fecha' => now()->toISOString(),
            'usuario_id' => $userId ?? auth()->id() ?? null,
        ];
        
        $this->comunicaciones = $comunicaciones;
        return $this->save();
    }

    public function addDocumento(string $tipo, string $nombre, string $ruta, int $userId = null): bool
    {
        $documentos = $this->documentos_recibidos ?? [];
        $documentos[] = [
            'tipo' => $tipo,
            'nombre' => $nombre,
            'ruta' => $ruta,
            'fecha_subida' => now()->toISOString(),
            'subido_por' => $userId ?? auth()->id() ?? null,
        ];
        
        $this->documentos_recibidos = $documentos;
        $this->total_documentos = count($documentos);
        
        return $this->save();
    }

    public function addObservacion(string $observacion, int $userId = null): bool
    {
        $observaciones = $this->observaciones ?? [];
        $observaciones[] = [
            'contenido' => $observacion,
            'fecha' => now()->toISOString(),
            'usuario_id' => $userId ?? auth()->id() ?? null,
        ];
        
        $this->observaciones = $observaciones;
        return $this->save();
    }

    private function addToHistorial(string $estadoAnterior, string $nuevoEstado, string $observacion = null): void
    {
        $historial = $this->historial_estados ?? [];
        $historial[] = [
            'estado_anterior' => $estadoAnterior,
            'nuevo_estado' => $nuevoEstado,
            'fecha' => now()->toISOString(),
            'observacion' => $observacion,
            'usuario_id' => auth()->id() ?? null,
        ];
        
        $this->historial_estados = $historial;
    }

    // Métodos estáticos para estadísticas
    public static function getStatistics(int $brokerId): array
    {
        $query = self::forBroker($brokerId);
        
        return [
            'total_siniestros' => $query->count(),
            'reportados' => $query->byEstado('reportado')->count(),
            'en_revision' => $query->byEstado('en_revision')->count(),
            'investigacion' => $query->byEstado('investigacion')->count(),
            'aprobados' => $query->byEstado('aprobado')->count(),
            'pagados' => $query->byEstado('pagado')->count(),
            'rechazados' => $query->byEstado('rechazado')->count(),
            'monto_total_reclamado' => $query->sum('monto_reclamado'),
            'monto_total_aprobado' => $query->sum('monto_aprobado'),
            'monto_total_pagado' => $query->sum('monto_pagado'),
            'promedio_dias_tramite' => $query->avg('dias_tramite'),
            'siniestros_criticos' => $query->byPrioridad('critica')->count(),
            'siniestros_vencidos' => $query->overdue()->count(),
            'con_terceros' => $query->withTerceros()->count(),
            'con_heridos' => $query->withHeridos()->count(),
            'necesitan_atencion' => $query->needingAttention()->count(),
        ];
    }

    public static function generateSiniestroNumber(): string
    {
        $year = date('Y');
        $prefix = "SIN-{$year}-";

        // Obtener el mayor sufijo numérico ignorando scopes (broker), para evitar duplicados globales
        $maxSuffix = self::withoutGlobalScopes()
            ->where('numero_siniestro', 'like', $prefix . '%')
            ->selectRaw("MAX(CAST(SUBSTRING_INDEX(numero_siniestro, '-', -1) AS UNSIGNED)) as max_suffix")
            ->value('max_suffix');

        $next = ((int) $maxSuffix) + 1;

        // Intentar hasta 5 veces en caso de carrera concurrente
        for ($i = 0; $i < 5; $i++) {
            $candidate = $prefix . str_pad($next, 3, '0', STR_PAD_LEFT);

            $exists = self::withoutGlobalScopes()
                ->where('numero_siniestro', $candidate)
                ->exists();

            if (!$exists) {
                return $candidate;
            }

            $next++;
        }

        // Fallback: sufijo aleatorio corto para evitar romper flujo (muy poco probable llegar aquí)
        return $prefix . strtoupper(substr(bin2hex(random_bytes(2)), 0, 4));
    }
}
