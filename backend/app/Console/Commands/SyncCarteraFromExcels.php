<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;

class SyncCarteraFromExcels extends Command
{
    protected $signature = 'cartera:sync-excels
        {--dir= : Directory containing the SS Excel files}
        {--execute : Actually run the updates (default is dry-run)}';

    protected $description = 'Update cartera_items with missing data from SoftSeguros Excel exports (por_cobrar, por_pagar, comisiones_por_cobrar, comisiones_recibidas)';

    // Mapping: Excel column header → DB column
    private $baseMapping = [
        'IDENTIFICADOR' => 'softseguros_pago_id', // match key
        'NÚMERO PÓLIZA' => 'poliza_numero',
        'NÚMERO ANEXO' => 'anexo_numero',
        'RIESGO' => 'riesgo',
        'ASEGURADORA' => 'aseguradora_nombre',
        'RAMO PRINCIPAL' => 'ramo_principal',
        'SUBRAMO' => 'subramo',
        'NOMBRE CLIENTE' => 'cliente_nombre',
        'DOCUMENTO CLIENTE' => 'cliente_documento',
        'VENDEDOR' => 'vendedor_nombre',
        'NÚMERO REMISIÓN' => 'numero_remision',
        'CATEGORÍAS PÓLIZA' => 'categorias_poliza',
        'CATEGORÍAS CLIENTE' => 'categorias_cliente',
        'FORMA DE PAGO' => 'forma_pago',
        'VALOR PRIMA NETA' => 'prima_neta',
        'VALOR NETO A PAGAR' => 'valor_neto_a_pagar',
        'PRIMA TOTAL DEL PAGO' => 'prima_total_pago',
        'VALOR PRIMA TOTAL' => 'prima_total',
        'NUMERO DE PAGO' => 'numero_pago',
        'DÍAS VENCIDOS' => 'dias_vencidos',
        'SALDO PENDIENTE OFICINA' => 'saldo_pendiente_oficina',
        'SALDO PENDIENTE ASEGURADORA' => 'saldo_pendiente_aseguradora',
        'COMISIÓN A RECIBIR' => 'comision_a_recibir',
        'COMISIÓN VENDEDOR' => 'comision_vendedor',
        'COMISIÓN RECIBIDA' => 'comision_recibida',
        'COMISIÓN PAGADA VENDEDOR' => 'comision_pagada_vendedor',
        'VALOR RECAUDADO EN OFICINA' => 'valor_recaudado_oficina',
        'VALOR PAGADO EN ASEGURADORA' => 'valor_pagado_aseguradora',
        'PORCENTAJE DE COMISIÓN' => 'porcentaje_comision',
        'PORCENTAJE DE COMISIÓN ANEXO' => 'porcentaje_comision_anexo',
        'CÓDIGO RADICACIÓN' => 'codigo_radicacion',
        'FECHA LÍMITE DE PAGO' => 'fecha_limite_pago',
        'FECHA COMPROMISO DE PAGO' => 'fecha_compromiso_pago',
        'FECHA RECAUDO EN OFICINA' => 'fecha_recaudado_oficina',
        'FECHA RECAUDADO EN OFICINA' => 'fecha_recaudado_oficina',
        'FECHA REALIZÓ PAGO EN ASEGURADORA' => 'fecha_pago_aseguradora',
        'FECHA COMISIONADA' => 'fecha_comisionada',
        'FECHA PAGADA VENDEDOR' => 'fecha_pagada_vendedor',
        'USUARIO COMISIONO' => 'usuario_comisiono',
        'MEDIO DE PAGO' => 'medio_pago',
        'CÓDIGO CONTABLE' => 'codigo_contable',
        'TIPO MONEDA' => 'moneda',
        'SEDE' => 'sede',
        'FECHA INICIO VIGENCIA PÓLIZA' => 'fecha_inicio_vigencia',
        'FECHA FIN VIGENCIA PÓLIZA' => 'fecha_fin_vigencia',
        'RECAUDADO ASEGURADORA PENDIENTE POR COBRAR AL CLIENTE' => 'recaudado_aseg_pendiente_cliente',
        'ÚLTIMA OBSERVACIÓN BITACORA' => 'observacion_bitacora',
        'OBSERVACIONES PAGO' => 'observaciones_pago',
    ];

    // Numeric columns that should be cast to float
    private $numericColumns = [
        'prima_neta', 'valor_neto_a_pagar', 'prima_total_pago', 'prima_total',
        'saldo_pendiente_oficina', 'saldo_pendiente_aseguradora',
        'comision_a_recibir', 'comision_vendedor', 'comision_recibida',
        'comision_pagada_vendedor', 'valor_recaudado_oficina', 'valor_pagado_aseguradora',
        'porcentaje_comision', 'porcentaje_comision_anexo', 'dias_vencidos',
    ];

    // Date columns
    private $dateColumns = [
        'fecha_limite_pago', 'fecha_compromiso_pago', 'fecha_recaudado_oficina',
        'fecha_pago_aseguradora', 'fecha_comisionada', 'fecha_pagada_vendedor',
        'fecha_inicio_vigencia', 'fecha_fin_vigencia',
    ];

    public function handle()
    {
        $dir = $this->option('dir') ?: base_path('../cartera');
        $execute = $this->option('execute');

        if (!is_dir($dir)) {
            $this->error("Directory not found: $dir");
            return 1;
        }

        $this->info($execute ? '🚀 EXECUTE MODE — will update DB' : '🔍 DRY-RUN MODE — no changes');
        $this->info("Reading excels from: $dir");

        // Map files to expected estado_cartera
        $files = [
            ['file' => 'por_cobrar', 'estado' => 'por_cobrar', 'pattern' => 'por_cobrar*.xlsx'],
            ['file' => 'por_pagar', 'estado' => 'por_pagar', 'pattern' => 'por_pagar*.xlsx'],
            ['file' => 'comisiones_por_cobrar', 'estado' => 'comision_por_cobrar', 'pattern' => 'comisiones_por_cobrar*.xlsx'],
            ['file' => 'comisiones_recibidas', 'estado' => 'comision_recibida', 'pattern' => 'comisiones_recibidas*.xlsx'],
        ];

        $totalUpdated = 0;
        $totalNotFound = 0;
        $totalSkipped = 0;

        foreach ($files as $fileConfig) {
            $matches = glob("$dir/{$fileConfig['pattern']}");
            if (empty($matches)) {
                $this->warn("  ⚠️ No file matching {$fileConfig['pattern']} in $dir");
                continue;
            }
            $filePath = $matches[0];
            $this->info("\n📄 Processing: " . basename($filePath) . " (estado: {$fileConfig['estado']})");

            $result = $this->processExcel($filePath, $fileConfig['estado'], $execute);
            $totalUpdated += $result['updated'];
            $totalNotFound += $result['not_found'];
            $totalSkipped += $result['skipped'];
        }

        $this->info("\n" . str_repeat('=', 60));
        $this->info("✅ Total updated: $totalUpdated");
        $this->info("⚠️ Not found in DB: $totalNotFound");
        $this->info("⏭️ Skipped (no changes): $totalSkipped");

        if (!$execute) {
            $this->warn("\n⚠️ This was a DRY RUN. Add --execute to apply changes.");
        }

        return 0;
    }

    private function processExcel(string $filePath, string $expectedEstado, bool $execute): array
    {
        $spreadsheet = IOFactory::load($filePath);
        $sheet = $spreadsheet->getActiveSheet();
        $rows = $sheet->toArray(null, true, true, true);

        if (count($rows) < 2) {
            $this->warn("  Empty file");
            return ['updated' => 0, 'not_found' => 0, 'skipped' => 0];
        }

        // Build header → column index mapping
        $headers = $rows[1]; // Row 1 = headers (1-indexed in toArray with associative)
        $headerMap = [];
        foreach ($headers as $col => $header) {
            $header = trim((string)$header);
            if (isset($this->baseMapping[$header])) {
                $headerMap[$col] = $this->baseMapping[$header];
            }
        }

        $updated = 0;
        $notFound = 0;
        $skipped = 0;
        $batch = [];
        $batchSize = 500;

        $totalRows = count($rows) - 1;
        $this->info("  Rows to process: $totalRows");

        for ($i = 2; $i <= count($rows); $i++) {
            $row = $rows[$i] ?? null;
            if (!$row) continue;

            // Extract mapped values
            $data = [];
            foreach ($headerMap as $col => $dbCol) {
                $data[$dbCol] = $row[$col] ?? null;
            }

            $ssId = $data['softseguros_pago_id'] ?? null;
            if (!$ssId) continue;

            // Build update array (only non-empty values for fields that are currently empty)
            $updateData = $this->buildUpdateData($data, $expectedEstado);
            if (empty($updateData)) {
                $skipped++;
                continue;
            }

            $batch[] = ['ss_id' => (int)$ssId, 'data' => $updateData];

            if (count($batch) >= $batchSize) {
                $result = $this->flushBatch($batch, $execute);
                $updated += $result['updated'];
                $notFound += $result['not_found'];
                $batch = [];

                if ($updated % 2000 === 0) {
                    $this->info("  Progress: $updated updated, $notFound not found...");
                }
            }
        }

        // Flush remaining
        if (!empty($batch)) {
            $result = $this->flushBatch($batch, $execute);
            $updated += $result['updated'];
            $notFound += $result['not_found'];
        }

        $this->info("  ✅ Updated: $updated | Not found: $notFound | Skipped: $skipped");
        return ['updated' => $updated, 'not_found' => $notFound, 'skipped' => $skipped];
    }

    private function buildUpdateData(array $data, string $expectedEstado): array
    {
        $update = [];

        // Always update these fields from Excel (overwrite)
        $fieldsToUpdate = [
            'prima_neta', 'valor_neto_a_pagar', 'prima_total_pago', 'prima_total',
            'saldo_pendiente_oficina', 'saldo_pendiente_aseguradora',
            'comision_a_recibir', 'comision_vendedor', 'comision_recibida',
            'comision_pagada_vendedor', 'valor_recaudado_oficina', 'valor_pagado_aseguradora',
            'porcentaje_comision', 'porcentaje_comision_anexo',
            'fecha_limite_pago', 'fecha_compromiso_pago',
            'fecha_recaudado_oficina', 'fecha_pago_aseguradora',
            'fecha_comisionada', 'fecha_pagada_vendedor',
            'fecha_inicio_vigencia', 'fecha_fin_vigencia',
            'medio_pago', 'codigo_contable', 'codigo_radicacion', 'moneda',
            'usuario_comisiono', 'sede',
            'numero_remision', 'categorias_poliza', 'categorias_cliente',
            'anexo_numero',
            'observacion_bitacora', 'observaciones_pago',
        ];

        foreach ($fieldsToUpdate as $field) {
            if (!isset($data[$field]) || $data[$field] === null || $data[$field] === '') {
                continue;
            }

            $value = $data[$field];

            if (in_array($field, $this->numericColumns)) {
                $value = (float)$value;
            } elseif (in_array($field, $this->dateColumns)) {
                if ($value instanceof \DateTimeInterface) {
                    $value = $value->format('Y-m-d H:i:s');
                } elseif (is_string($value) && !empty($value)) {
                    try {
                        $value = (new \DateTime($value))->format('Y-m-d H:i:s');
                    } catch (\Exception $e) {
                        continue;
                    }
                } else {
                    continue;
                }
            } elseif ($field === 'recaudado_aseg_pendiente_cliente') {
                // 'No' → 0, 'Si'/'Sí' → 1
                $value = in_array(strtolower(trim((string)$value)), ['si', 'sí', '1', 'true']) ? 1 : 0;
            } else {
                $value = trim((string)$value);
                if ($value === '') continue;
            }

            $update[$field] = $value;
        }

        // Set recaudado_aseg_pendiente_cliente
        if (isset($data['recaudado_aseg_pendiente_cliente'])) {
            $val = strtolower(trim((string)$data['recaudado_aseg_pendiente_cliente']));
            $update['recaudado_aseg_pendiente_cliente'] = in_array($val, ['si', 'sí', '1', 'true']) ? 1 : 0;
        }

        // Ensure flags match estado
        $update['estado_cartera'] = $expectedEstado;
        switch ($expectedEstado) {
            case 'por_cobrar':
                $update['recaudado_en_oficina'] = false;
                $update['recaudado_aseguradora'] = false;
                $update['comisionada'] = false;
                break;
            case 'por_pagar':
                $update['recaudado_en_oficina'] = true;
                $update['recaudado_aseguradora'] = false;
                $update['comisionada'] = false;
                break;
            case 'comision_por_cobrar':
                $update['recaudado_en_oficina'] = true;
                $update['recaudado_aseguradora'] = true;
                $update['comisionada'] = false;
                break;
            case 'comision_recibida':
                $update['recaudado_en_oficina'] = true;
                $update['recaudado_aseguradora'] = true;
                $update['comisionada'] = true;
                break;
        }

        return $update;
    }

    private function flushBatch(array $batch, bool $execute): array
    {
        $updated = 0;
        $notFound = 0;

        foreach ($batch as $item) {
            if ($execute) {
                $affected = DB::table('cartera_items')
                    ->where('softseguros_pago_id', $item['ss_id'])
                    ->update($item['data']);
                if ($affected > 0) {
                    $updated++;
                } else {
                    $notFound++;
                }
            } else {
                // Dry run: just check existence
                $exists = DB::table('cartera_items')
                    ->where('softseguros_pago_id', $item['ss_id'])
                    ->exists();
                if ($exists) {
                    $updated++;
                } else {
                    $notFound++;
                }
            }
        }

        return ['updated' => $updated, 'not_found' => $notFound];
    }
}
