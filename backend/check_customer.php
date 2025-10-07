<?php

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';

$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Cliente;

echo "🔍 Buscando clientes con teléfono que contenga 3227697874...\n";

$clientes = Cliente::where(function($query) {
    $query->where('mobile_phone', 'LIKE', '%3227697874%')
          ->orWhere('phone', 'LIKE', '%3227697874%');
})->get(['id', 'first_name', 'last_name', 'mobile_phone', 'phone', 'status', 'broker_id']);

if ($clientes->isEmpty()) {
    echo "❌ No se encontraron clientes con ese teléfono\n";
    
    // Mostrar algunos clientes de ejemplo
    echo "\n📋 Mostrando algunos clientes existentes:\n";
    $ejemplos = Cliente::take(5)->get(['id', 'first_name', 'last_name', 'mobile_phone', 'phone', 'status']);
    foreach ($ejemplos as $cliente) {
        echo "  ID: {$cliente->id} | {$cliente->first_name} {$cliente->last_name} | Móvil: {$cliente->mobile_phone} | Fijo: {$cliente->phone} | Estado: {$cliente->status}\n";
    }
} else {
    echo "✅ Encontrados " . $clientes->count() . " cliente(s):\n";
    foreach ($clientes as $cliente) {
        echo "  ID: {$cliente->id} | {$cliente->first_name} {$cliente->last_name} | Móvil: {$cliente->mobile_phone} | Fijo: {$cliente->phone} | Estado: {$cliente->status} | Broker: {$cliente->broker_id}\n";
    }
}

echo "\n🎯 Probemos también buscar por Juan Rivera:\n";
$juanRivera = Cliente::where('first_name', 'LIKE', '%Juan%')
                   ->where('last_name', 'LIKE', '%Rivera%')
                   ->get(['id', 'first_name', 'last_name', 'mobile_phone', 'phone', 'status']);

foreach ($juanRivera as $cliente) {
    echo "  ID: {$cliente->id} | {$cliente->first_name} {$cliente->last_name} | Móvil: {$cliente->mobile_phone} | Fijo: {$cliente->phone} | Estado: {$cliente->status}\n";
}
