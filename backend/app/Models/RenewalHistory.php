<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RenewalHistory extends Model
{
    use HasFactory;

    /**
     * Tabla asociada
     */
    protected $table = 'renewal_history';

    /**
     * Atributos asignables en masa
     */
    protected $fillable = [
        'poliza_id',
        'broker_id',
        'user_id',
        'action_type',
        'contact_type',
        'contact_result',
        'title',
        'description',
        'metadata',
        'next_contact_date',
        'priority',
        'status',
        'attachment_path',
        'attachment_name',
    ];

    /**
     * Casts de atributos
     */
    protected $casts = [
        'metadata' => 'array',
        'next_contact_date' => 'datetime',
    ];

    /**
     * Relaciones
     */
    public function poliza(): BelongsTo
    {
        return $this->belongsTo(Poliza::class, 'poliza_id');
    }

    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class, 'broker_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
