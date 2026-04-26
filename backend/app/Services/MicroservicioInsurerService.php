<?php

namespace App\Services;

use App\Models\InsurerConnection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MicroservicioInsurerService
{
    private const INSURERS = [
        'sura' => [
            'slug'            => 'sura',
            'login'           => '/sura/login',
            'health'          => '/sura/polizas',
            'ttl_hours'       => 6,
            'required_fields' => ['cookies'],
        ],
        'bolivar' => [
            'slug' => 'bolivar',
            'login' => '/bolivar/login',
            'health' => '/bolivar/clientes',
            'ttl_hours' => 8,
            'required_fields' => ['doc_number', 'password'],
        ],
        'hdi' => [
            'slug' => 'hdi',
            'login' => '/hdi/login',
            'health' => '/hdi/clientes',
            'ttl_hours' => 8,
            'required_fields' => ['doc_number', 'password'],
        ],
        'seguros-del-estado' => [
            'slug' => 'estado',
            'login' => '/estado/login',
            'health' => '/estado/polizas',
            'ttl_hours' => 8,
            'required_fields' => ['user_name', 'password'],
        ],
        'axa-colpatria' => [
            'slug' => 'axa',
            'login' => '/axa/login',
            'health' => '/axa/clientes',
            'ttl_hours' => 12,
            'required_fields' => ['doc_number', 'password'],
        ],
        'la-equidad' => [
            'slug' => 'equidad',
            'login' => '/equidad/login',
            'health' => '/equidad/clientes',
            'ttl_hours' => 10,
            'required_fields' => ['email', 'password'],
        ],
    ];

    public function supportedInsurers(): array
    {
        return array_keys(self::INSURERS);
    }

    public function isSupported(string $insurerCode): bool
    {
        return isset(self::INSURERS[$insurerCode]);
    }

    public function validateCredentials(string $insurerCode, array $credentials): array
    {
        if (!$this->isSupported($insurerCode)) {
            return ['ok' => false, 'message' => 'Aseguradora no soportada'];
        }

        $requiredFields = self::INSURERS[$insurerCode]['required_fields'];
        foreach ($requiredFields as $field) {
            if (empty($credentials[$field])) {
                return ['ok' => false, 'message' => "Falta el campo requerido: {$field}"];
            }
        }

        if ($insurerCode === 'sura') {
            $normalizedCookies = $this->normalizeSuraCookies((string) ($credentials['cookies'] ?? ''));
            if (strlen($normalizedCookies) < 20 || !str_contains($normalizedCookies, '=')) {
                return [
                    'ok' => false,
                    'message' => 'Cookies Sura inválidas. Pega el valor completo de cookies del portal de asesores.',
                ];
            }
        }

        return ['ok' => true, 'message' => 'Credenciales válidas'];
    }

    public function connect(string $insurerCode, array $credentials): array
    {
        // Evita fatal error de 30s en logins lentos (HDI/AXA vía Playwright).
        if (function_exists('set_time_limit')) {
            @set_time_limit(180);
        }

        $validation = $this->validateCredentials($insurerCode, $credentials);
        if (!$validation['ok']) {
            return [
                'success' => false,
                'message' => $validation['message'],
            ];
        }

        $conf = self::INSURERS[$insurerCode];
        $payload = $this->buildLoginPayload($insurerCode, $credentials);
        $safePayload = $this->maskSensitivePayload($payload);

        Log::info('[INSURER CONNECT] Intento de conexión', [
            'insurer' => $insurerCode,
            'login_path' => $conf['login'],
            'payload_keys' => array_keys($payload),
            'payload_safe' => $safePayload,
        ]);

        try {
            $response = $this->client()->post($conf['login'], $payload);
            $rawBody = trim((string) $response->body());
            $jsonBody = null;
            try {
                $jsonBody = $response->json();
            } catch (\Throwable $e) {
                $jsonBody = null;
            }

            if (!$response->ok()) {
                $detail = null;
                if (is_array($jsonBody)) {
                    $detail = $jsonBody['detail'] ?? $jsonBody['message'] ?? null;
                }
                if (empty($detail)) {
                    $detail = $rawBody !== '' ? $rawBody : 'Sin detalle retornado por microservicio';
                }

                Log::warning('[INSURER CONNECT] Microservicio respondió error', [
                    'insurer' => $insurerCode,
                    'status_code' => $response->status(),
                    'detail' => $detail,
                ]);

                return [
                    'success' => false,
                    'message' => 'Error de conexión con microservicio',
                    'status_code' => $response->status(),
                    'error' => $detail,
                ];
            }

            $body = is_array($jsonBody) ? $jsonBody : [];
            $sessionId = $body['session_id'] ?? null;

            if (!$sessionId) {
                return [
                    'success' => false,
                    'message' => 'Microservicio no devolvió session_id',
                    'error' => $rawBody !== '' ? $rawBody : $body,
                ];
            }

            Log::info('[INSURER CONNECT] Conexión exitosa', [
                'insurer' => $insurerCode,
                'session_id' => $sessionId,
            ]);

            return [
                'success' => true,
                'session_id' => $sessionId,
                'expires_at' => now()->addHours((int) $conf['ttl_hours']),
                'payload' => $body,
            ];
        } catch (\Throwable $e) {
            Log::error('[INSURER CONNECT] Excepción conectando microservicio', [
                'insurer' => $insurerCode,
                'error' => $e->getMessage(),
            ]);
            return [
                'success' => false,
                'message' => 'Excepción conectando microservicio',
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Headless login with credentials + MFA relay (Belvo-style).
     * Currently used by SURA. Mantiene connectBrowser() sin tocar por compat.
     *
     * @param array $credentials {doc_type, doc_number, password}
     * @param string|null $mfaCode código Authenticator opcional (segundo paso)
     * @return array {success, requires_mfa?, message?, session_id?, expires_at?, payload?}
     */
    public function connectAuto(string $insurerCode, array $credentials, ?string $mfaCode = null, ?string $challengeId = null): array
    {
        $autoEndpoints = [
            'sura' => '/sura/login-auto',
        ];

        if (!isset($autoEndpoints[$insurerCode])) {
            return ['success' => false, 'message' => 'login-auto no disponible para esta aseguradora'];
        }

        if (function_exists('set_time_limit')) {
            @set_time_limit(240);
        }

        $endpoint = $autoEndpoints[$insurerCode];
        $ttlHours = (int) (self::INSURERS[$insurerCode]['ttl_hours'] ?? 6);

        // Construir payload según el paso
        if ($challengeId) {
            // Paso 2: reusar sesión pausada (solo challenge_id + mfa_code)
            $body = [
                'challenge_id' => $challengeId,
                'mfa_code' => (string) $mfaCode,
            ];
        } else {
            // Paso 1: credenciales
            $body = [
                'doc_type' => (string) ($credentials['doc_type'] ?? 'C'),
                'doc_number' => (string) ($credentials['doc_number'] ?? ''),
                'password' => (string) ($credentials['password'] ?? ''),
            ];
        }

        Log::info('[INSURER CONNECT AUTO] Iniciando', [
            'insurer' => $insurerCode,
            'endpoint' => $endpoint,
            'step' => $challengeId ? 'mfa' : 'credentials',
        ]);

        try {
            $response = $this->client()->timeout(210)->post($endpoint, $body);

            $jsonBody = null;
            try { $jsonBody = $response->json(); } catch (\Throwable) {}
            $rawBody = trim((string) $response->body());

            // 202 = requires MFA
            if ($response->status() === 202) {
                $detail = is_array($jsonBody) ? ($jsonBody['detail'] ?? []) : [];
                if (is_array($detail) && ($detail['requires_mfa'] ?? false)) {
                    return [
                        'success' => false,
                        'requires_mfa' => true,
                        'challenge_id' => $detail['challenge_id'] ?? null,
                        'message' => $detail['message'] ?? 'Ingresa el código del Authenticator.',
                    ];
                }
            }

            if (!$response->ok()) {
                $detail = (is_array($jsonBody) ? ($jsonBody['detail'] ?? null) : null)
                    ?? ($rawBody ?: 'Error en login-auto');
                Log::warning('[INSURER CONNECT AUTO] Error', [
                    'insurer' => $insurerCode,
                    'status' => $response->status(),
                    'detail' => $detail,
                ]);
                return [
                    'success' => false,
                    'message' => is_array($detail) ? json_encode($detail) : (string) $detail,
                    'status_code' => $response->status(),
                ];
            }

            $data = is_array($jsonBody) ? $jsonBody : [];
            $sessionId = $data['session_id'] ?? null;
            if (!$sessionId) {
                return ['success' => false, 'message' => 'Microservicio no devolvió session_id'];
            }

            Log::info('[INSURER CONNECT AUTO] Sesión creada', [
                'insurer' => $insurerCode,
                'session_id' => $sessionId,
            ]);

            return [
                'success'    => true,
                'session_id' => $sessionId,
                'expires_at' => now()->addHours($ttlHours),
                'payload'    => $data,
            ];
        } catch (\Throwable $e) {
            Log::error('[INSURER CONNECT AUTO] Excepción', [
                'insurer' => $insurerCode,
                'error' => $e->getMessage(),
            ]);
            return ['success' => false, 'message' => 'Excepción en login-auto: ' . $e->getMessage()];
        }
    }

    /**
     * Browser-assisted login: opens a visible Playwright window so the
     * user can complete login/CAPTCHA/MFA manually. Waits up to 3 min.
     * Currently supported for 'sura' and 'seguros-del-estado'.
     */
    public function connectBrowser(string $insurerCode, int $brokerId): array
    {
        $browserEndpoints = [
            'sura'               => '/sura/login-browser',
            'seguros-del-estado' => '/estado/login-browser',
        ];

        if (!isset($browserEndpoints[$insurerCode])) {
            return ['success' => false, 'message' => 'login-browser no disponible para esta aseguradora'];
        }

        if (function_exists('set_time_limit')) {
            @set_time_limit(240);
        }

        $endpoint = $browserEndpoints[$insurerCode];
        $ttlHours = (int) (self::INSURERS[$insurerCode]['ttl_hours'] ?? 6);

        Log::info('[INSURER CONNECT BROWSER] Iniciando login navegador', [
            'insurer' => $insurerCode,
            'endpoint' => $endpoint,
            'broker_id' => $brokerId,
        ]);

        try {
            $response = $this->client()
                ->timeout(210)
                ->post($endpoint);

            $jsonBody = null;
            try { $jsonBody = $response->json(); } catch (\Throwable) {}
            $rawBody = trim((string) $response->body());

            if (!$response->ok()) {
                $detail = (is_array($jsonBody) ? ($jsonBody['detail'] ?? null) : null)
                    ?? ($rawBody ?: 'Error en login-browser');
                Log::warning('[INSURER CONNECT BROWSER] Error', [
                    'insurer' => $insurerCode,
                    'status' => $response->status(),
                    'detail' => $detail,
                ]);
                return ['success' => false, 'message' => $detail, 'status_code' => $response->status()];
            }

            $body = is_array($jsonBody) ? $jsonBody : [];
            $sessionId = $body['session_id'] ?? null;
            if (!$sessionId) {
                return ['success' => false, 'message' => 'Microservicio no devolvió session_id'];
            }

            Log::info('[INSURER CONNECT BROWSER] Sesión capturada', [
                'insurer' => $insurerCode,
                'session_id' => $sessionId,
            ]);

            return [
                'success'    => true,
                'session_id' => $sessionId,
                'expires_at' => now()->addHours($ttlHours),
                'payload'    => $body,
            ];
        } catch (\Throwable $e) {
            Log::error('[INSURER CONNECT BROWSER] Excepción', [
                'insurer' => $insurerCode,
                'error' => $e->getMessage(),
            ]);
            return ['success' => false, 'message' => 'Excepción en login-browser: ' . $e->getMessage()];
        }
    }

    public function checkHealth(InsurerConnection $connection): array
    {
        if (function_exists('set_time_limit')) {
            @set_time_limit(120);
        }

        if (!$connection->microservice_session_id) {
            return ['success' => false, 'message' => 'Sin session_id en conexión'];
        }

        if (!$this->isSupported($connection->insurer_code)) {
            return ['success' => false, 'message' => 'Aseguradora no soportada'];
        }

        $conf = self::INSURERS[$connection->insurer_code];

        try {
            $response = $this->client()
                ->withHeaders(['X-Session-Id' => $connection->microservice_session_id])
                ->get($conf['health']);

            if ($response->status() === 401 || $response->status() === 403) {
                return [
                    'success' => false,
                    'message' => 'Sesión expirada o inválida',
                    'status_code' => $response->status(),
                ];
            }

            if (!$response->ok()) {
                return [
                    'success' => false,
                    'message' => 'Healthcheck falló',
                    'status_code' => $response->status(),
                    'error' => $response->json('detail') ?: $response->body(),
                ];
            }

            return [
                'success' => true,
                'message' => 'Conexión saludable',
                'status_code' => $response->status(),
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'message' => 'Excepción en healthcheck',
                'error' => $e->getMessage(),
            ];
        }
    }

    private function buildLoginPayload(string $insurerCode, array $credentials): array
    {
        if ($insurerCode === 'sura') {
            return [
                'cookies' => $this->normalizeSuraCookies((string) ($credentials['cookies'] ?? '')),
            ];
        }

        if ($insurerCode === 'axa-colpatria') {
            return [
                'doc_type' => $credentials['doc_type'] ?? 'CC',
                'doc_number' => $credentials['doc_number'],
                'password' => $credentials['password'],
                'profile' => $credentials['profile'] ?? 'ADM',
            ];
        }

        if ($insurerCode === 'hdi') {
            return [
                'doc_type' => $credentials['doc_type'] ?? 'CC',
                'doc_number' => $credentials['doc_number'],
                'password' => $credentials['password'],
            ];
        }

        if ($insurerCode === 'la-equidad') {
            return [
                'email' => $credentials['email'],
                'password' => $credentials['password'],
            ];
        }

        return $credentials;
    }

    private function normalizeSuraCookies(string $rawCookies): string
    {
        $raw = trim($rawCookies);
        if ($raw === '') {
            return '';
        }

        // Caso 1: Pegado como "Cookie: a=b; c=d"
        $raw = preg_replace('/^\s*cookie\s*:\s*/i', '', $raw) ?? $raw;

        // Caso 2: Múltiples líneas tipo Set-Cookie
        if (stripos($raw, 'set-cookie:') !== false) {
            $pairs = [];
            foreach (preg_split('/\r\n|\r|\n/', $raw) as $line) {
                $line = trim($line);
                if ($line === '') {
                    continue;
                }
                $line = preg_replace('/^\s*set-cookie\s*:\s*/i', '', $line) ?? $line;
                $first = trim(explode(';', $line, 2)[0] ?? '');
                if ($first !== '' && str_contains($first, '=')) {
                    $pairs[] = $first;
                }
            }
            if (!empty($pairs)) {
                return implode('; ', array_values(array_unique($pairs)));
            }
        }

        // Caso 3: Tabla de cookies copiada desde DevTools (tab-separated).
        if (str_contains($raw, "\t")) {
            $pairs = [];
            foreach (preg_split('/\r\n|\r|\n/', $raw) as $line) {
                $line = trim($line);
                if ($line === '') {
                    continue;
                }
                $parts = preg_split('/\t+/', $line) ?: [];
                if (count($parts) < 2) {
                    continue;
                }
                $name = trim((string) ($parts[0] ?? ''));
                $value = trim((string) ($parts[1] ?? ''));
                if ($name === '' || $value === '') {
                    continue;
                }
                if (strtolower($name) === 'name' || str_starts_with($name, '#')) {
                    continue; // encabezados/comentarios
                }
                $pairs[] = "{$name}={$value}";
            }
            if (!empty($pairs)) {
                return implode('; ', array_values(array_unique($pairs)));
            }
        }

        // Caso 4: Cookie header normal (single/multi line)
        $raw = preg_replace('/[\r\n]+/', '; ', $raw) ?? $raw;
        $raw = preg_replace('/;\s*;+/','; ', $raw) ?? $raw;
        $raw = trim($raw, " ;\t\n\r\0\x0B");

        return $raw;
    }

    /**
     * Ejecuta una llamada HTTP al microservicio con reconexión transparente.
     * Si responde 401/403 y hay credenciales, reconecta y reintenta una vez.
     */
    public function callWithReconnect(
        InsurerConnection $connection,
        string $method,
        string $url,
        array $options = []
    ): array {
        if (!$connection->microservice_session_id) {
            return ['success' => false, 'error' => 'Sin session_id'];
        }

        $headers = array_merge(
            $options['headers'] ?? [],
            ['X-Session-Id' => $connection->microservice_session_id]
        );

        try {
            $response = $this->client()
                ->withHeaders($headers)
                ->send($method, $url, $options['body'] ?? []);

            if ($response->ok()) {
                return ['success' => true, 'data' => $response->json(), 'status' => $response->status()];
            }

            // Si es 401/403, intentar reconectar
            if (in_array($response->status(), [401, 403])) {
                $credentials = $connection->credentials;
                if (!empty($credentials)) {
                    Log::info("[callWithReconnect] 401 en {$url}, reconectando {$connection->insurer_code}...");
                    $connect = $this->connect($connection->insurer_code, $credentials);
                    if ($connect['success']) {
                        // Actualizar la conexión en DB
                        $connection->microservice_session_id = $connect['session_id'];
                        $connection->status = 'connected';
                        $connection->connected_at = now();
                        $connection->expires_at = $connect['expires_at'] ?? null;
                        $connection->last_error = null;
                        $connection->reconnect_count = 0;
                        $connection->credentials_valid = true;
                        $connection->last_reconnect_at = now();
                        $connection->save();

                        // Reintentar con nuevo session_id
                        $headers['X-Session-Id'] = $connect['session_id'];
                        $retry = $this->client()
                            ->withHeaders($headers)
                            ->send($method, $url, $options['body'] ?? []);

                        if ($retry->ok()) {
                            return ['success' => true, 'data' => $retry->json(), 'status' => $retry->status()];
                        }

                        return [
                            'success' => false,
                            'error' => 'Retry tras reconexión también falló',
                            'status' => $retry->status(),
                        ];
                    }
                }
            }

            return [
                'success' => false,
                'error' => $response->json('detail') ?: $response->body(),
                'status' => $response->status(),
            ];
        } catch (\Throwable $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    private function client()
    {
        return Http::baseUrl(rtrim((string) config('services.microservicio.base_url'), '/'))
            ->acceptJson()
            ->timeout((int) config('services.microservicio.timeout', 45))
            ->connectTimeout((int) config('services.microservicio.connect_timeout', 10));
    }

    private function maskSensitivePayload(array $payload): array
    {
        $masked = $payload;
        foreach (['password', 'cookies'] as $key) {
            if (array_key_exists($key, $masked) && is_string($masked[$key])) {
                $masked[$key] = '***';
            }
        }
        return $masked;
    }
}

