<?php
/**
 * Script to configure comisiones for broker proaseguros.com.co@gmail.com
 * Based on "% COMISIONES 2026 ACT (1).xlsx"
 * 
 * Usage: /opt/cpanel/ea-php83/root/usr/bin/php scripts/configure_comisiones_proaseguros.php
 */

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\Aseguradora;
use App\Models\Ramo;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

$user = User::where('email', 'proaseguros.com.co@gmail.com')->first();
if (!$user) { echo "USER NOT FOUND\n"; exit; }
$brokerId = $user->broker_id;
echo "BROKER ID: {$brokerId}\n\n";

// ============================================================
// 1. BACKUP CURRENT STATE
// ============================================================
$aseguradoras = \App\Models\Aseguradora::where('broker_id', $brokerId)->orderBy('nombre')->get();
$ramos = \App\Models\Ramo::where('broker_id', $brokerId)->orderBy('nombre')->get();
$ramoIds = $ramos->pluck('id');
$asegIds = $aseguradoras->pluck('id');
$comisiones = \DB::table('comisiones_aseguradoras')
    ->whereIn('ramo_id', $ramoIds)
    ->whereIn('aseguradora_id', $asegIds)
    ->get();

$backup = [
    'timestamp' => now()->toIso8601String(),
    'broker_id' => $brokerId,
    'aseguradoras' => $aseguradoras->toArray(),
    'ramos' => $ramos->toArray(),
    'comisiones' => $comisiones->toArray(),
];

$backupPath = storage_path('backups');
if (!is_dir($backupPath)) mkdir($backupPath, 0755, true);
$backupFile = $backupPath . '/proaseguros_config_backup_' . date('Y-m-d_H-i-s') . '.json';
file_put_contents($backupFile, json_encode($backup, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
echo "BACKUP saved: {$backupFile}\n";
echo "  Aseguradoras: {$aseguradoras->count()}\n";
echo "  Ramos: {$ramos->count()}\n";
echo "  Comisiones: {$comisiones->count()}\n\n";

// ============================================================
// 2. DEFINE THE TARGET CONFIGURATION FROM EXCEL
// ============================================================

// All aseguradoras from COMPAÑIAS sheet
$targetAseguradoras = [
    'Allianz Seguros S.A',
    'Allianz Seguros de Vida S.A',
    'Seguros Generales Suramericana S.A',
    'Seguros de Vida Suramericana S.A',
    'Solidaria',
    'Seguros del Estado S.A',
    'Seguros de Vida del Estado S.A',
    'Mapfre Seguros Generales de Colombia S.A',
    'Mapfre Colombia Vida Seguros S.A',
    'Colmena Compañia de Seguros de Vida S.A',
    'Compañia de Seguros Bolivar S.A',
    'Seguros Comerciales Bolivar S.A',
    'SBS Compañia de Seguros S.A',
    'Compañia Nacional de Fianzas S.A',
    'Compañia Mundial de Seguros S.A',
    'Zurich Colombia Seguros S.A',
    'Chubb Seguros Colombia S.A',
    'Positiva Compañía de Seguros',
    'ARL SURA',
    'La Previsora S.A Compañia de Seguros',
    'HDI Seguros S.A',
    'BBVA Seguros Colombia S.A',
    'Seguros Confianza S.A',
    'Assist Card de Colombia S.A.S',
    'Axa Colpatria Seguros S.A',
    'Axa Colpatria Seguros de Vida S.A',
    'Axa Colpatria Capitalizadora S.A',
    'La Equidad Seguros Generales',
    'Emermedica',
    'MAGENTAASSISTANCE',
    '48 HOORASS DÍA',
    'MÁS SERVICIOS COLOMBIA',
    'Skandia Seguros de Vida S.A',
    'QUALITAS',
    'Coomeva',
    'Empresa de Medicina Integral EMI S.A.S',
    'EPS Suramericana S.A',
    'Grupo emi S.A.S.',
    'Capitalizadora Bolivar S.A',
    'Liberty Seguros S.A',
];

// All ramos (from both sheets + COMPAÑIAS header ramos)
$targetRamos = [
    'Autos Livianos',
    'Autos Pesados',
    'Autos Colectivo',
    'Responsabilidad Civil Extracontractual',
    'RC profesional',
    'ARL',
    'Hogar',
    'Pyme',
    'Copropiedades',
    'Vida individual',
    'AP individual',
    'AP colectivo',
    'Accidentes Escolares',
    'Exequial',
    'Exequial colectivo',
    'Maquinaria y Equipo',
    'Cumplimiento',
    'RCE derivada de cumplimiento',
    'Salud familiar',
    'Salud colectivo',
    'Judiciales',
    'Transporte mercancías',
    'Transporte valores',
    'Navegación',
    'Arrendamiento',
    'TODO RIESGO DAÑO MATERIAL',
    'TRC',
    'Multiriesgo',
    'Manejo',
    'RC médicos',
    'RC Directores y Adminis',
    'RCE Hidrocarburos',
    'RC parqueaderos y talleres',
    'RCE PLO',
    'Emergencia medica',
    'Renta educativa',
    'Movilidad individual',
    'Movilidad colectivo',
    'Seguro x KM',
    'VG voluntario',
    'VG deudores',
    'PAC',
    'Asistencia viaje',
    'Capitalización',
    'Crédito',
    'Bicicleta',
    'Vigilantes',
    'Asistencia empresarial',
    'AREAS COMUNES PÓLIZA TODO RIESGO',
    'Enfermedades graves',
    'Drones - Casco',
    'Mascotas',
    'SOAT',
    // New ramos from Excel not in current system
    'Agrícolas',
    'Equipo Electrónico',
    'Fraude de Empleados',
    'Protección Digital',
    'Protección Legal',
    'Sustracción',
    'Rotura Maquinaria',
    'Lucro Cesante',
    'Obras Civiles',
    'Pensional',
    'Educación Sura',
    'Fondo en Pesos',
    'Fondo en Dólares',
    'Fondo de Ahorro',
];

// ============================================================
// 3. ADD MISSING ASEGURADORAS (never delete/modify existing)
// ============================================================
$addedAsegs = [];
$existingAsegNames = $aseguradoras->pluck('nombre')->map(fn($n) => mb_strtolower(trim($n)))->toArray();

foreach ($targetAseguradoras as $name) {
    $lower = mb_strtolower(trim($name));
    if (!in_array($lower, $existingAsegNames)) {
        $new = \App\Models\Aseguradora::create([
            'nombre' => $name,
            'broker_id' => $brokerId,
        ]);
        $addedAsegs[] = $name . " (ID={$new->id})";
        echo "  + ADDED aseguradora: {$name} (ID={$new->id})\n";
    }
}
if (empty($addedAsegs)) echo "  No new aseguradoras needed.\n";
echo "\n";

// ============================================================
// 4. ADD MISSING RAMOS (never delete/modify existing)
// ============================================================
$addedRamos = [];
$existingRamoNames = $ramos->pluck('nombre')->map(fn($n) => mb_strtolower(trim($n)))->toArray();

foreach ($targetRamos as $name) {
    $lower = mb_strtolower(trim($name));
    if (!in_array($lower, $existingRamoNames)) {
        $new = \App\Models\Ramo::create([
            'nombre' => $name,
            'broker_id' => $brokerId,
        ]);
        $addedRamos[] = $name . " (ID={$new->id})";
        echo "  + ADDED ramo: {$name} (ID={$new->id})\n";
    }
}
if (empty($addedRamos)) echo "  No new ramos needed.\n";
echo "\n";

// ============================================================
// 5. RELOAD AFTER ADDITIONS
// ============================================================
$aseguradoras = \App\Models\Aseguradora::where('broker_id', $brokerId)->get();
$ramos = \App\Models\Ramo::where('broker_id', $brokerId)->get();

// Helper: find aseguradora ID by name (case-insensitive partial match)
$findAseg = function($search) use ($aseguradoras) {
    $lower = mb_strtolower(trim($search));
    // Try exact first
    $exact = $aseguradoras->first(fn($a) => mb_strtolower(trim($a->nombre)) === $lower);
    if ($exact) return $exact->id;
    // Partial
    $partial = $aseguradoras->first(fn($a) => str_contains(mb_strtolower($a->nombre), $lower));
    if ($partial) return $partial->id;
    return null;
};

// Helper: find ramo ID by name
$findRamo = function($search) use ($ramos) {
    $lower = mb_strtolower(trim($search));
    $exact = $ramos->first(fn($r) => mb_strtolower(trim($r->nombre)) === $lower);
    if ($exact) return $exact->id;
    $partial = $ramos->first(fn($r) => str_contains(mb_strtolower($r->nombre), $lower));
    if ($partial) return $partial->id;
    return null;
};

// ============================================================
// 6. DEFINE COMISIONES FROM EXCEL
//    Format: [aseg_search, ramo_search, porcentaje_comision]
//    We use the PRIMARY / most common commission percentage
// ============================================================
$comisionesConfig = [
    // === ALLIANZ ===
    ['Allianz Seguros S.A', 'Autos Livianos', 12.5],
    ['Allianz Seguros S.A', 'Autos Pesados', 12.5],
    ['Allianz Seguros S.A', 'Responsabilidad Civil Extracontractual', 15],
    ['Allianz Seguros S.A', 'RC profesional', 20],
    ['Allianz Seguros S.A', 'Hogar', 20],
    ['Allianz Seguros S.A', 'Pyme', 20],
    ['Allianz Seguros S.A', 'Cumplimiento', 30],
    ['Allianz Seguros de Vida S.A', 'Vida individual', 25],
    ['Allianz Seguros de Vida S.A', 'AP individual', 25],

    // === SURA GENERALES (from "% SURA GENERALES" sheet) ===
    ['Seguros Generales Suramericana S.A', 'Hogar', 17],
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
    ['Seguros Generales Suramericana S.A', 'Responsabilidad Civil Extracontractual', 17.5],
    ['Seguros Generales Suramericana S.A', 'RCE PLO', 15],
    ['Seguros Generales Suramericana S.A', 'RCE Hidrocarburos', 10.5],
    ['Seguros Generales Suramericana S.A', 'Protección Digital', 20],
    ['Seguros Generales Suramericana S.A', 'Protección Legal', 17],
    ['Seguros Generales Suramericana S.A', 'Mascotas', 20],
    ['Seguros Generales Suramericana S.A', 'Sustracción', 17.5],
    ['Seguros Generales Suramericana S.A', 'Manejo', 12.5],
    ['Seguros Generales Suramericana S.A', 'Rotura Maquinaria', 15],
    ['Seguros Generales Suramericana S.A', 'Transporte mercancías', 20],
    ['Seguros Generales Suramericana S.A', 'Navegación', 10],
    ['Seguros Generales Suramericana S.A', 'Transporte valores', 15],
    ['Seguros Generales Suramericana S.A', 'Pyme', 20],
    ['Seguros Generales Suramericana S.A', 'Multiriesgo', 12.5],
    ['Seguros Generales Suramericana S.A', 'TODO RIESGO DAÑO MATERIAL', 17],
    ['Seguros Generales Suramericana S.A', 'Arrendamiento', 10],
    ['Seguros Generales Suramericana S.A', 'Maquinaria y Equipo', 15],
    ['Seguros Generales Suramericana S.A', 'TRC', 15],
    ['Seguros Generales Suramericana S.A', 'Lucro Cesante', 15],
    ['Seguros Generales Suramericana S.A', 'Obras Civiles', 15],

    // === SURA VIDA (from "% VIDA SURA" sheet) ===
    ['Seguros de Vida Suramericana S.A', 'Salud familiar', 15],
    ['Seguros de Vida Suramericana S.A', 'Salud colectivo', 10],
    ['Seguros de Vida Suramericana S.A', 'Emergencia medica', 0],
    ['Seguros de Vida Suramericana S.A', 'Vida individual', 20],
    ['Seguros de Vida Suramericana S.A', 'VG deudores', 20],
    ['Seguros de Vida Suramericana S.A', 'VG voluntario', 25],
    ['Seguros de Vida Suramericana S.A', 'AP individual', 27.5],
    ['Seguros de Vida Suramericana S.A', 'AP colectivo', 25],
    ['Seguros de Vida Suramericana S.A', 'Accidentes Escolares', 27.5],
    ['Seguros de Vida Suramericana S.A', 'Exequial', 20],
    ['Seguros de Vida Suramericana S.A', 'Exequial colectivo', 15],
    ['Seguros de Vida Suramericana S.A', 'Enfermedades graves', 35],
    ['Seguros de Vida Suramericana S.A', 'Fondo en Pesos', 9],
    ['Seguros de Vida Suramericana S.A', 'Fondo en Dólares', 9],
    ['Seguros de Vida Suramericana S.A', 'Fondo de Ahorro', 2],
    ['Seguros de Vida Suramericana S.A', 'Pensional', 5],
    ['Seguros de Vida Suramericana S.A', 'Educación Sura', 5],
    ['Seguros de Vida Suramericana S.A', 'Renta educativa', 25],

    // === ARL SURA ===
    ['ARL SURA', 'ARL', 9],

    // === SOLIDARIA ===
    ['Solidaria', 'Autos Livianos', 12.5],
    ['Solidaria', 'Autos Pesados', 12.5],
    ['Solidaria', 'Responsabilidad Civil Extracontractual', 20],
    ['Solidaria', 'RC profesional', 15],
    ['Solidaria', 'Hogar', 17.5],
    ['Solidaria', 'Pyme', 17.5],
    ['Solidaria', 'Copropiedades', 15],
    ['Solidaria', 'Vida individual', 20],
    ['Solidaria', 'AP individual', 20],
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
    ['Seguros del Estado S.A', 'Cumplimiento', 30],
    ['Seguros del Estado S.A', 'RCE derivada de cumplimiento', 22],
    ['Seguros de Vida del Estado S.A', 'Vida individual', 25],
    ['Seguros de Vida del Estado S.A', 'AP individual', 34],
    ['Seguros de Vida del Estado S.A', 'AP colectivo', 23],

    // === MAPFRE ===
    ['Mapfre Seguros Generales de Colombia S.A', 'Autos Livianos', 12.5],
    ['Mapfre Seguros Generales de Colombia S.A', 'Autos Pesados', 12.5],
    ['Mapfre Seguros Generales de Colombia S.A', 'Responsabilidad Civil Extracontractual', 15],
    ['Mapfre Seguros Generales de Colombia S.A', 'RC profesional', 12.5],
    ['Mapfre Seguros Generales de Colombia S.A', 'Hogar', 20],
    ['Mapfre Seguros Generales de Colombia S.A', 'Pyme', 15],
    ['Mapfre Colombia Vida Seguros S.A', 'Vida individual', 20],
    ['Mapfre Colombia Vida Seguros S.A', 'AP individual', 20],
    ['Mapfre Colombia Vida Seguros S.A', 'Accidentes Escolares', 20],

    // === COLMENA ===
    ['Colmena Compañia de Seguros de Vida S.A', 'Vida individual', 20],

    // === BOLIVAR ===
    ['Compañia de Seguros Bolivar S.A', 'Autos Livianos', 12.5],
    ['Compañia de Seguros Bolivar S.A', 'Autos Pesados', 12.5],
    ['Compañia de Seguros Bolivar S.A', 'Hogar', 18.53],
    ['Compañia de Seguros Bolivar S.A', 'Pyme', 15],
    ['Seguros Comerciales Bolivar S.A', 'Vida individual', 25],
    ['Seguros Comerciales Bolivar S.A', 'AP individual', 25],
    ['Seguros Comerciales Bolivar S.A', 'Salud familiar', 20],
    ['Seguros Comerciales Bolivar S.A', 'Salud colectivo', 10],

    // === SBS ===
    ['SBS Compañia de Seguros S.A', 'Autos Livianos', 15],
    ['SBS Compañia de Seguros S.A', 'Responsabilidad Civil Extracontractual', 18],
    ['SBS Compañia de Seguros S.A', 'Hogar', 20],
    ['SBS Compañia de Seguros S.A', 'Pyme', 15],
    ['SBS Compañia de Seguros S.A', 'Copropiedades', 15],
    ['SBS Compañia de Seguros S.A', 'AP individual', 20],
    ['SBS Compañia de Seguros S.A', 'Accidentes Escolares', 20],

    // === LA NACIONAL DE FIANZAS ===
    ['Compañia Nacional de Fianzas S.A', 'Cumplimiento', 30],
    ['Compañia Nacional de Fianzas S.A', 'RCE derivada de cumplimiento', 22.5],

    // === MUNDIAL ===
    ['Compañia Mundial de Seguros S.A', 'Autos Pesados', 12.5],
    ['Compañia Mundial de Seguros S.A', 'Responsabilidad Civil Extracontractual', 15],
    ['Compañia Mundial de Seguros S.A', 'AP individual', 30],
    ['Compañia Mundial de Seguros S.A', 'Accidentes Escolares', 30],
    ['Compañia Mundial de Seguros S.A', 'Cumplimiento', 30],
    ['Compañia Mundial de Seguros S.A', 'RCE derivada de cumplimiento', 20],
    ['Compañia Mundial de Seguros S.A', 'Judiciales', 40],

    // === ZURICH ===
    ['Zurich Colombia Seguros S.A', 'Autos Livianos', 15],
    ['Zurich Colombia Seguros S.A', 'Responsabilidad Civil Extracontractual', 17],

    // === CHUBB ===
    ['Chubb Seguros Colombia S.A', 'AP individual', 20],
    ['Chubb Seguros Colombia S.A', 'Accidentes Escolares', 20],

    // === POSITIVA ===
    ['Positiva Compañía de Seguros', 'AP individual', 40],
    ['Positiva Compañía de Seguros', 'Accidentes Escolares', 40],

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
    ['HDI Seguros S.A', 'Vida individual', 25],

    // === BBVA ===
    ['BBVA Seguros Colombia S.A', 'Hogar', 15],
    ['BBVA Seguros Colombia S.A', 'Pyme', 15],
    ['BBVA Seguros Colombia S.A', 'Copropiedades', 15],

    // === CONFIANZA ===
    ['Seguros Confianza S.A', 'RC profesional', 22.5],
    ['Seguros Confianza S.A', 'Cumplimiento', 30],

    // === ASSIST CARD ===
    ['Assist Card de Colombia S.A.S', 'Asistencia viaje', 20],

    // === AXA COLPATRIA ===
    ['Axa Colpatria Seguros S.A', 'Autos Livianos', 12.5],
    ['Axa Colpatria Seguros S.A', 'Autos Pesados', 12.5],
    ['Axa Colpatria Seguros S.A', 'Copropiedades', 15],

    // === EQUIDAD ===
    ['La Equidad Seguros Generales', 'Autos Livianos', 15],
    ['La Equidad Seguros Generales', 'Autos Pesados', 12.5],
    ['La Equidad Seguros Generales', 'Responsabilidad Civil Extracontractual', 17.5],
    ['La Equidad Seguros Generales', 'Hogar', 15],
    ['La Equidad Seguros Generales', 'Pyme', 15],
    ['La Equidad Seguros Generales', 'Copropiedades', 17.5],

    // === EMERMEDICA ===
    ['Emermedica', 'Salud familiar', 7],

    // === MAGENTA ===
    ['MAGENTAASSISTANCE', 'Asistencia empresarial', 20],

    // === 48 HOORASS DIA ===
    ['48 HOORASS DÍA', 'Asistencia empresarial', 30],

    // === MAS SERVICIOS ===
    ['MÁS SERVICIOS COLOMBIA', 'Asistencia empresarial', 20],

    // === SKANDIA ===
    ['Skandia Seguros de Vida S.A', 'Capitalización', 2.5],
];

// ============================================================
// 7. APPLY COMISIONES (upsert: create or update)
// ============================================================
echo "=== APPLYING COMISIONES ===\n";
$created = 0;
$updated = 0;
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

    $existing = \DB::table('comisiones_aseguradoras')
        ->where('ramo_id', $ramoId)
        ->where('aseguradora_id', $asegId)
        ->first();

    if ($existing) {
        if ((float)$existing->porcentaje_comision !== (float)$porcentaje) {
            \DB::table('comisiones_aseguradoras')
                ->where('id', $existing->id)
                ->update([
                    'porcentaje_comision' => $porcentaje,
                    'updated_at' => now(),
                ]);
            $updated++;
            echo "  ~ UPDATED: {$asegSearch} + {$ramoSearch} = {$porcentaje}% (was {$existing->porcentaje_comision}%)\n";
        }
    } else {
        \DB::table('comisiones_aseguradoras')->insert([
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
// 8. REPORT
// ============================================================
echo "\n" . str_repeat('=', 60) . "\n";
echo "INFORME FINAL\n";
echo str_repeat('=', 60) . "\n";
echo "Aseguradoras añadidas: " . count($addedAsegs) . "\n";
foreach ($addedAsegs as $a) echo "  + {$a}\n";
echo "Ramos añadidos: " . count($addedRamos) . "\n";
foreach ($addedRamos as $r) echo "  + {$r}\n";
echo "Comisiones creadas: {$created}\n";
echo "Comisiones actualizadas: {$updated}\n";
echo "Errores: " . count($errors) . "\n";
foreach ($errors as $e) echo "  ! {$e}\n";
echo "\nTotal aseguradoras ahora: " . \App\Models\Aseguradora::where('broker_id', $brokerId)->count() . "\n";
echo "Total ramos ahora: " . \App\Models\Ramo::where('broker_id', $brokerId)->count() . "\n";
$totalCom = \DB::table('comisiones_aseguradoras')
    ->whereIn('ramo_id', \App\Models\Ramo::where('broker_id', $brokerId)->pluck('id'))
    ->whereIn('aseguradora_id', \App\Models\Aseguradora::where('broker_id', $brokerId)->pluck('id'))
    ->count();
echo "Total comisiones ahora: {$totalCom}\n";
echo "\nBackup guardado en: {$backupFile}\n";
echo "DONE.\n";
