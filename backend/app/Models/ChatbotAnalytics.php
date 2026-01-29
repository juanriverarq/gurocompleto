<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChatbotAnalytics extends Model
{
    use HasFactory;

    protected $table = 'chatbot_analytics';

    protected $fillable = [
        'chatbot_id',
        'date',
        'total_sessions',
        'completed_sessions',
        'transferred_sessions',
        'avg_session_duration_seconds',
        'flow_stats',
        'trigger_stats',
        'satisfaction_ratings',
    ];

    protected $casts = [
        'date' => 'date',
        'flow_stats' => 'array',
        'trigger_stats' => 'array',
        'satisfaction_ratings' => 'array',
    ];

    public function chatbot(): BelongsTo
    {
        return $this->belongsTo(Chatbot::class);
    }

    public function scopeForDate($query, $date)
    {
        return $query->where('date', $date);
    }

    public function scopeForDateRange($query, $from, $to)
    {
        return $query->whereBetween('date', [$from, $to]);
    }
}
