<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class EnlaceCotizacion extends Model
{
    use HasFactory;

    protected $table = 'enlaces_cotizacion';

    protected $fillable = [
        'broker_id','nombre','tipo','descripcion','slug','enlace','activo','visitas','cotizaciones','config'
    ];

    protected $casts = [
        'activo' => 'boolean',
        'config' => 'array',
    ];

    public function scopeForBroker(Builder $query, int $brokerId): Builder
    {
        return $query->where('broker_id', $brokerId);
    }
}


