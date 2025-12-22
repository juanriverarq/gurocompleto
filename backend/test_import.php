<?php
// Script para probar la importación y ver el índice generado

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$brokerId = 32;

// Leer CSV de clientes
$clientesFile = '/Users/mac/Documents/GUROFINAL/plantilla_clientes.csv';
$clientesData = array_map('str_getcsv', file($clientesFile));
$clientesHeaders = array_shift($clientesData);

echo "=== CLIENTES ===\n";
echo "Headers: " . implode(', ', $clientesHeaders) . "\n";
echo "Total filas: " . count($clientesData) . "\n";

// Buscar índice de "ID de registro"
$idRegistroIdx = array_search('ID de registro', $clientesHeaders);
echo "Índice de 'ID de registro': " . ($idRegistroIdx !== false ? $idRegistroIdx : 'NO ENCONTRADO') . "\n";

if ($idRegistroIdx !== false) {
    echo "Primeros 3 IDs de registro:\n";
    for ($i = 0; $i < min(3, count($clientesData)); $i++) {
        echo "  - " . ($clientesData[$i][$idRegistroIdx] ?? 'VACÍO') . "\n";
    }
}

// Leer CSV de vendedores
$vendedoresFile = '/Users/mac/Documents/GUROFINAL/plantilla_vendedores.csv';
$vendedoresData = array_map('str_getcsv', file($vendedoresFile));
$vendedoresHeaders = array_shift($vendedoresData);

echo "\n=== VENDEDORES ===\n";
echo "Headers: " . implode(', ', $vendedoresHeaders) . "\n";
echo "Total filas: " . count($vendedoresData) . "\n";

$idRegistroVendIdx = array_search('ID de registro', $vendedoresHeaders);
echo "Índice de 'ID de registro': " . ($idRegistroVendIdx !== false ? $idRegistroVendIdx : 'NO ENCONTRADO') . "\n";

if ($idRegistroVendIdx !== false) {
    echo "Primeros 3 IDs de registro:\n";
    for ($i = 0; $i < min(3, count($vendedoresData)); $i++) {
        echo "  - " . ($vendedoresData[$i][$idRegistroVendIdx] ?? 'VACÍO') . "\n";
    }
}

// Leer CSV de pólizas
$polizasFile = '/Users/mac/Documents/GUROFINAL/plantilla_polizas.csv';
$polizasData = array_map('str_getcsv', file($polizasFile));
$polizasHeaders = array_shift($polizasData);

echo "\n=== PÓLIZAS ===\n";
echo "Headers: " . implode(', ', $polizasHeaders) . "\n";
echo "Total filas: " . count($polizasData) . "\n";

$tomadorIdIdx = array_search('tomador.id', $polizasHeaders);
$asesorIdIdx = array_search('Asesor.id', $polizasHeaders);
$asesor2IdIdx = array_search('Asesor 2.id', $polizasHeaders);

echo "Índice de 'tomador.id': " . ($tomadorIdIdx !== false ? $tomadorIdIdx : 'NO ENCONTRADO') . "\n";
echo "Índice de 'Asesor.id': " . ($asesorIdIdx !== false ? $asesorIdIdx : 'NO ENCONTRADO') . "\n";
echo "Índice de 'Asesor 2.id': " . ($asesor2IdIdx !== false ? $asesor2IdIdx : 'NO ENCONTRADO') . "\n";

if ($tomadorIdIdx !== false) {
    echo "\nPrimeros 5 tomador.id en pólizas:\n";
    for ($i = 0; $i < min(5, count($polizasData)); $i++) {
        $tomadorId = $polizasData[$i][$tomadorIdIdx] ?? 'VACÍO';
        echo "  Fila " . ($i+2) . ": tomador.id = '{$tomadorId}'\n";
    }
}

// Verificar si los IDs de pólizas existen en clientes
echo "\n=== VERIFICACIÓN DE RELACIONES ===\n";
$clientesIndex = [];
foreach ($clientesData as $row) {
    $id = trim($row[$idRegistroIdx] ?? '');
    if ($id !== '') {
        $clientesIndex[$id] = true;
    }
}
echo "Total IDs únicos en clientes: " . count($clientesIndex) . "\n";

$vendedoresIndex = [];
foreach ($vendedoresData as $row) {
    $id = trim($row[$idRegistroVendIdx] ?? '');
    if ($id !== '') {
        $vendedoresIndex[$id] = true;
    }
}
echo "Total IDs únicos en vendedores: " . count($vendedoresIndex) . "\n";

// Verificar cuántas pólizas tienen tomador.id que existe en clientes
$encontrados = 0;
$noEncontrados = 0;
$vacios = 0;
foreach ($polizasData as $i => $row) {
    $tomadorId = trim($row[$tomadorIdIdx] ?? '');
    if ($tomadorId === '') {
        $vacios++;
    } elseif (isset($clientesIndex[$tomadorId])) {
        $encontrados++;
    } else {
        $noEncontrados++;
        if ($noEncontrados <= 5) {
            echo "  Póliza fila " . ($i+2) . ": tomador.id '{$tomadorId}' NO existe en clientes\n";
        }
    }
}
echo "\nRelación tomador.id -> clientes:\n";
echo "  Encontrados: {$encontrados}\n";
echo "  No encontrados: {$noEncontrados}\n";
echo "  Vacíos: {$vacios}\n";

// Verificar vendedores
$encontradosV = 0;
$noEncontradosV = 0;
$vaciosV = 0;
foreach ($polizasData as $i => $row) {
    $asesorId = trim($row[$asesorIdIdx] ?? '');
    if ($asesorId === '') {
        $vaciosV++;
    } elseif (isset($vendedoresIndex[$asesorId])) {
        $encontradosV++;
    } else {
        $noEncontradosV++;
        if ($noEncontradosV <= 3) {
            echo "  Póliza fila " . ($i+2) . ": Asesor.id '{$asesorId}' NO existe en vendedores\n";
        }
    }
}
echo "\nRelación Asesor.id -> vendedores:\n";
echo "  Encontrados: {$encontradosV}\n";
echo "  No encontrados: {$noEncontradosV}\n";
echo "  Vacíos: {$vaciosV}\n";

echo "\n=== FIN ===\n";
