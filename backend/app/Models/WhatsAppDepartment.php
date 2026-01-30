<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class WhatsAppDepartment extends Model
{
    use HasFactory;

    protected $table = 'whatsapp_departments';

    protected $fillable = [
        'broker_id',
        'name',
        'description',
        'icon',
        'color',
        'is_active',
        'priority',
        'auto_assign_rules',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'auto_assign_rules' => 'array',
    ];

    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    public function members(): HasMany
    {
        return $this->hasMany(WhatsAppDepartmentMember::class, 'department_id');
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'whatsapp_department_members', 'department_id', 'user_id')
            ->withPivot(['is_supervisor', 'can_receive_assignments', 'max_concurrent_conversations', 'current_conversations'])
            ->withTimestamps();
    }

    public function conversations(): HasMany
    {
        return $this->hasMany(WhatsAppConversation::class, 'department_id');
    }

    public function quickReplies(): HasMany
    {
        return $this->hasMany(WhatsAppQuickReply::class, 'department_id');
    }

    /**
     * Obtener el siguiente agente disponible para asignación
     */
    public function getNextAvailableAgent(): ?User
    {
        $member = $this->members()
            ->where('can_receive_assignments', true)
            ->whereRaw('current_conversations < max_concurrent_conversations')
            ->orderBy('current_conversations', 'asc')
            ->first();

        return $member?->user;
    }

    /**
     * Obtener agentes activos del departamento
     */
    public function getActiveAgents()
    {
        return $this->users()
            ->wherePivot('can_receive_assignments', true)
            ->get();
    }
}
