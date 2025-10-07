<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Builder;

class Sede extends Model
{
    use HasFactory;

    protected $fillable = [
        'nombre',
        'email',
        'direccion',
        'telefono',
        'broker_id',
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
        return $query->where(function ($query) use ($term) {
            $query->where('nombre', 'like', '%' . $term . '%')
                  ->orWhere('email', 'like', '%' . $term . '%')
                  ->orWhere('direccion', 'like', '%' . $term . '%')
                  ->orWhere('telefono', 'like', '%' . $term . '%');
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
     * Scope para buscar por email
     */
    public function scopeByEmail(Builder $query, string $email): Builder
    {
        return $query->where('email', $email);
    }
}
