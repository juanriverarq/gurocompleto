<?php

namespace App\Jobs;

use App\Models\InsurerConnection;
use App\Services\MicroservicioInsurerService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;

/**
 * Job asíncrono para login a aseguradoras (Playwright/HTTP).
 * Reemplaza el flujo síncrono que bloqueaba el request HTTP 30-180s.
 *
 * Modos:
 *  - connect          → MicroservicioInsurerService::connect (HTTP)
 *  - connect_auto     → connectAuto con MFA (Belvo-style, SURA)
 *  - connect_browser  → connectBrowser (Playwright headful)
 *  - reconnect        → re-login con credenciales guardadas
 *
 * Para SURA con MFA el job termina en estado `requires_mfa` con
 * `connect_job_challenge_id`. El frontend pide OTP y dispatcha un nuevo
 * job en modo `connect_auto` con challenge_id + mfa_code.
 */
class ConnectInsurerJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;
    public int $timeout = 240;

    /** @var string credenciales encriptadas (Crypt::encryptString(json)) o null */
    private ?string $credentialsEncrypted;

    public function __construct(
        private readonly int $connectionId,
        private readonly string $insurerCode,
        private readonly string $mode,
        ?array $credentials = null,
        private readonly ?string $mfaCode = null,
        private readonly ?string $challengeId = null,
    ) {
        $this->credentialsEncrypted = $credentials !== null
            ? Crypt::encryptString(json_encode($credentials))
            : null;
    }

    public function handle(MicroservicioInsurerService $microservice): void
    {
        $connection = InsurerConnection::find($this->connectionId);
        if (!$connection) {
            Log::warning('[CONNECT JOB] Connection not found', ['id' => $this->connectionId]);
            return;
        }

        $connection->update([
            'connect_job_status'     => 'processing',
            'connect_job_started_at' => now(),
            'connect_job_message'    => 'Conectando con la aseguradora…',
            'connect_job_error'      => null,
        ]);

        $credentials = $this->decryptCredentials();

        try {
            $result = match ($this->mode) {
                'connect_auto'    => $microservice->connectAuto($this->insurerCode, $credentials ?? [], $this->mfaCode, $this->challengeId),
                'connect_browser' => $microservice->connectBrowser($this->insurerCode, $connection->broker_id),
                default           => $microservice->connect($this->insurerCode, $credentials ?? []),
            };

            // ── MFA requerido (SURA) — pausa el job en estado intermedio ──
            if (!($result['success'] ?? false) && ($result['requires_mfa'] ?? false)) {
                $connection->update([
                    'connect_job_status'        => 'requires_mfa',
                    'connect_job_challenge_id'  => $result['challenge_id'] ?? null,
                    'connect_job_message'       => $result['message'] ?? 'Ingresa el código del Authenticator',
                    'connect_job_finished_at'   => now(),
                ]);
                return;
            }

            if (!($result['success'] ?? false)) {
                $errorMsg = $result['error'] ?? $result['message'] ?? 'No fue posible conectar';
                if (is_array($errorMsg)) {
                    $errorMsg = json_encode($errorMsg);
                }
                $connection->update([
                    'connect_job_status'      => 'failed',
                    'connect_job_error'       => substr((string) $errorMsg, 0, 1000),
                    'connect_job_message'     => $result['message'] ?? 'No fue posible conectar',
                    'connect_job_finished_at' => now(),
                    'status'                  => $connection->status === 'connected' ? $connection->status : 'reconnect_required',
                    'last_error'              => substr((string) $errorMsg, 0, 1000),
                ]);
                return;
            }

            // ── Éxito: persistir sesión ──
            $payload = $result['payload'] ?? [];
            $connection->fill([
                'status'                   => 'connected',
                'microservice_session_id'  => $result['session_id'],
                'session_payload'          => $payload,
                'connected_at'             => now(),
                'last_healthcheck_at'      => now(),
                'expires_at'               => $result['expires_at'] ?? null,
                'last_error'               => null,
                'reconnect_count'          => 0,
                'credentials_valid'        => true,
                'connect_job_status'       => 'success',
                'connect_job_message'      => $result['message'] ?? 'Aseguradora conectada correctamente',
                'connect_job_error'        => null,
                'connect_job_challenge_id' => null,
                'connect_job_finished_at'  => now(),
            ]);

            // Guardar credenciales solo en step 1 de connect_auto (cuando vinieron) o en connect estándar
            if ($credentials !== null && $this->mode !== 'connect_browser') {
                if ($this->mode === 'connect_auto') {
                    // Solo persistir si trajo credenciales nuevas (step 1, no step 2)
                    if (!empty($credentials['doc_number']) && !empty($credentials['password'])) {
                        $connection->credentials = [
                            'doc_type'   => $credentials['doc_type'] ?? 'C',
                            'doc_number' => $credentials['doc_number'],
                            'password'   => $credentials['password'],
                        ];
                    }
                } else {
                    $connection->credentials = $credentials;
                }
            } elseif ($this->mode === 'connect_browser') {
                $connection->credentials = null;
            }

            $connection->save();

            Log::info('[CONNECT JOB] Conexión exitosa', [
                'insurer'    => $this->insurerCode,
                'mode'       => $this->mode,
                'session_id' => $result['session_id'],
            ]);
        } catch (\Throwable $e) {
            Log::error('[CONNECT JOB] Excepción', [
                'insurer' => $this->insurerCode,
                'mode'    => $this->mode,
                'error'   => $e->getMessage(),
            ]);
            $connection->update([
                'connect_job_status'      => 'failed',
                'connect_job_error'       => substr($e->getMessage(), 0, 1000),
                'connect_job_message'     => 'Error inesperado: ' . $e->getMessage(),
                'connect_job_finished_at' => now(),
            ]);
        }
    }

    public function failed(?\Throwable $exception): void
    {
        $connection = InsurerConnection::find($this->connectionId);
        if ($connection) {
            $connection->update([
                'connect_job_status'      => 'failed',
                'connect_job_error'       => $exception?->getMessage() ?? 'El job falló',
                'connect_job_message'     => 'El job de conexión falló',
                'connect_job_finished_at' => now(),
            ]);
        }
    }

    private function decryptCredentials(): ?array
    {
        if (!$this->credentialsEncrypted) {
            return null;
        }
        try {
            $decoded = json_decode(Crypt::decryptString($this->credentialsEncrypted), true);
            return is_array($decoded) ? $decoded : null;
        } catch (\Throwable $e) {
            Log::warning('[CONNECT JOB] No se pudieron descifrar credenciales', ['error' => $e->getMessage()]);
            return null;
        }
    }
}
