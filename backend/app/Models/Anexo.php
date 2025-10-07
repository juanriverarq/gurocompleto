<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\BrokerScoped;

class Anexo extends Model
{
    use HasFactory, SoftDeletes, BrokerScoped;

    protected $table = 'anexos';

    protected $fillable = [
        'broker_id',
        'poliza_id',
        'anexo_number',
        'risk',
        'insurance_company',
        'branch',
        'issue_date',
        'reception_date',
        'start_date',
        'end_date',
        'renewable',
        'prima_neta',
        'gastos_expedicion',
        'vat_percentage',
        'pri_a_pre',
        'iva',
        'commission_percentage',
        'commission_amount',
        'total_amount',
        'payment_frequency',
        'payment_method',
        'comision_pagada',
        'motivo',
        'fawf',
        'observaciones',
        'status',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'issue_date' => 'date',
        'reception_date' => 'date',
        'renewable' => 'boolean',
        'prima_neta' => 'decimal:2',
        'gastos_expedicion' => 'decimal:2',
        'vat_percentage' => 'decimal:2',
        'pri_a_pre' => 'decimal:2',
        'iva' => 'decimal:2',
        'commission_percentage' => 'decimal:2',
        'commission_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'comision_pagada' => 'boolean',
    ];

    public function poliza(): BelongsTo
    {
        return $this->belongsTo(Poliza::class, 'poliza_id');
    }
}


