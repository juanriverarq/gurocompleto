<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WhatsAppDepartmentMember extends Model
{
    use HasFactory;

    protected $table = 'whatsapp_department_members';

    protected $fillable = [
        'department_id',
        'user_id',
        'is_supervisor',
        'can_receive_assignments',
        'max_concurrent_conversations',
        'current_conversations',
    ];

    protected $casts = [
        'is_supervisor' => 'boolean',
        'can_receive_assignments' => 'boolean',
    ];

    public function department(): BelongsTo
    {
        return $this->belongsTo(WhatsAppDepartment::class, 'department_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function incrementConversations(): void
    {
        $this->increment('current_conversations');
    }

    public function decrementConversations(): void
    {
        if ($this->current_conversations > 0) {
            $this->decrement('current_conversations');
        }
    }

    public function canReceiveMore(): bool
    {
        return $this->can_receive_assignments && 
               $this->current_conversations < $this->max_concurrent_conversations;
    }
}
