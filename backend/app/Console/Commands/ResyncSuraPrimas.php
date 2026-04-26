<?php

namespace App\Console\Commands;

use App\Jobs\SyncPolizaDetailJob;
use App\Models\InsurerConnection;
use App\Models\Poliza;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Re-sincroniza el detalle de pólizas Sura que quedaron sin `premium_amount`.
 *
 * Casos típicos:
 *   - Ramos Salud / Incendio / Hogar donde el parser antiguo no extraía la prima.
 *   - Pólizas con `detail_sync_status` = completed/partial/failed y prima NULL.
 *
 * Requiere una sesión Sura activa en insurer_connections (broker_id dado).
 */
class ResyncSuraPrimas extends Command
{
    protected $signature = 'sura:resync-primas
                            {--broker= : broker_id específico (por defecto: todos los que tengan conexión Sura activa)}
                            {--limit= : Máximo de pólizas a encolar}
                            {--sync : Ejecutar sincrónicamente (sin cola) — más lento pero visible}
                            {--force : Reintenta incluso pólizas que ya tienen prima}';

    protected $description = 'Re-sincroniza detalle Sura para pólizas sin premium_amount';

    public function handle(): int
    {
        $brokerId = $this->option('broker') ? (int) $this->option('broker') : null;
        $limit    = $this->option('limit') ? (int) $this->option('limit') : null;
        $sync     = (bool) $this->option('sync');
        $force    = (bool) $this->option('force');

        // Encontrar conexiones Sura activas
        $connQuery = InsurerConnection::query()
            ->where('insurer_code', 'sura')
            ->where('status', 'connected');
        if ($brokerId) {
            $connQuery->where('broker_id', $brokerId);
        }
        $conns = $connQuery->get();

        if ($conns->isEmpty()) {
            $this->error('No hay conexiones Sura activas. Conéctate primero en Aseguradoras.');
            return self::FAILURE;
        }

        $total = 0;
        foreach ($conns as $conn) {
            $this->info("→ Broker {$conn->broker_id} · conn #{$conn->id}");

            $query = Poliza::query()
                ->where('broker_id', $conn->broker_id)
                ->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(custom_fields, '$._sync_source')) = ?", ['sura_sync'])
                ->whereNull('deleted_at');

            if (!$force) {
                $query->where(function ($q) {
                    $q->whereNull('premium_amount')->orWhere('premium_amount', '<=', 0);
                });
            }

            $polizas = $query->orderBy('id')->get();
            if ($limit) $polizas = $polizas->take($limit);

            $this->line("  Pólizas candidatas: {$polizas->count()}");
            if ($polizas->isEmpty()) continue;

            $bar = $this->output->createProgressBar($polizas->count());
            $bar->start();

            $ok = 0; $fail = 0;
            foreach ($polizas as $p) {
                // Resetear estado para que el job proceda
                DB::table('polizas')->where('id', $p->id)->update([
                    'detail_sync_status' => 'pending',
                    'detail_sync_error'  => null,
                ]);

                if ($sync) {
                    try {
                        SyncPolizaDetailJob::dispatchSync($p->id, $conn->id);
                        $p->refresh();
                        if ($p->premium_amount > 0) $ok++;
                        else $fail++;
                    } catch (\Throwable $e) {
                        $fail++;
                    }
                } else {
                    SyncPolizaDetailJob::dispatch($p->id, $conn->id);
                    $ok++;
                }
                $bar->advance();
                $total++;
            }
            $bar->finish();
            $this->newLine();

            if ($sync) {
                $this->info("  Resultado: $ok con prima · $fail sin prima");
            } else {
                $this->info("  Encoladas: $ok jobs (ejecuta `php artisan queue:work` para procesarlos)");
            }
        }

        $this->info("✓ Total procesadas: $total");
        return self::SUCCESS;
    }
}
