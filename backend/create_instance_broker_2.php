<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\WhatsAppInstance;
use Illuminate\Support\Str;

// Crear instancia para broker_id 2
$instanceId = 'instance_2_' . Str::random(8);

$instance = WhatsAppInstance::create([
    'broker_id' => 2,
    'instance_id' => $instanceId,
    'phone_number' => null, // Se actualizará cuando se conecte
    'status' => 'disconnected',
    'is_active' => true,
    'webhook_url' => env('APP_URL') . '/api/webhooks/whatsapp',
    'settings' => [
        'auto_reconnect' => true,
        'max_retries' => 3
    ]
]);

echo "✅ Instancia creada exitosamente:\n";
echo json_encode([
    'id' => $instance->id,
    'instance_id' => $instance->instance_id,
    'broker_id' => $instance->broker_id,
    'status' => $instance->status,
    'is_active' => $instance->is_active
], JSON_PRETTY_PRINT);
echo "\n\n";
echo "📱 Ahora ve a http://localhost:5174/apps/saas/configuracion-masiva\n";
echo "   y conecta esta instancia escaneando el código QR.\n";