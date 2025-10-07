<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Carbon\Carbon;
use App\Traits\BrokerScoped;

class CommercialTask extends Model
{
    use HasFactory, SoftDeletes, BrokerScoped;

    protected $fillable = [
        'broker_id',
        'client_id',
        'poliza_id',
        'assigned_to',
        'created_by',
        'title',
        'description',
        'type',
        'status',
        'priority',
        'due_date',
        'started_at',
        'completed_at',
        'scheduled_for',
        'progress_percentage',
        'notes',
        'activity_log',
        'contact_method',
        'contact_phone',
        'contact_email',
        'contact_notes',
        'result',
        'next_follow_up',
        'follow_up_notes',
        'has_reminder',
        'reminder_at',
        'reminder_sent',
        'attachments',
        'external_reference',
        'estimated_duration_minutes',
        'actual_duration_minutes'
    ];

    protected $casts = [
        'due_date' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'scheduled_for' => 'datetime',
        'next_follow_up' => 'datetime',
        'reminder_at' => 'datetime',
        'has_reminder' => 'boolean',
        'reminder_sent' => 'boolean',
        'progress_percentage' => 'integer',
        'estimated_duration_minutes' => 'integer',
        'actual_duration_minutes' => 'integer',
        'activity_log' => 'array',
        'attachments' => 'array'
    ];

    // Constantes para los enums
    const TYPES = [
        'seguimiento_cliente' => 'Seguimiento Cliente',
        'documentacion' => 'Documentación',
        'inspeccion' => 'Inspección',
        'renovacion' => 'Renovación',
        'siniestro' => 'Siniestro',
        'cotizacion' => 'Cotización',
        'llamada' => 'Llamada',
        'reunion' => 'Reunión',
        'email' => 'Email',
        'visita' => 'Visita'
    ];

    const STATUSES = [
        'pendiente' => 'Pendiente',
        'en_progreso' => 'En Progreso',
        'completada' => 'Completada',
        'vencida' => 'Vencida',
        'cancelada' => 'Cancelada',
        'pausada' => 'Pausada'
    ];

    const PRIORITIES = [
        'baja' => 'Baja',
        'media' => 'Media',
        'alta' => 'Alta',
        'critica' => 'Crítica'
    ];

    const RESULTS = [
        'exitoso' => 'Exitoso',
        'sin_respuesta' => 'Sin Respuesta',
        'rechazado' => 'Rechazado',
        'interesado' => 'Interesado',
        'reagendar' => 'Reagendar',
        'completado' => 'Completado',
        'cancelado' => 'Cancelado'
    ];

    const CONTACT_METHODS = [
        'phone' => 'Teléfono',
        'email' => 'Email',
        'whatsapp' => 'WhatsApp',
        'in_person' => 'Presencial',
        'video_call' => 'Videollamada'
    ];

    // Relaciones
    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Cliente::class, 'client_id');
    }

    public function poliza(): BelongsTo
    {
        return $this->belongsTo(Poliza::class);
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // Scopes
    public function scopeForBroker($query, $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pendiente');
    }

    public function scopeInProgress($query)
    {
        return $query->where('status', 'en_progreso');
    }

    public function scopeCompleted($query)
    {
        return $query->where('status', 'completada');
    }

    public function scopeOverdue($query)
    {
        return $query->where('due_date', '<', now())
                     ->whereNotIn('status', ['completada', 'cancelada']);
    }

    public function scopeDueToday($query)
    {
        return $query->whereDate('due_date', today());
    }

    public function scopeDueThisWeek($query)
    {
        return $query->whereBetween('due_date', [
            now()->startOfWeek(),
            now()->endOfWeek()
        ]);
    }

    public function scopeByPriority($query, $priority)
    {
        return $query->where('priority', $priority);
    }

    public function scopeByType($query, $type)
    {
        return $query->where('type', $type);
    }

    public function scopeAssignedTo($query, $userId)
    {
        return $query->where('assigned_to', $userId);
    }

    public function scopeNeedingFollowUp($query)
    {
        return $query->whereNotNull('next_follow_up')
                     ->where('next_follow_up', '<=', now())
                     ->whereNotIn('status', ['completada', 'cancelada']);
    }

    public function scopeWithReminders($query)
    {
        return $query->where('has_reminder', true)
                     ->where('reminder_sent', false)
                     ->where('reminder_at', '<=', now());
    }

    // Accessors
    public function getTypeNameAttribute(): string
    {
        return self::TYPES[$this->type] ?? $this->type;
    }

    public function getStatusNameAttribute(): string
    {
        return self::STATUSES[$this->status] ?? $this->status;
    }

    public function getPriorityNameAttribute(): string
    {
        return self::PRIORITIES[$this->priority] ?? $this->priority;
    }

    public function getResultNameAttribute(): ?string
    {
        return $this->result ? (self::RESULTS[$this->result] ?? $this->result) : null;
    }

    public function getContactMethodNameAttribute(): ?string
    {
        return $this->contact_method ? (self::CONTACT_METHODS[$this->contact_method] ?? $this->contact_method) : null;
    }

    public function getIsOverdueAttribute(): bool
    {
        return $this->due_date && 
               $this->due_date->isPast() && 
               !in_array($this->status, ['completada', 'cancelada']);
    }

    public function getIsDueTodayAttribute(): bool
    {
        return $this->due_date && $this->due_date->isToday();
    }

    public function getIsDueThisWeekAttribute(): bool
    {
        return $this->due_date && 
               $this->due_date->between(now()->startOfWeek(), now()->endOfWeek());
    }

    public function getDaysUntilDueAttribute(): ?int
    {
        return $this->due_date ? now()->diffInDays($this->due_date, false) : null;
    }

    public function getDurationInMinutesAttribute(): ?int
    {
        if ($this->started_at && $this->completed_at) {
            return $this->started_at->diffInMinutes($this->completed_at);
        }
        return null;
    }

    // Métodos de negocio
    public function start(): void
    {
        $this->update([
            'status' => 'en_progreso',
            'started_at' => now()
        ]);
    }

    public function complete(string $result = null, string $notes = null): void
    {
        $this->update([
            'status' => 'completada',
            'completed_at' => now(),
            'progress_percentage' => 100,
            'result' => $result,
            'notes' => $notes ? $this->notes . "\n" . $notes : $this->notes
        ]);
    }

    public function cancel(string $reason = null): void
    {
        $this->update([
            'status' => 'cancelada',
            'notes' => $reason ? $this->notes . "\nCancelada: " . $reason : $this->notes
        ]);
    }

    public function pause(string $reason = null): void
    {
        $this->update([
            'status' => 'pausada',
            'notes' => $reason ? $this->notes . "\nPausada: " . $reason : $this->notes
        ]);
    }

    public function resume(): void
    {
        $this->update([
            'status' => 'en_progreso'
        ]);
    }

    public function updateProgress(int $percentage, string $notes = null): void
    {
        $data = ['progress_percentage' => min(100, max(0, $percentage))];
        
        if ($notes) {
            $data['notes'] = $this->notes . "\n" . $notes;
        }

        if ($percentage >= 100) {
            $data['status'] = 'completada';
            $data['completed_at'] = now();
        }

        $this->update($data);
    }

    public function scheduleFollowUp(Carbon $date, string $notes = null): void
    {
        $this->update([
            'next_follow_up' => $date,
            'follow_up_notes' => $notes
        ]);
    }

    public function setReminder(Carbon $reminderDate): void
    {
        $this->update([
            'has_reminder' => true,
            'reminder_at' => $reminderDate,
            'reminder_sent' => false
        ]);
    }

    public function markReminderSent(): void
    {
        $this->update(['reminder_sent' => true]);
    }

    public function addActivity(string $activity, array $data = []): void
    {
        $activityLog = $this->activity_log ?? [];
        $activityLog[] = [
            'timestamp' => now()->toISOString(),
            'activity' => $activity,
            'data' => $data,
            'user_id' => auth()->id()
        ];

        $this->update(['activity_log' => $activityLog]);
    }

    public function addAttachment(string $filename, string $url, int $size = null): void
    {
        $attachments = $this->attachments ?? [];
        $attachments[] = [
            'filename' => $filename,
            'url' => $url,
            'size' => $size,
            'uploaded_at' => now()->toISOString(),
            'uploaded_by' => auth()->id()
        ];

        $this->update(['attachments' => $attachments]);
    }

    public function checkAndMarkOverdue(): void
    {
        if ($this->is_overdue && $this->status !== 'vencida') {
            $this->update(['status' => 'vencida']);
        }
    }

    // Métodos estáticos
    public static function getTasksNeedingAttention($brokerId)
    {
        return self::forBroker($brokerId)
                   ->where(function($query) {
                       $query->overdue()
                             ->orWhere(function($q) {
                                 $q->dueToday();
                             })
                             ->orWhere(function($q) {
                                 $q->needingFollowUp();
                             });
                   })
                   ->with(['client', 'assignedUser'])
                   ->orderBy('priority', 'desc')
                   ->orderBy('due_date', 'asc');
    }

    public static function getStatistics($brokerId)
    {
        $base = self::forBroker($brokerId);
        
        return [
            'total' => $base->count(),
            'pending' => $base->pending()->count(),
            'in_progress' => $base->inProgress()->count(),
            'completed' => $base->completed()->count(),
            'overdue' => $base->overdue()->count(),
            'due_today' => $base->dueToday()->count(),
            'due_this_week' => $base->dueThisWeek()->count(),
            'needing_follow_up' => $base->needingFollowUp()->count(),
            'by_type' => $base->selectRaw('type, count(*) as count')
                              ->groupBy('type')
                              ->pluck('count', 'type'),
            'by_priority' => $base->selectRaw('priority, count(*) as count')
                                  ->groupBy('priority')
                                  ->pluck('count', 'priority')
        ];
    }
}
