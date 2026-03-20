<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PagoPoliza extends Model
{
    use HasFactory;

    protected $table = 'pagos_polizas';

    protected static function boot()
    {
        parent::boot();

        // Auto-set numero_renovacion from the poliza if not explicitly provided
        static::creating(function ($pago) {
            if (is_null($pago->numero_renovacion) && $pago->poliza_id) {
                $poliza = Poliza::find($pago->poliza_id);
                $pago->numero_renovacion = $poliza ? ((int) ($poliza->numero_renovacion ?? 0)) : 0;
            }
        });
    }

    protected $fillable = [
        'broker_id',
        'poliza_id',
        'numero_renovacion',
        'cliente_id',
        'monto_total',
        'monto_pagado',
        'monto_pendiente',
        'tipo_recaudo',
        'metodo_pago',
        'fecha_pago',
        'referencia_pago',
        'comprobante_url',
        'estado',
        'observaciones',
        'recaudo_import_id',
        'recibo_caja_id',
        'source',
        'cartera_item_id',
    ];

    protected $casts = [
        'monto_total' => 'decimal:2',
        'monto_pagado' => 'decimal:2',
        'monto_pendiente' => 'decimal:2',
        'fecha_pago' => 'date',
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

    public function recaudoImport(): BelongsTo
    {
        return $this->belongsTo(RecaudoImport::class, 'recaudo_import_id');
    }

    public function reciboCaja(): BelongsTo
    {
        return $this->belongsTo(ReciboCaja::class);
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

    public function scopePagados($query)
    {
        return $query->where('estado', 'pagado');
    }

    public function scopeRecaudadosOficina($query)
    {
        return $query->where('tipo_recaudo', 'oficina');
    }

    public function scopeRecaudadosAseguradora($query)
    {
        return $query->where('tipo_recaudo', 'aseguradora');
    }

    // Métodos de negocio
    public function registrarPago(float $monto, array $datos = []): bool
    {
        $this->monto_pagado += $monto;
        $this->monto_pendiente = max(0, $this->monto_total - $this->monto_pagado);
        
        if ($this->monto_pendiente == 0) {
            $this->estado = 'pagado';
        } elseif ($this->monto_pagado > 0) {
            $this->estado = 'parcial';
        }

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

    public function habilitaComision(): bool
    {
        return $this->tipo_recaudo === 'oficina' && $this->estaPagado();
    }
}