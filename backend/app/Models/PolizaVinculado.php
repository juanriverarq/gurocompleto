<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Traits\BrokerScoped;

class PolizaVinculado extends Model
{
    use HasFactory, BrokerScoped;

    protected $table = 'poliza_vinculados';

    protected $fillable = [
        'poliza_id',
        'broker_id',
        'identificador',
        'documento',
        'nombre_asegurado',
        'valor',
        'valor_iva',
        'valor_total',
        'estado',
        'tipo_documento',
        'telefono',
        'email',
        'direccion',
        'ciudad',
        'observaciones',
        'metadata',
    ];

    protected $casts = [
        'valor' => 'decimal:2',
        'valor_iva' => 'decimal:2',
        'valor_total' => 'decimal:2',
        'metadata' => 'array',
    ];

    public function poliza(): BelongsTo
    {
        return $this->belongsTo(Poliza::class);
    }

    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }
}
