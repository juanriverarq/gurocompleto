<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Traits\BrokerScoped;

class PolizaCoverage extends Model
{
    use HasFactory, BrokerScoped;

    protected $fillable = [
        'poliza_id',
        'broker_id',
        'coverage_type',
        'coverage_name',
        'coverage_code',
        'insured_value',
        'deductible',
        'deductible_value',
        'deductible_percentage',
        'source_insurer',
        'raw_data',
    ];

    protected $casts = [
        'insured_value' => 'decimal:2',
        'deductible_value' => 'decimal:2',
        'deductible_percentage' => 'decimal:2',
        'raw_data' => 'array',
    ];

    /**
     * Relación con la póliza
     */
    public function poliza(): BelongsTo
    {
        return $this->belongsTo(Poliza::class);
    }

    /**
     * Scope por tipo de cobertura
     */
    public function scopeByType($query, string $type)
    {
        return $query->where('coverage_type', $type);
    }
}
