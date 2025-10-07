<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiquidacionVendedor extends Model
{
    use HasFactory;

    protected $table = 'liquidaciones_vendedores';

    protected $fillable = [
        'broker_id',
        'vendedor_id',
        'poliza_id',
        'cobro_comision_id',
        'monto_comision',
        'monto_pagado',
        'monto_pendiente',
        'fecha_pago',
        'metodo_pago',
        'referencia_pago',
        'comprobante_url',
        'estado',
        'observaciones',
    ];

    protected $casts = [
        'monto_comision' => 'decimal:2',
        'monto_pagado' => 'decimal:2',
        'monto_pendiente' => 'decimal:2',
        'fecha_pago' => 'date',
    ];

    // Relaciones
    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    public function vendedor(): BelongsTo
    {
        return $this->belongsTo(Vendedor::class);
    }

    public function poliza(): BelongsTo
    {
        return $this->belongsTo(Poliza::class);
    }

    public function cobroComision(): BelongsTo
    {
        return $this->belongsTo(CobroComision::class);
    }

    // Scopes
    public function scopeByBroker($query, $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }

    public function scopePendientes($query)
    {
        return $query->whereIn('estado', ['pendiente', 'parcial']);
    }

    public function scopePagadas($query)
    {
        return $query->where('estado', 'pagado');
    }

    public function scopeByVendedor($query, $vendedorId)
    {
        return $query->where('vendedor_id', $vendedorId);
    }

    // Métodos de negocio
    public function registrarPago(float $monto, array $datos = []): bool
    {
        $this->monto_pagado += $monto;
        $this->monto_pendiente = max(0, $this->monto_comision - $this->monto_pagado);
        
        if ($this->monto_pendiente == 0) {
            $this->estado = 'pagado';
        } elseif ($this->monto_pagado > 0) {
            $this->estado = 'parcial';
        }

        if (isset($datos['fecha_pago'])) $this->fecha_pago = $datos['fecha_pago'];
        if (isset($datos['metodo_pago'])) $this->metodo_pago = $datos['metodo_pago'];
        if (isset($datos['referencia_pago'])) $this->referencia_pago = $datos['referencia_pago'];
        if (isset($datos['comprobante_url'])) $this->comprobante_url = $datos['comprobante_url'];
        if (isset($datos['observaciones'])) $this->observaciones = $datos['observaciones'];

        return $this->save();
    }

    public function estaPagado(): bool
    {
        return $this->estado === 'pagado';
    }

    public function porcentajePagado(): float
    {
        if ($this->monto_comision == 0) {
            return 0;
        }
        
        return ($this->monto_pagado / $this->monto_comision) * 100;
    }
}