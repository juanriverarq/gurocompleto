<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Aseguradora;
use App\Models\Cliente;
use App\Models\Poliza;
use App\Models\PolizaVinculado;
use App\Models\Ramo;
use App\Models\Anexo;
use App\Models\ReciboCaja;
use App\Models\Siniestro;
use App\Models\Vendedor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Kreait\Firebase\Contract\Storage as FirebaseStorageContract;

/**
 * SoftSeguros Import Controller
 *
 * Real SoftSeguros API field reference (verified Feb 2026):
 *
 * CLIENTES: id, nombres, apellidos, numero_documento, tipo_documento('01'=CC),
 *   email, celular, telefono, direccion, ciudad, genero, fecha_nacimiento,
 *   ocupacion_string, tipo_cliente, sedes[{id,nombre}]
 *
 * POLIZAS: id, numero_poliza, cliente(ID int), cliente_numero_documento,
 *   cliente_nombres, cliente_apellidos, ramo_global(ID), ramo_global_nombre,
 *   ramo(ID), ramo_nombre, ramo_aseguradora_nombre, aseguradora_nit,
 *   vendedores[IDs], vendedores_nombre, vendedores_cedula,
 *   prima('237300.00'), iva('0.00'), total('357850.00'), comicion, porcentje_comicion,
 *   fecha_inicio, fecha_fin, fecha_expedicion, fecha_recepcion,
 *   estado_poliza_nombre, tipo_poliza, colectiva, soat, arl, forma_pago, medio_pago,
 *   nombre_tomador, cedula_tomador, nombre_asegurado, cedula_asegurado,
 *   sede(ID), sede_nombre, observaciones, renovable, ...50+ more fields
 *
 * VINCULADOS: id, poliza(ID int), nombre_asegurado, cedula_asegurado,
 *   email, celular, prima, iva, total, poliza_numero_poliza, ...
 *
 * SINIESTROS: id, poliza(ID int), numero_siniestro, poliza_numero_poliza,
 *   descripcion, monto_reclamo, estado_nombre, fecha_aviso, ...
 *
 * BENEFICIARIOS: id, poliza(ID int), nombres, numero_documento,
 *   parentesco, porcentaje_beneficio, riesgo_asegurado(ID), ...
 */
class SoftSegurosImportController extends Controller
{
    private function getBrokerId(Request $request): int
    {
        if ($request->has('authenticated_broker_id')) {
            return (int) $request->get('authenticated_broker_id');
        }
        if ($request->has('broker_id')) {
            return (int) $request->get('broker_id');
        }
        $user = $request->user();
        if ($user && $user->broker_id) {
            return (int) $user->broker_id;
        }
        return (int) ($request->header('X-Dev-Broker-Id') ?: 2);
    }

    /**
     * Persist SS token + user_id in broker settings so documents can be streamed later.
     */
    private function saveSsTokenToBroker(int $brokerId, string $token, ?int $ssUserId = null): void
    {
        try {
            $broker = \App\Models\Broker::find($brokerId);
            if (!$broker) return;
            $settings = $broker->settings ?? [];
            $ss = $settings['softseguros'] ?? [];
            $ss['token'] = $token;
            $ss['token_at'] = now()->toISOString();
            if ($ssUserId) $ss['user_id'] = $ssUserId;
            $settings['softseguros'] = $ss;
            $broker->settings = $settings;
            $broker->save();
        } catch (\Throwable $e) {
            Log::warning('[SS] Could not save token to broker', ['broker_id' => $brokerId, 'error' => $e->getMessage()]);
        }
    }

    // ─── SoftSeguros API config ──────────────────────────────────────
    private string $ssBaseUrl = 'https://app.softseguros.com';

    // Map sync entity keys → SS API endpoints
    private function getSsEndpoints(): array
    {
        return [
            'aseguradoras'  => '/api/aseguradora/',
            'ramos'         => '/api/ramosglobales/',
            'vendedores'    => '/api/vendedor/',
            'clientes'      => '/api/cliente/list_clientes_filtro_paginados/',
            'polizas'       => '/api/poliza/',
            'vinculados'    => '/api/riesgoasegurado/',
            'beneficiarios' => '/api/beneficiariopolizariesgo/',
            'siniestros'    => '/api/siniestro/list_paginado/',
            'anexos_polizas' => '/api/anexopoliza/list_anexos_polizas_filtro_paginados/',
            'recibos'       => '/api/pagopoliza/list_recibos_filtro_paginados/',
            'recaudos'      => '/api/recaudopagopoliza/list_recaudo_filtro_paginados/',
            'archivos'      => '/api/anexo/',
        ];
    }

    // Small entities fetched in one go (< ~100 records typically)
    private array $smallEntities = ['aseguradoras', 'ramos', 'comisiones_ramos', 'vendedores'];

    /**
     * Make a GET request to SoftSeguros API with retry on 429 rate limit.
     * Retries up to 5 times with exponential backoff (2s, 4s, 8s, 16s, 32s).
     */
    private function ssGet(string $token, string $url, array $params = []): ?\Illuminate\Http\Client\Response
    {
        $maxRetries = 5;
        for ($attempt = 0; $attempt <= $maxRetries; $attempt++) {
            $response = Http::timeout(30)
                ->withHeaders(['Authorization' => "Token {$token}"])
                ->get($url, $params);

            if ($response->status() !== 429) {
                return $response;
            }

            // Rate limited — wait with exponential backoff
            $wait = pow(2, $attempt + 1); // 2, 4, 8, 16, 32 seconds
            Log::warning("SoftSeguros API rate limited (429), waiting {$wait}s (attempt " . ($attempt + 1) . "/{$maxRetries})");
            sleep($wait);
        }

        // Still rate limited after all retries
        return $response ?? null;
    }

    /**
     * SYNC: Fetch from SoftSeguros API + import to Guro in one call.
     * For small entities (aseguradoras, ramos, vendedores): fetches all pages, imports all.
     * For large entities (clientes, polizas, vinculados, beneficiarios, siniestros): use syncEntityPage.
     */
    public function syncEntity(Request $request): JsonResponse
    {
        $request->validate([
            'token'  => 'required|string',
            'entity' => 'required|string|in:aseguradoras,ramos,comisiones_ramos,vendedores,clientes,polizas,vinculados,beneficiarios,siniestros',
            'limit'  => 'nullable|integer|min:1',
        ]);

        $token    = $request->input('token');
        $entity   = $request->input('entity');
        $limit    = $request->input('limit');
        $brokerId = $this->getBrokerId($request);
        $endpoints = $this->getSsEndpoints();
        $endpoint  = $endpoints[$entity] ?? null;

        // Persist token for document streaming
        $this->saveSsTokenToBroker($brokerId, $token, (int) $request->input('ss_user_id', 0) ?: null);

        // comisiones_ramos is special — it fetches data internally from multiple endpoints
        if ($entity === 'comisiones_ramos') {
            set_time_limit(300); // 5 min — ~123 sequential API calls
            try {
                $result = $this->importComisionesRamos($token, $brokerId);
                return response()->json([
                    'success' => true, 'entity' => $entity,
                    'fetched' => ($result['created'] ?? 0) + ($result['skipped'] ?? 0),
                    ...$result,
                ]);
            } catch (\Exception $e) {
                Log::error("SoftSeguros Sync error (comisiones_ramos): " . $e->getMessage());
                return response()->json(['success' => false, 'entity' => $entity, 'message' => $e->getMessage()], 500);
            }
        }

        if (!$endpoint) {
            return response()->json(['success' => false, 'message' => 'Entidad no válida'], 400);
        }

        Log::info("SoftSeguros Sync: fetching {$entity} from SS API", ['broker_id' => $brokerId]);

        try {
            // Fetch all data from SS (paginated)
            $allData = [];
            $page = 1;
            $totalCount = 0;

            while (true) {
                $response = $this->ssGet($token, "{$this->ssBaseUrl}{$endpoint}", ['page' => $page]);

                if (!$response || !$response->successful()) break;
                $json = $response->json();

                // Handle paginated vs non-paginated responses
                if (isset($json['results'])) {
                    $allData = array_merge($allData, $json['results']);
                    $totalCount = $json['count'] ?? $totalCount;
                    if (empty($json['next']) || $json['next'] === 'null') break;
                    $page++;
                } elseif (is_array($json) && !isset($json['success'])) {
                    // Non-paginated array response
                    $allData = $json;
                    $totalCount = count($json);
                    break;
                } else {
                    break;
                }

                // Safety limit for small entities
                if (in_array($entity, $this->smallEntities) && $page > 50) break;
                // For large entities, fetch all (large entities should use syncEntityPage instead)
                if (!in_array($entity, $this->smallEntities) && $page > 5000) break;

                usleep(200000); // 200ms between requests to avoid rate limiting
            }

            // Apply limit if set (for testing)
            if ($limit && count($allData) > $limit) {
                $allData = array_slice($allData, 0, $limit);
            }

            Log::info("SoftSeguros Sync: fetched {$entity}", ['count' => count($allData), 'limit' => $limit]);

            if (empty($allData)) {
                return response()->json([
                    'success' => true, 'entity' => $entity,
                    'fetched' => 0, 'created' => 0, 'skipped' => 0,
                ]);
            }

            // Import
            $result = match ($entity) {
                'aseguradoras' => $this->importAseguradoras($allData, $brokerId),
                'ramos'        => $this->importRamos($allData, $brokerId),
                'comisiones_ramos' => $this->importComisionesRamos($token, $brokerId),
                'vendedores'   => $this->importVendedores($allData, $brokerId),
                'clientes'     => $this->importClientes($allData, $brokerId),
                'polizas'      => $this->importPolizas($allData, $brokerId),
                'vinculados'   => $this->importVinculados($allData, $brokerId),
                'beneficiarios' => $this->importBeneficiarios($allData, $brokerId),
                'siniestros'   => $this->importSiniestros($allData, $brokerId),
            };

            Log::info("SoftSeguros Sync: finished {$entity}", $result);

            return response()->json([
                'success' => true,
                'entity'  => $entity,
                'fetched' => count($allData),
                'total_in_ss' => $totalCount,
                ...$result,
            ]);
        } catch (\Exception $e) {
            Log::error("SoftSeguros Sync error ({$entity}): " . $e->getMessage());
            return response()->json([
                'success' => false, 'entity' => $entity,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * SYNC PAGE: For large entities, fetch one page from SS API and import it.
     * Frontend calls this repeatedly: page=1, page=2, ... until has_next=false.
     * This avoids timeouts on entities with thousands of records.
     */
    public function syncEntityPage(Request $request): JsonResponse
    {
        $request->validate([
            'token'  => 'required|string',
            'entity' => 'required|string|in:clientes,polizas,vinculados,beneficiarios,siniestros,anexos_polizas,recibos,recaudos,recaudos_directos,recaudos_anulados,archivos',
            'page'   => 'required|integer|min:1',
        ]);

        $token    = $request->input('token');
        $entity   = $request->input('entity');
        $page     = $request->input('page');
        $brokerId = $this->getBrokerId($request);
        $endpoints = $this->getSsEndpoints();
        $endpoint  = $endpoints[$entity] ?? null;

        // Persist token for document streaming
        $this->saveSsTokenToBroker($brokerId, $token, (int) $request->input('ss_user_id', 0) ?: null);

        // archivos needs extra time (downloads + uploads per page)
        if ($entity === 'archivos') set_time_limit(120);

        try {
            // Some SS endpoints require extra query params to return results
            $queryParams = ['page' => $page];
            if ($entity === 'archivos') {
                $queryParams = array_merge($queryParams, [
                    'texto_busqueda' => '',
                    'sede' => -1,
                    'created_at_ini' => '',
                    'created_at_fin' => '',
                    'order_by' => 'created_at',
                    'sort_by' => 'desc',
                    'list_all' => 'true',
                ]);
            } elseif ($entity === 'recibos') {
                $queryParams = array_merge($queryParams, [
                    'sede' => -1,
                    'texto_busqueda' => '',
                    'tipo_busqueda_recibos' => -1,
                    'anticipos_aplicados' => -1,
                    'marca_usuario' => -1,
                    'tipo_recaudo' => '',
                    'field_search' => 'created_at',
                    'tipo' => 'recibos_anticipos',
                    'order_by' => 'fecha_realizo_pago_oficina',
                    'sort_by' => 'asc',
                ]);
            } elseif (in_array($entity, ['recaudos', 'recaudos_directos', 'recaudos_anulados'])) {
                $ssTipo = match ($entity) {
                    'recaudos_directos' => 'recaudos-directos',
                    'recaudos_anulados' => 'recaudos-anulados',
                    default => 'recaudos-activos',
                };
                $queryParams = array_merge($queryParams, [
                    'sede' => -1,
                    'texto_busqueda' => '',
                    'tipo_busqueda_recibos' => -1,
                    'anticipos_aplicados' => -1,
                    'marca_usuario' => -1,
                    'tipo_recaudo' => '',
                    'field_search' => 'created_at',
                    'tipo' => $ssTipo,
                    'order_by' => 'recaudo__numero_recibo',
                    'sort_by' => 'desc',
                ]);
                // All recaudos variants use the same SS endpoint
                $endpoint = $endpoints['recaudos'];
            }

            $response = $this->ssGet($token, "{$this->ssBaseUrl}{$endpoint}", $queryParams);

            if (!$response || !$response->successful()) {
                $status = $response ? $response->status() : 0;
                return response()->json([
                    'success' => false,
                    'message' => "SS API error: HTTP {$status}" . ($status === 429 ? ' (rate limited, intenta de nuevo en unos segundos)' : ''),
                ], 502);
            }

            $json = $response->json();
            $results = $json['results'] ?? [];
            $totalCount = $json['count'] ?? 0;
            $hasNext = !empty($json['next']) && $json['next'] !== 'null';

            if (empty($results)) {
                return response()->json([
                    'success' => true, 'entity' => $entity, 'page' => $page,
                    'fetched' => 0, 'created' => 0, 'skipped' => 0,
                    'has_next' => false, 'total_in_ss' => $totalCount,
                ]);
            }

            // Import this page's data
            $result = match ($entity) {
                'clientes'     => $this->importClientes($results, $brokerId),
                'polizas'      => $this->importPolizas($results, $brokerId),
                'vinculados'   => $this->importVinculados($results, $brokerId),
                'beneficiarios' => $this->importBeneficiarios($results, $brokerId),
                'siniestros'   => $this->importSiniestros($results, $brokerId),
                'anexos_polizas' => $this->importAnexosPolizas($results, $brokerId),
                'recibos'      => $this->importRecibos($results, $brokerId),
                'recaudos'     => $this->importRecaudos($results, $brokerId, 'activos'),
                'recaudos_directos' => $this->importRecaudos($results, $brokerId, 'directos'),
                'recaudos_anulados' => $this->importRecaudos($results, $brokerId, 'anulados'),
                'archivos'     => $this->importArchivos($results, $brokerId, $token, (int) $request->input('ss_user_id', 0)),
            };

            return response()->json([
                'success'     => true,
                'entity'      => $entity,
                'page'        => $page,
                'fetched'     => count($results),
                'has_next'    => $hasNext,
                'total_in_ss' => $totalCount,
                ...$result,
            ]);
        } catch (\Exception $e) {
            Log::error("SoftSeguros SyncPage error ({$entity} p{$page}): " . $e->getMessage());
            return response()->json([
                'success' => false, 'entity' => $entity,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Import a single entity type from SoftSeguros data into Guro (data provided in request body).
     * Called per-entity from the frontend in strict order:
     * 1. aseguradoras → 2. ramos → 3. vendedores → 4. clientes → 5. polizas → 6. vinculados → 7. beneficiarios → 8. siniestros
     */
    public function importEntity(Request $request): JsonResponse
    {
        $request->validate([
            'entity'    => 'required|string|in:aseguradoras,ramos,vendedores,clientes,polizas,vinculados,beneficiarios,siniestros',
            'data'      => 'required|array',
            'broker_id' => 'nullable|integer',
        ]);

        $entity   = $request->input('entity');
        $data     = $request->input('data');
        $brokerId = $this->getBrokerId($request);

        Log::info("SoftSeguros Import: starting {$entity}", ['count' => count($data), 'broker_id' => $brokerId]);

        try {
            $result = match ($entity) {
                'aseguradoras' => $this->importAseguradoras($data, $brokerId),
                'ramos'        => $this->importRamos($data, $brokerId),
                'vendedores'   => $this->importVendedores($data, $brokerId),
                'clientes'     => $this->importClientes($data, $brokerId),
                'polizas'      => $this->importPolizas($data, $brokerId),
                'vinculados'   => $this->importVinculados($data, $brokerId),
                'beneficiarios' => $this->importBeneficiarios($data, $brokerId),
                'siniestros'   => $this->importSiniestros($data, $brokerId),
            };

            Log::info("SoftSeguros Import: finished {$entity}", $result);

            return response()->json([
                'success' => true,
                'entity'  => $entity,
                ...$result,
            ]);
        } catch (\Exception $e) {
            Log::error("SoftSeguros Import error ({$entity}): " . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'entity'  => $entity,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    // ─── ASEGURADORAS ───────────────────────────────────────────────

    private function importAseguradoras(array $rows, int $brokerId): array
    {
        $created = 0;
        $skipped = 0;

        foreach ($rows as $row) {
            $nombre = trim($row['nombre'] ?? $row['nombre_aseguradora'] ?? '');
            if (!$nombre) { $skipped++; continue; }

            $exists = Aseguradora::withoutGlobalScopes()
                ->where('broker_id', $brokerId)
                ->where('nombre', $nombre)
                ->exists();

            if ($exists) { $skipped++; continue; }

            Aseguradora::withoutGlobalScopes()->create([
                'broker_id' => $brokerId,
                'nombre'    => $nombre,
                'nit'       => $row['nit'] ?? $row['nit_aseguradora'] ?? null,
                'email'     => $row['email'] ?? null,
                'telefono'  => $row['telefono'] ?? null,
                'direccion' => $row['direccion'] ?? null,
            ]);
            $created++;
        }

        return ['created' => $created, 'skipped' => $skipped];
    }

    // ─── RAMOS ──────────────────────────────────────────────────────

    private function importRamos(array $rows, int $brokerId): array
    {
        $created = 0;
        $skipped = 0;

        foreach ($rows as $row) {
            $nombre = trim($row['nombre'] ?? $row['nombre_ramo'] ?? '');
            if (!$nombre) { $skipped++; continue; }

            $exists = Ramo::withoutGlobalScopes()
                ->where('broker_id', $brokerId)
                ->where('nombre', $nombre)
                ->exists();

            if ($exists) { $skipped++; continue; }

            Ramo::withoutGlobalScopes()->create([
                'broker_id' => $brokerId,
                'nombre'    => $nombre,
            ]);
            $created++;
        }

        return ['created' => $created, 'skipped' => $skipped];
    }

    // ─── COMISIONES RAMOS (ramo ↔ aseguradora) ─────────────────────

    private function importComisionesRamos(string $token, int $brokerId): array
    {
        $created = 0;
        $skipped = 0;
        $errors = [];

        // Get all ramos and aseguradoras for this broker (indexed by name)
        $ramos = Ramo::withoutGlobalScopes()->where('broker_id', $brokerId)->get()->keyBy(fn($r) => strtolower($r->nombre));
        $aseguradoras = Aseguradora::withoutGlobalScopes()->where('broker_id', $brokerId)->get()->keyBy(fn($a) => strtolower($a->nombre));

        // Fetch all ramomarca from SS
        $allRamoMarca = [];
        $page = 1;
        while (true) {
            $resp = $this->ssGet($token, "{$this->ssBaseUrl}/api/ramomarca/", ['page' => $page]);
            if (!$resp || !$resp->successful()) break;
            $json = $resp->json();
            $allRamoMarca = array_merge($allRamoMarca, $json['results'] ?? []);
            if (empty($json['next'])) break;
            $page++;
            usleep(200000);
        }

        Log::info("SoftSeguros: fetched " . count($allRamoMarca) . " ramomarca");

        // For each ramomarca, fetch its aseguradora_ramo relationships
        foreach ($allRamoMarca as $rm) {
            $rmId = $rm['id'];
            $ramoGlobalNombre = strtolower(trim($rm['nombre_ramo_global'] ?? ''));
            $ramoObj = $ramos[$ramoGlobalNombre] ?? null;
            if (!$ramoObj) { $skipped++; continue; }

            $resp = $this->ssGet($token, "{$this->ssBaseUrl}/api/ramomarca/{$rmId}/list_aseguradora_ramo/");
            if (!$resp || !$resp->successful()) { $skipped++; continue; }

            $data = $resp->json();
            $asegRamos = $data['results'] ?? [];

            foreach ($asegRamos as $ar) {
                $asegNombre = strtolower(trim($ar['aseguradora_nombre'] ?? ''));
                $asegObj = $aseguradoras[$asegNombre] ?? null;
                if (!$asegObj) continue;

                $pctIva = $this->parseDecimal($ar['porcentaje_iva_prima'] ?? 0);
                $pctComision = $this->parseDecimal($ar['porcentje_comicion'] ?? 0);

                // Check porcentajes array for more detailed commission
                if (!empty($ar['porcentajes'])) {
                    foreach ($ar['porcentajes'] as $pct) {
                        if (($pct['default'] ?? false) && ($pct['type'] ?? '') === 'PRIMA') {
                            $pctComision = $this->parseDecimal($pct['porcentaje_comision'] ?? $pctComision);
                            break;
                        }
                    }
                }

                // Upsert into comisiones_aseguradoras
                $existing = DB::table('comisiones_aseguradoras')
                    ->where('ramo_id', $ramoObj->id)
                    ->where('aseguradora_id', $asegObj->id)
                    ->first();

                if ($existing) {
                    DB::table('comisiones_aseguradoras')
                        ->where('id', $existing->id)
                        ->update([
                            'porcentaje_iva' => $pctIva,
                            'porcentaje_comision' => $pctComision,
                            'updated_at' => now(),
                        ]);
                    $skipped++;
                } else {
                    DB::table('comisiones_aseguradoras')->insert([
                        'ramo_id' => $ramoObj->id,
                        'aseguradora_id' => $asegObj->id,
                        'porcentaje_iva' => $pctIva,
                        'porcentaje_comision' => $pctComision,
                        'pri_a_pre_por_defecto' => !empty($ar['comision_prima']),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                    $created++;
                }
            }

            usleep(150000); // 150ms between ramomarca calls
        }

        return ['created' => $created, 'skipped' => $skipped, 'errors' => $errors];
    }

    // ─── VENDEDORES ─────────────────────────────────────────────────

    private function importVendedores(array $rows, int $brokerId): array
    {
        $created = 0;
        $skipped = 0;

        foreach ($rows as $row) {
            $nombre = trim($row['nombre'] ?? $row['nombres'] ?? '');
            if (!$nombre) { $skipped++; continue; }

            $cedula = trim($row['cedula'] ?? $row['numero_documento'] ?? '');

            $exists = Vendedor::withoutGlobalScopes()
                ->where('broker_id', $brokerId)
                ->where(function ($q) use ($nombre, $cedula) {
                    $q->where('nombres', $nombre);
                    if ($cedula) {
                        $q->orWhere('numero_documento', $cedula);
                    }
                })
                ->exists();

            if ($exists) { $skipped++; continue; }

            Vendedor::withoutGlobalScopes()->create([
                'broker_id'        => $brokerId,
                'nombres'          => $nombre,
                'numero_documento' => $cedula ?: '',
                'tipo_documento'   => $row['tipo_documento'] ?? null,
                'email'            => $row['email'] ?? null,
                'telefono'         => $row['telefono'] ?? null,
                'celular'          => $row['celular'] ?? null,
                'es_agencia'       => !empty($row['es_agencia']),
                'tipo_persona'     => $row['tipo_persona'] ?? 'natural',
            ]);
            $created++;
        }

        return ['created' => $created, 'skipped' => $skipped];
    }

    // ─── CLIENTES ───────────────────────────────────────────────────
    // Real SoftSeguros fields: id, nombres, apellidos, numero_documento,
    // tipo_documento('01'=CC,'02'=CE,'03'=NIT,'04'=PA,'05'=TI),
    // email, celular, telefono, direccion, ciudad, genero('FEMENINO'/'MASCULINO'),
    // fecha_nacimiento, ocupacion_string, tipo_cliente, es_consorcio, sedes[{id,nombre}]

    private function importClientes(array $rows, int $brokerId): array
    {
        $created = 0;
        $updated = 0;
        $skipped = 0;

        // SoftSeguros tipo_documento codes
        $docTypeMap = [
            '01' => 'CC', '02' => 'CE', '03' => 'NIT', '04' => 'PA', '05' => 'TI',
            '06' => 'RC', '07' => 'DIE',
            'CEDULA DE CIUDADANIA' => 'CC', 'CEDULA DE CIUDADANÍA' => 'CC',
            'CEDULA DE EXTRANJERIA' => 'CE', 'CEDULA DE EXTRANJERÍA' => 'CE',
            'NIT' => 'NIT', 'PASAPORTE' => 'PA', 'TARJETA DE IDENTIDAD' => 'TI',
        ];

        foreach ($rows as $row) {
            $documento = trim($row['numero_documento'] ?? '');
            if (!$documento) { $skipped++; continue; }

            $firstName = trim($row['nombres'] ?? '');
            $lastName  = trim($row['apellidos'] ?? '');
            if (!$firstName && !$lastName) { $skipped++; continue; }

            $existing = Cliente::withoutGlobalScopes()
                ->where('broker_id', $brokerId)
                ->where('document_number', $documento)
                ->first();

            if ($existing) {
                $updateData = [];
                if (empty($existing->email) && !empty($row['email'])) {
                    $updateData['email'] = $row['email'];
                }
                if (empty($existing->mobile_phone) && !empty($row['celular'])) {
                    $updateData['mobile_phone'] = $row['celular'];
                }
                if (empty($existing->phone) && !empty($row['telefono'])) {
                    $updateData['phone'] = $row['telefono'];
                }
                if (empty($existing->address) && !empty($row['direccion'])) {
                    $updateData['address'] = $row['direccion'];
                }

                // Fix empresa detection for already-imported clients
                $rawDocType = strtoupper(trim($row['tipo_documento'] ?? '01'));
                $mappedDocType = $docTypeMap[$rawDocType] ?? (strlen($rawDocType) <= 5 ? $rawDocType : 'CC');
                $genero = strtoupper(trim($row['genero'] ?? ''));
                $isEmpresa = $mappedDocType === 'NIT'
                    || !empty($row['es_consorcio'])
                    || $genero === 'EMPRESA'
                    || (str_contains($documento, '-') && strlen($documento) >= 9);

                if ($isEmpresa && $existing->client_type !== 'empresa') {
                    $razonSocial = trim($firstName . ' ' . $lastName);
                    $updateData['client_type'] = 'empresa';
                    $updateData['document_type'] = 'NIT';
                    $updateData['company_legal_name'] = $razonSocial;
                    $updateData['company'] = $razonSocial;
                    $updateData['gender'] = null;
                    $updateData['birth_date'] = null;
                }
                // Also fix empresa clients that have empty company_legal_name
                if ($isEmpresa && $existing->client_type === 'empresa' && empty($existing->company_legal_name)) {
                    $razonSocial = trim($firstName . ' ' . $lastName);
                    $updateData['company_legal_name'] = $razonSocial;
                    $updateData['company'] = $razonSocial;
                }

                if (!empty($updateData)) {
                    $existing->update($updateData);
                    $updated++;
                } else {
                    $skipped++;
                }
                continue;
            }

            // Map document type (SoftSeguros sends code like '01', '03')
            $rawDocType = strtoupper(trim($row['tipo_documento'] ?? '01'));
            $mappedDocType = $docTypeMap[$rawDocType] ?? (strlen($rawDocType) <= 5 ? $rawDocType : 'CC');

            // Detect empresa by NIT, es_consorcio, or genero='EMPRESA'
            $genero = strtoupper(trim($row['genero'] ?? ''));
            $isEmpresa = $mappedDocType === 'NIT'
                || !empty($row['es_consorcio'])
                || $genero === 'EMPRESA'
                || (str_contains($documento, '-') && strlen($documento) >= 9); // NIT format like 800136509-3

            // If detected as empresa, force document type to NIT
            if ($isEmpresa && $mappedDocType !== 'NIT') {
                $mappedDocType = 'NIT';
            }

            // Gender (SoftSeguros sends 'FEMENINO', 'MASCULINO', 'EMPRESA', or null)
            $genderMap = ['MASCULINO' => 'M', 'FEMENINO' => 'F'];
            $mappedGender = $isEmpresa ? null : ($genderMap[$genero] ?? null);

            // Parse birth date
            $birthDate = $row['fecha_nacimiento'] ?? null;
            if ($birthDate && strtotime($birthDate) === false) {
                $birthDate = null;
            }

            // Build razón social for empresa clients
            $razonSocial = $isEmpresa ? trim($firstName . ' ' . $lastName) : null;

            Cliente::withoutGlobalScopes()->create([
                'broker_id'       => $brokerId,
                'client_type'     => $isEmpresa ? 'empresa' : 'persona',
                'first_name'      => $firstName,
                'last_name'       => $lastName,
                'document_type'   => $mappedDocType,
                'document_number' => $documento,
                'company_legal_name' => $razonSocial,
                'company'         => $razonSocial,
                'email'           => $row['email'] ?? null,
                'phone'           => $row['telefono'] ?? null,
                'mobile_phone'    => $row['celular'] ?? null,
                'birth_date'      => $isEmpresa ? null : $birthDate,
                'gender'          => $mappedGender,
                'address'         => $row['direccion'] ?? null,
                'city'            => $row['ciudad'] ?? null,
                'country'         => 'Colombia',
                'occupation'      => $row['ocupacion_string'] ?? $row['otra_ocupacion'] ?? null,
                'status'          => 'active',
                'source'          => 'softseguros',
                'custom_fields'   => [
                    'softseguros_id' => $row['id'] ?? null,
                    'tipo_cliente'   => $row['tipo_cliente'] ?? null,
                ],
            ]);
            $created++;
        }

        return ['created' => $created, 'updated' => $updated, 'skipped' => $skipped];
    }

    // ─── PÓLIZAS ────────────────────────────────────────────────────
    // Real SoftSeguros poliza fields (verified):
    // id, numero_poliza, cliente(SS ID int), cliente_numero_documento, cliente_nombres, cliente_apellidos,
    // ramo_global(SS ID), ramo_global_nombre('SOAT'), ramo(SS ID), ramo_nombre('Motos'),
    // ramo_aseguradora_nombre('PREVISORA'), aseguradora_nit('860002400-2'),
    // vendedores[IDs], vendedores_nombre, vendedores_cedula,
    // prima('237300.00'), iva('0.00'), total('357850.00'), comicion('12790.00'), porcentje_comicion('7.00'),
    // gastos_expedicion, iva_de_comision, sobrecomision, porcentaje_sobrecomision,
    // porcentaje_comision_vendedor, comision_vendedor, porcentaje_comision_tecnico, comision_tecnico,
    // porcentaje_comision_sede, comision_sede, comision_recibida, total_pagado,
    // fecha_inicio, fecha_fin, fecha_expedicion, fecha_recepcion,
    // estado_poliza_nombre, tipo_poliza('individual'), colectiva(bool), soat(bool), arl(bool),
    // clasificacion_poliza('Nuevos'/'Renovados'), periodicidad, forma_pago('Contado'), medio_pago('Efectivo'),
    // nombre_tomador, cedula_tomador, nombre_asegurado, cedula_asegurado,
    // nombre_beneficiario, cedula_beneficiario_poliza,
    // valor_asegurado_riesgo, codio_objeto_asegurado(description/placa),
    // sede_nombre, observaciones, renovable, participacion,
    // porcentaje_financiacion, valor_financiacion, total_poliza_financiada,
    // estado_cartera, comicionada(bool), recaudado(bool), recaudado_en_oficina(bool),
    // porcentaje_impuesto_bomberos, impuesto_bomberos, tasa_cambio, tipo_moneda,
    // numero_renovacion, is_renewal(bool), incluir_beneficiarios_remision(bool), masiva(bool)

    private function importPolizas(array $rows, int $brokerId): array
    {
        $created = 0;
        $updated = 0;
        $skipped = 0;
        $errors  = [];

        // Pre-load lookup tables
        $aseguradoras = Aseguradora::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->get()
            ->keyBy(function ($a) { return strtolower(trim($a->nombre)); });

        // Also index by NIT/CUIT for fallback
        $aseguradorasByNit = Aseguradora::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->whereNotNull('cuit')
            ->pluck('id', 'cuit')
            ->toArray();

        $ramos = Ramo::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->get()
            ->keyBy(function ($r) { return strtolower(trim($r->nombre)); });

        $vendedores = Vendedor::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->get()
            ->keyBy(function ($v) { return strtolower(trim($v->nombres)); });

        // Build client lookup by document
        $clientesByDoc = Cliente::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->pluck('id', 'document_number')
            ->toArray();

        // Preload comisiones_aseguradoras for IVA % lookup (ramo_id-aseguradora_id → porcentaje_iva)
        $comisionesLookup = DB::table('comisiones_aseguradoras')
            ->whereIn('ramo_id', $ramos->pluck('id'))
            ->get()
            ->keyBy(fn($c) => $c->ramo_id . '-' . $c->aseguradora_id);

        foreach ($rows as $idx => $row) {
            try {
                $numeroPoliza = trim($row['numero_poliza'] ?? '');
                if (!$numeroPoliza) { $skipped++; continue; }

                // Check duplicate by policy number
                $existing = Poliza::withoutGlobalScopes()
                    ->where('broker_id', $brokerId)
                    ->where('policy_number', $numeroPoliza)
                    ->first();

                if ($existing) { $skipped++; continue; }

                // Resolve client by document (SoftSeguros: cliente_numero_documento)
                $cedulaCliente = trim($row['cliente_numero_documento'] ?? '');
                $clienteId = $cedulaCliente ? ($clientesByDoc[$cedulaCliente] ?? null) : null;
                $clienteName = trim(($row['cliente_nombres'] ?? '') . ' ' . ($row['cliente_apellidos'] ?? ''));

                // Hierarchical validation: skip if client was not imported into Guro
                if (!$clienteId) { $skipped++; continue; }

                // Resolve aseguradora (by ramo_aseguradora_nombre, fallback aseguradora_nit)
                $asegNombre = trim($row['ramo_aseguradora_nombre'] ?? '');
                $asegLower = strtolower($asegNombre);
                $aseguradoraObj = $aseguradoras[$asegLower] ?? null;
                $aseguradoraId = $aseguradoraObj?->id;
                if (!$aseguradoraId && !empty($row['aseguradora_nit'])) {
                    $aseguradoraId = $aseguradorasByNit[$row['aseguradora_nit']] ?? null;
                }

                // Resolve ramo (by ramo_global_nombre, fallback ramo_nombre)
                $ramoGlobalNombre = trim($row['ramo_global_nombre'] ?? '');
                $ramoNombre = trim($row['ramo_nombre'] ?? '');
                $ramoObj = $ramos[strtolower($ramoGlobalNombre)] ?? $ramos[strtolower($ramoNombre)] ?? null;
                $ramoId = $ramoObj?->id;

                // Resolve vendedor (vendedores_nombre is the denormalized name)
                $vendedorNombre = trim($row['vendedores_nombre'] ?? '');
                $vendedorObj = $vendedorNombre ? ($vendedores[strtolower($vendedorNombre)] ?? null) : null;

                // Map status
                $estadoSoft = strtolower(trim($row['estado_poliza_nombre'] ?? 'activa'));
                $statusMap = [
                    'activa' => 'active', 'vigente' => 'active',
                    'cancelada' => 'cancelled', 'vencida' => 'expired',
                    'suspendida' => 'suspended', 'pendiente' => 'pending',
                    'devengada' => 'expired', 'expedición' => 'active', 'expedicion' => 'active',
                    'no renovada' => 'expired',
                ];
                $status = $statusMap[$estadoSoft] ?? 'active';

                // Parse dates
                $fechaInicio = $this->parseDate($row['fecha_inicio'] ?? null);
                $fechaFin    = $this->parseDate($row['fecha_fin'] ?? null);
                $fechaExp    = $this->parseDate($row['fecha_expedicion'] ?? null);
                $fechaRecep  = $this->parseDate($row['fecha_recepcion'] ?? null);

                // Parse amounts (SoftSeguros sends string decimals like '237300.00')
                $primaNeta   = $this->parseDecimal($row['prima'] ?? 0);
                $iva         = $this->parseDecimal($row['iva'] ?? 0);
                $total       = $this->parseDecimal($row['total'] ?? 0);
                $comision    = $this->parseDecimal($row['comicion'] ?? 0);
                $pctComision = $this->parseDecimal($row['porcentje_comicion'] ?? 0);
                $gastosExp   = $this->parseDecimal($row['gastos_expedicion'] ?? 0);

                // Determine type based on ramo_global_nombre
                // DB enum: vida, autos, hogar, empresarial, salud, accidentes, responsabilidad_civil, otros
                $ramoGloLower = strtolower($ramoGlobalNombre ?: $ramoNombre);
                $type = 'otros';
                if (str_contains($ramoGloLower, 'auto') || str_contains($ramoGloLower, 'soat') || str_contains($ramoGloLower, 'vehic') || str_contains($ramoGloLower, 'moto')) {
                    $type = 'autos';
                } elseif (str_contains($ramoGloLower, 'vida') || str_contains($ramoGloLower, 'person') || str_contains($ramoGloLower, 'deudor') || str_contains($ramoGloLower, 'exequi')) {
                    $type = 'vida';
                } elseif (str_contains($ramoGloLower, 'salud') || str_contains($ramoGloLower, 'medic') || str_contains($ramoGloLower, 'arl') || str_contains($ramoGloLower, 'riesgo laboral')) {
                    $type = 'salud';
                } elseif (str_contains($ramoGloLower, 'hogar') || str_contains($ramoGloLower, 'incendio') || str_contains($ramoGloLower, 'multirri')) {
                    $type = 'hogar';
                } elseif (str_contains($ramoGloLower, 'responsabilidad') || str_contains($ramoGloLower, 'cumplimiento') || str_contains($ramoGloLower, 'rc') || str_contains($ramoGloLower, 'fianza')) {
                    $type = 'responsabilidad_civil';
                } elseif (str_contains($ramoGloLower, 'accidente') || str_contains($ramoGloLower, 'ap ') || str_contains($ramoGloLower, 'ape')) {
                    $type = 'accidentes';
                } elseif (str_contains($ramoGloLower, 'empresa') || str_contains($ramoGloLower, 'pyme') || str_contains($ramoGloLower, 'copropied') || str_contains($ramoGloLower, 'transporte') || str_contains($ramoGloLower, 'carga')) {
                    $type = 'empresarial';
                }

                $isColectiva = ($row['tipo_poliza'] ?? '') === 'colectiva' || !empty($row['colectiva']);

                // Get IVA % from comisiones_aseguradoras (synced from ramomarca), fallback to calculated
                $ivaPercent = 0;
                $comKey = $ramoId && $aseguradoraId ? ($ramoId . '-' . $aseguradoraId) : null;
                $comisionConfig = $comKey ? ($comisionesLookup[$comKey] ?? null) : null;
                if ($comisionConfig && $comisionConfig->porcentaje_iva > 0) {
                    $ivaPercent = (float) $comisionConfig->porcentaje_iva;
                } elseif ($primaNeta > 0 && $iva > 0) {
                    $ivaPercent = round(($iva / $primaNeta) * 100, 2);
                }

                // Parse boolean flags properly (SS sends true/false, "true"/"false", 1/0)
                $isSoat = filter_var($row['soat'] ?? false, FILTER_VALIDATE_BOOLEAN);
                $isArl  = filter_var($row['arl'] ?? false, FILTER_VALIDATE_BOOLEAN);
                $isComisionada = filter_var($row['comicionada'] ?? false, FILTER_VALIDATE_BOOLEAN);
                // Fallback: if estado_cartera contains 'Comisionada', mark as comisionada
                if (!$isComisionada && stripos($row['estado_cartera'] ?? '', 'Comisionada') !== false) {
                    $isComisionada = true;
                }

                // Derive payment_frequency: forma_pago takes priority over periodicidad
                // periodicidad = ciclo de vigencia (Anual, Semestral...)
                // forma_pago = cómo se paga (Contado, Fraccionado, Financiado)
                $periodicidad = $row['periodicidad'] ?? null;
                $formaPago = $row['forma_pago'] ?? null;
                $fpLower = $formaPago ? strtolower(trim($formaPago)) : '';
                if (in_array($fpLower, ['fraccionado', 'financiado'])) {
                    // Fraccionado/Financiado siempre es monthly, sin importar periodicidad
                    $paymentFrequency = 'monthly';
                } else {
                    $paymentFrequency = $this->mapPaymentFrequency($periodicidad);
                }

                // Beneficiary: only set document if there's a name
                $beneficiaryName = $row['nombre_beneficiario'] ?? null;
                $beneficiaryDoc  = $beneficiaryName ? ($row['cedula_beneficiario_poliza'] ?? null) : null;

                Poliza::withoutGlobalScopes()->create([
                    'broker_id'          => $brokerId,
                    'policy_number'      => $numeroPoliza,
                    'type'               => $type,
                    'insurance_company'  => $asegNombre ?: null,
                    'aseguradora_id'     => $aseguradoraId,
                    'product_name'       => $ramoGlobalNombre ?: ($ramoNombre ?: 'General'),
                    'ramo_id'            => $ramoId,
                    'description'        => $row['codio_objeto_asegurado'] ?? null,
                    'vehicle_plates'     => ($type === 'autos' && !empty($row['codio_objeto_asegurado'])) ? json_encode([$row['codio_objeto_asegurado']]) : null,
                    'client_id'          => $clienteId,
                    'client_name'        => $clienteName ?: null,
                    'client_document'    => $cedulaCliente ?: null,
                    // Dates
                    'issue_date'         => $fechaExp,
                    'start_date'         => $fechaInicio,
                    'end_date'           => $fechaFin,
                    'reception_date'     => $fechaRecep,
                    // Financials
                    'premium_amount'         => $primaNeta,
                    'vat_percentage'         => $ivaPercent,
                    'vat_amount'             => $iva,
                    'total_amount'           => $total,
                    'gastos_adicionales'     => $gastosExp,
                    'commission_percentage'  => $pctComision,
                    'commission_amount'      => $comision,
                    'insured_amount'         => $this->parseDecimal($row['valor_asegurado_riesgo'] ?? 0),
                    // Status
                    'status'             => $status,
                    'auto_renewal'       => !empty($row['renovable']),
                    // Seller
                    'seller_name'        => $vendedorNombre ?: null,
                    'seller_id'          => $vendedorObj?->id,
                    // Parties
                    'policy_holder_name'     => $row['nombre_tomador'] ?? null,
                    'policy_holder_document' => $row['cedula_tomador'] ?? null,
                    'insured_name'           => $row['nombre_asegurado'] ?? null,
                    'insured_document'       => $row['cedula_asegurado'] ?? null,
                    'beneficiary_name'       => $beneficiaryName,
                    'beneficiary_document'   => $beneficiaryDoc,
                    // Notes
                    'notes'              => is_string($row['observaciones'] ?? null) ? $row['observaciones'] : null,
                    // Payment
                    'payment_method'     => $this->mapPaymentMethod($row['medio_pago'] ?? null),
                    'payment_frequency'  => $paymentFrequency,
                    'half_payment'       => $this->mapMedioPago($row['medio_pago'] ?? null),
                    'installments_count' => ((int)($row['numero_de_cuotas'] ?? 0)) ?: null,
                    'forma_pago_detalle' => $this->parseFormaPagoTexto($row['forma_pago_texto'] ?? null),
                    // SoftSeguros extra fields
                    'softseguros_id'                 => $row['id'] ?? null,
                    'tipo_poliza'                    => $row['tipo_poliza'] ?? ($isColectiva ? 'colectiva' : 'individual'),
                    'colectiva'                      => $isColectiva,
                    'masiva'                         => !empty($row['masiva']),
                    'soat'                           => $isSoat,
                    'arl'                            => $isArl,
                    'clasificacion_poliza'           => $row['clasificacion_poliza'] ?? null,
                    'periodicidad'                   => $row['periodicidad'] ?? null,
                    // Detailed commissions (SoftSeguros field names with typos preserved)
                    'iva_comision'                   => $this->parseDecimal($row['iva_de_comision'] ?? 0),
                    'porcentaje_sobrecomision'       => $this->parseDecimal($row['porcentaje_sobrecomision'] ?? 0),
                    'sobrecomision'                  => $this->parseDecimal($row['sobrecomision'] ?? 0),
                    'porcentaje_comision_vendedor'   => $this->parseDecimal($row['porcentaje_comision_vendedor'] ?? 0),
                    'comision_vendedor'              => $this->parseDecimal($row['comision_vendedor'] ?? 0),
                    'porcentaje_comision_tecnico'    => $this->parseDecimal($row['porcentaje_comision_tecnico'] ?? 0),
                    'comision_tecnico'               => $this->parseDecimal($row['comision_tecnico'] ?? 0),
                    'porcentaje_comision_sede'       => $this->parseDecimal($row['porcentaje_comision_sede'] ?? 0),
                    'comision_sede'                  => $this->parseDecimal($row['comision_sede'] ?? 0),
                    'comision_recibida'              => $this->parseDecimal($row['comision_recibida'] ?? 0),
                    'total_pagado'                   => $this->parseDecimal($row['total_pagado'] ?? 0),
                    // Financing
                    'porcentaje_financiacion'        => $this->parseDecimal($row['porcentaje_financiacion'] ?? 0),
                    'valor_financiacion'             => $this->parseDecimal($row['valor_financiacion'] ?? 0),
                    'total_poliza_financiada'        => $this->parseDecimal($row['total_poliza_financiada'] ?? 0),
                    'financiacion_incluye_comision'  => !empty($row['financiacion_incluye_comision']),
                    'financiacion_calcular_iva'      => !empty($row['financiacion_calcular_iva']),
                    // Portfolio / Cartera
                    'estado_cartera'                 => $row['estado_cartera'] ?? null,
                    'comisionada'                    => $isComisionada,
                    'recaudado'                      => !empty($row['recaudado']),
                    'recaudado_en_oficina'           => !empty($row['recaudado_en_oficina']),
                    // Taxes
                    'porcentaje_impuesto_bomberos'   => $this->parseDecimal($row['porcentaje_impuesto_bomberos'] ?? 0),
                    'impuesto_bomberos'              => $this->parseDecimal($row['impuesto_bomberos'] ?? 0),
                    'aporte_sbs'                     => $this->parseDecimal($row['aporte_sbs'] ?? 0),
                    'aporte_seguro_campesino'        => $this->parseDecimal($row['aporte_seguro_campesino'] ?? 0),
                    'prima_asistencia'               => $this->parseDecimal($row['prima_asistencia'] ?? 0),
                    'otros_cargos'                   => $this->parseDecimal($row['otros_cargos'] ?? 0),
                    // Renewal
                    'numero_renovacion'              => (int)($row['numero_renovacion'] ?? 0),
                    'is_renewal'                     => !empty($row['is_renewal']),
                    // Currency
                    'tipo_moneda'                    => $row['tipo_moneda'] ?? null,
                    'tasa_cambio'                    => $this->parseDecimal($row['tasa_cambio'] ?? 0),
                    // Participation / Withholding
                    'participation'                  => $this->parseDecimal($row['participacion'] ?? 0),
                    'coinsurance_participation'      => $this->parseDecimal($row['coinsurance_participation'] ?? 0),
                    // Sede
                    'sede_nombre'                    => $row['sede_nombre'] ?? null,
                    // Beneficiary in remittance
                    'beneficiary_in_remittance'      => !empty($row['incluir_beneficiarios_remision']),
                    // Custom fields for metadata
                    'custom_fields'                  => [
                        'softseguros_id'       => $row['id'] ?? null,
                        'policy_category'      => $isColectiva ? 'colectiva' : 'individual',
                        'sede'                 => $row['sede_nombre'] ?? null,
                        'forma_pago'           => $row['forma_pago'] ?? null,
                        'imported_from'        => 'softseguros',
                        'imported_at'          => now()->toISOString(),
                    ],
                ]);

                $created++;
            } catch (\Exception $e) {
                $polNum = $row['numero_poliza'] ?? '?';
                $errors[] = "Póliza #{$idx} ({$polNum}): " . $e->getMessage();
                Log::warning("SoftSeguros Import poliza error", [
                    'idx'   => $idx,
                    'error' => $e->getMessage(),
                    'poliza'=> $row['numero_poliza'] ?? null,
                ]);
            }
        }

        return [
            'created' => $created,
            'updated' => $updated,
            'skipped' => $skipped,
            'errors'  => array_slice($errors, 0, 20),
        ];
    }

    // ─── VINCULADOS ──────────────────────────────────────────────────
    // Real SoftSeguros fields: id, poliza(SS ID int), poliza_numero_poliza,
    // nombre_asegurado, apellidos_asegurado, cedula_asegurado, email, celular,
    // prima('...'), iva('...'), total('...'), porcentaje_iva_prima,
    // gastos_expedicion, fecha_inicio, fecha_fin, fecha_nacimiento_asegurado,
    // genero, parentesco, numero_anexo, numero_riesgo_asegurado,
    // retirado(bool), fecha_retiro, motivo_retiro, beneficiarios_riesgo[...]

    private function importVinculados(array $rows, int $brokerId): array
    {
        $created = 0;
        $skipped = 0;

        // Build poliza lookup by softseguros_id → Guro poliza_id
        $polizaMap = Poliza::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->whereNotNull('softseguros_id')
            ->pluck('id', 'softseguros_id')
            ->toArray();

        foreach ($rows as $row) {
            $softPolizaId = $row['poliza'] ?? null;
            if (!$softPolizaId) { $skipped++; continue; }

            $polizaId = $polizaMap[$softPolizaId] ?? null;
            if (!$polizaId) { $skipped++; continue; }

            $documento = trim($row['cedula_asegurado'] ?? '');
            $nombre    = trim($row['nombre_asegurado'] ?? '');
            $apellidos = trim($row['apellidos_asegurado'] ?? '');
            $nombreCompleto = trim($nombre . ' ' . $apellidos);

            // Use documento as fallback name if nombre is empty
            if (!$nombreCompleto && $documento) {
                $nombreCompleto = $documento;
            }

            $ssId = $row['id'] ?? null;

            // Check duplicate by poliza + softseguros_id (more reliable than documento)
            if ($ssId) {
                $exists = PolizaVinculado::withoutGlobalScopes()
                    ->where('broker_id', $brokerId)
                    ->where('poliza_id', $polizaId)
                    ->whereJsonContains('metadata->softseguros_id', $ssId)
                    ->exists();

                if ($exists) { $skipped++; continue; }
            } elseif ($documento) {
                $exists = PolizaVinculado::withoutGlobalScopes()
                    ->where('broker_id', $brokerId)
                    ->where('poliza_id', $polizaId)
                    ->where('documento', $documento)
                    ->exists();

                if ($exists) { $skipped++; continue; }
            }

            PolizaVinculado::withoutGlobalScopes()->create([
                'broker_id'        => $brokerId,
                'poliza_id'        => $polizaId,
                'nombre_asegurado' => $nombreCompleto ?: null,
                'documento'        => $documento ?: null,
                'identificador'    => $row['numero_riesgo_asegurado'] ?? $row['numero_anexo'] ?? null,
                'valor'            => $this->parseDecimal($row['prima'] ?? 0),
                'valor_total'      => $this->parseDecimal($row['total'] ?? 0),
                'estado'           => !empty($row['retirado']) ? 'retirado' : 'activo',
                'email'            => $row['email'] ?? null,
                'telefono'         => $row['celular'] ?? null,
                'metadata'         => [
                    'softseguros_id'   => $row['id'] ?? null,
                    'parentesco'       => $row['parentesco'] ?? null,
                    'genero'           => $row['genero'] ?? null,
                    'fecha_nacimiento' => $row['fecha_nacimiento_asegurado'] ?? null,
                    'iva'              => $row['iva'] ?? null,
                    'gastos_expedicion'=> $row['gastos_expedicion'] ?? null,
                ],
            ]);
            $created++;
        }

        return ['created' => $created, 'skipped' => $skipped];
    }

    // ─── BENEFICIARIOS ────────────────────────────────────────────────
    // Real SoftSeguros fields: id, poliza(SS ID int), nombres, numero_documento,
    // parentesco, porcentaje_beneficio, genero, fecha_nacimiento, edad,
    // riesgo_asegurado(SS vinculado ID), plan, solicitud, excluido(bool)
    // Stored in Guro as JSON array on poliza.beneficiaries

    private function importBeneficiarios(array $rows, int $brokerId): array
    {
        set_time_limit(60);
        $created = 0;
        $skipped = 0;

        // Collect SS poliza IDs from this page
        $ssPolizaIds = array_unique(array_filter(array_column($rows, 'poliza')));

        if (empty($ssPolizaIds)) {
            return ['created' => 0, 'skipped' => count($rows)];
        }

        // Only load polizas referenced in this page (not all polizas)
        $polizas = Poliza::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->whereIn('softseguros_id', $ssPolizaIds)
            ->get()
            ->keyBy('softseguros_id');

        // Group beneficiarios by poliza SS ID
        $grouped = [];
        foreach ($rows as $row) {
            $softPolizaId = $row['poliza'] ?? null;
            if (!$softPolizaId) { $skipped++; continue; }
            $grouped[$softPolizaId][] = $row;
        }

        foreach ($grouped as $softPolizaId => $beneficiarios) {
            $poliza = $polizas[$softPolizaId] ?? null;
            if (!$poliza) { $skipped += count($beneficiarios); continue; }

            $existing = $poliza->beneficiaries ?? [];
            $existingIds = array_column($existing, 'softseguros_id');
            $existingDocs = array_column($existing, 'documento');

            $newBeneficiarios = [];
            foreach ($beneficiarios as $b) {
                $doc = trim($b['numero_documento'] ?? '');
                $nombre = trim($b['nombres'] ?? '');
                $ssId = $b['id'] ?? null;

                // Skip if already exists by softseguros_id or documento
                if ($ssId && in_array($ssId, $existingIds)) { $skipped++; continue; }
                if ($doc && in_array($doc, $existingDocs)) { $skipped++; continue; }

                $newBeneficiarios[] = [
                    'nombre'     => $nombre ?: $doc ?: 'Sin nombre',
                    'documento'  => $doc,
                    'parentesco' => $b['parentesco'] ?? null,
                    'porcentaje' => $b['porcentaje_beneficio'] ?? null,
                    'genero'     => $b['genero'] ?? null,
                    'edad'       => $b['edad'] ?? null,
                    'softseguros_id' => $ssId,
                ];
                $created++;
            }

            if (!empty($newBeneficiarios)) {
                $poliza->update([
                    'beneficiaries' => array_merge($existing, $newBeneficiarios),
                ]);
            }
        }

        return ['created' => $created, 'skipped' => $skipped];
    }

    // ─── SINIESTROS ─────────────────────────────────────────────────
    // Real SoftSeguros fields: id, poliza(SS ID int), poliza_numero_poliza,
    // numero_siniestro, numero_siniestro_compania, descripcion, observacion,
    // monto_reclamo('...'), valor_indemnizacion('...'), deducible('...'),
    // estado_nombre('Abierto'/'En Trámite'/'Cerrado'/...), estado_color,
    // fecha_aviso, fecha_creacion, fecha_finalizacion, fecha_notificacion_aseguradora,
    // nombre_asegurado, documento_asegurado, nombre, amparo_afectado,
    // aseguradora(SS ID), ramo_nombre, ramo_aseguradora_nombre,
    // sede_nombre, resolucion, finalizado(bool)

    private function importSiniestros(array $rows, int $brokerId): array
    {
        $created = 0;
        $skipped = 0;
        $errors  = [];

        // Build poliza lookup by softseguros_id → Guro poliza_id
        $polizaMap = Poliza::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->whereNotNull('softseguros_id')
            ->pluck('id', 'softseguros_id')
            ->toArray();

        // Fallback lookup by policy number
        $polizaByNumber = Poliza::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->pluck('id', 'policy_number')
            ->toArray();

        foreach ($rows as $idx => $row) {
            try {
                $numeroSiniestro = trim($row['numero_siniestro'] ?? '');
                if (!$numeroSiniestro) { $skipped++; continue; }

                // Check duplicate
                $exists = Siniestro::withoutGlobalScopes()
                    ->where('broker_id', $brokerId)
                    ->where('numero_siniestro', $numeroSiniestro)
                    ->exists();

                if ($exists) { $skipped++; continue; }

                // Resolve poliza (SoftSeguros sends poliza as SS ID)
                $softPolizaId = $row['poliza'] ?? null;
                $polizaId = $softPolizaId ? ($polizaMap[$softPolizaId] ?? null) : null;

                // Fallback by policy number
                $numPoliza = trim($row['poliza_numero_poliza'] ?? '');
                if (!$polizaId && $numPoliza) {
                    $polizaId = $polizaByNumber[$numPoliza] ?? null;
                }

                // Hierarchical validation: skip if poliza was not imported into Guro
                if (!$polizaId) { $skipped++; continue; }

                // Resolve cliente_id from the poliza, or by document
                $clienteId = null;
                if ($polizaId) {
                    $clienteId = Poliza::withoutGlobalScopes()->where('id', $polizaId)->value('client_id');
                }
                if (!$clienteId) {
                    // Try by asegurado document
                    $docAsegurado = trim($row['documento_asegurado'] ?? '');
                    if ($docAsegurado) {
                        $clienteId = Cliente::withoutGlobalScopes()
                            ->where('broker_id', $brokerId)
                            ->where('document_number', $docAsegurado)
                            ->value('id');
                    }
                }

                // Map status (SoftSeguros sends estado_nombre)
                $estadoSoft = strtolower(trim($row['estado_nombre'] ?? 'reportado'));
                $statusMap = [
                    'abierto' => 'reportado', 'en proceso' => 'en_revision',
                    'en trámite' => 'en_revision', 'en tramite' => 'en_revision',
                    'cerrado' => 'cerrado', 'pagado' => 'pagado', 'rechazado' => 'rechazado',
                    'desistido' => 'cerrado', 'reportado' => 'reportado',
                    'finalizado' => 'cerrado',
                ];
                $status = $statusMap[$estadoSoft] ?? 'reportado';

                // Build observaciones array from observacion field
                $observaciones = null;
                $obsText = $row['observacion'] ?? $row['descripcion'] ?? null;
                if ($obsText && is_string($obsText)) {
                    $observaciones = [['contenido' => $obsText, 'fecha' => now()->toISOString()]];
                }

                $fechaOcurrencia = $this->parseDate($row['fecha_aviso'] ?? null);
                $descripcion = $row['descripcion'] ?? $row['observacion'] ?? '';

                Siniestro::withoutGlobalScopes()->create([
                    'broker_id'          => $brokerId,
                    'cliente_id'         => $clienteId ?: null,
                    'numero_siniestro'   => $numeroSiniestro,
                    'numero_poliza'      => $numPoliza ?: '0',
                    'poliza_id'          => $polizaId,
                    // Dates
                    'fecha_ocurrencia'   => $fechaOcurrencia ?? now(),
                    'fecha_aviso'        => $fechaOcurrencia,
                    'fecha_reporte'      => $fechaOcurrencia ?? now(),
                    // Amounts
                    'monto_reclamado'    => $this->parseDecimal($row['monto_reclamo'] ?? 0),
                    'monto_pagado'       => $this->parseDecimal($row['valor_indemnizacion'] ?? 0),
                    // Status
                    'estado'             => $status,
                    // Required text fields (NOT NULL without defaults)
                    'descripcion_evento' => $descripcion ?: 'Importado desde SoftSeguros',
                    'descripcion_hechos' => $descripcion ?: null,
                    'lugar_ocurrencia'   => '',
                    'ciudad_ocurrencia'  => '',
                    'departamento_ocurrencia' => '',
                    'aseguradora'        => $row['ramo_aseguradora_nombre'] ?? '',
                    // Required type fields
                    'tipo_seguro'        => $this->mapTipoSeguro($row['ramo_nombre'] ?? $row['ramo_global_nombre'] ?? ''),
                    'tipo_siniestro'     => 'otro',
                    // Observaciones
                    'observaciones'      => $observaciones,
                    'custom_fields'      => [
                        'softseguros_id'            => $row['id'] ?? null,
                        'numero_siniestro_compania' => $row['numero_siniestro_compania'] ?? null,
                        'nombre_asegurado'          => $row['nombre_asegurado'] ?? null,
                        'documento_asegurado'       => $row['documento_asegurado'] ?? null,
                        'amparo_afectado'           => $row['amparo_afectado'] ?? null,
                        'deducible'                 => $row['deducible'] ?? null,
                        'resolucion'                => $row['resolucion'] ?? null,
                        'imported_from'             => 'softseguros',
                    ],
                ]);
                $created++;
            } catch (\Exception $e) {
                $sinNum = $row['numero_siniestro'] ?? '?';
                $errors[] = "Siniestro #{$idx} ({$sinNum}): " . $e->getMessage();
                Log::warning("SoftSeguros Import siniestro error", [
                    'idx'   => $idx,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return ['created' => $created, 'skipped' => $skipped, 'errors' => array_slice($errors, 0, 20)];
    }

    // ─── ANEXOS DE POLIZAS (Endorsements) ─────────────────────────────
    // SS fields: id, poliza(SS ID string), numero_anexo_poliza, numero_poliza,
    // riesgo_asegurado, fecha_inicio, fecha_fin, renovable, prima, comicion,
    // total, observaciones, nombre_estado_anexo, nombre_aseguradora, nombre_ramo,
    // numero_documento, nombres, apellidos, sobrecomision, comision_total,
    // created_at, ajuste_poliza, tipo_moneda, tasa_cambio

    private function importAnexosPolizas(array $rows, int $brokerId): array
    {
        $created = 0;
        $skipped = 0;
        $errors = [];

        // Build poliza lookup by softseguros_id → Guro poliza_id
        $polizaMap = Poliza::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->whereNotNull('softseguros_id')
            ->pluck('id', 'softseguros_id')
            ->toArray();

        // Also by policy_number for fallback
        $polizaByNumber = Poliza::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->pluck('id', 'policy_number')
            ->toArray();

        foreach ($rows as $idx => $row) {
            try {
                $ssAnexoId = $row['id'] ?? null;
                $anexoNumber = trim($row['numero_anexo_poliza'] ?? '');
                if (!$anexoNumber) { $skipped++; continue; }

                // Resolve poliza
                $ssPolizaId = $row['poliza'] ?? null;
                $polizaId = $ssPolizaId ? ($polizaMap[$ssPolizaId] ?? null) : null;

                // Fallback: try matching by policy number (the part before the dash)
                if (!$polizaId) {
                    $numPoliza = trim($row['numero_poliza'] ?? '');
                    if ($numPoliza) {
                        $polizaId = $polizaByNumber[$numPoliza] ?? null;
                    }
                }

                // Hierarchical validation: skip if poliza not imported
                if (!$polizaId) { $skipped++; continue; }

                // Check duplicate by poliza_id + anexo_number
                $exists = Anexo::withoutGlobalScopes()
                    ->where('broker_id', $brokerId)
                    ->where('poliza_id', $polizaId)
                    ->where('anexo_number', $anexoNumber)
                    ->exists();

                if ($exists) { $skipped++; continue; }

                // Map estado to DB enum: ACTIVA, VENCIDA, CANCELADA, SUSPENDIDA, PENDIENTE
                $estadoAnexo = strtolower(trim($row['nombre_estado_anexo'] ?? ''));
                $statusMap = [
                    'vigente' => 'ACTIVA', 'activo' => 'ACTIVA', 'activa' => 'ACTIVA',
                    'cancelado' => 'CANCELADA', 'cancelada' => 'CANCELADA',
                    'vencido' => 'VENCIDA', 'vencida' => 'VENCIDA',
                    'anulado' => 'CANCELADA', 'anulada' => 'CANCELADA',
                    'suspendido' => 'SUSPENDIDA', 'suspendida' => 'SUSPENDIDA',
                    'pendiente' => 'PENDIENTE',
                ];
                $status = $statusMap[$estadoAnexo] ?? 'ACTIVA';

                Anexo::withoutGlobalScopes()->create([
                    'broker_id'             => $brokerId,
                    'poliza_id'             => $polizaId,
                    'anexo_number'          => $anexoNumber,
                    'insurance_company'     => $row['nombre_aseguradora'] ?? null,
                    'branch'                => $row['nombre_ramo'] ?? null,
                    'risk'                  => $row['riesgo_asegurado'] ?? null,
                    'start_date'            => $this->parseDate($row['fecha_inicio'] ?? null),
                    'end_date'              => $this->parseDate($row['fecha_fin'] ?? null),
                    'issue_date'            => $this->parseDate($row['created_at'] ?? null),
                    'renewable'             => !empty($row['renovable']),
                    'prima_neta'            => $this->parseDecimal($row['prima'] ?? 0),
                    'commission_amount'     => $this->parseDecimal($row['comicion'] ?? 0),
                    'total_amount'          => $this->parseDecimal($row['total'] ?? 0),
                    'observaciones'         => $row['observaciones'] ?? null,
                    'status'                => $status,
                ]);
                $created++;
            } catch (\Throwable $e) {
                $errors[] = "Anexo #{$idx}: " . $e->getMessage();
                Log::warning("SoftSeguros Import anexo_poliza error", ['idx' => $idx, 'error' => $e->getMessage()]);
            }
        }

        return ['created' => $created, 'skipped' => $skipped, 'errors' => array_slice($errors, 0, 20)];
    }

    // ─── RECIBOS (SS pagopoliza — anticipos y recibos de caja) ──────────

    private function importRecibos(array $rows, int $brokerId): array
    {
        $created = 0;
        $skipped = 0;
        $errors = [];

        // Build lookups
        $polizaMap = Poliza::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->whereNotNull('softseguros_id')
            ->pluck('id', 'softseguros_id')
            ->toArray();

        $clientesByDoc = Cliente::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->pluck('id', 'document_number')
            ->toArray();

        foreach ($rows as $idx => $row) {
            try {
                $ssId = $row['id'] ?? null;
                if (!$ssId) { $skipped++; continue; }

                // Check duplicate by softseguros_id
                $exists = ReciboCaja::withoutGlobalScopes()
                    ->where('broker_id', $brokerId)
                    ->where('softseguros_id', $ssId)
                    ->exists();
                if ($exists) { $skipped++; continue; }

                // Resolve poliza & cliente
                $ssPolizaId = $row['poliza'] ?? null;
                $guroPolizaId = $ssPolizaId ? ($polizaMap[$ssPolizaId] ?? null) : null;
                $clienteDoc = trim($row['cliente_numero_documento'] ?? '');
                $guroClienteId = $clienteDoc ? ($clientesByDoc[$clienteDoc] ?? null) : null;

                // Determine tipo
                $esAnticipo = !empty($row['es_anticipo']);
                $tipo = $esAnticipo ? 'anticipo' : 'recibo';

                // Tipo recaudo
                $tipoRecaudoSs = strtolower(trim($row['tipo_recaudo'] ?? 'oficina'));
                $tipoRecaudo = str_contains($tipoRecaudoSs, 'aseguradora') ? 'aseguradora' : 'oficina';

                ReciboCaja::withoutGlobalScopes()->create([
                    'broker_id'                     => $brokerId,
                    'poliza_id'                     => $guroPolizaId,
                    'cliente_id'                    => $guroClienteId,
                    'numero_recibo'                 => $row['numero_recivo'] ?? null,
                    'numero_planilla'               => $row['numero_planilla'] ?? null,
                    'numero_transaccion'            => $row['numero_transaccion'] ?? null,
                    'numero_pago'                   => $row['numero_pago'] ?? null,
                    'numero_factura'                => $row['numero_factura'] ?? null,
                    'codigo_radicacion'             => $row['codigo_radicacion'] ?? null,
                    'tipo'                          => $tipo,
                    'tipo_recaudo'                  => $tipoRecaudo,
                    'forma_pago'                    => $row['forma_pago'] ?? null,
                    'forma_pago_aseguradora'        => $row['forma_pago_aseguradora'] ?? null,
                    'moneda'                        => $row['anticipo_tipo_moneda'] ?? 'COP',
                    'fecha_pago'                    => $this->parseDate($row['fecha_pago'] ?? null),
                    'fecha_realizara_pago'          => $this->parseDate($row['fecha_realizara_pago'] ?? null),
                    'fecha_realizo_pago'            => $this->parseDate($row['fecha_realizo_pago'] ?? null),
                    'fecha_realizo_pago_oficina'    => $this->parseDate($row['fecha_realizo_pago_oficina'] ?? null),
                    'fecha_recibio_comision'        => $this->parseDate($row['fecha_recibio_comision'] ?? null),
                    'valor_a_pagar'                 => $this->parseDecimal($row['valor_a_pagar'] ?? null),
                    'valor_pagado'                  => $this->parseDecimal($row['valor_pagado'] ?? null),
                    'valor_neto_a_pagar'            => $this->parseDecimal($row['valor_neto_a_pagar'] ?? 0),
                    'valor_recaudado_en_oficina'    => $this->parseDecimal($row['valor_recaudado_en_oficina'] ?? 0),
                    'saldo_pendiente'               => $this->parseDecimal($row['saldo_pendiente'] ?? null),
                    'saldo_pendiente_oficina'       => $this->parseDecimal($row['saldo_pendiente_oficina'] ?? 0),
                    'saldo_pendiente_aseguradora'   => $this->parseDecimal($row['saldo_pendiente_aseguradora'] ?? 0),
                    'comision_a_recibir'            => $this->parseDecimal($row['comision_a_recibir'] ?? null),
                    'comision_total_a_recibir'      => $this->parseDecimal($row['comision_total_a_recibir'] ?? null),
                    'sobrecomision_a_recibir'       => $this->parseDecimal($row['sobrecomision_a_recibir'] ?? null),
                    'comision_recibida'             => $this->parseDecimal($row['comision_recibida'] ?? null),
                    'comision_vendedor'             => $this->parseDecimal($row['comision_vendedor'] ?? null),
                    'comision_final_agencia'        => $this->parseDecimal($row['comision_final_agencia'] ?? null),
                    'comision_tecnico'              => $this->parseDecimal($row['comision_tecnico'] ?? null),
                    'comision_sede'                 => $this->parseDecimal($row['comision_sede'] ?? null),
                    'iva_comision_vendedor'         => $this->parseDecimal($row['iva_comision_vendedor'] ?? null),
                    'pagada_vendedor'               => !empty($row['pagada_vendedor']),
                    'pagada_tecnico'                => !empty($row['pagada_tecnico']),
                    'pagada_sede'                   => !empty($row['pagada_sede']),
                    'fecha_pagada_vendedor'         => $this->parseDate($row['fecha_pagada_vendedor'] ?? null),
                    'fecha_pagada_tecnico'          => $this->parseDate($row['fecha_pagada_tecnico'] ?? null),
                    'fecha_pagada_sede'             => $this->parseDate($row['fecha_pagada_sede'] ?? null),
                    'recaudado_en_oficina'          => !empty($row['recaudado_en_oficina']),
                    'recaudado'                     => !empty($row['recaudado']),
                    'comisionada'                   => !empty($row['comicionada']),
                    'es_anticipo'                   => $esAnticipo,
                    'recibo_pago_directo'           => !empty($row['recibo_pago_directo']),
                    'recaudo_parcial_oficina'       => !empty($row['recaudo_parcial_oficina']),
                    'activo'                        => $row['activo'] ?? true,
                    'recibo_anulado'                => !empty($row['recibo_anulado']),
                    'fecha_recibo_anulado'          => $row['fecha_recibo_anulado'] ?? null,
                    'usuario_anulo_recibo'          => $row['nombre_usuario_anula'] ?? null,
                    'observaciones'                 => $row['observaciones'] ?? null,
                    // Denormalized display fields
                    'cliente_nombre'                => trim(($row['cliente_nombres'] ?? '') . ' ' . ($row['cliente_apellidos'] ?? '')) ?: null,
                    'cliente_documento'             => $row['cliente_numero_documento'] ?? null,
                    'vendedor_nombre'               => $row['vendedores_nombre'] ?? null,
                    'porcentaje_comision_poliza'    => $this->parseDecimal($row['poliza_porcentaje_comision'] ?? null),
                    'porcentaje_comision_vendedor'  => $this->parseDecimal($row['porcentaje_comision_vendedor'] ?? null),
                    'prima_neta_poliza'             => $this->parseDecimal($row['prima_neta_poliza'] ?? null),
                    'prima_total_poliza'            => $this->parseDecimal($row['prima_total_poliza'] ?? null),
                    'softseguros_id'                => $ssId,
                    'softseguros_recaudo_id'        => $row['recaudo'] ?? null,
                    'source'                        => 'softseguros',
                ]);
                $created++;
            } catch (\Throwable $e) {
                $errors[] = "Recibo #{$idx}: " . $e->getMessage();
                Log::warning("SoftSeguros Import recibo error", ['idx' => $idx, 'error' => $e->getMessage()]);
            }
        }

        return ['created' => $created, 'skipped' => $skipped, 'errors' => array_slice($errors, 0, 20)];
    }

    // ─── RECAUDOS (SS recaudopagopoliza — recaudos aplicados a pólizas) ──

    private function importRecaudos(array $rows, int $brokerId, string $subtype = 'activos'): array
    {
        $created = 0;
        $skipped = 0;
        $errors = [];

        // Build lookups
        $polizaMap = Poliza::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->whereNotNull('softseguros_id')
            ->pluck('id', 'softseguros_id')
            ->toArray();

        $clientesByDoc = Cliente::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->pluck('id', 'document_number')
            ->toArray();

        foreach ($rows as $idx => $row) {
            try {
                $ssId = $row['id'] ?? null;
                if (!$ssId) { $skipped++; continue; }

                // Check duplicate
                $exists = ReciboCaja::withoutGlobalScopes()
                    ->where('broker_id', $brokerId)
                    ->where('softseguros_recaudo_id', $ssId)
                    ->exists();
                if ($exists) { $skipped++; continue; }

                // Resolve poliza & cliente
                $ssPolizaId = $row['poliza'] ?? null;
                $guroPolizaId = $ssPolizaId ? ($polizaMap[$ssPolizaId] ?? null) : null;
                $clienteDoc = trim($row['cliente_numero_documento'] ?? '');
                $guroClienteId = $clienteDoc ? ($clientesByDoc[$clienteDoc] ?? null) : null;

                $tipoRecaudoSs = strtolower(trim($row['recaudo_tipo_recaudo'] ?? 'oficina'));
                $tipoRecaudo = str_contains($tipoRecaudoSs, 'aseguradora') ? 'aseguradora'
                    : (str_contains($tipoRecaudoSs, 'directo') ? 'directo' : 'oficina');

                // Determine flags based on subtype and API data
                $esDirecto = $subtype === 'directos' || !empty($row['recaudo_directo']);
                $esAnulado = $subtype === 'anulados' || !empty($row['recaudo_recibo_anulado']);

                ReciboCaja::withoutGlobalScopes()->create([
                    'broker_id'                     => $brokerId,
                    'poliza_id'                     => $guroPolizaId,
                    'cliente_id'                    => $guroClienteId,
                    'numero_recibo'                 => $row['recaudo_numero_recibo'] ?? null,
                    'numero_pago'                   => $row['pago_numero_pago'] ?? null,
                    'pago_poliza_consecutivo'       => $row['pago_poliza_consecutivo'] ?? null,
                    'tipo'                          => 'recibo',
                    'tipo_recaudo'                  => $tipoRecaudo,
                    'recaudo_directo'               => $esDirecto,
                    'forma_pago'                    => $row['recaudo_medio_de_pago'] ?? null,
                    'moneda'                        => $row['moneda'] ?? 'COP',
                    'fecha_realizo_pago_oficina'    => $this->parseDate($row['recaudo_fecha'] ?? null),
                    'valor_recaudado_en_oficina'    => $this->parseDecimal($row['valor'] ?? 0),
                    'saldo_pendiente'               => $this->parseDecimal($row['saldo_pendiente'] ?? 0),
                    'recaudado_en_oficina'          => !empty($row['recaudo_tipo_recaudo']) && strtolower($row['recaudo_tipo_recaudo']) === 'oficina',
                    'recibo_pago_directo'           => $esDirecto,
                    'recibo_anulado'                => $esAnulado,
                    'fecha_recibo_anulado'          => $row['recaudo_fecha_recibo_anulado'] ?? null,
                    'usuario_anulo_recibo'          => $row['recaudo_usuario_anula'] ?? null,
                    'activo'                        => $row['activo'] ?? true,
                    'observaciones'                 => $row['pago_observaciones'] ?? null,
                    // Denormalized display fields
                    'poliza_numero'                 => $row['poliza_numero_poliza'] ?? null,
                    'poliza_objeto_asegurado'       => $row['poliza_objeto_asegurado'] ?? null,
                    'cliente_nombre'                => $row['cliente_nombre_completo'] ?? null,
                    'cliente_documento'             => $row['cliente_numero_documento'] ?? null,
                    'aseguradora_nombre'            => $row['aseguradora_nombre'] ?? null,
                    'ramo_nombre'                   => $row['ramo_nombre'] ?? null,
                    'sede_nombre'                   => $row['sede_nombre'] ?? null,
                    'usuario_recauda'               => $row['usuario_recauda'] ?? null,
                    'softseguros_recaudo_id'        => $ssId,
                    'softseguros_pago_poliza_id'    => $row['pago_poliza'] ?? null,
                    'source'                        => 'softseguros',
                    'metadata'                      => [
                        'ss_recaudo_id' => $row['recaudo'] ?? null,
                        'ss_subtype' => $subtype,
                    ],
                ]);
                $created++;
            } catch (\Throwable $e) {
                $errors[] = "Recaudo #{$idx}: " . $e->getMessage();
                Log::warning("SoftSeguros Import recaudo error", ['idx' => $idx, 'error' => $e->getMessage()]);
            }
        }

        return ['created' => $created, 'skipped' => $skipped, 'errors' => array_slice($errors, 0, 20)];
    }

    // ─── ARCHIVOS (Fase 1: save Azure URL as metadata, Fase 2: artisan copies to Firebase) ──

    private function importArchivos(array $rows, int $brokerId, string $token, int $ssUserId = 0): array
    {
        $created = 0;
        $skipped = 0;
        $errors = [];

        // Build lookups: SS poliza ID → Guro poliza ID
        $polizaBySsId = Poliza::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->whereNotNull('softseguros_id')
            ->pluck('id', 'softseguros_id')
            ->toArray();

        // SS cliente doc → Guro cliente ID
        $clientesByDoc = Cliente::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->pluck('id', 'document_number')
            ->toArray();

        // Map SS tipo_anexo to Guro document types
        $typeMap = [
            'póliza' => 'caratula', 'poliza' => 'caratula',
            'factura' => 'factura', 'recibo' => 'recibo',
            'certificado' => 'certificado', 'anexo' => 'anexo',
            'cédula' => 'documento_identidad', 'cedula' => 'documento_identidad',
            'copia de cédula' => 'documento_identidad', 'copia de cedula' => 'documento_identidad',
            'rut' => 'rut', 'cotización' => 'cotizacion', 'cotizacion' => 'cotizacion',
            'sarlaft' => 'sarlaft',
        ];

        $mimeMap = [
            'pdf' => 'application/pdf', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg',
            'png' => 'image/png', 'gif' => 'image/gif', 'doc' => 'application/msword',
            'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls' => 'application/vnd.ms-excel',
            'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];

        // Batch: collect doc entries per entity to minimize DB reads/writes
        $polizaDocs = [];   // guroPolizaId => [docEntry, ...]
        $clienteDocs = [];  // guroClienteId => [docEntry, ...]

        foreach ($rows as $idx => $row) {
            try {
                $ssAnexoId = $row['id'] ?? null;
                $azureUrl = $row['archivo_azure'] ?? null;
                $fileName = trim($row['nombre'] ?? 'archivo');
                $extension = strtolower($row['extension'] ?? '');
                $size = (int) ($row['size'] ?? 0);

                // Skip if no file URL or inactive
                if (!$azureUrl) { $skipped++; continue; }
                if (isset($row['activo']) && !$row['activo']) { $skipped++; continue; }

                // Determine target entity
                $ssPolizaId = $row['poliza'] ?? null;
                $ssClienteDoc = $row['poliza_cliente_numero_documento'] ?? null;

                $guroPolizaId = $ssPolizaId ? ($polizaBySsId[$ssPolizaId] ?? null) : null;
                $guroClienteId = $ssClienteDoc ? ($clientesByDoc[$ssClienteDoc] ?? null) : null;

                // Must belong to at least one imported entity
                if (!$guroPolizaId && !$guroClienteId) {
                    $skipped++;
                    continue;
                }

                // Build safe filename
                $safeName = preg_replace('/[^A-Za-z0-9._-]/', '_', $fileName);
                if ($extension && !str_ends_with(strtolower($safeName), '.' . $extension)) {
                    $safeName .= '.' . $extension;
                }

                // Future Firebase path (for when artisan copies the file)
                if ($guroPolizaId) {
                    $fbPath = "brokers/{$brokerId}/polizas/{$guroPolizaId}/{$safeName}";
                } else {
                    $fbPath = "brokers/{$brokerId}/clientes/{$guroClienteId}/{$safeName}";
                }

                $tipoAnexo = strtolower(trim($row['tipo_anexo_nombre'] ?? 'otro'));
                $docType = $typeMap[$tipoAnexo] ?? 'otro';
                $mime = $mimeMap[$extension] ?? 'application/octet-stream';

                // Build SS download URL: /download/{anexo_id}/{user_id}/?session={token}
                $ssDownloadUrl = $ssAnexoId && $ssUserId
                    ? "{$this->ssBaseUrl}/download/{$ssAnexoId}/{$ssUserId}/?session={$token}"
                    : null;

                $docEntry = [
                    'name' => $safeName,
                    'path' => $fbPath,
                    'size' => $size,
                    'contentType' => $mime,
                    'url' => $ssDownloadUrl ?: $azureUrl, // Prefer SS download URL
                    'azure_url' => $azureUrl,
                    'ss_download_url' => $ssDownloadUrl,
                    'softseguros_anexo_id' => $ssAnexoId,
                    'uploaded_at' => $row['created_at'] ?? now()->toISOString(),
                    'type' => $docType,
                    'source' => 'softseguros', // Flag for Phase 2 artisan to find & copy
                ];

                // Collect per entity
                if ($guroPolizaId) {
                    $polizaDocs[$guroPolizaId][] = $docEntry;
                } else {
                    $clienteDocs[$guroClienteId][] = $docEntry;
                }

                $created++;
            } catch (\Throwable $e) {
                $aName = $row['nombre'] ?? '?';
                $errors[] = "Archivo #{$idx} ({$aName}): " . $e->getMessage();
                Log::warning("SoftSeguros Import archivo error", ['idx' => $idx, 'error' => $e->getMessage()]);
            }
        }

        // Batch-save to DB (one read+write per entity instead of per file)
        // Also updates existing docs that are missing ss_download_url
        foreach ($polizaDocs as $polizaId => $newDocs) {
            try {
                $poliza = Poliza::withoutGlobalScopes()->find($polizaId);
                if (!$poliza) continue;
                $existing = is_array($poliza->documents) ? $poliza->documents : [];
                $existingById = [];
                foreach ($existing as $i => $d) {
                    if (!empty($d['softseguros_anexo_id'])) $existingById[$d['softseguros_anexo_id']] = $i;
                }
                $toAdd = [];
                $updated = false;
                foreach ($newDocs as $nd) {
                    $ssId = $nd['softseguros_anexo_id'] ?? null;
                    if ($ssId && isset($existingById[$ssId])) {
                        // Update existing doc if it's missing ss_download_url
                        $idx = $existingById[$ssId];
                        if (empty($existing[$idx]['ss_download_url']) && !empty($nd['ss_download_url'])) {
                            $existing[$idx]['ss_download_url'] = $nd['ss_download_url'];
                            $existing[$idx]['url'] = $nd['url'];
                            $updated = true;
                        }
                        $skipped++; $created--;
                    } else {
                        $toAdd[] = $nd;
                    }
                }
                if (!empty($toAdd) || $updated) {
                    $poliza->documents = array_values(array_merge($existing, $toAdd));
                    $poliza->save();
                } elseif (empty($toAdd)) {
                    // All were duplicates, already counted above
                }
            } catch (\Throwable $e) {
                $errors[] = "Poliza #{$polizaId} batch save: " . $e->getMessage();
            }
        }

        foreach ($clienteDocs as $clienteId => $newDocs) {
            try {
                $cliente = Cliente::withoutGlobalScopes()->find($clienteId);
                if (!$cliente) continue;
                $existing = is_array($cliente->documents) ? $cliente->documents : [];
                $existingById = [];
                foreach ($existing as $i => $d) {
                    if (!empty($d['softseguros_anexo_id'])) $existingById[$d['softseguros_anexo_id']] = $i;
                }
                $toAdd = [];
                $updated = false;
                foreach ($newDocs as $nd) {
                    $ssId = $nd['softseguros_anexo_id'] ?? null;
                    if ($ssId && isset($existingById[$ssId])) {
                        $idx = $existingById[$ssId];
                        if (empty($existing[$idx]['ss_download_url']) && !empty($nd['ss_download_url'])) {
                            $existing[$idx]['ss_download_url'] = $nd['ss_download_url'];
                            $existing[$idx]['url'] = $nd['url'];
                            $updated = true;
                        }
                        $skipped++; $created--;
                    } else {
                        $toAdd[] = $nd;
                    }
                }
                if (!empty($toAdd) || $updated) {
                    $cliente->documents = array_values(array_merge($existing, $toAdd));
                    $cliente->save();
                }
            } catch (\Throwable $e) {
                $errors[] = "Cliente #{$clienteId} batch save: " . $e->getMessage();
            }
        }

        return ['created' => $created, 'skipped' => $skipped, 'errors' => array_slice($errors, 0, 20)];
    }

    // ─── HELPERS ────────────────────────────────────────────────────

    private function parseDate(?string $value): ?string
    {
        if (!$value || $value === 'null' || $value === '') return null;
        $ts = strtotime($value);
        return $ts ? date('Y-m-d', $ts) : null;
    }

    private function parseDecimal($value): float
    {
        if ($value === null || $value === '' || $value === 'null') return 0;
        // Remove thousands separators and convert comma decimals
        $cleaned = str_replace([' ', ','], ['', '.'], (string) $value);
        return round((float) $cleaned, 2);
    }

    private function mapPaymentMethod(?string $method): ?string
    {
        if (!$method) return null;
        $lower = strtolower(trim($method));
        $map = [
            'tarjeta de credito' => 'card', 'tarjeta de crédito' => 'card', 'tarjeta' => 'card',
            'efectivo' => 'cash', 'contado' => 'cash',
            'transferencia' => 'transfer', 'consignación' => 'transfer', 'consignacion' => 'transfer',
            'debito' => 'transfer', 'débito' => 'transfer',
            'cheque' => 'check',
            'financiado' => 'financing', 'financiación' => 'financing',
        ];
        return $map[$lower] ?? 'cash';
    }

    private function mapPaymentFrequency(?string $freq): ?string
    {
        if (!$freq) return 'annual';
        $lower = strtolower(trim($freq));
        // DB enum: monthly, quarterly, biannual, annual
        $map = [
            'mensual' => 'monthly', 'bimestral' => 'monthly', 'trimestral' => 'quarterly',
            'semestral' => 'biannual', 'anual' => 'annual', 'único' => 'annual', 'unico' => 'annual',
            'contado' => 'annual',
        ];
        return $map[$lower] ?? 'annual';
    }

    private function parseFormaPagoTexto($value): ?array
    {
        if (!$value || $value === 'null') return null;
        if (is_array($value)) return $value;
        if (is_string($value)) {
            $decoded = json_decode($value, true);
            return is_array($decoded) ? $decoded : null;
        }
        return null;
    }

    /**
     * Map SoftSeguros ramo_nombre to valid tipo_seguro enum.
     * DB enum: auto, hogar, vida, salud, empresarial, responsabilidad_civil, transporte, construccion, agropecuario, fianza
     */
    private function mapTipoSeguro(?string $ramo): string
    {
        if (!$ramo) return 'empresarial';
        $lower = strtolower(trim($ramo));

        // Direct keyword matching
        if (str_contains($lower, 'auto') || str_contains($lower, 'soat') || str_contains($lower, 'vehic') || str_contains($lower, 'moto')) return 'auto';
        if (str_contains($lower, 'hogar') || str_contains($lower, 'incendio') || str_contains($lower, 'multirri')) return 'hogar';
        if (str_contains($lower, 'vida') || str_contains($lower, 'ape') || str_contains($lower, 'deudor') || str_contains($lower, 'exequi') || str_contains($lower, 'pension') || str_contains($lower, 'accidente')) return 'vida';
        if (str_contains($lower, 'salud') || str_contains($lower, 'medic') || str_contains($lower, 'arl') || str_contains($lower, 'riesgo laboral')) return 'salud';
        if (str_contains($lower, 'responsabilidad') || str_contains($lower, 'rce') || str_contains($lower, 'rc ') || $lower === 'rc') return 'responsabilidad_civil';
        if (str_contains($lower, 'transporte') || str_contains($lower, 'carga') || str_contains($lower, 'mercanc')) return 'transporte';
        if (str_contains($lower, 'construc') || str_contains($lower, 'todo riesgo construc')) return 'construccion';
        if (str_contains($lower, 'agro') || str_contains($lower, 'cosecha') || str_contains($lower, 'ganad')) return 'agropecuario';
        if (str_contains($lower, 'cumplimiento') || str_contains($lower, 'fianza') || str_contains($lower, 'garantía') || str_contains($lower, 'garantia')) return 'fianza';
        if (str_contains($lower, 'pyme') || str_contains($lower, 'empresa') || str_contains($lower, 'copropied') || str_contains($lower, 'particular')) return 'empresarial';

        return 'empresarial';
    }

    private function mapMedioPago(?string $medio): ?string
    {
        if (!$medio) return null;
        $lower = strtolower(trim($medio));
        $map = [
            'efectivo' => 'efectivo', 'tarjeta de crédito' => 'tarjeta_credito',
            'tarjeta de credito' => 'tarjeta_credito', 'débito automático' => 'debito_automatico',
            'debito automatico' => 'debito_automatico', 'transferencia' => 'transferencia',
            'consignación' => 'consignacion', 'consignacion' => 'consignacion',
            'cheque' => 'cheque', 'pagaré' => 'pagare', 'pagare' => 'pagare',
        ];
        return $map[$lower] ?? $medio;
    }
}
