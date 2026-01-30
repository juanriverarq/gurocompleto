<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChatbotNode extends Model
{
    use HasFactory;

    protected $fillable = [
        'flow_id',
        'node_type',
        'name',
        'position_x',
        'position_y',
        'config',
        'next_node_id',
    ];

    protected $casts = [
        'config' => 'array',
    ];

    const TYPE_START = 'start';
    const TYPE_MESSAGE = 'message';
    const TYPE_QUESTION = 'question';
    const TYPE_INPUT = 'input';
    const TYPE_CONDITION = 'condition';
    const TYPE_ACTION = 'action';
    const TYPE_AI_RESPONSE = 'ai_response';
    const TYPE_TRANSFER = 'transfer';
    const TYPE_DELAY = 'delay';
    const TYPE_END = 'end';

    public function flow(): BelongsTo
    {
        return $this->belongsTo(ChatbotFlow::class, 'flow_id');
    }

    public function nextNode(): BelongsTo
    {
        return $this->belongsTo(ChatbotNode::class, 'next_node_id');
    }

    public function getConfigAttribute($value)
    {
        return json_decode($value, true) ?? [];
    }

    public function setConfigAttribute($value)
    {
        $this->attributes['config'] = is_array($value) ? json_encode($value) : $value;
    }
}
