<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Traits\BrokerScoped;

class Automovil extends Model
{
    use HasFactory, BrokerScoped;

    protected $table = 'automoviles';

    protected $fillable = [
        'broker_id',
        'placa',
        'marca',
        'modelo',
        'anio',
        'vin',
        'color',
        'tipo_servicio',
        'clase',
        'referencia1',
        'referencia2',
        'referencia3',
        'linea',
        'tipo_carroceria',
        'numero_motor',
        'numero_chasis',
        'numero_serie',
        'cilindraje',
        'combustible',
        'capacidad_pasajeros',
        'capacidad_carga_kg',
        'tipo_transmision',
        'traccion',
        'pais_origen',
        'brand_id',
        'model_id',
        'line_id',
        'client_id',
        'poliza_id',
        'custom_fields',
    ];

    protected $casts = [
        'custom_fields' => 'array',
        'anio' => 'integer',
        'cilindraje' => 'integer',
        'capacidad_pasajeros' => 'integer',
        'capacidad_carga_kg' => 'integer',
        'brand_id' => 'integer',
        'model_id' => 'integer',
        'line_id' => 'integer',
    ];

    public function broker(): BelongsTo { return $this->belongsTo(Broker::class); }
    public function client(): BelongsTo { return $this->belongsTo(Cliente::class, 'client_id'); }
    public function poliza(): BelongsTo { return $this->belongsTo(Poliza::class, 'poliza_id'); }
    public function brand(): BelongsTo { return $this->belongsTo(VehBrand::class, 'brand_id'); }
    public function vehModel(): BelongsTo { return $this->belongsTo(VehModel::class, 'model_id'); }
    public function vehLine(): BelongsTo { return $this->belongsTo(VehLine::class, 'line_id'); }
}


