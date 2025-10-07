<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Builder;

class Aseguradora extends Model
{
    use HasFactory;

    protected $fillable = [
        'nombre',
        'cuit', // alias NIT
        'email',
        'direccion',
        'telefono',
        'cuenta_bancaria',
        'link_pago',
        'codigo_intermediario',
        'retencion',
        'iva',
        'retencion_iva',
        'broker_id',
    ];

    protected $casts = [
        'retencion' => 'decimal:2',
        'iva' => 'decimal:2',
        'retencion_iva' => 'decimal:2',
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
     * Relación con comisiones de ramos
     */
    public function comisionesRamos(): HasMany
    {
        return $this->hasMany(ComisionAseguradora::class);
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
     * Scope para búsqueda por nombre, CUIT o email
     */
    public function scopeSearch(Builder $query, string $term): Builder
    {
        return $query->where(function ($query) use ($term) {
            $query->where('nombre', 'like', '%' . $term . '%')
                  ->orWhere('cuit', 'like', '%' . $term . '%')
                  ->orWhere('email', 'like', '%' . $term . '%')
                  ->orWhere('codigo_intermediario', 'like', '%' . $term . '%');
        });
    }

    /**
     * Scope para ordenar por nombre
     */
    public function scopeOrderByName(Builder $query, string $direction = 'asc'): Builder
    {
        return $query->orderBy('nombre', $direction);
    }

    /**
     * Scope para buscar por CUIT
     */
    public function scopeByCuit(Builder $query, string $cuit): Builder
    {
        return $query->where('cuit', $cuit);
    }

    /**
     * Scope para buscar por email
     */
    public function scopeByEmail(Builder $query, string $email): Builder
    {
        return $query->where('email', $email);
    }

    /**
     * Scope para buscar por código de intermediario
     */
    public function scopeByCodigoIntermediario(Builder $query, string $codigo): Builder
    {
        return $query->where('codigo_intermediario', $codigo);
    }

    // ===== ACCESSORS =====

    /**
     * Obtener el porcentaje de retención formateado
     */
    public function getRetencionFormattedAttribute(): string
    {
        return number_format($this->retencion, 2) . '%';
    }

    /**
     * Obtener el porcentaje de IVA formateado
     */
    public function getIvaFormattedAttribute(): string
    {
        return number_format($this->iva, 2) . '%';
    }

    /**
     * Obtener el porcentaje de retención IVA formateado
     */
    public function getRetencionIvaFormattedAttribute(): string
    {
        return number_format($this->retencion_iva, 2) . '%';
    }

    /**
     * Alias accessor para exponer NIT en respuestas si el frontend lo requiere
     */
    public function getNitAttribute(): ?string
    {
        return $this->cuit;
    }
}
