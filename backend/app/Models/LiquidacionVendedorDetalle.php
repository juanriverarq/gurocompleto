<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LiquidacionVendedorDetalle extends Model
{
    use HasFactory;

    protected $table = 'liquidaciones_vendedores_detalle_new';

    protected $fillable = [
        'liquidacion_id',
        'poliza_id',
        'numero_poliza',
        'cliente_nombre',
        'aseguradora',
        'ramo',
        'fecha_poliza',
        'prima_neta',
        'porcentaje_comision',
        'comision_bruta',
        'porcentaje_retencion',
        'monto_retencion',
        'porcentaje_retencion_ica',
        'monto_retencion_ica',
        'porcentaje_iva',
        'monto_iva',
        'comision_neta',
    ];

    protected $casts = [
        'fecha_poliza' => 'date',
        'prima_neta' => 'decimal:2',
        'porcentaje_comision' => 'decimal:2',
        'comision_bruta' => 'decimal:2',
        'porcentaje_retencion' => 'decimal:2',
        'monto_retencion' => 'decimal:2',
        'porcentaje_retencion_ica' => 'decimal:2',
        'monto_retencion_ica' => 'decimal:2',
        'porcentaje_iva' => 'decimal:2',
        'monto_iva' => 'decimal:2',
        'comision_neta' => 'decimal:2',
    ];

    // Relaciones
    public function liquidacion(): BelongsTo
    {
        return $this->belongsTo(LiquidacionVendedor::class, 'liquidacion_id');
    }

    public function poliza(): BelongsTo
    {
        return $this->belongsTo(Poliza::class);
    }
}
