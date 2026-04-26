<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
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
        // SOAT
        'numero_soat',
        'fecha_inicio_soat',
        'fecha_vencimiento_soat',
        'aseguradora_soat',
        'estado_soat',
        // RTM
        'numero_certificado_rtm',
        'fecha_expedicion_rtm',
        'fecha_vencimiento_rtm',
        'nombre_cda_rtm',
        'estado_rtm',
        // Estado legal / RUNT
        'estado_automotor',
        'gravamenes',
        'prendas',
        'organismo_transito',
        'fecha_registro_runt',
        // Propietario RUNT
        'propietario_nombre',
        'propietario_documento',
        // Meta RUNT
        'runt_consulted_at',
        'runt_raw_data',
    ];

    protected $casts = [
        'custom_fields' => 'array',
        'runt_raw_data' => 'array',
        'anio' => 'integer',
        'cilindraje' => 'integer',
        'capacidad_pasajeros' => 'integer',
        'capacidad_carga_kg' => 'integer',
        'brand_id' => 'integer',
        'model_id' => 'integer',
        'line_id' => 'integer',
        'fecha_inicio_soat' => 'date',
        'fecha_vencimiento_soat' => 'date',
        'fecha_expedicion_rtm' => 'date',
        'fecha_vencimiento_rtm' => 'date',
        'fecha_registro_runt' => 'date',
        'runt_consulted_at' => 'datetime',
    ];

    public function broker(): BelongsTo { return $this->belongsTo(Broker::class); }
    public function client(): BelongsTo { return $this->belongsTo(Cliente::class, 'client_id'); }
    public function poliza(): BelongsTo { return $this->belongsTo(Poliza::class, 'poliza_id'); }
    public function brand(): BelongsTo { return $this->belongsTo(VehBrand::class, 'brand_id'); }
    public function vehModel(): BelongsTo { return $this->belongsTo(VehModel::class, 'model_id'); }
    public function vehLine(): BelongsTo { return $this->belongsTo(VehLine::class, 'line_id'); }
    public function notificationLogs(): HasMany { return $this->hasMany(AutomovilNotificationLog::class); }

    public function scopeForBroker($query, int $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }
}


