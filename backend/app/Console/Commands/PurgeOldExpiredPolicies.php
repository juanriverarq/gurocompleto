<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Poliza;
use Carbon\Carbon;

class PurgeOldExpiredPolicies extends Command
{
    protected $signature = 'polizas:purge-expired {--broker_id=} {--dry-run} {--include-cancelled}';
    protected $description = 'Eliminar pólizas vencidas (>18 meses, por end_date) y opcionalmente canceladas (>18 meses, por updated_at). Opcional: --broker_id=ID --dry-run --include-cancelled';

    public function handle(): int
    {
        $cutoff = Carbon::now()->subMonths(18)->startOfDay();
        $brokerId = $this->option('broker_id');
        $dryRun = (bool)$this->option('dry-run');

        // Expired by end_date (consider legacy/localized statuses)
        $expiredStatuses = ['expired', 'vencida', 'vencido'];
        $expiredQ = Poliza::query()
            ->whereDate('end_date', '<', $cutoff)
            ->whereRaw('LOWER(TRIM(status)) IN (' . implode(',', array_map(fn($s)=>"'".strtolower($s)."'", $expiredStatuses)) . ')');
        if ($brokerId) { $expiredQ->where('broker_id', (int)$brokerId); }
        $expiredCount = (clone $expiredQ)->count();

        // Cancelled by updated_at (approx cancellation date)
        $includeCancelled = (bool)$this->option('include-cancelled');
        $cancelledCount = 0;
        $cancelledQ = null;
        if ($includeCancelled) {
            $cancelledStatuses = ['cancelled', 'canceled', 'cancelada', 'cancelado'];
            $cancelledQ = Poliza::query()
                ->whereRaw('LOWER(TRIM(status)) IN (' . implode(',', array_map(fn($s)=>"'".strtolower($s)."'", $cancelledStatuses)) . ')')
                // Consider the earliest available date among end_date, updated_at, issue_date
                ->whereRaw('DATE(COALESCE(end_date, updated_at, issue_date)) < ?', [$cutoff->toDateString()]);
            if ($brokerId) { $cancelledQ->where('broker_id', (int)$brokerId); }
            $cancelledCount = (clone $cancelledQ)->count();
        }

        $this->info('Corte: ' . $cutoff->toDateString() . ($brokerId ? " • broker {$brokerId}" : ''));
        $this->info("Vencidas (expired): {$expiredCount}");
        if ($includeCancelled) { $this->info("Canceladas (cancelled): {$cancelledCount}"); }

        if ($dryRun) {
            $this->info('Dry-run habilitado. No se eliminarán registros.');
            return self::SUCCESS;
        }

        $deleted = 0;
        $expiredQ->chunkById(500, function ($chunk) use (&$deleted) {
            foreach ($chunk as $poliza) {
                try { $poliza->delete(); $deleted++; } catch (\Throwable $e) { $this->warn('No se pudo eliminar póliza ID ' . $poliza->id . ': ' . $e->getMessage()); }
            }
        });
        if ($includeCancelled && $cancelledQ) {
            $cancelledQ->chunkById(500, function ($chunk) use (&$deleted) {
                foreach ($chunk as $poliza) {
                    try { $poliza->delete(); $deleted++; } catch (\Throwable $e) { $this->warn('No se pudo eliminar póliza ID ' . $poliza->id . ': ' . $e->getMessage()); }
                }
            });
        }

        $this->info("Pólizas eliminadas: {$deleted}");
        return self::SUCCESS;
    }
}


