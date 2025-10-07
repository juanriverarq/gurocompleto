<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CobroComision extends Model
{
    use HasFactory;

    protected $table = 'cobros_comisiones';

    protected $fillable = [
        'broker_id',
        'poliza_id',
        'aseguradora_id',
        'pago_poliza_id',
        'monto_comision',
        'monto_cobrado',
        'monto_pendiente',
        'fecha_cobro',
        'referencia_cobro',
        'comprobante_url',
        'estado',
        'observaciones',
    ];

    protected $casts = [
        'monto_comision' => 'decimal:2',
        'monto_cobrado' => 'decimal:2',
        'monto_pendiente' => 'decimal:2',
        'fecha_cobro' => 'date',
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

    public function aseguradora(): BelongsTo
    {
        return $this->belongsTo(Aseguradora::class);
    }

    public function pagoPoliza(): BelongsTo
    {
        return $this->belongsTo(PagoPoliza::class);
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

    public function scopeCobradas($query)
    {
        return $query->where('estado', 'cobrado');
    }

    // Métodos de negocio
    public function registrarCobro(float $monto, array $datos = []): bool
    {
        $this->monto_cobrado += $monto;
        $this->monto_pendiente = max(0, $this->monto_comision - $this->monto_cobrado);
        
        if ($this->monto_pendiente == 0) {
            $this->estado = 'cobrado';
        } elseif ($this->monto_cobrado > 0) {
            $this->estado = 'parcial';
        }

        if (isset($datos['fecha_cobro'])) $this->fecha_cobro = $datos['fecha_cobro'];
        if (isset($datos['referencia_cobro'])) $this->referencia_cobro = $datos['referencia_cobro'];
        if (isset($datos['comprobante_url'])) $this->comprobante_url = $datos['comprobante_url'];
        if (isset($datos['observaciones'])) $this->observaciones = $datos['observaciones'];

        $saved = $this->save();

        // Si se cobró completamente y la póliza tiene vendedor, crear liquidación
        if ($saved && $this->estado === 'cobrado') {
            $this->crearLiquidacionVendedor();
        }

        return $saved;
    }

    public function estaCobrado(): bool
    {
        return $this->estado === 'cobrado';
    }

    private function crearLiquidacionVendedor(): void
    {
        $poliza = $this->poliza;
        
        // Solo crear si la póliza tiene vendedor asignado
        if (!$poliza || !$poliza->vendedor_id) {
            return;
        }

        $vendedor = Vendedor::find($poliza->vendedor_id);
        if (!$vendedor) {
            return;
        }

        // Calcular comisión del vendedor
        $montoComisionVendedor = $this->monto_comision * ($vendedor->porcentaje_comision / 100);

        // Crear o actualizar liquidación
        LiquidacionVendedor::updateOrCreate(
            [
                'broker_id' => $this->broker_id,
                'poliza_id' => $this->poliza_id,
                'vendedor_id' => $poliza->vendedor_id,
            ],
            [
                'cobro_comision_id' => $this->id,
                'monto_comision' => $montoComisionVendedor,
                'monto_pendiente' => $montoComisionVendedor,
                'estado' => 'pendiente',
            ]
        );
    }
}