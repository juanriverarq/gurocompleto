<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Builder;

class ComisionAseguradora extends Model
{
    use HasFactory;

    protected $table = 'comisiones_aseguradoras';

    protected $fillable = [
        'ramo_id',
        'aseguradora_id',
        'porcentaje_iva',
        'porcentaje_comision',
        'pri_a_pre_por_defecto',
    ];

    protected $casts = [
        'porcentaje_iva' => 'decimal:2',
        'porcentaje_comision' => 'decimal:2',
        'pri_a_pre_por_defecto' => 'decimal:2',
    ];

    // ===== RELACIONES =====

    /**
     * Relación con el ramo
     */
    public function ramo(): BelongsTo
    {
        return $this->belongsTo(Ramo::class);
    }

    /**
     * Relación con la aseguradora
     */
    public function aseguradora(): BelongsTo
    {
        return $this->belongsTo(Aseguradora::class);
    }

    // ===== SCOPES =====

    /**
     * Scope para filtrar por ramo
     */
    public function scopeForRamo(Builder $query, int $ramoId): Builder
    {
        return $query->where('ramo_id', $ramoId);
    }

    /**
     * Scope para filtrar por aseguradora
     */
    public function scopeForAseguradora(Builder $query, int $aseguradoraId): Builder
    {
        return $query->where('aseguradora_id', $aseguradoraId);
    }

    /**
     * Scope para filtrar por broker a través del ramo
     */
    public function scopeForBroker(Builder $query, int $brokerId): Builder
    {
        return $query->whereHas('ramo', function ($ramoQuery) use ($brokerId) {
            $ramoQuery->where('broker_id', $brokerId);
        });
    }

    /**
     * Scope para comisiones con porcentaje mayor a un valor
     */
    public function scopeWithComisionMayorA(Builder $query, float $porcentaje): Builder
    {
        return $query->where('porcentaje_comision', '>', $porcentaje);
    }

    /**
     * Scope para comisiones con IVA habilitado
     */
    public function scopeConIva(Builder $query): Builder
    {
        return $query->where('porcentaje_iva', '>', 0);
    }

    // ===== ACCESSORS =====

    /**
     * Obtener el porcentaje de comisión formateado
     */
    public function getPorcentajeComisionFormattedAttribute(): string
    {
        return number_format($this->porcentaje_comision, 2) . '%';
    }

    /**
     * Obtener el porcentaje de IVA formateado
     */
    public function getPorcentajeIvaFormattedAttribute(): string
    {
        return number_format($this->porcentaje_iva, 2) . '%';
    }

    /**
     * Obtener el Pri a Pre formateado
     */
    public function getPriAPreFormattedAttribute(): string
    {
        return number_format($this->pri_a_pre_por_defecto, 2) . '%';
    }

    // ===== MÉTODOS DE CÁLCULO =====

    /**
     * Calcular comisión sobre un monto
     */
    public function calcularComision(float $monto): float
    {
        return $monto * ($this->porcentaje_comision / 100);
    }

    /**
     * Calcular IVA sobre un monto
     */
    public function calcularIva(float $monto): float
    {
        return $monto * ($this->porcentaje_iva / 100);
    }

    /**
     * Calcular Pri a Pre sobre un monto
     */
    public function calcularPriAPre(float $monto): float
    {
        return $monto * ($this->pri_a_pre_por_defecto / 100);
    }

    /**
     * Calcular totales de comisión e IVA
     */
    public function calcularTotales(float $monto): array
    {
        $comision = $this->calcularComision($monto);
        $iva = $this->calcularIva($comision);
        $priAPre = $this->calcularPriAPre($monto);

        return [
            'monto_base' => $monto,
            'comision' => $comision,
            'iva' => $iva,
            'pri_a_pre' => $priAPre,
            'total_comision' => $comision + $iva,
            'total_general' => $monto + $comision + $iva + $priAPre,
        ];
    }
}
