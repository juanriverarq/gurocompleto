<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\EmailCampaign;
use App\Models\EmailCampaignRecipient;

echo "=== TEST: Email Campaign Stats ===\n\n";

// Obtener todas las campañas
$campaigns = EmailCampaign::orderBy('id', 'desc')->limit(5)->get();

if ($campaigns->isEmpty()) {
    echo "❌ No hay campañas de email en la base de datos\n";
    exit(1);
}

echo "📊 Campañas encontradas: " . $campaigns->count() . "\n\n";

foreach ($campaigns as $campaign) {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    echo "📧 Campaña ID: {$campaign->id}\n";
    echo "   Nombre: {$campaign->name}\n";
    echo "   Estado: {$campaign->status}\n";
    echo "   Creada: {$campaign->created_at}\n";
    echo "   Última sincronización: " . ($campaign->last_stats_sync ?? 'Nunca') . "\n";
    echo "\n";
    
    // Contar recipients por estado
    $total = $campaign->recipients()->count();
    $pending = $campaign->recipients()->where('status', 'pending')->count();
    $sent = $campaign->recipients()->whereIn('status', ['sent', 'delivered', 'opened', 'clicked'])->count();
    $delivered = $campaign->recipients()->whereIn('status', ['delivered', 'opened', 'clicked'])->count();
    $opened = $campaign->recipients()->whereIn('status', ['opened', 'clicked'])->count();
    $clicked = $campaign->recipients()->where('status', 'clicked')->count();
    $failed = $campaign->recipients()->where('status', 'failed')->count();
    
    echo "   📊 Conteo directo de recipients:\n";
    echo "      Total: {$total}\n";
    echo "      Pendientes: {$pending}\n";
    echo "      Enviados: {$sent}\n";
    echo "      Entregados: {$delivered}\n";
    echo "      Abiertos: {$opened}\n";
    echo "      Clicks: {$clicked}\n";
    echo "      Fallidos: {$failed}\n";
    echo "\n";
    
    // Stats actuales en stats_json
    $currentStats = $campaign->stats_json ?? [];
    echo "   📈 Stats actuales en stats_json:\n";
    echo "      " . json_encode($currentStats, JSON_PRETTY_PRINT) . "\n";
    echo "\n";
    
    // Refrescar stats
    echo "   🔄 Refrescando stats...\n";
    $campaign->refreshStats();
    $campaign->refresh();
    
    $newStats = $campaign->stats_json ?? [];
    echo "   ✅ Stats después de refresh:\n";
    echo "      " . json_encode($newStats, JSON_PRETTY_PRINT) . "\n";
    echo "\n";
    
    // Mostrar algunos recipients de ejemplo
    $sampleRecipients = $campaign->recipients()->limit(5)->get(['id', 'email', 'status', 'sent_at', 'delivered_at', 'opened_at', 'clicked_at']);
    if ($sampleRecipients->isNotEmpty()) {
        echo "   👥 Muestra de recipients:\n";
        foreach ($sampleRecipients as $r) {
            echo "      - {$r->email}: {$r->status}\n";
            if ($r->sent_at) echo "        Enviado: {$r->sent_at}\n";
            if ($r->delivered_at) echo "        Entregado: {$r->delivered_at}\n";
            if ($r->opened_at) echo "        Abierto: {$r->opened_at}\n";
            if ($r->clicked_at) echo "        Click: {$r->clicked_at}\n";
        }
        echo "\n";
    }
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
echo "✅ Test completado\n";