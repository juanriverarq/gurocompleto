<?php
/**
 * Import SoftSeguros Excel data (exported as JSON) for broker 54
 * Files: clientes, polizas, recaudos (activos/anulados/directos), anticipos,
 *        cartera (por cobrar/por pagar), nominas (recibidas/por cobrar)
 */
require_once '/home/guro/public_html/app.guro.co/vendor/autoload.php';
$app = require_once '/home/guro/public_html/app.guro.co/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Poliza;
use App\Models\Cliente;
use App\Models\Aseguradora;
use App\Models\Ramo;
use App\Models\Vendedor;
use App\Models\ReciboCaja;
use App\Models\PagoPoliza;
use App\Models\CobroComision;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

$brokerId = 54;
$jsonFile = '/home/guro/import_data.json';

if (!file_exists($jsonFile)) { echo "ERROR: {$jsonFile} not found\n"; exit(1); }
$allData = json_decode(file_get_contents($jsonFile), true);

// ─── LOOKUP TABLES ────────────────────────────────────────────
$aseguradoras = Aseguradora::withoutGlobalScopes()->where('broker_id', $brokerId)->get();
$asegMap = []; // normalized name -> model
foreach ($aseguradoras as $a) {
    $asegMap[mb_strtoupper(trim($a->nombre))] = $a;
    // Also strip S.A, S.A., SEGUROS
    $norm = preg_replace('/\s+S\.?A\.?\s*$/i', '', mb_strtoupper(trim($a->nombre)));
    $norm = preg_replace('/\s+SEGUROS\s*$/i', '', $norm);
    $asegMap[trim($norm)] = $a;
}

$ramos = Ramo::withoutGlobalScopes()->where('broker_id', $brokerId)->get();
$ramoMap = [];
foreach ($ramos as $r) {
    $ramoMap[mb_strtoupper(trim($r->nombre))] = $r;
}

$vendedores = Vendedor::withoutGlobalScopes()->where('broker_id', $brokerId)->get();
$vendedorMap = [];
foreach ($vendedores as $v) {
    $vendedorMap[mb_strtoupper(trim($v->nombres))] = $v;
}

// Client lookup by document
$clientesByDoc = Cliente::withoutGlobalScopes()->where('broker_id', $brokerId)->pluck('id', 'document_number')->toArray();

// Poliza lookup by policy_number
function rebuildPolizaIndex($brokerId) {
    $idx = [];
    foreach (DB::table('polizas')->where('broker_id', $brokerId)->whereNull('deleted_at')
        ->select('id', 'policy_number', 'client_id', 'aseguradora_id')->get() as $r) {
        $idx[$r->policy_number] = ['id' => (int)$r->id, 'cid' => $r->client_id ? (int)$r->client_id : null, 'aid' => $r->aseguradora_id ? (int)$r->aseguradora_id : null];
        $clean = str_replace(['-', ' ', '.'], '', $r->policy_number);
        if ($clean !== $r->policy_number) $idx[$clean] = $idx[$r->policy_number];
    }
    return $idx;
}

function findAseg($name) {
    global $asegMap;
    $upper = mb_strtoupper(trim($name));
    if (isset($asegMap[$upper])) return $asegMap[$upper];
    $norm = preg_replace('/\s+S\.?A\.?\s*$/i', '', $upper);
    $norm = preg_replace('/\s+SEGUROS\s*$/i', '', $norm);
    $norm = trim($norm);
    if (isset($asegMap[$norm])) return $asegMap[$norm];
    // Partial match
    foreach ($asegMap as $key => $aseg) {
        if (str_contains($key, $norm) || str_contains($norm, $key)) return $aseg;
    }
    // Special mappings
    $special = ['BOLIVAR' => 'SEGUROS BOLIVAR', 'LIBERTY' => 'LIBERTY SEGUROS S.A.', 'EQUIDAD' => 'LA EQUIDAD SEGUROS',
        'PREVISORA SEGUROS' => 'PREVISORA', 'PREVISORA' => 'PREVISORA', 'SEGUROS DEL ESTADO' => 'SEGUROS DEL ESTADO S.A',
        'SEGUROS DEL ESTADO S.A.' => 'SEGUROS DEL ESTADO S.A', 'AXA COLPATRIA' => 'AXA COLPATRIA SEGUROS S.A.',
        'ALLIANZ SEGUROS' => 'ALLIANZ SEGUROS', 'ALLIANZ SEGUROS S.A' => 'ALLIANZ SEGUROS'];
    if (isset($special[$upper]) && isset($asegMap[mb_strtoupper($special[$upper])])) return $asegMap[mb_strtoupper($special[$upper])];
    return null;
}

function findRamo($name) {
    global $ramoMap;
    $upper = mb_strtoupper(trim($name));
    if (isset($ramoMap[$upper])) return $ramoMap[$upper];
    // Try removing accents
    $norm = str_replace(['Á','É','Í','Ó','Ú'], ['A','E','I','O','U'], $upper);
    foreach ($ramoMap as $key => $ramo) {
        $keyNorm = str_replace(['Á','É','Í','Ó','Ú'], ['A','E','I','O','U'], $key);
        if ($keyNorm === $norm || str_contains($key, $upper) || str_contains($upper, $key)) return $ramo;
    }
    return null;
}

function parseDate($v) {
    if (!$v) return null;
    if (preg_match('/^\d{4}-\d{2}-\d{2}/', $v)) return substr($v, 0, 10);
    if (preg_match('/^\d{2}\/\d{2}\/\d{4}$/', $v)) {
        $parts = explode('/', $v);
        return $parts[2] . '-' . $parts[1] . '-' . $parts[0];
    }
    return null;
}

function parseDecimal($v) {
    if ($v === null || $v === '') return 0;
    return floatval(str_replace([' ', '$', ','], '', $v));
}

function mapDocType($raw) {
    $map = ['CÉDULA' => 'CC', 'CEDULA' => 'CC', 'NIT' => 'NIT', 'PASAPORTE' => 'PA',
        'TARJETA DE IDENTIDAD' => 'TI', 'CE' => 'CE', 'CEDULA DE EXTRANJERIA' => 'CE'];
    $upper = mb_strtoupper(trim($raw ?? ''));
    foreach ($map as $k => $v) { if (str_contains($upper, $k)) return $v; }
    return 'CC';
}

function mapPolizaType($ramoNombre) {
    $r = mb_strtolower($ramoNombre);
    if (str_contains($r, 'auto') || str_contains($r, 'soat') || str_contains($r, 'vehic') || str_contains($r, 'moto')) return 'autos';
    if (str_contains($r, 'vida') || str_contains($r, 'deudor')) return 'vida';
    if (str_contains($r, 'salud') || str_contains($r, 'medic') || str_contains($r, 'arl')) return 'salud';
    if (str_contains($r, 'hogar') || str_contains($r, 'incendio') || str_contains($r, 'multirri')) return 'hogar';
    if (str_contains($r, 'responsabilidad') || str_contains($r, 'cumplimiento') || str_contains($r, 'rc') || str_contains($r, 'fianza') || str_contains($r, 'seriedad') || str_contains($r, 'judicial') || str_contains($r, 'jurídica')) return 'responsabilidad_civil';
    if (str_contains($r, 'accidente') || str_contains($r, 'ap ') || str_contains($r, 'ape')) return 'accidentes';
    if (str_contains($r, 'empresa') || str_contains($r, 'pyme') || str_contains($r, 'copropied') || str_contains($r, 'transporte') || str_contains($r, 'carga')) return 'empresarial';
    return 'otros';
}

function mapStatus($estado) {
    $map = ['vigente' => 'active', 'activa' => 'active', 'cancelada' => 'cancelled', 'vencida' => 'expired',
        'suspendida' => 'suspended', 'pendiente' => 'pending', 'expedición' => 'active', 'expedicion' => 'active',
        'no renovada' => 'expired'];
    return $map[mb_strtolower(trim($estado ?? ''))] ?? 'active';
}

function mapPaymentFreq($fp, $per) {
    $p = mb_strtolower(trim($per ?? ''));
    $map = ['mensual' => 'monthly', 'trimestral' => 'quarterly', 'semestral' => 'biannual', 'anual' => 'annual'];
    if (isset($map[$p])) return $map[$p];
    $f = mb_strtolower(trim($fp ?? ''));
    if (str_contains($f, 'fraccion') || str_contains($f, 'financ')) return 'monthly';
    return 'annual';
}

$stats = ['clientes' => ['created' => 0, 'updated' => 0, 'skipped' => 0],
    'polizas' => ['created' => 0, 'skipped' => 0, 'errors' => 0],
    'recaudos' => ['created' => 0, 'skipped' => 0, 'errors' => 0],
    'anticipos' => ['created' => 0, 'skipped' => 0],
    'cartera' => ['pagos_created' => 0, 'comisiones_created' => 0, 'skipped' => 0],
    'nominas' => ['comisiones_created' => 0, 'pagos_created' => 0, 'skipped' => 0]];

// ═══════════════════════════════════════════════════════════════
// 1) CLIENTES
// ═══════════════════════════════════════════════════════════════
echo "\n=== 1) CLIENTES ===\n";
DB::beginTransaction();
try {
    foreach ($allData['clientes'] ?? [] as $row) {
        $doc = trim($row['NÚMERO DE DOCUMENTO'] ?? '');
        if (!$doc) { $stats['clientes']['skipped']++; continue; }
        $firstName = trim($row['NOMBRE'] ?? '');
        $lastName = trim($row['APELLIDOS'] ?? '');
        if (!$firstName && !$lastName) { $stats['clientes']['skipped']++; continue; }

        $docType = mapDocType($row['TIPO DOCUMENTO'] ?? 'Cédula');
        $isEmpresa = $docType === 'NIT' || (str_contains($doc, '-') && strlen($doc) >= 9);

        $existing = Cliente::withoutGlobalScopes()->where('broker_id', $brokerId)->where('document_number', $doc)->first();
        if ($existing) {
            $upd = [];
            if (empty($existing->email) && !empty($row['EMAIL PRINCIPAL'])) $upd['email'] = $row['EMAIL PRINCIPAL'];
            if (empty($existing->mobile_phone) && !empty($row['CELULAR PRINCIPAL'])) $upd['mobile_phone'] = $row['CELULAR PRINCIPAL'];
            if (empty($existing->phone) && !empty($row['TELÉFONO PRINCIPAL'])) $upd['phone'] = $row['TELÉFONO PRINCIPAL'];
            if (empty($existing->address) && !empty($row['DIRECCIÓN PRINCIPAL'])) $upd['address'] = $row['DIRECCIÓN PRINCIPAL'];
            if (empty($existing->city) && !empty($row['CIUDAD'])) $upd['city'] = $row['CIUDAD'];
            if (!empty($upd)) { $existing->update($upd); $stats['clientes']['updated']++; }
            else { $stats['clientes']['skipped']++; }
            continue;
        }

        Cliente::withoutGlobalScopes()->create([
            'broker_id' => $brokerId,
            'client_type' => $isEmpresa ? 'empresa' : 'persona',
            'first_name' => $firstName,
            'last_name' => $lastName,
            'document_type' => $docType,
            'document_number' => $doc,
            'company_legal_name' => $isEmpresa ? trim($firstName . ' ' . $lastName) : null,
            'company' => $isEmpresa ? trim($firstName . ' ' . $lastName) : null,
            'email' => $row['EMAIL PRINCIPAL'] ?? null,
            'phone' => $row['TELÉFONO PRINCIPAL'] ?? null,
            'mobile_phone' => $row['CELULAR PRINCIPAL'] ?? null,
            'birth_date' => $isEmpresa ? null : parseDate($row['FECHA NACIMIENTO'] ?? null),
            'address' => $row['DIRECCIÓN PRINCIPAL'] ?? null,
            'city' => $row['CIUDAD'] ?? null,
            'country' => 'Colombia',
            'occupation' => $row['OCUPACIÓN'] ?? null,
            'status' => 'active',
            'source' => 'softseguros',
        ]);
        $stats['clientes']['created']++;
        $clientesByDoc[$doc] = DB::getPdo()->lastInsertId();
    }
    DB::commit();
    echo "  Created: {$stats['clientes']['created']}, Updated: {$stats['clientes']['updated']}, Skipped: {$stats['clientes']['skipped']}\n";
} catch (\Exception $e) { DB::rollBack(); echo "  ERROR: " . $e->getMessage() . "\n"; }

// Refresh client lookup
$clientesByDoc = Cliente::withoutGlobalScopes()->where('broker_id', $brokerId)->pluck('id', 'document_number')->toArray();

// ═══════════════════════════════════════════════════════════════
// 2) POLIZAS
// ═══════════════════════════════════════════════════════════════
echo "\n=== 2) POLIZAS ===\n";
DB::beginTransaction();
try {
    foreach ($allData['polizas'] ?? [] as $row) {
        $pn = trim($row['NÚMERO PÓLIZA'] ?? '');
        if (!$pn) { $stats['polizas']['skipped']++; continue; }

        $existing = Poliza::withoutGlobalScopes()->where('broker_id', $brokerId)->where('policy_number', $pn)->first();
        if ($existing) { $stats['polizas']['skipped']++; continue; }

        $cedCliente = trim($row['CÉDULA CLIENTE'] ?? '');
        $clienteId = $cedCliente ? ($clientesByDoc[$cedCliente] ?? null) : null;
        if (!$clienteId) { $stats['polizas']['skipped']++; continue; }

        $asegNombre = trim($row['ASEGURADORA'] ?? '');
        $ramoNombre = trim($row['RAMO PRINCIPAL'] ?? '');
        $asegObj = findAseg($asegNombre);
        $ramoObj = findRamo($ramoNombre);
        $vendNombre = trim($row['VENDEDOR'] ?? '');
        $vendObj = $vendNombre ? ($vendedorMap[mb_strtoupper($vendNombre)] ?? null) : null;

        $primaNeta = parseDecimal($row['PRIMA NETA'] ?? 0);
        $iva = parseDecimal($row['IVA'] ?? 0);
        $total = parseDecimal($row['TOTAL'] ?? 0);
        $comision = parseDecimal($row['COMISIÓN'] ?? 0);
        $pctComision = parseDecimal($row['PORCENTAJE DE COMISIÓN'] ?? 0);
        $pctIva = parseDecimal($row['PORCENTAJE DE IVA'] ?? 0);
        $gastos = parseDecimal($row['GASTOS DE EXPEDICIÓN'] ?? 0);
        $valFinanc = parseDecimal($row['VALOR FINANCIACIÓN'] ?? 0);

        $clienteName = trim(($row['NOMBRES CLIENTE'] ?? '') . ' ' . ($row['APELLIDOS CLIENTE'] ?? ''));
        $formaPago = $row['FORMA DE PAGO'] ?? null;
        $periodicidad = $row['PERIODICIDAD DEL PAGO'] ?? null;

        $fechaInicio = parseDate($row['FECHA INICIO'] ?? null);
        $fechaFin = parseDate($row['FECHA FIN'] ?? null);
        $fechaExp = parseDate($row['FECHA EXPEDICIÓN'] ?? null);
        $fechaRecep = parseDate($row['FECHA RECEPCIÓN'] ?? null);

        $estadoCartera = $row['ESTADO CARTERA'] ?? '';
        $isComisionada = stripos($estadoCartera, 'Comisionada') !== false;

        Poliza::withoutGlobalScopes()->create([
            'broker_id' => $brokerId,
            'policy_number' => $pn,
            'type' => mapPolizaType($ramoNombre),
            'insurance_company' => $asegNombre ?: null,
            'aseguradora_id' => $asegObj?->id,
            'product_name' => $ramoNombre ?: 'General',
            'ramo_id' => $ramoObj?->id,
            'description' => $row['RIESGO'] ?? null,
            'client_id' => $clienteId,
            'client_name' => $clienteName ?: null,
            'client_document' => $cedCliente,
            'issue_date' => $fechaExp ?? $fechaInicio,
            'start_date' => $fechaInicio,
            'end_date' => $fechaFin,
            'reception_date' => $fechaRecep,
            'premium_amount' => $primaNeta,
            'vat_percentage' => $pctIva > 0 ? round($pctIva * 100, 2) : ($primaNeta > 0 && $iva > 0 ? round(($iva / $primaNeta) * 100, 2) : 0),
            'vat_amount' => $iva,
            'total_amount' => $total,
            'gastos_adicionales' => $gastos,
            'commission_percentage' => $pctComision > 0 ? round($pctComision * 100, 2) : 0,
            'commission_amount' => $comision,
            'insured_amount' => parseDecimal($row['VALOR RIESGO ASEGURADO'] ?? 0),
            'valor_financiacion' => $valFinanc,
            'status' => mapStatus($row['ESTADO'] ?? 'Vigente'),
            'payment_frequency' => mapPaymentFreq($formaPago, $periodicidad),
            'auto_renewal' => strtolower($row['NUEVA / RENOVADA'] ?? '') === 'renovada',
            'is_renewal' => strtolower($row['NUEVA / RENOVADA'] ?? '') === 'renovada',
            'seller_name' => $vendNombre ?: null,
            'seller_id' => $vendObj?->id,
            'policy_holder_name' => $row['NOMBRE TOMADOR'] ?? null,
            'policy_holder_document' => $row['DOCUMENTO TOMADOR'] ?? null,
            'insured_name' => $row['NOMBRE ASEGURADO'] ?? null,
            'insured_document' => $row['DOCUMENTO ASEGURADO'] ?? null,
            'beneficiary_name' => $row['NOMBRE DEL BENEFICIARIO'] ?? null,
            'beneficiary_document' => $row['CÉDULA DEL BENEFICIARIO'] ?? null,
            'tipo_poliza' => $row['TIPO PÓLIZA'] ?? 'individual',
            'sede_nombre' => $row['SEDE'] ?? null,
            'estado_cartera' => $estadoCartera ?: null,
            'comisionada' => $isComisionada,
            'softseguros_id' => $row['IDENTIFICADOR'] ?? null,
            'notes' => $row['OBSERVACIONES'] ?? null,
            'tipo_moneda' => $row['TIPO MONEDA'] ?? null,
            'tasa_cambio' => parseDecimal($row['TASA DE CAMBIO'] ?? 0) ?: null,
            'participacion' => parseDecimal($row['PARTICIPACIÓN'] ?? 0) ?: null,
        ]);
        $stats['polizas']['created']++;
    }
    DB::commit();
    echo "  Created: {$stats['polizas']['created']}, Skipped: {$stats['polizas']['skipped']}\n";
} catch (\Exception $e) { DB::rollBack(); echo "  ERROR: " . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n"; $stats['polizas']['errors']++; }

// Rebuild poliza index
$polizaIdx = rebuildPolizaIndex($brokerId);

// ═══════════════════════════════════════════════════════════════
// 3) RECAUDOS (activos, anulados, directos) → recibos_caja
// ═══════════════════════════════════════════════════════════════
echo "\n=== 3) RECAUDOS ===\n";
$recaudoSets = [
    'recaudos_activos' => ['tipo' => 'recibo', 'anulado' => false, 'directo' => false],
    'recaudos_anulados' => ['tipo' => 'recibo', 'anulado' => true, 'directo' => false],
    'recaudos_directos' => ['tipo' => 'recibo', 'anulado' => false, 'directo' => true],
];

DB::beginTransaction();
try {
    foreach ($recaudoSets as $key => $meta) {
        foreach ($allData[$key] ?? [] as $row) {
            $ssId = $row['IDENTIFICADOR'] ?? null;
            if (!$ssId) { $stats['recaudos']['skipped']++; continue; }

            // Skip duplicates
            $exists = ReciboCaja::withoutGlobalScopes()->where('broker_id', $brokerId)->where('softseguros_id', $ssId)->exists();
            if ($exists) { $stats['recaudos']['skipped']++; continue; }

            $pn = trim($row['NÚMERO PÓLIZA'] ?? '');
            $pol = $pn ? ($polizaIdx[$pn] ?? $polizaIdx[str_replace(['-',' ','.'], '', $pn)] ?? null) : null;
            $cedCliente = trim($row['CÉDULA CLIENTE'] ?? '');
            $clienteId = $cedCliente ? ($clientesByDoc[$cedCliente] ?? null) : null;
            // If no client match and we have poliza, use poliza's client
            if (!$clienteId && $pol) $clienteId = $pol['cid'];

            $numRecibo = $row['NÚMERO RECIBO'] ?? null;
            $cuota = $row['# CUOTA'] ?? null;
            $valorAPagar = parseDecimal($row['VALOR A PAGAR'] ?? 0);
            $valorRecOficina = parseDecimal($row['VALOR RECAUDADO EN OFICINA'] ?? 0);
            $valorRecAseg = parseDecimal($row['VALOR RECAUDADO EN ASEGURADORA'] ?? 0);
            $comisionAgencia = parseDecimal($row['COMISIÓN AGENCIA'] ?? 0);

            $fechaRecOficina = parseDate($row['FECHA RECAUDADO EN OFICINA'] ?? null);
            $fechaRecAseg = parseDate($row['FECHA RECAUDADO EN ASEGURADORA'] ?? null);
            $fechaCreacion = parseDate($row['FECHA CREACIÓN RECUADO'] ?? null);
            $fechaInicioVig = parseDate($row['INICIO DE VIGENCIA'] ?? null);

            ReciboCaja::withoutGlobalScopes()->create([
                'broker_id' => $brokerId,
                'poliza_id' => $pol ? $pol['id'] : null,
                'cliente_id' => $clienteId,
                'poliza_numero' => $pn ?: null,
                'poliza_objeto_asegurado' => $row['RIESGO'] ?? null,
                'cliente_nombre' => $row['NOMBRE CLIENTE'] ?? null,
                'cliente_documento' => $cedCliente ?: null,
                'aseguradora_nombre' => $row['ASEGURADORA'] ?? null,
                'ramo_nombre' => $row['RAMO PRINCIPAL'] ?? null,
                'sede_nombre' => $row['SEDE'] ?? 'principal',
                'vendedor_nombre' => $row['VENDEDOR'] ?? null,
                'usuario_recauda' => $row['USUARIO RECAUDA'] ?? null,
                'numero_recibo' => $numRecibo,
                'numero_pago' => $cuota,
                'tipo' => $meta['tipo'],
                'tipo_recaudo' => $meta['directo'] ? 'directo' : 'oficina',
                'recaudo_directo' => $meta['directo'],
                'forma_pago' => $row['FORMA DE PAGO'] ?? null,
                'medio_de_pago' => $row['MEDIO DE PAGO ( PÓLIZA )'] ?? null,
                'forma_pago_aseguradora' => $row['FORMA DE PAGO ( PÓLIZA )'] ?? null,
                'fecha_pago' => $fechaCreacion ?? $fechaRecOficina ?? $fechaRecAseg,
                'fecha_realizo_pago_oficina' => $fechaRecOficina,
                'fecha_inicio_poliza' => $fechaInicioVig,
                'valor_a_pagar' => $valorAPagar,
                'valor_recaudado_en_oficina' => $meta['directo'] ? 0 : $valorRecOficina,
                'comision_a_recibir' => $comisionAgencia,
                'recaudado_en_oficina' => !$meta['directo'] && $valorRecOficina > 0,
                'recaudado' => ($valorRecOficina > 0 || $valorRecAseg > 0),
                'recibo_anulado' => $meta['anulado'],
                'activo' => !$meta['anulado'],
                'softseguros_id' => $ssId,
                'source' => 'softseguros',
            ]);
            $stats['recaudos']['created']++;
        }
    }
    DB::commit();
    echo "  Created: {$stats['recaudos']['created']}, Skipped: {$stats['recaudos']['skipped']}\n";
} catch (\Exception $e) { DB::rollBack(); echo "  ERROR: " . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n"; }

// ═══════════════════════════════════════════════════════════════
// 4) ANTICIPOS → recibos_caja (tipo=anticipo)
// ═══════════════════════════════════════════════════════════════
echo "\n=== 4) ANTICIPOS ===\n";
DB::beginTransaction();
try {
    foreach ($allData['anticipos'] ?? [] as $row) {
        $ssId = $row['IDENTIFICADOR'] ?? null;
        if (!$ssId) { $stats['anticipos']['skipped']++; continue; }

        $exists = ReciboCaja::withoutGlobalScopes()->where('broker_id', $brokerId)->where('softseguros_id', $ssId)->exists();
        if ($exists) { $stats['anticipos']['skipped']++; continue; }

        $cedCliente = trim($row['DOCUMENTO DEL CLIENTE'] ?? '');
        $clienteId = $cedCliente ? ($clientesByDoc[$cedCliente] ?? null) : null;
        $clienteNombre = trim(($row['NOMBRES DEL CLIENTE'] ?? '') . ' ' . ($row['APELLIDOS DEL CLIENTE'] ?? ''));

        ReciboCaja::withoutGlobalScopes()->create([
            'broker_id' => $brokerId,
            'cliente_id' => $clienteId,
            'cliente_nombre' => $clienteNombre ?: null,
            'cliente_documento' => $cedCliente ?: null,
            'numero_recibo' => $row['# RECIBO'] ?? null,
            'tipo' => 'anticipo',
            'es_anticipo' => true,
            'forma_pago' => $row['FORMA DE PAGO'] ?? null,
            'medio_de_pago' => $row['MEDIO DE PAGO ( PÓLIZA )'] ?? null,
            'forma_pago_aseguradora' => $row['FORMA DE PAGO ( PÓLIZA )'] ?? null,
            'fecha_pago' => parseDate($row['FECHA RECAUDADO OFICINA'] ?? null),
            'fecha_realizo_pago_oficina' => parseDate($row['FECHA RECAUDADO OFICINA'] ?? null),
            'valor_recaudado_en_oficina' => parseDecimal($row['VALOR RECAUDADO EN OFICINA'] ?? 0),
            'valor_a_pagar' => parseDecimal($row['VALOR RECAUDADO EN OFICINA'] ?? 0),
            'observaciones' => $row['OBSERVACIÓN'] ?? null,
            'recaudado_en_oficina' => true,
            'recaudado' => true,
            'activo' => true,
            'softseguros_id' => $ssId,
            'source' => 'softseguros',
        ]);
        $stats['anticipos']['created']++;
    }
    DB::commit();
    echo "  Created: {$stats['anticipos']['created']}, Skipped: {$stats['anticipos']['skipped']}\n";
} catch (\Exception $e) { DB::rollBack(); echo "  ERROR: " . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n"; }

// ═══════════════════════════════════════════════════════════════
// 5) CARTERA (por cobrar + por pagar) → pagos_polizas + cobros_comisiones
// ═══════════════════════════════════════════════════════════════
echo "\n=== 5) CARTERA ===\n";
DB::beginTransaction();
try {
    // Cartera por cobrar → PagoPoliza (pendiente oficina + aseguradora) + CobroComision
    foreach ($allData['cartera_cobrar'] ?? [] as $row) {
        $ssId = (int)($row['IDENTIFICADOR'] ?? 0);
        if (!$ssId) { $stats['cartera']['skipped']++; continue; }
        $pn = trim($row['NÚMERO PÓLIZA'] ?? '');
        $pol = $pn ? ($polizaIdx[$pn] ?? $polizaIdx[str_replace(['-',' ','.'], '', $pn)] ?? null) : null;
        if (!$pol) { $stats['cartera']['skipped']++; continue; }

        $primaTotalPago = parseDecimal($row['PRIMA TOTAL DEL PAGO'] ?? 0);
        $saldoOficina = parseDecimal($row['SALDO PENDIENTE OFICINA'] ?? 0);
        $saldoAseg = parseDecimal($row['SALDO PENDIENTE ASEGURADORA'] ?? 0);
        $comision = parseDecimal($row['COMISIÓN A RECIBIR'] ?? 0);
        $fechaLimite = parseDate($row['FECHA LÍMITE DE PAGO'] ?? null) ?? now()->toDateString();

        if ($saldoOficina > 0 && $pol['cid']) {
            PagoPoliza::updateOrCreate(
                ['broker_id' => $brokerId, 'poliza_id' => $pol['id'], 'tipo_recaudo' => 'oficina', 'referencia_pago' => "ss_cxc_{$ssId}"],
                ['cliente_id' => $pol['cid'], 'monto_total' => $primaTotalPago ?: $saldoOficina, 'monto_pagado' => max(0, ($primaTotalPago ?: $saldoOficina) - $saldoOficina), 'monto_pendiente' => $saldoOficina, 'estado' => 'pendiente', 'fecha_pago' => $fechaLimite, 'observaciones' => 'SS: cartera por cobrar']
            );
            $stats['cartera']['pagos_created']++;
        }
        if ($saldoAseg > 0 && $pol['cid']) {
            PagoPoliza::updateOrCreate(
                ['broker_id' => $brokerId, 'poliza_id' => $pol['id'], 'tipo_recaudo' => 'aseguradora', 'referencia_pago' => "ss_cxc_a_{$ssId}"],
                ['cliente_id' => $pol['cid'], 'monto_total' => $saldoAseg, 'monto_pagado' => 0, 'monto_pendiente' => $saldoAseg, 'estado' => 'pendiente', 'fecha_pago' => $fechaLimite, 'observaciones' => 'SS: cartera por cobrar aseg']
            );
            $stats['cartera']['pagos_created']++;
        }
        if ($comision > 0) {
            CobroComision::updateOrCreate(
                ['broker_id' => $brokerId, 'poliza_id' => $pol['id'], 'referencia_cobro' => "ss_cxc_{$ssId}"],
                ['aseguradora_id' => $pol['aid'], 'monto_comision' => $comision, 'monto_cobrado' => 0, 'monto_pendiente' => $comision, 'estado' => 'pendiente', 'observaciones' => 'SS: comisión por cobrar']
            );
            $stats['cartera']['comisiones_created']++;
        }
    }

    // Cartera por pagar → PagoPoliza (oficina pagado + aseg pendiente) + CobroComision
    foreach ($allData['cartera_pagar'] ?? [] as $row) {
        $ssId = (int)($row['IDENTIFICADOR'] ?? 0);
        if (!$ssId) { $stats['cartera']['skipped']++; continue; }
        $pn = trim($row['NÚMERO PÓLIZA'] ?? '');
        $pol = $pn ? ($polizaIdx[$pn] ?? $polizaIdx[str_replace(['-',' ','.'], '', $pn)] ?? null) : null;
        if (!$pol) { $stats['cartera']['skipped']++; continue; }

        $primaTotalPago = parseDecimal($row['PRIMA TOTAL DEL PAGO'] ?? 0);
        $recOficina = parseDecimal($row['VALOR RECAUDADO EN OFICINA'] ?? 0);
        $saldoAseg = parseDecimal($row['SALDO PENDIENTE ASEGURADORA'] ?? 0);
        $comision = parseDecimal($row['COMISIÓN A RECIBIR'] ?? 0);
        $fechaRecaudo = parseDate($row['FECHA RECAUDO EN OFICINA'] ?? null) ?? now()->toDateString();
        $medioPago = mb_substr($row['MEDIO DE PAGO'] ?? '', 0, 191) ?: null;

        if ($recOficina > 0 && $pol['cid']) {
            PagoPoliza::updateOrCreate(
                ['broker_id' => $brokerId, 'poliza_id' => $pol['id'], 'tipo_recaudo' => 'oficina', 'referencia_pago' => "ss_cxp_{$ssId}"],
                ['cliente_id' => $pol['cid'], 'monto_total' => $primaTotalPago ?: $recOficina, 'monto_pagado' => $recOficina, 'monto_pendiente' => max(0, ($primaTotalPago ?: $recOficina) - $recOficina), 'estado' => 'pagado', 'metodo_pago' => $medioPago, 'fecha_pago' => $fechaRecaudo, 'observaciones' => 'SS: pagos compañía']
            );
            $stats['cartera']['pagos_created']++;
        }
        if ($saldoAseg > 0 && $pol['cid']) {
            PagoPoliza::updateOrCreate(
                ['broker_id' => $brokerId, 'poliza_id' => $pol['id'], 'tipo_recaudo' => 'aseguradora', 'referencia_pago' => "ss_cxp_a_{$ssId}"],
                ['cliente_id' => $pol['cid'], 'monto_total' => $saldoAseg, 'monto_pagado' => 0, 'monto_pendiente' => $saldoAseg, 'estado' => 'pendiente', 'fecha_pago' => $fechaRecaudo, 'observaciones' => 'SS: pend aseg']
            );
            $stats['cartera']['pagos_created']++;
        }
        if ($comision > 0) {
            CobroComision::updateOrCreate(
                ['broker_id' => $brokerId, 'poliza_id' => $pol['id'], 'referencia_cobro' => "ss_cxp_{$ssId}"],
                ['aseguradora_id' => $pol['aid'], 'monto_comision' => $comision, 'monto_cobrado' => 0, 'monto_pendiente' => $comision, 'estado' => 'pendiente', 'observaciones' => 'SS: comisión pend']
            );
            $stats['cartera']['comisiones_created']++;
        }
    }
    DB::commit();
    echo "  Pagos: {$stats['cartera']['pagos_created']}, Comisiones: {$stats['cartera']['comisiones_created']}, Skipped: {$stats['cartera']['skipped']}\n";
} catch (\Exception $e) { DB::rollBack(); echo "  ERROR: " . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n"; }

// ═══════════════════════════════════════════════════════════════
// 6) NOMINAS (recibidas + por cobrar) → cobros_comisiones + pagos_polizas
// ═══════════════════════════════════════════════════════════════
echo "\n=== 6) NOMINAS ===\n";
DB::beginTransaction();
try {
    // Nóminas recibidas (comisiones ya cobradas)
    foreach ($allData['nominas_recibidas'] ?? [] as $row) {
        $ssId = (int)($row['IDENTIFICADOR'] ?? 0);
        if (!$ssId) { $stats['nominas']['skipped']++; continue; }
        $pn = trim($row['NÚMERO PÓLIZA'] ?? '');
        $pol = $pn ? ($polizaIdx[$pn] ?? $polizaIdx[str_replace(['-',' ','.'], '', $pn)] ?? null) : null;
        if (!$pol) { $stats['nominas']['skipped']++; continue; }

        $comARecibir = parseDecimal($row['COMISIÓN A RECIBIR'] ?? 0);
        $comRecibida = parseDecimal($row['COMISIÓN RECIBIDA'] ?? 0);
        $valorPagadoAseg = parseDecimal($row['VALOR PAGADO EN ASEGURADORA'] ?? 0);
        $primaTotalPago = parseDecimal($row['PRIMA TOTAL DEL PAGO'] ?? 0);
        $fechaRecOficina = parseDate($row['FECHA RECAUDADO EN OFICINA'] ?? null);
        $fechaPagoAseg = parseDate($row['FECHA REALIZÓ PAGO EN ASEGURADORA'] ?? null);
        $fechaComisionada = parseDate($row['FECHA COMISIONADA'] ?? null);

        $mc = $comARecibir ?: $comRecibida;
        if ($mc > 0) {
            CobroComision::updateOrCreate(
                ['broker_id' => $brokerId, 'poliza_id' => $pol['id'], 'referencia_cobro' => "ss_nomrec_{$ssId}"],
                ['aseguradora_id' => $pol['aid'], 'monto_comision' => $mc, 'monto_cobrado' => $comRecibida, 'monto_pendiente' => max(0, $mc - $comRecibida), 'estado' => $comRecibida >= $mc ? 'cobrado' : ($comRecibida > 0 ? 'parcial' : 'pendiente'), 'fecha_cobro' => $fechaComisionada, 'observaciones' => 'SS: comisión recibida']
            );
            $stats['nominas']['comisiones_created']++;
        }
        if ($valorPagadoAseg > 0 && $pol['cid']) {
            PagoPoliza::updateOrCreate(
                ['broker_id' => $brokerId, 'poliza_id' => $pol['id'], 'tipo_recaudo' => 'aseguradora', 'referencia_pago' => "ss_nomrec_a_{$ssId}"],
                ['cliente_id' => $pol['cid'], 'monto_total' => $valorPagadoAseg, 'monto_pagado' => $valorPagadoAseg, 'monto_pendiente' => 0, 'estado' => 'pagado', 'fecha_pago' => $fechaPagoAseg ?? $fechaRecOficina ?? now()->toDateString(), 'observaciones' => 'SS: pago aseg']
            );
            $stats['nominas']['pagos_created']++;
        }
        if ($fechaRecOficina && $primaTotalPago > 0 && $pol['cid']) {
            PagoPoliza::updateOrCreate(
                ['broker_id' => $brokerId, 'poliza_id' => $pol['id'], 'tipo_recaudo' => 'oficina', 'referencia_pago' => "ss_nomrec_{$ssId}"],
                ['cliente_id' => $pol['cid'], 'monto_total' => $primaTotalPago, 'monto_pagado' => $primaTotalPago, 'monto_pendiente' => 0, 'estado' => 'pagado', 'fecha_pago' => $fechaRecOficina, 'observaciones' => 'SS: recaudo oficina']
            );
            $stats['nominas']['pagos_created']++;
        }
    }

    // Nóminas por cobrar (comisiones pendientes)
    foreach ($allData['nominas_por_cobrar'] ?? [] as $row) {
        $ssId = (int)($row['IDENTIFICADOR'] ?? 0);
        if (!$ssId) { $stats['nominas']['skipped']++; continue; }
        $pn = trim($row['NÚMERO PÓLIZA'] ?? '');
        $pol = $pn ? ($polizaIdx[$pn] ?? $polizaIdx[str_replace(['-',' ','.'], '', $pn)] ?? null) : null;
        if (!$pol) { $stats['nominas']['skipped']++; continue; }

        $comARecibir = parseDecimal($row['COMISIÓN A RECIBIR'] ?? 0);
        $comRecibida = parseDecimal($row['COMISIÓN RECIBIDA'] ?? 0);
        $valorPagadoAseg = parseDecimal($row['VALOR PAGADO EN ASEGURADORA'] ?? 0);
        $primaTotalPago = parseDecimal($row['PRIMA TOTAL DEL PAGO'] ?? 0);
        $fechaRecOficina = parseDate($row['FECHA RECAUDADO EN OFICINA'] ?? null);
        $fechaPagoAseg = parseDate($row['FECHA REALIZÓ PAGO EN ASEGURADORA'] ?? null);

        $mc = $comARecibir ?: 0;
        if ($mc > 0) {
            CobroComision::updateOrCreate(
                ['broker_id' => $brokerId, 'poliza_id' => $pol['id'], 'referencia_cobro' => "ss_nompc_{$ssId}"],
                ['aseguradora_id' => $pol['aid'], 'monto_comision' => $mc, 'monto_cobrado' => $comRecibida ?: 0, 'monto_pendiente' => max(0, $mc - ($comRecibida ?: 0)), 'estado' => ($comRecibida ?: 0) >= $mc ? 'cobrado' : (($comRecibida ?: 0) > 0 ? 'parcial' : 'pendiente'), 'fecha_cobro' => $fechaPagoAseg, 'observaciones' => 'SS: comisión por cobrar']
            );
            $stats['nominas']['comisiones_created']++;
        }
        if ($valorPagadoAseg > 0 && $pol['cid']) {
            PagoPoliza::updateOrCreate(
                ['broker_id' => $brokerId, 'poliza_id' => $pol['id'], 'tipo_recaudo' => 'aseguradora', 'referencia_pago' => "ss_nompc_a_{$ssId}"],
                ['cliente_id' => $pol['cid'], 'monto_total' => $valorPagadoAseg, 'monto_pagado' => $valorPagadoAseg, 'monto_pendiente' => 0, 'estado' => 'pagado', 'fecha_pago' => $fechaPagoAseg ?? now()->toDateString(), 'observaciones' => 'SS: pago aseg']
            );
            $stats['nominas']['pagos_created']++;
        }
        if ($fechaRecOficina && $primaTotalPago > 0 && $pol['cid']) {
            PagoPoliza::updateOrCreate(
                ['broker_id' => $brokerId, 'poliza_id' => $pol['id'], 'tipo_recaudo' => 'oficina', 'referencia_pago' => "ss_nompc_{$ssId}"],
                ['cliente_id' => $pol['cid'], 'monto_total' => $primaTotalPago, 'monto_pagado' => $primaTotalPago, 'monto_pendiente' => 0, 'estado' => 'pagado', 'fecha_pago' => $fechaRecOficina, 'observaciones' => 'SS: recaudo oficina']
            );
            $stats['nominas']['pagos_created']++;
        }
    }
    DB::commit();
    echo "  Comisiones: {$stats['nominas']['comisiones_created']}, Pagos: {$stats['nominas']['pagos_created']}, Skipped: {$stats['nominas']['skipped']}\n";
} catch (\Exception $e) { DB::rollBack(); echo "  ERROR: " . $e->getMessage() . "\n" . $e->getTraceAsString() . "\n"; }

// ═══════════════════════════════════════════════════════════════
// FINAL SUMMARY
// ═══════════════════════════════════════════════════════════════
echo "\n╔══════════════════════════════════════╗\n";
echo "║       IMPORT COMPLETE - Broker 54    ║\n";
echo "╠══════════════════════════════════════╣\n";
echo "║ Clientes: C={$stats['clientes']['created']} U={$stats['clientes']['updated']} S={$stats['clientes']['skipped']}\n";
echo "║ Pólizas:  C={$stats['polizas']['created']} S={$stats['polizas']['skipped']} E={$stats['polizas']['errors']}\n";
echo "║ Recaudos: C={$stats['recaudos']['created']} S={$stats['recaudos']['skipped']}\n";
echo "║ Anticipos: C={$stats['anticipos']['created']} S={$stats['anticipos']['skipped']}\n";
echo "║ Cartera:  P={$stats['cartera']['pagos_created']} Com={$stats['cartera']['comisiones_created']} S={$stats['cartera']['skipped']}\n";
echo "║ Nóminas:  Com={$stats['nominas']['comisiones_created']} P={$stats['nominas']['pagos_created']} S={$stats['nominas']['skipped']}\n";
echo "╚══════════════════════════════════════╝\n";
