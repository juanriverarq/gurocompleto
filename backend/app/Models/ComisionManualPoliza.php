<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Traits\BrokerScoped;

class ComisionManualPoliza extends Model
{
    use HasFactory, BrokerScoped;

    protected $table = 'comisiones_manuales_polizas';

    protected $fillable = [
        'broker_id',
        'poliza_id',
        'vendedor_id',
        'aseguradora_id',
        'numero_poliza',
        'anexo',
        'tipo_movimiento', // CREACIÓN, RENOVACIÓN, ANEXO, etc.
        'asegurado_nombre',
        'ramo',
        'saldo',
        'abono_prima',
        'porcentaje_comision',
        'porcentaje_agencia',
        'valor_comision',
        'porcentaje_rtf',
        'rtf_calculada',
        'iva_19',
        'reteiva',
        'ica',
        'cree',
        'neto_comision',
        'tipo_documento',
        'estado', // pendiente, liquidada, pagada, anulada
        'liquidacion_id',
        'observaciones',
        'creado_por',
    ];

    protected $casts = [
        'saldo' => 'decimal:2',
        'abono_prima' => 'decimal:2',
        'porcentaje_comision' => 'decimal:2',
        'porcentaje_agencia' => 'decimal:2',
        'valor_comision' => 'decimal:2',
        'porcentaje_rtf' => 'decimal:2',
        'rtf_calculada' => 'decimal:2',
        'iva_19' => 'decimal:2',
        'reteiva' => 'decimal:2',
        'ica' => 'decimal:2',
        'cree' => 'decimal:2',
        'neto_comision' => 'decimal:2',
    ];

    // Estados posibles
    const ESTADOS = [
        'pendiente' => 'Pendiente',
        'liquidada' => 'Liquidada',
        'pagada' => 'Pagada',
        'anulada' => 'Anulada',
    ];

    // Tipos de movimiento
    const TIPOS_MOVIMIENTO = [
        'CREACIÓN' => 'Creación',
        'RENOVACIÓN' => 'Renovación',
        'ANEXO' => 'Anexo',
        'ENDOSO' => 'Endoso',
        'CANCELACIÓN' => 'Cancelación',
        'AJUSTE' => 'Ajuste',
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

    public function vendedor(): BelongsTo
    {
        return $this->belongsTo(Vendedor::class);
    }

    public function aseguradora(): BelongsTo
    {
        return $this->belongsTo(Aseguradora::class);
    }

    public function liquidacion(): BelongsTo
    {
        return $this->belongsTo(LiquidacionVendedor::class, 'liquidacion_id');
    }

    public function creadoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'creado_por');
    }

    // Scopes
    public function scopePendientes($query)
    {
        return $query->where('estado', 'pendiente');
    }

    public function scopeLiquidadas($query)
    {
        return $query->where('estado', 'liquidada');
    }

    public function scopeByPoliza($query, $polizaId)
    {
        return $query->where('poliza_id', $polizaId);
    }

    public function scopeByVendedor($query, $vendedorId)
    {
        return $query->where('vendedor_id', $vendedorId);
    }

    // Métodos de negocio
    public function calcularComision(): void
    {
        $abonoPrima = (float) $this->abono_prima;
        $porcentajeComision = (float) $this->porcentaje_comision;
        $porcentajeAgencia = (float) $this->porcentaje_agencia;
        $porcentajeRtf = (float) $this->porcentaje_rtf;

        // Calcular valor comisión
        $this->valor_comision = $abonoPrima * ($porcentajeComision / 100);

        // Calcular RTF si aplica
        if ($porcentajeRtf > 0) {
            $this->rtf_calculada = $this->valor_comision * ($porcentajeRtf / 100);
        } else {
            $this->rtf_calculada = 0;
        }

        // IVA 19%
        $this->iva_19 = $this->valor_comision * 0.19;

        // Calcular neto comisión
        $this->neto_comision = $this->valor_comision 
            - $this->rtf_calculada 
            + $this->iva_19 
            - (float) $this->reteiva 
            - (float) $this->ica 
            - (float) $this->cree;
    }

    public function marcarComoLiquidada($liquidacionId): bool
    {
        if ($this->estado !== 'pendiente') {
            return false;
        }

        $this->estado = 'liquidada';
        $this->liquidacion_id = $liquidacionId;
        return $this->save();
    }

    public function anular(): bool
    {
        if ($this->estado === 'pagada') {
            return false;
        }

        $this->estado = 'anulada';
        return $this->save();
    }
}
