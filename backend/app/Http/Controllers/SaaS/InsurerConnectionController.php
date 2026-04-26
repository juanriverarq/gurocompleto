<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Jobs\ConnectInsurerJob;
use App\Models\Broker;
use App\Models\InsurerConnection;
use App\Services\MicroservicioInsurerService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class InsurerConnectionController extends Controller
{
    public function __construct(private readonly MicroservicioInsurerService $microservice)
    {
    }

    public function index(Request $request)
    {
        try {
            $brokerId = $this->resolveBrokerId($request);
            $existing = InsurerConnection::forBroker($brokerId)->get()->keyBy('insurer_code');

            $catalog = [
                'sura' => 'Sura',
                'bolivar' => 'Bolívar',
                'hdi' => 'HDI',
                'axa-colpatria' => 'Axa Colpatria',
                'seguros-del-estado' => 'Seguros del Estado',
                'la-equidad' => 'La Equidad',
            ];

            $rows = [];
            foreach ($catalog as $code => $name) {
                $row = $existing->get($code);
                $hasCredentials = !empty($row?->credentials_encrypted);
                $rows[] = [
                    'insurer_code' => $code,
                    'name' => $name,
                    'status' => $row?->status ?? 'disconnected',
                    'connected' => $row?->status === 'connected',
                    'connected_at' => $row?->connected_at?->toISOString(),
                    'expires_at' => $row?->expires_at?->toISOString(),
                    'last_healthcheck_at' => $row?->last_healthcheck_at?->toISOString(),
                    'last_error' => $row?->last_error,
                    'last_sync_at' => $row?->last_sync_at?->toISOString(),
                    'microservice_session_id' => $row?->microservice_session_id,
                    'auto_reconnect_available' => $hasCredentials,
                    'credentials_valid' => $row?->credentials_valid ?? true,
                    'ttl_seconds' => $row?->expires_at ? max(0, (int) now()->diffInSeconds($row->expires_at, false)) : null,
                ];
            }

            return response()->json([
                'success' => true,
                'message' => 'Conexiones obtenidas correctamente',
                'data' => $rows,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'No fue posible obtener conexiones',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function connect(Request $request, string $insurer)
    {
        try {
            $brokerId = $this->resolveBrokerId($request);
            if (!$this->microservice->isSupported($insurer)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Aseguradora no soportada',
                ], 422);
            }

            $credentials = $request->input('credentials', []);
            if (!is_array($credentials)) {
                return response()->json([
                    'success' => false,
                    'message' => 'El campo credentials debe ser un objeto',
                ], 422);
            }

            // Validación rápida (síncrona) de campos requeridos antes de encolar.
            $validation = $this->microservice->validateCredentials($insurer, $credentials);
            if (!$validation['ok']) {
                return response()->json([
                    'success' => false,
                    'message' => $validation['message'],
                ], 422);
            }

            return $this->dispatchConnectJob($brokerId, $insurer, 'connect', $credentials);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'No fue posible iniciar la conexión',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function reconnect(Request $request, string $insurer)
    {
        try {
            $brokerId = $this->resolveBrokerId($request);
            $connection = InsurerConnection::forBroker($brokerId)
                ->where('insurer_code', $insurer)
                ->first();

            if (!$connection) {
                return response()->json([
                    'success' => false,
                    'message' => 'No existe conexión guardada para reconectar',
                ], 404);
            }

            $credentials = $connection->credentials;
            if (empty($credentials)) {
                return response()->json([
                    'success' => false,
                    'message' => 'No hay credenciales guardadas para reconectar',
                ], 422);
            }

            return $this->dispatchConnectJob($brokerId, $insurer, 'connect', $credentials);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error en reconexión',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function healthCheck(Request $request, string $insurer)
    {
        try {
            $brokerId = $this->resolveBrokerId($request);
            $connection = InsurerConnection::forBroker($brokerId)
                ->where('insurer_code', $insurer)
                ->first();

            if (!$connection) {
                return response()->json([
                    'success' => false,
                    'message' => 'No existe conexión para esta aseguradora',
                ], 404);
            }

            $health = $this->microservice->checkHealth($connection);
            $connection->last_healthcheck_at = now();

            if ($health['success']) {
                $connection->status = 'connected';
                $connection->last_error = null;
                $connection->reconnect_count = 0;
                $connection->save();
            } else {
                // ── Reconexión transparente ASYNC: si hay credenciales, encolar job y devolver 202 ──
                $credentials = $connection->credentials;
                if (!empty($credentials)) {
                    $connection->status = 'reconnect_required';
                    $connection->last_error = $health['error'] ?? ($health['message'] ?? 'Healthcheck falló');
                    $connection->save();

                    // Para SURA usamos connect_auto (puede pedir MFA), para el resto connect estándar
                    $mode = $connection->insurer_code === 'sura' ? 'connect_auto' : 'connect';
                    return $this->dispatchConnectJob(
                        $brokerId,
                        $connection->insurer_code,
                        $mode,
                        $credentials,
                    );
                }

                $connection->status = 'reconnect_required';
                $connection->last_error = $health['error'] ?? ($health['message'] ?? 'Healthcheck falló');
                $connection->save();
            }

            return response()->json([
                'success' => $health['success'],
                'message' => $health['message'] ?? ($health['success'] ? 'Conexión saludable' : 'Healthcheck falló'),
                'data' => [
                    'insurer_code' => $connection->insurer_code,
                    'status' => $connection->status,
                    'connected' => $connection->status === 'connected',
                    'last_error' => $connection->last_error,
                    'last_healthcheck_at' => $connection->last_healthcheck_at?->toISOString(),
                ],
            ], $health['success'] ? 200 : 422);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error en healthcheck',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function sessionStatus(Request $request, string $insurer)
    {
        try {
            $brokerId = $this->resolveBrokerId($request);
            $connection = InsurerConnection::forBroker($brokerId)
                ->where('insurer_code', $insurer)
                ->first();

            if (!$connection) {
                return response()->json([
                    'status' => 'disconnected',
                    'ttl_seconds' => null,
                    'auto_reconnect_available' => false,
                    'credentials_valid' => true,
                ]);
            }

            $hasCredentials = !empty($connection->credentials_encrypted);
            $ttl = $connection->expires_at ? max(0, (int) now()->diffInSeconds($connection->expires_at, false)) : null;

            return response()->json([
                'status' => $connection->status,
                'ttl_seconds' => $ttl,
                'auto_reconnect_available' => $hasCredentials,
                'credentials_valid' => $connection->credentials_valid ?? true,
                'last_reconnect_at' => $connection->last_reconnect_at?->toISOString(),
                'connected_at' => $connection->connected_at?->toISOString(),
                'expires_at' => $connection->expires_at?->toISOString(),
                'microservice_session_id' => $connection->microservice_session_id,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status' => 'error',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function disconnect(Request $request, string $insurer)
    {
        try {
            $brokerId = $this->resolveBrokerId($request);
            $connection = InsurerConnection::forBroker($brokerId)
                ->where('insurer_code', $insurer)
                ->first();

            if (!$connection) {
                return response()->json([
                    'success' => true,
                    'message' => 'Conexión ya estaba desconectada',
                ]);
            }

            $connection->status = 'disconnected';
            $connection->microservice_session_id = null;
            $connection->session_payload = null;
            $connection->connected_at = null;
            $connection->expires_at = null;
            $connection->last_healthcheck_at = now();
            $connection->last_error = null;
            $connection->save();

            return response()->json([
                'success' => true,
                'message' => 'Aseguradora desconectada',
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'No fue posible desconectar',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Headless auto-login con credenciales + MFA (Belvo-style).
     * Body: { credentials: {doc_type, doc_number, password}, mfa_code?: string }
     *
     * Respuestas:
     *   200  → {success:true, data:{session_id,...}}
     *   202  → {success:false, requires_mfa:true, message:"..."} → el frontend pide OTP y reintenta con mfa_code
     *   422+ → error de credenciales / upstream
     */
    public function connectAuto(Request $request, string $insurer)
    {
        try {
            $brokerId = $this->resolveBrokerId($request);
            if (!$this->microservice->isSupported($insurer)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Aseguradora no soportada',
                ], 422);
            }

            $credentials = $request->input('credentials', []);
            if (!is_array($credentials)) {
                return response()->json([
                    'success' => false,
                    'message' => 'El campo credentials debe ser un objeto',
                ], 422);
            }
            $mfaCode = $request->input('mfa_code');
            $challengeId = $request->input('challenge_id');

            return $this->dispatchConnectJob(
                $brokerId,
                $insurer,
                'connect_auto',
                $challengeId ? null : $credentials,
                $mfaCode,
                $challengeId
            );
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'No fue posible iniciar la conexión',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function connectBrowser(Request $request, string $insurer)
    {
        try {
            $brokerId = $this->resolveBrokerId($request);
            return $this->dispatchConnectJob($brokerId, $insurer, 'connect_browser');
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'No fue posible iniciar la conexión',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Estado del job de conexión (para polling desde el frontend).
     * Devuelve: idle | queued | processing | requires_mfa | success | failed
     */
    public function connectStatus(Request $request, string $insurer)
    {
        try {
            $brokerId = $this->resolveBrokerId($request);
            $connection = InsurerConnection::forBroker($brokerId)
                ->where('insurer_code', $insurer)
                ->first();

            if (!$connection) {
                return response()->json([
                    'success' => true,
                    'data' => [
                        'connect_job_status' => 'idle',
                        'connected' => false,
                    ],
                ]);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'insurer_code'        => $connection->insurer_code,
                    'status'              => $connection->status,
                    'connected'           => $connection->status === 'connected',
                    'connect_job_status'  => $connection->connect_job_status ?? 'idle',
                    'connect_job_id'      => $connection->connect_job_id,
                    'connect_job_mode'    => $connection->connect_job_mode,
                    'connect_job_message' => $connection->connect_job_message,
                    'connect_job_error'   => $connection->connect_job_error,
                    'requires_mfa'        => $connection->connect_job_status === 'requires_mfa',
                    'challenge_id'        => $connection->connect_job_challenge_id,
                    'started_at'          => $connection->connect_job_started_at?->toISOString(),
                    'finished_at'         => $connection->connect_job_finished_at?->toISOString(),
                    'connected_at'        => $connection->connected_at?->toISOString(),
                    'expires_at'          => $connection->expires_at?->toISOString(),
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Encola ConnectInsurerJob, marca la conexión como `queued` y devuelve 202.
     */
    private function dispatchConnectJob(
        int $brokerId,
        string $insurer,
        string $mode,
        ?array $credentials = null,
        ?string $mfaCode = null,
        ?string $challengeId = null,
    ) {
        $connection = InsurerConnection::firstOrNew([
            'broker_id' => $brokerId,
            'insurer_code' => $insurer,
        ]);
        if (!$connection->exists) {
            $connection->status = 'disconnected';
            $connection->save();
        }

        $jobId = (string) Str::uuid();
        $connection->update([
            'connect_job_status'      => 'queued',
            'connect_job_id'          => $jobId,
            'connect_job_mode'        => $mode,
            'connect_job_message'     => 'Conexión en cola…',
            'connect_job_error'       => null,
            'connect_job_challenge_id'=> $challengeId,
            'connect_job_started_at'  => null,
            'connect_job_finished_at' => null,
        ]);

        ConnectInsurerJob::dispatch(
            $connection->id,
            $insurer,
            $mode,
            $credentials,
            $mfaCode,
            $challengeId,
        );

        return response()->json([
            'success' => true,
            'queued'  => true,
            'message' => 'Conexión iniciada en segundo plano',
            'data' => [
                'insurer_code'       => $insurer,
                'connect_job_id'     => $jobId,
                'connect_job_status' => 'queued',
                'connect_job_mode'   => $mode,
            ],
        ], 202);
    }

    private function resolveBrokerId(Request $request): int
    {
        if ($request->has('authenticated_broker_id')) {
            return (int) $request->get('authenticated_broker_id');
        }

        $user = $request->user() ?: Auth::user();
        if ($user && !empty($user->broker_id)) {
            return (int) $user->broker_id;
        }

        if (app()->environment(['local', 'development'])) {
            $devBrokerId = $request->header('X-Dev-Broker-Id');
            if ($devBrokerId) {
                return (int) $devBrokerId;
            }

            $firstBroker = Broker::first();
            if ($firstBroker) {
                return (int) $firstBroker->id;
            }
        }

        throw new \RuntimeException('No se pudo resolver broker_id para la solicitud.');
    }
}

