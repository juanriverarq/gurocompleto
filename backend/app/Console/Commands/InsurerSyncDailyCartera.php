<?php

namespace App\Console\Commands;

use App\Jobs\SyncInsurerJob;
use App\Models\InsurerConnection;
use App\Models\SyncJob;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class InsurerSyncDailyCartera extends Command
{
    protected $signature = 'insurer-sync:daily-cartera
                            {--broker= : Limitar a un broker_id específico (solo debug)}
                            {--insurer= : Limitar a una aseguradora (ej. sura)}
                            {--dry-run : Listar sin despachar}';

    protected $description = 'Dispatch daily cartera sync jobs for all active insurer connections.';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');
        $brokerId = $this->option('broker');
        $insurer = $this->option('insurer');

        $q = InsurerConnection::query()
            ->where('status', 'connected')
            ->whereNotNull('microservice_session_id');

        if ($brokerId) {
            $q->where('broker_id', (int) $brokerId);
        }
        if ($insurer) {
            $q->where('insurer_code', $insurer);
        }

        $connections = $q->get();
        $total = $connections->count();

        if ($total === 0) {
            $this->info('No hay conexiones activas para sincronizar.');
            Log::channel('daily')->info('[DAILY CARTERA] 0 conexiones activas.');
            return self::SUCCESS;
        }

        $this->info(sprintf('%d conexión(es) activa(s).', $total));

        // Agrupar por broker para un solo batch_id por broker — así el
        // frontend "historial de sincronización" muestra una sola corrida.
        $byBroker = $connections->groupBy('broker_id');
        $dispatched = 0;
        $skipped = 0;

        foreach ($byBroker as $bId => $conns) {
            $batchId = Str::uuid()->toString();

            foreach ($conns as $conn) {
                // Saltar aseguradoras sin cartera disponible
                if ($conn->insurer_code === 'seguros-del-estado') {
                    $skipped++;
                    continue;
                }

                $this->line(sprintf(
                    '  broker=%d %-22s session=%s',
                    $conn->broker_id,
                    $conn->insurer_code,
                    substr($conn->microservice_session_id, 0, 8) . '…',
                ));

                if ($dry) {
                    $dispatched++;
                    continue;
                }

                $sync = SyncJob::create([
                    'batch_id' => $batchId,
                    'broker_id' => $conn->broker_id,
                    'insurer_code' => $conn->insurer_code,
                    'types' => ['cartera'],
                    'status' => 'pending',
                ]);

                SyncInsurerJob::dispatch(
                    $sync->id,
                    $conn->broker_id,
                    $conn->insurer_code,
                    ['cartera'],
                );
                $dispatched++;
            }
        }

        $msg = sprintf(
            '[DAILY CARTERA] %d job(s) despachado(s), %d saltado(s) sobre %d conexión(es).',
            $dispatched, $skipped, $total,
        );
        $this->info($msg);
        Log::info($msg);

        return self::SUCCESS;
    }
}
