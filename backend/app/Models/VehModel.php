<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Traits\BrokerScoped;

class VehModel extends Model
{
    use HasFactory; // Global, sin BrokerScoped
    protected $fillable = ['brand_id','name'];

    public function brand(): BelongsTo { return $this->belongsTo(VehBrand::class, 'brand_id'); }
    public function lines(): HasMany { return $this->hasMany(VehLine::class, 'model_id'); }
}


