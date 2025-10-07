<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class CarteraCliente extends Model
{
    use HasFactory;

    protected $table = 'cartera_clientes';

    protected $fillable = [
        'broker_id', 'nombre', 'tipo_documento', 'documento', 'email', 'telefono', 'asesor',
        'polizas_activas', 'prima_total', 'comisiones_generadas', 'ultima_renovacion',
        'proximo_vencimiento', 'estado', 'segmento', 'antiguedad',
    ];

    protected $casts = [
        'ultima_renovacion' => 'date',
        'proximo_vencimiento' => 'date',
    ];

    public function scopeForBroker(Builder $query, int $brokerId): Builder
    {
        return $query->where('broker_id', $brokerId);
    }
}


