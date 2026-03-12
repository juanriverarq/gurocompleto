<?php
require '/home/guro/public_html/app.guro.co/vendor/autoload.php';
$app = require_once '/home/guro/public_html/app.guro.co/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;

$brokerId = 54;
$polizaId = 203391;
$ssPolizaId = 5677398;

// Login
$resp = Http::timeout(15)->post('https://app.softseguros.com/api-token-auth/', [
    'username' => 'milena.perez',
    'password' => 'Mile10',
]);
if (!$resp->successful()) { echo "Login failed\n"; exit(1); }
$token = $resp->json('token');
echo "Token OK\n";

// Fetch ALL vinculados pages, filter for poliza=5677398
$matched = [];
$page = 1;
$totalPages = 0;
while (true) {
    $r = Http::timeout(30)
        ->withHeaders(['Authorization' => "Token {$token}"])
        ->get('https://app.softseguros.com/api/riesgoasegurado/', ['page' => $page]);
    if (!$r->successful()) { echo "Page {$page} failed: ".$r->status()."\n"; break; }
    $json = $r->json();
    $results = $json['results'] ?? [];

    foreach ($results as $v) {
        if ((int)$v['poliza'] === $ssPolizaId) {
            $matched[] = $v;
        }
    }

    if ($totalPages === 0 && count($results) > 0) {
        $count = $json['count'] ?? 0;
        $totalPages = (int)ceil($count / count($results));
        echo "Total: {$count} vinculados, ~{$totalPages} pages\n";
    }

    if ($page % 100 === 0) echo "  Page {$page}/{$totalPages} - matched so far: ".count($matched)."\n";

    if (empty($json['next'])) break;
    $page++;
}

echo "\nTotal matched for poliza 5677398: ".count($matched)."\n";

// Insert into DB
$created = 0;
$skipped = 0;
foreach ($matched as $v) {
    $ssId = $v['id'] ?? null;
    $documento = trim($v['cedula_asegurado'] ?? '');
    $nombre = trim(($v['nombre_asegurado'] ?? '') . ' ' . ($v['apellidos_asegurado'] ?? ''));

    if ($ssId) {
        $exists = DB::table('poliza_vinculados')
            ->where('broker_id', $brokerId)
            ->where('poliza_id', $polizaId)
            ->whereRaw("JSON_EXTRACT(metadata, '$.softseguros_id') = ?", [$ssId])
            ->exists();
        if ($exists) { $skipped++; continue; }
    }

    $prima = floatval(str_replace(',', '', $v['prima'] ?? '0'));
    $total = floatval(str_replace(',', '', $v['total'] ?? '0'));

    DB::table('poliza_vinculados')->insert([
        'broker_id'        => $brokerId,
        'poliza_id'        => $polizaId,
        'nombre_asegurado' => $nombre ?: null,
        'documento'        => $documento ?: null,
        'identificador'    => $v['numero_riesgo_asegurado'] ?? $v['numero_anexo'] ?? null,
        'valor'            => $prima,
        'valor_total'      => $total,
        'estado'           => !empty($v['retirado']) ? 'retirado' : 'activo',
        'email'            => $v['email'] ?? null,
        'telefono'         => $v['celular'] ?? null,
        'metadata'         => json_encode([
            'softseguros_id'   => $ssId,
            'parentesco'       => $v['parentesco'] ?? null,
            'genero'           => $v['genero'] ?? null,
            'fecha_nacimiento' => $v['fecha_nacimiento_asegurado'] ?? null,
            'iva'              => $v['iva'] ?? null,
            'gastos_expedicion'=> $v['gastos_expedicion'] ?? null,
        ]),
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $created++;
}

echo "Created: {$created}, Skipped: {$skipped}\n";
$totalInDb = DB::table('poliza_vinculados')->where('poliza_id', $polizaId)->count();
echo "Total vinculados now in DB for poliza #100296: {$totalInDb}\n";

// Sample
$samples = DB::table('poliza_vinculados')->where('poliza_id', $polizaId)->limit(5)->get();
foreach ($samples as $s) {
    echo "  ".$s->nombre_asegurado." | doc=".$s->documento." | valor=".$s->valor."\n";
}
