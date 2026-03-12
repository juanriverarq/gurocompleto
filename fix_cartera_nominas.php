<?php
/**
 * Fix: re-run cartera + nóminas for broker 54, handling invalid aseguradora_id
 */
require_once '/home/guro/public_html/app.guro.co/vendor/autoload.php';
$app = require_once '/home/guro/public_html/app.guro.co/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Poliza;
use App\Models\Aseguradora;
use App\Models\PagoPoliza;
use App\Models\CobroComision;
use App\Models\Cliente;
use Illuminate\Support\Facades\DB;

$brokerId = 54;
$jsonFile = '/home/guro/import_data.json';
$allData = json_decode(file_get_contents($jsonFile), true);

// Valid aseguradora IDs for this broker
$validAsegIds = Aseguradora::withoutGlobalScopes()->where('broker_id', $brokerId)->pluck('id')->toArray();
$validAsegSet = array_flip($validAsegIds);

// Build poliza index
$polizaIdx = [];
foreach (DB::table('polizas')->where('broker_id', $brokerId)->whereNull('deleted_at')
    ->select('id', 'policy_number', 'client_id', 'aseguradora_id')->get() as $r) {
    $aid = $r->aseguradora_id && isset($validAsegSet[(int)$r->aseguradora_id]) ? (int)$r->aseguradora_id : null;
    $entry = ['id' => (int)$r->id, 'cid' => $r->client_id ? (int)$r->client_id : null, 'aid' => $aid];
    $polizaIdx[$r->policy_number] = $entry;
    $clean = str_replace(['-', ' ', '.'], '', $r->policy_number);
    if ($clean !== $r->policy_number) $polizaIdx[$clean] = $entry;
}

function parseDate($v) {
    if (!$v) return null;
    if (preg_match('/^\d{4}-\d{2}-\d{2}/', $v)) return substr($v, 0, 10);
    return null;
}
function parseDecimal($v) {
    if ($v === null || $v === '') return 0;
    return floatval(str_replace([' ', '$', ','], '', $v));
}

$stats = ['cartera' => ['pagos' => 0, 'comisiones' => 0, 'skipped' => 0],
          'nominas' => ['comisiones' => 0, 'pagos' => 0, 'skipped' => 0]];

// ═══ CARTERA POR COBRAR ═══
echo "=== CARTERA POR COBRAR ===\n";
DB::beginTransaction();
try {
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
            $stats['cartera']['pagos']++;
        }
        if ($saldoAseg > 0 && $pol['cid']) {
            PagoPoliza::updateOrCreate(
                ['broker_id' => $brokerId, 'poliza_id' => $pol['id'], 'tipo_recaudo' => 'aseguradora', 'referencia_pago' => "ss_cxc_a_{$ssId}"],
                ['cliente_id' => $pol['cid'], 'monto_total' => $saldoAseg, 'monto_pagado' => 0, 'monto_pendiente' => $saldoAseg, 'estado' => 'pendiente', 'fecha_pago' => $fechaLimite, 'observaciones' => 'SS: cartera por cobrar aseg']
            );
            $stats['cartera']['pagos']++;
        }
        if ($comision > 0 && $pol['aid']) {
            CobroComision::updateOrCreate(
                ['broker_id' => $brokerId, 'poliza_id' => $pol['id'], 'referencia_cobro' => "ss_cxc_{$ssId}"],
                ['aseguradora_id' => $pol['aid'], 'monto_comision' => $comision, 'monto_cobrado' => 0, 'monto_pendiente' => $comision, 'estado' => 'pendiente', 'observaciones' => 'SS: comisión por cobrar']
            );
            $stats['cartera']['comisiones']++;
        }
    }

    // CARTERA POR PAGAR
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
            $stats['cartera']['pagos']++;
        }
        if ($saldoAseg > 0 && $pol['cid']) {
            PagoPoliza::updateOrCreate(
                ['broker_id' => $brokerId, 'poliza_id' => $pol['id'], 'tipo_recaudo' => 'aseguradora', 'referencia_pago' => "ss_cxp_a_{$ssId}"],
                ['cliente_id' => $pol['cid'], 'monto_total' => $saldoAseg, 'monto_pagado' => 0, 'monto_pendiente' => $saldoAseg, 'estado' => 'pendiente', 'fecha_pago' => $fechaRecaudo, 'observaciones' => 'SS: pend aseg']
            );
            $stats['cartera']['pagos']++;
        }
        if ($comision > 0 && $pol['aid']) {
            CobroComision::updateOrCreate(
                ['broker_id' => $brokerId, 'poliza_id' => $pol['id'], 'referencia_cobro' => "ss_cxp_{$ssId}"],
                ['aseguradora_id' => $pol['aid'], 'monto_comision' => $comision, 'monto_cobrado' => 0, 'monto_pendiente' => $comision, 'estado' => 'pendiente', 'observaciones' => 'SS: comisión pend']
            );
            $stats['cartera']['comisiones']++;
        }
    }
    DB::commit();
    echo "  Pagos: {$stats['cartera']['pagos']}, Comisiones: {$stats['cartera']['comisiones']}, Skipped: {$stats['cartera']['skipped']}\n";
} catch (\Exception $e) { DB::rollBack(); echo "  ERROR: " . $e->getMessage() . "\n"; }

// ═══ NOMINAS RECIBIDAS ═══
echo "\n=== NOMINAS RECIBIDAS ===\n";
DB::beginTransaction();
try {
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
        if ($mc > 0 && $pol['aid']) {
            CobroComision::updateOrCreate(
                ['broker_id' => $brokerId, 'poliza_id' => $pol['id'], 'referencia_cobro' => "ss_nomrec_{$ssId}"],
                ['aseguradora_id' => $pol['aid'], 'monto_comision' => $mc, 'monto_cobrado' => $comRecibida, 'monto_pendiente' => max(0, $mc - $comRecibida), 'estado' => $comRecibida >= $mc ? 'cobrado' : ($comRecibida > 0 ? 'parcial' : 'pendiente'), 'fecha_cobro' => $fechaComisionada, 'observaciones' => 'SS: comisión recibida']
            );
            $stats['nominas']['comisiones']++;
        }
        if ($valorPagadoAseg > 0 && $pol['cid']) {
            PagoPoliza::updateOrCreate(
                ['broker_id' => $brokerId, 'poliza_id' => $pol['id'], 'tipo_recaudo' => 'aseguradora', 'referencia_pago' => "ss_nomrec_a_{$ssId}"],
                ['cliente_id' => $pol['cid'], 'monto_total' => $valorPagadoAseg, 'monto_pagado' => $valorPagadoAseg, 'monto_pendiente' => 0, 'estado' => 'pagado', 'fecha_pago' => $fechaPagoAseg ?? $fechaRecOficina ?? now()->toDateString(), 'observaciones' => 'SS: pago aseg']
            );
            $stats['nominas']['pagos']++;
        }
        if ($fechaRecOficina && $primaTotalPago > 0 && $pol['cid']) {
            PagoPoliza::updateOrCreate(
                ['broker_id' => $brokerId, 'poliza_id' => $pol['id'], 'tipo_recaudo' => 'oficina', 'referencia_pago' => "ss_nomrec_{$ssId}"],
                ['cliente_id' => $pol['cid'], 'monto_total' => $primaTotalPago, 'monto_pagado' => $primaTotalPago, 'monto_pendiente' => 0, 'estado' => 'pagado', 'fecha_pago' => $fechaRecOficina, 'observaciones' => 'SS: recaudo oficina']
            );
            $stats['nominas']['pagos']++;
        }
    }
    DB::commit();
    echo "  Comisiones: {$stats['nominas']['comisiones']}, Pagos: {$stats['nominas']['pagos']}\n";
} catch (\Exception $e) { DB::rollBack(); echo "  ERROR: " . $e->getMessage() . "\n"; }

// ═══ NOMINAS POR COBRAR ═══
echo "\n=== NOMINAS POR COBRAR ===\n";
$nompcStats = ['comisiones' => 0, 'pagos' => 0, 'skipped' => 0];
DB::beginTransaction();
try {
    foreach ($allData['nominas_por_cobrar'] ?? [] as $row) {
        $ssId = (int)($row['IDENTIFICADOR'] ?? 0);
        if (!$ssId) { $nompcStats['skipped']++; continue; }
        $pn = trim($row['NÚMERO PÓLIZA'] ?? '');
        $pol = $pn ? ($polizaIdx[$pn] ?? $polizaIdx[str_replace(['-',' ','.'], '', $pn)] ?? null) : null;
        if (!$pol) { $nompcStats['skipped']++; continue; }

        $comARecibir = parseDecimal($row['COMISIÓN A RECIBIR'] ?? 0);
        $comRecibida = parseDecimal($row['COMISIÓN RECIBIDA'] ?? 0);
        $valorPagadoAseg = parseDecimal($row['VALOR PAGADO EN ASEGURADORA'] ?? 0);
        $primaTotalPago = parseDecimal($row['PRIMA TOTAL DEL PAGO'] ?? 0);
        $fechaRecOficina = parseDate($row['FECHA RECAUDADO EN OFICINA'] ?? null);
        $fechaPagoAseg = parseDate($row['FECHA REALIZÓ PAGO EN ASEGURADORA'] ?? null);

        $mc = $comARecibir ?: 0;
        if ($mc > 0 && $pol['aid']) {
            CobroComision::updateOrCreate(
                ['broker_id' => $brokerId, 'poliza_id' => $pol['id'], 'referencia_cobro' => "ss_nompc_{$ssId}"],
                ['aseguradora_id' => $pol['aid'], 'monto_comision' => $mc, 'monto_cobrado' => $comRecibida ?: 0, 'monto_pendiente' => max(0, $mc - ($comRecibida ?: 0)), 'estado' => ($comRecibida ?: 0) >= $mc ? 'cobrado' : (($comRecibida ?: 0) > 0 ? 'parcial' : 'pendiente'), 'fecha_cobro' => $fechaPagoAseg, 'observaciones' => 'SS: comisión por cobrar']
            );
            $nompcStats['comisiones']++;
        }
        if ($valorPagadoAseg > 0 && $pol['cid']) {
            PagoPoliza::updateOrCreate(
                ['broker_id' => $brokerId, 'poliza_id' => $pol['id'], 'tipo_recaudo' => 'aseguradora', 'referencia_pago' => "ss_nompc_a_{$ssId}"],
                ['cliente_id' => $pol['cid'], 'monto_total' => $valorPagadoAseg, 'monto_pagado' => $valorPagadoAseg, 'monto_pendiente' => 0, 'estado' => 'pagado', 'fecha_pago' => $fechaPagoAseg ?? now()->toDateString(), 'observaciones' => 'SS: pago aseg']
            );
            $nompcStats['pagos']++;
        }
        if ($fechaRecOficina && $primaTotalPago > 0 && $pol['cid']) {
            PagoPoliza::updateOrCreate(
                ['broker_id' => $brokerId, 'poliza_id' => $pol['id'], 'tipo_recaudo' => 'oficina', 'referencia_pago' => "ss_nompc_{$ssId}"],
                ['cliente_id' => $pol['cid'], 'monto_total' => $primaTotalPago, 'monto_pagado' => $primaTotalPago, 'monto_pendiente' => 0, 'estado' => 'pagado', 'fecha_pago' => $fechaRecOficina, 'observaciones' => 'SS: recaudo oficina']
            );
            $nompcStats['pagos']++;
        }
    }
    DB::commit();
    echo "  Comisiones: {$nompcStats['comisiones']}, Pagos: {$nompcStats['pagos']}, Skipped: {$nompcStats['skipped']}\n";
} catch (\Exception $e) { DB::rollBack(); echo "  ERROR: " . $e->getMessage() . "\n"; }

echo "\n=== FIX COMPLETE ===\n";
echo "Cartera: Pagos={$stats['cartera']['pagos']} Com={$stats['cartera']['comisiones']} Skip={$stats['cartera']['skipped']}\n";
echo "Nóminas Rec: Com={$stats['nominas']['comisiones']} Pagos={$stats['nominas']['pagos']}\n";
echo "Nóminas PC: Com={$nompcStats['comisiones']} Pagos={$nompcStats['pagos']} Skip={$nompcStats['skipped']}\n";
