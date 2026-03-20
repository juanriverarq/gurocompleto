<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;

class RepairCarteraItems extends Command
{
    protected $signature = 'cartera:repair
        {--broker-id=54 : Broker ID}
        {--dir= : Directory with Excel files}
        {--dry-run : Show what would be changed without applying}
        {--poliza= : Repair only a specific poliza number}';

    protected $description = 'Repair corrupted cartera_items by restoring financial values from SoftSeguros Excel exports. Only affects items with softseguros_pago_id.';

    private int $repaired = 0;
    private int $unchanged = 0;
    private int $notFound = 0;

    public function handle(): int
    {
        $brokerId = (int) $this->option('broker-id');
        $dir = $this->option('dir') ?: base_path('../cartera');
        $dryRun = $this->option('dry-run');
        $targetPoliza = $this->option('poliza');

        $this->info("=== Repair Cartera Items (broker {$brokerId}) ===");
        $this->info("Directory: {$dir}");
        if ($dryRun) $this->warn("DRY RUN — no changes will be applied");
        if ($targetPoliza) $this->info("Target poliza: {$targetPoliza}");

        // Build a map of softseguros_pago_id → correct financial values from ALL Excel files
        $excelData = $this->loadExcelData($dir, $targetPoliza);
        $this->info("Loaded " . count($excelData) . " records from Excel files");

        if (empty($excelData)) {
            $this->error("No Excel data found. Check the directory path.");
            return 1;
        }

        // Find all SS-imported cartera_items
        $query = DB::table('cartera_items')
            ->where('broker_id', $brokerId)
            ->whereNotNull('softseguros_pago_id');

        if ($targetPoliza) {
            $query->where('poliza_numero', $targetPoliza);
        }

        $items = $query->get();
        $this->info("Found {$items->count()} SS-imported cartera_items in DB");

        $bar = $this->output->createProgressBar($items->count());
        $bar->start();

        foreach ($items as $item) {
            $bar->advance();
            $ssId = (string) $item->softseguros_pago_id;

            if (!isset($excelData[$ssId])) {
                $this->notFound++;
                continue;
            }

            $excel = $excelData[$ssId];

            // Compare financial fields — if any differ, repair
            $fields = [
                'prima_neta', 'valor_neto_a_pagar', 'prima_total_pago', 'prima_total',
                'saldo_pendiente_oficina', 'saldo_pendiente_aseguradora',
                'valor_recaudado_oficina', 'valor_pagado_aseguradora',
                'comision_a_recibir', 'comision_recibida', 'comision_vendedor',
                'estado_cartera', 'numero_pago', 'anexo_numero',
            ];

            $updateData = [];
            foreach ($fields as $field) {
                if (!isset($excel[$field])) continue;
                $dbVal = $item->$field;
                $excelVal = $excel[$field];

                // Compare numerics with tolerance, strings exactly
                if (is_numeric($excelVal)) {
                    if (abs((float) $dbVal - (float) $excelVal) > 0.01) {
                        $updateData[$field] = $excelVal;
                    }
                } else {
                    if ((string) $dbVal !== (string) $excelVal) {
                        $updateData[$field] = $excelVal;
                    }
                }
            }

            if (empty($updateData)) {
                $this->unchanged++;
                continue;
            }

            $updateData['updated_at'] = now();

            if (!$dryRun) {
                DB::table('cartera_items')->where('id', $item->id)->update($updateData);
            }

            $this->repaired++;

            if ($targetPoliza || $this->getOutput()->isVerbose()) {
                $changedFields = array_keys(array_diff_key($updateData, ['updated_at' => 1]));
                $this->newLine();
                $this->line("  <comment>REPAIR</comment> ID:{$item->id} SS:{$ssId} Poliza:{$item->poliza_numero} Anexo:{$item->anexo_numero} Pago:{$item->numero_pago}");
                foreach ($changedFields as $f) {
                    $this->line("    {$f}: {$item->$f} → {$updateData[$f]}");
                }
            }
        }

        $bar->finish();
        $this->newLine(2);

        $this->info("=== Results ===");
        $this->table(
            ['Metric', 'Count'],
            [
                ['Repaired', $this->repaired],
                ['Unchanged', $this->unchanged],
                ['Not found in Excel', $this->notFound],
                ['Total SS items', $items->count()],
            ]
        );

        if ($dryRun && $this->repaired > 0) {
            $this->warn("Run without --dry-run to apply {$this->repaired} repairs.");
        }

        return 0;
    }

    private function loadExcelData(string $dir, ?string $targetPoliza): array
    {
        $data = [];

        $files = [
            ['keywords' => ['por_cobrar'], 'estado' => 'por_cobrar'],
            ['keywords' => ['por_pagar'], 'estado' => 'por_pagar'],
            ['keywords' => ['comisiones_por_cobrar', 'comisiones por cobrar'], 'estado' => 'comision_por_cobrar'],
            ['keywords' => ['comisiones_recibidas', 'nominas_pasadas'], 'estado' => 'comision_recibida'],
        ];

        foreach ($files as $fileDef) {
            $file = $this->findFile($dir, $fileDef['keywords']);
            if (!$file) continue;

            $this->info("  Loading: " . basename($file) . " ({$fileDef['estado']})");

            $spreadsheet = IOFactory::load($file);
            $sheet = $spreadsheet->getActiveSheet();
            $rows = $sheet->toArray(null, true, false);
            $headers = $rows[0];
            $h = array_flip($headers);

            foreach (array_slice($rows, 1) as $row) {
                $ssId = (string) ($row[$h['IDENTIFICADOR']] ?? '');
                if (!$ssId) continue;

                $polizaNum = trim($row[$h['NÚMERO PÓLIZA']] ?? '');
                if ($targetPoliza && $polizaNum !== $targetPoliza) continue;

                $data[$ssId] = [
                    'estado_cartera' => $fileDef['estado'],
                    'numero_pago' => $this->col($row, $h, 'NUMERO DE PAGO'),
                    'anexo_numero' => $this->col($row, $h, 'NÚMERO ANEXO'),
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
                ];
            }

            $spreadsheet->disconnectWorksheets();
            unset($spreadsheet);
        }

        return $data;
    }

    private function findFile(string $dir, array $keywords): ?string
    {
        $files = glob($dir . '/*.xlsx');
        foreach ($keywords as $keyword) {
            foreach ($files as $file) {
                $basename = strtolower(basename($file));
                $kw = strtolower($keyword);
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
        foreach ($keywords as $keyword) {
            foreach ($files as $file) {
                if (str_contains(strtolower(basename($file)), strtolower($keyword))) {
                    return $file;
                }
            }
        }
        $this->warn("  No file found matching: " . implode(', ', $keywords));
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
        if (is_numeric($val)) return round((float) $val, 2);
        $cleaned = str_replace([',', ' '], '', (string) $val);
        return is_numeric($cleaned) ? round((float) $cleaned, 2) : 0;
    }
}
