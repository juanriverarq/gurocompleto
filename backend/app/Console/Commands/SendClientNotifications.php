<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\ClientNotificationConfig;
use App\Models\Cliente;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Services\WhatsAppCloudApiService;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class SendClientNotifications extends Command
{
    protected $signature = 'client:send-notifications
        {--broker= : Enviar solo para un broker específico}
        {--type= : Tipo de notificación (birthday, workers_day, womens_day, mens_day, advisor_day)}
        {--dry-run : Simular envío sin enviar}
        {--force : Forzar envío ignorando hora programada}';

    protected $description = 'Enviar notificaciones automáticas de WhatsApp a clientes (cumpleaños, días especiales)';

    public function handle(): int
    {
        $this->info('🔔 Iniciando envío de notificaciones de clientes...');

        $query = ClientNotificationConfig::where('is_active', true)
            ->whereNotNull('whatsapp_instance_id')
            ->with('whatsappInstance');

        if ($brokerId = $this->option('broker')) {
            $query->where('broker_id', $brokerId);
        }

        $configs = $query->get();
        $this->info("📋 Encontradas {$configs->count()} configuraciones activas");

        if ($configs->isEmpty()) {
            $this->warn('No hay configuraciones activas.');
            return 0;
        }

        foreach ($configs as $config) {
            $this->processConfig($config);
        }

        return 0;
    }

    private function processConfig(ClientNotificationConfig $config): void
    {
        $broker = $config->broker;
        $brokerName = $broker ? ($broker->company_name ?? $broker->first_name . ' ' . $broker->last_name) : "Broker #{$config->broker_id}";
        $this->newLine();
        $this->info("🏢 Procesando: {$brokerName} (ID: {$config->broker_id})");

        // Verificar instancia WhatsApp
        $instance = $config->whatsappInstance;
        if (!$instance || $instance->status !== 'connected') {
            $this->warn("  ❌ Instancia WhatsApp no conectada");
            return;
        }
        $this->info("  ✅ WhatsApp conectado: {$instance->instance_id}");

        // Verificar hora programada (a menos que se force)
        if (!$this->option('force')) {
            $now = Carbon::now();
            $sendTime = Carbon::createFromFormat('H:i:s', $config->send_time ?? '09:00:00');
            $diffMinutes = abs($now->diffInMinutes($sendTime));
            if ($diffMinutes > 5) {
                $this->info("  ⏰ No es hora de envío ({$config->send_time}). Hora actual: {$now->format('H:i')}");
                return;
            }
        }

        $typeFilter = $this->option('type');
        $totalSent = 0;
        $totalFailed = 0;
        $dailyLimit = $config->max_notifications_per_day ?? 100;
        $sentToday = DB::table('client_notification_logs')
            ->where('broker_id', $config->broker_id)
            ->where('status', 'sent')
            ->whereDate('created_at', Carbon::today())
            ->count();
        $remaining = max(0, $dailyLimit - $sentToday);

        $this->info("  📊 Límite diario: {$sentToday}/{$dailyLimit} (quedan {$remaining})");

        if ($remaining <= 0) {
            $this->warn("  ⚠️ Límite diario alcanzado");
            return;
        }

        $today = Carbon::today();
        $todayMD = $today->format('m-d');

        // 1. Cumpleaños
        if ($config->notify_birthday && (!$typeFilter || $typeFilter === 'birthday')) {
            $this->info("  📬 Procesando: Cumpleaños");
            $clients = Cliente::where('broker_id', $config->broker_id)
                ->whereNotNull('birth_date')
                ->whereRaw("DATE_FORMAT(birth_date, '%m-%d') = ?", [$todayMD])
                ->get();

            $this->info("    🎂 Clientes con cumpleaños hoy: {$clients->count()}");

            foreach ($clients as $client) {
                if ($remaining <= 0) break;
                $result = $this->sendNotification($config, $client, 'birthday');
                if ($result['success']) { $totalSent++; $remaining--; } else { $totalFailed++; }
            }
        }

        // 2. Fechas especiales
        $specialTypes = [
            'workers_day' => ['notify' => $config->notify_workers_day, 'date' => $config->workers_day_date ?? '05-01', 'gender' => null],
            'womens_day' => ['notify' => $config->notify_womens_day, 'date' => $config->womens_day_date ?? '03-08', 'gender' => 'F'],
            'mens_day' => ['notify' => $config->notify_mens_day, 'date' => $config->mens_day_date ?? '03-19', 'gender' => 'M'],
            'advisor_day' => ['notify' => $config->notify_advisor_day, 'date' => $config->advisor_day_date ?? '09-15', 'gender' => null],
        ];

        foreach ($specialTypes as $type => $info) {
            if (!$info['notify']) continue;
            if ($typeFilter && $typeFilter !== $type) continue;
            if ($todayMD !== $info['date']) {
                $this->info("  📬 {$type}: hoy no es la fecha ({$info['date']})");
                continue;
            }

            $this->info("  📬 Procesando: {$type} (fecha: {$info['date']})");

            $clientQuery = Cliente::where('broker_id', $config->broker_id);
            if ($info['gender']) {
                $clientQuery->where(function ($q) use ($info) {
                    $q->where('gender', $info['gender'])
                      ->orWhere('gender', strtolower($info['gender']))
                      ->orWhere('gender', $info['gender'] === 'F' ? 'Femenino' : 'Masculino')
                      ->orWhere('gender', $info['gender'] === 'F' ? 'femenino' : 'masculino');
                });
            }

            // Excluir clientes sin teléfono
            $clientQuery->where(function ($q) use ($config) {
                if ($config->send_to_client_mobile) $q->orWhereNotNull('mobile_phone');
                if ($config->send_to_client_phone) $q->orWhereNotNull('phone');
            });

            // Excluir clientes excluidos
            if (!empty($config->excluded_client_ids)) {
                $clientQuery->whereNotIn('id', $config->excluded_client_ids);
            }

            $clients = $clientQuery->get();
            $this->info("    👥 Clientes para {$type}: {$clients->count()}");

            foreach ($clients as $client) {
                if ($remaining <= 0) break;
                $result = $this->sendNotification($config, $client, $type);
                if ($result['success']) { $totalSent++; $remaining--; } else { $totalFailed++; }
            }
        }

        // Actualizar stats
        $config->update(['last_execution_at' => now()]);

        $this->newLine();
        $this->table(
            ['Métrica', 'Cantidad'],
            [
                ['Enviadas', $totalSent],
                ['Fallidas', $totalFailed],
            ]
        );
    }

    private function sendNotification(ClientNotificationConfig $config, Cliente $client, string $type): array
    {
        $isDryRun = $this->option('dry-run');

        // Obtener teléfono
        $phones = [];
        if ($config->send_to_client_mobile && !empty($client->mobile_phone)) {
            $phones[] = $client->mobile_phone;
        }
        if ($config->send_to_client_phone && !empty($client->phone)) {
            $phones[] = $client->phone;
        }
        $phones = array_unique($phones);

        if (empty($phones)) {
            return ['success' => false, 'error' => 'Sin teléfono'];
        }

        $phone = $this->formatPhoneNumber($phones[0]); // Usar el primer teléfono disponible

        // Verificar si ya se envió hoy para este cliente y tipo
        $alreadySent = DB::table('client_notification_logs')
            ->where('broker_id', $config->broker_id)
            ->where('client_id', $client->id)
            ->where('notification_type', $type)
            ->where('status', 'sent')
            ->whereDate('created_at', Carbon::today())
            ->exists();

        if ($alreadySent) {
            return ['success' => false, 'error' => 'Ya enviado hoy'];
        }

        $clientName = trim(($client->first_name ?? '') . ' ' . ($client->last_name ?? '')) ?: 'Cliente';

        if ($isDryRun) {
            $this->info("    [DRY-RUN] Enviaría a {$clientName} ({$phone}) - tipo: {$type}");
            return ['success' => true];
        }

        try {
            // Crear log
            $logId = DB::table('client_notification_logs')->insertGetId([
                'broker_id' => $config->broker_id,
                'client_notification_config_id' => $config->id,
                'client_id' => $client->id,
                'whatsapp_instance_id' => $config->whatsapp_instance_id,
                'notification_type' => $type,
                'recipient_phone' => $phone,
                'status' => 'pending',
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Obtener plantilla configurada
            $templateName = $config->getTemplateName($type);

            $cloudApi = app(WhatsAppCloudApiService::class);

            if ($templateName) {
                // Preparar parámetros de plantilla
                $templateParams = $this->buildTemplateParams($type, $client);
                $components = [];
                if (!empty($templateParams)) {
                    $parameters = array_map(fn($val) => ['type' => 'text', 'text' => (string) $val], $templateParams);
                    $components[] = ['type' => 'body', 'parameters' => $parameters];
                }

                $result = $cloudApi->sendTemplateMessage($config->whatsappInstance, $phone, $templateName, 'es', $components);

                // Guardar nombre de template en log
                DB::table('client_notification_logs')->where('id', $logId)->update([
                    'template_name' => $templateName,
                    'message_sent' => "Template: {$templateName}",
                ]);
            } else {
                // Fallback: mensaje de texto libre (solo funciona en ventana 24h)
                $message = $this->buildFallbackMessage($type, $client);
                $result = $cloudApi->sendTextMessage($config->whatsappInstance, $phone, $message);

                DB::table('client_notification_logs')->where('id', $logId)->update([
                    'message_sent' => $message,
                ]);
            }

            if ($result['success'] ?? false) {
                $messageId = $result['message_id'] ?? null;
                DB::table('client_notification_logs')->where('id', $logId)->update([
                    'status' => 'sent',
                    'whatsapp_message_id' => $messageId,
                    'sent_at' => now(),
                    'updated_at' => now(),
                ]);
                $config->incrementSent();

                // Cobrar 50 pesos COP
                $this->chargeWallet($config->broker_id, $logId, $client, $type, $phone);

                $this->info("    ✅ Enviado a {$clientName} ({$phone})");
                return ['success' => true, 'message_id' => $messageId];
            }

            $error = $result['error'] ?? 'Error desconocido';
            DB::table('client_notification_logs')->where('id', $logId)->update([
                'status' => 'failed',
                'error_message' => $error,
                'updated_at' => now(),
            ]);
            $config->incrementFailed();

            $this->warn("    ❌ Falló para {$clientName}: {$error}");
            return ['success' => false, 'error' => $error];

        } catch (\Exception $e) {
            Log::error('Error enviando notificación de cliente', [
                'client_id' => $client->id,
                'type' => $type,
                'error' => $e->getMessage(),
            ]);

            if (isset($logId)) {
                DB::table('client_notification_logs')->where('id', $logId)->update([
                    'status' => 'failed',
                    'error_message' => $e->getMessage(),
                    'updated_at' => now(),
                ]);
                $config->incrementFailed();
            }

            $this->error("    ❌ Error: {$e->getMessage()}");
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    private function buildTemplateParams(string $type, Cliente $client): array
    {
        $clientName = trim(($client->first_name ?? '') . ' ' . ($client->last_name ?? '')) ?: 'Cliente';

        return match($type) {
            'birthday' => [$clientName],
            'workers_day' => [$clientName],
            'womens_day' => [$clientName],
            'mens_day' => [$clientName],
            'advisor_day' => [$clientName],
            default => [$clientName],
        };
    }

    private function buildFallbackMessage(string $type, Cliente $client): string
    {
        $clientName = trim(($client->first_name ?? '') . ' ' . ($client->last_name ?? '')) ?: 'Cliente';

        return match($type) {
            'birthday' => "¡Feliz cumpleaños, {$clientName}! 🎂 Te deseamos un excelente día.",
            'workers_day' => "¡Feliz Día del Trabajador, {$clientName}! 💪 Gracias por tu esfuerzo.",
            'womens_day' => "¡Feliz Día de la Mujer, {$clientName}! 🌸 Un reconocimiento especial para ti.",
            'mens_day' => "¡Feliz Día del Hombre, {$clientName}! 💙",
            'advisor_day' => "¡Feliz Día del Asesor, {$clientName}! 🛡️ Gracias por confiar en nosotros.",
            default => "Hola {$clientName}, un saludo especial de parte de tu asesor.",
        };
    }

    private function formatPhoneNumber(string $phone): string
    {
        // Remover espacios y caracteres especiales excepto el +
        $phone = preg_replace('/[^0-9+]/', '', $phone);

        // Si ya tiene +, devolverlo tal como está
        if (substr($phone, 0, 1) === '+') {
            return $phone;
        }

        // Si ya empieza con 57 y tiene 12 dígitos, agregar solo el +
        if (substr($phone, 0, 2) === '57' && strlen($phone) == 12) {
            return '+' . $phone;
        }

        // Si no tiene código de país, agregar +57 para Colombia
        if (strlen($phone) == 10 && substr($phone, 0, 1) == '3') {
            return '+57' . $phone;
        }

        return $phone;
    }

    private function chargeWallet(int $brokerId, int $logId, Cliente $client, string $type, string $phone): void
    {
        // Cobro de wallet desactivado
    }
}
