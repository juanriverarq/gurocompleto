<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\CampaignMessage;
use Carbon\Carbon;

echo "Agregando mensajes de prueba con diferentes estados y fechas...\n\n";

try {
    $brokerId = 3;
    $campaignId = 61; // Última campaña
    $executionId = 78; // Última ejecución válida
    
    // Crear mensajes con diferentes estados y fechas para los últimos 30 días
    $statuses = ['sent', 'delivered', 'read', 'failed', 'pending'];
    $phones = [
        '+573001111111',
        '+573002222222',
        '+573003333333',
        '+573004444444',
        '+573005555555',
        '+573006666666',
        '+573007777777',
        '+573008888888',
        '+573009999999',
        '+573000000000'
    ];
    
    $messagesCreated = 0;
    
    // Crear mensajes para los últimos 30 días
    for ($day = 29; $day >= 0; $day--) {
        $date = Carbon::now()->subDays($day);
        
        // Crear entre 2 y 5 mensajes por día
        $messagesPerDay = rand(2, 5);
        
        for ($i = 0; $i < $messagesPerDay; $i++) {
            $phone = $phones[array_rand($phones)];
            $status = $statuses[array_rand($statuses)];
            
            // Calcular timestamps según el estado
            $createdAt = $date->copy()->addHours(rand(8, 18))->addMinutes(rand(0, 59));
            $sentAt = null;
            $deliveredAt = null;
            $readAt = null;
            $failedAt = null;
            
            if (in_array($status, ['sent', 'delivered', 'read'])) {
                $sentAt = $createdAt->copy()->addSeconds(rand(1, 5));
            }
            
            if (in_array($status, ['delivered', 'read'])) {
                $deliveredAt = $sentAt->copy()->addSeconds(rand(5, 30));
            }
            
            if ($status === 'read') {
                $readAt = $deliveredAt->copy()->addMinutes(rand(1, 60));
            }
            
            if ($status === 'failed') {
                $failedAt = $createdAt->copy()->addSeconds(rand(1, 10));
            }
            
            CampaignMessage::create([
                'campaign_id' => $campaignId,
                'campaign_execution_id' => $executionId,
                'broker_id' => $brokerId,
                'recipient_phone' => $phone,
                'recipient_name' => 'Cliente ' . substr($phone, -4),
                'message_content' => 'Mensaje de prueba para análisis de métricas',
                'status' => $status,
                'sent_at' => $sentAt,
                'delivered_at' => $deliveredAt,
                'read_at' => $readAt,
                'failed_at' => $failedAt,
                'error_message' => $status === 'failed' ? 'Error de prueba' : null,
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);
            
            $messagesCreated++;
        }
    }
    
    echo "✅ Se crearon $messagesCreated mensajes de prueba\n";
    
    // Mostrar estadísticas finales
    echo "\nEstadísticas finales:\n";
    $stats = CampaignMessage::where('broker_id', $brokerId)
        ->select('status', DB::raw('count(*) as total'))
        ->groupBy('status')
        ->get();
    
    foreach ($stats as $stat) {
        echo "  - {$stat->status}: {$stat->total}\n";
    }
    
} catch (\Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}