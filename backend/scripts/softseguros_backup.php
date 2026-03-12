<?php
/**
 * ============================================================
 * SOFTSEGUROS.COM → GURO BACKUP / MIGRACIÓN
 * ============================================================
 * 
 * Este script extrae TODA la información de una cuenta de
 * Softseguros vía API y la guarda en archivos JSON organizados.
 * 
 * USO:
 *   php softseguros_backup.php
 * 
 * Se pedirá usuario y contraseña de Softseguros.
 * El backup se guarda en: backups/softseguros_{fecha}/
 * 
 * ENTIDADES QUE DESCARGA:
 *   - Clientes (con datos extra CRM)
 *   - Pólizas (con beneficiarios, vinculados, anexos)
 *   - Siniestros
 *   - Contactos
 *   - Aseguradoras
 *   - Ramos (principales, subramos, ramos)
 *   - Categorías
 *   - Vendedores
 *   - Negocios
 *   - Estados de póliza
 * ============================================================
 */

// ── CONFIG ──────────────────────────────────────────────────
define('BASE_URL', 'https://app.softseguros.com');
define('PAGE_SIZE', 10); // Softseguros devuelve máx 10 por página
define('DELAY_MS', 200); // Delay entre requests para no saturar
define('MAX_RETRIES', 3);

// ── COLORES TERMINAL ────────────────────────────────────────
function c($text, $color) {
    $colors = [
        'green'  => "\033[32m",
        'red'    => "\033[31m",
        'yellow' => "\033[33m",
        'blue'   => "\033[34m",
        'cyan'   => "\033[36m",
        'bold'   => "\033[1m",
        'reset'  => "\033[0m",
    ];
    return ($colors[$color] ?? '') . $text . $colors['reset'];
}

function banner() {
    echo "\n";
    echo c("╔══════════════════════════════════════════════════════╗\n", 'cyan');
    echo c("║     SOFTSEGUROS → GURO  |  Backup & Migración      ║\n", 'cyan');
    echo c("╚══════════════════════════════════════════════════════╝\n", 'cyan');
    echo "\n";
}

// ── HTTP CLIENT ─────────────────────────────────────────────
class SoftSegurosClient {
    private string $token = '';
    private string $username = '';
    private int $requestCount = 0;
    private float $startTime;

    public function __construct() {
        $this->startTime = microtime(true);
    }

    /**
     * Autenticar con usuario y contraseña → obtener Token
     */
    public function authenticate(string $username, string $password): bool {
        $this->username = $username;
        
        echo c("🔐 Autenticando como {$username}...", 'yellow') . "\n";

        // Intentar autenticación por Token
        $response = $this->httpPost('/api-token-auth/', [
            'username' => $username,
            'password' => $password,
        ], false);

        if ($response && isset($response['token'])) {
            $this->token = $response['token'];
            echo c("✅ Autenticación exitosa. Token obtenido.", 'green') . "\n\n";
            return true;
        }

        // Fallback: intentar Basic Auth
        $basicAuth = base64_encode("{$username}:{$password}");
        $test = $this->httpGet('/api/estadopoliza/', [], "Basic {$basicAuth}");
        
        if ($test && !isset($test['detail'])) {
            $this->token = "BASIC:{$basicAuth}";
            echo c("✅ Autenticación exitosa (Basic Auth).", 'green') . "\n\n";
            return true;
        }

        echo c("❌ Error de autenticación. Verifica usuario y contraseña.", 'red') . "\n";
        return false;
    }

    /**
     * GET request con paginación
     */
    public function fetchAllPaginated(string $endpoint, string $label, array $extraParams = []): array {
        $allResults = [];
        $page = 1;
        $totalPages = null;
        $totalCount = null;

        echo c("📥 Descargando {$label}...", 'blue');

        while (true) {
            $params = array_merge(['page' => $page], $extraParams);
            $response = $this->httpGet($endpoint, $params);

            if (!$response) {
                echo c(" ❌ Error en página {$page}", 'red') . "\n";
                break;
            }

            // La API devuelve { count, next, previous, results }
            if (isset($response['results'])) {
                $results = $response['results'];
                $allResults = array_merge($allResults, $results);
                
                $totalCount = $response['count'] ?? count($allResults);
                $totalPages = ceil($totalCount / PAGE_SIZE);

                // Progreso
                $pct = $totalPages > 0 ? round(($page / $totalPages) * 100) : 100;
                echo "\r" . c("📥 Descargando {$label}... ", 'blue') 
                    . c("{$pct}%", 'bold') 
                    . " ({$page}/{$totalPages} págs, " . count($allResults) . "/{$totalCount} registros)";

                // ¿Hay más páginas?
                if (empty($response['next']) || $response['next'] === 'null') {
                    break;
                }
                $page++;
            } elseif (is_array($response) && !isset($response['detail'])) {
                // Algunos endpoints devuelven array directo (sin paginación)
                $allResults = $response;
                break;
            } else {
                echo c(" ⚠️  Respuesta inesperada", 'yellow') . "\n";
                break;
            }

            usleep(DELAY_MS * 1000);
        }

        echo "\r" . c("✅ {$label}: ", 'green') . c(count($allResults) . " registros", 'bold') . str_repeat(' ', 40) . "\n";
        return $allResults;
    }

    /**
     * GET simple (sin paginación)
     */
    public function fetchAll(string $endpoint, string $label): array {
        echo c("📥 Descargando {$label}...", 'blue');
        $response = $this->httpGet($endpoint);
        
        if (!$response) {
            echo c(" ❌ Error", 'red') . "\n";
            return [];
        }

        // Puede venir como {results: [...]} o como array directo
        $data = $response['results'] ?? $response;
        if (!is_array($data)) $data = [];

        echo "\r" . c("✅ {$label}: ", 'green') . c(count($data) . " registros", 'bold') . str_repeat(' ', 40) . "\n";
        return $data;
    }

    /**
     * Fetch detalle por ID
     */
    public function fetchById(string $endpoint, $id): ?array {
        $response = $this->httpGet("{$endpoint}{$id}/");
        return $response ?: null;
    }

    /**
     * HTTP GET
     */
    private function httpGet(string $path, array $params = [], ?string $authOverride = null): ?array {
        $url = BASE_URL . $path;
        if ($params) {
            $url .= '?' . http_build_query($params);
        }

        return $this->httpRequest('GET', $url, null, $authOverride);
    }

    /**
     * HTTP POST
     */
    private function httpPost(string $path, array $body, bool $useAuth = true): ?array {
        $url = BASE_URL . $path;
        return $this->httpRequest('POST', $url, $body, $useAuth ? null : 'NONE');
    }

    /**
     * HTTP Request base
     */
    private function httpRequest(string $method, string $url, ?array $body = null, ?string $authOverride = null): ?array {
        for ($retry = 0; $retry < MAX_RETRIES; $retry++) {
            $ch = curl_init();
            
            $headers = [
                'Content-Type: application/json',
                'Accept: application/json',
            ];

            // Auth header
            if ($authOverride === 'NONE') {
                // No auth
            } elseif ($authOverride) {
                $headers[] = "Authorization: {$authOverride}";
            } elseif ($this->token) {
                if (str_starts_with($this->token, 'BASIC:')) {
                    $headers[] = "Authorization: Basic " . substr($this->token, 6);
                } else {
                    $headers[] = "Authorization: Token {$this->token}";
                }
            }

            curl_setopt_array($ch, [
                CURLOPT_URL => $url,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => $headers,
                CURLOPT_TIMEOUT => 30,
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_FOLLOWLOCATION => true,
            ]);

            if ($method === 'POST' && $body !== null) {
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
            }

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);

            $this->requestCount++;

            if ($error) {
                if ($retry < MAX_RETRIES - 1) {
                    usleep(1000000); // 1s retry delay
                    continue;
                }
                return null;
            }

            if ($httpCode === 429) {
                // Rate limited — esperar y reintentar
                echo c(" ⏳ Rate limited, esperando 5s...", 'yellow');
                sleep(5);
                continue;
            }

            if ($httpCode >= 200 && $httpCode < 300) {
                return json_decode($response, true);
            }

            if ($httpCode === 401 || $httpCode === 403) {
                return ['detail' => 'Unauthorized'];
            }

            if ($retry < MAX_RETRIES - 1) {
                usleep(500000);
                continue;
            }

            return null;
        }

        return null;
    }

    public function getStats(): array {
        return [
            'requests' => $this->requestCount,
            'duration' => round(microtime(true) - $this->startTime, 1),
            'username' => $this->username,
        ];
    }
}

// ── BACKUP ENGINE ───────────────────────────────────────────
class SoftSegurosBackup {
    private SoftSegurosClient $client;
    private string $outputDir;
    private array $summary = [];

    public function __construct(SoftSegurosClient $client) {
        $this->client = $client;
        
        $date = date('Y-m-d_His');
        $this->outputDir = __DIR__ . "/../backups/softseguros_{$date}";
        
        if (!is_dir($this->outputDir)) {
            mkdir($this->outputDir, 0755, true);
        }
    }

    /**
     * Ejecutar backup completo
     */
    public function run(): void {
        echo c("📁 Guardando en: {$this->outputDir}/\n\n", 'cyan');

        // ── 1. Catálogos base (no paginados o pocos registros) ──
        echo c("━━━ CATÁLOGOS BASE ━━━\n", 'bold');
        
        $estadosPoliza = $this->downloadAndSave(
            '/api/estadopoliza/', 'estados_poliza', 'Estados de póliza', false
        );

        $aseguradoras = $this->downloadAndSave(
            '/api/aseguradora/', 'aseguradoras', 'Aseguradoras'
        );

        $ramosGlobales = $this->downloadAndSave(
            '/api/ramosglobales/', 'ramos_globales', 'Ramos principales'
        );

        $subramos = $this->downloadAndSave(
            '/api/ramomarca/', 'subramos', 'Subramos'
        );

        $ramos = $this->downloadAndSave(
            '/api/ramo/', 'ramos', 'Ramos (aseguradora+subramo)'
        );

        $categorias = $this->downloadAndSave(
            '/api/categoria/', 'categorias', 'Categorías', false
        );

        $vendedores = $this->downloadAndSave(
            '/api/vendedor/', 'vendedores', 'Vendedores'
        );

        echo "\n";

        // ── 2. Clientes ──
        echo c("━━━ CLIENTES ━━━\n", 'bold');
        
        $clientes = $this->downloadAndSave(
            '/api/cliente/list_clientes_filtro_paginados/', 'clientes', 'Clientes'
        );

        // Datos extra CRM de clientes
        $datosExtra = $this->downloadAndSave(
            '/api/datosextrascliente/', 'datos_extra_clientes', 'Datos extra CRM'
        );

        // Contactos
        $contactos = $this->downloadAndSave(
            '/api/contacto/', 'contactos', 'Contactos'
        );

        echo "\n";

        // ── 3. Pólizas ──
        echo c("━━━ PÓLIZAS ━━━\n", 'bold');
        
        $polizas = $this->downloadAndSave(
            '/api/poliza/', 'polizas', 'Pólizas'
        );

        // Anexos de pólizas
        $anexos = $this->downloadAndSave(
            '/api/anexopoliza/list_anexos_polizas_filtro_paginados/', 'anexos_polizas', 'Anexos de pólizas'
        );

        // Beneficiarios
        $beneficiarios = $this->downloadAndSave(
            '/api/beneficiariopolizariesgo/', 'beneficiarios', 'Beneficiarios'
        );

        // Vinculados (riesgos asegurados)
        $vinculados = $this->downloadAndSave(
            '/api/riesgoasegurado/', 'vinculados', 'Vinculados/Asegurados'
        );

        echo "\n";

        // ── 4. Siniestros ──
        echo c("━━━ SINIESTROS ━━━\n", 'bold');
        
        $siniestros = $this->downloadAndSave(
            '/api/siniestro/list_paginado/', 'siniestros', 'Siniestros'
        );

        echo "\n";

        // ── 5. Negocios (CRM/Pipeline) ──
        echo c("━━━ NEGOCIOS ━━━\n", 'bold');
        
        $negocios = $this->downloadAndSave(
            '/api/negocio/', 'negocios', 'Negocios'
        );

        echo "\n";

        // ── Generar resumen ──
        $this->generateSummary();
    }

    /**
     * Descargar y guardar en JSON
     */
    private function downloadAndSave(string $endpoint, string $filename, string $label, bool $paginated = true): array {
        if ($paginated) {
            $data = $this->client->fetchAllPaginated($endpoint, $label);
        } else {
            $data = $this->client->fetchAll($endpoint, $label);
        }

        $filepath = "{$this->outputDir}/{$filename}.json";
        file_put_contents($filepath, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        
        $size = $this->formatBytes(filesize($filepath));
        $this->summary[$label] = count($data);

        return $data;
    }

    /**
     * Generar archivo de resumen
     */
    private function generateSummary(): void {
        $stats = $this->client->getStats();
        
        $summary = [
            'backup_info' => [
                'source' => 'softseguros.com',
                'username' => $stats['username'],
                'date' => date('Y-m-d H:i:s'),
                'timezone' => date_default_timezone_get(),
                'duration_seconds' => $stats['duration'],
                'total_api_requests' => $stats['requests'],
            ],
            'record_counts' => $this->summary,
            'total_records' => array_sum($this->summary),
            'files' => [],
        ];

        // Listar archivos generados
        foreach (glob("{$this->outputDir}/*.json") as $file) {
            $summary['files'][] = [
                'name' => basename($file),
                'size' => $this->formatBytes(filesize($file)),
                'records' => json_decode(file_get_contents($file), true) ? count(json_decode(file_get_contents($file), true)) : 0,
            ];
        }

        file_put_contents(
            "{$this->outputDir}/RESUMEN.json",
            json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        // Imprimir resumen
        echo c("╔══════════════════════════════════════════════════════╗\n", 'green');
        echo c("║                BACKUP COMPLETADO                    ║\n", 'green');
        echo c("╚══════════════════════════════════════════════════════╝\n", 'green');
        echo "\n";
        
        echo c("📊 Resumen:\n", 'bold');
        foreach ($this->summary as $label => $count) {
            $padded = str_pad($label, 35, '.');
            echo "   {$padded} " . c(number_format($count), 'bold') . "\n";
        }
        echo "   " . str_repeat('─', 45) . "\n";
        echo "   " . str_pad('TOTAL', 35, '.') . " " . c(number_format(array_sum($this->summary)), 'bold') . "\n";
        
        echo "\n";
        echo c("⏱️  Duración: ", 'cyan') . "{$stats['duration']}s\n";
        echo c("🌐 Requests: ", 'cyan') . "{$stats['requests']}\n";
        echo c("📁 Carpeta:  ", 'cyan') . "{$this->outputDir}/\n";
        echo "\n";
    }

    private function formatBytes(int $bytes): string {
        if ($bytes >= 1048576) return round($bytes / 1048576, 1) . ' MB';
        if ($bytes >= 1024) return round($bytes / 1024, 1) . ' KB';
        return $bytes . ' B';
    }
}

// ── MAIN ────────────────────────────────────────────────────
banner();

// Verificar que estamos en CLI
if (php_sapi_name() !== 'cli') {
    die("Este script debe ejecutarse desde la línea de comandos.\n");
}

// Pedir credenciales
echo c("Ingresa las credenciales de Softseguros:\n", 'bold');

echo "  Usuario: ";
$username = trim(fgets(STDIN));

// Ocultar contraseña en terminales que lo soporten
if (function_exists('readline')) {
    echo "  Contraseña: ";
    system('stty -echo 2>/dev/null');
    $password = trim(fgets(STDIN));
    system('stty echo 2>/dev/null');
    echo "\n";
} else {
    echo "  Contraseña: ";
    $password = trim(fgets(STDIN));
}

if (empty($username) || empty($password)) {
    echo c("\n❌ Usuario y contraseña son requeridos.\n", 'red');
    exit(1);
}

// Autenticar
$client = new SoftSegurosClient();
if (!$client->authenticate($username, $password)) {
    exit(1);
}

// Ejecutar backup
$backup = new SoftSegurosBackup($client);
$backup->run();

echo c("🎉 ¡Backup listo! Ahora puedes importar estos datos en Guro.\n\n", 'green');
