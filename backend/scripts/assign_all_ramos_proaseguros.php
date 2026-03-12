<?php
/**
 * Assign ALL ramos to ALL aseguradoras for broker proaseguros.
 * If a comision entry already exists, skip it. Otherwise create with 0%.
 * Uses comisiones_aseguradoras table (ComisionAseguradora model).
 * 
 * Usage: /opt/cpanel/ea-php83/root/usr/bin/php scripts/assign_all_ramos_proaseguros.php
 */

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\User;
use App\Models\Aseguradora;
use App\Models\Ramo;
use App\Models\ComisionAseguradora;
use Illuminate\Support\Facades\DB;

$user = User::where('email', 'proaseguros.com.co@gmail.com')->first();
if (!$user) { echo "USER NOT FOUND\n"; exit; }
$brokerId = $user->broker_id;
echo "BROKER ID: {$brokerId}\n\n";

// Get all aseguradoras and ramos for this broker
$aseguradoras = Aseguradora::where('broker_id', $brokerId)->get();
$ramos = Ramo::where('broker_id', $brokerId)->get();

echo "Aseguradoras: " . $aseguradoras->count() . "\n";
echo "Ramos: " . $ramos->count() . "\n";
echo "Combinaciones posibles: " . ($aseguradoras->count() * $ramos->count()) . "\n\n";

// Get existing comisiones for this broker's ramos
$ramoIds = $ramos->pluck('id')->toArray();
$existing = DB::table('comisiones_aseguradoras')
    ->whereIn('ramo_id', $ramoIds)
    ->get(['aseguradora_id', 'ramo_id'])
    ->map(fn($c) => $c->aseguradora_id . '-' . $c->ramo_id)
    ->toArray();

$existingSet = array_flip($existing);
echo "Comisiones existentes: " . count($existing) . "\n\n";

$created = 0;
$skipped = 0;
$batch = [];

foreach ($aseguradoras as $aseg) {
    foreach ($ramos as $ramo) {
        $key = $aseg->id . '-' . $ramo->id;
        if (isset($existingSet[$key])) {
            $skipped++;
            continue;
        }
        
        $batch[] = [
            'aseguradora_id' => $aseg->id,
            'ramo_id' => $ramo->id,
            'porcentaje_comision' => 0,
            'porcentaje_iva' => 0,
            'pri_a_pre_por_defecto' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ];
        $created++;
        
        // Insert in batches of 500
        if (count($batch) >= 500) {
            DB::table('comisiones_aseguradoras')->insert($batch);
            $batch = [];
        }
    }
}

// Insert remaining
if (!empty($batch)) {
    DB::table('comisiones_aseguradoras')->insert($batch);
}

$total = DB::table('comisiones_aseguradoras')
    ->whereIn('ramo_id', $ramoIds)
    ->count();

echo "Resultado:\n";
echo "  Skipped (ya existían): {$skipped}\n";
echo "  Creadas nuevas (0%): {$created}\n";
echo "  Total comisiones ahora: {$total}\n";
echo "\nDone!\n";
