<?php

/**
 * Script para sincronizar instancias de WhatsApp entre Laravel y el Microservicio
 * 
 * Uso: php sync_whatsapp_instances.php
 */

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\WhatsAppInstance;
use Illuminate\Support\Facades\Http;

echo "🔄 SINCRONIZANDO INSTANCIAS DE WHATSAPP\n";
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

$microserviceUrl = env('WHATSAPP_SERVICE_URL', 'http://127.0.0.1:3000/api/v1');

// 1. Obtener instancias del microservicio
echo "📡 Consultando instancias en microservicio...\n";
try {
    $response = Http::timeout(5)->get("{$microserviceUrl}/instances");
    
    if (!$response->successful()) {
        echo "❌ Error: Microservicio no responde (código {$response->status()})\n";
        echo "   Verifica que el microservicio esté corriendo en puerto 3000\n";
        exit(1);
    }
    
    $microserviceData = $response->json();
    $microserviceInstances = collect($microserviceData['instances'] ?? [])
        ->pluck('instanceId')
        ->toArray();
    
    echo "✅ Microservicio tiene " . count($microserviceInstances) . " instancias\n";
    foreach ($microserviceInstances as $instId) {
        echo "   - {$instId}\n";
    }
    echo "\n";
    
} catch (\Exception $e) {
    echo "❌ Error conectando al microservicio: {$e->getMessage()}\n";
    echo "   Verifica que esté corriendo: cd whatsapp && npm run dev\n";
    exit(1);
}

// 2. Obtener instancias de la base de datos
echo "💾 Consultando instancias en base de datos...\n";
$dbInstances = WhatsAppInstance::where('is_active', true)->get();
echo "✅ Base de datos tiene {$dbInstances->count()} instancias activas\n\n";

// 3. Sincronizar: Crear instancias faltantes en microservicio
echo "🔄 Sincronizando instancias...\n";
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

$created = 0;
$existing = 0;
$errors = 0;

foreach ($dbInstances as $instance) {
    $instanceId = $instance->instance_id;
    
    // Verificar si ya existe en microservicio
    if (in_array($instanceId, $microserviceInstances)) {
        echo "✓ {$instanceId} - Ya existe en microservicio\n";
        $existing++;
        continue;
    }
    
    // Crear en microservicio
    echo "🆕 {$instanceId} - Creando en microservicio...\n";
    
    try {
        $createResponse = Http::timeout(10)->post("{$microserviceUrl}/instances", [
            'instanceId' => $instanceId,
            'webhook' => $instance->webhook_url,
            'settings' => $instance->settings ?? []
        ]);
        
        if ($createResponse->successful()) {
            echo "   ✅ Creada exitosamente\n";
            $created++;
            
            // Esperar un momento para que se conecte
            sleep(2);
            
            // Verificar estado
            $statusResponse = Http::timeout(5)->get("{$microserviceUrl}/instances/{$instanceId}/status");
            if ($statusResponse->successful()) {
                $statusData = $statusResponse->json();
                $connected = $statusData['connected'] ?? false;
                $status = $statusData['status'] ?? 'unknown';
                
                echo "   📊 Estado: {$status} " . ($connected ? '✅ Conectada' : '⚠️  No conectada') . "\n";
                
                // Actualizar estado en BD
                $instance->update([
                    'status' => $connected ? 'connected' : 'connecting',
                    'last_activity_at' => now()
                ]);
            }
        } else {
            echo "   ❌ Error: {$createResponse->body()}\n";
            $errors++;
        }
        
    } catch (\Exception $e) {
        echo "   ❌ Exception: {$e->getMessage()}\n";
        $errors++;
    }
    
    echo "\n";
}

// 4. Resumen
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
echo "📊 RESUMEN DE SINCRONIZACIÓN\n";
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
echo "✅ Instancias creadas: {$created}\n";
echo "✓  Instancias existentes: {$existing}\n";
echo "❌ Errores: {$errors}\n";
echo "📊 Total en microservicio: " . ($existing + $created) . "\n";
echo "\n";

if ($created > 0) {
    echo "⚠️  IMPORTANTE: Las instancias creadas necesitan conectarse.\n";
    echo "   Si tienen credenciales guardadas, se conectarán automáticamente.\n";
    echo "   Si no, necesitarás escanear el código QR desde la UI.\n";
    echo "\n";
}

echo "✅ Sincronización completada\n";
echo "\n";
echo "🔗 Próximos pasos:\n";
echo "   1. Verifica las instancias: curl http://localhost:3000/api/v1/instances\n";
echo "   2. Ejecuta tu campaña desde la UI\n";
echo "   3. Monitorea los logs en Terminal 1 y Terminal 3\n";