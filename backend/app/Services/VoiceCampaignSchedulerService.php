<?php

namespace App\Services;

use App\Models\VoiceCampaign;
use App\Models\VoiceCampaignScheduledCall;
use App\Models\Poliza;
use App\Models\Cliente;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

/**
 * Servicio para programar llamadas automáticamente basándose en el objetivo de la campaña.
 * 
 * Flujo:
 * 1. Usuario crea campaña con objetivo (template_id)
 * 2. Este servicio busca clientes que aplican según el objetivo
 * 3. Crea registros en voice_campaign_scheduled_calls con fechas programadas
 * 4. Un job diario ejecuta las llamadas pendientes
 */
class VoiceCampaignSchedulerService
{
    /**
     * Programa llamadas para una campaña basándose en su objetivo.
     * 
     * @param VoiceCampaign $campaign
     * @param array $options Opciones adicionales:
     *   - days_before: array de días antes del vencimiento para llamar [7, 3, 1]
     *   - days_after: array de días después del vencimiento para llamar [1, 3]
     *   - limit: máximo de llamadas a programar
     * @return array Resultado con estadísticas
     */
    public function scheduleCallsForCampaign(VoiceCampaign $campaign, array $options = []): array
    {
        $templateId = $this->getTemplateIdFromCampaign($campaign);
        
        Log::info('📅 [SCHEDULER] Programando llamadas para campaña', [
            'campaign_id' => $campaign->id,
            'template_id' => $templateId,
            'broker_id' => $campaign->broker_id,
        ]);

        return match($templateId) {
            'payment_reminder' => $this->schedulePaymentReminderCalls($campaign, $options),
            'debt_collection' => $this->scheduleDebtCollectionCalls($campaign, $options),
            'policy_renewal' => $this->schedulePolicyRenewalCalls($campaign, $options),
            'welcome_onboarding' => $this->scheduleWelcomeCalls($campaign, $options),
            'lead_followup' => $this->scheduleLeadFollowupCalls($campaign, $options),
            default => $this->scheduleGenericCalls($campaign, $options),
        };
    }

    /**
     * Obtiene el template_id de la campaña desde settings o nombre.
     */
    protected function getTemplateIdFromCampaign(VoiceCampaign $campaign): string
    {
        // Buscar en settings
        $settings = $campaign->settings ?? [];
        if (isset($settings['template_id'])) {
            return $settings['template_id'];
        }
        
        // Inferir del nombre de la campaña
        $name = strtolower($campaign->name ?? '');
        if (str_contains($name, 'pago') || str_contains($name, 'cobranza')) {
            return 'payment_reminder';
        }
        if (str_contains($name, 'cartera') || str_contains($name, 'mora')) {
            return 'debt_collection';
        }
        if (str_contains($name, 'renovación') || str_contains($name, 'renewal')) {
            return 'policy_renewal';
        }
        if (str_contains($name, 'bienvenida') || str_contains($name, 'welcome')) {
            return 'welcome_onboarding';
        }
        
        return 'generic';
    }

    /**
     * RECORDATORIO DE PAGO DE SEGURO
     * 
     * Busca pólizas activas y calcula la próxima fecha de pago según:
     * - Fecha de inicio de la póliza
     * - Periodicidad del pago (mensual, trimestral, semestral, anual)
     * - Pagos ya realizados en el módulo de cartera
     * - Días antes/después configurados en la campaña
     */
    protected function schedulePaymentReminderCalls(VoiceCampaign $campaign, array $options): array
    {
        $brokerId = $campaign->broker_id;
        $today = Carbon::today();
        
        // Obtener días antes/después de la configuración de la campaña o usar defaults
        $settings = $campaign->settings ?? [];
        $triggers = $settings['triggers'] ?? [];
        
        // Parsear días desde CSV o usar defaults
        $daysBefore = $this->parseDaysFromConfig($options['days_before'] ?? $triggers['days_before'] ?? '7,3,1,0');
        $daysAfter = $this->parseDaysFromConfig($options['days_after'] ?? $triggers['days_after'] ?? '1,3,5');
        $limit = $options['limit'] ?? 500;
        
        $scheduled = 0;
        $skipped = 0;
        $errors = [];

        Log::info('📅 [SCHEDULER] Iniciando programación de llamadas de cobranza', [
            'campaign_id' => $campaign->id,
            'broker_id' => $brokerId,
            'days_before' => $daysBefore,
            'days_after' => $daysAfter,
        ]);

        // Buscar pólizas activas con cliente y teléfono
        $polizas = Poliza::query()
            ->where('broker_id', $brokerId)
            ->where('status', 'active')
            ->whereNotNull('client_id')
            ->whereNotNull('start_date')
            ->with(['client' => function($q) {
                $q->whereNotNull('mobile_phone');
            }])
            ->limit($limit)
            ->get();

        Log::info('📅 [SCHEDULER] Pólizas activas encontradas', [
            'campaign_id' => $campaign->id,
            'polizas_count' => $polizas->count(),
        ]);

        foreach ($polizas as $poliza) {
            if (!$poliza->client || !$poliza->client->mobile_phone) {
                $skipped++;
                continue;
            }

            // Calcular la próxima fecha de pago según periodicidad
            $nextPaymentDate = $this->calculateNextPaymentDate($poliza, $today);
            
            if (!$nextPaymentDate) {
                $skipped++;
                continue;
            }

            // Verificar si ya se realizó el pago para este período
            if ($this->hasPaymentForPeriod($poliza, $nextPaymentDate)) {
                $skipped++;
                continue;
            }

            $daysUntilDue = $today->diffInDays($nextPaymentDate, false);

            // Determinar si debemos programar llamada y para qué fecha
            $scheduledDate = null;
            $reason = null;

            if ($daysUntilDue > 0) {
                // Pago aún no vence - verificar si está en rango de días antes
                foreach ($daysBefore as $daysBef) {
                    if ($daysUntilDue <= $daysBef) {
                        $scheduledDate = $today;
                        $reason = "payment_due_{$daysUntilDue}_days";
                        break;
                    }
                }
            } elseif ($daysUntilDue == 0) {
                // Vence hoy
                $scheduledDate = $today;
                $reason = 'payment_due_today';
            } else {
                // Ya venció - verificar si está en rango de días después
                $daysOverdue = abs($daysUntilDue);
                $maxDaysAfter = !empty($daysAfter) ? max($daysAfter) : 5;
                
                if ($daysOverdue <= $maxDaysAfter) {
                    $scheduledDate = $today;
                    $reason = "payment_overdue_{$daysOverdue}_days";
                }
            }

            if (!$scheduledDate) {
                $skipped++;
                continue;
            }

            // Verificar si ya existe una llamada programada para este cliente en esta campaña
            $exists = VoiceCampaignScheduledCall::query()
                ->where('voice_campaign_id', $campaign->id)
                ->where('client_id', $poliza->client_id)
                ->whereDate('scheduled_date', $scheduledDate)
                ->exists();

            if ($exists) {
                $skipped++;
                continue;
            }

            try {
                // Crear llamada programada
                VoiceCampaignScheduledCall::create([
                    'voice_campaign_id' => $campaign->id,
                    'broker_id' => $brokerId,
                    'client_id' => $poliza->client_id,
                    'poliza_id' => $poliza->id,
                    'scheduled_date' => $scheduledDate,
                    'scheduled_time' => $this->generateRandomScheduledTime(),
                    'reason' => $reason,
                    'status' => VoiceCampaignScheduledCall::STATUS_PENDING,
                    'priority' => $this->calculatePriority($daysUntilDue),
                    'contact_data' => [
                        'name' => trim("{$poliza->client->first_name} {$poliza->client->last_name}"),
                        'phone' => $poliza->client->mobile_phone,
                        'customer_name' => trim("{$poliza->client->first_name} {$poliza->client->last_name}"),
                        'policy_number' => $poliza->policy_number,
                        'plate_number' => $this->getCleanPlate($poliza),
                        'policy_type' => $this->getPolicyTypeName($poliza),
                        'insurance_company' => $poliza->insurance_company ?? '',
                        'issue_date' => $poliza->issue_date ? Carbon::parse($poliza->issue_date)->format('Y-m-d') : '',
                        'end_date' => $poliza->end_date ? Carbon::parse($poliza->end_date)->format('Y-m-d') : '',
                        'debt_amount' => $poliza->premium_amount,
                        'payment_due_date' => $nextPaymentDate->format('Y-m-d'),
                        'company_name' => $campaign->broker?->name ?? 'Tu agencia de seguros',
                    ],
                ]);
                $scheduled++;
            } catch (\Exception $e) {
                $errors[] = "Póliza {$poliza->id}: {$e->getMessage()}";
                Log::error('❌ [SCHEDULER] Error programando llamada', [
                    'poliza_id' => $poliza->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Actualizar estadísticas de la campaña
        $campaign->update([
            'total_targets' => $scheduled,
            'status' => $scheduled > 0 ? VoiceCampaign::STATUS_ACTIVE : VoiceCampaign::STATUS_DRAFT,
        ]);

        Log::info('✅ [SCHEDULER] Llamadas programadas para recordatorio de pago', [
            'campaign_id' => $campaign->id,
            'scheduled' => $scheduled,
            'skipped' => $skipped,
            'errors' => count($errors),
        ]);

        return [
            'success' => true,
            'scheduled' => $scheduled,
            'skipped' => $skipped,
            'errors' => $errors,
            'message' => "Se programaron {$scheduled} llamadas para recordatorio de pago",
        ];
    }

    /**
     * Calcula prioridad basada en urgencia (días hasta vencimiento)
     */
    protected function calculatePriority(int $daysUntilDue): int
    {
        if ($daysUntilDue < 0) {
            // Ya vencido - máxima prioridad
            return 1;
        } elseif ($daysUntilDue == 0) {
            // Vence hoy
            return 2;
        } elseif ($daysUntilDue <= 3) {
            return 3;
        } elseif ($daysUntilDue <= 7) {
            return 5;
        } else {
            return 7;
        }
    }

    /**
     * Obtiene la placa del vehículo de la póliza
     */
    protected function getPlateFromPoliza(Poliza $poliza): string
    {
        $plates = $poliza->vehicle_plates;
        if (is_array($plates) && count($plates) > 0) {
            return $plates[0];
        }
        if (is_string($plates)) {
            $decoded = json_decode($plates, true);
            if (is_array($decoded) && count($decoded) > 0) {
                return $decoded[0];
            }
        }
        return 'N/A';
    }

    /**
     * RECUPERACIÓN DE CARTERA (deuda vencida)
     */
    protected function scheduleDebtCollectionCalls(VoiceCampaign $campaign, array $options): array
    {
        // Similar a payment_reminder pero solo para pólizas con payment_status = 'overdue'
        // y con más de X días de mora
        $options['days_before'] = []; // No llamar antes del vencimiento
        $options['days_after'] = $options['days_after'] ?? [1, 3, 7, 15, 30];
        
        return $this->schedulePaymentReminderCalls($campaign, $options);
    }

    /**
     * RENOVACIÓN DE PÓLIZAS
     * 
     * Busca pólizas que:
     * - Venzan en los próximos X días (before_days como rango)
     * - Hayan vencido hace Y días o menos (after_days como rango)
     */
    protected function schedulePolicyRenewalCalls(VoiceCampaign $campaign, array $options): array
    {
        $brokerId = $campaign->broker_id;
        $limit = $options['limit'] ?? 500;
        $today = Carbon::today();
        
        // Obtener rangos de días desde la configuración de la campaña
        $settings = $campaign->settings ?? [];
        $triggers = $settings['triggers'] ?? [];
        $expiry = $triggers['expiry'] ?? [];
        
        // Rangos: before_days = pólizas que venzan en los próximos 0 a X días
        //         after_days = pólizas vencidas hace 0 a Y días
        $daysBeforeRange = (int) ($expiry['before_days'] ?? $options['days_before'] ?? 30);
        $daysAfterRange = (int) ($expiry['after_days'] ?? $options['days_after'] ?? 7);
        
        Log::info('📅 [SCHEDULER] Buscando pólizas para renovación', [
            'campaign_id' => $campaign->id,
            'days_before_range' => $daysBeforeRange,
            'days_after_range' => $daysAfterRange,
        ]);
        
        $scheduled = 0;
        $skipped = 0;
        $errors = [];

        // Buscar pólizas próximas a vencer (en los próximos X días)
        if ($daysBeforeRange > 0) {
            $polizasProximas = Poliza::query()
                ->where('broker_id', $brokerId)
                ->where('status', 'active')
                ->whereNotNull('end_date')
                ->whereDate('end_date', '>=', $today)
                ->whereDate('end_date', '<=', $today->copy()->addDays($daysBeforeRange))
                ->whereNotNull('client_id')
                ->with(['client', 'ramo'])
                ->limit($limit)
                ->get();

            foreach ($polizasProximas as $poliza) {
                $result = $this->scheduleRenewalCall($campaign, $poliza, $today, 'próxima a vencer');
                if ($result === true) {
                    $scheduled++;
                } elseif ($result === false) {
                    $skipped++;
                } else {
                    $errors[] = $result;
                }
            }
        }

        // Buscar pólizas ya vencidas (hace Y días o menos)
        if ($daysAfterRange > 0) {
            $polizasVencidas = Poliza::query()
                ->where('broker_id', $brokerId)
                ->whereIn('status', ['active', 'expired', 'pending_renewal'])
                ->whereNotNull('end_date')
                ->whereDate('end_date', '<', $today)
                ->whereDate('end_date', '>=', $today->copy()->subDays($daysAfterRange))
                ->whereNotNull('client_id')
                ->with(['client', 'ramo'])
                ->limit($limit)
                ->get();

            foreach ($polizasVencidas as $poliza) {
                $result = $this->scheduleRenewalCall($campaign, $poliza, $today, 'vencida');
                if ($result === true) {
                    $scheduled++;
                } elseif ($result === false) {
                    $skipped++;
                } else {
                    $errors[] = $result;
                }
            }
        }

        // También incluir pólizas que vencen hoy
        $polizasHoy = Poliza::query()
            ->where('broker_id', $brokerId)
            ->where('status', 'active')
            ->whereNotNull('end_date')
            ->whereDate('end_date', $today)
            ->whereNotNull('client_id')
            ->with(['client', 'ramo'])
            ->limit($limit)
            ->get();

        foreach ($polizasHoy as $poliza) {
            $result = $this->scheduleRenewalCall($campaign, $poliza, $today, 'vence hoy');
            if ($result === true) {
                $scheduled++;
            } elseif ($result === false) {
                $skipped++;
            } else {
                $errors[] = $result;
            }
        }

        $campaign->update([
            'total_targets' => $scheduled,
            'status' => $scheduled > 0 ? VoiceCampaign::STATUS_ACTIVE : $campaign->status,
        ]);

        Log::info('✅ [SCHEDULER] Llamadas programadas para renovación', [
            'campaign_id' => $campaign->id,
            'scheduled' => $scheduled,
            'skipped' => $skipped,
            'errors' => count($errors),
        ]);

        return [
            'success' => true,
            'scheduled' => $scheduled,
            'skipped' => $skipped,
            'errors' => $errors,
            'message' => "Se programaron {$scheduled} llamadas para renovación de pólizas",
        ];
    }

    /**
     * Programa una llamada de renovación para una póliza específica
     */
    protected function scheduleRenewalCall(VoiceCampaign $campaign, Poliza $poliza, Carbon $today, string $reason): bool|string
    {
        // Verificar que tenga cliente con teléfono
        if (!$poliza->client) {
            return false;
        }
        
        $phone = $poliza->client->mobile_phone ?? $poliza->client->phone ?? $poliza->client->celular_principal ?? null;
        if (!$phone) {
            return false;
        }

        // Verificar que no exista ya una llamada programada para este cliente en esta fecha
        // El constraint único es: campaign_id + client_id + scheduled_date
        $exists = VoiceCampaignScheduledCall::query()
            ->where('voice_campaign_id', $campaign->id)
            ->where('client_id', $poliza->client_id)
            ->whereDate('scheduled_date', $today)
            ->exists();

        if ($exists) {
            return false;
        }

        try {
            $endDate = Carbon::parse($poliza->end_date);
            $daysUntilExpiry = $today->diffInDays($endDate, false);
            
            $clientName = trim(($poliza->client->first_name ?? '') . ' ' . ($poliza->client->last_name ?? ''));
            if (empty($clientName)) {
                $clientName = $poliza->client->nombres ?? $poliza->client_name ?? 'Cliente';
            }

            VoiceCampaignScheduledCall::create([
                'voice_campaign_id' => $campaign->id,
                'broker_id' => $campaign->broker_id,
                'client_id' => $poliza->client_id,
                'poliza_id' => $poliza->id,
                'scheduled_date' => $today,
                'scheduled_time' => $this->generateRandomScheduledTime(),
                'reason' => VoiceCampaignScheduledCall::REASON_POLICY_EXPIRY,
                'status' => VoiceCampaignScheduledCall::STATUS_PENDING,
                'priority' => $this->calculatePriority($daysUntilExpiry),
                'contact_data' => [
                    'name' => $clientName,
                    'phone' => $phone,
                    'customer_name' => $clientName,
                    'client_id' => $poliza->client_id,
                    'poliza_id' => $poliza->id,
                    'policy_number' => $poliza->policy_number,
                    'policy_type' => $poliza->ramo?->nombre ?? $poliza->product_name ?? 'Seguro',
                    'plate_number' => $this->getCleanPlate($poliza),
                    'insurance_company' => $poliza->insurance_company ?? '',
                    'end_date' => $endDate->format('d/m/Y'),
                    'expiry_date' => $endDate->format('d/m/Y'),
                    'days_until_expiry' => $daysUntilExpiry,
                    'renewal_reason' => $reason,
                    'years_as_client' => $poliza->client->created_at 
                        ? $poliza->client->created_at->diffInYears(now()) 
                        : 1,
                    'company_name' => $campaign->broker?->name ?? 'Tu agencia de seguros',
                ],
            ]);

            return true;
        } catch (\Exception $e) {
            Log::error('❌ [SCHEDULER] Error programando llamada de renovación', [
                'poliza_id' => $poliza->id,
                'error' => $e->getMessage(),
            ]);
            return "Póliza {$poliza->id}: {$e->getMessage()}";
        }
    }

    /**
     * REFRESCAR LLAMADAS PROGRAMADAS
     * 
     * Busca nuevas pólizas/clientes que ahora aplican para la campaña
     * y las agrega a las llamadas programadas. Útil para tracking continuo.
     */
    public function refreshScheduledCalls(VoiceCampaign $campaign): array
    {
        $templateId = $this->getTemplateIdFromCampaign($campaign);
        
        Log::info('🔄 [SCHEDULER] Refrescando llamadas para campaña', [
            'campaign_id' => $campaign->id,
            'template_id' => $templateId,
        ]);

        // Reutilizar la lógica existente - el método scheduleRenewalCall ya verifica duplicados
        return match($templateId) {
            'payment_reminder' => $this->schedulePaymentReminderCalls($campaign, []),
            'debt_collection' => $this->scheduleDebtCollectionCalls($campaign, []),
            'policy_renewal' => $this->schedulePolicyRenewalCalls($campaign, []),
            'welcome_onboarding' => $this->scheduleWelcomeCalls($campaign, []),
            'lead_followup' => $this->scheduleLeadFollowupCalls($campaign, []),
            default => ['success' => true, 'scheduled' => 0, 'message' => 'Tipo de campaña no soporta refresh'],
        };
    }

    /**
     * REFRESCAR TODAS LAS CAMPAÑAS ACTIVAS
     * 
     * Método para ser llamado por un cron job diario
     */
    public function refreshAllActiveCampaigns(): array
    {
        $results = [];
        
        $campaigns = VoiceCampaign::where('status', VoiceCampaign::STATUS_ACTIVE)
            ->orWhere('status', VoiceCampaign::STATUS_SCHEDULED)
            ->get();

        Log::info('🔄 [SCHEDULER] Refrescando todas las campañas activas', [
            'total_campaigns' => $campaigns->count(),
        ]);

        foreach ($campaigns as $campaign) {
            try {
                $result = $this->refreshScheduledCalls($campaign);
                $results[$campaign->id] = [
                    'name' => $campaign->name,
                    'scheduled' => $result['scheduled'] ?? 0,
                    'success' => $result['success'] ?? false,
                ];
            } catch (\Throwable $e) {
                $results[$campaign->id] = [
                    'name' => $campaign->name,
                    'error' => $e->getMessage(),
                    'success' => false,
                ];
            }
        }

        return $results;
    }

    /**
     * BIENVENIDA A NUEVOS CLIENTES
     */
    protected function scheduleWelcomeCalls(VoiceCampaign $campaign, array $options): array
    {
        $brokerId = $campaign->broker_id;
        $daysAfterCreation = $options['days_after_creation'] ?? 1;
        $limit = $options['limit'] ?? 100;
        $today = Carbon::today();
        
        $scheduled = 0;

        // Buscar clientes creados recientemente
        $clientes = Cliente::query()
            ->where('broker_id', $brokerId)
            ->whereDate('created_at', $today->copy()->subDays($daysAfterCreation))
            ->whereNotNull('mobile_phone')
            ->limit($limit)
            ->get();

        foreach ($clientes as $cliente) {
            $exists = VoiceCampaignScheduledCall::query()
                ->where('voice_campaign_id', $campaign->id)
                ->where('client_id', $cliente->id)
                ->exists();

            if (!$exists) {
                VoiceCampaignScheduledCall::create([
                    'voice_campaign_id' => $campaign->id,
                    'broker_id' => $brokerId,
                    'client_id' => $cliente->id,
                    'scheduled_date' => $today,
                    'scheduled_time' => $this->generateRandomScheduledTime(),
                    'reason' => VoiceCampaignScheduledCall::REASON_NEW_CLIENT,
                    'status' => VoiceCampaignScheduledCall::STATUS_PENDING,
                    'priority' => 5,
                    'contact_data' => [
                        'name' => trim("{$cliente->first_name} {$cliente->last_name}"),
                        'phone' => $cliente->mobile_phone,
                        'customer_name' => trim("{$cliente->first_name} {$cliente->last_name}"),
                        'company_name' => $campaign->broker?->name ?? 'Tu agencia de seguros',
                    ],
                ]);
                $scheduled++;
            }
        }

        $campaign->update(['total_targets' => $scheduled]);

        return [
            'success' => true,
            'scheduled' => $scheduled,
            'message' => "Se programaron {$scheduled} llamadas de bienvenida",
        ];
    }

    /**
     * SEGUIMIENTO DE LEADS
     */
    protected function scheduleLeadFollowupCalls(VoiceCampaign $campaign, array $options): array
    {
        // TODO: Implementar cuando exista modelo de Leads
        return [
            'success' => true,
            'scheduled' => 0,
            'message' => 'Seguimiento de leads no implementado aún',
        ];
    }

    /**
     * LLAMADAS GENÉRICAS (manual)
     */
    protected function scheduleGenericCalls(VoiceCampaign $campaign, array $options): array
    {
        // Para campañas sin objetivo específico, usar los contactos manuales
        $contacts = $campaign->contacts ?? [];
        $scheduled = 0;
        $today = Carbon::today();

        foreach ($contacts as $contact) {
            if (empty($contact['phone'])) continue;

            VoiceCampaignScheduledCall::create([
                'voice_campaign_id' => $campaign->id,
                'broker_id' => $campaign->broker_id,
                'scheduled_date' => $today,
                'scheduled_time' => $this->generateRandomScheduledTime(),
                'reason' => VoiceCampaignScheduledCall::REASON_MANUAL,
                'status' => VoiceCampaignScheduledCall::STATUS_PENDING,
                'priority' => 5,
                'contact_data' => $contact,
            ]);
            $scheduled++;
        }

        $campaign->update(['total_targets' => $scheduled]);

        return [
            'success' => true,
            'scheduled' => $scheduled,
            'message' => "Se programaron {$scheduled} llamadas manuales",
        ];
    }

    /**
     * Obtiene las llamadas programadas para una campaña.
     */
    public function getScheduledCalls(VoiceCampaign $campaign, array $filters = []): array
    {
        $query = VoiceCampaignScheduledCall::query()
            ->where('voice_campaign_id', $campaign->id)
            ->with(['client', 'poliza', 'call']);

        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (isset($filters['date'])) {
            $query->whereDate('scheduled_date', $filters['date']);
        }

        if (isset($filters['from_date'])) {
            $query->whereDate('scheduled_date', '>=', $filters['from_date']);
        }

        if (isset($filters['to_date'])) {
            $query->whereDate('scheduled_date', '<=', $filters['to_date']);
        }

        $calls = $query->orderBy('scheduled_date', 'asc')
            ->orderBy('priority', 'asc')
            ->get();

        return [
            'total' => $calls->count(),
            'pending' => $calls->where('status', VoiceCampaignScheduledCall::STATUS_PENDING)->count(),
            'completed' => $calls->where('status', VoiceCampaignScheduledCall::STATUS_COMPLETED)->count(),
            'failed' => $calls->where('status', VoiceCampaignScheduledCall::STATUS_FAILED)->count(),
            'calls' => $calls->map(function($call) {
                $contactData = is_array($call->contact_data) ? $call->contact_data : [];
                return [
                    'id' => $call->id,
                    'client_name' => $call->client_name,
                    'client_phone' => $call->client_phone,
                    'scheduled_date' => $call->scheduled_date->format('Y-m-d'),
                    'scheduled_time' => $call->scheduled_time?->format('H:i'),
                    'reason' => $call->reason,
                    'reason_description' => $call->reason_description,
                    'status' => $call->status,
                    'status_description' => $call->status_description,
                    'status_reason' => $call->status_reason,
                    'priority' => $call->priority,
                    'poliza_number' => $call->poliza?->policy_number ?? ($contactData['policy_number'] ?? null),
                    'called_at' => $call->called_at?->format('Y-m-d H:i:s'),
                    'contact_data' => [
                        'policy_number' => $contactData['policy_number'] ?? $call->poliza?->policy_number ?? null,
                        'policy_type' => $contactData['policy_type'] ?? $call->poliza?->product_name ?? $call->poliza?->type ?? null,
                        'plate_number' => $contactData['plate_number'] ?? $call->poliza?->vehicle_plates ?? null,
                        'insurance_company' => $contactData['insurance_company'] ?? $call->poliza?->insurance_company ?? null,
                        'debt_amount' => $contactData['debt_amount'] ?? $call->poliza?->premium_amount ?? null,
                        'payment_due_date' => $contactData['payment_due_date'] ?? null,
                    ],
                ];
            })->toArray(),
        ];
    }

    /**
     * Parsea días desde configuración (puede ser CSV string o array)
     */
    protected function parseDaysFromConfig($config): array
    {
        if (is_array($config)) {
            return array_map('intval', $config);
        }
        if (is_string($config) && !empty($config)) {
            return array_map('intval', array_filter(explode(',', $config)));
        }
        return [];
    }

    /**
     * Calcula la próxima fecha de pago según la periodicidad de la póliza
     * 
     * @param Poliza $poliza
     * @param Carbon $referenceDate Fecha de referencia (normalmente hoy)
     * @return Carbon|null
     */
    protected function calculateNextPaymentDate(Poliza $poliza, Carbon $referenceDate): ?Carbon
    {
        // Si tiene payment_due_date explícito, usarlo
        if ($poliza->payment_due_date) {
            return Carbon::parse($poliza->payment_due_date);
        }

        // Necesitamos fecha de inicio para calcular
        if (!$poliza->start_date) {
            return null;
        }

        $startDate = Carbon::parse($poliza->start_date);
        $endDate = $poliza->end_date ? Carbon::parse($poliza->end_date) : null;
        
        // Si la póliza ya venció, no programar
        if ($endDate && $referenceDate->gt($endDate)) {
            return null;
        }

        // Determinar periodicidad (mensual, trimestral, semestral, anual)
        $frequency = strtolower($poliza->payment_frequency ?? 'annual');
        
        // Mapeo de periodicidad a meses
        $monthsMap = [
            'monthly' => 1,
            'mensual' => 1,
            'quarterly' => 3,
            'trimestral' => 3,
            'biannual' => 6,
            'semestral' => 6,
            'semiannual' => 6,
            'annual' => 12,
            'anual' => 12,
            'yearly' => 12,
        ];

        $monthsInterval = $monthsMap[$frequency] ?? 12;

        // Calcular todas las fechas de pago desde el inicio hasta ahora + 30 días
        $paymentDate = $startDate->copy();
        $maxDate = $referenceDate->copy()->addDays(30);

        while ($paymentDate->lt($referenceDate->copy()->subDays(30))) {
            $paymentDate->addMonths($monthsInterval);
        }

        // Encontrar la próxima fecha de pago que esté en el rango relevante
        while ($paymentDate->lt($maxDate)) {
            // Si la fecha de pago está dentro del rango de interés, retornarla
            if ($paymentDate->gte($referenceDate->copy()->subDays(30))) {
                return $paymentDate;
            }
            $paymentDate->addMonths($monthsInterval);
        }

        return $paymentDate;
    }

    /**
     * Verifica si ya existe un pago registrado para el período de la póliza
     * 
     * @param Poliza $poliza
     * @param Carbon $paymentDate Fecha de pago esperada
     * @return bool
     */
    protected function hasPaymentForPeriod(Poliza $poliza, Carbon $paymentDate): bool
    {
        // Buscar pagos en el módulo de cartera para esta póliza
        // en un rango de +/- 15 días de la fecha de pago esperada
        $startRange = $paymentDate->copy()->subDays(15);
        $endRange = $paymentDate->copy()->addDays(15);

        $payment = \App\Models\PagoPoliza::query()
            ->where('poliza_id', $poliza->id)
            ->where('estado', 'pagado')
            ->whereBetween('fecha_pago', [$startRange, $endRange])
            ->first();

        if ($payment) {
            Log::debug('💰 [SCHEDULER] Pago encontrado para póliza', [
                'poliza_id' => $poliza->id,
                'payment_id' => $payment->id,
                'fecha_pago' => $payment->fecha_pago,
            ]);
            return true;
        }

        return false;
    }

    /**
     * Genera una hora aleatoria dentro de la ventana de llamadas permitida (8am-8pm Colombia)
     * Distribuye las llamadas de forma uniforme para evitar picos
     */
    private function generateRandomScheduledTime(): string
    {
        // Ventana de llamadas: 8:00 AM a 8:00 PM (12 horas)
        $startHour = 8;
        $endHour = 20;
        
        // Generar hora aleatoria
        $hour = rand($startHour, $endHour - 1);
        $minute = rand(0, 59);
        
        return sprintf('%02d:%02d:00', $hour, $minute);
    }

    /**
     * Obtener placa limpia de la póliza (sin valores inválidos)
     */
    private function getCleanPlate($poliza): string
    {
        $plate = $this->getPlateFromPoliza($poliza);
        
        // Si es null, 'null', vacío o solo espacios, retornar vacío
        if (empty($plate) || strtolower(trim($plate)) === 'null') {
            return '';
        }
        
        return trim($plate);
    }

    /**
     * Obtener nombre del tipo de póliza (usar product_name si existe, sino type)
     */
    private function getPolicyTypeName($poliza): string
    {
        // Prioridad: product_name > type
        $productName = $poliza->product_name ?? '';
        $type = $poliza->type ?? '';
        
        // Si product_name existe y no es vacío, usarlo
        if (!empty($productName) && strtolower($productName) !== 'otros') {
            return $productName;
        }
        
        // Si type existe y no es 'otros', usarlo
        if (!empty($type) && strtolower($type) !== 'otros') {
            return $type;
        }
        
        // Si no hay nada válido, retornar vacío (el frontend mostrará "tu póliza")
        return '';
    }
}
