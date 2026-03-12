<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SoftSegurosBackupController extends Controller
{
    private string $baseUrl = 'https://app.softseguros.com';

    /**
     * Autenticar en Softseguros y devolver token + info de marca
     */
    public function authenticate(Request $request)
    {
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        try {
            $response = Http::timeout(15)->post("{$this->baseUrl}/api-token-auth/", [
                'username' => $request->username,
                'password' => $request->password,
            ]);

            if ($response->successful()) {
                $data = $response->json();

                // Store SS credentials on broker for future document downloads
                try {
                    $brokerId = null;
                    if ($request->has('authenticated_broker_id')) {
                        $brokerId = (int) $request->get('authenticated_broker_id');
                    } elseif ($request->user() && $request->user()->broker_id) {
                        $brokerId = (int) $request->user()->broker_id;
                    }
                    if ($brokerId) {
                        $broker = \App\Models\Broker::find($brokerId);
                        if ($broker) {
                            $settings = $broker->settings ?? [];
                            $settings['softseguros'] = [
                                'username' => encrypt($request->username),
                                'password' => encrypt($request->password),
                                'user_id' => $data['user_id'] ?? $data['id'] ?? null,
                                'token' => $data['token'] ?? null,
                                'token_at' => now()->toISOString(),
                            ];
                            $broker->settings = $settings;
                            $broker->save();
                        }
                    }
                } catch (\Throwable $e) {
                    Log::warning('[SS] Could not save credentials to broker', ['error' => $e->getMessage()]);
                }

                return response()->json([
                    'success' => true,
                    'token' => $data['token'] ?? null,
                    'user' => [
                        'id' => $data['id'] ?? null,
                        'user_id' => $data['user_id'] ?? null,
                        'nombre' => $data['nombre_completo'] ?? null,
                        'perfil' => $data['perfil_name'] ?? null,
                        'marca' => $data['nombre_marca'] ?? null,
                        'marca_nit' => $data['marca_nit'] ?? null,
                        'email' => $data['email'] ?? null,
                    ],
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Credenciales inválidas',
            ], 401);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error de conexión: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Obtener conteo total de registros (preview)
     */
    public function preview(Request $request)
    {
        $request->validate(['token' => 'required|string']);
        $token = $request->token;

        $counts = [];
        $endpoints = [
            'clientes' => '/api/cliente/list_clientes_filtro_paginados/',
            'polizas' => '/api/poliza/',
            'siniestros' => '/api/siniestro/list_paginado/',
            'contactos' => '/api/contacto/',
            'aseguradoras' => '/api/aseguradora/',
            'ramos_globales' => '/api/ramosglobales/',
            'subramos' => '/api/ramomarca/',
            'ramos' => '/api/ramo/',
            'vendedores' => '/api/vendedor/',
            'beneficiarios' => '/api/beneficiariopolizariesgo/',
            'vinculados' => '/api/riesgoasegurado/',
            'anexos' => '/api/anexopoliza/list_anexos_polizas_filtro_paginados/',
            'recibos' => '/api/pagopoliza/list_recibos_filtro_paginados/',
            'recaudos' => '/api/recaudopagopoliza/list_recaudo_filtro_paginados/',
            'recaudos_directos' => '/api/recaudopagopoliza/list_recaudo_filtro_paginados/',
            'recaudos_anulados' => '/api/recaudopagopoliza/list_recaudo_filtro_paginados/',
            'archivos_digitales' => '/api/anexo/',
            'negocios' => '/api/negocio/',
            'datos_extra' => '/api/datosextrascliente/',
        ];

        // /api/anexo/ requires extra query params to return data
        $specialParams = [
            'recibos' => [
                'sede' => -1, 'texto_busqueda' => '',
                'tipo_busqueda_recibos' => -1, 'anticipos_aplicados' => -1,
                'marca_usuario' => -1, 'tipo_recaudo' => '',
                'field_search' => 'created_at', 'tipo' => 'recibos_anticipos',
                'order_by' => 'fecha_realizo_pago_oficina', 'sort_by' => 'asc',
            ],
            'recaudos' => [
                'sede' => -1, 'texto_busqueda' => '',
                'tipo_busqueda_recibos' => -1, 'anticipos_aplicados' => -1,
                'marca_usuario' => -1, 'tipo_recaudo' => '',
                'field_search' => 'created_at', 'tipo' => 'recaudos-activos',
                'order_by' => 'recaudo__numero_recibo', 'sort_by' => 'desc',
            ],
            'recaudos_directos' => [
                'sede' => -1, 'texto_busqueda' => '',
                'tipo_busqueda_recibos' => -1, 'anticipos_aplicados' => -1,
                'marca_usuario' => -1, 'tipo_recaudo' => '',
                'field_search' => 'created_at', 'tipo' => 'recaudos-directos',
                'order_by' => 'recaudo__numero_recibo', 'sort_by' => 'desc',
            ],
            'recaudos_anulados' => [
                'sede' => -1, 'texto_busqueda' => '',
                'tipo_busqueda_recibos' => -1, 'anticipos_aplicados' => -1,
                'marca_usuario' => -1, 'tipo_recaudo' => '',
                'field_search' => 'created_at', 'tipo' => 'recaudos-anulados',
                'order_by' => 'recaudo__numero_recibo', 'sort_by' => 'desc',
            ],
            'archivos_digitales' => [
                'texto_busqueda' => '', 'sede' => -1,
                'created_at_ini' => '', 'created_at_fin' => '',
                'order_by' => 'created_at', 'sort_by' => 'desc',
                'list_all' => 'true',
            ],
        ];

        foreach ($endpoints as $key => $endpoint) {
            try {
                $params = array_merge(['page' => 1], $specialParams[$key] ?? []);
                $response = Http::timeout(10)
                    ->withHeaders(['Authorization' => "Token {$token}"])
                    ->get("{$this->baseUrl}{$endpoint}", $params);

                if ($response->successful()) {
                    $data = $response->json();
                    $counts[$key] = $data['count'] ?? (is_array($data) ? count($data) : 0);
                } else {
                    $counts[$key] = 0;
                }
            } catch (\Exception $e) {
                $counts[$key] = 0;
            }
        }

        // Catálogos sin paginación
        foreach (['categorias' => '/api/categoria/', 'estados_poliza' => '/api/estadopoliza/'] as $key => $endpoint) {
            try {
                $response = Http::timeout(10)
                    ->withHeaders(['Authorization' => "Token {$token}"])
                    ->get("{$this->baseUrl}{$endpoint}");
                if ($response->successful()) {
                    $data = $response->json();
                    $counts[$key] = is_array($data) ? count($data) : 0;
                }
            } catch (\Exception $e) {
                $counts[$key] = 0;
            }
        }

        return response()->json([
            'success' => true,
            'counts' => $counts,
            'total' => array_sum($counts),
        ]);
    }

    /**
     * Descargar una entidad completa (paginada)
     */
    public function download(Request $request)
    {
        $request->validate([
            'token' => 'required|string',
            'entity' => 'required|string',
        ]);

        $token = $request->token;
        $entity = $request->entity;

        $endpointMap = [
            'clientes' => '/api/cliente/list_clientes_filtro_paginados/',
            'polizas' => '/api/poliza/',
            'siniestros' => '/api/siniestro/list_paginado/',
            'contactos' => '/api/contacto/',
            'aseguradoras' => '/api/aseguradora/',
            'ramos_globales' => '/api/ramosglobales/',
            'subramos' => '/api/ramomarca/',
            'ramos' => '/api/ramo/',
            'vendedores' => '/api/vendedor/',
            'beneficiarios' => '/api/beneficiariopolizariesgo/',
            'vinculados' => '/api/riesgoasegurado/',
            'anexos' => '/api/anexopoliza/list_anexos_polizas_filtro_paginados/',
            'negocios' => '/api/negocio/',
            'datos_extra' => '/api/datosextrascliente/',
            // No paginados
            'categorias' => '/api/categoria/',
            'estados_poliza' => '/api/estadopoliza/',
        ];

        $nonPaginated = ['categorias', 'estados_poliza'];

        if (!isset($endpointMap[$entity])) {
            return response()->json(['success' => false, 'message' => 'Entidad no válida'], 400);
        }

        $endpoint = $endpointMap[$entity];
        $allResults = [];

        try {
            if (in_array($entity, $nonPaginated)) {
                $response = Http::timeout(30)
                    ->withHeaders(['Authorization' => "Token {$token}"])
                    ->get("{$this->baseUrl}{$endpoint}");

                if ($response->successful()) {
                    $allResults = $response->json();
                }
            } else {
                $page = 1;
                $maxPages = 5000; // Safety limit

                while ($page <= $maxPages) {
                    $response = Http::timeout(30)
                        ->withHeaders(['Authorization' => "Token {$token}"])
                        ->get("{$this->baseUrl}{$endpoint}", ['page' => $page]);

                    if (!$response->successful()) break;

                    $data = $response->json();
                    if (!isset($data['results'])) break;

                    $allResults = array_merge($allResults, $data['results']);

                    if (empty($data['next']) || $data['next'] === 'null') break;
                    $page++;

                    usleep(100000); // 100ms entre requests
                }
            }

            return response()->json([
                'success' => true,
                'entity' => $entity,
                'count' => count($allResults),
                'data' => $allResults,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error descargando ' . $entity . ': ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Descargar una entidad por páginas (streaming para grandes volúmenes)
     */
    public function downloadPage(Request $request)
    {
        $request->validate([
            'token' => 'required|string',
            'entity' => 'required|string',
            'page' => 'required|integer|min:1',
        ]);

        $token = $request->token;
        $entity = $request->entity;
        $page = $request->page;

        $endpointMap = [
            'clientes' => '/api/cliente/list_clientes_filtro_paginados/',
            'polizas' => '/api/poliza/',
            'siniestros' => '/api/siniestro/list_paginado/',
            'contactos' => '/api/contacto/',
            'aseguradoras' => '/api/aseguradora/',
            'ramos_globales' => '/api/ramosglobales/',
            'subramos' => '/api/ramomarca/',
            'ramos' => '/api/ramo/',
            'vendedores' => '/api/vendedor/',
            'beneficiarios' => '/api/beneficiariopolizariesgo/',
            'vinculados' => '/api/riesgoasegurado/',
            'anexos' => '/api/anexopoliza/list_anexos_polizas_filtro_paginados/',
            'negocios' => '/api/negocio/',
            'datos_extra' => '/api/datosextrascliente/',
        ];

        if (!isset($endpointMap[$entity])) {
            return response()->json(['success' => false, 'message' => 'Entidad no válida'], 400);
        }

        try {
            $response = Http::timeout(30)
                ->withHeaders(['Authorization' => "Token {$token}"])
                ->get("{$this->baseUrl}{$endpointMap[$entity]}", ['page' => $page]);

            if ($response->successful()) {
                $data = $response->json();
                return response()->json([
                    'success' => true,
                    'entity' => $entity,
                    'page' => $page,
                    'count' => $data['count'] ?? 0,
                    'has_next' => !empty($data['next']) && $data['next'] !== 'null',
                    'results' => $data['results'] ?? [],
                ]);
            }

            return response()->json(['success' => false, 'message' => 'Error en la petición'], $response->status());
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get document sync status: how many SS docs are in Firebase vs still pending.
     */
    public function syncStatus(Request $request)
    {
        $brokerId = $this->getBrokerId($request);
        $stats = \App\Console\Commands\CopySoftSegurosFiles::getSyncStatus($brokerId);

        // Check if broker has SS credentials
        $broker = \App\Models\Broker::find($brokerId);
        $settings = $broker->settings ?? [];
        $ss = $settings['softseguros'] ?? null;
        $hasCredentials = $ss && (!empty($ss['username']) || !empty($ss['token']));

        return response()->json([
            'success' => true,
            'data' => [
                'stats' => $stats,
                'has_credentials' => $hasCredentials,
                'last_token_at' => $ss['token_at'] ?? null,
            ],
        ]);
    }

    /**
     * Trigger sync of SS documents to Firebase (runs synchronously for a batch).
     * Accepts optional entity filter and limit.
     */
    public function syncToFirebase(Request $request)
    {
        set_time_limit(300);

        $brokerId = $this->getBrokerId($request);
        $entity = $request->input('entity', 'all');
        $limit = (int) $request->input('limit', 50);

        // Get SS auth
        $broker = \App\Models\Broker::find($brokerId);
        if (!$broker) {
            return response()->json(['success' => false, 'message' => 'Broker no encontrado'], 404);
        }
        $settings = $broker->settings ?? [];
        $ss = $settings['softseguros'] ?? null;

        if (!$ss || (empty($ss['username']) && empty($ss['token']))) {
            return response()->json([
                'success' => false,
                'message' => 'No hay credenciales de SoftSeguros. Autentícate primero.',
            ], 422);
        }

        // Authenticate with SS to get fresh token
        $ssToken = $ss['token'] ?? null;
        $ssUserId = $ss['user_id'] ?? null;

        if (!empty($ss['username']) && !empty($ss['password'])) {
            try {
                $username = decrypt($ss['username']);
                $password = decrypt($ss['password']);
                $authResp = \Illuminate\Support\Facades\Http::timeout(15)
                    ->post('https://app.softseguros.com/api-token-auth/', compact('username', 'password'));
                if ($authResp->successful()) {
                    $authData = $authResp->json();
                    $ssToken = $authData['token'] ?? $ssToken;
                    $ssUserId = $authData['user_id'] ?? $authData['id'] ?? $ssUserId;
                    $settings['softseguros']['token'] = $ssToken;
                    $settings['softseguros']['token_at'] = now()->toISOString();
                    $broker->settings = $settings;
                    $broker->save();
                }
            } catch (\Throwable $e) {
                Log::warning('[SS Sync] Auth failed', ['error' => $e->getMessage()]);
            }
        }

        if (!$ssToken || !$ssUserId) {
            return response()->json(['success' => false, 'message' => 'No se pudo obtener token de SoftSeguros.'], 422);
        }

        // Init Firebase
        try {
            $firebaseStorage = app(\Kreait\Firebase\Contract\Storage::class);
            $bucketName = env('FIREBASE_STORAGE_BUCKET') ?: config('firebase.storage_bucket');
            $projectId = config('firebase.project_id') ?: env('FIREBASE_PROJECT_ID');
            $bucket = null;
            foreach (array_filter([$bucketName, $projectId ? "{$projectId}.appspot.com" : null, $projectId ? "{$projectId}.firebasestorage.app" : null]) as $name) {
                try { $b = $firebaseStorage->getBucket($name); if ($b->exists()) { $bucket = $b; break; } } catch (\Throwable $e) {}
            }
            if (!$bucket) $bucket = $firebaseStorage->getBucket();
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => 'Firebase no disponible: ' . $e->getMessage()], 500);
        }

        // Process entities
        $entities = [];
        if (in_array($entity, ['polizas', 'all'])) $entities['polizas'] = [\App\Models\Poliza::class, 'documents'];
        if (in_array($entity, ['clientes', 'all'])) $entities['clientes'] = [\App\Models\Cliente::class, 'documents'];
        if (in_array($entity, ['siniestros', 'all'])) $entities['siniestros'] = [\App\Models\Siniestro::class, 'archivos_adjuntos'];

        $copied = 0; $failed = 0; $alreadyFb = 0; $skipped = 0;
        $log = [];

        foreach ($entities as $key => [$modelClass, $docsField]) {
            if ($limit > 0 && ($copied + $failed) >= $limit) break;

            $records = $modelClass::withoutGlobalScopes()
                ->where('broker_id', $brokerId)
                ->whereNotNull($docsField)
                ->where($docsField, 'like', '%softseguros%')
                ->get();

            foreach ($records as $record) {
                if ($limit > 0 && ($copied + $failed) >= $limit) break;

                $docs = $record->{$docsField};
                if (!is_array($docs)) continue;

                $modified = false;
                foreach ($docs as $i => $doc) {
                    if ($limit > 0 && ($copied + $failed) >= $limit) break;
                    if (is_object($doc)) $doc = (array) $doc;
                    if (($doc['source'] ?? '') !== 'softseguros') continue;

                    $fbPath = $doc['path'] ?? null;
                    if (!$fbPath) { $skipped++; continue; }

                    // Check if already in Firebase
                    try {
                        $obj = $bucket->object($fbPath);
                        if ($obj->exists()) { $alreadyFb++; continue; }
                    } catch (\Throwable $e) {}

                    $anexoId = $doc['softseguros_anexo_id'] ?? null;
                    if (!$anexoId) { $skipped++; continue; }

                    // Download from SS
                    try {
                        $dlUrl = "https://app.softseguros.com/download/{$anexoId}/{$ssUserId}/?session={$ssToken}";
                        $resp = \Illuminate\Support\Facades\Http::timeout(60)
                            ->withHeaders(['Authorization' => "Token {$ssToken}"])
                            ->get($dlUrl);

                        if (!$resp->successful()) { $failed++; continue; }

                        $body = $resp->body();
                        $ct = $resp->header('Content-Type') ?: '';
                        if (strlen($body) < 100 || str_contains($ct, 'text/html')) { $failed++; continue; }

                        // Upload to Firebase
                        $mime = $doc['contentType'] ?? $ct ?: 'application/octet-stream';
                        $bucket->upload($body, ['name' => $fbPath, 'metadata' => ['contentType' => $mime]]);

                        $docs[$i]['source'] = 'firebase';
                        $docs[$i]['synced_at'] = now()->toISOString();
                        $docs[$i]['size'] = strlen($body);
                        $modified = true;
                        $copied++;
                    } catch (\Throwable $e) {
                        $failed++;
                        Log::warning("[SS Sync] Failed {$key}/{$record->id}", ['error' => $e->getMessage()]);
                    }
                }

                if ($modified) {
                    $record->{$docsField} = array_values($docs);
                    $record->save();
                }
            }

            $log[] = "{$key}: procesado";
        }

        $stats = \App\Console\Commands\CopySoftSegurosFiles::getSyncStatus($brokerId);
        $output = "Copiados: {$copied} | Ya en Firebase: {$alreadyFb} | Fallidos: {$failed} | Omitidos: {$skipped}";

        return response()->json([
            'success' => true,
            'data' => [
                'stats' => $stats,
                'output' => $output,
                'copied' => $copied,
                'already_firebase' => $alreadyFb,
                'failed' => $failed,
                'skipped' => $skipped,
            ],
        ]);
    }

    private function getBrokerId(Request $request): int
    {
        if ($request->has('authenticated_broker_id')) {
            return (int) $request->get('authenticated_broker_id');
        }
        $user = $request->user();
        if ($user && $user->broker_id) {
            return (int) $user->broker_id;
        }
        return (int) ($request->header('X-Dev-Broker-Id') ?: 2);
    }
}
