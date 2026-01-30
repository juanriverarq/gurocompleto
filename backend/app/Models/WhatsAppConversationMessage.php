<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WhatsAppConversationMessage extends Model
{
    use HasFactory;

    protected $table = 'whatsapp_conversation_messages';

    protected $fillable = [
        'conversation_id',
        'message_id',
        'direction',
        'sender_type',
        'sender_user_id',
        'message_type',
        'content',
        'media',
        'metadata',
        'is_read',
        'read_at',
        'status',
    ];

    protected $casts = [
        'media' => 'array',
        'metadata' => 'array',
        'is_read' => 'boolean',
        'read_at' => 'datetime',
    ];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(WhatsAppConversation::class, 'conversation_id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_user_id');
    }

    public function isFromClient(): bool
    {
        return $this->sender_type === 'client';
    }

    public function isFromAgent(): bool
    {
        return $this->sender_type === 'agent';
    }

    public function isFromBot(): bool
    {
        return $this->sender_type === 'bot';
    }
}
