<?php

namespace App\Jobs;

use App\Models\InsurerConnection;
use App\Models\SyncJob;
use App\Services\InsurerSyncService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SyncInsurerJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 1900;  // ~32 min: estado:polizas tarda ~25 min con paginación lenta
    public int $backoff = 30;

    public function __construct(
        private readonly int $syncJobId,
        private readonly int $brokerId,
        private readonly string $insurerCode,
        private readonly array $types,
    ) {}

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

        $result = [];
        $error = null;

        try {
            if (in_array('clientes', $this->types)) {
                if ($this->isCancelled($syncJob)) return;
                $result['clientes'] = $syncService->syncClientes($conn);
                $syncJob->updateProgress($result);
            }

            if (in_array('polizas', $this->types)) {
                if ($this->isCancelled($syncJob)) return;
                $result['polizas'] = $syncService->syncPolizas($conn);
                $syncJob->updateProgress($result);
            }

            if (in_array('cartera', $this->types)) {
                if ($this->isCancelled($syncJob)) return;
                $result['cartera'] = $syncService->syncCartera($conn);
                $syncJob->updateProgress($result);
            }
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            Log::error('[SYNC JOB] Timeout', ['insurer' => $this->insurerCode, 'error' => $e->getMessage()]);
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

        $conn->update([
            'last_sync_at' => now(),
            'last_sync_clientes_count' => $result['clientes']['total_fetched'] ?? 0,
            'last_sync_polizas_count' => $result['polizas']['total_fetched'] ?? 0,
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
}
