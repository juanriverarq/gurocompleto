<?php

namespace App\Jobs;

use App\Models\InsurerConnection;
use App\Models\SyncJob;
use App\Services\InsurerSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Queue\Middleware\RateLimitedWithRedis;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Sync principal de aseguradora: clientes + pólizas + cartera + comisiones.
 * Estos son los syncs RECURRENTES (diarios). Vive en queue 'sync' separada
 * de la queue 'default' (web) para no bloquear requests interactivos.
 *
 * Garantías:
 * - WithoutOverlapping(broker_id, insurer): nunca dos syncs del mismo broker+aseguradora a la vez.
 * - Retry con backoff exponencial si el microservicio externo falla.
 * - Cursor por tipo en progress: reanuda donde quedó sin re-empezar todo.
 * - Circuit breaker por aseguradora: si la aseguradora cae, no insiste.
 */
class SyncInsurerJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Reintentos: 3 attempts con backoff exponencial. */
    public int $tries = 3;

    /** Backoff entre attempts: 30s, 120s, 300s. */
    public function backoff(): array
    {
        return [30, 120, 300];
    }

    /** Timeout: 30 min. Suficiente para syncs grandes; los workers deben tener --timeout >= esto. */
    public int $timeout = 1800;

    /** Marca el job como failed si la conexión a BD/redis se cae mid-job. */
    public bool $failOnTimeout = true;

    public function __construct(
        private readonly int $syncJobId,
        private readonly int $brokerId,
        private readonly string $insurerCode,
        private readonly array $types,
    ) {
        // Queue dedicada para sync de info básica (no compite con la web).
        $this->onQueue('sync');
    }

    /**
     * Garantías de concurrencia:
     * - Nunca dos syncs del mismo broker+insurer a la vez (evita colisiones de sesión).
     * - Rate limit global por aseguradora: máx 3 syncs simultáneos (protege portal de la aseguradora).
     */
    public function middleware(): array
    {
        return [
            (new WithoutOverlapping("sync:{$this->brokerId}:{$this->insurerCode}"))
                ->expireAfter(1900)        // si crashea, libera el lock
                ->dontRelease(),           // si encuentra colisión, descarta este intento (otro está corriendo)
            (new RateLimited("insurer:{$this->insurerCode}")),
        ];
    }

    /**
     * Tags para Horizon / debugging.
     */
    public function tags(): array
    {
        return [
            'sync',
            "broker:{$this->brokerId}",
            "insurer:{$this->insurerCode}",
            "syncjob:{$this->syncJobId}",
        ];
    }

    public function handle(InsurerSyncService $syncService): void
    {
        $syncJob = SyncJob::find($this->syncJobId);
        if (!$syncJob) {
            Log::error('[SYNC JOB] SyncJob row not found', ['id' => $this->syncJobId]);
            return;
        }

        $syncJob->refresh();
        if (in_array($syncJob->status, ['cancelled', 'completed'], true)) {
            return;
        }

        // Circuit breaker por aseguradora: si la aseguradora cayó hace poco,
        // no insistimos (protege contra rate limit del proveedor y ahorra browser).
        $breakerKey = "insurer-down:{$this->insurerCode}";
        if (Cache::has($breakerKey)) {
            $until = Cache::get($breakerKey);
            Log::warning('[SYNC JOB] Circuit breaker abierto', [
                'insurer' => $this->insurerCode,
                'until' => $until,
            ]);
            // No marcamos failed — soltamos el job y Laravel lo reintenta tras backoff
            $this->release(900); // 15 min
            return;
        }

        // Health-check del microservicio antes de procesar. Si está caído, soltamos
        // el job para que se reintente más tarde sin contar como fallo definitivo.
        if (!$this->microserviceHealthy()) {
            Log::warning('[SYNC JOB] Microservicio no responde, reintentando en 60s', [
                'insurer' => $this->insurerCode,
            ]);
            $this->release(60);
            return;
        }

        // Transición atómica: no pisar "cancelled" si el usuario detuvo el batch entre el dispatch y este handle.
        $updated = SyncJob::query()
            ->whereKey($this->syncJobId)
            ->whereNotIn('status', ['cancelled', 'completed'])
            ->update([
                'status' => 'processing',
                'started_at' => now(),
            ]);

        $syncJob->refresh();
        if ($syncJob->status === 'cancelled') {
            return;
        }

        if ($syncJob->status !== 'processing') {
            Log::warning('[SYNC JOB] Estado inesperado tras transición', [
                'id' => $this->syncJobId,
                'status' => $syncJob->status,
                'rows_updated' => $updated,
            ]);
            return;
        }

        $conn = InsurerConnection::where('broker_id', $this->brokerId)
            ->where('insurer_code', $this->insurerCode)
            ->where('status', 'connected')
            ->first();

        if (!$conn || !$conn->microservice_session_id) {
            if ($this->isCancelled($syncJob)) {
                return;
            }
            $syncJob->markFailed('No hay conexión activa para esta aseguradora');
            return;
        }

        // Idempotency: si es un retry, partimos del progress existente para no
        // re-procesar tipos ya completados. Cada tipo se considera "done" si su
        // entrada en progress tiene total_fetched (incluso si es 0).
        $result = is_array($syncJob->progress) ? $syncJob->progress : [];
        $error = null;
        $isDone = fn(string $type) => isset($result[$type]['total_fetched']);

        // Mundial: clientes y pólizas se derivan de cartera; si el usuario seleccionó
        // clientes o pólizas pero no cartera, agregamos cartera automáticamente.
        $effectiveTypes = $this->types;
        if ($this->insurerCode === 'mundial'
            && !in_array('cartera', $effectiveTypes)
            && (in_array('clientes', $effectiveTypes) || in_array('polizas', $effectiveTypes))
        ) {
            $effectiveTypes[] = 'cartera';
        }

        try {
            if (in_array('clientes', $effectiveTypes) && !$isDone('clientes')) {
                if ($this->isCancelled($syncJob)) return;
                $result['clientes'] = $syncService->syncClientes($conn);
                if (!empty($result['clientes']['error'])) {
                    $error = $result['clientes']['error'];
                }
                $syncJob->updateProgress($result);
            }

            if (in_array('polizas', $effectiveTypes) && !$isDone('polizas')) {
                if ($this->isCancelled($syncJob)) return;
                $result['polizas'] = $syncService->syncPolizas($conn);
                if (!empty($result['polizas']['error'])) {
                    $error = $result['polizas']['error'];
                }
                $syncJob->updateProgress($result);
            }

            if (in_array('cartera', $effectiveTypes) && !$isDone('cartera')) {
                if ($this->isCancelled($syncJob)) return;
                $result['cartera'] = $syncService->syncCartera($conn);
                if (!empty($result['cartera']['error'])) {
                    $error = $result['cartera']['error'];
                }
                $syncJob->updateProgress($result);
            }
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::error('[SYNC JOB] Timeout', ['insurer' => $this->insurerCode, 'error' => $e->getMessage()]);
            // Abrir circuit breaker por 5 min al primer timeout
            Cache::put($breakerKey, now()->addMinutes(5)->toIso8601String(), now()->addMinutes(5));
            $error = "Tiempo de espera agotado al sincronizar con {$this->insurerCode}. La aseguradora tardó demasiado en responder.";
        } catch (\Throwable $e) {
            Log::error('[SYNC JOB] Exception', ['insurer' => $this->insurerCode, 'error' => $e->getMessage()]);
            $msg = $e->getMessage();
            if (str_contains($msg, 'cURL error 28') || str_contains($msg, 'timed out')) {
                $error = "Tiempo de espera agotado al sincronizar con {$this->insurerCode}.";
            } else {
                $error = $msg;
            }
        }

        // Para aseguradoras que derivan clientes/pólizas desde cartera (ej: mundial),
        // los contadores viven dentro de result['cartera'].
        $carteraResult = $result['cartera'] ?? [];
        $conn->update([
            'last_sync_at'             => now(),
            'last_sync_clientes_count' => ($result['clientes']['total_fetched'] ?? 0)
                + ($carteraResult['clientes_created'] ?? 0)
                + ($carteraResult['clientes_updated'] ?? 0),
            'last_sync_polizas_count'  => ($result['polizas']['total_fetched'] ?? 0)
                + ($carteraResult['polizas_created'] ?? 0)
                + ($carteraResult['polizas_updated'] ?? 0),
        ]);

        if ($this->isCancelled($syncJob)) {
            return;
        }

        if ($error) {
            $syncJob->markFailed($error, $result ?: null);
        } else {
            $syncJob->markCompleted($result);
        }
    }

    public function failed(?\Throwable $exception): void
    {
        $syncJob = SyncJob::find($this->syncJobId);
        if ($syncJob && !in_array($syncJob->status, ['completed', 'cancelled'], true)) {
            $syncJob->markFailed(
                $exception?->getMessage() ?? 'El job falló tras agotar los reintentos.',
            );
        }
    }

    private function isCancelled(SyncJob $syncJob): bool
    {
        $syncJob->refresh();
        return $syncJob->status === 'cancelled';
    }

    /**
     * Health check rápido del microservicio externo. 3s timeout.
     * Si responde algo (incluso un 4xx), está vivo. Si no conecta, está caído.
     */
    private function microserviceHealthy(): bool
    {
        try {
            $base = rtrim(config('services.microservicio.base_url') ?? 'http://127.0.0.1:8002', '/');
            $response = \Illuminate\Support\Facades\Http::timeout(3)->connectTimeout(2)->get("{$base}/docs");
            return $response->status() < 500;
        } catch (\Throwable $e) {
            return false;
        }
    }
}
