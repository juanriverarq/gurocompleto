<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$campaignId = $argv[1] ?? 65;

$campaign = App\Models\Campaign::find($campaignId);

if (!$campaign) {
    echo "❌ Campaña no encontrada\n";
    exit(1);
}

echo "📋 DATOS DE CAMPAÑA #{$campaign->id}\n";
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
echo "Nombre: {$campaign->name}\n";
echo "Estado: {$campaign->status}\n";
echo "Activa: " . ($campaign->is_active ? 'SI' : 'NO') . "\n";
echo "Tipo: {$campaign->campaign_type}\n";
echo "Broker ID: {$campaign->broker_id}\n";
echo "WhatsApp Instance ID: " . ($campaign->whatsapp_instance_id ?? 'NULL') . "\n";
echo "Total Targets: {$campaign->total_targets}\n";
echo "Contactos: " . (is_array($campaign->contacts) ? count($campaign->contacts) : 0) . "\n";
echo "\n";

if ($campaign->whatsapp_instance_id) {
    $instance = App\Models\WhatsAppInstance::find($campaign->whatsapp_instance_id);
    if ($instance) {
        echo "📱 INSTANCIA DE WHATSAPP\n";
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
        echo "ID: {$instance->id}\n";
        echo "Instance ID: {$instance->instance_id}\n";
        echo "Estado: {$instance->status}\n";
        echo "Teléfono: " . ($instance->phone_number ?? 'NULL') . "\n";
        echo "Activa: " . ($instance->is_active ? 'SI' : 'NO') . "\n";
        echo "Última conexión: " . ($instance->last_connected_at ?? 'NUNCA') . "\n";
        echo "\n";
    } else {
        echo "❌ Instancia de WhatsApp no encontrada (ID: {$campaign->whatsapp_instance_id})\n\n";
    }
}

if (is_array($campaign->contacts) && count($campaign->contacts) > 0) {
    echo "👥 PRIMEROS 3 CONTACTOS\n";
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    $first3 = array_slice($campaign->contacts, 0, 3);
    foreach ($first3 as $i => $contact) {
        echo ($i + 1) . ". ";
        echo "Nombre: " . ($contact['name'] ?? 'N/A') . " | ";
        echo "Teléfono: " . ($contact['phone'] ?? 'N/A') . "\n";
    }
    echo "\n";
}

// Verificar ejecuciones
$executions = App\Models\CampaignExecution::where('campaign_id', $campaign->id)
    ->orderBy('created_at', 'desc')
    ->take(3)
    ->get();

if ($executions->count() > 0) {
    echo "🔄 ÚLTIMAS EJECUCIONES\n";
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    foreach ($executions as $exec) {
        echo "ID: {$exec->id} | ";
        echo "Estado: {$exec->status} | ";
        echo "Enviados: {$exec->messages_sent} | ";
        echo "Fallidos: {$exec->messages_failed} | ";
        echo "Fecha: {$exec->created_at}\n";
    }
} else {
    echo "ℹ️  No hay ejecuciones registradas\n";
}