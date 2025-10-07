<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\WhatsAppInstance;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SyncWhatsAppInstancesToMicroservice extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'whatsapp:sync-instances';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Sincronizar instancias de WhatsApp de Laravel con el microservicio';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('🔄 Sincronizando instancias de WhatsApp con el microservicio...');
        
        $microserviceUrl = rtrim(env('WHATSAPP_SERVICE_URL', 'http://127.0.0.1:3000/api/v1'), '/');
        
        // Obtener todas las instancias de Laravel
        $instances = WhatsAppInstance::all();
        
        if ($instances->isEmpty()) {
            $this->warn('⚠️  No hay instancias en Laravel para sincronizar');
            return 0;
        }
        
        $this->info("📊 Encontradas {$instances->count()} instancias en Laravel");
        
        $synced = 0;
        $failed = 0;
        
        foreach ($instances as $instance) {
            $this->line("📱 Procesando: {$instance->instance_id} (Broker: {$instance->broker_id})");
            
            try {
                // Verificar si la instancia ya existe en el microservicio
                $statusResponse = Http::timeout(5)->get("{$microserviceUrl}/instances/{$instance->instance_id}/status");
                
                if ($statusResponse->successful()) {
                    $this->info("  ✅ Instancia ya existe en microservicio");
                    $synced++;
                    continue;
                }
                
                // Si no existe (404), crearla
                if ($statusResponse->status() === 404 || !$statusResponse->successful()) {
                    $this->line("  🆕 Creando instancia en microservicio...");
                    
                    $createResponse = Http::timeout(10)->post("{$microserviceUrl}/instances", [
                        'instanceId' => $instance->instance_id,
                        'webhook' => $instance->webhook_url,
                        'settings' => $instance->settings ?? []
                    ]);
                    
                    if ($createResponse->successful()) {
                        $this->info("  ✅ Instancia creada exitosamente en microservicio");
                        
                        // Actualizar estado en Laravel
                        $instance->update([
                            'status' => 'connecting',
                            'last_activity_at' => now()
                        ]);
                        
                        $synced++;
                    } else {
                        $this->error("  ❌ Error creando instancia: " . $createResponse->body());
                        $failed++;
                    }
                }
                
            } catch (\Exception $e) {
                $this->error("  ❌ Error: " . $e->getMessage());
                $failed++;
            }
        }
        
        $this->newLine();
        $this->info("📊 Resumen:");
        $this->info("  ✅ Sincronizadas: {$synced}");
        $this->info("  ❌ Fallidas: {$failed}");
        $this->newLine();
        
        if ($synced > 0) {
            $this->info("💡 Ahora puedes:");
            $this->info("  1. Ir a la UI de Configuración Masiva");
            $this->info("  2. Hacer clic en 'QR' para cada instancia");
            $this->info("  3. Escanear el código QR con WhatsApp");
            $this->info("  4. Una vez conectadas, podrás enviar mensajes");
        }
        
        return 0;
    }
}