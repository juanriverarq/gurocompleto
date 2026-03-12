<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\BrokerScoped;

class ReciboCaja extends Model
{
    use HasFactory, SoftDeletes, BrokerScoped;

    protected $table = 'recibos_caja';

    protected $fillable = [
        'broker_id',
        'poliza_id',
        'cliente_id',
        'pago_poliza_id',
        'anexo_poliza_id',
        'vendedor_id',
        // Denormalized display fields
        'poliza_numero',
        'poliza_objeto_asegurado',
        'cliente_nombre',
        'cliente_documento',
        'aseguradora_nombre',
        'ramo_nombre',
        'sede_nombre',
        'vendedor_nombre',
        'usuario_recauda',
        // Identification
        'numero_recibo',
        'numero_planilla',
        'numero_transaccion',
        'numero_pago',
        'pago_poliza_consecutivo',
        'numero_factura',
        'codigo_radicacion',
        // Type and status
        'tipo',
        'tipo_recaudo',
        'recaudo_directo',
        'forma_pago',
        'medio_de_pago',
        'forma_pago_aseguradora',
        'moneda',
        // Dates
        'fecha_pago',
        'fecha_realizara_pago',
        'fecha_realizo_pago',
        'fecha_realizo_pago_oficina',
        'fecha_recibio_comision',
        'fecha_recaudo',
        'fecha_inicio_poliza',
        // Main amounts
        'valor_a_pagar',
        'valor_pagado',
        'valor_neto_a_pagar',
        'valor_recaudado_en_oficina',
        'saldo_pendiente',
        'saldo_pendiente_oficina',
        'saldo_pendiente_aseguradora',
        'prima_neta_poliza',
        'prima_total_poliza',
        // Commissions
        'comision_a_recibir',
        'comision_total_a_recibir',
        'sobrecomision_a_recibir',
        'comision_recibida',
        'comision_vendedor',
        'comision_final_agencia',
        'comision_tecnico',
        'comision_sede',
        'porcentaje_comision_poliza',
        'porcentaje_comision_vendedor',
        'participacion_vendedor',
        'iva_comision_vendedor',
        'iva_comision_agencia',
        'retencion_comision_agencia',
        'reteica_comision_agencia',
        'reteiva_comision_agencia',
        'comision_retencion_vendedor',
        // Commission payment status
        'pagada_vendedor',
        'pagada_tecnico',
        'pagada_sede',
        'fecha_pagada_vendedor',
        'fecha_pagada_tecnico',
        'fecha_pagada_sede',
        // Flags
        'recaudado_en_oficina',
        'recaudado',
        'comisionada',
        'es_anticipo',
        'recibo_pago_directo',
        'recaudo_parcial_oficina',
        'edad_cartera',
        'activo',
        // Annulment
        'recibo_anulado',
        'fecha_recibo_anulado',
        'usuario_anulo_recibo',
        'usuario_anula_recibo',
        // Metadata
        'observaciones',
        'archivos',
        'metadata',
        'softseguros_id',
        'softseguros_recaudo_id',
        'softseguros_pago_poliza_id',
        'source',
    ];

    protected $casts = [
        'fecha_pago' => 'date',
        'fecha_realizara_pago' => 'date',
        'fecha_realizo_pago' => 'date',
        'fecha_realizo_pago_oficina' => 'date',
        'fecha_recibio_comision' => 'date',
        'fecha_recaudo' => 'date',
        'fecha_inicio_poliza' => 'date',
        'fecha_pagada_vendedor' => 'date',
        'fecha_pagada_tecnico' => 'date',
        'fecha_pagada_sede' => 'date',
        'fecha_recibo_anulado' => 'datetime',
        'valor_a_pagar' => 'decimal:2',
        'valor_pagado' => 'decimal:2',
        'valor_neto_a_pagar' => 'decimal:2',
        'valor_recaudado_en_oficina' => 'decimal:2',
        'saldo_pendiente' => 'decimal:2',
        'saldo_pendiente_oficina' => 'decimal:2',
        'saldo_pendiente_aseguradora' => 'decimal:2',
        'prima_neta_poliza' => 'decimal:2',
        'prima_total_poliza' => 'decimal:2',
        'comision_a_recibir' => 'decimal:2',
        'comision_total_a_recibir' => 'decimal:2',
        'sobrecomision_a_recibir' => 'decimal:2',
        'comision_recibida' => 'decimal:2',
        'comision_vendedor' => 'decimal:2',
        'comision_final_agencia' => 'decimal:2',
        'comision_tecnico' => 'decimal:2',
        'comision_sede' => 'decimal:2',
        'porcentaje_comision_poliza' => 'decimal:2',
        'porcentaje_comision_vendedor' => 'decimal:2',
        'participacion_vendedor' => 'decimal:2',
        'iva_comision_vendedor' => 'decimal:2',
        'iva_comision_agencia' => 'decimal:2',
        'retencion_comision_agencia' => 'decimal:2',
        'reteica_comision_agencia' => 'decimal:2',
        'reteiva_comision_agencia' => 'decimal:2',
        'comision_retencion_vendedor' => 'decimal:2',
        'recaudado_en_oficina' => 'boolean',
        'recaudado' => 'boolean',
        'comisionada' => 'boolean',
        'es_anticipo' => 'boolean',
        'recibo_pago_directo' => 'boolean',
        'recaudo_directo' => 'boolean',
        'recaudo_parcial_oficina' => 'boolean',
        'activo' => 'boolean',
        'recibo_anulado' => 'boolean',
        'pagada_vendedor' => 'boolean',
        'pagada_tecnico' => 'boolean',
        'pagada_sede' => 'boolean',
        'archivos' => 'array',
        'metadata' => 'array',
    ];

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

    public function vendedor(): BelongsTo
    {
        return $this->belongsTo(Vendedor::class);
    }
}
