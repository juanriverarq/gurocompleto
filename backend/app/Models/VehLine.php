<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Traits\BrokerScoped;

class VehLine extends Model
{
    use HasFactory; // Global, sin BrokerScoped
    protected $fillable = ['model_id','name'];

    public function model(): BelongsTo { return $this->belongsTo(VehModel::class, 'model_id'); }
}


