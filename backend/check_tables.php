<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use Illuminate\Support\Facades\DB;

echo "Verificando tablas de WhatsApp...\n\n";

try {
    $tables = DB::select("SHOW TABLES LIKE 'whats%'");
    
    if (empty($tables)) {
        echo "❌ No se encontraron tablas que empiecen con 'whats'\n";
    } else {
        echo "✅ Tablas encontradas:\n";
        foreach ($tables as $table) {
            $tableName = array_values((array)$table)[0];
            echo "  - $tableName\n";
        }
    }
    
    echo "\n";
    
    // Verificar tabla campaign_templates
    $campaignTemplates = DB::select("SHOW TABLES LIKE 'campaign_templates'");
    if (!empty($campaignTemplates)) {
        echo "✅ Tabla campaign_templates existe\n";
    } else {
        echo "❌ Tabla campaign_templates NO existe\n";
    }
    
} catch (\Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}