<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Builder;

class Mensajero extends Model
{
    use HasFactory;

    protected $fillable = [
        'nombre',
        'telefono',
        'celular',
        'email',
        'direccion',
        'ciudad',
        'vehiculo',
        'activo',
        'tarifa_base',
        'observaciones',
        'broker_id',
    ];

    protected $casts = [
        'activo' => 'boolean',
        'tarifa_base' => 'decimal:2',
    ];

    // Constantes para tipos de vehículos
    const VEHICULOS = [
        'moto' => 'Motocicleta',
        'carro' => 'Automóvil',
        'bicicleta' => 'Bicicleta',
        'pie' => 'A pie',
        'otro' => 'Otro',
    ];

    /**
     * Relación con Broker (Multi-tenancy)
     */
    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
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
              ->orWhere('telefono', 'like', "%{$search}%")
              ->orWhere('celular', 'like', "%{$search}%")
              ->orWhere('email', 'like', "%{$search}%")
              ->orWhere('ciudad', 'like', "%{$search}%");
        });
    }

    /**
     * Scope para mensajeros activos
     */
    public function scopeActivos(Builder $query): Builder
    {
        return $query->where('activo', true);
    }

    /**
     * Scope para mensajeros inactivos
     */
    public function scopeInactivos(Builder $query): Builder
    {
        return $query->where('activo', false);
    }

    /**
     * Scope para filtrar por ciudad
     */
    public function scopeByCiudad(Builder $query, string $ciudad): Builder
    {
        return $query->where('ciudad', $ciudad);
    }

    /**
     * Scope para filtrar por tipo de vehículo
     */
    public function scopeByVehiculo(Builder $query, string $vehiculo): Builder
    {
        return $query->where('vehiculo', $vehiculo);
    }

    /**
     * Scope para ordenar por nombre
     */
    public function scopeOrderByName(Builder $query, string $direction = 'asc'): Builder
    {
        return $query->orderBy('nombre', $direction);
    }

    /**
     * Accessor para obtener el nombre del vehículo
     */
    public function getVehiculoNombreAttribute(): string
    {
        return self::VEHICULOS[$this->vehiculo] ?? $this->vehiculo ?? 'No especificado';
    }

    /**
     * Accessor para el estado en texto
     */
    public function getEstadoTextAttribute(): string
    {
        return $this->activo ? 'Activo' : 'Inactivo';
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
     * Scope para obtener mensajeros con tarifas definidas
     */
    public function scopeConTarifa(Builder $query): Builder
    {
        return $query->whereNotNull('tarifa_base')
                    ->where('tarifa_base', '>', 0);
    }
}
