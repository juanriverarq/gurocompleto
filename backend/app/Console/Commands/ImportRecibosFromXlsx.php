<?php

namespace App\Console\Commands;

use App\Models\ReciboCaja;
use Illuminate\Console\Command;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Reader\DefaultReadFilter;

class ImportRecibosFromXlsx extends Command
{
    protected $signature = 'recibos:import-xlsx
        {file : Path to the XLSX file}
        {type : Type of recibos: activos, directos, anulados}
        {--broker-id=2 : Broker ID}
        {--dry-run : Show what would be imported without actually importing}
        {--chunk=500 : Rows per chunk}';

    protected $description = 'Import recibos from Softseguros XLSX export files without duplicating existing records';

    /**
     * Column mapping: XLSX letter => header name
     * All three files share these columns (A-X):
     *   A: IDENTIFICADOR, B: NÚMERO PÓLIZA, C: NÚMERO ANEXO, D: RIESGO,
     *   E: ASEGURADORA, F: RAMO PRINCIPAL, G: SUBRAMO, H: NOMBRE CLIENTE,
     *   I: CÉDULA CLIENTE, J: TELEFONO CLIENTE, K: CORREO CLIENTE,
     *   L: CELULAR CLIENTE, M: VENDEDOR, N: # CUOTA, O: VALOR A PAGAR,
     *   P: NÚMERO RECIBO, Q: RECIBO ANULADO, R: FORMA DE PAGO,
     *   S: MEDIO DE PAGO ( PÓLIZA ), T: FORMA DE PAGO ( PÓLIZA ),
     *   U: CÓDIGO CONTABLE, V: FECHA CREACIÓN RECUADO, W: SEDE, X: USUARIO RECAUDA
     *
     * Activos extras:
     *   Y: VALOR RECAUDADO EN OFICINA, Z: COMISIÓN AGENCIA,
     *   AA: FECHA RECAUDADO EN OFICINA, AB: NO REMISIÓN, AC: FECHA REMISIÓN,
     *   AD: INICIO DE VIGENCIA
     *
     * Directos extras:
     *   Y: VALOR RECAUDADO EN ASEGURADORA, Z: COMISIÓN AGENCIA,
     *   AA: FECHA RECAUDADO EN ASEGURADORA, AB: NO REMISIÓN, AC: FECHA REMISIÓN
     *
     * Anulados extras:
     *   Y: TIPO DE RECAUDO
     */

    public function handle(): int
    {
        $file = $this->argument('file');
        $type = $this->argument('type');
        $brokerId = (int) $this->option('broker-id');
        $dryRun = $this->option('dry-run');
        $chunkSize = (int) $this->option('chunk');

        if (!in_array($type, ['activos', 'directos', 'anulados'])) {
            $this->error("Type must be one of: activos, directos, anulados");
            return 1;
        }

        if (!file_exists($file)) {
            $this->error("File not found: $file");
            return 1;
        }

        $this->info("=== Importing recibos ($type) from: $file ===");
        $this->info("Broker ID: $brokerId | Dry run: " . ($dryRun ? 'YES' : 'NO'));

        // Count total rows first
        $totalRows = $this->countRows($file);
        $this->info("Total rows in XLSX: $totalRows");

        // Load existing softseguros_recaudo_ids for dedup
        $this->info("Loading existing recaudo IDs for deduplication...");
        $existingIds = ReciboCaja::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->whereNotNull('softseguros_recaudo_id')
            ->pluck('softseguros_recaudo_id')
            ->flip()
            ->toArray();
        $this->info("Found " . count($existingIds) . " existing records");

        // Process in chunks
        $imported = 0;
        $skipped = 0;
        $errors = 0;
        $startRow = 2; // Skip header

        $bar = $this->output->createProgressBar($totalRows);
        $bar->start();

        while ($startRow <= $totalRows + 1) {
            $endRow = min($startRow + $chunkSize - 1, $totalRows + 1);

            $rows = $this->readChunk($file, $startRow, $endRow);

            foreach ($rows as $rowNum => $row) {
                $bar->advance();

                $identificador = $this->getVal($row, 'A');
                if (!$identificador) {
                    $skipped++;
                    continue;
                }

                $identificador = (int) $identificador;

                // Dedup check
                if (isset($existingIds[$identificador])) {
                    $skipped++;
                    continue;
                }

                try {
                    $record = $this->mapRow($row, $type, $brokerId, $identificador);

                    if (!$dryRun) {
                        ReciboCaja::create($record);
                        // Add to existing set to prevent within-file duplicates
                        $existingIds[$identificador] = true;
                    }

                    $imported++;
                } catch (\Throwable $e) {
                    $errors++;
                    if ($errors <= 10) {
                        $this->newLine();
                        $this->warn("Error row $rowNum (ID: $identificador): " . $e->getMessage());
                    }
                }
            }

            $startRow = $endRow + 1;
        }

        $bar->finish();
        $this->newLine(2);

        $this->info("=== Import Complete ===");
        $this->info("Imported: $imported | Skipped (existing): $skipped | Errors: $errors");

        if ($dryRun) {
            $this->warn("DRY RUN — no records were actually created.");
        }

        return 0;
    }

    private function mapRow(array $row, string $type, int $brokerId, int $identificador): array
    {
        $cuota = $this->getVal($row, 'N'); // e.g. "2/4" or "/0"
        $numeroPago = null;
        $pagoPolizaConsecutivo = null;
        if ($cuota && str_contains($cuota, '/')) {
            $parts = explode('/', $cuota);
            $numeroPago = trim($parts[0]) ?: null;
            $pagoPolizaConsecutivo = trim($parts[1] ?? '') ?: null;
        }

        $valorAPagar = $this->parseDecimal($this->getVal($row, 'O'));
        $formaPago = $this->getVal($row, 'R');
        $medioPagoPoliza = $this->getVal($row, 'S');
        $formaPagoPoliza = $this->getVal($row, 'T');
        $fechaCreacion = $this->parseDate($this->getVal($row, 'V'));
        $reciboAnulado = strtoupper(trim($this->getVal($row, 'Q') ?? '')) === 'TRUE';

        $record = [
            'broker_id'                => $brokerId,
            'softseguros_recaudo_id'   => $identificador,
            'source'                   => 'softseguros_xlsx',
            // Identification
            'poliza_numero'            => $this->getVal($row, 'B'),
            'poliza_objeto_asegurado'  => $this->getVal($row, 'D'), // RIESGO
            'aseguradora_nombre'       => $this->getVal($row, 'E'),
            'ramo_nombre'              => $this->buildRamoName($this->getVal($row, 'F'), $this->getVal($row, 'G')),
            'cliente_nombre'           => trim($this->getVal($row, 'H') ?? ''),
            'cliente_documento'        => $this->getVal($row, 'I'),
            'vendedor_nombre'          => $this->getVal($row, 'M'),
            'numero_recibo'            => $this->getVal($row, 'P'),
            'numero_pago'              => $numeroPago,
            'pago_poliza_consecutivo'  => $pagoPolizaConsecutivo,
            'forma_pago'               => $formaPago ? mb_substr($formaPago, 0, 191) : null,
            'medio_de_pago'            => ($medioPagoPoliza && $medioPagoPoliza !== 'null') ? $medioPagoPoliza : null,
            'forma_pago_aseguradora'   => ($formaPagoPoliza && $formaPagoPoliza !== 'null') ? $formaPagoPoliza : null,
            'sede_nombre'              => $this->getVal($row, 'W'),
            'usuario_recauda'          => $this->getVal($row, 'X'),
            'valor_a_pagar'            => $valorAPagar,
            'moneda'                   => 'COP',
            'tipo'                     => 'recibo',
            'recibo_anulado'           => $reciboAnulado,
            'activo'                   => !$reciboAnulado,
            'created_at'               => $fechaCreacion,
            // Número de anexo
            'metadata'                 => array_filter([
                'numero_anexo' => $this->getVal($row, 'C'),
                'codigo_contable' => $this->getVal($row, 'U'),
            ]),
        ];

        // Type-specific fields
        if ($type === 'activos') {
            $valorRecaudado = $this->parseDecimal($this->getVal($row, 'Y'));
            $comision = $this->parseDecimal($this->getVal($row, 'Z'));
            $fechaRecaudado = $this->parseDate($this->getVal($row, 'AA'));
            $noRemision = $this->getVal($row, 'AB');
            $fechaRemision = $this->parseDate($this->getVal($row, 'AC'));
            $inicioVigencia = $this->parseDate($this->getVal($row, 'AD'));

            $record['tipo_recaudo'] = 'oficina';
            $record['recaudado_en_oficina'] = true;
            $record['recibo_pago_directo'] = false;
            $record['recaudo_directo'] = false;
            $record['valor_recaudado_en_oficina'] = $valorRecaudado;
            $record['valor_pagado'] = $valorRecaudado;
            $record['comision_a_recibir'] = $comision;
            $record['comision_final_agencia'] = $comision;
            $record['fecha_realizo_pago_oficina'] = $fechaRecaudado;
            $record['fecha_recaudo'] = $fechaRecaudado;
            $record['fecha_inicio_poliza'] = $inicioVigencia;
            $record['recaudado'] = ($valorRecaudado > 0);

            if ($noRemision) {
                $record['metadata']['no_remision'] = $noRemision;
            }
            if ($fechaRemision) {
                $record['metadata']['fecha_remision'] = $fechaRemision;
            }

        } elseif ($type === 'directos') {
            $valorRecaudado = $this->parseDecimal($this->getVal($row, 'Y'));
            $comision = $this->parseDecimal($this->getVal($row, 'Z'));
            $fechaRecaudado = $this->parseDate($this->getVal($row, 'AA'));
            $noRemision = $this->getVal($row, 'AB');
            $fechaRemision = $this->parseDate($this->getVal($row, 'AC'));

            $record['tipo_recaudo'] = 'aseguradora';
            $record['recaudado_en_oficina'] = false;
            $record['recibo_pago_directo'] = true;
            $record['recaudo_directo'] = true;
            $record['valor_recaudado_en_oficina'] = $valorRecaudado;
            $record['valor_pagado'] = $valorRecaudado;
            $record['comision_a_recibir'] = $comision;
            $record['comision_final_agencia'] = $comision;
            $record['fecha_realizo_pago'] = $fechaRecaudado;
            $record['fecha_recaudo'] = $fechaRecaudado;
            $record['recaudado'] = ($valorRecaudado > 0);

            if ($noRemision) {
                $record['metadata']['no_remision'] = $noRemision;
            }
            if ($fechaRemision) {
                $record['metadata']['fecha_remision'] = $fechaRemision;
            }

        } elseif ($type === 'anulados') {
            $tipoRecaudo = $this->getVal($row, 'Y'); // "Aseguradora" or "Oficina"
            $esDirecto = $tipoRecaudo && stripos($tipoRecaudo, 'Aseguradora') !== false;

            $record['tipo_recaudo'] = $esDirecto ? 'aseguradora' : 'oficina';
            $record['recaudado_en_oficina'] = !$esDirecto;
            $record['recibo_pago_directo'] = $esDirecto;
            $record['recaudo_directo'] = $esDirecto;
            $record['recibo_anulado'] = true;
            $record['activo'] = false;
            $record['valor_recaudado_en_oficina'] = $valorAPagar; // Use valor a pagar as best estimate
            $record['valor_pagado'] = $valorAPagar;
        }

        return $record;
    }

    private function getVal(array $row, string $col): ?string
    {
        $val = $row[$col] ?? null;
        if ($val === null || $val === '') return null;
        return trim((string) $val);
    }

    private function parseDecimal(?string $val): float
    {
        if ($val === null || $val === '') return 0;
        // Remove thousand separators if any, handle comma decimal separator
        $val = str_replace([' ', '$'], '', $val);
        return (float) $val;
    }

    private function parseDate(?string $val): ?string
    {
        if ($val === null || $val === '') return null;

        // If it looks like a serial number (Excel date serial)
        if (is_numeric($val) && (int) $val > 10000) {
            try {
                $unix = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToTimestamp((int) $val);
                return date('Y-m-d', $unix);
            } catch (\Throwable $e) {
                return null;
            }
        }

        // If it's already a date string
        if (preg_match('/^\d{4}-\d{2}-\d{2}/', $val)) {
            return substr($val, 0, 10);
        }

        return null;
    }

    private function buildRamoName(?string $ramoPrincipal, ?string $subramo): ?string
    {
        $parts = array_filter([$subramo, $ramoPrincipal]);
        return !empty($parts) ? implode(' - ', $parts) : null;
    }

    private function countRows(string $file): int
    {
        $reader = IOFactory::createReaderForFile($file);
        $reader->setReadDataOnly(true);
        // Read only first column to count rows efficiently
        $filter = new class extends DefaultReadFilter {
            public function readCell(string $columnAddress, int $row, string $worksheetName = ''): bool {
                return $columnAddress === 'A';
            }
        };
        $reader->setReadFilter($filter);
        $spreadsheet = $reader->load($file);
        $count = $spreadsheet->getActiveSheet()->getHighestRow() - 1; // minus header
        $spreadsheet->disconnectWorksheets();
        unset($spreadsheet);
        return $count;
    }

    private function readChunk(string $file, int $startRow, int $endRow): array
    {
        $reader = IOFactory::createReaderForFile($file);
        $reader->setReadDataOnly(true);

        $s = $startRow;
        $e = $endRow;
        $filter = new class($s, $e) extends DefaultReadFilter {
            private int $start;
            private int $end;
            public function __construct(int $start, int $end) {
                $this->start = $start;
                $this->end = $end;
            }
            public function readCell(string $columnAddress, int $row, string $worksheetName = ''): bool {
                return $row === 1 || ($row >= $this->start && $row <= $this->end);
            }
        };
        $reader->setReadFilter($filter);
        $spreadsheet = $reader->load($file);
        $sheet = $spreadsheet->getActiveSheet();

        // Get header row to know last column
        $highestCol = $sheet->getHighestColumn();
        $rows = [];

        for ($r = $startRow; $r <= $endRow; $r++) {
            $rowData = $sheet->rangeToArray("A{$r}:{$highestCol}{$r}", null, true, true, true);
            if (isset($rowData[$r])) {
                $rows[$r] = $rowData[$r];
            }
        }

        $spreadsheet->disconnectWorksheets();
        unset($spreadsheet);

        return $rows;
    }
}
