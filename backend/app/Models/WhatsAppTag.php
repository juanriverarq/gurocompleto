<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WhatsAppTag extends Model
{
    protected $table = 'whatsapp_tags';

    protected $fillable = [
        'broker_id',
        'name',
        'color',
    ];

    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }
}
