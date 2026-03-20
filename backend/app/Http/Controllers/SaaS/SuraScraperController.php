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
    private const SURA_SSO_URL = 'https://login.sura.com/sso/servicelogin.aspx';
    private const SURA_SSO_SERVICE = 'proveedores';
    private const SURA_SSO_CONTINUE = 'Paginas/Privadas/AsistenteVirtual.aspx';
    private const SESSION_DURATION_HOURS = 2; // re-login every 2h to be safe

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

        $sessionValid = $cred->hasValidSession();
        $authMethod = 'cookies';

        // Determine auth method from stored session data
        try {
            $session = json_decode(Crypt::decryptString($cred->session_data), true);
            if (!empty($session['sura_user']) && !empty($session['sura_password'])) {
                $authMethod = 'credentials';

                // Auto-refresh if session expired and we have credentials
                if (!$sessionValid && $cred->status !== 'refreshing') {
                    $cred->update(['status' => 'refreshing']);
                    $refreshed = $this->autoRefreshSession($cred);
                    if ($refreshed) {
                        $cred->refresh();
                        $sessionValid = true;
                    }
                }
            }
        } catch (\Exception $e) {
            // Non-fatal
        }

        return response()->json([
            'success' => true,
            'data' => [
                'connected' => true,
                'username' => $cred->username,
                'last_sync_at' => $cred->last_sync_at?->toISOString(),
                'session_valid' => $sessionValid,
                'status' => $cred->status,
                'last_error' => $cred->last_error,
                'auth_method' => $authMethod,
            ],
        ]);
    }

    /**
     * POST /api/saas/sura-scraper/connect
     * Accepts cookies string from the browser to authenticate with SURA API.
     */
    public function connect(Request $request)
    {
        $request->validate([
            'cookies' => 'nullable|string|min:20',
            'sura_user' => 'nullable|string|min:3',
            'sura_password' => 'nullable|string|min:3',
            'mfa_code' => 'nullable|string|min:4|max:8',
            'doc_type' => 'nullable|string|max:3',
        ]);

        $brokerId = $this->getBrokerId($request);
        $suraUser = $request->input('sura_user');
        $suraPassword = $request->input('sura_password');
        $mfaCode = $request->input('mfa_code', '');
        $docType = $request->input('doc_type', 'C');
        $cookieString = trim($request->input('cookies', ''));

        try {
            // ---- Mode A: Credential-based auto-login (preferred) ----
            if ($suraUser && $suraPassword) {
                $loginResult = $this->suraLogin($suraUser, $suraPassword, $mfaCode, $docType);
                if (!$loginResult['success']) {
                    $response = [
                        'success' => false,
                        'message' => $loginResult['error'] ?? 'No se pudo iniciar sesión en SURA. Verifica tus credenciales.',
                    ];
                    if (!empty($loginResult['mfa_required'])) {
                        $response['mfa_required'] = true;
                    }
                    Log::info('SURA connect: returning login error', $response);
                    return response()->json($response, 401);
                }
                $cookieString = $loginResult['cookies'];
            }

            if (!$cookieString) {
                return response()->json([
                    'success' => false,
                    'message' => 'Proporciona credenciales SURA o cookies de sesión.',
                ], 422);
            }

            // Step 1: Get identity to validate session
            $identity = $this->suraGet('/home/users/identity', $cookieString);
            Log::info('SURA connect: identity response', [
                'success' => $identity['success'],
                'data' => $identity['data'] ?? null,
                'error' => $identity['error'] ?? null,
                'cookie_length' => strlen($cookieString),
            ]);
            if (!$identity['success']) {
                return response()->json([
                    'success' => false,
                    'message' => 'Las cookies no son válidas o la sesión expiró. Verifica tus credenciales.',
                ], 401);
            }

            $userName = $identity['data']['userName'] ?? '';
            $fullName = trim($identity['data']['fullName'] ?? 'SURA Asesor');

            // Step 2: Get agent code
            $codigoAsesor = $this->extractAgentCode($cookieString, $userName);

            // Step 3: Test fetching clientes to validate session
            $testClientes = $this->suraFetchClientes($cookieString, $codigoAsesor, 1, 1);
            $totalClientes = $testClientes['success'] ? ($testClientes['data']['totalRegistros'] ?? 0) : 0;

            // Store session + credentials for auto-refresh
            $sessionPayload = json_encode([
                'cookies' => $cookieString,
                'codigoAsesor' => $codigoAsesor,
                'userName' => $userName,
                'sura_user' => $suraUser ?: null,
                'sura_password' => $suraPassword ?: null,
                'doc_type' => $docType,
            ]);

            $cred = ExternalCredential::updateOrCreate(
                ['broker_id' => $brokerId, 'provider' => 'sura'],
                [
                    'username' => $fullName ?: ('Agente ' . $codigoAsesor),
                    'password_encrypted' => Crypt::encryptString($suraUser && $suraPassword ? 'credential-auth' : 'cookie-auth'),
                    'session_data' => Crypt::encryptString($sessionPayload),
                    'session_expires_at' => Carbon::now()->addHours(self::SESSION_DURATION_HOURS),
                    'status' => 'active',
                    'last_error' => null,
                ]
            );

            $authMethod = ($suraUser && $suraPassword) ? 'credenciales' : 'cookies';

            return response()->json([
                'success' => true,
                'message' => "Conectado como {$fullName} (vía {$authMethod}). Se encontraron {$totalClientes} clientes.",
                'data' => [
                    'connected' => true,
                    'username' => $fullName,
                    'session_valid' => true,
                    'status' => 'active',
                    'total_clientes' => $totalClientes,
                    'auth_method' => $suraUser ? 'credentials' : 'cookies',
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
     * POST /api/saas/sura-scraper/refresh-session
     * Attempts to re-login using stored credentials. Returns new session status.
     */
    public function refreshSession(Request $request)
    {
        $brokerId = $this->getBrokerId($request);
        $cred = ExternalCredential::forBroker($brokerId)->forProvider('sura')->first();

        if (!$cred) {
            return response()->json(['success' => false, 'message' => 'No hay sesión guardada.'], 401);
        }

        try {
            $refreshed = $this->autoRefreshSession($cred);
            if ($refreshed) {
                return response()->json([
                    'success' => true,
                    'message' => 'Sesión renovada automáticamente.',
                    'data' => [
                        'connected' => true,
                        'username' => $cred->fresh()->username ?? $cred->username,
                        'session_valid' => true,
                        'status' => 'active',
                    ],
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'No se pudo renovar la sesión. Las credenciales pueden haber cambiado. Reconecta manualmente.',
            ], 401);
        } catch (\Exception $e) {
            Log::error('SURA Scraper: refresh failed', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error: ' . $e->getMessage()], 500);
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
                // Try auto-refresh if we have stored credentials
                $refreshed = $this->autoRefreshSession($cred);
                if ($refreshed) {
                    // Re-read session after refresh
                    $cred->refresh();
                    $session = json_decode(Crypt::decryptString($cred->session_data), true);
                    $cookieString = $session['cookies'] ?? '';
                    $codigoAsesor = $session['codigoAsesor'] ?? '';
                    // Retry the fetch
                    $result = $type === 'clientes'
                        ? $this->suraFetchClientes($cookieString, $codigoAsesor, $page, $perPage)
                        : $this->suraFetchPolizas($cookieString, $codigoAsesor, $page, $perPage);
                }
                if (!$result['success']) {
                    $cred->update(['status' => 'expired', 'last_error' => 'Sesión expirada en SURA']);
                    return response()->json([
                        'success' => false,
                        'message' => 'La sesión de SURA expiró. Reconecta con tus credenciales.',
                        'session_expired' => true,
                    ], 401);
                }
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
     * GET /api/saas/sura-scraper/polizas/{numeroPoliza}/detail
     * Fetches detailed policy info from SURA's ramo-specific endpoints.
     * Query params: ramo (codigoRamo), fecha_fin (fechaFinVigencia), codigo_rol (default 100)
     */
    public function fetchPolizaDetail(Request $request, string $numeroPoliza)
    {
        $brokerId = $this->getBrokerId($request);
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

        $ramoCode = $request->query('ramo', '');
        $fechaFin = $request->query('fecha_fin', '');
        $codigoRol = $request->query('codigo_rol', '100');

        // Map ramo code to SURA detail endpoint
        $endpoint = $this->getDetailEndpointByRamo($ramoCode);
        if (!$endpoint) {
            return response()->json([
                'success' => false,
                'message' => 'Ramo no soportado para detalle: ' . $ramoCode,
            ], 422);
        }

        // Build the POST body for the detail request
        $body = [
            'numeroPolizaPrincipal' => $numeroPoliza,
            'numeroPoliza' => $numeroPoliza,
            'codigoRol' => $codigoRol,
        ];
        if ($fechaFin) {
            $body['fechaFinVigencia'] = $fechaFin;
        }

        $relayState = '/polizas/' . $this->getRamoSlug($ramoCode);
        $result = $this->suraPost($endpoint, $cookieString, $body, $relayState);

        if (!$result['success']) {
            // Try auto-refresh
            $refreshed = $this->autoRefreshSession($cred);
            if ($refreshed) {
                $cred->refresh();
                $session = json_decode(Crypt::decryptString($cred->session_data), true);
                $cookieString = $session['cookies'] ?? '';
                $result = $this->suraPost($endpoint, $cookieString, $body, $relayState);
            }
            if (!$result['success']) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error obteniendo detalle: ' . ($result['error'] ?? 'desconocido'),
                    'session_expired' => true,
                ], 401);
            }
        }

        // Also fetch recibos pendientes and reclamaciones in parallel
        $recibos = $this->suraPost('/ohs-aseguramiento/polizas/recibos_pendientes', $cookieString, [
            'numeroPoliza' => $numeroPoliza,
        ], '/polizas');

        $reclamaciones = $this->suraPost('/ohs-aseguramiento/polizas/reclamaciones', $cookieString, [
            'numeroPoliza' => $numeroPoliza,
        ], '/polizas');

        $detail = $result['data'];
        $detail['_recibos_pendientes'] = $recibos['success'] ? ($recibos['data'] ?? []) : [];
        $detail['_reclamaciones'] = $reclamaciones['success'] ? ($reclamaciones['data'] ?? []) : [];
        $detail['_ramo_code'] = $ramoCode;
        $detail['_endpoint_used'] = $endpoint;

        return response()->json([
            'success' => true,
            'data' => $detail,
        ]);
    }

    /**
     * Map SURA ramo code to the correct detail API endpoint.
     */
    private function getDetailEndpointByRamo(string $ramoCode): ?string
    {
        // SURA ramo codes mapping to detail endpoints
        // Known ramo codes from SURA's frontend Angular app
        $map = [
            // Autos
            '01' => '/ohs-aseguramiento/polizas/autos',
            'AUTOS' => '/ohs-aseguramiento/polizas/autos',
            // Empresariales / Copropiedades / PYME
            '02' => '/ohs-aseguramiento/polizas/empresariales',
            '19' => '/ohs-aseguramiento/polizas/empresariales',
            'EMPRESARIALES' => '/ohs-aseguramiento/polizas/empresariales',
            'COPROPIEDADES' => '/ohs-aseguramiento/polizas/empresariales',
            'PYME' => '/ohs-aseguramiento/polizas/empresariales',
            // Vida Individual
            '03' => '/ohs-aseguramiento/polizas/vidaindividual',
            'VIDA INDIVIDUAL' => '/ohs-aseguramiento/polizas/vidaindividual',
            // Vida Grupo
            '04' => '/ohs-aseguramiento/polizas/vidagrupo',
            'VIDA GRUPO' => '/ohs-aseguramiento/polizas/vidagrupo',
            // Salud
            '05' => '/ohs-aseguramiento/polizas/salud/tomador',
            'SALUD' => '/ohs-aseguramiento/polizas/salud/tomador',
            // Hogar
            '06' => '/ohs-oracle/polizas/hogar',
            'HOGAR' => '/ohs-oracle/polizas/hogar',
            // Exequiales
            '07' => '/ohs-aseguramiento/polizas/exequiales',
            'EXEQUIALES' => '/ohs-aseguramiento/polizas/exequiales',
            // Accidentes Personales
            '08' => '/ohs-aseguramiento/polizas/accidentes-personales',
            'ACCIDENTES PERSONALES' => '/ohs-aseguramiento/polizas/accidentes-personales',
            // SOAT
            '09' => '/ohs-oracle/polizas/soat',
            'SOAT' => '/ohs-oracle/polizas/soat',
            // Cumplimiento
            '10' => '/ohs-oracle/polizas/cumplimiento',
            'CUMPLIMIENTO' => '/ohs-oracle/polizas/cumplimiento',
            // Renta / Educación
            '11' => '/ohs-oracle/polizas/renta-educacion',
            'RENTA' => '/ohs-oracle/polizas/renta-educacion',
            'EDUCACION' => '/ohs-oracle/polizas/renta-educacion',
            // Más Vida
            '12' => '/ohs-aseguramiento/polizas/masvida',
            'MAS VIDA' => '/ohs-aseguramiento/polizas/masvida',
            // Juveniles
            '13' => '/ohs-oracle/polizas/juveniles',
            'JUVENILES' => '/ohs-oracle/polizas/juveniles',
        ];

        $key = strtoupper(trim($ramoCode));
        return $map[$key] ?? $map[$ramoCode] ?? null;
    }

    /**
     * Get a URL-safe slug for the ramo (used for relayState).
     */
    private function getRamoSlug(string $ramoCode): string
    {
        $slugs = [
            '01' => 'autos', 'AUTOS' => 'autos',
            '02' => 'empresariales', '19' => 'empresariales',
            '03' => 'vidaindividual', '04' => 'vidagrupo',
            '05' => 'salud', '06' => 'hogar',
            '07' => 'exequiales', '08' => 'accidentes-personales',
            '09' => 'soat', '10' => 'cumplimiento',
            '11' => 'renta-educacion', '12' => 'masvida', '13' => 'juveniles',
        ];
        return $slugs[$ramoCode] ?? $slugs[strtoupper(trim($ramoCode))] ?? 'detalle';
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
     * Programmatic login to SURA SSO via full SAML + MFA flow.
     * Flow: API→SAMLRequest→seus.sura.com→login.sura.com→credentials→MFA→SAMLResponse→API cookies
     *
     * @param string $suraUser  Document number (e.g. "1020397190")
     * @param string $suraPassword  PIN (4 digits)
     * @param string $mfaCode  TOTP code from authenticator app (6 digits)
     * @param string $docType  Document type code (default "C" = Cédula)
     * @return array ['success' => true, 'cookies' => '...'] or ['success' => false, 'error' => '...']
     */
    private function suraLogin(string $suraUser, string $suraPassword, string $mfaCode = '', string $docType = 'C'): array
    {
        $ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

        try {
            $jar = new \GuzzleHttp\Cookie\CookieJar();
            $client = new \GuzzleHttp\Client([
                'timeout' => 30,
                'verify' => false,
                'cookies' => $jar,
                'allow_redirects' => false,
                'http_errors' => false,
            ]);

            // ── Step 1: GET API identity → triggers SAML, returns form with SAMLRequest ──
            $r1 = $client->get(self::SURA_API . '/home/users/identity', [
                'headers' => ['Accept' => 'text/html,*/*', 'User-Agent' => $ua],
            ]);
            $b1 = (string) $r1->getBody();
            if (!preg_match('/name=["\']SAMLRequest["\'][^>]*value=["\']([^"\']+)["\']/i', $b1, $saml)) {
                return ['success' => false, 'error' => 'No se pudo iniciar flujo SAML con SURA.'];
            }
            Log::info('SURA login: Step 1 OK - SAMLRequest obtained');

            // ── Step 2: POST SAMLRequest to seus.sura.com → get login.sura.com redirect form ──
            $r2 = $client->post('https://seus.sura.com/idp/login/sso', [
                'form_params' => ['SAMLRequest' => $saml[1]],
                'headers' => ['User-Agent' => $ua],
            ]);
            $b2 = (string) $r2->getBody();
            if (!preg_match('/action=["\']([^"\']+)["\']/i', $b2, $formAction2)) {
                return ['success' => false, 'error' => 'Error en flujo SAML (paso 2).'];
            }
            preg_match_all('/name=["\']([^"\']+)["\'][^>]*value=["\']([^"\']*?)["\']/', $b2, $inputs2);
            $params2 = [];
            for ($i = 0; $i < count($inputs2[1]); $i++) $params2[$inputs2[1][$i]] = $inputs2[2][$i];
            Log::info('SURA login: Step 2 OK - redirect to login.sura.com');

            // ── Step 3: POST to login.sura.com with SAML params → get login page with JS vars ──
            $loginUrl = html_entity_decode($formAction2[1]);
            $r3 = $client->post($loginUrl, [
                'form_params' => $params2,
                'headers' => ['User-Agent' => $ua],
            ]);
            $b3 = (string) $r3->getBody();
            $jsVars = [];
            foreach (['action', 'spEntityId', 'reqID', 'continueTo', 'acsURL', 'idpId', 'tagExt', 'service', 'country'] as $v) {
                if (preg_match('/var\s+' . $v . '\s*=\s*["\']([^"\']*?)["\']/i', $b3, $vm)) {
                    $jsVars[$v] = stripcslashes($vm[1]);
                }
            }
            if (empty($jsVars['action'])) {
                return ['success' => false, 'error' => 'Error obteniendo parámetros de login SURA (paso 3).'];
            }
            Log::info('SURA login: Step 3 OK - login page loaded', ['action' => $jsVars['action']]);

            // ── Step 4: POST credentials to seus.sura.com/idp/login ──
            $username = $docType . $suraUser; // e.g. "C1020397190"
            $r4 = $client->post($jsVars['action'], [
                'form_params' => [
                    'username' => $username,
                    'password' => $suraPassword,
                    'spEntityId' => $jsVars['spEntityId'] ?? '',
                    'service' => $jsVars['service'] ?? '',
                    'reqID' => $jsVars['reqID'] ?? '',
                    'continueTo' => $jsVars['continueTo'] ?? '',
                    'country' => $jsVars['country'] ?? 'CO',
                    'acsURL' => $jsVars['acsURL'] ?? '',
                    'idpId' => $jsVars['idpId'] ?? '',
                    'tag' => $jsVars['tagExt'] ?? '',
                ],
                'headers' => ['User-Agent' => $ua, 'Origin' => 'https://login.sura.com', 'Referer' => $loginUrl],
            ]);
            $b4 = (string) $r4->getBody();

            // Check for login errors
            $b4Text = strip_tags($b4);
            if (stripos($b4Text, 'no válido') !== false || stripos($b4Text, 'incorrecta') !== false || stripos($b4Text, 'bloqueado') !== false) {
                return ['success' => false, 'error' => 'Credenciales SURA incorrectas o cuenta bloqueada.'];
            }

            // Check if we got a SAML response directly (no MFA needed - trusted device)
            if (strpos($b4, 'SAMLResponse') !== false) {
                Log::info('SURA login: Step 4 - No MFA needed (trusted device)');
                return $this->completeSamlFlow($client, $jar, $b4, $ua, $suraUser);
            }

            // ── Step 5: MFA redirect form ──
            if (!preg_match('/action=["\']([^"\']+)["\']/i', $b4, $mfaAction)) {
                return ['success' => false, 'error' => 'Respuesta inesperada de SURA después del login.'];
            }
            preg_match_all('/name=["\']([^"\']+)["\'][^>]*value=["\']([^"\']*?)["\']/i', $b4, $mfaInputs);
            $mfaParams = [];
            for ($i = 0; $i < count($mfaInputs[1]); $i++) $mfaParams[$mfaInputs[1][$i]] = $mfaInputs[2][$i];

            $mfaBaseUrl = 'https://seus.sura.com';
            $r5 = $client->post($mfaBaseUrl . $mfaAction[1], [
                'form_params' => $mfaParams,
                'headers' => ['User-Agent' => $ua],
            ]);
            $b5 = (string) $r5->getBody();
            Log::info('SURA login: Step 5 - MFA page loaded');

            // ── Step 6: Submit MFA code ──
            if (!$mfaCode) {
                return ['success' => false, 'error' => 'Se requiere código de verificación (MFA). Ingresa el código de tu app autenticadora.', 'mfa_required' => true];
            }

            if (!preg_match('/action=["\']([^"\']+)["\']/i', $b5, $codeAction)) {
                return ['success' => false, 'error' => 'No se encontró formulario de código MFA.'];
            }
            preg_match_all('/name=["\']([^"\']+)["\'][^>]*value=["\']([^"\']*?)["\']/i', $b5, $codeInputs);
            $codeParams = [];
            for ($i = 0; $i < count($codeInputs[1]); $i++) $codeParams[$codeInputs[1][$i]] = $codeInputs[2][$i];
            $codeParams['code'] = $mfaCode;
            $codeParams['addTrustedDevice'] = 'on'; // Remember device for 8 days

            $r6 = $client->post($mfaBaseUrl . $codeAction[1], [
                'form_params' => $codeParams,
                'headers' => ['User-Agent' => $ua, 'Origin' => $mfaBaseUrl, 'Referer' => $mfaBaseUrl . $mfaAction[1]],
            ]);
            $b6 = (string) $r6->getBody();
            $b6Status = $r6->getStatusCode();

            Log::info('SURA login: Step 6 - MFA response', [
                'status' => $b6Status,
                'body_length' => strlen($b6),
                'body_preview' => substr(strip_tags($b6), 0, 300),
                'has_SAMLResponse' => strpos($b6, 'SAMLResponse') !== false,
                'has_validateCode' => strpos($b6, 'validateCode') !== false,
            ]);

            // Check for MFA error - the page returns the MFA form again with error text
            $b6Text = strip_tags($b6);
            $isMfaError = (stripos($b6Text, 'incorrecto') !== false)
                || (stripos($b6Text, 'inválido') !== false && stripos($b6Text, 'código') !== false)
                || (strpos($b6, 'validateCode') !== false && strpos($b6, 'SAMLResponse') === false);
            if ($isMfaError && strpos($b6, 'SAMLResponse') === false) {
                return ['success' => false, 'error' => 'Código MFA incorrecto. Verifica el código de tu app autenticadora.'];
            }

            // After MFA, we should get a SAML response or redirect chain
            Log::info('SURA login: Step 6 - MFA submitted');
            return $this->completeSamlFlow($client, $jar, $b6, $ua, $suraUser);

        } catch (\Exception $e) {
            Log::error('SURA login failed', ['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
            return ['success' => false, 'error' => 'Error de conexión con SURA: ' . $e->getMessage()];
        }
    }

    /**
     * Complete the SAML flow after authentication: follow SAMLResponse forms until we get API cookies.
     */
    private function completeSamlFlow($client, $jar, string $html, string $ua, string $suraUser): array
    {
        $maxRedirects = 10;
        $currentHtml = $html;

        for ($i = 0; $i < $maxRedirects; $i++) {
            // Check for SAMLResponse form
            if (preg_match('/action=["\']([^"\']+)["\']/i', $currentHtml, $action)) {
                preg_match_all('/name=["\']([^"\']+)["\'][^>]*value=["\']([^"\']*?)["\']/i', $currentHtml, $inputs);
                $params = [];
                for ($j = 0; $j < count($inputs[1]); $j++) $params[$inputs[1][$j]] = $inputs[2][$j];

                if (empty($params)) break;

                $targetUrl = html_entity_decode($action[1]);
                if (strpos($targetUrl, 'http') !== 0) {
                    // Relative URL - determine base
                    $targetUrl = 'https://seus.sura.com' . $targetUrl;
                }

                Log::debug('SURA SAML flow: following form to ' . $targetUrl, ['params' => array_keys($params)]);

                $resp = $client->post($targetUrl, [
                    'form_params' => $params,
                    'headers' => ['User-Agent' => $ua],
                ]);

                $status = $resp->getStatusCode();
                $location = $resp->getHeaderLine('Location');

                if ($location) {
                    // Follow redirect
                    $resp = $client->get($location, ['headers' => ['User-Agent' => $ua]]);
                }

                $currentHtml = (string) $resp->getBody();
            } else {
                break;
            }
        }

        // Collect all cookies from the jar
        $allCookies = [];
        foreach ($jar->toArray() as $cookie) {
            $allCookies[$cookie['Name']] = $cookie['Name'] . '=' . $cookie['Value'];
        }

        $cookieString = implode('; ', $allCookies);
        Log::info('SURA login: SAML flow complete for ' . $suraUser, [
            'cookie_count' => count($allCookies),
            'cookie_names' => array_keys($allCookies),
        ]);

        if (count($allCookies) < 3) {
            return ['success' => false, 'error' => 'No se obtuvieron suficientes cookies de sesión SURA.'];
        }

        return ['success' => true, 'cookies' => $cookieString];
    }

    /**
     * Attempt to auto-refresh a SURA session by re-logging in with stored credentials.
     * Returns true if refresh was successful, false otherwise.
     */
    private function autoRefreshSession(ExternalCredential $cred): bool
    {
        try {
            $session = json_decode(Crypt::decryptString($cred->session_data), true);
        } catch (\Exception $e) {
            return false;
        }

        $suraUser = $session['sura_user'] ?? null;
        $suraPassword = $session['sura_password'] ?? null;
        $docType = $session['doc_type'] ?? 'C';

        if (!$suraUser || !$suraPassword) {
            Log::info('SURA auto-refresh: no stored credentials, cannot auto-refresh');
            return false;
        }

        Log::info('SURA auto-refresh: attempting re-login for ' . $suraUser);

        // No MFA code - relies on trusted device cookie from initial login
        $loginResult = $this->suraLogin($suraUser, $suraPassword, '', $docType);
        if (!$loginResult['success']) {
            Log::warning('SURA auto-refresh: re-login failed', ['error' => $loginResult['error'] ?? 'unknown']);
            $cred->update(['status' => 'expired', 'last_error' => 'Auto-refresh falló: ' . ($loginResult['error'] ?? 'unknown')]);
            return false;
        }

        $newCookies = $loginResult['cookies'];

        // Validate the new session
        $identity = $this->suraGet('/home/users/identity', $newCookies);
        if (!$identity['success']) {
            Log::warning('SURA auto-refresh: new cookies failed identity check');
            return false;
        }

        $userName = $identity['data']['userName'] ?? $session['userName'] ?? '';
        $codigoAsesor = $this->extractAgentCode($newCookies, $userName);

        // Update stored session with new cookies
        $newSession = json_encode([
            'cookies' => $newCookies,
            'codigoAsesor' => $codigoAsesor ?: ($session['codigoAsesor'] ?? ''),
            'userName' => $userName,
            'sura_user' => $suraUser,
            'sura_password' => $suraPassword,
        ]);

        $cred->update([
            'session_data' => Crypt::encryptString($newSession),
            'session_expires_at' => Carbon::now()->addHours(self::SESSION_DURATION_HOURS),
            'status' => 'active',
            'last_error' => null,
        ]);

        Log::info('SURA auto-refresh: success for ' . $suraUser);
        return true;
    }

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
            $body = (string) $response->getBody();
            $data = json_decode($body, true);
            $status = $response->getStatusCode();
            Log::debug('SURA GET ' . $endpoint, [
                'status' => $status,
                'body_length' => strlen($body),
                'body_preview' => substr($body, 0, 500),
                'is_json' => $data !== null,
            ]);
            return $status === 200 && $data ? ['success' => true, 'data' => $data] : ['success' => false, 'error' => 'HTTP ' . $status];
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
     * Normalize a SURA "poliza" record from the listing endpoint.
     * Includes all available fields for richer display.
     */
    private function normalizePoliza(array $p): array
    {
        return [
            'ramo_codigo' => $p['codigoRamo'] ?? '',
            'ramo_nombre' => $p['nombreRamo'] ?? '',
            'producto' => $p['nombreProducto'] ?? '',
            'numero_poliza' => $p['numeroContrato'] ?? '',
            'numero_poliza_principal' => $p['numeroContratoPrincipal'] ?? ($p['numeroContrato'] ?? ''),
            'tipo_dni_tomador' => $p['tipoDniTomador'] ?? '',
            'dni_tomador' => $p['dniTomador'] ?? '',
            'nombre_tomador' => trim($p['nombreTomador'] ?? ''),
            'direccion_tomador' => $p['direccionTomador'] ?? '',
            'telefono_tomador' => $p['telefonoFijoTomador'] ?? '',
            'celular_tomador' => $p['telefonoCelularTomador'] ?? '',
            'correo_tomador' => $p['correoElectronicoTomador'] ?? '',
            'ciudad' => $p['ciudadTomador'] ?? '',
            'oficina' => $p['nombreOficina'] ?? '',
            'codigo_oficina' => $p['codigoOficina'] ?? '',
            'fecha_inicio' => $p['fechaInicioVigencia'] ?? '',
            'fecha_fin' => $p['fechaFinVigencia'] ?? '',
            'forma_pago' => $p['formaPago'] ?? '',
            'financiada' => $p['esFinanciada'] ?? '',
            'estado' => $p['estadoPoliza'] ?? ($p['estado'] ?? ''),
            'codigo_asesor' => $p['codigoAsesor'] ?? '',
            'nombre_asesor' => $p['nombreAsesor'] ?? '',
            'numero_renovacion' => $p['numeroRenovacion'] ?? '',
            'tipo_poliza' => $p['tipoPoliza'] ?? '',
        ];
    }
}
