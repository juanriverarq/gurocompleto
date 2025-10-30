<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class VentasCruzadasAnalisis extends Model
{
    use HasFactory;

    protected $table = 'ventas_cruzadas_analisis';

    protected $fillable = [
        'broker_id',
        'cliente_id',
        'poliza_id',
        'datos_entrada',
        'recomendaciones',
        'scoring_promedio',
        'modelo_ia',
        'fecha_analisis',
        'vigente',
        'valido_hasta',
        'veces_consultado',
        'ultima_consulta'
    ];

    protected $casts = [
        'datos_entrada' => 'array',
        'recomendaciones' => 'array',
        'scoring_promedio' => 'decimal:2',
        'vigente' => 'boolean',
        'fecha_analisis' => 'datetime',
        'valido_hasta' => 'datetime',
        'ultima_consulta' => 'datetime',
    ];

    /**
     * Relación con Broker
     */
    public function broker()
    {
        return $this->belongsTo(Broker::class);
    }

    /**
     * Relación con Cliente
     */
    public function cliente()
    {
        return $this->belongsTo(Cliente::class);
    }

    /**
     * Relación con Póliza
     */
    public function poliza()
    {
        return $this->belongsTo(Poliza::class);
    }

    /**
     * Scope para análisis vigentes
     */
    public function scopeVigente($query)
    {
        return $query->where('vigente', true)
            ->where(function($q) {
                $q->whereNull('valido_hasta')
                  ->orWhere('valido_hasta', '>', now());
            });
    }

    /**
     * Scope por broker
     */
    public function scopeForBroker($query, $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }

    /**
     * Incrementar contador de consultas
     */
    public function incrementarConsultas()
    {
        $this->increment('veces_consultado');
        $this->update(['ultima_consulta' => now()]);
    }

    /**
     * Invalidar análisis
     */
    public function invalidar()
    {
        $this->update(['vigente' => false]);
    }

    /**
     * Verificar si el análisis necesita actualización
     */
    public function necesitaActualizacion(): bool
    {
        if (!$this->vigente) {
            return true;
        }

        if ($this->valido_hasta && $this->valido_hasta->isPast()) {
            return true;
        }

        // Actualizar si han pasado más de 30 días
        if ($this->fecha_analisis->diffInDays(now()) > 30) {
            return true;
        }

        return false;
    }
}