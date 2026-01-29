<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Models\WhatsAppInstance;

class SyncWhatsAppInstances extends Command
{
    protected $signature = 'whatsapp:sync-instances 
                            {--check-microservice : Solo verificar si el microservicio está activo}
                            {--only-connected : Solo sincronizar instancias que estaban conectadas}
                            {--force : Forzar recreación de todas las instancias}
                            {--wait-for-microservice=0 : Segundos a esperar si el microservicio no está disponible}';
    
    protected $description = 'Sincroniza las instancias de WhatsApp entre Laravel y el microservicio. Útil después de reiniciar el microservicio.';

    private string $whatsappMicroserviceUrl;

    public function __construct()
    {
        parent::__construct();
        $this->whatsappMicroserviceUrl = rtrim(env('WHATSAPP_SERVICE_URL', 'http://127.0.0.1:3000'), '/') . '/api/v1';
    }

    public function handle()
    {
        $this->info('🔄 Iniciando sincronización de instancias WhatsApp...');
        Log::info('[WHATSAPP SYNC] Comando de sincronización iniciado');

        $waitSeconds = (int) $this->option('wait-for-microservice');
        
        // Esperar si se especificó tiempo de espera
        if ($waitSeconds > 0) {
            $this->info("⏳ Esperando {$waitSeconds} segundos para que el microservicio inicie...");
            sleep($waitSeconds);
        }

        // Verificar que el microservicio esté activo
        $maxRetries = 3;
        $retryDelay = 2;
        $microserviceAvailable = false;

        for ($i = 0; $i < $maxRetries; $i++) {
            if ($this->checkMicroserviceHealth()) {
                $microserviceAvailable = true;
                break;
            }
            if ($i < $maxRetries - 1) {
                $this->warn("⏳ Microservicio no disponible, reintentando en {$retryDelay}s... (intento " . ($i + 2) . "/{$maxRetries})");
                sleep($retryDelay);
            }
        }

        if (!$microserviceAvailable) {
            $this->error('❌ El microservicio de WhatsApp no está disponible en ' . $this->whatsappMicroserviceUrl);
            $this->warn('💡 Ejecuta: cd whatsapp && npm start');
            Log::error('[WHATSAPP SYNC] Microservicio no disponible');
            return 1;
        }

        if ($this->option('check-microservice')) {
            $this->info('✅ Microservicio de WhatsApp está activo');
            return 0;
        }

        // Obtener instancias según filtros
        $query = WhatsAppInstance::where('connection_type', 'baileys');
        
        if ($this->option('only-connected')) {
            $query->whereIn('status', ['connected', 'connecting']);
            $this->info('📋 Filtrando solo instancias conectadas/conectando...');
        }

        $instances = $query->get();
        $this->info("📊 Encontradas {$instances->count()} instancias para sincronizar");

        if ($instances->isEmpty()) {
            $this->info('ℹ️  No hay instancias para sincronizar');
            return 0;
        }

        $synced = 0;
        $reconnected = 0;
        $errors = 0;
        $force = $this->option('force');

        foreach ($instances as $instance) {
            $this->line("🔄 Procesando: {$instance->instance_id} (estado actual: {$instance->status})");

            try {
                // Verificar si existe en el microservicio
                $statusResponse = Http::timeout(5)->get($this->whatsappMicroserviceUrl . '/instances/' . $instance->instance_id . '/status');

                if ($statusResponse->successful() && !$force) {
                    // Ya existe en el microservicio
                    $statusData = $statusResponse->json();
                    $newStatus = $this->determineStatus($statusData);
                    
                    $updateData = [
                        'status' => $newStatus,
                        'last_activity_at' => now()
                    ];

                    // Si se reconectó exitosamente
                    if ($newStatus === 'connected') {
                        $updateData['last_connected_at'] = now();
                        $updateData['error_message'] = null;
                        $updateData['reconnect_attempts'] = 0;
                        $reconnected++;
                        $this->info("  ✅ Reconectada automáticamente!");
                    }

                    $instance->update($updateData);
                    $this->line("  📊 Estado sincronizado: {$newStatus}");
                    $synced++;
                } else {
                    // No existe o se fuerza recreación - crear en el microservicio
                    $this->line("  📝 Registrando instancia en microservicio...");
                    
                    $createResponse = Http::timeout(10)->post($this->whatsappMicroserviceUrl . '/instances', [
                        'instanceId' => $instance->instance_id,
                        'webhook' => $instance->webhook_url ?? route('api.whatsapp.webhook'),
                        'settings' => $instance->settings ?? [],
                    ]);

                    if ($createResponse->successful()) {
                        $createData = $createResponse->json();
                        
                        // Esperar un momento y verificar estado
                        sleep(2);
                        
                        $checkResponse = Http::timeout(5)->get($this->whatsappMicroserviceUrl . '/instances/' . $instance->instance_id . '/status');
                        $finalStatus = 'connecting';
                        
                        if ($checkResponse->successful()) {
                            $checkData = $checkResponse->json();
                            $finalStatus = $this->determineStatus($checkData);
                            
                            if ($finalStatus === 'connected') {
                                $reconnected++;
                                $this->info("  ✅ Reconectada con sesión existente!");
                            }
                        }

                        $instance->update([
                            'status' => $finalStatus,
                            'session_data' => $createData,
                            'last_activity_at' => now(),
                            'error_message' => null,
                        ]);
                        
                        $this->line("  ✅ Instancia registrada (estado: {$finalStatus})");
                        $synced++;
                    } else {
                        $errorBody = $createResponse->body();
                        $this->error("  ❌ Error: " . $errorBody);
                        $instance->update([
                            'error_message' => 'Sync failed: ' . substr($errorBody, 0, 200),
                            'last_activity_at' => now()
                        ]);
                        $errors++;
                    }
                }
            } catch (\Exception $e) {
                $this->error("  ❌ Excepción: " . $e->getMessage());
                Log::error('[WHATSAPP SYNC] Error sincronizando instancia', [
                    'instance_id' => $instance->instance_id,
                    'error' => $e->getMessage()
                ]);
                $errors++;
            }
        }

        $this->newLine();
        $this->info("═══════════════════════════════════════");
        $this->info("📊 RESUMEN DE SINCRONIZACIÓN");
        $this->info("═══════════════════════════════════════");
        $this->info("✅ Instancias sincronizadas: {$synced}");
        $this->info("🔄 Reconectadas automáticamente: {$reconnected}");
        if ($errors > 0) {
            $this->warn("⚠️  Errores: {$errors}");
        }
        $this->info("═══════════════════════════════════════");

        Log::info('[WHATSAPP SYNC] Sincronización completada', [
            'synced' => $synced,
            'reconnected' => $reconnected,
            'errors' => $errors
        ]);

        return $errors > 0 ? 1 : 0;
    }

    private function checkMicroserviceHealth(): bool
    {
        try {
            $response = Http::timeout(5)->get($this->whatsappMicroserviceUrl . '/instances');
            return $response->successful();
        } catch (\Exception $e) {
            return false;
        }
    }

    private function determineStatus(array $data): string
    {
        if ($data['connected'] ?? false) {
            return 'connected';
        }
        if ($data['connecting'] ?? false) {
            return 'connecting';
        }
        
        $status = $data['status'] ?? 'disconnected';
        
        $mapping = [
            'connected' => 'connected',
            'connecting' => 'connecting',
            'disconnected' => 'disconnected',
            'qr_pending' => 'qr_pending',
            'authenticated' => 'connected',
            'error' => 'error',
        ];

        return $mapping[$status] ?? 'disconnected';
    }
}