<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Models\WhatsAppInstance;

class SyncWhatsAppInstances extends Command
{
    protected $signature = 'whatsapp:sync-instances {--check-microservice : Solo verificar si el microservicio está activo}';
    protected $description = 'Sincroniza las instancias de WhatsApp entre Laravel y el microservicio';

    private $whatsappMicroserviceUrl = 'http://127.0.0.1:3000/api/v1';

    public function handle()
    {
        $this->info('🔄 Iniciando sincronización de instancias WhatsApp...');

        // Verificar que el microservicio esté activo
        if (!$this->checkMicroserviceHealth()) {
            $this->error('❌ El microservicio de WhatsApp no está disponible en ' . $this->whatsappMicroserviceUrl);
            $this->warn('💡 Ejecuta: cd whatsapp && ./start_microservice.sh');
            return 1;
        }

        if ($this->option('check-microservice')) {
            $this->info('✅ Microservicio de WhatsApp está activo');
            return 0;
        }

        // Obtener todas las instancias de Laravel
        $instances = WhatsAppInstance::all();
        $this->info("📊 Encontradas {$instances->count()} instancias en Laravel");

        $synced = 0;
        $errors = 0;

        foreach ($instances as $instance) {
            $this->info("🔄 Sincronizando instancia: {$instance->instance_id}");

            try {
                // Verificar si existe en el microservicio
                $statusResponse = Http::timeout(5)->get($this->whatsappMicroserviceUrl . '/instances/' . $instance->instance_id . '/status');

                if ($statusResponse->successful()) {
                    // Ya existe, actualizar estado
                    $statusData = $statusResponse->json();
                    $instance->update([
                        'status' => $this->mapMicroserviceStatus($statusData['status'] ?? 'disconnected'),
                        'last_activity_at' => now()
                    ]);
                    $this->line("  ✅ Instancia existente actualizada: {$statusData['status']}");
                    $synced++;
                } else {
                    // No existe, crearla en el microservicio
                    $createResponse = Http::post($this->whatsappMicroserviceUrl . '/instances', [
                        'instanceId' => $instance->instance_id,
                        'webhook' => $instance->webhook_url,
                        'settings' => $instance->settings ?? [],
                    ]);

                    if ($createResponse->successful()) {
                        $createData = $createResponse->json();
                        $instance->update([
                            'status' => 'connecting',
                            'session_data' => $createData,
                            'last_activity_at' => now()
                        ]);
                        $this->line("  ✅ Instancia creada en microservicio");
                        $synced++;
                    } else {
                        $this->error("  ❌ Error creando instancia: " . $createResponse->body());
                        $errors++;
                    }
                }
            } catch (\Exception $e) {
                $this->error("  ❌ Error procesando instancia {$instance->instance_id}: " . $e->getMessage());
                $errors++;
            }
        }

        $this->info("\n📊 Resumen de sincronización:");
        $this->info("✅ Instancias sincronizadas: {$synced}");
        if ($errors > 0) {
            $this->warn("⚠️  Errores: {$errors}");
        }

        return 0;
    }

    private function checkMicroserviceHealth(): bool
    {
        try {
            // Usar una prueba simple que no requiera eliminación
            $response = Http::timeout(10)->get($this->whatsappMicroserviceUrl . '/instances');

            $this->line("🔍 Debug - Response status: " . $response->status());

            if ($response->successful()) {
                return true;
            }
        } catch (\Exception $e) {
            $this->error('🔍 Debug - Exception: ' . $e->getMessage());
        }

        return false;
    }

    private function mapMicroserviceStatus(string $status): string
    {
        $mapping = [
            'connected' => 'connected',
            'connecting' => 'connecting',
            'disconnected' => 'disconnected',
            'qr_pending' => 'qr_pending',
            'authenticated' => 'authenticated',
            'error' => 'error',
        ];

        return $mapping[$status] ?? 'disconnected';
    }
}