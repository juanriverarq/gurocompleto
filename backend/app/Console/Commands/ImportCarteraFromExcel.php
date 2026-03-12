<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;

class ImportCarteraFromExcel extends Command
{
    protected $signature = 'cartera:import-excel
        {--broker-id=54 : Broker ID}
        {--dir= : Directory with Excel files}
        {--reset : Truncate cartera_items before importing}';

    protected $description = 'Import SoftSeguros cartera Excel exports into cartera_items table (por_cobrar, por_pagar, comisiones)';

    public function handle(): int
    {
        $brokerId = (int) $this->option('broker-id');
        $dir = $this->option('dir') ?: base_path('../cartera');

        $this->info("=== Import Cartera from Excel → cartera_items (broker {$brokerId}) ===");
        $this->info("Directory: {$dir}");

        // Build poliza lookup: policy_number → {id, client_id}
        $this->info('Building póliza lookup...');
        $polizaMap = DB::table('polizas')
            ->where('broker_id', $brokerId)
            ->whereNull('deleted_at')
            ->select('id', 'policy_number', 'client_id')
            ->get()
            ->keyBy('policy_number');
        $this->info("  → {$polizaMap->count()} pólizas loaded");

        // Build cliente lookup: document_number → id
        $clienteMap = DB::table('clientes')
            ->where('broker_id', $brokerId)
            ->whereNull('deleted_at')
            ->select('id', 'document_number')
            ->get()
            ->keyBy('document_number');
        $this->info("  → {$clienteMap->count()} clientes loaded");

        // Reset if requested
        if ($this->option('reset')) {
            $deleted = DB::table('cartera_items')->where('broker_id', $brokerId)->delete();
            $this->info("  Reset: deleted {$deleted} existing cartera_items");
        }

        $totalInserted = 0;
        $totalSkipped = 0;

        // ─── 1. POR COBRAR ───────────────────────────────────────────────
        $file = $this->findFile($dir, ['por_cobrar']);
        if ($file) {
            [$ins, $skip] = $this->processExcel($file, 'por_cobrar', $brokerId, $polizaMap, $clienteMap);
            $totalInserted += $ins;
            $totalSkipped += $skip;
        }

        // ─── 2. POR PAGAR ────────────────────────────────────────────────
        $file = $this->findFile($dir, ['por_pagar']);
        if ($file) {
            [$ins, $skip] = $this->processExcel($file, 'por_pagar', $brokerId, $polizaMap, $clienteMap);
            $totalInserted += $ins;
            $totalSkipped += $skip;
        }

        // ─── 3. COMISIONES POR COBRAR ────────────────────────────────────
        $file = $this->findFile($dir, ['comisiones_por_cobrar', 'comisiones por cobrar', 'liquidar_nominas']);
        if ($file) {
            [$ins, $skip] = $this->processExcel($file, 'comision_por_cobrar', $brokerId, $polizaMap, $clienteMap);
            $totalInserted += $ins;
            $totalSkipped += $skip;
        }

        // ─── 4. COMISIONES RECIBIDAS ─────────────────────────────────────
        $file = $this->findFile($dir, ['comisiones_recibidas', 'nominas_pasadas']);
        if ($file) {
            [$ins, $skip] = $this->processExcel($file, 'comision_recibida', $brokerId, $polizaMap, $clienteMap);
            $totalInserted += $ins;
            $totalSkipped += $skip;
        }

        $this->newLine();
        $this->info("=== TOTAL: inserted={$totalInserted}, skipped(no poliza)={$totalSkipped} ===");

        // Verify
        $this->verifyState($brokerId);

        return 0;
    }

    private function processExcel(string $file, string $estadoCartera, int $brokerId, $polizaMap, $clienteMap): array
    {
        $this->newLine();
        $this->info("--- {$estadoCartera}: {$file} ---");

        $spreadsheet = IOFactory::load($file);
        $sheet = $spreadsheet->getActiveSheet();
        // CRITICAL: use formatData=false (3rd param) to get raw numeric values
        // toArray(null, calculateFormulas=true, formatData=false) avoids '325,240.00' strings
        $rows = $sheet->toArray(null, true, false);
        $headers = $rows[0];
        $h = array_flip($headers);

        $dataRows = array_slice($rows, 1);
        $inserted = 0;
        $skipped = 0;
        $batch = [];

        $bar = $this->output->createProgressBar(count($dataRows));
        $bar->start();

        foreach ($dataRows as $row) {
            $bar->advance();

            $ssId = $row[$h['IDENTIFICADOR']] ?? null;
            $polizaNum = trim($row[$h['NÚMERO PÓLIZA']] ?? '');

            // Resolve poliza_id and cliente_id
            $poliza = $polizaMap->get($polizaNum);

            // Try without trailing suffix (e.g., "100026865-1" → base poliza)
            if (!$poliza && str_contains($polizaNum, '-')) {
                $baseNum = substr($polizaNum, 0, strrpos($polizaNum, '-'));
                $poliza = $polizaMap->get($baseNum);
            }

            $polizaId = $poliza->id ?? null;
            $clienteId = $poliza->client_id ?? null;

            // Also try cliente by document
            if (!$clienteId) {
                $clienteDoc = trim($row[$h['DOCUMENTO CLIENTE'] ?? $h['CÉDULA CLIENTE'] ?? -1] ?? '');
                if ($clienteDoc) {
                    $clienteId = $clienteMap->get($clienteDoc)?->id;
                }
            }

            $now = now();
            $item = [
                'broker_id' => $brokerId,
                'poliza_id' => $polizaId,
                'cliente_id' => $clienteId,
                'softseguros_pago_id' => $ssId,
                'poliza_numero' => $polizaNum,
                'anexo_numero' => $this->col($row, $h, 'NÚMERO ANEXO'),
                'riesgo' => $this->col($row, $h, 'RIESGO'),
                'aseguradora_nombre' => $this->col($row, $h, 'ASEGURADORA'),
                'ramo_principal' => $this->col($row, $h, 'RAMO PRINCIPAL'),
                'subramo' => $this->col($row, $h, 'SUBRAMO'),
                'cliente_nombre' => $this->col($row, $h, 'NOMBRE CLIENTE'),
                'cliente_documento' => $this->col($row, $h, 'DOCUMENTO CLIENTE') ?? $this->col($row, $h, 'CÉDULA CLIENTE'),
                'vendedor_nombre' => $this->col($row, $h, 'VENDEDOR'),
                'numero_remision' => $this->col($row, $h, 'NÚMERO REMISIÓN'),
                'categorias_poliza' => $this->col($row, $h, 'CATEGORÍAS PÓLIZA'),
                'categorias_cliente' => $this->col($row, $h, 'CATEGORÍAS CLIENTE'),
                'forma_pago' => $this->col($row, $h, 'FORMA DE PAGO'),
                'numero_pago' => $this->col($row, $h, 'NUMERO DE PAGO'),
                'sede' => $this->col($row, $h, 'SEDE'),
                'prima_neta' => $this->decimal($row, $h, 'VALOR PRIMA NETA'),
                'valor_neto_a_pagar' => $this->decimal($row, $h, 'VALOR NETO A PAGAR'),
                'prima_total_pago' => $this->decimal($row, $h, 'PRIMA TOTAL DEL PAGO'),
                'prima_total' => $this->decimal($row, $h, 'VALOR PRIMA TOTAL'),
                'saldo_pendiente_oficina' => $this->decimal($row, $h, 'SALDO PENDIENTE OFICINA'),
                'saldo_pendiente_aseguradora' => $this->decimal($row, $h, 'SALDO PENDIENTE ASEGURADORA'),
                'valor_recaudado_oficina' => $this->decimal($row, $h, 'VALOR RECAUDADO EN OFICINA'),
                'valor_pagado_aseguradora' => $this->decimal($row, $h, 'VALOR PAGADO EN ASEGURADORA'),
                'comision_a_recibir' => $this->decimal($row, $h, 'COMISIÓN A RECIBIR'),
                'comision_recibida' => $this->decimal($row, $h, 'COMISIÓN RECIBIDA'),
                'comision_vendedor' => $this->decimal($row, $h, 'COMISIÓN VENDEDOR'),
                'comision_pagada_vendedor' => $this->decimal($row, $h, 'COMISIÓN PAGADA VENDEDOR'),
                'porcentaje_comision' => $this->decimal($row, $h, 'PORCENTAJE DE COMISIÓN'),
                'porcentaje_comision_anexo' => $this->decimal($row, $h, 'PORCENTAJE DE COMISIÓN ANEXO'),
                'dias_vencidos' => (int) ($this->col($row, $h, 'DÍAS VENCIDOS') ?? 0),
                'fecha_limite_pago' => $this->parseDate($this->col($row, $h, 'FECHA LÍMITE DE PAGO')),
                'fecha_compromiso_pago' => $this->parseDate($this->col($row, $h, 'FECHA COMPROMISO DE PAGO')),
                'fecha_recaudado_oficina' => $this->parseDate($this->col($row, $h, 'FECHA RECAUDADO EN OFICINA') ?? $this->col($row, $h, 'FECHA RECAUDO EN OFICINA')),
                'fecha_pago_aseguradora' => $this->parseDate($this->col($row, $h, 'FECHA REALIZÓ PAGO EN ASEGURADORA')),
                'fecha_comisionada' => $this->parseDate($this->col($row, $h, 'FECHA COMISIONADA')),
                'fecha_pagada_vendedor' => $this->parseDate($this->col($row, $h, 'FECHA PAGADA VENDEDOR')),
                'fecha_inicio_vigencia' => $this->parseDate($this->col($row, $h, 'FECHA INICIO VIGENCIA PÓLIZA')),
                'fecha_fin_vigencia' => $this->parseDate($this->col($row, $h, 'FECHA FIN VIGENCIA PÓLIZA')),
                'estado_cartera' => $estadoCartera,
                'medio_pago' => $this->col($row, $h, 'MEDIO DE PAGO'),
                'codigo_contable' => $this->col($row, $h, 'CÓDIGO CONTABLE') ?? $this->col($row, $h, 'CODIGO CONTABLE'),
                'codigo_radicacion' => $this->col($row, $h, 'CÓDIGO RADICACIÓN'),
                'moneda' => $this->col($row, $h, 'TIPO MONEDA'),
                'usuario_comisiono' => $this->col($row, $h, 'USUARIO COMISIONO'),
                'observacion_bitacora' => $this->col($row, $h, 'ÚLTIMA OBSERVACIÓN BITACORA'),
                'observaciones_pago' => $this->col($row, $h, 'OBSERVACIONES PAGO'),
                'recaudado_aseg_pendiente_cliente' => strtolower($this->col($row, $h, 'RECAUDADO ASEGURADORA PENDIENTE POR COBRAR AL CLIENTE') ?? '') === 'si',
                'created_at' => $now,
                'updated_at' => $now,
            ];

            $batch[] = $item;
            $inserted++;

            if (count($batch) >= 500) {
                DB::table('cartera_items')->insert($batch);
                $batch = [];
            }
        }

        if (!empty($batch)) {
            DB::table('cartera_items')->insert($batch);
        }

        $bar->finish();
        $this->newLine();
        $this->info("  {$estadoCartera}: inserted={$inserted}, skipped={$skipped}");

        $spreadsheet->disconnectWorksheets();
        unset($spreadsheet);

        return [$inserted, $skipped];
    }

    /**
     * Find an Excel file in the directory matching any of the given keywords
     */
    private function findFile(string $dir, array $keywords): ?string
    {
        $files = glob($dir . '/*.xlsx');
        foreach ($keywords as $keyword) {
            foreach ($files as $file) {
                $basename = strtolower(basename($file));
                $kw = strtolower($keyword);
                // Exact prefix match or word-boundary match to avoid 'por_cobrar' matching 'comisiones_por_cobrar'
                if ($basename === $kw . '.xlsx'
                    || str_starts_with($basename, $kw . ' ')
                    || str_starts_with($basename, $kw . '.')
                    || str_starts_with($basename, $kw . '_')
                    || str_starts_with($basename, $kw . ' (')
                ) {
                    return $file;
                }
            }
        }
        // Fallback: loose contains match
        foreach ($keywords as $keyword) {
            foreach ($files as $file) {
                $basename = strtolower(basename($file));
                if (str_contains($basename, strtolower($keyword))) {
                    return $file;
                }
            }
        }
        $this->warn("No file found matching: " . implode(', ', $keywords) . " in {$dir}");
        return null;
    }

    private function col(array $row, array $h, string $colName): ?string
    {
        if (!isset($h[$colName])) return null;
        $val = $row[$h[$colName]] ?? null;
        return ($val !== null && $val !== '') ? trim((string) $val) : null;
    }

    private function decimal(array $row, array $h, string $colName): float
    {
        if (!isset($h[$colName])) return 0;
        $val = $row[$h[$colName]] ?? null;
        if ($val === null || $val === '') return 0;
        // Handle both raw numeric and formatted string values
        if (is_numeric($val)) return (float) $val;
        // Strip thousands separators (comma or period depending on locale)
        $cleaned = str_replace([',', ' '], '', (string) $val);
        return is_numeric($cleaned) ? (float) $cleaned : 0;
    }

    private function parseDate(?string $val): ?string
    {
        if (!$val) return null;
        try {
            return \Carbon\Carbon::parse($val)->format('Y-m-d');
        } catch (\Throwable $e) {
            return null;
        }
    }

    private function verifyState(int $brokerId): void
    {
        $this->newLine();
        $this->info('=== Verification ===');

        $counts = DB::table('cartera_items')
            ->where('broker_id', $brokerId)
            ->selectRaw("
                estado_cartera,
                COUNT(*) as cnt,
                SUM(CASE WHEN poliza_id IS NOT NULL THEN 1 ELSE 0 END) as con_poliza,
                COUNT(DISTINCT poliza_numero) as polizas_unicas
            ")
            ->groupBy('estado_cartera')
            ->get();

        // Reference counts from latest HAR/SoftSeguros API (updated dynamically)
        $referencia = [
            'por_cobrar' => '?',
            'por_pagar' => '?',
            'comision_por_cobrar' => '?',
            'comision_recibida' => '?',
        ];

        $tableData = [];
        foreach ($counts as $c) {
            $ref = $referencia[$c->estado_cartera] ?? '?';
            $match = ($c->cnt == $ref) ? '✓' : '✗';
            $tableData[] = [$c->estado_cartera, $c->cnt, $ref, $match, $c->con_poliza, $c->polizas_unicas];
        }

        $this->table(
            ['Estado', 'Items', 'Excel Ref', 'Match', 'Con poliza_id', 'Pólizas únicas'],
            $tableData
        );
    }
}
