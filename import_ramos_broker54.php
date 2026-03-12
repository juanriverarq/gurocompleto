<?php
// Import ramos from Excel JSON for broker 54 (seguros.santamaria@gmail.com)
require_once '/home/guro/public_html/app.guro.co/vendor/autoload.php';

$app = require_once '/home/guro/public_html/app.guro.co/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Ramo;
use App\Models\Aseguradora;
use Illuminate\Support\Facades\DB;

$brokerId = 54;
$jsonFile = '/home/guro/ramos_import_data.json';

if (!file_exists($jsonFile)) {
    echo "ERROR: JSON file not found at {$jsonFile}\n";
    exit(1);
}

$data = json_decode(file_get_contents($jsonFile), true);

// Load existing aseguradoras indexed by normalized name
$aseguradoras = Aseguradora::withoutGlobalScopes()->where('broker_id', $brokerId)->get();
$asegMap = [];
foreach ($aseguradoras as $a) {
    $asegMap[mb_strtoupper(trim($a->nombre))] = $a;
}

// Normalize function for matching aseguradora names
function normalizeAseg($name) {
    $name = mb_strtoupper(trim($name));
    // Remove trailing S.A, S.A., etc
    $name = preg_replace('/\s+S\.?A\.?\s*$/', '', $name);
    $name = preg_replace('/\s+SEGUROS\s*$/', '', $name);
    $name = trim($name);
    return $name;
}

// Build flexible aseg lookup
$asegLookup = [];
foreach ($aseguradoras as $a) {
    $n = mb_strtoupper(trim($a->nombre));
    $asegLookup[$n] = $a;
    $asegLookup[normalizeAseg($n)] = $a;
}

function findAseg($name) {
    global $asegLookup, $asegMap;
    $upper = mb_strtoupper(trim($name));
    
    // Exact match
    if (isset($asegMap[$upper])) return $asegMap[$upper];
    if (isset($asegLookup[$upper])) return $asegLookup[$upper];
    
    // Normalized match
    $norm = normalizeAseg($upper);
    if (isset($asegLookup[$norm])) return $asegLookup[$norm];
    
    // Partial contains
    foreach ($asegLookup as $key => $aseg) {
        if (str_contains($key, $norm) || str_contains($norm, $key)) {
            return $aseg;
        }
    }
    
    // Special mappings
    $special = [
        'BOLIVAR' => 'SEGUROS BOLIVAR',
        'LIBERTY' => 'LIBERTY SEGUROS S.A.',
        'EQUIDAD' => 'LA EQUIDAD SEGUROS',
        'PREVISORA SEGUROS' => 'PREVISORA',
        'PREVISORA' => 'PREVISORA',
        'SEGUROS DEL ESTADO' => 'SEGUROS DEL ESTADO S.A',
        'SEGUROS DEL ESTADO S.A.' => 'SEGUROS DEL ESTADO S.A',
        'ALLIANZ SEGUROS' => 'ALLIANZ SEGUROS',
        'ALLIANZ SEGUROS S.A' => 'ALLIANZ SEGUROS',
        'AXA COLPATRIA' => 'AXA COLPATRIA SEGUROS S.A.',
        'MAPFRE' => 'MAPFRE',
        'SURA' => 'SURA',
    ];
    
    if (isset($special[$upper])) {
        $mapped = mb_strtoupper($special[$upper]);
        if (isset($asegMap[$mapped])) return $asegMap[$mapped];
        if (isset($asegLookup[$mapped])) return $asegLookup[$mapped];
    }
    
    return null;
}

// Load existing ramos
$existingRamos = Ramo::withoutGlobalScopes()->where('broker_id', $brokerId)->get();
$existingRamoMap = [];
foreach ($existingRamos as $r) {
    $existingRamoMap[mb_strtoupper(trim($r->nombre))] = $r;
}

$ramosCreated = 0;
$ramosUpdated = 0;
$comisionesCreated = 0;
$comisionesUpdated = 0;
$asegNotFound = [];

DB::beginTransaction();

try {
    foreach ($data as $ramoName => $info) {
        $ramoUpper = mb_strtoupper(trim($ramoName));
        $subramos = $info['subramos'];
        $comisiones = $info['comisiones'];
        
        // Check if ramo exists
        $ramo = $existingRamoMap[$ramoUpper] ?? null;
        
        if ($ramo) {
            // Merge subramos with existing
            $existingSubs = $ramo->subramo; // already array via accessor
            $allSubs = array_values(array_unique(array_merge($existingSubs, $subramos)));
            sort($allSubs);
            $ramo->subramo = $allSubs;
            $ramo->save();
            $ramosUpdated++;
        } else {
            // Create new ramo
            $ramo = Ramo::withoutGlobalScopes()->create([
                'broker_id' => $brokerId,
                'nombre' => $ramoName,
                'subramo' => $subramos,
                'calcular_iva_pri_a_pre' => false,
                'vista_mapa_oportunidad' => false,
            ]);
            $ramosCreated++;
        }
        
        // Process comisiones
        foreach ($comisiones as $com) {
            $aseg = findAseg($com['aseg']);
            if (!$aseg) {
                $asegNotFound[$com['aseg']] = true;
                continue;
            }
            
            $existing = DB::table('comisiones_aseguradoras')
                ->where('ramo_id', $ramo->id)
                ->where('aseguradora_id', $aseg->id)
                ->first();
            
            if ($existing) {
                // Update if comision is different and non-zero
                if ($com['comision'] > 0 && abs($existing->porcentaje_comision - $com['comision']) > 0.01) {
                    DB::table('comisiones_aseguradoras')
                        ->where('id', $existing->id)
                        ->update([
                            'porcentaje_comision' => $com['comision'],
                            'porcentaje_iva' => $com['iva'],
                            'updated_at' => now(),
                        ]);
                    $comisionesUpdated++;
                }
            } else {
                DB::table('comisiones_aseguradoras')->insert([
                    'ramo_id' => $ramo->id,
                    'aseguradora_id' => $aseg->id,
                    'porcentaje_comision' => $com['comision'],
                    'porcentaje_iva' => $com['iva'],
                    'pri_a_pre_por_defecto' => 0,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $comisionesCreated++;
            }
        }
    }
    
    DB::commit();
    
    echo "\n=== Import Complete ===\n";
    echo "Ramos created: {$ramosCreated}\n";
    echo "Ramos updated (subramos merged): {$ramosUpdated}\n";
    echo "Comisiones created: {$comisionesCreated}\n";
    echo "Comisiones updated: {$comisionesUpdated}\n";
    
    if (!empty($asegNotFound)) {
        echo "\nAseguradoras not found (" . count($asegNotFound) . "):\n";
        foreach (array_keys($asegNotFound) as $a) {
            echo "  - {$a}\n";
        }
    }
    
} catch (\Exception $e) {
    DB::rollBack();
    echo "ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}
