<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use App\Traits\RequiresAuth;
use Symfony\Component\HttpFoundation\StreamedResponse;
use App\Models\ImportJob;

class ImportsController extends Controller
{
    use RequiresAuth;

    /**
     * Lista de entidades soportadas y sus campos esperados
     */
    private function getEntitiesMeta(): array
    {
        return [
            'clientes' => [
                'display_name' => 'Clientes',
                'unique_keys' => ['email_principal', 'celular_principal', 'documento'],
                'required_fields' => ['nombre', 'email_principal'],
                'date_fields' => ['fecha_nacimiento'],
                'number_fields' => [],
                'boolean_fields' => [],
                'fields' => [
                    'nombre', 'apellidos', 'tipo_documento', 'documento', 'email_principal', 'celular_principal',
                    'telefono_secundario', 'direccion', 'ciudad', 'departamento', 'pais', 'fecha_nacimiento', 'estado'
                ],
            ],
            'polizas' => [
                'display_name' => 'Pólizas',
                'unique_keys' => ['policy_number'],
                'required_fields' => ['policy_number', 'status', 'cliente_id'],
                'date_fields' => ['fecha_emision', 'fecha_inicio', 'fecha_fin'],
                'number_fields' => ['prima_neta'],
                'boolean_fields' => ['es_renovable'],
                'fields' => [
                    'policy_number', 'status', 'aseguradora', 'ramo_principal', 'subramo', 'producto', 'cliente_id',
                    'prima_neta', 'fecha_emision', 'fecha_inicio', 'fecha_fin', 'es_renovable', 'medio_pago', 'banco'
                ],
            ],
            'ramos' => [
                'display_name' => 'Ramos',
                'unique_keys' => ['nombre'],
                'required_fields' => ['nombre'],
                'date_fields' => [],
                'number_fields' => [],
                'boolean_fields' => [],
                'fields' => ['nombre', 'descripcion']
            ],
            'aseguradoras' => [
                'display_name' => 'Aseguradoras',
                'unique_keys' => ['nombre', 'nit'],
                'required_fields' => ['nombre'],
                'date_fields' => [],
                'number_fields' => ['retencion', 'iva', 'retencion_iva'],
                'boolean_fields' => [],
                'fields' => [
                    'nombre', 'nit', 'email', 'telefono', 'direccion',
                    'cuenta_bancaria', 'link_pago', 'codigo_intermediario',
                    'retencion', 'iva', 'retencion_iva'
                ]
            ],
            'vendedores' => [
                'display_name' => 'Vendedores',
                'unique_keys' => ['email'],
                'required_fields' => ['nombres', 'email'],
                'date_fields' => [],
                'number_fields' => [],
                'boolean_fields' => [],
                'fields' => ['nombres', 'apellidos', 'email', 'telefono']
            ],
            'coberturas' => [
                'display_name' => 'Coberturas',
                'unique_keys' => ['nombre'],
                'required_fields' => ['nombre'],
                'date_fields' => [],
                'number_fields' => [],
                'boolean_fields' => [],
                'fields' => ['nombre', 'descripcion']
            ],
            'sedes' => [
                'display_name' => 'Sedes',
                'unique_keys' => ['nombre'],
                'required_fields' => ['nombre'],
                'date_fields' => [],
                'number_fields' => [],
                'boolean_fields' => [],
                'fields' => ['nombre', 'direccion', 'ciudad', 'telefono']
            ],
            'estados_siniestros' => [
                'display_name' => 'Estados de Siniestros',
                'unique_keys' => ['nombre'],
                'required_fields' => ['nombre'],
                'date_fields' => [],
                'number_fields' => [],
                'boolean_fields' => [],
                'fields' => ['nombre', 'descripcion']
            ],
            'motivos_estados_poliza' => [
                'display_name' => 'Motivos Estados Póliza',
                'unique_keys' => ['nombre'],
                'required_fields' => ['nombre'],
                'date_fields' => [],
                'number_fields' => [],
                'boolean_fields' => [],
                'fields' => ['nombre', 'descripcion']
            ],
        ];
    }

    public function meta(Request $request)
    {
        return response()->json([
            'success' => true,
            'entities' => $this->getEntitiesMeta(),
        ]);
    }

    /**
     * Procesar importación CSV (dry-run o ejecutar)
     */
    public function process(Request $request)
    {
        return $this->executeWithAuth($request, function ($user, $brokerId) use ($request) {
            $validator = Validator::make($request->all(), [
                'entity' => 'required|string',
                'file' => 'required|file|mimes:csv,txt,xlsx,xls',
                'mapping' => 'nullable',
                'dry_run' => 'nullable|boolean',
                'upsert_key' => 'nullable|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Datos inválidos',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $entity = $request->input('entity');
            $mappingInput = $request->input('mapping', []);
            // Permitir envío de mapping como JSON string en multipart
            if (is_string($mappingInput)) {
                $decoded = json_decode($mappingInput, true);
                $mapping = is_array($decoded) ? $decoded : [];
            } else {
                $mapping = is_array($mappingInput) ? $mappingInput : [];
            }
            $dryRun = $request->boolean('dry_run', true);
            $upsertKey = $request->input('upsert_key');

            // Si no es dry-run y no hay mapping válido, error
            if (!$dryRun && empty($mapping)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Mapping requerido para importar',
                ], 422);
            }

            $meta = $this->getEntitiesMeta();
            if (!isset($meta[$entity])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Entidad no soportada',
                ], 422);
            }

            $file = $request->file('file');
            $tabular = $this->readTabularFile($file->getRealPath(), $file->getClientOriginalExtension());
            if (!$tabular['success']) {
                return response()->json([
                    'success' => false,
                    'message' => $tabular['message'] ?? 'No se pudo leer el archivo',
                ], 400);
            }
            $headers = $tabular['headers'] ?? [];
            $rows = $tabular['rows'] ?? [];
            if (empty($headers)) {
                return response()->json([
                    'success' => true,
                    'mode' => 'dry_run',
                    'headers' => [],
                    'preview' => [],
                    'total_rows' => 0,
                    'errors' => [['error' => 'El archivo no tiene encabezados']],
                ]);
            }

            // Si no hay mapping, devolver solo headers (para configurar mapeo en frontend)
            if (empty($mapping)) {
                return response()->json([
                    'success' => true,
                    'mode' => 'dry_run',
                    'headers' => $headers,
                    'preview' => [],
                    'total_rows' => 0,
                    'errors' => [],
                ]);
            }

            // Previsualización y validación básica
            $preview = [];
            $errors = [];
            $rowIndex = 1;
            $count = 0;
            foreach ($rows as $row) {
                $rowIndex++;
                $assoc = [];
                foreach ($mapping as $targetField => $sourceHeader) {
                    $colIdx = array_search($sourceHeader, $headers);
                    $assoc[$targetField] = $colIdx !== false ? ($row[$colIdx] ?? null) : null;
                }
                // Validación: campos obligatorios
                $requiredFields = $meta[$entity]['required_fields'] ?? [];
                foreach (array_filter(array_merge($requiredFields, [$upsertKey])) as $required) {
                    if ($required && (!array_key_exists($required, $assoc) || $assoc[$required] === null || $assoc[$required] === '')) {
                        $errors[] = [
                            'row' => $rowIndex,
                            'field' => $required,
                            'error' => 'Campo requerido vacío',
                        ];
                    }
                }
                if (count($preview) < 20 && !empty($assoc)) {
                    $preview[] = $assoc;
                }
                $count++;
            }
            // no-op

            if ($dryRun) {
                return response()->json([
                    'success' => true,
                    'mode' => 'dry_run',
                    'headers' => $headers,
                    'preview' => $preview,
                    'total_rows' => $count,
                    'errors' => $errors,
                ]);
            }

            // Ejecutar importación simple (sin colas, CSV pequeño)
            $inserted = 0; $updated = 0; $failed = 0;
            $job = ImportJob::create([
                'broker_id' => $brokerId,
                'user_id' => $user->id ?? null,
                'entity' => $entity,
                'filename' => $file->getClientOriginalName(),
                'status' => 'running',
                'mapping' => $mapping,
                'started_at' => now(),
            ]);
            $file = $request->file('file');
            $tabular = $this->readTabularFile($file->getRealPath(), $file->getClientOriginalExtension());
            $headers = $tabular['headers'] ?? [];
            $rows = $tabular['rows'] ?? [];

            DB::beginTransaction();
            try {
                foreach ($rows as $row) {
                    $payload = [];
                    // Traducir claves dependiendo de la entidad
                    $fieldMap = [];
                    if ($entity === 'polizas') {
                        $fieldMap = [
                            'aseguradora' => 'insurance_company',
                            'producto' => 'product_name',
                            'fecha_emision' => 'issue_date',
                            'fecha_inicio' => 'start_date',
                            'fecha_fin' => 'end_date',
                            'prima_neta' => 'premium_amount',
                            'medio_pago' => 'payment_method',
                            'banco' => 'bank_name',
                            'cliente_id' => 'client_id',
                            'es_renovable' => 'auto_renewal',
                            'numero_poliza' => 'policy_number',
                            'estado' => 'status',
                        ];
                    } elseif ($entity === 'aseguradoras') {
                        // Alinear plantilla externa: 'nit' -> columna interna 'cuit'
                        $fieldMap = [
                            'nit' => 'cuit',
                        ];
                    } elseif ($entity === 'clientes') {
                        // Alinear plantilla (ES) -> Modelo Cliente (EN)
                        $fieldMap = [
                            'nombre' => 'first_name',
                            'apellidos' => 'last_name',
                            'tipo_documento' => 'document_type',
                            'documento' => 'document_number',
                            'email_principal' => 'email',
                            'celular_principal' => 'mobile_phone',
                            'telefono_secundario' => 'phone',
                            'direccion' => 'address',
                            'ciudad' => 'city',
                            'departamento' => 'state',
                            'pais' => 'country',
                            'fecha_nacimiento' => 'birth_date',
                            'estado' => 'status',
                        ];
                    }
                    $normalizedMapping = [];
                    foreach ($mapping as $targetField => $sourceHeader) {
                        $normalizedTarget = $fieldMap[$targetField] ?? $targetField;
                        $normalizedMapping[$normalizedTarget] = $sourceHeader;
                    }
                    foreach ($normalizedMapping as $targetField => $sourceHeader) {
                        $colIdx = array_search($sourceHeader, $headers);
                        $payload[$targetField] = $colIdx !== false ? ($row[$colIdx] ?? null) : null;
                    }
                    // Anexar broker_id para multi-tenant si existe en modelo
                    $payload['broker_id'] = $brokerId;

                    // Normalizaciones por tipo (mapear nombres meta -> nombres normalizados)
                    $dateFields = array_map(function ($k) use ($fieldMap) { return $fieldMap[$k] ?? $k; }, $meta[$entity]['date_fields'] ?? []);
                    foreach ($dateFields as $df) {
                        if (!empty($payload[$df])) {
                            $ts = strtotime($payload[$df]);
                            $payload[$df] = $ts ? date('Y-m-d', $ts) : null;
                        }
                    }
                    $numberFields = array_map(function ($k) use ($fieldMap) { return $fieldMap[$k] ?? $k; }, $meta[$entity]['number_fields'] ?? []);
                    foreach ($numberFields as $nf) {
                        if (isset($payload[$nf])) {
                            $val = str_replace(['.', ','], ['', '.'], (string)$payload[$nf]);
                            $payload[$nf] = is_numeric($val) ? (float)$val : null;
                        }
                    }
                    $booleanFields = array_map(function ($k) use ($fieldMap) { return $fieldMap[$k] ?? $k; }, $meta[$entity]['boolean_fields'] ?? []);
                    foreach ($booleanFields as $bf) {
                        if (isset($payload[$bf])) {
                            $v = strtolower(trim((string)$payload[$bf]));
                            $payload[$bf] = in_array($v, ['1', 'true', 'sí', 'si', 'y', 'yes']) ? 1 : 0;
                        }
                    }

                    // Normalizaciones específicas por entidad
                    if ($entity === 'clientes') {
                        // Mapear estado textual a los valores internos
                        if (isset($payload['status']) && is_string($payload['status'])) {
                            $v = strtolower(trim($payload['status']));
                            $map = [
                                'activo' => 'active',
                                'activa' => 'active',
                                'inactivo' => 'inactive',
                                'inactiva' => 'inactive',
                                'prospecto' => 'prospect',
                                'prospect' => 'prospect',
                                'bloqueado' => 'blocked',
                                'bloqueada' => 'blocked',
                            ];
                            $payload['status'] = $map[$v] ?? $payload['status'];
                        }
                    }

                    // Defaults específicos por entidad
                    if ($entity === 'aseguradoras') {
                        // Si la plantilla no incluye estos campos, mantener valores seguros por defecto
                        $payload['retencion'] = isset($payload['retencion']) && $payload['retencion'] !== '' ? $payload['retencion'] : 0;
                        $payload['iva'] = isset($payload['iva']) && $payload['iva'] !== '' ? $payload['iva'] : 0;
                        $payload['retencion_iva'] = isset($payload['retencion_iva']) && $payload['retencion_iva'] !== '' ? $payload['retencion_iva'] : 0;
                    }

                    try {
                        switch ($entity) {
                            case 'clientes':
                                $model = \App\Models\Cliente::query();
                                break;
                            case 'polizas':
                                $model = \App\Models\Poliza::query();
                                break;
                            case 'ramos':
                                $model = \App\Models\Ramo::query();
                                unset($payload['broker_id']); // si no aplica
                                break;
                            case 'aseguradoras':
                                $model = \App\Models\Aseguradora::query();
                                break;
                            case 'vendedores':
                                $model = \App\Models\Vendedor::query();
                                break;
                            case 'coberturas':
                                $model = \App\Models\Cobertura::query();
                                break;
                            case 'sedes':
                                $model = \App\Models\Sede::query();
                                break;
                            case 'estados_siniestros':
                                $model = \App\Models\EstadoSiniestro::query();
                                break;
                            case 'motivos_estados_poliza':
                                $model = \App\Models\MotivoEstadoPoliza::query();
                                break;
                            default:
                                throw new \Exception('Entidad no soportada');
                        }

                        // Normalizar clave de upsert según mapeo
                        $normalizedUpsertKey = $fieldMap[$upsertKey] ?? $upsertKey;
                        if ($normalizedUpsertKey && isset($payload[$normalizedUpsertKey])) {
                            $where = [$normalizedUpsertKey => $payload[$normalizedUpsertKey]];
                            if (in_array('broker_id', array_keys($model->getModel()->getAttributes()))) {
                                $where['broker_id'] = $brokerId;
                            }
                            $existing = $model->where($where)->first();
                            if ($existing) {
                                $existing->fill($payload);
                                $existing->save();
                                $updated++;
                            } else {
                                $model->create($payload);
                                $inserted++;
                            }
                        } else {
                            $model->create($payload);
                            $inserted++;
                        }
                    } catch (\Throwable $e) {
                        $failed++;
                        $errors[] = [
                            'error' => $e->getMessage(),
                            'row' => $payload,
                        ];
                    }
                }
                DB::commit();
            } catch (\Throwable $th) {
                DB::rollBack();
                Log::error('Error importando', ['error' => $th->getMessage()]);
                return response()->json([
                    'success' => false,
                    'message' => 'Error procesando importación',
                    'error' => $th->getMessage(),
                ], 500);
            } finally {
                // no-op
            }

            $job->update([
                'status' => 'completed',
                'inserted' => $inserted,
                'updated' => $updated,
                'failed' => $failed,
                'errors_count' => count($errors),
                'errors' => array_slice($errors, 0, 50),
                'finished_at' => now(),
            ]);

            return response()->json([
                'success' => true,
                'mode' => 'execute',
                'summary' => [
                    'inserted' => $inserted,
                    'updated' => $updated,
                    'failed' => $failed,
                ],
                'errors' => $errors,
            ]);
        });
    }

    /**
     * Leer archivo tabular (CSV o XLSX) y retornar headers+rows
     */
    private function readTabularFile(string $path, ?string $ext = null): array
    {
        $ext = strtolower($ext ?? pathinfo($path, PATHINFO_EXTENSION));
        if ($ext === 'xlsx' || $ext === 'xls') {
            if (!class_exists('PhpOffice\\PhpSpreadsheet\\IOFactory')) {
                return ['success' => false, 'message' => 'XLSX no soportado: falta PhpSpreadsheet'];
            }
            try {
                $io = \PhpOffice\PhpSpreadsheet\IOFactory::load($path);
                $sheet = $io->getActiveSheet();
                $highestRow = $sheet->getHighestRow();
                $highestCol = $sheet->getHighestColumn();
                $highestColIndex = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::columnIndexFromString($highestCol);
                $rows = [];
                for ($r = 1; $r <= $highestRow; $r++) {
                    $row = [];
                    for ($c = 1; $c <= $highestColIndex; $c++) {
                        $row[] = (string)($sheet->getCellByColumnAndRow($c, $r)->getValue());
                    }
                    $rows[] = $row;
                }
                if (empty($rows)) return ['success' => true, 'headers' => [], 'rows' => []];
                $headers = array_map('strval', $rows[0]);
                $dataRows = array_slice($rows, 1);
                return ['success' => true, 'headers' => $headers, 'rows' => $dataRows];
            } catch (\Throwable $e) {
                return ['success' => false, 'message' => $e->getMessage()];
            }
        }
        // CSV por defecto
        $h = @fopen($path, 'r');
        if (!$h) return ['success' => false, 'message' => 'No se pudo abrir archivo'];
        $firstLine = fgets($h);
        if ($firstLine === false) { fclose($h); return ['success' => true, 'headers' => [], 'rows' => []]; }
        // Detectar delimitador por ocurrencias
        $candidates = ["," , ";", "\t"]; // coma, punto y coma, tab
        $delim = ",";
        $maxParts = 0;
        foreach ($candidates as $cand) {
            $parts = str_getcsv($firstLine, $cand);
            if (count($parts) > $maxParts) { $maxParts = count($parts); $delim = $cand; }
        }
        // Procesar headers y filas restantes
        $headers = array_map('trim', str_getcsv($firstLine, $delim));
        $rows = [];
        while (($line = fgets($h)) !== false) {
            $row = str_getcsv($line, $delim);
            if ($row === null) continue;
            $rows[] = $row;
        }
        fclose($h);
        return ['success' => true, 'headers' => $headers ?: [], 'rows' => $rows];
    }

    /**
     * Descargar plantilla de importación (CSV por defecto; XLSX si disponible)
     */
    public function template(Request $request)
    {
        $entity = $request->query('entity');
        $format = strtolower($request->query('format', 'csv'));
        $meta = $this->getEntitiesMeta();
        if (!isset($meta[$entity])) {
            return response()->json(['success' => false, 'message' => 'Entidad no soportada'], 422);
        }
        $headers = $meta[$entity]['fields'] ?? [];
        $filename = 'plantilla_' . $entity . '.' . ($format === 'xlsx' ? 'xlsx' : 'csv');

        if ($format === 'xlsx') {
            if (!class_exists('PhpOffice\\PhpSpreadsheet\\Spreadsheet')) {
                $format = 'csv';
            } else {
                $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
                $sheet = $spreadsheet->getActiveSheet();
                foreach ($headers as $idx => $h) {
                    $sheet->setCellValueByColumnAndRow($idx + 1, 1, $h);
                }
                $writer = \PhpOffice\PhpSpreadsheet\IOFactory::createWriter($spreadsheet, 'Xlsx');
                return new StreamedResponse(function () use ($writer) {
                    $writer->save('php://output');
                }, 200, [
                    'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                ]);
            }
        }
        // CSV fallback
        $csv = implode(',', $headers) . "\n"; // solo encabezados
        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    /**
     * Listar jobs de importación del broker autenticado
     */
    public function jobs(Request $request)
    {
        return $this->executeWithAuth($request, function ($user, $brokerId) use ($request) {
            $limit = (int) $request->query('limit', 20);
            $jobs = ImportJob::where('broker_id', $brokerId)
                ->orderBy('id', 'desc')
                ->limit($limit)
                ->get();
            return response()->json([
                'success' => true,
                'data' => $jobs,
            ]);
        });
    }

    /**
     * Obtener detalle de un job
     */
    public function showJob(Request $request, $id)
    {
        return $this->executeWithAuth($request, function ($user, $brokerId) use ($id) {
            $job = ImportJob::where('broker_id', $brokerId)->where('id', $id)->first();
            if (!$job) {
                return response()->json(['success' => false, 'message' => 'Job no encontrado'], 404);
            }
            return response()->json(['success' => true, 'data' => $job]);
        });
    }
}


