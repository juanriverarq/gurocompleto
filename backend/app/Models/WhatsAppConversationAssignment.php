<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WhatsAppConversationAssignment extends Model
{
    use HasFactory;

    protected $table = 'whatsapp_conversation_assignments';

    protected $fillable = [
        'conversation_id',
        'assigned_from',
        'assigned_to',
        'department_id',
        'assignment_type',
        'reason',
    ];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(WhatsAppConversation::class, 'conversation_id');
    }

    public function assignedFrom(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_from');
    }

    public function assignedTo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(WhatsAppDepartment::class, 'department_id');
    }
}
