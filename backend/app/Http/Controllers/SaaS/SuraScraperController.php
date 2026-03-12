<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\ExternalCredential;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class SuraScraperController extends Controller
{
    private const SURA_API = 'https://apiasistentevirtualasesores.sura.com';

    /**
     * Resolve broker_id (same pattern as SaasPolizasController).
     */
    private function getBrokerId(Request $request): int
    {
        if ($request->has('authenticated_broker_id')) {
            return (int) $request->get('authenticated_broker_id');
        }
        if ($request->has('broker_id')) {
            return (int) $request->get('broker_id');
        }
        $authType = $request->get('auth_type');
        if ($authType === 'empleado') {
            $emp = $request->get('authenticated_empleado');
            if ($emp && isset($emp->broker_id)) return (int) $emp->broker_id;
        }
        $user = $request->user() ?? Auth::user();
        if ($user && isset($user->broker_id) && $user->broker_id) {
            return (int) $user->broker_id;
        }
        return 1;
    }

    /**
     * GET /api/saas/sura-scraper/status
     */
    public function status(Request $request)
    {
        $brokerId = $this->getBrokerId($request);
        $cred = ExternalCredential::forBroker($brokerId)->forProvider('sura')->first();

        if (!$cred) {
            return response()->json([
                'success' => true,
                'data' => [
                    'connected' => false,
                    'username' => null,
                    'last_sync_at' => null,
                    'session_valid' => false,
                    'status' => 'disconnected',
                ],
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'connected' => true,
                'username' => $cred->username,
                'last_sync_at' => $cred->last_sync_at?->toISOString(),
                'session_valid' => $cred->hasValidSession(),
                'status' => $cred->status,
                'last_error' => $cred->last_error,
            ],
        ]);
    }

    /**
     * POST /api/saas/sura-scraper/connect
     * Accepts cookies string from the browser to authenticate with SURA API.
     */
    public function connect(Request $request)
    {
        $validated = $request->validate([
            'cookies' => 'required|string|min:20',
        ]);

        $brokerId = $this->getBrokerId($request);
        $cookieString = trim($validated['cookies']);

        try {
            // Step 1: Get identity to validate session
            $identity = $this->suraGet('/home/users/identity', $cookieString);
            if (!$identity['success']) {
                return response()->json([
                    'success' => false,
                    'message' => 'Las cookies no son válidas o la sesión expiró. Vuelve a loguearte en SURA.',
                ], 401);
            }

            $userName = $identity['data']['userName'] ?? '';
            $fullName = trim($identity['data']['fullName'] ?? 'SURA Asesor');

            // Step 2: Get agent code
            $codigoAsesor = $this->extractAgentCode($cookieString, $userName);

            // Step 3: Test fetching clientes to validate session
            $testClientes = $this->suraFetchClientes($cookieString, $codigoAsesor, 1, 1);
            $totalClientes = $testClientes['success'] ? ($testClientes['data']['totalRegistros'] ?? 0) : 0;

            // Store credentials + agent code
            $sessionPayload = json_encode([
                'cookies' => $cookieString,
                'codigoAsesor' => $codigoAsesor,
                'userName' => $userName,
            ]);

            $cred = ExternalCredential::updateOrCreate(
                ['broker_id' => $brokerId, 'provider' => 'sura'],
                [
                    'username' => $fullName ?: ('Agente ' . $codigoAsesor),
                    'password_encrypted' => Crypt::encryptString('cookie-auth'),
                    'session_data' => Crypt::encryptString($sessionPayload),
                    'session_expires_at' => Carbon::now()->addHours(8),
                    'status' => 'active',
                    'last_error' => null,
                ]
            );

            return response()->json([
                'success' => true,
                'message' => "Conectado como {$fullName}. Se encontraron {$totalClientes} clientes.",
                'data' => [
                    'connected' => true,
                    'username' => $fullName,
                    'session_valid' => true,
                    'status' => 'active',
                    'total_clientes' => $totalClientes,
                ],
            ]);

        } catch (\Exception $e) {
            Log::error('SURA Scraper: connect failed', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'message' => 'Error al conectar: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * DELETE /api/saas/sura-scraper/disconnect
     */
    public function disconnect(Request $request)
    {
        $brokerId = $this->getBrokerId($request);
        ExternalCredential::forBroker($brokerId)->forProvider('sura')->delete();

        return response()->json([
            'success' => true,
            'message' => 'Desconectado de SURA Asesores',
        ]);
    }

    /**
     * GET /api/saas/sura-scraper/polizas
     * Fetches real data from SURA API using stored cookies.
     * Supports ?type=polizas|clientes to switch between data sources.
     */
    public function fetchPolizas(Request $request)
    {
        $brokerId = $this->getBrokerId($request);
        $page = (int) $request->query('page', 1);
        $perPage = (int) $request->query('per_page', 20);
        $type = $request->query('type', 'polizas'); // polizas | clientes

        $cred = ExternalCredential::forBroker($brokerId)->forProvider('sura')->first();

        if (!$cred) {
            return response()->json([
                'success' => false,
                'message' => 'No hay sesión guardada. Conecta primero con SURA.',
            ], 401);
        }

        try {
            $session = json_decode(Crypt::decryptString($cred->session_data), true);
            $cookieString = $session['cookies'] ?? '';
            $codigoAsesor = $session['codigoAsesor'] ?? '';
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error descifrando la sesión.'], 500);
        }

        if (!$cookieString || !$codigoAsesor) {
            return response()->json(['success' => false, 'message' => 'Sesión incompleta. Vuelve a conectar.'], 401);
        }

        try {
            if ($type === 'clientes') {
                $result = $this->suraFetchClientes($cookieString, $codigoAsesor, $page, $perPage);
            } else {
                $result = $this->suraFetchPolizas($cookieString, $codigoAsesor, $page, $perPage);
            }

            if (!$result['success']) {
                $cred->update(['status' => 'expired', 'last_error' => 'Sesión expirada en SURA']);
                return response()->json([
                    'success' => false,
                    'message' => 'La sesión de SURA expiró. Vuelve a conectar copiando las cookies.',
                ], 401);
            }

            $data = $result['data'];

            if ($type === 'clientes') {
                $items = $data['clientes'] ?? [];
                $normalized = array_map([$this, 'normalizeCliente'], $items);
            } else {
                $items = $data['polizas'] ?? [];
                $normalized = array_map([$this, 'normalizePoliza'], $items);
            }

            $total = $data['totalRegistros'] ?? count($items);
            $totalPages = $data['totalPaginas'] ?? 1;

            $cred->update(['last_sync_at' => Carbon::now(), 'status' => 'active', 'last_error' => null]);

            return response()->json([
                'success' => true,
                'data' => $normalized,
                'type' => $type,
                'meta' => [
                    'total' => $total,
                    'page' => $page,
                    'per_page' => $perPage,
                    'total_pages' => $totalPages,
                    'has_more' => $page < $totalPages,
                ],
            ]);

        } catch (\Exception $e) {
            Log::error('SURA Scraper: fetch failed', ['type' => $type, 'error' => $e->getMessage()]);
            $cred->update(['status' => 'error', 'last_error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    /**
     * GET /api/saas/sura-scraper/polizas/{numeroPoliza}
     */
    public function fetchPolizaDetail(Request $request, string $numeroPoliza)
    {
        // For now return a simple message; detail endpoint TBD once we discover the SURA API for it
        return response()->json([
            'success' => true,
            'data' => ['numero_poliza' => $numeroPoliza, 'message' => 'Detail endpoint pending SURA API discovery'],
        ]);
    }

    /**
     * POST /api/saas/sura-scraper/export
     * Fetch ALL pages and return the full dataset.
     */
    public function exportExcel(Request $request)
    {
        $brokerId = $this->getBrokerId($request);
        $type = $request->input('type', 'polizas'); // polizas | clientes
        $cred = ExternalCredential::forBroker($brokerId)->forProvider('sura')->first();

        if (!$cred) {
            return response()->json(['success' => false, 'message' => 'No hay sesión guardada.'], 401);
        }

        try {
            $session = json_decode(Crypt::decryptString($cred->session_data), true);
            $cookieString = $session['cookies'] ?? '';
            $codigoAsesor = $session['codigoAsesor'] ?? '';
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error descifrando sesión.'], 500);
        }

        try {
            $fetchFn = $type === 'clientes' ? 'suraFetchClientes' : 'suraFetchPolizas';
            $itemsKey = $type === 'clientes' ? 'clientes' : 'polizas';
            $normalizeFn = $type === 'clientes' ? 'normalizeCliente' : 'normalizePoliza';

            $first = $this->$fetchFn($cookieString, $codigoAsesor, 1, 100);
            if (!$first['success']) {
                return response()->json(['success' => false, 'message' => 'Sesión SURA expirada.'], 401);
            }

            $allItems = $first['data'][$itemsKey] ?? [];
            $totalPages = $first['data']['totalPaginas'] ?? 1;

            for ($p = 2; $p <= $totalPages && $p <= 20; $p++) {
                $pageResult = $this->$fetchFn($cookieString, $codigoAsesor, $p, 100);
                if ($pageResult['success'] && !empty($pageResult['data'][$itemsKey])) {
                    $allItems = array_merge($allItems, $pageResult['data'][$itemsKey]);
                }
            }

            $normalized = array_map([$this, $normalizeFn], $allItems);

            return response()->json([
                'success' => true,
                'message' => 'Exportación completa: ' . count($normalized) . ' registros.',
                'data' => $normalized,
                'type' => $type,
            ]);

        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // =========================================================================
    // Private helpers
    // =========================================================================

    /**
     * GET request to SURA API.
     */
    private function suraGet(string $endpoint, string $cookieString): array
    {
        $client = new \GuzzleHttp\Client(['timeout' => 15, 'verify' => false, 'http_errors' => false]);
        try {
            $response = $client->get(self::SURA_API . $endpoint, [
                'headers' => $this->suraHeaders($cookieString),
            ]);
            $data = json_decode((string) $response->getBody(), true);
            return $response->getStatusCode() === 200 && $data ? ['success' => true, 'data' => $data] : ['success' => false];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * POST request to SURA API.
     */
    private function suraPost(string $endpoint, string $cookieString, array $body, string $relayState = ''): array
    {
        $client = new \GuzzleHttp\Client(['timeout' => 30, 'verify' => false, 'http_errors' => false]);
        try {
            $response = $client->post(self::SURA_API . $endpoint, [
                'json' => $body,
                'headers' => $this->suraHeaders($cookieString, $relayState),
            ]);
            $data = json_decode((string) $response->getBody(), true);
            return $response->getStatusCode() === 200 && $data ? ['success' => true, 'data' => $data] : ['success' => false, 'error' => $data['mensaje'] ?? 'HTTP ' . $response->getStatusCode()];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Standard headers for SURA API requests.
     */
    private function suraHeaders(string $cookieString, string $relayState = ''): array
    {
        return [
            'Accept' => 'application/json, text/plain, */*',
            'Content-Type' => 'application/json',
            'Cookie' => $cookieString,
            'Origin' => 'https://asistentevirtualasesores.sura.com',
            'Referer' => 'https://asistentevirtualasesores.sura.com/',
            'User-Agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
            'X-APP-RELAYSTATE' => $relayState,
        ];
    }

    /**
     * Extract the agent code from KAgente cookie or from the SURA API.
     */
    private function extractAgentCode(string $cookieString, string $userName): string
    {
        // First try KAgente cookie (base64 encoded)
        if (preg_match('/KAgente=([^;]+)/', $cookieString, $m)) {
            $decoded = base64_decode($m[1]);
            if ($decoded && is_numeric($decoded)) {
                return $decoded;
            }
        }

        // Fallback: call the asesores/codigos endpoint
        if ($userName) {
            $res = $this->suraPost('/ohs-redcomercial/asesores/codigos', $cookieString, [
                'assessorId' => $userName,
            ]);
            if ($res['success'] && is_array($res['data']) && !empty($res['data'][0]['codigoAsesor'])) {
                return $res['data'][0]['codigoAsesor'];
            }
        }

        return '';
    }

    /**
     * Fetch clients from SURA API with the correct payload.
     */
    private function suraFetchClientes(string $cookieString, string $codigoAsesor, int $page, int $perPage): array
    {
        return $this->suraPost('/ohs-mercadeo/clientes', $cookieString, [
            'dniCliente' => '',
            'paginacion' => [
                'pagina' => (string) $page,
                'registros' => (string) $perPage,
            ],
            'codigoAsesor' => $codigoAsesor,
            'consultaEps' => null,
            'codigoRamo' => '',
        ], '/clientes');
    }

    /**
     * Fetch polizas from SURA API.
     */
    private function suraFetchPolizas(string $cookieString, string $codigoAsesor, int $page, int $perPage, string $estado = 'VIGENTES'): array
    {
        return $this->suraPost('/ohs-mercadeo/polizas', $cookieString, [
            'codigoAsesor' => $codigoAsesor,
            'estadoPoliza' => $estado,
            'consultaEps' => null,
            'filtrosOpcionales' => [],
            'paginacion' => [
                'pagina' => (string) $page,
                'registros' => (string) $perPage,
            ],
        ], '/polizas');
    }

    /**
     * Normalize a SURA "cliente" record.
     */
    private function normalizeCliente(array $c): array
    {
        return [
            'id' => $c['id'] ?? '',
            'nombre' => trim($c['nombre'] ?? ''),
            'tipo_documento' => $c['tipoDocumento'] ?? '',
            'numero_documento' => $c['numeroDocumento'] ?? '',
            'direccion' => $c['direccion'] ?? '',
            'ciudad' => $c['ciudad'] ?? '',
            'telefono_fijo' => $c['telefonoFijo'] ?? '',
            'telefono_celular' => $c['telefonoCelular'] ?? '',
            'correo' => $c['correoElectronico'] ?? '',
            'fecha_nacimiento' => $c['fechaNacimiento'] ?? '',
            'tipo_vinculacion' => $c['tipoVinculacion'] ?? '',
            'tipo_persona' => $c['tipoPersona'] ?? '',
            'sarlaft_actualizado' => $c['tieneSarlaftActualizado'] ?? null,
        ];
    }

    /**
     * GET /api/saas/sura-scraper/existing-documents
     * Returns set of document_numbers that already exist in Guro for this broker.
     */
    public function existingDocuments(Request $request)
    {
        $brokerId = $this->getBrokerId($request);
        $docs = \App\Models\Cliente::where('broker_id', $brokerId)
            ->whereNotNull('document_number')
            ->where('document_number', '!=', '')
            ->pluck('document_number')
            ->toArray();

        return response()->json([
            'success' => true,
            'data' => $docs,
        ]);
    }

    /**
     * POST /api/saas/sura-scraper/import-clients
     * Import SURA clients into Guro clientes table with duplicate detection.
     */
    public function importClients(Request $request)
    {
        $brokerId = $this->getBrokerId($request);
        $clients = $request->input('clients', []);

        if (empty($clients)) {
            return response()->json(['success' => false, 'message' => 'No se enviaron clientes para importar'], 400);
        }

        $imported = [];
        $duplicates = [];
        $errors = [];

        foreach ($clients as $suraClient) {
            try {
                $docNumber = trim($suraClient['numero_documento'] ?? '');
                if (empty($docNumber)) {
                    $errors[] = ['nombre' => $suraClient['nombre'] ?? '?', 'reason' => 'Sin número de documento'];
                    continue;
                }

                // Check duplicate by document_number + broker_id
                $existing = \App\Models\Cliente::where('broker_id', $brokerId)
                    ->where('document_number', $docNumber)
                    ->first();

                if ($existing) {
                    $duplicates[] = [
                        'sura_nombre' => $suraClient['nombre'] ?? '',
                        'documento' => $docNumber,
                        'existing_id' => $existing->id,
                        'existing_nombre' => trim($existing->first_name . ' ' . $existing->last_name),
                    ];
                    continue;
                }

                // Parse name: SURA sends full name in 'nombre'
                $fullName = trim($suraClient['nombre'] ?? '');
                $nameParts = preg_split('/\s+/', $fullName);
                $firstName = $nameParts[0] ?? '';
                $lastName = count($nameParts) > 1 ? implode(' ', array_slice($nameParts, 1)) : '';

                // Map SURA tipo_documento to Guro document_type
                $docTypeMap = [
                    'C' => 'CC', 'CC' => 'CC', 'CE' => 'CE', 'NIT' => 'NIT',
                    'TI' => 'TI', 'PA' => 'PA', 'RC' => 'RC',
                ];
                $suraDocType = strtoupper(trim($suraClient['tipo_documento'] ?? 'CC'));
                $docType = $docTypeMap[$suraDocType] ?? $suraDocType;

                // Determine client_type
                $tipoPersona = $suraClient['tipo_persona'] ?? 'N';
                $clientType = ($tipoPersona === 'J' || $docType === 'NIT') ? 'empresa' : 'persona';

                $clientData = [
                    'broker_id' => $brokerId,
                    'client_type' => $clientType,
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'document_type' => $docType,
                    'document_number' => $docNumber,
                    'address' => trim($suraClient['direccion'] ?? '') ?: 'Sin dirección',
                    'city' => trim($suraClient['ciudad'] ?? ''),
                    'phone' => trim($suraClient['telefono_fijo'] ?? ''),
                    'mobile_phone' => trim($suraClient['telefono_celular'] ?? ''),
                    'email' => trim($suraClient['correo'] ?? ''),
                    'status' => 'active',
                    'source' => 'sura_sync',
                    'notes' => 'Importado desde SURA - Vinculación: ' . ($suraClient['tipo_vinculacion'] ?? 'N/A'),
                ];

                // Handle empresa fields
                if ($clientType === 'empresa') {
                    $clientData['company'] = $fullName;
                }

                // Validate required fields for creation
                if (empty($clientData['email'])) {
                    $clientData['email'] = strtolower(str_replace(' ', '', $docNumber)) . '@sinregistro.com';
                }
                if (empty($clientData['mobile_phone'])) {
                    $clientData['mobile_phone'] = '0000000000';
                }

                $cliente = \App\Models\Cliente::create($clientData);
                $imported[] = [
                    'id' => $cliente->id,
                    'nombre' => $fullName,
                    'documento' => $docNumber,
                ];
            } catch (\Exception $e) {
                $errors[] = [
                    'nombre' => $suraClient['nombre'] ?? '?',
                    'documento' => $suraClient['numero_documento'] ?? '',
                    'reason' => $e->getMessage(),
                ];
            }
        }

        return response()->json([
            'success' => true,
            'message' => sprintf(
                '%d importados, %d duplicados, %d errores de %d total',
                count($imported), count($duplicates), count($errors), count($clients)
            ),
            'data' => [
                'imported' => $imported,
                'duplicates' => $duplicates,
                'errors' => $errors,
                'summary' => [
                    'total' => count($clients),
                    'imported_count' => count($imported),
                    'duplicate_count' => count($duplicates),
                    'error_count' => count($errors),
                ],
            ],
        ]);
    }

    /**
     * Normalize a SURA "poliza" record.
     */
    private function normalizePoliza(array $p): array
    {
        return [
            'ramo_codigo' => $p['codigoRamo'] ?? '',
            'ramo_nombre' => $p['nombreRamo'] ?? '',
            'producto' => $p['nombreProducto'] ?? '',
            'numero_poliza' => $p['numeroContrato'] ?? '',
            'tipo_dni_tomador' => $p['tipoDniTomador'] ?? '',
            'dni_tomador' => $p['dniTomador'] ?? '',
            'nombre_tomador' => trim($p['nombreTomador'] ?? ''),
            'direccion_tomador' => $p['direccionTomador'] ?? '',
            'telefono_tomador' => $p['telefonoFijoTomador'] ?? '',
            'celular_tomador' => $p['telefonoCelularTomador'] ?? '',
            'ciudad' => $p['ciudadTomador'] ?? '',
            'oficina' => $p['nombreOficina'] ?? '',
            'fecha_inicio' => $p['fechaInicioVigencia'] ?? '',
            'fecha_fin' => $p['fechaFinVigencia'] ?? '',
            'forma_pago' => $p['formaPago'] ?? '',
            'financiada' => $p['esFinanciada'] ?? '',
        ];
    }
}
