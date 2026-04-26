<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

/**
 * Representa recibos sincronizados desde el portal de una aseguradora con
 * la comisión del asesor. Distinto de `ComisionAseguradora` (config de %
 * por ramo/aseguradora usado en cotizadores).
 */
class RecibosComisionAseguradora extends Model
{
    protected $table = 'recibos_comisiones_aseguradoras';

    protected $fillable = [
        'broker_id', 'insurer_code', 'insurer_name',
        'anio', 'mes',
        'ramo_codigo', 'producto', 'policy_number', 'numero_recibo',
        'client_name', 'client_document', 'client_doc_type',
        'oficina',
        'fecha_recaudo', 'fecha_pago_asesor',
        'prima_neta', 'valor_pagado_tomador', 'porcentaje_comision', 'valor_comision',
        'estado', 'concepto', 'subramo',
        'source_endpoint', 'sync_hash', 'synced_at', 'raw_data',
    ];

    protected $casts = [
        'prima_neta' => 'decimal:2',
        'valor_pagado_tomador' => 'decimal:2',
        'porcentaje_comision' => 'decimal:2',
        'valor_comision' => 'decimal:2',
        'fecha_recaudo' => 'date',
        'fecha_pago_asesor' => 'date',
        'synced_at' => 'datetime',
        'raw_data' => 'array',
    ];

    public function scopeForBroker(Builder $q, int $brokerId): Builder
    {
        return $q->where('broker_id', $brokerId);
    }

    public function scopeForInsurer(Builder $q, string $code): Builder
    {
        return $q->where('insurer_code', $code);
    }

    public function scopeForPeriodo(Builder $q, string $anio, string $mes): Builder
    {
        return $q->where('anio', $anio)->where('mes', str_pad($mes, 2, '0', STR_PAD_LEFT));
    }
}
