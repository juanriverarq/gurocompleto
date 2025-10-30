<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AnticipoAjuste extends Model
{
    use HasFactory;

    protected $table = 'anticipos_ajustes';

    protected $fillable = [
        'broker_id',
        'tipo',
        'vendedor_id',
        'concepto',
        'valor',
        'fecha',
        'estado',
        'observaciones',
        'poliza_id',
        'aprobado_por',
        'fecha_aprobacion',
    ];

    protected $casts = [
        'valor' => 'decimal:2',
        'fecha' => 'date',
        'fecha_aprobacion' => 'datetime',
    ];

    public function vendedor(): BelongsTo
    {
        return $this->belongsTo(Vendedor::class, 'vendedor_id');
    }

    public function poliza(): BelongsTo
    {
        return $this->belongsTo(Poliza::class, 'poliza_id');
    }

    public function aprobador(): BelongsTo
    {
        return $this->belongsTo(User::class, 'aprobado_por');
    }

    public function scopeByBroker($query, int $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }

    public function scopePendientes($query)
    {
        return $query->where('estado', 'pendiente');
    }

    public function scopeAprobados($query)
    {
        return $query->where('estado', 'aprobado');
    }

    public function scopeRechazados($query)
    {
        return $query->where('estado', 'rechazado');
    }

    public function scopeTipo($query, string $tipo)
    {
        return $query->where('tipo', $tipo);
    }
}