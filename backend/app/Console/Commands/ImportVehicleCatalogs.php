<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\IOFactory;
use App\Models\VehBrand;
use App\Models\VehModel;
use App\Models\VehLine;
use App\Models\VehPrice;

class ImportVehicleCatalogs extends Command
{
    protected $signature = 'catalogs:import-vehicles {file} {--broker_id=} {--reset}';
    protected $description = 'Importa catálogos vehiculares (marcas, modelos, líneas) desde un archivo Excel';

    public function handle(): int
    {
        $file = $this->argument('file');
        // broker_id se ignora en catálogos globales
        if (!file_exists($file)) {
            $this->error("Archivo no encontrado: {$file}");
            return Command::FAILURE;
        }

        $this->info('Leyendo Excel...');
        @ini_set('memory_limit', '2048M');
        $reader = IOFactory::createReaderForFile($file);
        if (method_exists($reader, 'setReadDataOnly')) {
            $reader->setReadDataOnly(true);
        }
        // Detectar hoja 2 (índice 1) según solicitud del usuario
        $sheetIndex = 1; // 0-based: 1 => Hoja 2
        $infos = $reader->listWorksheetInfo($file);
        $names = $reader->listWorksheetNames($file);
        $sheetName = $names[$sheetIndex] ?? ($names[0] ?? null);
        if (!$sheetName) {
            $this->error('No se pudo determinar el nombre de la hoja a importar.');
            return Command::FAILURE;
        }
        if (method_exists($reader, 'setLoadSheetsOnly')) {
            $reader->setLoadSheetsOnly($sheetName);
        }

        // Detectar columnas por encabezados (MARCA, MODELO, LÍNEA) en la Hoja 2
        $chunkSize = 1000;
        // Usar filtro para leer solo la fila 1 (encabezados) y columnas A..ZZ para minimizar memoria
        $detectReader = IOFactory::createReaderForFile($file);
        if (method_exists($detectReader, 'setReadDataOnly')) { $detectReader->setReadDataOnly(true); }
        if (method_exists($detectReader, 'setLoadSheetsOnly')) { $detectReader->setLoadSheetsOnly($sheetName); }
        $headerFilter = new class implements \PhpOffice\PhpSpreadsheet\Reader\IReadFilter {
            public function readCell($column, $row, $worksheetName = ''): bool {
                // Solo primera fila, columnas A..ZZ
                if ($row !== 1) return false;
                // Permitir todas las columnas habituales
                return true;
            }
        };
        if (method_exists($detectReader, 'setReadFilter')) { $detectReader->setReadFilter($headerFilter); }
        $detectSpreadsheet = $detectReader->load($file);
        $detectSheet = $detectSpreadsheet->getActiveSheet();
        $headerRow = $detectSheet->toArray(null, true, true, true);
        $headerMap = $headerRow[1] ?? [];
        $normalize = function (?string $s): string {
            $s = (string)($s ?? '');
            $s = trim($s);
            if ($s === '') return '';
            $ascii = @iconv('UTF-8','ASCII//TRANSLIT',$s);
            if ($ascii !== false) { $s = $ascii; }
            $s = strtolower($s);
            $s = preg_replace('/[^a-z0-9 ]+/','',$s);
            return $s;
        };
        $brandCol = null; $modelCol = null; $lineCol = null; $umCol = null; $claseCol = null; $ref1Col = null; $ref2Col = null; $ref3Col = null;
        // Mantener orden de columnas
        $headerOrder = array_keys($headerMap);
        foreach ($headerMap as $col => $title) {
            $n = $normalize((string)$title);
            if ($brandCol === null && (str_contains($n,'marca') || str_contains($n,'brand'))) $brandCol = $col;
            if ($modelCol === null && (str_contains($n,'modelo') || str_contains($n,'model'))) $modelCol = $col;
            if ($lineCol === null && (str_contains($n,'linea') || str_contains($n,'line'))) $lineCol = $col;
            if ($umCol === null && ($n === 'um' || str_contains($n,'u m'))) $umCol = $col;
            if ($claseCol === null && (str_contains($n,'clase'))) $claseCol = $col;
            if ($ref1Col === null && (str_contains($n,'referencia1') || $n === 'referencia 1' || $n === 'ref1' || $n === 'ref 1')) $ref1Col = $col;
            if ($ref2Col === null && (str_contains($n,'referencia2') || $n === 'referencia 2' || $n === 'ref2' || $n === 'ref 2')) $ref2Col = $col;
            if ($ref3Col === null && (str_contains($n,'referencia3') || $n === 'referencia 3' || $n === 'ref3' || $n === 'ref 3')) $ref3Col = $col;
        }
        // Fallback seguro
        if (!$brandCol) $brandCol = 'A';
        if (!$lineCol) $lineCol = 'C';
        // Determinar columnas de años (modelos) después de 'Um'
        $yearCols = [];
        if ($umCol) {
            $after = false;
            foreach ($headerOrder as $col) {
                if ($col === $umCol) { $after = true; continue; }
                if (!$after) continue;
                $raw = (string)($headerMap[$col] ?? '');
                $raw = trim($raw);
                if (preg_match('/^\d{4}$/', $raw)) {
                    $yearCols[] = $col;
                }
            }
        }
        // Si no se detectaron, intentar todo el header: títulos puramente numéricos de 4 dígitos
        if (empty($yearCols)) {
            foreach ($headerMap as $col => $title) {
                $raw = trim((string)$title);
                if (preg_match('/^\d{4}$/', $raw)) $yearCols[] = $col;
            }
        }
        // Columns to read: marca + linea + posibles años
        $allowedColumns = array_values(array_unique(array_filter(array_merge([$brandCol, $lineCol, $claseCol, $ref1Col, $ref2Col, $ref3Col], $yearCols))));
        // Liberar memoria del detector
        $detectSpreadsheet->disconnectWorksheets();
        unset($detectSpreadsheet);

        // Si se solicita, resetear tablas antes de importar
        if ($this->option('reset')) {
            $this->info('Reiniciando tablas de catálogos (veh_lines, veh_models, veh_brands)...');
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
            DB::table('veh_prices')->truncate();
            DB::table('veh_lines')->truncate();
            DB::table('veh_models')->truncate();
            DB::table('veh_brands')->truncate();
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }

        // Obtener total de filas de la hoja seleccionada
        $totalRows = 0;
        foreach ($infos as $i => $inf) {
            if (($names[$i] ?? '') === $sheetName) {
                $totalRows = $inf['totalRows'] ?? 0;
                break;
            }
        }
        $count = 0;

        // Definir filtro de lectura por chunk
        $filter = new class($allowedColumns) implements \PhpOffice\PhpSpreadsheet\Reader\IReadFilter {
            private array $columns; private int $start = 1; private int $end = 0;
            public function __construct(array $columns){ $this->columns = $columns; }
            public function setRows(int $start, int $end): void { $this->start = $start; $this->end = $end; }
            public function readCell($column, $row, $worksheetName = ''): bool { return $row >= $this->start && $row <= $this->end && in_array($column, $this->columns, true); }
        };
        if (method_exists($reader, 'setReadFilter')) {
            $reader->setReadFilter($filter);
        }

        for ($start = 1; $start <= $totalRows; $start += $chunkSize) {
            $end = min($totalRows, $start + $chunkSize - 1);
            $filter->setRows($start, $end);
            if (method_exists($reader, 'setLoadSheetsOnly')) {
                $reader->setLoadSheetsOnly($sheetName);
            }
            $spreadsheet = $reader->load($file);
            $sheet = $spreadsheet->getActiveSheet();
            $rows = $sheet->toArray(null, true, true, true);
            foreach ($rows as $idx => $row) {
                if ($idx === 1 && $start === 1) { continue; } // saltar cabecera solo en primer chunk
                $brandName = trim((string)($row[$brandCol] ?? ''));
                $lineName  = trim((string)($row[$lineCol] ?? ''));
                $claseVal  = $claseCol ? trim((string)($row[$claseCol] ?? '')) : null;
                $ref1Val   = $ref1Col ? trim((string)($row[$ref1Col] ?? '')) : null;
                $ref2Val   = $ref2Col ? trim((string)($row[$ref2Col] ?? '')) : null;
                $ref3Val   = $ref3Col ? trim((string)($row[$ref3Col] ?? '')) : null;
                if ($brandName === '' && $lineName === '') { continue; }
                if ($brandName === '') { continue; }
                $brand = VehBrand::firstOrCreate(['name' => $brandName]);
                // Por cada columna de año marcada (>0 o no vacía), crear modelo=AAAA y línea
                foreach ($yearCols as $yCol) {
                    $headerYear = trim((string)($headerMap[$yCol] ?? ''));
                    if (!preg_match('/^\d{4}$/', $headerYear)) continue;
                    $val = $row[$yCol] ?? null;
                    // considerar marcadores: números > 0, 'x', 'X', 'si', etc.
                    $marked = false;
                    if (is_numeric($val)) { $marked = (float)$val > 0; }
                    else if (is_string($val)) { $marked = trim($val) !== '' && trim(strtolower($val)) !== '0'; }
                    if (!$marked) continue;
                    $model = VehModel::firstOrCreate(['brand_id' => $brand->id, 'name' => $headerYear]);
                    if ($lineName !== '') {
                        VehLine::firstOrCreate(['model_id' => $model->id, 'name' => $lineName]);
                    }
                    // Guardar precio si el valor es numérico (por mil)
                    if (is_numeric($val)) {
                        $amount = (int)round(((float)$val) * 1000);
                        $lineId = null;
                        if ($lineName !== '') {
                            $line = VehLine::where('model_id', $model->id)->where('name', $lineName)->first();
                            $lineId = $line?->id;
                        }
                        VehPrice::updateOrCreate(
                            ['brand_id' => $brand->id, 'model_id' => $model->id, 'line_id' => $lineId],
                            [
                                'amount' => max($amount, 0),
                                'clase' => $claseVal ?: null,
                                'referencia1' => $ref1Val ?: null,
                                'referencia2' => $ref2Val ?: null,
                                'referencia3' => $ref3Val ?: null,
                            ]
                        );
                    }
                }
                $count++;
            }
            // liberar memoria del spreadsheet
            $spreadsheet->disconnectWorksheets();
            unset($spreadsheet);
        }

        $this->info("Importación completada. Filas procesadas: {$count}");
        return Command::SUCCESS;
    }
}


