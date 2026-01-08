<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RecaudoImport extends Model
{
    use HasFactory;

    protected $table = 'recaudo_imports';

    protected $fillable = [
        'broker_id',
        'user_id',
        'filename',
        'tipo_recaudo',
        'status',
        'total_rows',
        'exitosos',
        'fallidos',
        'monto_total_importado',
        'pago_ids',
        'errores',
        'mapping',
        'notas',
        'started_at',
        'finished_at',
        'reverted_at',
        'reverted_by',
    ];

    protected $casts = [
        'pago_ids' => 'array',
        'errores' => 'array',
        'mapping' => 'array',
        'monto_total_importado' => 'decimal:2',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
        'reverted_at' => 'datetime',
    ];

    // Relaciones
    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    public function pagos(): HasMany
    {
        return $this->hasMany(PagoPoliza::class, 'recaudo_import_id');
    }

    // Scopes
    public function scopeByBroker($query, $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }

    public function scopeCompleted($query)
    {
        return $query->where('status', 'completed');
    }

    public function scopeRevertible($query)
    {
        return $query->where('status', 'completed')->whereNull('reverted_at');
    }

    // Métodos
    public function canRevert(): bool
    {
        return $this->status === 'completed' && $this->reverted_at === null;
    }

    public function getPagosCount(): int
    {
        return is_array($this->pago_ids) ? count($this->pago_ids) : 0;
    }
}
