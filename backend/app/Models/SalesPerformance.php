<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalesPerformance extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'sales_performances';

    protected $fillable = [
        'broker_id',
        'user_id',
        'period',
        'month',
        'year',
        'sales_current_month',
        'sales_previous_month',
        'monthly_goal',
        'fulfillment_percentage',
        'commissions',
        'new_clients',
        'calls',
        'meetings',
        'proposals',
        'conversion_rate',
        'average_ticket',
        'ranking',
        'notes',
    ];

    protected $casts = [
        'sales_current_month' => 'decimal:2',
        'sales_previous_month' => 'decimal:2',
        'monthly_goal' => 'decimal:2',
        'fulfillment_percentage' => 'decimal:2',
        'commissions' => 'decimal:2',
        'conversion_rate' => 'decimal:2',
        'average_ticket' => 'decimal:2',
        'ranking' => 'integer',
        'new_clients' => 'integer',
        'calls' => 'integer',
        'meetings' => 'integer',
        'proposals' => 'integer',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function scopeForBroker($query, int $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }

    public function scopeForPeriod($query, string $period)
    {
        return $query->where('period', $period);
    }

    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    public function scopeForMonth($query, int $month, int $year)
    {
        return $query->where('month', $month)->where('year', $year);
    }
}