<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CarteraAseguradora extends Model
{
    protected $table = 'cartera_aseguradoras';

    protected $fillable = [
        'broker_id', 'insurer_code', 'insurer_name',
        'policy_number', 'client_name', 'client_document', 'client_doc_type',
        'ramo', 'product_name',
        'prima_total', 'valor_pendiente', 'valor_pagado', 'bonificacion', 'moneda',
        'dias_mora', 'rango_mora',
        'fecha_inicio_vigencia', 'fecha_expedicion', 'fecha_vencimiento',
        'numero_recibo', 'numero_pagare',
        'cuotas_pagadas', 'cuotas_mora', 'total_cuotas',
        'source_endpoint', 'sync_hash', 'synced_at',
        'raw_data',
    ];

    protected $casts = [
        'prima_total' => 'decimal:2',
        'valor_pendiente' => 'decimal:2',
        'valor_pagado' => 'decimal:2',
        'bonificacion' => 'decimal:2',
        'fecha_inicio_vigencia' => 'date',
        'fecha_expedicion' => 'date',
        'fecha_vencimiento' => 'date',
        'synced_at' => 'datetime',
        'raw_data' => 'array',
    ];

    public function scopeForBroker($query, int $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }

    public function scopeByMora($query, string $rango)
    {
        return $query->where('rango_mora', $rango);
    }

    public static function calcRangoMora(int $dias): string
    {
        if ($dias <= 0) return 'al_dia';
        if ($dias <= 30) return 'mora_30';
        if ($dias <= 60) return 'mora_60';
        if ($dias <= 90) return 'mora_90';
        return 'mora_90_plus';
    }
}
