<?php

namespace App\Jobs;

use App\Models\InsurerConnection;
use App\Models\Poliza;
use App\Models\SyncJob;
use App\Services\InsurerSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\ThrottlesExceptions;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Sync de detalles de una póliza individual. Llamado MANUAL desde el frontend
 * cuando el usuario abre una póliza. Vive en queue 'details' separada — su
 * volumen alto NO debe atascar el sync principal ni la web.
 *
 * Garantías:
 * - WithoutOverlapping(poliza_id): no procesar la misma póliza 2 veces concurrente.
 * - Rate limit por broker: máx N pólizas/min para no saturar al microservicio.
 * - Health-check del microservicio: si está caído, soltar el job (no marcar failed).
 */
class SyncPolizaDetailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** 2 reintentos con backoff antes de marcar failed permanente. */
    public int $tries = 3;

    public function backoff(): array
    {
        return [15, 60];
    }

    public int $timeout = 180;
    public bool $failOnTimeout = true;

    public function __construct(
        private readonly int $polizaId,
        private readonly int $insurerConnectionId,
    ) {
        // Queue 'details' = baja prioridad, separada de sync principal y de la web.
        $this->onQueue('details');
    }

    /**
     * No procesar la misma póliza dos veces a la vez.
     * Rate limit por broker para no saturar el microservicio con cientos de
     * pólizas concurrentes al abrir el listado.
     */
    public function middleware(): array
    {
        return [
            (new WithoutOverlapping("polizadetail:{$this->polizaId}"))
                ->expireAfter(300)
                ->dontRelease(),
            (new RateLimited('polizadetail')),
        ];
    }

    /**
     * Usado por el RateLimiter 'polizadetail' (AppServiceProvider) para
     * hacer el ->by() según el broker, sin tocar la BD desde el limiter.
     */
    public function brokerIdForRate(): int
    {
        return (int) (InsurerConnection::query()
            ->where('id', $this->insurerConnectionId)
            ->value('broker_id') ?? 0);
    }

    public function tags(): array
    {
        return [
            'details',
            "poliza:{$this->polizaId}",
            "conn:{$this->insurerConnectionId}",
        ];
    }

    public function handle(InsurerSyncService $syncService): void
    {
        $poliza = Poliza::find($this->polizaId);
        if (!$poliza) {
            Log::warning('[POLIZA DETAIL SYNC] Póliza no encontrada', ['id' => $this->polizaId]);
            return;
        }

        // Póliza manual (nunca creada/tocada por sync): no sincronizar detalles.
        // Marca: custom_fields._sync_source ausente.
        if (empty($poliza->custom_fields['_sync_source'] ?? null)) {
            Log::info('[POLIZA DETAIL SYNC] Saltada (manual)', [
                'poliza_id' => $this->polizaId,
                'policy_number' => $poliza->policy_number,
            ]);
            return;
        }

        $conn = InsurerConnection::find($this->insurerConnectionId);
        if (!$conn || !$conn->microservice_session_id) {
            $poliza->update([
                'detail_sync_status' => 'failed',
                'detail_sync_error' => 'No hay conexión activa con la aseguradora',
                'detail_sync_at' => now(),
            ]);
            return;
        }

        // Health-check del microservicio externo. Si está caído, soltar el job
        // para reintentar luego — NO marcar como failed (el problema es del server,
        // no de la póliza). Esto evita el patrón "1116 fallidas por cURL error 7".
        if (!$this->microserviceHealthy()) {
            Log::warning('[POLIZA DETAIL SYNC] Microservicio no responde, reintento en 60s', [
                'poliza_id' => $this->polizaId,
            ]);
            $this->release(60);
            return;
        }

        // Marcar como procesando
        $poliza->update([
            'detail_sync_status' => 'processing',
            'detail_sync_at' => now(),
            'detail_sync_insurer_connection_id' => $conn->id,
        ]);

        try {
            $result = $syncService->syncPolizaDetail($poliza, $conn);

            if ($result['success']) {
                $poliza->update([
                    'detail_sync_status' => ($result['not_applicable'] ?? false) ? 'not_applicable' : ($result['partial'] ? 'partial' : 'completed'),
                    'detail_sync_error' => null,
                    'detail_sync_at' => now(),
                ]);
                Log::info('[POLIZA DETAIL SYNC] Éxito', [
                    'poliza_id' => $this->polizaId,
                    'insurer' => $conn->insurer_code,
                    'coverages' => $result['coverages_count'] ?? 0,
                    'partial' => $result['partial'] ?? false,
                ]);
            } else {
                $poliza->update([
                    'detail_sync_status' => 'failed',
                    'detail_sync_error' => $result['error'] ?? 'Error desconocido',
                    'detail_sync_at' => now(),
                ]);
                Log::warning('[POLIZA DETAIL SYNC] Falló', [
                    'poliza_id' => $this->polizaId,
                    'insurer' => $conn->insurer_code,
                    'error' => $result['error'] ?? 'Error desconocido',
                ]);
            }
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::error('[POLIZA DETAIL SYNC] Timeout', [
                'poliza_id' => $this->polizaId,
                'error' => $e->getMessage(),
            ]);
            $poliza->update([
                'detail_sync_status' => 'failed',
                'detail_sync_error' => 'Timeout: La aseguradora tardó demasiado en responder',
                'detail_sync_at' => now(),
            ]);
        } catch (\Throwable $e) {
            Log::error('[POLIZA DETAIL SYNC] Excepción', [
                'poliza_id' => $this->polizaId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            $poliza->update([
                'detail_sync_status' => 'failed',
                'detail_sync_error' => substr($e->getMessage(), 0, 500),
                'detail_sync_at' => now(),
            ]);
        }
    }

    public function failed(?\Throwable $exception): void
    {
        $poliza = Poliza::find($this->polizaId);
        if ($poliza) {
            $poliza->update([
                'detail_sync_status' => 'failed',
                'detail_sync_error' => $exception?->getMessage() ?? 'El job falló tras agotar los reintentos.',
                'detail_sync_at' => now(),
            ]);
        }
    }

    /**
     * Health check rápido del microservicio externo. 3s timeout.
     * Si responde algo, está vivo. Si no conecta, está caído → release el job.
     */
    private function microserviceHealthy(): bool
    {
        try {
            $base = rtrim(config('services.microservicio.base_url') ?? 'http://127.0.0.1:8002', '/');
            $response = Http::timeout(3)->connectTimeout(2)->get("{$base}/docs");
            return $response->status() < 500;
        } catch (\Throwable $e) {
            return false;
        }
    }
}
