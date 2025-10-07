<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\WhatsAppInstance;
use Illuminate\Support\Str;

echo "Creando instancia de WhatsApp de prueba para broker_id = 3...\n\n";

try {
    $brokerId = 3;
    $instanceId = 'instance_' . $brokerId . '_' . Str::random(8);
    
    $instance = WhatsAppInstance::create([
        'broker_id' => $brokerId,
        'instance_id' => $instanceId,
        'phone_number' => '+573001234567',
        'status' => 'disconnected',
        'webhook_url' => null,
        'settings' => [],
        'is_active' => true,
        'reconnect_attempts' => 0,
    ]);
    
    echo "✅ Instancia creada exitosamente:\n";
    echo "  - ID: {$instance->id}\n";
    echo "  - Instance ID: {$instance->instance_id}\n";
    echo "  - Teléfono: {$instance->phone_number}\n";
    echo "  - Estado: {$instance->status}\n";
    echo "  - Broker ID: {$instance->broker_id}\n";
    
} catch (\Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}