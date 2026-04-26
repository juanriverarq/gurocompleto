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
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Job para sincronizar detalles de una póliza específica.
 * Este es el "segundo nivel" de sincronización - corre en background
 * y no bloquea la sincronización masiva inicial.
 */
class SyncPolizaDetailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 120;
    public int $backoff = 30;

    public function __construct(
        private readonly int $polizaId,
        private readonly int $insurerConnectionId,
    ) {}

    public function handle(InsurerSyncService $syncService): void
    {
        $poliza = Poliza::find($this->polizaId);
        if (!$poliza) {
            Log::warning('[POLIZA DETAIL SYNC] Póliza no encontrada', ['id' => $this->polizaId]);
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
                    'detail_sync_status' => $result['partial'] ? 'partial' : 'completed',
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
}
