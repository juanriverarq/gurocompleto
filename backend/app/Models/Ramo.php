<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Builder;

class Ramo extends Model
{
    use HasFactory;

    protected $fillable = [
        'nombre',
        'subramo',
        'calcular_iva_pri_a_pre',
        'vista_mapa_oportunidad',
        'broker_id',
    ];

    protected $casts = [
        'calcular_iva_pri_a_pre' => 'boolean',
        'vista_mapa_oportunidad' => 'boolean',
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
     * Relación con comisiones de aseguradoras
     */
    public function comisionesAseguradoras(): HasMany
    {
        return $this->hasMany(ComisionAseguradora::class);
    }

    /**
     * Relación many-to-many con aseguradoras a través de comisiones
     */
    public function aseguradoras(): BelongsToMany
    {
        return $this->belongsToMany(Aseguradora::class, 'comisiones_aseguradoras')
                    ->withPivot(['porcentaje_iva', 'porcentaje_comision', 'pri_a_pre_por_defecto'])
                    ->withTimestamps();
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
     * Scope para búsqueda por nombre o subramo
     */
    public function scopeSearch(Builder $query, string $term): Builder
    {
        return $query->where(function ($query) use ($term) {
            $query->where('nombre', 'like', '%' . $term . '%')
                  ->orWhere('subramo', 'like', '%' . $term . '%');
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
     * Scope para ramos con cálculo de IVA Pri a Pre habilitado
     */
    public function scopeConCalculoIva(Builder $query): Builder
    {
        return $query->where('calcular_iva_pri_a_pre', true);
    }

    /**
     * Scope para ramos con vista de mapa de oportunidad habilitada
     */
    public function scopeConMapaOportunidad(Builder $query): Builder
    {
        return $query->where('vista_mapa_oportunidad', true);
    }

    /**
     * Scope para buscar por subramo
     */
    public function scopeBySubramo(Builder $query, string $subramo): Builder
    {
        return $query->where('subramo', 'like', '%' . $subramo . '%');
    }

    // ===== MÉTODOS AUXILIARES =====

    /**
     * Obtener comisión para una aseguradora específica
     */
    public function getComisionParaAseguradora(int $aseguradoraId): ?ComisionAseguradora
    {
        return $this->comisionesAseguradoras()
                    ->where('aseguradora_id', $aseguradoraId)
                    ->first();
    }

    /**
     * Agregar o actualizar comisión para una aseguradora
     */
    public function setComisionAseguradora(int $aseguradoraId, array $datos): ComisionAseguradora
    {
        return $this->comisionesAseguradoras()->updateOrCreate(
            ['aseguradora_id' => $aseguradoraId],
            $datos
        );
    }

    /**
     * Verificar si tiene comisión configurada para una aseguradora
     */
    public function tieneComisionPara(int $aseguradoraId): bool
    {
        return $this->comisionesAseguradoras()
                    ->where('aseguradora_id', $aseguradoraId)
                    ->exists();
    }

    /**
     * Obtener todas las comisiones con información de aseguradoras
     */
    public function getComisionesConAseguradoras()
    {
        return $this->comisionesAseguradoras()
                    ->with('aseguradora')
                    ->get()
                    ->map(function ($comision) {
                        return [
                            'aseguradora_id' => $comision->aseguradora_id,
                            'aseguradora_nombre' => $comision->aseguradora->nombre,
                            'porcentaje_iva' => $comision->porcentaje_iva,
                            'porcentaje_comision' => $comision->porcentaje_comision,
                            'pri_a_pre_por_defecto' => $comision->pri_a_pre_por_defecto,
                        ];
                    });
    }
}
