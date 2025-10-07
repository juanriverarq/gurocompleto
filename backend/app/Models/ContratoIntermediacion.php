<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class ContratoIntermediacion extends Model
{
    use HasFactory;

    protected $table = 'contratos_intermediacion';

    protected $fillable = [
        'broker_id','numero_contrato','aseguradora','tipo_contrato','fecha_inicio','fecha_vencimiento',
        'estado','comision_base','comision_adicional','productos_autorizados','territorio','responsable',
        'archivo_url','fecha_firma','firmado_digitalmente','renovacion_automatica','valor_estimado_anual',
        'clausulas_especiales','observaciones'
    ];

    protected $casts = [
        'fecha_inicio' => 'date',
        'fecha_vencimiento' => 'date',
        'fecha_firma' => 'date',
        'firmado_digitalmente' => 'boolean',
        'renovacion_automatica' => 'boolean',
        'productos_autorizados' => 'array',
        'clausulas_especiales' => 'array',
    ];

    public function scopeForBroker(Builder $query, int $brokerId): Builder
    {
        return $query->where('broker_id', $brokerId);
    }
}


