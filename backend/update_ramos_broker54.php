<?php
/**
 * Script to normalize ramos, subramos, and aseguradoras for broker 54
 * Based on produccion_total.xlsx data
 * 
 * Run: /opt/cpanel/ea-php83/root/usr/bin/php update_ramos_broker54.php
 */

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

$brokerId = 54;

// ===== 1. DEFINE TARGET RAMOS FROM XLSX =====
$targetRamos = [
    'ACCIDENTES PERSONALES' => ['AP DECRETO', 'AP DEPORTISTAS', 'AP ESCOLARES', 'AP EVENTOS', 'AP OBREROS'],
    'ARRENDAMIENTO' => ['ARRENDAMIENTO'],
    'AUTOMOVILES' => ['LIVIANOS', 'MOTO', 'PESADOS'],
    'CASCO' => ['RCC'],
    'COPROPIEDADES' => ['COPROPIEDADES VIVIENDA'],
    'CUMPLIMIENTO' => ['CUMPLIMIENTO DISPOSICION LEGAL', 'CUMPLIMIENTO ESTATAL', 'CUMPLIMIENTO PARTICULAR', 'RESPONSABILIDAD CIVIL EXTRACONTRACTUAL DERRIVADA DE CUMPLIMIENTO'],
    'HOGAR' => ['HOGAR'],
    'INCENDIO' => ['INCENDIO'],
    'JUDICIAL' => ['JUDICIAL'],
    'MANEJO' => ['MANEJO'],
    'MULTIRIESGO' => ['MULTIRRIESGOS'],
    'PYME' => ['PYMES'],
    'RESPONSABILIDAD CIVIL' => ['RESPONSABILIDAD CIVIL CLINICAS Y CENTROS MEDICOS', 'RESPONSABILIDAD CIVIL DIRECTORES Y ADMINISTRADORES', 'RESPONSABILIDAD CIVIL EXTRACONTRACTUAL CARGA', 'RESPONSABILIDAD CIVIL EXTRACONTRACTUAL EVENTOS', 'RESPONSABILIDAD CIVIL EXTRACONTRACTUAL PASAJEROS COLECTIVA', 'RESPONSABILIDAD CIVIL EXTRACONTRACTUAL PASAJEROS INDIVIDUAL', 'RESPONSABILIDAD CIVIL PROFESIONAL CDA', 'RESPONSABILIDAD CIVIL PROFESIONAL MEDICA'],
    'SOAT' => ['EXTRANJERO', 'NACIONAL'],
    'TODO RIESGO MAQUINARIA Y EQUIPO' => ['MAQUINARIA AMARILLA'],
    'TRANSPORTE' => ['TRANSPORTE DE MERCANCIA'],
    'VIAJE' => ['VIAJE'],
    'VIDA' => ['VIDA GRUPO DEUDORES', 'VIDA INDIVIDUAL'],
    'VIDA GRUPO' => ['VIDA GRUPO DOCENTES', 'VIDA GRUPO'],
];

// ===== 2. MAP OLD RAMO NAMES TO NEW CANONICAL NAMES =====
// Key = old name (case-insensitive match), Value = target ramo name
$ramoMergeMap = [
    // ACCIDENTES PERSONALES variants
    'ACCIDENTES' => 'ACCIDENTES PERSONALES',
    'Accidentes Personales' => 'ACCIDENTES PERSONALES',
    'SEGUROS DE ACCIDENTES' => 'ACCIDENTES PERSONALES',
    'AP OBREROS' => 'ACCIDENTES PERSONALES',
    'AP ESCOLARES' => 'ACCIDENTES PERSONALES',
    
    // AUTOMOVILES variants
    'Automóvil' => 'AUTOMOVILES',
    'AUTOS/VEHÍCULOS' => 'AUTOMOVILES',
    'VENTA DE VEHÍCULO' => 'AUTOMOVILES',
    
    // CUMPLIMIENTO variants
    'CUMPLIMIENTO DE CONTRATO' => 'CUMPLIMIENTO',
    'BUEN USO DE ANTICIPO' => 'CUMPLIMIENTO',
    'SERIEDAD DE OFERTA' => 'CUMPLIMIENTO',
    'EJECUCIÓN DE OBRA Y BUENA CALIDAD DE MATERIALES' => 'CUMPLIMIENTO',
    'GARANTÍAS ADUANERAS' => 'CUMPLIMIENTO',
    'OBRAS CIVILES TERMINADAS' => 'CUMPLIMIENTO',
    
    // HOGAR variants
    'Hogar' => 'HOGAR',
    
    // INCENDIO variants
    'Incendio' => 'INCENDIO',
    'INCENDIO Y LÍNEAS ALIADAS' => 'INCENDIO',
    'TERREMOTO' => 'INCENDIO',
    
    // JUDICIAL variants
    'JURÍDICA' => 'JUDICIAL',
    
    // MANEJO variants
    'FIDELIDAD' => 'MANEJO',
    'DINERO Y VALORES' => 'MANEJO',
    'FIANZAS/ROBO/SUSTRACCIÓN' => 'MANEJO',
    'ROBO O ASALTO' => 'MANEJO',
    
    // MULTIRIESGO variants
    'DAÑOS MATERIALES' => 'MULTIRIESGO',
    'RIESGOS DIVERSOS' => 'MULTIRIESGO',
    'RIESGOS ESPECIALES' => 'MULTIRIESGO',
    
    // PYME variants
    'Empresarial' => 'PYME',
    'PYME' => 'PYME',
    
    // RESPONSABILIDAD CIVIL variants
    'Responsabilidad Civil' => 'RESPONSABILIDAD CIVIL',
    'RESPONSABILIDAD CIVIL DIRECTORES  Y ADMINISTRADORES' => 'RESPONSABILIDAD CIVIL',
    'RESPONSABILIDAD CIVIL PARA PARQUEADEROS' => 'RESPONSABILIDAD CIVIL',
    'RESPONSABILIDAD CIVIL PARA PROFESIONALES MÉDICOS' => 'RESPONSABILIDAD CIVIL',
    'RESPONSABILIDAD CIVIL CONTRA Y EXTRA' => 'RESPONSABILIDAD CIVIL',
    
    // SOAT variants  
    'SOAT' => 'SOAT',
    
    // TODO RIESGO MAQUINARIA Y EQUIPO variants
    'Todo Riesgo' => 'TODO RIESGO MAQUINARIA Y EQUIPO',
    'TODO RIESGO' => 'TODO RIESGO MAQUINARIA Y EQUIPO',
    'TODO RIESGO CONSTRUCCIÓN' => 'TODO RIESGO MAQUINARIA Y EQUIPO',
    'TODO RIESGO CONTRATISTA' => 'TODO RIESGO MAQUINARIA Y EQUIPO',
    'MAQUINARIA Y EQUIPO/ROTURA MAQUINARIA' => 'TODO RIESGO MAQUINARIA Y EQUIPO',
    'EQUIPO Y MAQUINARIA DE CONTRATISTA' => 'TODO RIESGO MAQUINARIA Y EQUIPO',
    'MONTAJE DE MAQUINARIA' => 'TODO RIESGO MAQUINARIA Y EQUIPO',
    'ROTURA DE MAQUINARIA' => 'TODO RIESGO MAQUINARIA Y EQUIPO',
    'PÉRDIDA DE BENEFICIO POR ROTURA DE MAQUINARIA' => 'TODO RIESGO MAQUINARIA Y EQUIPO',
    'EQUIPO ELÉCTRICO' => 'TODO RIESGO MAQUINARIA Y EQUIPO',
    'INGENIERÍA' => 'TODO RIESGO MAQUINARIA Y EQUIPO',
    
    // TRANSPORTE variants
    'Transporte' => 'TRANSPORTE',
    'MARÍTIMO' => 'TRANSPORTE',
    'AVIACIÓN' => 'TRANSPORTE',
    
    // CASCO  
    'CASCO' => 'CASCO',
    
    // COPROPIEDADES
    'COPROPIEDADES' => 'COPROPIEDADES',
    
    // ARRENDAMIENTO
    'ARRENDAMIENTO' => 'ARRENDAMIENTO',
    
    // VIAJE
    'VIAJES/TURISMO' => 'VIAJE',
    
    // VIDA variants
    'Vida' => 'VIDA',
    'VIDA' => 'VIDA',
    'VIDA INDIVIDUAL' => 'VIDA',
    'VIDA DEUDORES' => 'VIDA',
    'VIDA LEY' => 'VIDA',
    
    // VIDA GRUPO variants
    'VIDA GRUPO' => 'VIDA GRUPO',
    
    // Ramos that don't fit cleanly - map to closest
    'COLECTIVO' => 'ACCIDENTES PERSONALES',
    'SALUD' => 'VIDA',
    'Salud' => 'VIDA',
    'ARL' => 'VIDA',
    'AHORRO' => 'VIDA',
    'EPS' => 'VIDA',
    'SCTR' => 'VIDA',
    'MEDICINA PREPAGADA' => 'VIDA',
    'PLAN COMPLEMENTARIO' => 'VIDA',
    'POS' => 'VIDA',
    'ONCOLÓGICO' => 'VIDA',
    'ENFERMEDADES' => 'VIDA',
    'GASTOS MÉDICOS' => 'VIDA',
    'MÉDICOS' => 'VIDA',
    'ASISTENCIA MÉDICA' => 'VIDA',
    'RENTA PENSIONAL' => 'VIDA',
    'RENTA EDUCATIVA' => 'VIDA',
    'EXEQUIAS' => 'VIDA',
    'FORMACIÓN LABORAL' => 'VIDA',
    'PERSONAS' => 'ACCIDENTES PERSONALES',
    'ESTUDIANTIL' => 'ACCIDENTES PERSONALES',
    'EDUCATIVO' => 'ACCIDENTES PERSONALES',
    'GENERALES' => 'MULTIRIESGO',
    'PATRIMONIALES' => 'MULTIRIESGO',
    'OTROS' => 'MULTIRIESGO',
    'MICROSEGURO' => 'MULTIRIESGO',
    'MASCOTAS' => 'MULTIRIESGO',
    'VIDRIOS' => 'MULTIRIESGO',
    'OBLIGATORIOS' => 'SOAT',
    'PROTECCIÓN DE DATOS' => 'RESPONSABILIDAD CIVIL',
    'RIESGOS FINANCIEROS' => 'CUMPLIMIENTO',
    'SEGURO DE CRÉDITO' => 'CUMPLIMIENTO',
    'CRÉDITO Y CAUCIÓN' => 'CUMPLIMIENTO',
    'BANCOS E INSTITUCIONES FINANCIERAS (BBB)' => 'CUMPLIMIENTO',
    'FINANCIACIÓN DE PRIMAS' => 'MULTIRIESGO',
    'FINANCIACIÓN PRIMAS' => 'MULTIRIESGO',
    'INVERSIÓN' => 'VIDA',
    'TÍTULO CAPITALIZACIÓN' => 'VIDA',
    'LUCRO CESANTE' => 'INCENDIO',
    'AGROPECUARIO' => 'MULTIRIESGO',
];

// ===== 3. ASEGURADORA MERGE MAP =====
$asegMergeMap = [
    // Normalize to UPPER CASE canonical names from XLSX
    'Allianz' => 'ALLIANZ SEGUROS',
    'ALLIANZ VIDA' => 'ALLIANZ SEGUROS',
    'AXA Colpatria' => 'AXA COLPATRIA SEGUROS S.A.',
    'Seguros Bolívar' => 'BOLIVAR',
    'La Equidad Seguros' => 'EQUIDAD',
    'La Previsora' => 'PREVISORA',
    'Liberty Seguros' => 'LIBERTY SEGUROS S.A.',
    'LIBERTY SEGUROS S.A.' => 'LIBERTY SEGUROS S.A.',
    'HDI Seguros' => 'HDI SEGUROS',
    'Seguros del Estado' => 'SEGUROS DEL ESTADO S.A',
    'SURA' => 'SURA',
    'MAPFRE' => 'MAPFRE',
];

echo "========================================\n";
echo "RAMO/SUBRAMO NORMALIZATION - BROKER 54\n";
echo "========================================\n\n";

// ===== STEP 1: Create/update target ramos =====
echo "--- STEP 1: Creating/updating target ramos ---\n";
$ramoIdMap = []; // canonical name => ramo_id
$created = 0;
$updated = 0;

foreach ($targetRamos as $ramoName => $subramos) {
    $existing = App\Models\Ramo::where('broker_id', $brokerId)
        ->whereRaw('UPPER(nombre) = ?', [strtoupper($ramoName)])
        ->first();
    
    if ($existing) {
        // Update subramos
        $existing->subramo = $subramos;
        $existing->nombre = $ramoName; // normalize casing
        $existing->save();
        $ramoIdMap[$ramoName] = $existing->id;
        echo "  UPDATED: {$ramoName} (ID: {$existing->id}) -> subramos: " . json_encode($subramos) . "\n";
        $updated++;
    } else {
        $newRamo = App\Models\Ramo::create([
            'nombre' => $ramoName,
            'subramo' => $subramos,
            'broker_id' => $brokerId,
        ]);
        $ramoIdMap[$ramoName] = $newRamo->id;
        echo "  CREATED: {$ramoName} (ID: {$newRamo->id}) -> subramos: " . json_encode($subramos) . "\n";
        $created++;
    }
}
echo "Created: {$created}, Updated: {$updated}\n\n";

// ===== STEP 2: Build old ramo ID -> new ramo ID mapping =====
echo "--- STEP 2: Building ramo merge mapping ---\n";
$oldToNewRamoId = [];
$allOldRamos = App\Models\Ramo::where('broker_id', $brokerId)->get();

foreach ($allOldRamos as $oldRamo) {
    $oldName = $oldRamo->nombre;
    
    // Already a target ramo?
    if (isset($ramoIdMap[$oldName])) {
        $oldToNewRamoId[$oldRamo->id] = $ramoIdMap[$oldName];
        continue;
    }
    
    // Check merge map (exact match)
    if (isset($ramoMergeMap[$oldName])) {
        $targetName = $ramoMergeMap[$oldName];
        if (isset($ramoIdMap[$targetName])) {
            $oldToNewRamoId[$oldRamo->id] = $ramoIdMap[$targetName];
            echo "  MERGE: '{$oldName}' (ID:{$oldRamo->id}) -> '{$targetName}' (ID:{$ramoIdMap[$targetName]})\n";
            continue;
        }
    }
    
    // Check merge map (case-insensitive)
    $found = false;
    foreach ($ramoMergeMap as $mapKey => $mapTarget) {
        if (strtoupper($oldName) === strtoupper($mapKey)) {
            if (isset($ramoIdMap[$mapTarget])) {
                $oldToNewRamoId[$oldRamo->id] = $ramoIdMap[$mapTarget];
                echo "  MERGE (ci): '{$oldName}' (ID:{$oldRamo->id}) -> '{$mapTarget}' (ID:{$ramoIdMap[$mapTarget]})\n";
                $found = true;
                break;
            }
        }
    }
    if ($found) continue;
    
    // Try fuzzy match against target ramos
    foreach ($ramoIdMap as $targetName => $targetId) {
        if (strtoupper($oldName) === strtoupper($targetName)) {
            $oldToNewRamoId[$oldRamo->id] = $targetId;
            echo "  MATCH (ci): '{$oldName}' (ID:{$oldRamo->id}) -> '{$targetName}' (ID:{$targetId})\n";
            $found = true;
            break;
        }
    }
    if ($found) continue;
    
    echo "  !! UNMAPPED: '{$oldName}' (ID:{$oldRamo->id}) - will map to MULTIRIESGO\n";
    $oldToNewRamoId[$oldRamo->id] = $ramoIdMap['MULTIRIESGO'];
}

echo "\n";

// ===== STEP 3: Normalize aseguradoras =====
echo "--- STEP 3: Normalizing aseguradoras ---\n";
$asegIdMap = []; // canonical name => id (keep the one with most polizas)
$allAsegs = App\Models\Aseguradora::where('broker_id', $brokerId)->get();

// Build canonical name -> list of IDs
$asegGroups = [];
foreach ($allAsegs as $aseg) {
    $canonical = $aseg->nombre;
    // Check merge map
    if (isset($asegMergeMap[$aseg->nombre])) {
        $canonical = $asegMergeMap[$aseg->nombre];
    }
    $canonical = strtoupper(trim($canonical));
    if (!isset($asegGroups[$canonical])) {
        $asegGroups[$canonical] = [];
    }
    $asegGroups[$canonical][] = $aseg;
}

$oldToNewAsegId = [];
foreach ($asegGroups as $canonical => $asegs) {
    // Keep the first one, merge others into it
    $primary = $asegs[0];
    $asegIdMap[$canonical] = $primary->id;
    
    if (count($asegs) > 1) {
        echo "  MERGE ASEG: '{$canonical}' -> keep ID:{$primary->id} ({$primary->nombre}), merge: ";
        for ($i = 1; $i < count($asegs); $i++) {
            echo "ID:{$asegs[$i]->id} ({$asegs[$i]->nombre}) ";
            $oldToNewAsegId[$asegs[$i]->id] = $primary->id;
        }
        echo "\n";
    }
}
echo "\n";

// ===== STEP 4: Update polizas =====
echo "--- STEP 4: Updating polizas ---\n";
$updatedPolizas = 0;
$unchangedPolizas = 0;
$errorPolizas = 0;

// Process in chunks to avoid memory issues
$chunkSize = 500;
$offset = 0;
$total = DB::selectOne('SELECT COUNT(*) as cnt FROM polizas WHERE broker_id = ?', [$brokerId])->cnt;
echo "Total polizas to process: {$total}\n";

while ($offset < $total) {
    $polizas = DB::select(
        'SELECT id, ramo_id, aseguradora_id, product_name FROM polizas WHERE broker_id = ? LIMIT ? OFFSET ?',
        [$brokerId, $chunkSize, $offset]
    );
    
    foreach ($polizas as $p) {
        $changes = [];
        
        // Update ramo_id
        if ($p->ramo_id && isset($oldToNewRamoId[$p->ramo_id]) && $oldToNewRamoId[$p->ramo_id] != $p->ramo_id) {
            $changes['ramo_id'] = $oldToNewRamoId[$p->ramo_id];
        }
        
        // Update aseguradora_id
        if ($p->aseguradora_id && isset($oldToNewAsegId[$p->aseguradora_id])) {
            $changes['aseguradora_id'] = $oldToNewAsegId[$p->aseguradora_id];
        }
        
        if (!empty($changes)) {
            $setClauses = [];
            $params = [];
            foreach ($changes as $col => $val) {
                $setClauses[] = "{$col} = ?";
                $params[] = $val;
            }
            $params[] = $p->id;
            DB::update('UPDATE polizas SET ' . implode(', ', $setClauses) . ' WHERE id = ?', $params);
            $updatedPolizas++;
        } else {
            $unchangedPolizas++;
        }
    }
    
    $offset += $chunkSize;
    echo "  Processed {$offset}/{$total}...\n";
}

echo "\n";
echo "========================================\n";
echo "RESULTS\n";
echo "========================================\n";
echo "Ramos created: {$created}\n";
echo "Ramos updated: {$updated}\n";
echo "Polizas updated: {$updatedPolizas}\n";
echo "Polizas unchanged: {$unchangedPolizas}\n";
echo "Total target ramos: " . count($targetRamos) . "\n";

// ===== STEP 5: Delete old unused ramos =====
echo "\n--- Cleaning up old duplicate ramos ---\n";
$targetRamoIds = array_values($ramoIdMap);
$deletedRamos = 0;
foreach ($allOldRamos as $oldRamo) {
    if (!in_array($oldRamo->id, $targetRamoIds)) {
        // Check if any polizas still reference this ramo
        $refCount = DB::selectOne('SELECT COUNT(*) as cnt FROM polizas WHERE ramo_id = ? AND broker_id = ?', [$oldRamo->id, $brokerId])->cnt;
        if ($refCount == 0) {
            // Safe to delete - also remove comisiones_aseguradoras
            DB::delete('DELETE FROM comisiones_aseguradoras WHERE ramo_id = ?', [$oldRamo->id]);
            $oldRamo->delete();
            echo "  DELETED ramo: '{$oldRamo->nombre}' (ID:{$oldRamo->id}) - 0 polizas\n";
            $deletedRamos++;
        } else {
            echo "  KEPT ramo: '{$oldRamo->nombre}' (ID:{$oldRamo->id}) - still has {$refCount} polizas\n";
        }
    }
}
echo "Deleted unused ramos: {$deletedRamos}\n";

echo "\n=== FINAL RAMO LIST ===\n";
$finalRamos = App\Models\Ramo::where('broker_id', $brokerId)->orderBy('nombre')->get();
foreach ($finalRamos as $r) {
    $polCount = DB::selectOne('SELECT COUNT(*) as cnt FROM polizas WHERE ramo_id = ? AND broker_id = ?', [$r->id, $brokerId])->cnt;
    echo "  {$r->id} | {$r->nombre} | subramos: " . json_encode($r->subramo) . " | polizas: {$polCount}\n";
}
echo "Total ramos: " . $finalRamos->count() . "\n";
