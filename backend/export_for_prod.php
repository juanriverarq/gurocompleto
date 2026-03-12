<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
use Illuminate\Support\Facades\DB;

$LB = 2; $PB = 54;
$OFF = [
    'clientes'=>300000,'polizas'=>200000,'anexos'=>20000,
    'poliza_vinculados'=>50000,'recibos_caja'=>100000,
    'pagos_polizas'=>50000,'cobros_comisiones'=>50000,
    'vendedores'=>10000,'siniestros'=>1000,
];
$pdo = DB::connection()->getPdo();
$q = fn($v) => $v === null ? 'NULL' : $pdo->quote((string)$v);
$outDir = '/tmp/prod_export'; @mkdir($outDir, 0777, true);

function buildMap($table, $brokerCol, $brokerId, $offset) {
    $rows = DB::table($table)->where($brokerCol, $brokerId)->pluck('id');
    $map = [];
    foreach ($rows as $i => $id) { $map[(int)$id] = $offset + $i + 1; }
    return $map;
}

function exportTable($file, $table, $rows, $ownMap, $pb, $fkMaps, $q) {
    $f = fopen($file, 'w');
    fwrite($f, "SET FOREIGN_KEY_CHECKS=0;\n-- $table: ".count($rows)." rows\n");
    foreach ($rows as $row) {
        $c = (array)$row;
        if (isset($ownMap[(int)$c['id']])) $c['id'] = $ownMap[(int)$c['id']];
        if (array_key_exists('broker_id', $c)) $c['broker_id'] = $pb;
        foreach ($fkMaps as $col => $map) {
            if (isset($c[$col]) && $c[$col] && isset($map[(int)$c[$col]])) $c[$col] = $map[(int)$c[$col]];
        }
        $keys = implode(',', array_map(fn($k) => "`$k`", array_keys($c)));
        $vals = implode(',', array_map(fn($v) => $q($v), array_values($c)));
        fwrite($f, "INSERT INTO `$table` ($keys) VALUES ($vals);\n");
    }
    fwrite($f, "SET FOREIGN_KEY_CHECKS=1;\n");
    fclose($f);
    echo "  $table: ".count($rows)." rows -> ".basename($file)."\n";
}

echo "=== Building ID maps ===\n";
$vendMap = buildMap('vendedores','broker_id',$LB,$OFF['vendedores']);
$cliMap  = buildMap('clientes','broker_id',$LB,$OFF['clientes']);
$polMap  = buildMap('polizas','broker_id',$LB,$OFF['polizas']);
$anMap   = buildMap('anexos','broker_id',$LB,$OFF['anexos']);
$vinMap  = buildMap('poliza_vinculados','broker_id',$LB,$OFF['poliza_vinculados']);
$sinMap  = buildMap('siniestros','broker_id',$LB,$OFF['siniestros']);
$recMap  = buildMap('recibos_caja','broker_id',$LB,$OFF['recibos_caja']);
$pagMap  = buildMap('pagos_polizas','broker_id',$LB,$OFF['pagos_polizas']);
$cobMap  = buildMap('cobros_comisiones','broker_id',$LB,$OFF['cobros_comisiones']);

foreach (['vendedores'=>$vendMap,'clientes'=>$cliMap,'polizas'=>$polMap,'anexos'=>$anMap,
    'poliza_vinculados'=>$vinMap,'siniestros'=>$sinMap,'recibos_caja'=>$recMap,
    'pagos_polizas'=>$pagMap,'cobros_comisiones'=>$cobMap] as $t=>$m) {
    echo "  $t: ".count($m)." rows\n";
}

echo "\n=== Exporting ===\n";

// 00: aseguradoras + ramos (INSERT IGNORE, keep original IDs)
$asegIds = DB::table('polizas')->where('broker_id',$LB)->whereNotNull('aseguradora_id')->distinct()->pluck('aseguradora_id');
$ramoIds = DB::table('polizas')->where('broker_id',$LB)->whereNotNull('ramo_id')->distinct()->pluck('ramo_id');
// Also from anexos
$asegIds2 = DB::table('aseguradoras')->where('broker_id',$LB)->pluck('id');
$ramoIds2 = DB::table('ramos')->where('broker_id',$LB)->pluck('id');
$allAsegIds = $asegIds->merge($asegIds2)->unique();
$allRamoIds = $ramoIds->merge($ramoIds2)->unique();

$f = fopen("$outDir/00_aseguradoras_ramos.sql", 'w');
fwrite($f, "SET FOREIGN_KEY_CHECKS=0;\n");
$asegs = DB::table('aseguradoras')->whereIn('id', $allAsegIds)->get();
fwrite($f, "-- Aseguradoras: ".count($asegs)."\n");
foreach ($asegs as $a) {
    $c = (array)$a; $c['broker_id'] = $PB;
    $keys = implode(',', array_map(fn($k) => "`$k`", array_keys($c)));
    $vals = implode(',', array_map(fn($v) => $q($v), array_values($c)));
    fwrite($f, "INSERT IGNORE INTO `aseguradoras` ($keys) VALUES ($vals);\n");
}
$rams = DB::table('ramos')->whereIn('id', $allRamoIds)->get();
fwrite($f, "-- Ramos: ".count($rams)."\n");
foreach ($rams as $r) {
    $c = (array)$r; $c['broker_id'] = $PB;
    $keys = implode(',', array_map(fn($k) => "`$k`", array_keys($c)));
    $vals = implode(',', array_map(fn($v) => $q($v), array_values($c)));
    fwrite($f, "INSERT IGNORE INTO `ramos` ($keys) VALUES ($vals);\n");
}
fwrite($f, "SET FOREIGN_KEY_CHECKS=1;\n");
fclose($f);
echo "  aseguradoras: ".count($asegs).", ramos: ".count($rams)." -> 00_aseguradoras_ramos.sql\n";

// 01: vendedores
exportTable("$outDir/01_vendedores.sql", 'vendedores',
    DB::table('vendedores')->where('broker_id',$LB)->get(), $vendMap, $PB, [], $q);

// 02: clientes
exportTable("$outDir/02_clientes.sql", 'clientes',
    DB::table('clientes')->where('broker_id',$LB)->get(), $cliMap, $PB, [], $q);

// 03: polizas (remap client_id, seller_id)
exportTable("$outDir/03_polizas.sql", 'polizas',
    DB::table('polizas')->where('broker_id',$LB)->get(), $polMap, $PB,
    ['client_id'=>$cliMap, 'seller_id'=>$vendMap, 'seller_id_2'=>$vendMap], $q);

// 04: anexos (remap poliza_id)
exportTable("$outDir/04_anexos.sql", 'anexos',
    DB::table('anexos')->where('broker_id',$LB)->get(), $anMap, $PB,
    ['poliza_id'=>$polMap], $q);

// 05: poliza_vinculados (remap poliza_id)
exportTable("$outDir/05_poliza_vinculados.sql", 'poliza_vinculados',
    DB::table('poliza_vinculados')->where('broker_id',$LB)->get(), $vinMap, $PB,
    ['poliza_id'=>$polMap], $q);

// 06: siniestros (remap poliza_id, cliente_id)
exportTable("$outDir/06_siniestros.sql", 'siniestros',
    DB::table('siniestros')->where('broker_id',$LB)->get(), $sinMap, $PB,
    ['poliza_id'=>$polMap, 'cliente_id'=>$cliMap], $q);

// 07: recibos_caja (remap poliza_id if exists)
$recibos = DB::table('recibos_caja')->where('broker_id',$LB)->get();
$f = fopen("$outDir/07_recibos_caja.sql", 'w');
fwrite($f, "SET FOREIGN_KEY_CHECKS=0;\n-- recibos_caja: ".count($recibos)." rows\n");
foreach ($recibos as $row) {
    $c = (array)$row;
    if (isset($recMap[(int)$c['id']])) $c['id'] = $recMap[(int)$c['id']];
    $c['broker_id'] = $PB;
    if (isset($c['poliza_id']) && $c['poliza_id'] && isset($polMap[(int)$c['poliza_id']])) $c['poliza_id'] = $polMap[(int)$c['poliza_id']];
    $keys = implode(',', array_map(fn($k) => "`$k`", array_keys($c)));
    $vals = implode(',', array_map(fn($v) => $q($v), array_values($c)));
    fwrite($f, "INSERT INTO `recibos_caja` ($keys) VALUES ($vals);\n");
}
fwrite($f, "SET FOREIGN_KEY_CHECKS=1;\n");
fclose($f);
echo "  recibos_caja: ".count($recibos)." rows -> 07_recibos_caja.sql\n";

// 08: pagos_polizas (remap poliza_id, cliente_id)
exportTable("$outDir/08_pagos_polizas.sql", 'pagos_polizas',
    DB::table('pagos_polizas')->where('broker_id',$LB)->get(), $pagMap, $PB,
    ['poliza_id'=>$polMap, 'cliente_id'=>$cliMap], $q);

// 09: cobros_comisiones (remap poliza_id, pago_poliza_id)
exportTable("$outDir/09_cobros_comisiones.sql", 'cobros_comisiones',
    DB::table('cobros_comisiones')->where('broker_id',$LB)->get(), $cobMap, $PB,
    ['poliza_id'=>$polMap, 'pago_poliza_id'=>$pagMap], $q);

// Summary
echo "\n=== EXPORT COMPLETE ===\n";
$files = glob("$outDir/*.sql"); $tot = 0;
foreach ($files as $file) { $s = filesize($file); $tot += $s; echo "  ".basename($file).": ".round($s/1024/1024,2)." MB\n"; }
echo "Total: ".round($tot/1024/1024,2)." MB\n";
