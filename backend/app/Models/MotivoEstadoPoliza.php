<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Builder;

class MotivoEstadoPoliza extends Model
{
    use HasFactory;

    protected $table = 'motivos_estados_poliza';

    protected $fillable = [
        'nombre',
        'cancelacion',
        'no_renovacion',
        'creacion_anexo',
        'broker_id',
    ];

    protected $casts = [
        'cancelacion' => 'boolean',
        'no_renovacion' => 'boolean',
        'creacion_anexo' => 'boolean',
    ];

    // ===== RELACIONES =====

    /**
     * Relación con el broker
     */
    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
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
     * Scope para búsqueda por nombre
     */
    public function scopeSearch(Builder $query, string $term): Builder
    {
        return $query->where('nombre', 'like', '%' . $term . '%');
    }

    /**
     * Scope para ordenar por nombre
     */
    public function scopeOrderByName(Builder $query, string $direction = 'asc'): Builder
    {
        return $query->orderBy('nombre', $direction);
    }

    /**
     * Scope para motivos de cancelación
     */
    public function scopeForCancelacion(Builder $query): Builder
    {
        return $query->where('cancelacion', true);
    }

    /**
     * Scope para motivos de no renovación
     */
    public function scopeForNoRenovacion(Builder $query): Builder
    {
        return $query->where('no_renovacion', true);
    }

    /**
     * Scope para motivos de creación de anexo
     */
    public function scopeForCreacionAnexo(Builder $query): Builder
    {
        return $query->where('creacion_anexo', true);
    }
}
