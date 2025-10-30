<?php

namespace App\Services;

use App\Models\VoiceCampaign;
use App\Models\VoiceCampaignCall;
use App\Models\VoiceCampaignTrigger;
use App\Models\VoiceCampaignTriggerLog;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

/**
 * Procesa eventos de negocio contra los Disparadores (Triggers) de campañas de voz.
 *
 * Flujos soportados:
 * - processEvent(brokerId, type, entity): busca todos los triggers habilitados del broker para ese tipo,
 *   evalúa ventana horaria, deduplicación, límites diarios y filtros; si aplica, inicia la llamada vía
 *   VoiceCampaignCallService::startSingleCall() y registra log.
 *
 * - processSingleTrigger(triggerId, entity): igual que arriba pero para un trigger específico (útil para test-run).
 *
 * Reglas de deduplicación:
 * - Se calcula un hash por (broker_id, trigger_id, type, entity_type, entity_id, phone) y se consulta en la tabla
 *   voice_campaign_trigger_logs dentro de la ventana de días configurada por el trigger (limits.dedup_days).
 *
 * Reglas de límite diario:
 * - limits.daily_quota (0 = sin límite). Se cuenta cantidad de logs "success" por trigger en el día (TZ del trigger).
 *
 * Ventana horaria:
 * - Se respeta window_config { days[], start, end, tz }. Si no pasa, se hace log skip_window.
 *
 * Filtros:
 * - Método evaluateFilters() por tipo. Si no hay filtros configurados o faltan campos, por defecto pasa.
 *
 * Offsets de vencimiento (policy_expiry):
 * - Para entidades Póliza con fecha de vencimiento, evalúa si hoy coincide con los días "before_days"/"after_days".
 */
class VoiceCampaignTriggerProcessor
{
    /**
     * Procesa un evento contra todos los triggers habilitados del broker para ese tipo.
     *
     * @param int $brokerId
     * @param string $type (VoiceCampaignTrigger::TYPE_*)
     * @param array $entity Datos de la entidad origen (cliente, póliza, lead, siniestro)
     * @param string|null $entityType Etiqueta de entidad para logging ("cliente","poliza","lead","siniestro"...)
     * @param int|string|null $entityId Identificador de la entidad para logging
     * @return array Resultado por trigger
     */
    public static function processEvent(int $brokerId, string $type, array $entity, ?string $entityType = null, int|string|null $entityId = null): array
    {
        $processor = new self();
        $results = [];
        try {
            $triggers = VoiceCampaignTrigger::query()
                ->enabled()
                ->ofType($type)
                ->forBroker($brokerId) // join con campaigns y filtra por broker
                ->orderBy('id', 'asc')
                ->get();

            foreach ($triggers as $trigger) {
                $results[$trigger->id] = $processor->evaluateAndFire($trigger, $brokerId, $entity, $entityType, $entityId);
            }
        } catch (\Throwable $e) {
            Log::error('❌ [TRIGGER PROCESSOR] Error en processEvent', [
                'broker_id' => $brokerId,
                'type' => $type,
                'error' => $e->getMessage(),
            ]);
        }
        return $results;
    }

    /**
     * Procesa un único trigger contra una entidad (para test-run o ejecuciones dirigidas).
     */
    public static function processSingleTrigger(int $triggerId, int $brokerId, array $entity, ?string $entityType = null, int|string|null $entityId = null): array
    {
        $processor = new self();
        
        /** @var VoiceCampaignTrigger|null $trigger */
        $trigger = VoiceCampaignTrigger::query()->where('id', $triggerId)->first();
        if (!$trigger) {
            return ['success' => false, 'message' => 'Trigger no encontrado'];
        }

        // Validar pertenencia de campaña al broker
        $campaign = VoiceCampaign::forBroker($brokerId)->where('id', $trigger->voice_campaign_id)->first();
        if (!$campaign) {
            return ['success' => false, 'message' => 'No autorizado para este trigger'];
        }

        return $processor->evaluateAndFire($trigger, $brokerId, $entity, $entityType, $entityId);
    }

    // ===================================================
    // Núcleo de evaluación y ejecución
    // ===================================================

    protected function evaluateAndFire(VoiceCampaignTrigger $trigger, int $brokerId, array $entity, ?string $entityType, int|string|null $entityId): array
    {
        $callService = new VoiceCampaignCallService();
        $now = now();

        // Calcular dedup_hash PRIMERO para usarlo en todos los logs
        $phone = $this->resolvePhoneFromEntity($trigger, $entity);
        $dedupHash = $this->computeDedupHash($brokerId, $trigger->id, $trigger->type, (string)($entityType ?? 'unknown'), (string)($entityId ?? '0'), $phone);

        // 1) Validar campaña
        /** @var VoiceCampaign|null $campaign */
        $campaign = VoiceCampaign::query()->where('id', $trigger->voice_campaign_id)->first();
        if (!$campaign) {
            return $this->logAndReturn($brokerId, $trigger, $entityType, $entityId, 'error', 'campaign_not_found', null, $entity, $dedupHash);
        }

        // 2) Ventana horaria
        if (!$trigger->isWithinWindow($now)) {
            return $this->logAndReturn($brokerId, $trigger, $entityType, $entityId, VoiceCampaignTriggerLog::RESULT_SKIP_WINDOW, 'outside_window', null, $entity, $dedupHash);
        }

        // 3) Filtros
        if (!$this->evaluateFilters($trigger, $entity)) {
            return $this->logAndReturn($brokerId, $trigger, $entityType, $entityId, VoiceCampaignTriggerLog::RESULT_SKIP_FILTERS, 'filters_not_match', null, $entity, $dedupHash);
        }

        // 4) Offsets de vencimiento (solo policy_expiry)
        if ($trigger->type === VoiceCampaignTrigger::TYPE_POLICY_EXPIRY && !$this->matchPolicyExpiryOffsets($trigger, $entity, $now)) {
            return $this->logAndReturn($brokerId, $trigger, $entityType, $entityId, VoiceCampaignTriggerLog::RESULT_SKIP_FILTERS, 'expiry_offset_not_match', null, $entity, $dedupHash);
        }

        // 4.5) Global recent event guard (cross-trigger)
        // Evita múltiples llamadas cuando varios triggers del mismo tipo reaccionan al mismo evento (misma entidad)
        if ($this->hasRecentGlobalEvent($brokerId, (string)($entityType ?? 'unknown'), (string)($entityId ?? '0'), $trigger->type, 2)) {
            return $this->logAndReturn(
                $brokerId,
                $trigger,
                $entityType,
                $entityId,
                VoiceCampaignTriggerLog::RESULT_SKIP_DEDUP,
                'global_recent_event',
                null,
                [
                    'entity' => ['type' => (string)($entityType ?? 'unknown'), 'id' => (string)($entityId ?? '0')],
                    'recent_window_minutes' => 2
                ],
                $dedupHash
            );
        }

        // 5) Dedupe
        $dedupDays = $trigger->getDedupDays();
        if ($dedupDays > 0 && $this->existsRecentDedup($dedupHash, $dedupDays)) {
            return $this->logAndReturn($brokerId, $trigger, $entityType, $entityId, VoiceCampaignTriggerLog::RESULT_SKIP_DEDUP, 'dedup_days_active', null, $entity, $dedupHash);
        }

        // 6) Límite diario
        $quota = $trigger->getDailyQuota();
        if ($quota > 0 && !$this->hasRemainingQuota($trigger, $quota, $now)) {
            return $this->logAndReturn($brokerId, $trigger, $entityType, $entityId, VoiceCampaignTriggerLog::RESULT_SKIP_QUOTA, 'daily_quota_reached', null, $entity, $dedupHash);
        }

        // 7) Construir contacto y variables
        $contact = $this->buildContactFromEntity($trigger, $entity, $phone);

        // Guard: si no hay teléfono, no intentes llamar
        if (empty($contact['phone'])) {
            return $this->logAndReturn(
                $brokerId,
                $trigger,
                $entityType,
                $entityId,
                VoiceCampaignTriggerLog::RESULT_SKIP_FILTERS,
                'no_phone',
                null,
                [
                    'trigger_mapping' => $trigger->mapping,
                    'entity_excerpt' => array_intersect_key($entity, array_flip(['id','first_name','last_name','email','phone','mobile_phone','celular_principal'])),
                ],
                $dedupHash
            );
        }

        // Guard global: evitar múltiples llamadas simultáneas al mismo número (entre campañas/triggers)
        if ($this->hasRecentCallForPhone($brokerId, (string)$contact['phone'], 5)) {
            return $this->logAndReturn(
                $brokerId,
                $trigger,
                $entityType,
                $entityId,
                VoiceCampaignTriggerLog::RESULT_SKIP_DEDUP,
                'global_recent_call',
                null,
                [
                    'trigger_mapping' => $trigger->mapping,
                    'contact' => ['phone' => (string)$contact['phone']],
                    'recent_window_minutes' => 5
                ],
                $dedupHash
            );
        }

        // 7.5) Global per-phone lock anti-race (cruza triggers/campañas)
        // Previene condiciones de carrera si múltiples listeners/triggers llegan casi simultáneamente
        $lockKey = 'vc_call_lock:' . $brokerId . ':' . $trigger->type . ':' . md5((string)$contact['phone']);
        try {
            if (!\Cache::add($lockKey, 1, now()->addMinutes(3))) {
                return $this->logAndReturn(
                    $brokerId,
                    $trigger,
                    $entityType,
                    $entityId,
                    VoiceCampaignTriggerLog::RESULT_SKIP_DEDUP,
                    'global_lock',
                    null,
                    ['lock_key' => $lockKey, 'lock_ttl_minutes' => 3, 'phone' => (string)$contact['phone']],
                    $dedupHash
                );
            }
        } catch (\Throwable $e) {
            // No bloquear si el backend de caché no soporta add/lock
        }

        // 8) Iniciar llamada
        $result = $callService->startSingleCall($campaign, $contact, [
            // Permitir overrides mínimos. Si se necesitan más, mapear desde $trigger->mapping['variables']
            'collect_config' => is_array($trigger->mapping) ? ($trigger->mapping['variables'] ?? null) : null,
        ]);

        // 9) Log y retorno
        if (!empty($result['success'])) {
            return $this->logAndReturn(
                $brokerId,
                $trigger,
                $entityType,
                $entityId,
                VoiceCampaignTriggerLog::RESULT_SUCCESS,
                null,
                $result['voice_campaign_call_id'] ?? null,
                [
                    'trigger_mapping' => $trigger->mapping,
                    'contact' => $contact,
                    'eleven_response' => $result['response_data'] ?? null,
                ],
                $dedupHash
            );
        }

        return $this->logAndReturn(
            $brokerId,
            $trigger,
            $entityType,
            $entityId,
            VoiceCampaignTriggerLog::RESULT_ERROR,
            (string)($result['error'] ?? 'unknown_error'),
            null,
            [
                'trigger_mapping' => $trigger->mapping,
                'contact' => $contact,
            ],
            $dedupHash
        );
    }

    // ===================================================
    // Filtros y helpers de negocio
    // ===================================================

    protected function evaluateFilters(VoiceCampaignTrigger $trigger, array $entity): bool
    {
        $filters = $trigger->filters ?? [];
        if (!is_array($filters) || empty($filters)) {
            return true; // sin filtros => pasa
        }

        try {
            switch ($trigger->type) {
                case VoiceCampaignTrigger::TYPE_NEW_CLIENT:
                    // Ejemplo: filtros['has_phone']=true; filtros['segment']='vip'
                    if (isset($filters['has_phone']) && $filters['has_phone']) {
                        $phone = $this->resolvePhoneFromEntity($trigger, $entity);
                        if (!$phone) return false;
                    }
                    if (isset($filters['segment']) && $filters['segment']) {
                        $seg = (string) ($entity['segment'] ?? '');
                        if (strcasecmp($seg, (string)$filters['segment']) !== 0) return false;
                    }
                    return true;

                case VoiceCampaignTrigger::TYPE_NEW_POLICY:
                    // Ejemplo: filtros['status']='active'
                    if (isset($filters['status']) && $filters['status']) {
                        $status = (string)($entity['status'] ?? $entity['estado'] ?? '');
                        if (strcasecmp($status, (string)$filters['status']) !== 0) return false;
                    }
                    return true;

                case VoiceCampaignTrigger::TYPE_NEW_LEAD:
                    // Ejemplo: filtros['score_min']=50
                    if (isset($filters['score_min'])) {
                        $score = (int)($entity['score'] ?? 0);
                        if ($score < (int)$filters['score_min']) return false;
                    }
                    return true;

                case VoiceCampaignTrigger::TYPE_NEW_SINIESTRO:
                    // Ejemplo: filtros['tipo']='robo'
                    if (isset($filters['tipo']) && $filters['tipo']) {
                        $tipo = (string)($entity['tipo_siniestro'] ?? $entity['tipo'] ?? '');
                        if (strcasecmp($tipo, (string)$filters['tipo']) !== 0) return false;
                    }
                    return true;

                case VoiceCampaignTrigger::TYPE_POLICY_EXPIRY:
                    // Filtros adicionales (aseguradora, ramo, etc.)
                    if (isset($filters['insurance_company']) && $filters['insurance_company']) {
                        $comp = (string)($entity['insurance_company'] ?? $entity['aseguradora'] ?? '');
                        if (strcasecmp($comp, (string)$filters['insurance_company']) !== 0) return false;
                    }
                    return true;

                default:
                    return true;
            }
        } catch (\Throwable $e) {
            Log::warning('⚠️ [TRIGGER FILTERS] Error evaluando filtros', [
                'trigger_id' => $trigger->id,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Para policy_expiry: valida si hoy es uno de los días configurados antes/después del vencimiento.
     */
    protected function matchPolicyExpiryOffsets(VoiceCampaignTrigger $trigger, array $entity, \DateTimeInterface $now): bool
    {
        try {
            $end = $entity['end_date'] ?? $entity['fecha_vencimiento'] ?? $entity['endDate'] ?? null;
            if (!$end) return false;

            $endDate = Carbon::parse($end)->startOfDay();
            $today   = Carbon::instance($now)->startOfDay();

            $diffDays = $today->diffInDays($endDate, false); // negativo si ya venció

            $beforeDays = $trigger->getExpiryBeforeDays(); // e.g., [7,3,1]
            $afterDays  = $trigger->getExpiryAfterDays();  // e.g., [1]

            if ($diffDays > 0) {
                // Falta(n) X día(s) para vencer
                return in_array($diffDays, $beforeDays, true);
            } elseif ($diffDays < 0) {
                // Ya venció hace X días
                $ago = abs($diffDays);
                return in_array($ago, $afterDays, true);
            } else {
                // Hoy vence
                return in_array(0, $beforeDays, true) || in_array(0, $afterDays, true);
            }
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * Construye el contacto que usará la llamada en base al mapping del trigger y la entidad.
     */
    protected function buildContactFromEntity(VoiceCampaignTrigger $trigger, array $entity, ?string $resolvedPhone): array
    {
        // Para nueva póliza, intentar cargar datos del cliente asociado
        if ($trigger->type === VoiceCampaignTrigger::TYPE_NEW_POLICY && isset($entity['client_id'])) {
            try {
                $cliente = \App\Models\Cliente::find($entity['client_id']);
                if ($cliente) {
                    $name = trim(($cliente->first_name ?? '') . ' ' . ($cliente->last_name ?? ''));
                    $email = $cliente->email ?? $cliente->email_principal ?? null;
                    $phone = $resolvedPhone ?: ($cliente->mobile_phone ?? $cliente->phone ?? $cliente->celular_principal ?? null);
                    
                    return [
                        'name'  => $name ?: 'Cliente',
                        'email' => $email,
                        'phone' => $phone,
                        'custom_data' => [
                            'policy_number' => $entity['policy_number'] ?? $entity['numero_poliza'] ?? null,
                            'insurance_company' => $entity['insurance_company'] ?? $entity['aseguradora'] ?? null,
                            'premium_amount' => $entity['premium_amount'] ?? $entity['prima'] ?? null,
                            'start_date' => $entity['start_date'] ?? $entity['fecha_inicio'] ?? null,
                            'end_date' => $entity['end_date'] ?? $entity['fecha_vencimiento'] ?? null,
                        ],
                    ];
                }
            } catch (\Throwable $e) {
                \Log::warning('⚠️ [TRIGGER] No se pudo cargar cliente de póliza', ['client_id' => $entity['client_id']]);
            }
        }

        // Fallback para otros tipos o si no se pudo cargar el cliente
        $name = $entity['name'] ?? $entity['nombre'] ?? (($entity['first_name'] ?? '') . ' ' . ($entity['last_name'] ?? $entity['apellidos'] ?? ''));
        $email = $entity['email'] ?? $entity['email_principal'] ?? null;

        $contact = [
            'name'  => $name ? trim((string)$name) : 'Cliente',
            'email' => $email,
            'phone' => $resolvedPhone ?: ($entity['phone'] ?? $entity['mobile_phone'] ?? $entity['celular_principal'] ?? null),
            'custom_data' => [],
        ];

        // variables personalizadas (se envían como custom_data.*)
        $vars = is_array($trigger->mapping) ? ($trigger->mapping['variables'] ?? []) : [];
        if (is_array($vars)) {
            foreach ($vars as $key => $cfg) {
                // cfg puede ser string (path) o array ['path'=>'foo.bar','default'=>...]
                $path = is_array($cfg) ? ($cfg['path'] ?? $key) : (string)$cfg;
                $default = is_array($cfg) ? ($cfg['default'] ?? null) : null;
                $value = data_get($entity, $path, $default);
                $contact['custom_data'][$key] = $value;
            }
        }

        // Campos comunes para campañas
        // Intentar mapear policy_number, company_name, payment_due_date si existen en la entidad
        $contact['policy_number'] = $entity['policy_number'] ?? data_get($entity, 'poliza.policy_number');
        $contact['company_name'] = $entity['company_name'] ?? data_get($entity, 'aseguradora') ?? data_get($entity, 'poliza.insurance_company');
        $contact['payment_due_date'] = $entity['payment_due_date'] ?? $entity['fecha_vencimiento'] ?? $entity['end_date'] ?? null;
        $contact['debt_amount'] = data_get($entity, 'debt_amount') ?? data_get($entity, 'saldo') ?? null;

        return $contact;
    }

    protected function resolvePhoneFromEntity(VoiceCampaignTrigger $trigger, array $entity): ?string
    {
        $phoneField = $trigger->getPhoneField(); // ej: 'client.mobile_phone', 'celular_principal'
        $altField   = $trigger->getAltPhoneField();

        // Si el phoneField tiene formato "client.mobile_phone", cargar el cliente
        if (str_starts_with($phoneField, 'client.')) {
            $clientField = substr($phoneField, 7); // Quitar "client."
            $clientId = $entity['client_id'] ?? null;

            // Caso: entidad es el propio Cliente (new_client). Usa el campo directamente si existe.
            if (array_key_exists($clientField, $entity) && !empty($entity[$clientField])) {
                return $this->formatPhoneNumber((string)$entity[$clientField]);
            }
            
            if ($clientId) {
                try {
                    $cliente = \App\Models\Cliente::find($clientId);
                    if ($cliente) {
                        $raw = $cliente->{$clientField} ?? null;
                        if ($raw) {
                            return $this->formatPhoneNumber((string)$raw);
                        }
                    }
                } catch (\Throwable $e) {
                    \Log::warning('⚠️ [TRIGGER] Error cargando teléfono del cliente', [
                        'client_id' => $clientId,
                        'field' => $clientField
                    ]);
                }
            }
        }

        // Intentar múltiples campos comunes como fallback
        $raw = data_get($entity, $phoneField)
            ?? ($altField ? data_get($entity, $altField) : null)
            ?? ($entity['phone'] ?? null)
            ?? ($entity['mobile_phone'] ?? null)
            ?? ($entity['celular_principal'] ?? null)
            ?? ($entity['telefono'] ?? null);
            
        $raw = is_string($raw) ? $raw : (is_numeric($raw) ? (string)$raw : null);

        if (!$raw) {
            return null;
        }
        return $this->formatPhoneNumber($raw);
    }

    // ===================================================
    // Dedupe & Quotas
    // ===================================================

    protected function computeDedupHash(int $brokerId, int $triggerId, string $type, string $entityType, string $entityId, ?string $phone): string
    {
        return hash('sha256', implode('|', [
            'broker' . $brokerId,
            'trigger' . $triggerId,
            $type,
            $entityType,
            $entityId,
            (string)$phone,
        ]));
    }

    protected function existsRecentDedup(string $hash, int $dedupDays): bool
    {
        $since = now()->subDays($dedupDays);
        return VoiceCampaignTriggerLog::query()
            ->where('dedup_hash', $hash)
            ->where('fired_at', '>=', $since)
            ->exists();
    }

    protected function hasRemainingQuota(VoiceCampaignTrigger $trigger, int $quota, \DateTimeInterface $now): bool
    {
        try {
            $tz = $trigger->getWindowTimezone();
            $start = Carbon::instance($now)->setTimezone($tz)->startOfDay()->setTimezone('UTC');
            $end   = Carbon::instance($now)->setTimezone($tz)->endOfDay()->setTimezone('UTC');

            $countToday = VoiceCampaignTriggerLog::query()
                ->where('trigger_id', $trigger->id)
                ->where('result', VoiceCampaignTriggerLog::RESULT_SUCCESS)
                ->whereBetween('fired_at', [$start, $end])
                ->count();

            return $countToday < $quota;
        } catch (\Throwable $e) {
            // En caso de error, no bloquear por cuota
            return true;
        }
    }

    // ===================================================
    // Guard global de llamadas recientes por teléfono
    // ===================================================

    protected function hasRecentCallForPhone(int $brokerId, string $phone, int $minutes = 5): bool
    {
        try {
            $since = now()->subMinutes(max(1, $minutes));
            $normalized = $this->formatPhoneNumber($phone);

            return VoiceCampaignCall::query()
                ->where('broker_id', $brokerId)
                ->where('recipient_phone', $normalized)
                ->where('created_at', '>=', $since)
                ->whereIn('status', [
                    VoiceCampaignCall::STATUS_PENDING,
                    VoiceCampaignCall::STATUS_INITIATED,
                    VoiceCampaignCall::STATUS_RINGING,
                    VoiceCampaignCall::STATUS_ANSWERED,
                    VoiceCampaignCall::STATUS_IN_PROGRESS,
                ])
                ->exists();
        } catch (\Throwable $e) {
            // En caso de error en el guard, no bloquear
            \Log::warning('⚠️ [TRIGGER] hasRecentCallForPhone fallback', ['error' => $e->getMessage()]);
            return false;
        }
    }

    // ===================================================
    // Guards globales adicionales
    // ===================================================

    /**
     * Verifica si ya hubo un log reciente para la misma entidad (tipo+ID) y tipo de trigger,
     * sin importar qué trigger específico fue, dentro de una ventana en minutos.
     * Útil para evitar múltiples llamadas cuando existen varios triggers del mismo tipo.
     */
    protected function hasRecentGlobalEvent(int $brokerId, string $entityType, string $entityId, string $type, int $minutes = 2): bool
    {
        try {
            $since = now()->subMinutes(max(1, $minutes));
            return DB::table('voice_campaign_trigger_logs as l')
                ->join('voice_campaign_triggers as t', 't.id', '=', 'l.trigger_id')
                ->where('l.broker_id', $brokerId)
                ->where('l.entity_type', $entityType)
                ->where('l.entity_id', $entityId)
                ->where('t.type', $type)
                ->where('l.fired_at', '>=', $since)
                ->exists();
        } catch (\Throwable $e) {
            return false;
        }
    }

    // ===================================================
    // Logging y utilidades comunes
    // ===================================================

    protected function logAndReturn(
        int $brokerId,
        VoiceCampaignTrigger $trigger,
        ?string $entityType,
        int|string|null $entityId,
        string $result,
        ?string $reason = null,
        ?int $callId = null,
        ?array $payload = null,
        ?string $dedupHash = null
    ): array {
        try {
            $log = VoiceCampaignTriggerLog::create([
                'broker_id' => $brokerId,
                'voice_campaign_id' => $trigger->voice_campaign_id,
                'trigger_id' => $trigger->id,
                'entity_type' => $entityType ?? 'unknown',
                'entity_id' => (string)($entityId ?? '0'),
                'dedup_hash' => $dedupHash,
                'fired_at' => now(),
                'result' => $result,
                'reason' => $reason,
                'voice_campaign_call_id' => $callId,
                'payload' => $payload,
            ]);

            if ($result === VoiceCampaignTriggerLog::RESULT_SUCCESS) {
                // actualizar last_fired_at del trigger
                $trigger->update(['last_fired_at' => now()]);
            }
        } catch (\Throwable $e) {
            Log::warning('⚠️ [TRIGGER LOG] No se pudo registrar log de trigger', [
                'trigger_id' => $trigger->id,
                'error' => $e->getMessage(),
            ]);
        }

        return [
            'success' => $result === VoiceCampaignTriggerLog::RESULT_SUCCESS,
            'result' => $result,
            'reason' => $reason,
            'voice_campaign_call_id' => $callId,
        ];
    }

    // =========================
    // Helpers utilitarios
    // =========================

    private function formatPhoneNumber(?string $phone): ?string
    {
        if (!$phone) return null;
        $p = preg_replace('/[^0-9+]/', '', $phone);

        if (substr($p, 0, 1) === '+') {
            return $p;
        }
        if (substr($p, 0, 2) === '57' && strlen($p) === 12) {
            return '+' . $p;
        }
        if (strlen($p) === 10 && substr($p, 0, 1) === '3') {
            return '+57' . $p;
        }
        return $p;
    }
}