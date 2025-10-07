<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use Illuminate\Support\Facades\DB;

echo "Verificando datos de campañas para broker_id = 3...\n\n";

try {
    // Verificar campañas
    $campaigns = DB::table('campaigns')->where('broker_id', 3)->count();
    echo "📊 Campañas: $campaigns\n";
    
    // Verificar mensajes de campaña
    $messages = DB::table('campaign_messages')->where('broker_id', 3)->count();
    echo "📨 Mensajes de campaña: $messages\n";
    
    // Verificar ejecuciones
    $executions = DB::table('campaign_executions')->where('broker_id', 3)->count();
    echo "🚀 Ejecuciones: $executions\n";
    
    // Verificar instancias WhatsApp
    $instances = DB::table('whats_app_instances')->where('broker_id', 3)->count();
    echo "📱 Instancias WhatsApp: $instances\n";
    
    echo "\n";
    
    if ($campaigns > 0) {
        echo "Últimas 3 campañas:\n";
        $latestCampaigns = DB::table('campaigns')
            ->where('broker_id', 3)
            ->orderBy('created_at', 'desc')
            ->limit(3)
            ->get(['id', 'name', 'status', 'campaign_type', 'created_at']);
        
        foreach ($latestCampaigns as $campaign) {
            echo "  - ID: {$campaign->id}, Nombre: {$campaign->name}, Estado: {$campaign->status}, Tipo: {$campaign->campaign_type}\n";
        }
    }
    
    echo "\n";
    
    if ($messages > 0) {
        echo "Estadísticas de mensajes:\n";
        $stats = DB::table('campaign_messages')
            ->where('broker_id', 3)
            ->select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->get();
        
        foreach ($stats as $stat) {
            echo "  - {$stat->status}: {$stat->total}\n";
        }
    }
    
} catch (\Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}