<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Carbon\Carbon;
use App\Traits\BrokerScoped;

class SalesFunnel extends Model
{
    use HasFactory, SoftDeletes, BrokerScoped;

    protected $table = 'sales_funnel';

    protected $fillable = [
        'broker_id',
        'assigned_agent_id',
        'created_by',
        'client_id',
        'first_name',
        'last_name',
        'email',
        'phone',
        'secondary_phone',
        'document_type',
        'document_number',
        'company_name',
        'company_size',
        'industry',
        'position',
        'city',
        'department',
        'address',
        'stage',
        'business_state',
        'lead_source',
        'insurance_type',
        'potential_value',
        'close_probability',
        'expected_close_date',
        'first_contact_at',
        'last_contact_at',
        'next_follow_up_at',
        'stage_changed_at',
        'closed_at',
        'preferred_contact_method',
        'preferred_contact_time',
        'contact_history',
        'notes',
        'qualifying_notes',
        'presentation_notes',
        'negotiation_notes',
        'closing_notes',
        'lost_reason',
        'insurance_details',
        'custom_fields',
        'activity_log',
        'lead_score',
        'quality_rating',
        'days_in_current_stage',
        'total_days_in_funnel',
        'final_value',
        'policy_number',
        'description',
        'ramo_id',
        'poliza_id',
        'external_reference'
    ];

    protected $casts = [
        'potential_value' => 'decimal:2',
        'final_value' => 'decimal:2',
        'close_probability' => 'integer',
        'lead_score' => 'integer',
        'days_in_current_stage' => 'integer',
        'total_days_in_funnel' => 'integer',
        'expected_close_date' => 'date',
        'first_contact_at' => 'datetime',
        'last_contact_at' => 'datetime',
        'next_follow_up_at' => 'datetime',
        'stage_changed_at' => 'datetime',
        'closed_at' => 'datetime',
        'contact_history' => 'array',
        'insurance_details' => 'array',
        'custom_fields' => 'array',
        'activity_log' => 'array'
    ];

    // Constantes para los enums
    const STAGES = [
        'lead' => 'Lead',
        'contacted' => 'Contactado',
        'qualified' => 'Calificado',
        'presentation' => 'Presentación',
        'proposal' => 'Propuesta',
        'negotiation' => 'Negociación',
        'closed_won' => 'Cerrado Ganado',
        'closed_lost' => 'Cerrado Perdido'
    ];

    const LEAD_SOURCES = [
        'website' => 'Sitio Web',
        'social_media' => 'Redes Sociales',
        'google_ads' => 'Google Ads',
        'facebook_ads' => 'Facebook Ads',
        'referral' => 'Referido',
        'cold_call' => 'Llamada Fría',
        'email_campaign' => 'Campaña Email',
        'trade_show' => 'Feria Comercial',
        'partner' => 'Socio Comercial',
        'other' => 'Otro'
    ];

    const INSURANCE_TYPES = [
        'auto' => 'Vehículos',
        'home' => 'Hogar',
        'life' => 'Vida',
        'health' => 'Salud',
        'business' => 'Empresarial',
        'travel' => 'Viajes',
        'motorcycle' => 'Motocicleta',
        'bicycle' => 'Bicicleta',
        'pet' => 'Mascotas',
        'multiple' => 'Múltiples Seguros'
    ];

    const QUALITY_RATINGS = [
        'hot' => 'Caliente',
        'warm' => 'Tibio',
        'cold' => 'Frío'
    ];

    const CONTACT_METHODS = [
        'phone' => 'Teléfono',
        'email' => 'Email',
        'whatsapp' => 'WhatsApp',
        'in_person' => 'Presencial'
    ];

    const CONTACT_TIMES = [
        'morning' => 'Mañana',
        'afternoon' => 'Tarde',
        'evening' => 'Noche'
    ];

    const COMPANY_SIZES = [
        'small' => 'Pequeña (1-50)',
        'medium' => 'Mediana (51-200)',
        'large' => 'Grande (200+)'
    ];

    const BUSINESS_STATES = [
        'nuevo' => 'Nuevo',
        'contactado' => 'Contactado',
        'interesado' => 'Interesado',
        'negociando' => 'Negociando',
        'cerrado' => 'Cerrado'
    ];

    // Relaciones
    public function broker(): BelongsTo
    {
        return $this->belongsTo(Broker::class);
    }

    public function assignedAgent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_agent_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Cliente::class, 'client_id');
    }

    public function ramo(): BelongsTo
    {
        return $this->belongsTo(Ramo::class, 'ramo_id');
    }

    public function poliza(): BelongsTo
    {
        return $this->belongsTo(Poliza::class, 'poliza_id');
    }

    // Scopes
    public function scopeForBroker($query, $brokerId)
    {
        return $query->where('broker_id', $brokerId);
    }

    public function scopeByStage($query, $stage)
    {
        return $query->where('stage', $stage);
    }

    public function scopeActiveLeads($query)
    {
        return $query->whereNotIn('stage', ['closed_won', 'closed_lost']);
    }

    public function scopeClosedWon($query)
    {
        return $query->where('stage', 'closed_won');
    }

    public function scopeClosedLost($query)
    {
        return $query->where('stage', 'closed_lost');
    }

    public function scopeNeedingFollowUp($query)
    {
        return $query->whereNotNull('next_follow_up_at')
                     ->where('next_follow_up_at', '<=', now())
                     ->activeLeads();
    }

    public function scopeByInsuranceType($query, $type)
    {
        return $query->where('insurance_type', $type);
    }

    public function scopeByLeadSource($query, $source)
    {
        return $query->where('lead_source', $source);
    }

    public function scopeByQuality($query, $quality)
    {
        return $query->where('quality_rating', $quality);
    }

    public function scopeAssignedTo($query, $agentId)
    {
        return $query->where('assigned_agent_id', $agentId);
    }

    public function scopeHighValue($query, $threshold = 5000000)
    {
        return $query->where('potential_value', '>=', $threshold);
    }

    public function scopeHighProbability($query, $threshold = 70)
    {
        return $query->where('close_probability', '>=', $threshold);
    }

    public function scopeStaleLeads($query, $days = 30)
    {
        return $query->where('days_in_current_stage', '>', $days)
                     ->activeLeads();
    }

    public function scopeRecentlyCreated($query, $days = 7)
    {
        return $query->where('created_at', '>=', now()->subDays($days));
    }

    public function scopeExpectedToCloseSoon($query, $days = 30)
    {
        return $query->whereNotNull('expected_close_date')
                     ->where('expected_close_date', '<=', now()->addDays($days))
                     ->activeLeads();
    }

    // Accessors
    public function getFullNameAttribute(): string
    {
        return trim($this->first_name . ' ' . $this->last_name);
    }

    public function getStageNameAttribute(): string
    {
        return self::STAGES[$this->stage] ?? $this->stage;
    }

    public function getLeadSourceNameAttribute(): string
    {
        return self::LEAD_SOURCES[$this->lead_source] ?? $this->lead_source;
    }

    public function getInsuranceTypeNameAttribute(): string
    {
        return self::INSURANCE_TYPES[$this->insurance_type] ?? $this->insurance_type;
    }

    public function getQualityRatingNameAttribute(): string
    {
        return self::QUALITY_RATINGS[$this->quality_rating] ?? $this->quality_rating;
    }

    public function getContactMethodNameAttribute(): ?string
    {
        return $this->preferred_contact_method ? 
               (self::CONTACT_METHODS[$this->preferred_contact_method] ?? $this->preferred_contact_method) : 
               null;
    }

    public function getContactTimeNameAttribute(): ?string
    {
        return $this->preferred_contact_time ? 
               (self::CONTACT_TIMES[$this->preferred_contact_time] ?? $this->preferred_contact_time) : 
               null;
    }

    public function getCompanySizeNameAttribute(): ?string
    {
        return $this->company_size ? 
               (self::COMPANY_SIZES[$this->company_size] ?? $this->company_size) : 
               null;
    }

    public function getIsActiveAttribute(): bool
    {
        return !in_array($this->stage, ['closed_won', 'closed_lost']);
    }

    public function getIsClosedAttribute(): bool
    {
        return in_array($this->stage, ['closed_won', 'closed_lost']);
    }

    public function getIsWonAttribute(): bool
    {
        return $this->stage === 'closed_won';
    }

    public function getIsLostAttribute(): bool
    {
        return $this->stage === 'closed_lost';
    }

    public function getWeightedValueAttribute(): float
    {
        return $this->potential_value * ($this->close_probability / 100);
    }

    public function getDaysInFunnelAttribute(): int
    {
        return $this->created_at->diffInDays(now());
    }

    public function getDaysSinceLastContactAttribute(): ?int
    {
        return $this->last_contact_at ? $this->last_contact_at->diffInDays(now()) : null;
    }

    public function getIsOverdueFollowUpAttribute(): bool
    {
        return $this->next_follow_up_at && $this->next_follow_up_at->isPast();
    }

    public function getStageProgressPercentageAttribute(): int
    {
        $stageOrder = array_keys(self::STAGES);
        $currentIndex = array_search($this->stage, $stageOrder);
        
        if ($currentIndex === false) return 0;
        
        return intval(($currentIndex / (count($stageOrder) - 1)) * 100);
    }

    // Métodos de negocio
    public function moveToNextStage(string $notes = null): void
    {
        $stageOrder = array_keys(self::STAGES);
        $currentIndex = array_search($this->stage, $stageOrder);
        
        if ($currentIndex !== false && $currentIndex < count($stageOrder) - 1) {
            $this->moveToStage($stageOrder[$currentIndex + 1], $notes);
        }
    }

    public function moveToStage(string $newStage, string $notes = null): void
    {
        $oldStage = $this->stage;
        
        $this->update([
            'stage' => $newStage,
            'stage_changed_at' => now(),
            'days_in_current_stage' => 0
        ]);

        $this->addActivity('stage_changed', [
            'from_stage' => $oldStage,
            'to_stage' => $newStage,
            'notes' => $notes
        ]);

        // Si se cierra, establecer fecha de cierre
        if (in_array($newStage, ['closed_won', 'closed_lost'])) {
            $this->update(['closed_at' => now()]);
        }
    }

    public function closeAsWon(float $finalValue = null, string $policyNumber = null, string $notes = null): void
    {
        $this->update([
            'stage' => 'closed_won',
            'stage_changed_at' => now(),
            'closed_at' => now(),
            'final_value' => $finalValue ?? $this->potential_value,
            'policy_number' => $policyNumber,
            'close_probability' => 100
        ]);

        $this->addActivity('closed_won', [
            'final_value' => $finalValue ?? $this->potential_value,
            'policy_number' => $policyNumber,
            'notes' => $notes
        ]);
    }

    public function closeAsLost(string $reason, string $notes = null): void
    {
        $this->update([
            'stage' => 'closed_lost',
            'stage_changed_at' => now(),
            'closed_at' => now(),
            'lost_reason' => $reason,
            'close_probability' => 0
        ]);

        $this->addActivity('closed_lost', [
            'reason' => $reason,
            'notes' => $notes
        ]);
    }

    public function scheduleFollowUp(Carbon $date, string $notes = null): void
    {
        $this->update([
            'next_follow_up_at' => $date
        ]);

        $this->addActivity('follow_up_scheduled', [
            'follow_up_date' => $date->toISOString(),
            'notes' => $notes
        ]);
    }

    public function recordContact(string $method, string $notes = null, array $details = []): void
    {
        $this->update([
            'last_contact_at' => now()
        ]);

        $contactRecord = [
            'datetime' => now()->toISOString(),
            'method' => $method,
            'notes' => $notes,
            'details' => $details,
            'user_id' => auth()->id()
        ];

        $contactHistory = $this->contact_history ?? [];
        $contactHistory[] = $contactRecord;

        $this->update(['contact_history' => $contactHistory]);

        $this->addActivity('contact_made', $contactRecord);
    }

    public function updateScore(int $newScore, string $reason = null): void
    {
        $oldScore = $this->lead_score;
        
        $this->update(['lead_score' => $newScore]);

        $this->addActivity('score_updated', [
            'old_score' => $oldScore,
            'new_score' => $newScore,
            'reason' => $reason
        ]);
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

    public function convertToClient(): ?Cliente
    {
        if ($this->client_id) {
            return $this->client;
        }

        $client = Cliente::create([
            'broker_id' => $this->broker_id,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'email' => $this->email,
            'phone' => $this->phone,
            'document_type' => $this->document_type,
            'document_number' => $this->document_number,
            'company_name' => $this->company_name,
            'city' => $this->city,
            'department' => $this->department,
            'address' => $this->address,
            'status' => 'active',
            'source' => $this->lead_source,
            'assigned_user_id' => $this->assigned_agent_id,
            'created_by' => $this->created_by
        ]);

        $this->update(['client_id' => $client->id]);
        
        $this->addActivity('converted_to_client', [
            'client_id' => $client->id
        ]);

        return $client;
    }

    // Métodos estáticos para estadísticas
    public static function getConversionRate($brokerId, $period = 30)
    {
        $totalLeads = self::forBroker($brokerId)
                         ->where('created_at', '>=', now()->subDays($period))
                         ->count();

        $wonLeads = self::forBroker($brokerId)
                       ->where('created_at', '>=', now()->subDays($period))
                       ->where('stage', 'closed_won')
                       ->count();

        return $totalLeads > 0 ? ($wonLeads / $totalLeads) * 100 : 0;
    }

    public static function getStatistics($brokerId)
    {
        $base = self::forBroker($brokerId);
        
        return [
            'total_leads' => $base->count(),
            'active_leads' => $base->activeLeads()->count(),
            'closed_won' => $base->closedWon()->count(),
            'closed_lost' => $base->closedLost()->count(),
            'needing_follow_up' => $base->needingFollowUp()->count(),
            'high_value' => $base->highValue()->count(),
            'high_probability' => $base->highProbability()->count(),
            'stale_leads' => $base->staleLeads()->count(),
            'expected_to_close_soon' => $base->expectedToCloseSoon()->count(),
            'total_potential_value' => $base->activeLeads()->sum('potential_value'),
            'total_weighted_value' => $base->activeLeads()->get()->sum('weighted_value'),
            'conversion_rate_30d' => self::getConversionRate($brokerId, 30),
            'average_days_to_close' => $base->closedWon()
                                          ->selectRaw('AVG(DATEDIFF(closed_at, created_at)) as avg_days')
                                          ->value('avg_days') ?? 0,
            'by_stage' => $base->selectRaw('stage, count(*) as count')
                               ->groupBy('stage')
                               ->pluck('count', 'stage'),
            'by_insurance_type' => $base->selectRaw('insurance_type, count(*) as count')
                                        ->groupBy('insurance_type')
                                        ->pluck('count', 'insurance_type'),
            'by_lead_source' => $base->selectRaw('lead_source, count(*) as count')
                                     ->groupBy('lead_source')
                                     ->pluck('count', 'lead_source'),
            'by_quality' => $base->selectRaw('quality_rating, count(*) as count')
                                 ->groupBy('quality_rating')
                                 ->pluck('count', 'quality_rating')
        ];
    }

    // Actualizar días en etapa actual (se debe ejecutar diariamente)
    public static function updateDaysInStage()
    {
        self::whereNotNull('stage_changed_at')
            ->update([
                'days_in_current_stage' => \DB::raw('DATEDIFF(NOW(), stage_changed_at)'),
                'total_days_in_funnel' => \DB::raw('DATEDIFF(NOW(), created_at)')
            ]);
    }
}
