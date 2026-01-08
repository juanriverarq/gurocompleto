<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Builder;
use App\Traits\BrokerScoped;

class Vendedor extends Model
{
    use HasFactory, BrokerScoped;

    protected $table = 'vendedores';

    protected $fillable = [
        'nombres',
        'tipo_documento',
        'numero_documento',
        'telefono',
        'celular',
        'email',
        'cuenta_bancaria',
        'tipo_persona',
        'tipo_retencion',
        'es_agencia',
        'porcentaje_comision',
        'calcular_comision_sobre',
        'porcentaje_retencion',
        'porcentaje_retencion_ica',
        'porcentaje_iva',
        'porcentaje_retencion_iva',
        'comisiones_diferentes_por_ano',
        'fecha_vinculacion',
        'broker_id',
    ];

    protected $casts = [
        'es_agencia' => 'boolean',
        'comisiones_diferentes_por_ano' => 'boolean',
        'porcentaje_comision' => 'decimal:2',
        'porcentaje_retencion' => 'decimal:2',
        'porcentaje_retencion_ica' => 'decimal:2',
        'porcentaje_iva' => 'decimal:2',
        'porcentaje_retencion_iva' => 'decimal:2',
        'fecha_vinculacion' => 'date',
    ];

    // Constantes para enums
    const TIPOS_PERSONA = [
        'natural' => 'Natural',
        'juridica' => 'Jurídica',
    ];

    // Tipos estandarizados de retención (opcionales)
    // Claves internas => Etiquetas visibles
    const TIPOS_RETENCION = [
        'natural_ss' => 'Persona natural con seguridad social (sin retenciones)',
        'natural_sin_ss_rf10' => 'Persona natural sin seguridad social (con retención en la fuente 10%)',
        'juridica_simplificado' => 'Persona jurídica simplificado (IVA-RETEIVA)',
        'juridica_no_simplificado_rf11' => 'Persona jurídica no simplificado (IVA-Retención en la fuente 11%)',
    ];

    const CALCULAR_COMISION_SOBRE = [
        'agencia' => 'Agencia',
        'prima_neta' => 'Prima Neta',
    ];

    const TIPOS_DOCUMENTO = [
        'CC' => 'Cédula de Ciudadanía',
        'CE' => 'Cédula de Extranjería',
        'NIT' => 'NIT',
        'Pasaporte' => 'Pasaporte',
        'RUC' => 'RUC',
    ];

    // ===== RELACIONES =====

    /**
     * Relación con el broker
     */
    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    /**
     * Relación con las pólizas donde es vendedor principal
     */
    public function polizas()
    {
        return $this->hasMany(Poliza::class, 'seller_id');
    }

    /**
     * Relación con las pólizas donde es vendedor secundario
     */
    public function polizasSecundarias()
    {
        return $this->hasMany(Poliza::class, 'seller_id_2');
    }

    // ===== SCOPES =====

    /**
     * Scope para filtrar por broker (multi-tenant)
     */
    public function scopeForBroker(Builder $query, int $brokerId): Builder
    {
        return $query->where('broker_id', $brokerId);
    }

    /**
     * Scope para búsqueda por nombre, documento o email
     */
    public function scopeSearch(Builder $query, string $term): Builder
    {
        return $query->where(function ($query) use ($term) {
            $query->where('nombres', 'like', '%' . $term . '%')
                  ->orWhere('numero_documento', 'like', '%' . $term . '%')
                  ->orWhere('email', 'like', '%' . $term . '%')
                  ->orWhere('telefono', 'like', '%' . $term . '%')
                  ->orWhere('celular', 'like', '%' . $term . '%');
        });
    }

    /**
     * Scope para ordenar por nombre
     */
    public function scopeOrderByName(Builder $query, string $direction = 'asc'): Builder
    {
        return $query->orderBy('nombres', $direction);
    }

    /**
     * Scope para filtrar por tipo de persona
     */
    public function scopeByTipoPersona(Builder $query, string $tipo): Builder
    {
        return $query->where('tipo_persona', $tipo);
    }

    /**
     * Scope para filtrar solo agencias
     */
    public function scopeAgencias(Builder $query): Builder
    {
        return $query->where('es_agencia', true);
    }

    /**
     * Scope para filtrar solo vendedores (no agencias)
     */
    public function scopeVendedores(Builder $query): Builder
    {
        return $query->where('es_agencia', false);
    }

    /**
     * Scope para buscar por número de documento
     */
    public function scopeByDocumento(Builder $query, string $documento): Builder
    {
        return $query->where('numero_documento', $documento);
    }

    /**
     * Scope para buscar por email
     */
    public function scopeByEmail(Builder $query, string $email): Builder
    {
        return $query->where('email', $email);
    }

    /**
     * Scope para vendedores con comisiones diferentes por año
     */
    public function scopeConComisionesDiferentes(Builder $query): Builder
    {
        return $query->where('comisiones_diferentes_por_ano', true);
    }

    // ===== ACCESSORS =====

    /**
     * Obtener el tipo de persona en texto
     */
    public function getTipoPersonaTextAttribute(): string
    {
        return self::TIPOS_PERSONA[$this->tipo_persona] ?? $this->tipo_persona;
    }

    /**
     * Obtener el cálculo de comisión en texto
     */
    public function getCalcularComisionSobreTextAttribute(): string
    {
        return self::CALCULAR_COMISION_SOBRE[$this->calcular_comision_sobre] ?? $this->calcular_comision_sobre;
    }

    /**
     * Obtener el tipo de documento en texto
     */
    public function getTipoDocumentoTextAttribute(): string
    {
        return self::TIPOS_DOCUMENTO[$this->tipo_documento] ?? $this->tipo_documento;
    }

    /**
     * Obtener el porcentaje de comisión formateado
     */
    public function getPorcentajeComisionFormattedAttribute(): string
    {
        return number_format($this->porcentaje_comision, 2) . '%';
    }

    /**
     * Obtener el porcentaje de retención formateado
     */
    public function getPorcentajeRetencionFormattedAttribute(): string
    {
        return number_format($this->porcentaje_retencion, 2) . '%';
    }

    /**
     * Obtener el porcentaje de retención ICA formateado
     */
    public function getPorcentajeRetencionIcaFormattedAttribute(): string
    {
        return number_format($this->porcentaje_retencion_ica, 2) . '%';
    }

    /**
     * Obtener el porcentaje de IVA formateado
     */
    public function getPorcentajeIvaFormattedAttribute(): string
    {
        return number_format($this->porcentaje_iva, 2) . '%';
    }

    /**
     * Obtener el porcentaje de retención IVA formateado
     */
    public function getPorcentajeRetencionIvaFormattedAttribute(): string
    {
        return number_format($this->porcentaje_retencion_iva, 2) . '%';
    }

    /**
     * Verificar si es una agencia
     */
    public function isAgencia(): bool
    {
        return $this->es_agencia;
    }

    /**
     * Verificar si es persona natural
     */
    public function isPersonaNatural(): bool
    {
        return $this->tipo_persona === 'natural';
    }

    /**
     * Verificar si es persona jurídica
     */
    public function isPersonaJuridica(): bool
    {
        return $this->tipo_persona === 'juridica';
    }
}
