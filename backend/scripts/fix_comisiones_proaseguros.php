<?php
/**
 * FIX: Complete comisiones for broker proaseguros.com.co@gmail.com
 * Adds ALL missing entries from the Excel including 0% values
 * 
 * Usage: /opt/cpanel/ea-php83/root/usr/bin/php scripts/fix_comisiones_proaseguros.php
 */

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\Aseguradora;
use App\Models\Ramo;
use Illuminate\Support\Facades\DB;

$user = User::where('email', 'proaseguros.com.co@gmail.com')->first();
if (!$user) { echo "USER NOT FOUND\n"; exit; }
$brokerId = $user->broker_id;
echo "BROKER ID: {$brokerId}\n\n";

// Load current data
$aseguradoras = Aseguradora::where('broker_id', $brokerId)->get();
$ramos = Ramo::where('broker_id', $brokerId)->get();

$findAseg = function($search) use ($aseguradoras) {
    $lower = mb_strtolower(trim($search));
    $exact = $aseguradoras->first(fn($a) => mb_strtolower(trim($a->nombre)) === $lower);
    if ($exact) return $exact->id;
    $partial = $aseguradoras->first(fn($a) => str_contains(mb_strtolower($a->nombre), $lower));
    return $partial?->id;
};

$findRamo = function($search) use ($ramos) {
    $lower = mb_strtolower(trim($search));
    $exact = $ramos->first(fn($r) => mb_strtolower(trim($r->nombre)) === $lower);
    if ($exact) return $exact->id;
    $partial = $ramos->first(fn($r) => str_contains(mb_strtolower($r->nombre), $lower));
    return $partial?->id;
};

// ============================================================
// FULL COMISIONES LIST FROM ALL EXCEL SHEETS
// Format: [aseguradora, ramo, porcentaje_comision]
// Includes 0% entries (company offers ramo but 0 commission)
// For multi-value cells, we use the MOST COMMON / BASE value
// ============================================================

$comisionesConfig = [
    // =============================================
    // SHEET 1: COMPAÑIAS - Full matrix
    // =============================================

    // === ALLIANZ ===
    ['Allianz Seguros S.A', 'Autos Livianos', 12.5],
    ['Allianz Seguros S.A', 'Autos Pesados', 12.5],
    ['Allianz Seguros S.A', 'Responsabilidad Civil Extracontractual', 15],
    ['Allianz Seguros S.A', 'RC profesional', 20],
    ['Allianz Seguros S.A', 'Hogar', 20],
    ['Allianz Seguros S.A', 'Pyme', 15],  // "15/20" -> base 15
    ['Allianz Seguros S.A', 'Vida individual', 25],  // "25/30/40" -> base 25
    ['Allianz Seguros S.A', 'AP individual', 25],
    ['Allianz Seguros S.A', 'Cumplimiento', 30],
    ['Allianz Seguros S.A', 'Salud familiar', 10],  // "10.15" -> 10

    // === SOLIDARIA ===
    ['Solidaria', 'Autos Livianos', 12.5],
    ['Solidaria', 'Autos Pesados', 12.5],
    ['Solidaria', 'Responsabilidad Civil Extracontractual', 20],
    ['Solidaria', 'RC profesional', 15],
    ['Solidaria', 'Hogar', 17.5],
    ['Solidaria', 'Pyme', 17.5],
    ['Solidaria', 'Copropiedades', 15],
    ['Solidaria', 'Vida individual', 20],  // "20/16,80/20" -> base 20
    ['Solidaria', 'AP individual', 20],  // "20%" base; AP ESTUDIANTIL: 15-30%
    ['Solidaria', 'Accidentes Escolares', 20],
    ['Solidaria', 'Maquinaria y Equipo', 10],
    ['Solidaria', 'Cumplimiento', 30],
    ['Solidaria', 'RCE derivada de cumplimiento', 20],

    // === SEGUROS DEL ESTADO ===
    ['Seguros del Estado S.A', 'Autos Livianos', 12.5],
    ['Seguros del Estado S.A', 'Autos Pesados', 12.5],
    ['Seguros del Estado S.A', 'Hogar', 15],
    ['Seguros del Estado S.A', 'Pyme', 15],
    ['Seguros del Estado S.A', 'Copropiedades', 15],
    ['Seguros del Estado S.A', 'Vida individual', 25],  // "21/25,21/23,11" -> 25
    ['Seguros del Estado S.A', 'AP individual', 34],  // "AP ESTUDIANTIL: 34%"
    ['Seguros del Estado S.A', 'AP colectivo', 23],  // "AP COLECTIVOS: 23%"
    ['Seguros del Estado S.A', 'Cumplimiento', 30],
    ['Seguros del Estado S.A', 'RCE derivada de cumplimiento', 22],

    // === MAPFRE ===
    ['Mapfre Seguros Generales de Colombia S.A', 'Autos Livianos', 12.5],  // "10-12,5" -> 12.5
    ['Mapfre Seguros Generales de Colombia S.A', 'Autos Pesados', 12.5],
    ['Mapfre Seguros Generales de Colombia S.A', 'Responsabilidad Civil Extracontractual', 15],
    ['Mapfre Seguros Generales de Colombia S.A', 'RC profesional', 12.5],
    ['Mapfre Seguros Generales de Colombia S.A', 'Hogar', 20],
    ['Mapfre Seguros Generales de Colombia S.A', 'Pyme', 15],
    ['Mapfre Seguros Generales de Colombia S.A', 'Vida individual', 20],
    ['Mapfre Colombia Vida Seguros S.A', 'Vida individual', 20],
    ['Mapfre Colombia Vida Seguros S.A', 'AP individual', 20],
    ['Mapfre Colombia Vida Seguros S.A', 'Accidentes Escolares', 20],

    // === COLMENA ===
    ['Colmena Compañia de Seguros de Vida S.A', 'Autos Livianos', 0],
    ['Colmena Compañia de Seguros de Vida S.A', 'Autos Pesados', 0],
    ['Colmena Compañia de Seguros de Vida S.A', 'Vida individual', 20],

    // === BOLIVAR ===
    ['Compañia de Seguros Bolivar S.A', 'Autos Livianos', 12.5],
    ['Compañia de Seguros Bolivar S.A', 'Autos Pesados', 12.5],
    ['Compañia de Seguros Bolivar S.A', 'Hogar', 18.53],
    ['Compañia de Seguros Bolivar S.A', 'Pyme', 15],
    ['Seguros Comerciales Bolivar S.A', 'Vida individual', 25],  // "5 / 25" -> 25 (5 is deudores)
    ['Seguros Comerciales Bolivar S.A', 'AP individual', 25],
    ['Seguros Comerciales Bolivar S.A', 'Salud familiar', 20],  // "Individual 20%"
    ['Seguros Comerciales Bolivar S.A', 'Salud colectivo', 10],  // "Colectiva 10%"

    // === SBS ===
    ['SBS Compañia de Seguros S.A', 'Autos Livianos', 15],  // "10 y 15" -> 15
    ['SBS Compañia de Seguros S.A', 'Autos Pesados', 0],
    ['SBS Compañia de Seguros S.A', 'Responsabilidad Civil Extracontractual', 18],
    ['SBS Compañia de Seguros S.A', 'Hogar', 20],
    ['SBS Compañia de Seguros S.A', 'Pyme', 15],
    ['SBS Compañia de Seguros S.A', 'Copropiedades', 15],  // "15/14,99" -> 15
    ['SBS Compañia de Seguros S.A', 'AP individual', 20],
    ['SBS Compañia de Seguros S.A', 'Accidentes Escolares', 20],

    // === LA NACIONAL DE FIANZAS ===
    ['Compañia Nacional de Fianzas S.A', 'Autos Livianos', 0],
    ['Compañia Nacional de Fianzas S.A', 'Autos Pesados', 0],
    ['Compañia Nacional de Fianzas S.A', 'Cumplimiento', 30],
    ['Compañia Nacional de Fianzas S.A', 'RCE derivada de cumplimiento', 22.5],

    // === MUNDIAL ===
    ['Compañia Mundial de Seguros S.A', 'Autos Pesados', 12.5],  // "12,5/12/15" -> base 12.5
    ['Compañia Mundial de Seguros S.A', 'Responsabilidad Civil Extracontractual', 15],
    ['Compañia Mundial de Seguros S.A', 'AP individual', 30],
    ['Compañia Mundial de Seguros S.A', 'Accidentes Escolares', 30],
    ['Compañia Mundial de Seguros S.A', 'Cumplimiento', 30],
    ['Compañia Mundial de Seguros S.A', 'RCE derivada de cumplimiento', 20],
    ['Compañia Mundial de Seguros S.A', 'Judiciales', 40],

    // === ZURICH ===
    ['Zurich Colombia Seguros S.A', 'Autos Livianos', 15],
    ['Zurich Colombia Seguros S.A', 'Autos Pesados', 0],
    ['Zurich Colombia Seguros S.A', 'Responsabilidad Civil Extracontractual', 17],

    // === CHUBB ===
    ['Chubb Seguros Colombia S.A', 'Autos Livianos', 0],
    ['Chubb Seguros Colombia S.A', 'Autos Pesados', 0],
    ['Chubb Seguros Colombia S.A', 'AP individual', 20],
    ['Chubb Seguros Colombia S.A', 'Accidentes Escolares', 20],

    // === POSITIVA (row 15 + row 23) ===
    ['Positiva Compañía de Seguros', 'AP individual', 40],
    ['Positiva Compañía de Seguros', 'Accidentes Escolares', 40],
    ['Positiva Compañía de Seguros', 'Autos Livianos', 0],
    ['Positiva Compañía de Seguros', 'Autos Pesados', 0],

    // === ARL SURA ===
    ['ARL SURA', 'ARL', 9],

    // === PREVISORA ===
    ['La Previsora S.A Compañia de Seguros', 'Autos Livianos', 15],
    ['La Previsora S.A Compañia de Seguros', 'Autos Pesados', 12.5],
    ['La Previsora S.A Compañia de Seguros', 'Responsabilidad Civil Extracontractual', 17.5],
    ['La Previsora S.A Compañia de Seguros', 'RC profesional', 20],
    ['La Previsora S.A Compañia de Seguros', 'Pyme', 15],
    ['La Previsora S.A Compañia de Seguros', 'Copropiedades', 15],
    ['La Previsora S.A Compañia de Seguros', 'AP individual', 20],
    ['La Previsora S.A Compañia de Seguros', 'Cumplimiento', 30],

    // === HDI (ANTES LIBERTY) ===
    ['HDI Seguros S.A', 'Autos Livianos', 15],
    ['HDI Seguros S.A', 'Autos Pesados', 12.5],
    ['HDI Seguros S.A', 'Hogar', 15],
    ['HDI Seguros S.A', 'Vida individual', 20],  // "20/25" -> base 20

    // === BBVA ===
    ['BBVA Seguros Colombia S.A', 'Autos Livianos', 0],
    ['BBVA Seguros Colombia S.A', 'Autos Pesados', 0],
    ['BBVA Seguros Colombia S.A', 'Hogar', 15],
    ['BBVA Seguros Colombia S.A', 'Pyme', 15],
    ['BBVA Seguros Colombia S.A', 'Copropiedades', 15],

    // === CONFIANZA ===
    ['Seguros Confianza S.A', 'Autos Livianos', 0],
    ['Seguros Confianza S.A', 'Autos Pesados', 0],
    ['Seguros Confianza S.A', 'RC profesional', 22.5],
    ['Seguros Confianza S.A', 'Cumplimiento', 30],

    // === ASSIST CARD ===
    ['Assist Card de Colombia S.A.S', 'Autos Livianos', 0],
    ['Assist Card de Colombia S.A.S', 'Autos Pesados', 0],
    ['Assist Card de Colombia S.A.S', 'AP individual', 15],  // "15/20" -> base 15
    ['Assist Card de Colombia S.A.S', 'Asistencia viaje', 20],

    // === AXA COLPATRIA ===
    ['Axa Colpatria Seguros S.A', 'Autos Livianos', 12.5],
    ['Axa Colpatria Seguros S.A', 'Autos Pesados', 12.5],
    ['Axa Colpatria Seguros S.A', 'Copropiedades', 15],

    // === EQUIDAD ===
    ['La Equidad Seguros Generales', 'Autos Livianos', 15],  // "15/14,99/13,5/12,5" -> base 15
    ['La Equidad Seguros Generales', 'Autos Pesados', 12.5],
    ['La Equidad Seguros Generales', 'Responsabilidad Civil Extracontractual', 17.5],
    ['La Equidad Seguros Generales', 'Hogar', 15],
    ['La Equidad Seguros Generales', 'Pyme', 15],
    ['La Equidad Seguros Generales', 'Copropiedades', 15],  // "15/17,5" -> base 15

    // === EMERMEDICA ===
    ['Emermedica', 'Salud familiar', 7],

    // === MAGENTA === (ASISTENCIAS 20%)
    ['MAGENTAASSISTANCE', 'Asistencia empresarial', 20],

    // === 48 HOORASS DIA === (ASISTENCIAS 30%)
    ['48 HOORASS DÍA', 'Asistencia empresarial', 30],

    // === MAS SERVICIOS === (ASISTENCIAS 20%)
    ['MÁS SERVICIOS COLOMBIA', 'Asistencia empresarial', 20],

    // === SKANDIA === (ASISTENCIAS 2.5%)
    ['Skandia Seguros de Vida S.A', 'Capitalización', 2.5],

    // =============================================
    // SHEET 3: % SURA GENERALES
    // =============================================
    ['Seguros Generales Suramericana S.A', 'Hogar', 17],  // HogarSURA C01
    ['Seguros Generales Suramericana S.A', 'Autos Livianos', 12.5],
    ['Seguros Generales Suramericana S.A', 'Autos Pesados', 12.5],
    ['Seguros Generales Suramericana S.A', 'SOAT', 0],
    ['Seguros Generales Suramericana S.A', 'Asistencia viaje', 20],
    ['Seguros Generales Suramericana S.A', 'Agrícolas', 6],
    ['Seguros Generales Suramericana S.A', 'Equipo Electrónico', 15],
    ['Seguros Generales Suramericana S.A', 'RC parqueaderos y talleres', 12.5],
    ['Seguros Generales Suramericana S.A', 'Fraude de Empleados', 17],
    ['Seguros Generales Suramericana S.A', 'Cumplimiento', 30],
    ['Seguros Generales Suramericana S.A', 'RCE derivada de cumplimiento', 22],
    ['Seguros Generales Suramericana S.A', 'RC profesional', 12.5],
    ['Seguros Generales Suramericana S.A', 'RC médicos', 10],
    ['Seguros Generales Suramericana S.A', 'RC Directores y Adminis', 13.5],
    ['Seguros Generales Suramericana S.A', 'Responsabilidad Civil Extracontractual', 17.5],  // RC Daños a terceros
    ['Seguros Generales Suramericana S.A', 'RCE PLO', 15],  // RC Operadores portuarios
    ['Seguros Generales Suramericana S.A', 'RCE Hidrocarburos', 10.5],  // RC Ambiental
    ['Seguros Generales Suramericana S.A', 'Protección Digital', 20],
    ['Seguros Generales Suramericana S.A', 'Protección Legal', 17],
    ['Seguros Generales Suramericana S.A', 'Mascotas', 20],
    ['Seguros Generales Suramericana S.A', 'Sustracción', 17.5],
    ['Seguros Generales Suramericana S.A', 'Manejo', 12.5],  // Manejo Bancario
    ['Seguros Generales Suramericana S.A', 'Rotura Maquinaria', 15],
    ['Seguros Generales Suramericana S.A', 'Transporte mercancías', 20],
    ['Seguros Generales Suramericana S.A', 'Navegación', 10],
    ['Seguros Generales Suramericana S.A', 'Transporte valores', 15],
    ['Seguros Generales Suramericana S.A', 'Pyme', 20],  // PES Daños
    ['Seguros Generales Suramericana S.A', 'Multiriesgo', 12.5],
    ['Seguros Generales Suramericana S.A', 'TODO RIESGO DAÑO MATERIAL', 17],
    ['Seguros Generales Suramericana S.A', 'Arrendamiento', 10],
    ['Seguros Generales Suramericana S.A', 'Maquinaria y Equipo', 15],
    ['Seguros Generales Suramericana S.A', 'TRC', 15],  // Todo Riesgo Construcción
    ['Seguros Generales Suramericana S.A', 'Lucro Cesante', 15],
    ['Seguros Generales Suramericana S.A', 'Obras Civiles', 15],
    ['Seguros Generales Suramericana S.A', 'Drones - Casco', 12.5],  // RC Drones

    // =============================================
    // SHEET 4: % VIDA SURA
    // =============================================
    // Salud individual (ramo 90) - using primer año rates
    ['Seguros de Vida Suramericana S.A', 'Salud familiar', 15],  // Salud Global base
    ['Seguros de Vida Suramericana S.A', 'Salud colectivo', 10],
    ['Seguros de Vida Suramericana S.A', 'Emergencia medica', 0],  // EMI 0%

    // Vida/Autonomía
    ['Seguros de Vida Suramericana S.A', 'Fondo en Pesos', 9],
    ['Seguros de Vida Suramericana S.A', 'Fondo en Dólares', 9],
    ['Seguros de Vida Suramericana S.A', 'Fondo de Ahorro', 2],
    ['Seguros de Vida Suramericana S.A', 'Vida individual', 20],
    ['Seguros de Vida Suramericana S.A', 'VG deudores', 20],
    ['Seguros de Vida Suramericana S.A', 'VG voluntario', 25],  // Plan Vive

    // AP
    ['Seguros de Vida Suramericana S.A', 'AP individual', 27.5],
    ['Seguros de Vida Suramericana S.A', 'AP colectivo', 25],
    ['Seguros de Vida Suramericana S.A', 'Accidentes Escolares', 27.5],
    ['Seguros de Vida Suramericana S.A', 'Movilidad individual', 25],  // Primera Clase
    ['Seguros de Vida Suramericana S.A', 'Movilidad colectivo', 20],  // Primera Clase Colectiva

    // Exequial
    ['Seguros de Vida Suramericana S.A', 'Exequial', 20],
    ['Seguros de Vida Suramericana S.A', 'Exequial colectivo', 15],

    // Enfermedades graves
    ['Seguros de Vida Suramericana S.A', 'Enfermedades graves', 35],

    // Pensional / Educación
    ['Seguros de Vida Suramericana S.A', 'Pensional', 5],
    ['Seguros de Vida Suramericana S.A', 'Educación Sura', 5],
    ['Seguros de Vida Suramericana S.A', 'Renta educativa', 25],

    // === MAPFRE AUTOS DETAIL (rows 35-41) ===
    // These are sub-products, main commission is already set above

    // =============================================
    // ADDITIONAL: Vida companies from COMPAÑIAS sheet
    // where the Vida column is for Seguros de Vida entity
    // =============================================
    ['Seguros de Vida del Estado S.A', 'Vida individual', 25],
    ['Seguros de Vida del Estado S.A', 'AP individual', 34],
    ['Seguros de Vida del Estado S.A', 'AP colectivo', 23],
    ['Allianz Seguros de Vida S.A', 'Vida individual', 25],
    ['Allianz Seguros de Vida S.A', 'AP individual', 25],
];

// ============================================================
// APPLY: upsert all comisiones
// ============================================================
echo "=== APPLYING COMISIONES ===\n";
$created = 0;
$updated = 0;
$skipped = 0;
$errors = [];

foreach ($comisionesConfig as [$asegSearch, $ramoSearch, $porcentaje]) {
    $asegId = $findAseg($asegSearch);
    $ramoId = $findRamo($ramoSearch);

    if (!$asegId) {
        $errors[] = "Aseguradora not found: '{$asegSearch}'";
        continue;
    }
    if (!$ramoId) {
        $errors[] = "Ramo not found: '{$ramoSearch}'";
        continue;
    }

    $existing = DB::table('comisiones_aseguradoras')
        ->where('ramo_id', $ramoId)
        ->where('aseguradora_id', $asegId)
        ->first();

    if ($existing) {
        $oldPct = (float)$existing->porcentaje_comision;
        if ($oldPct !== (float)$porcentaje) {
            DB::table('comisiones_aseguradoras')
                ->where('id', $existing->id)
                ->update([
                    'porcentaje_comision' => $porcentaje,
                    'updated_at' => now(),
                ]);
            $updated++;
            echo "  ~ UPDATED: {$asegSearch} + {$ramoSearch} = {$porcentaje}% (was {$oldPct}%)\n";
        } else {
            $skipped++;
        }
    } else {
        DB::table('comisiones_aseguradoras')->insert([
            'ramo_id' => $ramoId,
            'aseguradora_id' => $asegId,
            'porcentaje_iva' => 19.00,
            'porcentaje_comision' => $porcentaje,
            'pri_a_pre_por_defecto' => 0.00,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $created++;
        echo "  + CREATED: {$asegSearch} + {$ramoSearch} = {$porcentaje}%\n";
    }
}

// ============================================================
// REPORT
// ============================================================
echo "\n" . str_repeat('=', 60) . "\n";
echo "INFORME DE CORRECCIÓN\n";
echo str_repeat('=', 60) . "\n";
echo "Comisiones creadas nuevas: {$created}\n";
echo "Comisiones actualizadas: {$updated}\n";
echo "Comisiones ya correctas (skip): {$skipped}\n";
echo "Errores: " . count($errors) . "\n";
foreach ($errors as $e) echo "  ! {$e}\n";

// Count totals
$totalCom = DB::table('comisiones_aseguradoras')
    ->whereIn('ramo_id', Ramo::where('broker_id', $brokerId)->pluck('id'))
    ->whereIn('aseguradora_id', Aseguradora::where('broker_id', $brokerId)->pluck('id'))
    ->count();
echo "\nTotal comisiones ahora: {$totalCom}\n";

// Summary per company
echo "\n=== RESUMEN POR COMPAÑÍA ===\n";
$asegIds2 = Aseguradora::where('broker_id', $brokerId)->pluck('id');
$ramoIds2 = Ramo::where('broker_id', $brokerId)->pluck('id');
$allComs = DB::table('comisiones_aseguradoras')
    ->whereIn('ramo_id', $ramoIds2)
    ->whereIn('aseguradora_id', $asegIds2)
    ->get();

$byAseg = [];
foreach ($allComs as $c) {
    $asegN = $aseguradoras->firstWhere('id', $c->aseguradora_id)?->nombre ?? '??';
    $ramoN = $ramos->firstWhere('id', $c->ramo_id)?->nombre ?? '??';
    $byAseg[$asegN][] = "{$ramoN}={$c->porcentaje_comision}%";
}
ksort($byAseg);
foreach ($byAseg as $aseg => $entries) {
    echo "\n{$aseg} (" . count($entries) . " ramos):\n";
    foreach ($entries as $e) echo "  · {$e}\n";
}

echo "\nDONE.\n";
