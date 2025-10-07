<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use App\Traits\BrokerScoped;

class VehBrand extends Model
{
    use HasFactory; // Global, sin BrokerScoped
    protected $fillable = ['name'];

    public function models(): HasMany { return $this->hasMany(VehModel::class, 'brand_id'); }
}


