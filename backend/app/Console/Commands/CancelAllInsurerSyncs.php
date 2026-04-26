<?php

namespace App\Console\Commands;

use App\Models\SyncJob;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class CancelAllInsurerSyncs extends Command
{
    protected $signature = 'insurer-sync:cancel-all
                            {--dry-run : Mostrar conteos sin modificar datos}';

    protected $description = 'Marca como cancelados todos los sync_jobs pendientes o en proceso y elimina SyncInsurerJob de la cola `jobs`.';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry-run');
        $reason = 'Sincronización detenida por administrador (cancelación masiva).';

        $query = SyncJob::query()->whereIn('status', ['pending', 'processing']);
        $count = (clone $query)->count();

        if ($count === 0) {
            $this->info('No hay sync_jobs en estado pending o processing.');
        } elseif ($dry) {
            $this->warn("[dry-run] Se cancelarían {$count} fila(s) en sync_jobs.");
        } else {
            $query->orderBy('id')->chunkById(100, function ($jobs) use ($reason) {
                foreach ($jobs as $job) {
                    $job->markCancelled($reason, is_array($job->progress) ? $job->progress : null);
                }
            });
            $this->info("Cancelados {$count} registro(s) en sync_jobs.");
        }

        if (!Schema::hasTable('jobs')) {
            return self::SUCCESS;
        }

        $queued = DB::table('jobs')->where('payload', 'like', '%SyncInsurerJob%')->count();
        if ($queued === 0) {
            $this->info('No hay SyncInsurerJob pendientes en la tabla jobs.');
        } elseif ($dry) {
            $this->warn("[dry-run] Se eliminarían {$queued} job(s) de la cola.");
        } else {
            $deleted = DB::table('jobs')->where('payload', 'like', '%SyncInsurerJob%')->delete();
            $this->info("Eliminados {$deleted} job(s) SyncInsurerJob de la cola.");
        }

        return self::SUCCESS;
    }
}
