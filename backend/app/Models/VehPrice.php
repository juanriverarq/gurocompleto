<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VehPrice extends Model
{
    use HasFactory;

    protected $fillable = ['brand_id','model_id','line_id','amount','clase','referencia1','referencia2','referencia3'];

    public function brand(): BelongsTo { return $this->belongsTo(VehBrand::class, 'brand_id'); }
    public function modelRef(): BelongsTo { return $this->belongsTo(VehModel::class, 'model_id'); }
    public function line(): BelongsTo { return $this->belongsTo(VehLine::class, 'line_id'); }
}


