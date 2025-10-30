<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\PolicyNotificationConfig;
use App\Models\PolicyNotificationLog;
use App\Models\Poliza;
use App\Models\Cliente;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Carbon\Carbon;

class SendPolicyNotifications extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'policy:send-notifications
                            {--broker= : ID del broker específico}
                            {--type= : Tipo de notificación (expiration|renewal|payment_due)}
                            {--dry-run : Simular sin enviar}
                            {--force : Forzar envío ignorando horarios}
                            {--reset-today : Eliminar logs de hoy para permitir reenvío}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Enviar notificaciones automáticas de WhatsApp para pólizas (vencimientos, renovaciones, pagos)';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('🔔 Iniciando envío de notificaciones de pólizas...');
        
        $brokerId = $this->option('broker');
        $notificationType = $this->option('type');
        $dryRun = $this->option('dry-run');
        $force = $this->option('force');
        $resetToday = $this->option('reset-today');

        // Resetear logs de hoy si se solicita
        if ($resetToday) {
            $query = PolicyNotificationLog::where('created_at', '>=', now()->startOfDay());
            
            if ($brokerId) {
                $query->where('broker_id', $brokerId);
            }
            
            $deleted = $query->delete();
            $this->warn("🗑️  Eliminados {$deleted} logs de hoy para permitir reenvío");
        }

        // Obtener configuraciones activas
        $query = PolicyNotificationConfig::active()->with('broker', 'whatsappInstance');

        if ($brokerId) {
            $query->where('broker_id', $brokerId);
        }

        $configs = $query->get();

        if ($configs->isEmpty()) {
            $this->warn('⚠️  No hay configuraciones activas de notificaciones');
            return 0;
        }

        $this->info("📋 Encontradas {$configs->count()} configuraciones activas");

        $totalSent = 0;
        $totalFailed = 0;
        $totalSkipped = 0;

        foreach ($configs as $config) {
            $this->line('');
            $this->info("🏢 Procesando broker: {$config->broker->name} (ID: {$config->broker_id})");

            // Verificar día de la semana
            if (!$force) {
                $today = now()->dayOfWeek;
                $sendDays = $config->send_days ?? [1, 2, 3, 4, 5];
                
                if (!in_array($today, $sendDays)) {
                    $this->warn("⏭️  Saltando - No es día de envío (hoy: {$today}, permitidos: " . implode(',', $sendDays) . ")");
                    continue;
                }

                // Verificar que estamos en la misma hora configurada
                $currentHour = (int)now()->format('H');
                $sendHour = (int)substr($config->send_time, 0, 2);
                
                if ($currentHour !== $sendHour) {
                    $currentTime = now()->format('H:i');
                    $sendTime = substr($config->send_time, 0, 5);
                    $this->warn("⏭️  Saltando - No es la hora de envío (actual: {$currentTime}, configurada: {$sendTime})");
                    continue;
                }
                
                $this->info("✅ Hora correcta (hora actual: {$currentHour}, hora configurada: {$sendHour})");
            }

            // Verificar instancia de WhatsApp
            if (!$config->whatsappInstance) {
                $this->error("❌ No hay instancia de WhatsApp configurada");
                continue;
            }

            if (!$config->isWhatsAppConnected()) {
                $this->error("❌ Instancia de WhatsApp desconectada: {$config->whatsappInstance->instance_id}");
                continue;
            }

            $this->info("✅ Instancia WhatsApp conectada: {$config->whatsappInstance->instance_id}");

            // Procesar cada tipo de notificación
            $types = [];
            if (!$notificationType || $notificationType === 'expiration') {
                if ($config->notify_expiration) {
                    $types[] = 'expiration';
                }
            }
            if (!$notificationType || $notificationType === 'renewal') {
                if ($config->notify_renewal) {
                    $types[] = 'renewal';
                }
            }
            if (!$notificationType || $notificationType === 'payment_due') {
                if ($config->notify_payment_due) {
                    $types[] = 'payment_due';
                }
            }

            foreach ($types as $type) {
                $result = $this->processNotificationType($config, $type, $dryRun);
                $totalSent += $result['sent'];
                $totalFailed += $result['failed'];
                $totalSkipped += $result['skipped'];
            }

            // Actualizar próxima ejecución
            if (!$dryRun) {
                $config->calculateNextExecution();
            }
        }

        $this->line('');
        $this->info('📊 Resumen de ejecución:');
        $this->table(
            ['Métrica', 'Cantidad'],
            [
                ['Enviadas', $totalSent],
                ['Fallidas', $totalFailed],
                ['Omitidas', $totalSkipped],
                ['Total procesadas', $totalSent + $totalFailed + $totalSkipped],
            ]
        );

        return 0;
    }

    /**
     * Procesar un tipo específico de notificación
     */
    private function processNotificationType(PolicyNotificationConfig $config, string $type, bool $dryRun): array
    {
        $sent = 0;
        $failed = 0;
        $skipped = 0;

        $typeNames = [
            'expiration' => 'Vencimiento',
            'renewal' => 'Renovación',
            'payment_due' => 'Pago Pendiente',
        ];

        $this->line('');
        $this->info("📬 Procesando notificaciones de: {$typeNames[$type]}");

        // Obtener pólizas según el tipo
        $policies = $this->getPoliciesForNotification($config, $type);

        if ($policies->isEmpty()) {
            $this->warn("  ⏭️  No hay pólizas para notificar");
            return compact('sent', 'failed', 'skipped');
        }

        $this->info("  📋 Encontradas {$policies->count()} pólizas");

        // Limitar por max_notifications_per_day
        $maxPerDay = $config->max_notifications_per_day;
        $alreadySentToday = PolicyNotificationLog::forBroker($config->broker_id)
            ->where('created_at', '>=', now()->startOfDay())
            ->count();

        $remaining = max(0, $maxPerDay - $alreadySentToday);

        if ($remaining === 0) {
            $this->warn("  ⚠️  Límite diario alcanzado ({$maxPerDay} notificaciones)");
            return compact('sent', 'failed', 'skipped');
        }

        $this->info("  📊 Límite diario: {$alreadySentToday}/{$maxPerDay} (quedan {$remaining})");

        $policies = $policies->take($remaining);

        $progressBar = $this->output->createProgressBar($policies->count());
        $progressBar->start();

        foreach ($policies as $policy) {
            // Verificar exclusiones
            if ($this->shouldSkipPolicy($config, $policy)) {
                $this->newLine();
                $this->warn("  ⏭️  Póliza {$policy->policy_number} excluida (cliente/tipo/estado)");
                $skipped++;
                $progressBar->advance();
                continue;
            }

            // Verificar si ya se envió hoy
            $alreadySent = PolicyNotificationLog::where('poliza_id', $policy->id)
                ->where('notification_type', $type)
                ->where('created_at', '>=', now()->startOfDay())
                ->exists();

            if ($alreadySent) {
                $this->newLine();
                $this->warn("  ⏭️  Póliza {$policy->policy_number} ya notificada hoy");
                $skipped++;
                $progressBar->advance();
                continue;
            }

            // Obtener teléfonos del cliente
            $phones = $this->getClientPhones($config, $policy);

            if (empty($phones)) {
                $this->newLine();
                $this->warn("  ⚠️  Sin teléfonos para póliza {$policy->policy_number} (cliente: {$policy->client_id})");
                $skipped++;
                $progressBar->advance();
                continue;
            }

            // Generar mensaje
            $template = $config->getTemplate($type);
            $message = $config->processTemplate($template, $policy);

            // Enviar a cada teléfono
            foreach ($phones as $phone) {
                if ($dryRun) {
                    $this->newLine();
                    $this->line("  [DRY-RUN] Enviaría a {$phone}: " . substr($message, 0, 50) . "...");
                    $sent++;
                } else {
                    $result = $this->sendNotification($config, $policy, $phone, $message, $type);
                    
                    if ($result['success']) {
                        $sent++;
                    } else {
                        $failed++;
                    }
                }
            }

            $progressBar->advance();
        }

        $progressBar->finish();
        $this->newLine();

        return compact('sent', 'failed', 'skipped');
    }

    /**
     * Obtener pólizas para notificar según el tipo
     */
    private function getPoliciesForNotification(PolicyNotificationConfig $config, string $type)
    {
        // Obtener todos los días de anticipación configurados
        $daysArray = $config->getDaysBeforeForType($type);
        
        $this->line("  🔍 Días de anticipación configurados: " . implode(', ', $daysArray));
        
        $uniquePolicyIds = [];
        $allPolicies = [];
        
        foreach ($daysArray as $days) {
            $query = Poliza::forBroker($config->broker_id)
                ->whereIn('status', ['active', 'issued', 'accrued'])
                ->with('client');

            $targetDate = now()->addDays($days)->startOfDay();

            switch ($type) {
                case 'expiration':
                    $query->whereNotNull('end_date')
                        ->whereDate('end_date', '=', $targetDate);
                    
                    $this->line("  🔍 Buscando pólizas que vencen el: {$targetDate->format('Y-m-d')} (en {$days} días)");
                    break;

                case 'renewal':
                    $query->whereNotNull('renewal_date')
                        ->whereDate('renewal_date', '=', $targetDate);
                    
                    $this->line("  🔍 Buscando pólizas con renovación el: {$targetDate->format('Y-m-d')} (en {$days} días)");
                    break;

                case 'payment_due':
                    $query->whereIn('payment_status', ['pending', 'overdue'])
                        ->whereNotNull('payment_due_date')
                        ->whereDate('payment_due_date', '=', $targetDate);
                    
                    $this->line("  🔍 Buscando pólizas con pago venciendo el: {$targetDate->format('Y-m-d')} (en {$days} días)");
                    break;
            }

            $found = $query->get();
            $this->line("    📊 Encontradas: {$found->count()} pólizas para {$days} días");
            
            // Agregar a la colección total (evitando duplicados por ID)
            foreach ($found as $policy) {
                if (!in_array($policy->id, $uniquePolicyIds)) {
                    $uniquePolicyIds[] = $policy->id;
                    $allPolicies[] = $policy;
                }
            }
        }

        $count = count($allPolicies);
        $this->line("  📊 Total de pólizas únicas encontradas: {$count}");
        
        if ($count > 0) {
            $first = $allPolicies[0];
            $this->line("  📋 Primera póliza: {$first->policy_number} - Vence: {$first->end_date} - Estado: {$first->status}");
        }

        // Retornar como Collection de Eloquent
        return Poliza::whereIn('id', $uniquePolicyIds)->with('client')->get();
    }

    /**
     * Verificar si debe saltar una póliza
     */
    private function shouldSkipPolicy(PolicyNotificationConfig $config, Poliza $policy): bool
    {
        // Verificar cliente excluido
        if ($policy->client_id && $config->isClientExcluded($policy->client_id)) {
            return true;
        }

        // Verificar tipo de póliza excluido
        if ($config->isPolicyTypeExcluded($policy->type)) {
            return true;
        }

        // Verificar estado de póliza excluido
        if ($config->isPolicyStatusExcluded($policy->status)) {
            return true;
        }

        return false;
    }

    /**
     * Obtener teléfonos del cliente
     */
    private function getClientPhones(PolicyNotificationConfig $config, Poliza $policy): array
    {
        $phones = [];
        $client = $policy->client;

        if (!$client) {
            return $phones;
        }

        // Teléfono principal
        if ($config->send_to_client_phone && $client->phone) {
            $phones[] = $this->formatPhoneNumber($client->phone);
        }

        // Teléfono móvil
        if ($config->send_to_client_mobile && $client->mobile_phone) {
            $formatted = $this->formatPhoneNumber($client->mobile_phone);
            if (!in_array($formatted, $phones)) {
                $phones[] = $formatted;
            }
        }

        return array_unique($phones);
    }

    /**
     * Formatear número de teléfono
     */
    private function formatPhoneNumber(string $phone): string
    {
        // Remover espacios y caracteres especiales excepto el +
        $phone = preg_replace('/[^0-9+]/', '', $phone);
        
        // Si ya tiene +, devolverlo tal como está
        if (substr($phone, 0, 1) === '+') {
            return $phone;
        }
        
        // Si ya empieza con 57, agregar solo el +
        if (substr($phone, 0, 2) === '57' && strlen($phone) == 12) {
            return '+' . $phone;
        }
        
        // Si no tiene código de país, agregar +57 para Colombia
        if (strlen($phone) == 10 && substr($phone, 0, 1) == '3') {
            return '+57' . $phone;
        }
        
        return $phone;
    }

    /**
     * Enviar notificación por WhatsApp
     */
    private function sendNotification(
        PolicyNotificationConfig $config,
        Poliza $policy,
        string $phone,
        string $message,
        string $type
    ): array {
        try {
            // Crear log de notificación
            $log = PolicyNotificationLog::create([
                'broker_id' => $config->broker_id,
                'policy_notification_config_id' => $config->id,
                'poliza_id' => $policy->id,
                'client_id' => $policy->client_id,
                'whatsapp_instance_id' => $config->whatsapp_instance_id,
                'notification_type' => $type,
                'recipient_phone' => $phone,
                'message_sent' => $message,
                'status' => 'pending',
                'policy_data' => [
                    'policy_number' => $policy->policy_number,
                    'insurance_company' => $policy->insurance_company,
                    'end_date' => $policy->end_date?->format('Y-m-d'),
                    'renewal_date' => $policy->renewal_date?->format('Y-m-d'),
                    'payment_due_date' => $policy->payment_due_date?->format('Y-m-d'),
                    'premium_amount' => $policy->premium_amount,
                ],
            ]);

            // Enviar por WhatsApp
            $waBase = rtrim(env('WHATSAPP_SERVICE_URL', 'http://localhost:3000/api/v1'), '/');
            $url = $waBase . '/instances/' . $config->whatsappInstance->instance_id . '/send-message';

            $response = Http::timeout(10)->post($url, [
                'phone' => $phone,
                'message' => $message,
                'options' => [
                    'broker_id' => $config->broker_id,
                    'label' => 'policy_notification_' . $type,
                ]
            ]);

            if ($response->successful() && $response->json('success')) {
                $messageId = $response->json('messageId');
                $log->markAsSent($messageId);
                $config->incrementSent();

                 // Cobrar 50 pesos por WhatsApp enviado (permite balance negativo)
                 $costPerWhatsApp = 50; // 50 pesos COP
                 $wallet = Wallet::firstOrCreate(
                     ['broker_id' => $config->broker_id],
                     [
                         'balance_cop' => 0,
                         'balance_usd' => 0,
                         'pending_balance' => 0,
                         'total_earnings' => 0,
                         'is_active' => true
                     ]
                 );
                
                 $balanceBefore = (float) $wallet->balance_cop;
                 $wallet->balance_cop = $balanceBefore - $costPerWhatsApp;
                 $wallet->save();
                
                 // Registrar transacción
                 WalletTransaction::create([
                     'wallet_id' => $wallet->id,
                     'broker_id' => $config->broker_id,
                     'user_id' => null,
                     'type' => 'debit',
                     'amount_cop' => $costPerWhatsApp,
                     'amount_usd' => 0,
                     'currency' => 'COP',
                     'description' => "WhatsApp enviado - Notificación de póliza: {$policy->policy_number}",
                     'reference_type' => 'policy_notification',
                     'reference_id' => $log->id,
                     'balance_cop_after' => $wallet->balance_cop,
                     'metadata' => [
                         'policy_id' => $policy->id,
                         'policy_number' => $policy->policy_number,
                         'notification_type' => $type,
                         'phone' => $phone,
                         'cost_per_whatsapp' => $costPerWhatsApp,
                         'balance_before' => $balanceBefore
                     ]
                 ]);
                
                 Log::info('💰 [WALLET] Cobro por WhatsApp enviado (debito aplicado)', [
                     'broker_id' => $config->broker_id,
                     'policy_id' => $policy->id,
                     'cost' => $costPerWhatsApp,
                     'balance_before' => $balanceBefore,
                     'balance_after' => $wallet->balance_cop
                 ]);

                return [
                    'success' => true,
                    'message_id' => $messageId
                ];
            }

            $error = $response->json('error') ?? 'Error desconocido';
            $log->markAsFailed($error);
            $config->incrementFailed();

            return [
                'success' => false,
                'error' => $error
            ];

        } catch (\Exception $e) {
            Log::error('Error enviando notificación de póliza', [
                'policy_id' => $policy->id,
                'phone' => $phone,
                'error' => $e->getMessage()
            ]);

            if (isset($log)) {
                $log->markAsFailed($e->getMessage());
                $config->incrementFailed();
            }

            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
}