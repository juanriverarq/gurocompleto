<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;
use Carbon\Carbon;

class VoiceCampaignTrigger extends Model
{
    use HasFactory;

    protected $table = 'voice_campaign_triggers';

    // Tipos de disparador soportados
    public const TYPE_NEW_CLIENT    = 'new_client';
    public const TYPE_NEW_POLICY    = 'new_policy';
    public const TYPE_POLICY_EXPIRY = 'policy_expiry';
    public const TYPE_NEW_LEAD      = 'new_lead';
    public const TYPE_NEW_SINIESTRO = 'new_siniestro';

    public const TYPES = [
        self::TYPE_NEW_CLIENT,
        self::TYPE_NEW_POLICY,
        self::TYPE_POLICY_EXPIRY,
        self::TYPE_NEW_LEAD,
        self::TYPE_NEW_SINIESTRO,
    ];

    protected $fillable = [
        'voice_campaign_id',
        'type',
        'enabled',
        'window_config',
        'limits',
        'filters',
        'expiry_offsets',
        'mapping',
        'last_fired_at',
        'status',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'enabled'        => 'boolean',
        'window_config'  => 'array',   // { days:[], start:"08:00", end:"18:00", tz:"America/Bogota" }
        'limits'         => 'array',   // { daily_quota:int, dedup_days:int }
        'filters'        => 'array',   // específico del tipo
        'expiry_offsets' => 'array',   // { before_days:[], after_days:[] } (solo policy_expiry)
        'mapping'        => 'array',   // { phone_field, alt_phone_field, variables:{} }
        'last_fired_at'  => 'datetime',
    ];

    /**
     * Campaña de voz a la que pertenece.
     */
    public function campaign()
    {
        return $this->belongsTo(VoiceCampaign::class, 'voice_campaign_id');
    }

    /**
     * Logs del disparador.
     */
    public function logs()
    {
        return $this->hasMany(VoiceCampaignTriggerLog::class, 'trigger_id');
    }

    /**
     * Scope: por campaña.
     */
    public function scopeForCampaign(Builder $query, int $campaignId): Builder
    {
        return $query->where('voice_campaign_id', $campaignId);
    }

    /**
     * Scope: por broker (join con voice_campaigns).
     */
    public function scopeForBroker(Builder $query, int $brokerId): Builder
    {
        return $query
            ->join('voice_campaigns as vc', 'vc.id', '=', 'voice_campaign_triggers.voice_campaign_id')
            ->where('vc.broker_id', $brokerId)
            ->select('voice_campaign_triggers.*');
    }

    /**
     * Scope: por tipo.
     */
    public function scopeOfType(Builder $query, string $type): Builder
    {
        return $query->where('type', $type);
    }

    /**
     * Scope: habilitados.
     */
    public function scopeEnabled(Builder $query): Builder
    {
        return $query->where('enabled', true);
    }

    /**
     * Devuelve el cupo diario configurado (por defecto 0 = sin límite).
     */
    public function getDailyQuota(): int
    {
        $limits = $this->limits ?: [];
        $quota = (int)($limits['daily_quota'] ?? 0);
        return max(0, $quota);
    }

    /**
     * Días de deduplicación configurados (por defecto 0 = sin deduplicación).
     */
    public function getDedupDays(): int
    {
        $limits = $this->limits ?: [];
        $days = (int)($limits['dedup_days'] ?? 0);
        return max(0, $days);
    }

    /**
     * Retorna TZ efectivo para evaluación de ventana.
     */
    public function getWindowTimezone(): string
    {
        $cfg = $this->window_config ?: [];
        return (string)($cfg['tz'] ?? 'America/Bogota');
    }

    /**
     * Días activos (mon..sun) para evaluación de ventana.
     */
    public function getWindowDays(): array
    {
        $cfg = $this->window_config ?: [];
        $days = $cfg['days'] ?? ['mon','tue','wed','thu','fri'];
        return is_array($days) ? $days : [];
    }

    /**
     * Horario start/end "HH:MM" (24h).
     */
    public function getWindowStart(): string
    {
        $cfg = $this->window_config ?: [];
        return (string)($cfg['start'] ?? '08:00');
    }

    public function getWindowEnd(): string
    {
        $cfg = $this->window_config ?: [];
        return (string)($cfg['end'] ?? '18:00');
    }

    /**
     * Evalúa si el momento dado (o ahora) está dentro de la ventana horaria configurada.
     */
    public function isWithinWindow(?Carbon $now = null): bool
    {
        $tz = $this->getWindowTimezone();
        $nowTz = ($now ?: now())->copy()->setTimezone($tz);

        // Día de la semana (mon..sun)
        $map = [
            1 => 'mon',
            2 => 'tue',
            3 => 'wed',
            4 => 'thu',
            5 => 'fri',
            6 => 'sat',
            7 => 'sun',
        ];
        $dayKey = $map[(int)$nowTz->isoWeekday()] ?? 'mon';

        $allowedDays = array_map('strtolower', $this->getWindowDays());
        if (!in_array($dayKey, $allowedDays, true)) {
            return false;
        }

        // Rango horario
        $start = $this->getWindowStart();
        $end   = $this->getWindowEnd();

        try {
            [$sh, $sm] = array_map('intval', explode(':', $start));
            [$eh, $em] = array_map('intval', explode(':', $end));
        } catch (\Throwable $e) {
            // Config inválida - bloquear
            return false;
        }

        $startMinutes = $sh * 60 + $sm;
        $endMinutes   = $eh * 60 + $em;
        $currentMinutes = (int)$nowTz->format('H') * 60 + (int)$nowTz->format('i');

        // Ventana inclusiva simple (no cruza medianoche)
        return $currentMinutes >= $startMinutes && $currentMinutes <= $endMinutes;
    }

    /**
     * Helpers específicos de vencimientos (solo para policy_expiry).
     */
    public function getExpiryBeforeDays(): array
    {
        if ($this->type !== self::TYPE_POLICY_EXPIRY) {
            return [];
        }
        $o = $this->expiry_offsets ?: [];
        $arr = $o['before_days'] ?? [7,3,1];
        return array_values(array_unique(array_map('intval', (array)$arr)));
    }

    public function getExpiryAfterDays(): array
    {
        if ($this->type !== self::TYPE_POLICY_EXPIRY) {
            return [];
        }
        $o = $this->expiry_offsets ?: [];
        $arr = $o['after_days'] ?? [1];
        return array_values(array_unique(array_map('intval', (array)$arr)));
    }

    /**
     * Obtiene el rango de días antes del vencimiento (número simple, no array).
     * Retorna el máximo valor si es un array, o el valor directo si es un número.
     */
    public function getExpiryBeforeDaysRange(): int
    {
        if ($this->type !== self::TYPE_POLICY_EXPIRY) {
            return 0;
        }
        $o = $this->expiry_offsets ?: [];
        $val = $o['before_days'] ?? 7;
        
        // Si es un array (compatibilidad con formato anterior), tomar el máximo
        if (is_array($val)) {
            return count($val) > 0 ? max(array_map('intval', $val)) : 0;
        }
        
        // Si es string con comas (formato CSV anterior), parsear y tomar máximo
        if (is_string($val) && str_contains($val, ',')) {
            $parts = array_map('intval', explode(',', $val));
            return count($parts) > 0 ? max($parts) : 0;
        }
        
        return (int) $val;
    }

    /**
     * Obtiene el rango de días después del vencimiento (número simple, no array).
     */
    public function getExpiryAfterDaysRange(): int
    {
        if ($this->type !== self::TYPE_POLICY_EXPIRY) {
            return 0;
        }
        $o = $this->expiry_offsets ?: [];
        $val = $o['after_days'] ?? 1;
        
        // Si es un array (compatibilidad con formato anterior), tomar el máximo
        if (is_array($val)) {
            return count($val) > 0 ? max(array_map('intval', $val)) : 0;
        }
        
        // Si es string con comas (formato CSV anterior), parsear y tomar máximo
        if (is_string($val) && str_contains($val, ',')) {
            $parts = array_map('intval', explode(',', $val));
            return count($parts) > 0 ? max($parts) : 0;
        }
        
        return (int) $val;
    }

    /**
     * Campos de mapeo de contacto.
     */
    public function getPhoneField(): string
    {
        $m = $this->mapping ?: [];
        return (string)($m['phone_field'] ?? 'celular_principal');
    }

    public function getAltPhoneField(): ?string
    {
        $m = $this->mapping ?: [];
        $v = $m['alt_phone_field'] ?? null;
        return $v ? (string)$v : null;
    }
}