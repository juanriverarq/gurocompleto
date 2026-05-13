<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\AutomovilNotificationConfig;
use App\Models\AutomovilNotificationLog;
use App\Models\Automovil;
use App\Services\WhatsAppCloudApiService;
use Illuminate\Support\Facades\Log;

class SendAutomovilNotifications extends Command
{
    protected $signature = 'automovil:send-notifications
                            {--broker= : ID del broker específico}
                            {--type= : Tipo de notificación (soat|rtm)}
                            {--dry-run : Simular sin enviar}
                            {--force : Forzar envío ignorando horarios}
                            {--reset-today : Eliminar logs de hoy para permitir reenvío}';

    protected $description = 'Enviar notificaciones automáticas de WhatsApp para automóviles (SOAT y RTM)';

    public function handle()
    {
        $this->info('🚗 Iniciando envío de notificaciones de automóviles...');

        $brokerId = $this->option('broker');
        $notificationType = $this->option('type');
        $dryRun = $this->option('dry-run');
        $force = $this->option('force');
        $resetToday = $this->option('reset-today');

        if ($resetToday) {
            $query = AutomovilNotificationLog::where('created_at', '>=', now()->startOfDay());
            if ($brokerId) $query->where('broker_id', $brokerId);
            $deleted = $query->delete();
            $this->warn("🗑️  Eliminados {$deleted} logs de hoy");
        }

        $query = AutomovilNotificationConfig::active()->with('broker', 'whatsappInstance');
        if ($brokerId) $query->where('broker_id', $brokerId);

        $configs = $query->get();
        if ($configs->isEmpty()) {
            $this->warn('⚠️  No hay configuraciones activas');
            return 0;
        }

        $this->info("📋 Configuraciones activas: {$configs->count()}");

        $totalSent = 0; $totalFailed = 0; $totalSkipped = 0;

        foreach ($configs as $config) {
            $this->line('');
            $this->info("🏢 Broker: {$config->broker->name} (ID: {$config->broker_id})");

            if (!$force) {
                $today = now()->dayOfWeek;
                $sendDays = $config->send_days ?? [1, 2, 3, 4, 5];
                if (!in_array($today, $sendDays)) {
                    $this->warn("⏭️  Saltando - No es día de envío");
                    continue;
                }
                $currentHour = (int)now()->format('H');
                $sendHour = (int)substr($config->send_time, 0, 2);
                if ($currentHour !== $sendHour) {
                    $this->warn("⏭️  No es hora de envío (actual: {$currentHour}:00, config: {$sendHour}:00)");
                    continue;
                }
            }

            if (!$config->whatsappInstance || !$config->whatsappInstance->isConnected()) {
                $this->error("❌ WhatsApp no conectado para broker {$config->broker_id}");
                continue;
            }

            $types = [];
            if ((!$notificationType || $notificationType === 'soat') && $config->notify_soat) $types[] = 'soat';
            if ((!$notificationType || $notificationType === 'rtm') && $config->notify_rtm) $types[] = 'rtm';

            foreach ($types as $type) {
                $this->info("  📨 Procesando: {$type}");
                $result = $this->processNotificationType($config, $type, $dryRun);
                $totalSent += $result['sent'];
                $totalFailed += $result['failed'];
                $totalSkipped += $result['skipped'];
            }
        }

        $this->line('');
        $this->info("✅ Total enviadas: {$totalSent}");
        $this->info("❌ Total fallidas: {$totalFailed}");
        $this->info("⏭️  Total saltadas: {$totalSkipped}");

        return 0;
    }

    private function processNotificationType(AutomovilNotificationConfig $config, string $type, bool $dryRun): array
    {
        $sent = 0; $failed = 0; $skipped = 0;

        $autos = $this->getAutomovilesForNotification($config, $type);
        $this->line("    🔍 Automóviles a notificar: {$autos->count()}");

        foreach ($autos as $auto) {
            if ($this->shouldSkipAuto($config, $auto)) {
                $this->line("    ⏭️  Saltado (excluido): {$auto->placa}");
                $skipped++;
                continue;
            }

            // Verificar si ya se intentó hoy (incluye failed para evitar
            // reintentos en bucle dentro de la misma hora). Mismo criterio
            // que SendPolicyNotifications.
            $alreadySent = AutomovilNotificationLog::where('automovil_id', $auto->id)
                ->where('notification_type', $type)
                ->where('created_at', '>=', now()->startOfDay())
                ->exists();

            if ($alreadySent) {
                $this->line("    ⏭️  Ya notificado hoy: {$auto->placa}");
                $skipped++;
                continue;
            }

            $phones = $this->getClientPhones($config, $auto);
            if (empty($phones)) {
                $this->warn("    ⚠️  Sin teléfonos para {$auto->placa}");
                $skipped++;
                continue;
            }

            $message = $config->processTemplate($config->getTemplate($type), $auto);

            foreach ($phones as $phone) {
                $normalizedPhone = $this->normalizePhone($phone);

                if ($dryRun) {
                    $this->line("    🧪 DRY-RUN → {$normalizedPhone}: {$auto->placa}");
                    $sent++;
                    continue;
                }

                $result = $this->sendNotification($config, $auto, $normalizedPhone, $message, $type);
                if ($result['success']) {
                    $sent++;
                    $this->line("    ✅ Enviado a {$normalizedPhone}: {$auto->placa}");
                } else {
                    $failed++;
                    $this->error("    ❌ Fallo a {$normalizedPhone}: {$result['error']}");
                }
            }
        }

        return ['sent' => $sent, 'failed' => $failed, 'skipped' => $skipped];
    }

    private function getAutomovilesForNotification(AutomovilNotificationConfig $config, string $type)
    {
        $daysArray = $config->getDaysBeforeForType($type);
        $dateField = $type === 'soat' ? 'fecha_vencimiento_soat' : 'fecha_vencimiento_rtm';

        $excludedClientIds = $config->excluded_client_ids ?? [];
        $excludedAutomovilIds = $config->excluded_automovil_ids ?? [];
        $excludedVehicleClasses = array_map('strtoupper', $config->excluded_vehicle_classes ?? []);

        $unique = []; $all = [];

        foreach ($daysArray as $days) {
            $query = Automovil::forBroker($config->broker_id)
                ->whereNotNull($dateField)
                ->with('client');

            if (!empty($excludedClientIds)) $query->whereNotIn('client_id', $excludedClientIds);
            if (!empty($excludedAutomovilIds)) $query->whereNotIn('id', $excludedAutomovilIds);
            if (!empty($excludedVehicleClasses)) {
                $query->where(function($q) use ($excludedVehicleClasses) {
                    $q->whereNull('clase')
                      ->orWhereNotIn(\DB::raw('UPPER(clase)'), $excludedVehicleClasses);
                });
            }

            $targetDate = now()->addDays($days)->startOfDay();

            // Si skip_weekends está activo y hoy es viernes, el viernes absorbe
            // el trabajo del sábado (`Fri+N+1` = `Sat+N`) y del domingo
            // (`Fri+N+2` = `Sun+N`). Sin esto se pierden los avisos cuyo cron-day
            // calculado caería en sábado o domingo.
            $datesToCover = [$targetDate->copy()];
            if (now()->isFriday() && (int) ($config->skip_weekends ?? 0) === 1) {
                $datesToCover[] = $targetDate->copy()->addDay();    // trabajo del sábado
                $datesToCover[] = $targetDate->copy()->addDays(2);  // trabajo del domingo
            }
            $datesISO = array_map(fn($d) => $d->format('Y-m-d'), $datesToCover);
            $query->whereIn(\DB::raw("DATE($dateField)"), $datesISO);

            foreach ($query->get() as $auto) {
                if (!in_array($auto->id, $unique)) {
                    $unique[] = $auto->id;
                    $all[] = $auto;
                }
            }
        }

        return collect($all);
    }

    private function shouldSkipAuto(AutomovilNotificationConfig $config, Automovil $auto): bool
    {
        if ($auto->client_id && $config->isClientExcluded($auto->client_id)) return true;
        if ($config->isAutomovilExcluded($auto->id)) return true;
        if ($auto->clase && $config->isVehicleClassExcluded($auto->clase)) return true;
        return false;
    }

    private function getClientPhones(AutomovilNotificationConfig $config, Automovil $auto): array
    {
        $phones = [];
        $client = $auto->client;
        if (!$client) return $phones;

        if ($config->send_to_client_mobile && !empty($client->mobile_phone)) {
            $phones[] = $client->mobile_phone;
        }
        if ($config->send_to_client_phone && !empty($client->phone) && !in_array($client->phone, $phones)) {
            $phones[] = $client->phone;
        }

        return array_unique($phones);
    }

    private function normalizePhone(string $phone): string
    {
        $phone = preg_replace('/\D+/', '', $phone);
        if (strlen($phone) === 12 && substr($phone, 0, 2) === '57') return '+' . $phone;
        if (strlen($phone) === 10 && substr($phone, 0, 1) === '3') return '+57' . $phone;
        return '+' . $phone;
    }

    /** Cache de param count por instancia+template para evitar llamadas repetidas. */
    private array $templateParamCache = [];

    /**
     * Devuelve el número de parámetros que espera la plantilla en el body,
     * consultando la lista de plantillas APPROVED de la instancia. Cachea por run.
     * Devuelve null si no se puede determinar.
     */
    private function getTemplateParamCount(WhatsAppCloudApiService $cloudApi, $instance, string $templateName): ?int
    {
        $key = $instance->id . ':' . $templateName;
        if (array_key_exists($key, $this->templateParamCache)) {
            return $this->templateParamCache[$key];
        }
        try {
            $result = $cloudApi->getMessageTemplates($instance, 'APPROVED', 100);
            if (!($result['success'] ?? false)) {
                return $this->templateParamCache[$key] = null;
            }
            foreach (($result['data'] ?? []) as $t) {
                if (($t['name'] ?? '') === $templateName) {
                    $body = collect($t['components'] ?? [])->firstWhere('type', 'BODY');
                    $count = preg_match_all('/\{\{\d+\}\}/', $body['text'] ?? '');
                    return $this->templateParamCache[$key] = $count;
                }
            }
        } catch (\Throwable $e) {
            // Silencioso — el envío seguirá adelante con los params originales.
        }
        return $this->templateParamCache[$key] = null;
    }

    private function sendNotification(
        AutomovilNotificationConfig $config,
        Automovil $auto,
        string $phone,
        string $message,
        string $type
    ): array {
        try {
            $log = AutomovilNotificationLog::create([
                'broker_id' => $config->broker_id,
                'automovil_notification_config_id' => $config->id,
                'automovil_id' => $auto->id,
                'client_id' => $auto->client_id,
                'whatsapp_instance_id' => $config->whatsapp_instance_id,
                'notification_type' => $type,
                'recipient_phone' => $phone,
                'message_sent' => $message,
                'status' => 'pending',
                'automovil_data' => [
                    'placa' => $auto->placa,
                    'marca' => $auto->marca,
                    'linea' => $auto->linea,
                    'anio' => $auto->anio,
                    'fecha_vencimiento_soat' => $auto->fecha_vencimiento_soat?->format('Y-m-d'),
                    'fecha_vencimiento_rtm' => $auto->fecha_vencimiento_rtm?->format('Y-m-d'),
                ],
            ]);

            $cloudApi = app(WhatsAppCloudApiService::class);

            $configTemplateMap = [
                'soat' => $config->soat_template,
                'rtm' => $config->rtm_template,
            ];
            $defaultTemplateMap = [
                'soat' => 'automovil_soat_vencimiento',
                'rtm' => 'automovil_rtm_vencimiento',
            ];
            $templateName = !empty($configTemplateMap[$type]) ? $configTemplateMap[$type] : ($defaultTemplateMap[$type] ?? null);

            if ($templateName) {
                $client = $auto->client;
                $clientName = $client
                    ? ($client->full_name ?? trim(($client->first_name ?? '') . ' ' . ($client->last_name ?? '')) ?: 'Cliente')
                    : 'Cliente';

                // Orden de variables expuesto en la UI (modal de notificaciones):
                //   {{1}} nombre  · {{2}} placa  · {{3}} fecha vencimiento  · {{4}} marca+linea  · {{5}} aseguradora/CDA
                // Plantillas con menos variables se truncan abajo (array_slice), así que
                // las primeras 3 deben ser siempre nombre / placa / fecha.
                $templateParams = match($type) {
                    'soat' => [
                        $clientName,
                        $auto->placa ?? '-',
                        $auto->fecha_vencimiento_soat ? $auto->fecha_vencimiento_soat->format('d/m/Y') : 'N/A',
                        trim(($auto->marca ?? '') . ' ' . ($auto->linea ?? '')) ?: '-',
                        $auto->aseguradora_soat ?? '-',
                    ],
                    'rtm' => [
                        $clientName,
                        $auto->placa ?? '-',
                        $auto->fecha_vencimiento_rtm ? $auto->fecha_vencimiento_rtm->format('d/m/Y') : 'N/A',
                        trim(($auto->marca ?? '') . ' ' . ($auto->linea ?? '')) ?: '-',
                        $auto->nombre_cda_rtm ?? '-',
                    ],
                    default => [],
                };

                // Ajustar el número de parámetros al que espera la plantilla.
                // Si el usuario eligió una plantilla genérica (e.g. de pagos) que
                // espera 6 params pero el cron de autos envía 5, padeamos con
                // strings vacíos. Si la plantilla espera menos, truncamos.
                $expectedCount = $this->getTemplateParamCount($cloudApi, $config->whatsappInstance, $templateName);
                if ($expectedCount !== null) {
                    $current = count($templateParams);
                    if ($current < $expectedCount) {
                        $templateParams = array_pad($templateParams, $expectedCount, '-');
                    } elseif ($current > $expectedCount) {
                        $templateParams = array_slice($templateParams, 0, $expectedCount);
                    }
                }

                $components = [];
                if (!empty($templateParams)) {
                    $parameters = array_map(fn($val) => ['type' => 'text', 'text' => (string) $val], $templateParams);
                    $components[] = ['type' => 'body', 'parameters' => $parameters];
                }

                $result = $cloudApi->sendTemplateMessage($config->whatsappInstance, $phone, $templateName, 'es', $components);
            } else {
                $result = $cloudApi->sendTextMessage($config->whatsappInstance, $phone, $message);
            }

            if ($result['success'] ?? false) {
                $messageId = $result['message_id'] ?? null;
                $log->markAsSent($messageId);
                $config->incrementSent();
                return ['success' => true, 'message_id' => $messageId];
            }

            $error = $result['error'] ?? 'Error desconocido';
            Log::warning('WhatsApp send failed for automovil notification', [
                'phone' => $phone,
                'instance_id' => $config->whatsappInstance->instance_id,
                'error' => $error
            ]);
            $log->markAsFailed($error);
            $config->incrementFailed();

            return ['success' => false, 'error' => $error];

        } catch (\Exception $e) {
            Log::error('Error enviando notificación de automóvil', [
                'automovil_id' => $auto->id, 'phone' => $phone, 'error' => $e->getMessage()
            ]);
            if (isset($log)) {
                $log->markAsFailed($e->getMessage());
                $config->incrementFailed();
            }
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}
