<?php

namespace App\Console\Commands;

use App\Models\Anexo;
use App\Models\Poliza;
use App\Models\ReciboCaja;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillRecibosPolizaLink extends Command
{
    protected $signature = 'recibos:backfill-poliza-link
        {--broker-id=54 : Broker ID to process}
        {--dry-run : Show what would change without actually updating}
        {--chunk=1000 : Records per chunk}';

    protected $description = 'Backfill poliza_id, anexo_poliza_id, and prima fields on recibos_caja records that are missing them';

    public function handle(): int
    {
        $brokerId = (int) $this->option('broker-id');
        $dryRun = $this->option('dry-run');
        $chunkSize = (int) $this->option('chunk');

        $this->info("=== Backfill Recibos → Póliza Link (broker $brokerId) ===");
        $this->info($dryRun ? '*** DRY RUN ***' : '*** LIVE RUN ***');

        // ─── Step 1: Build lookup maps ────────────────────────────────
        $this->info('Building póliza lookup by policy_number...');
        $polizaMap = Poliza::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->whereNull('deleted_at')
            ->get(['id', 'policy_number', 'client_id', 'premium_amount', 'total_amount', 'insurance_company', 'type'])
            ->keyBy('policy_number');
        $this->info("  → {$polizaMap->count()} pólizas loaded");

        $this->info('Building anexo lookup by poliza_id + anexo_number...');
        $anexoMap = Anexo::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->whereNull('deleted_at')
            ->get(['id', 'poliza_id', 'anexo_number', 'prima_neta', 'total_amount'])
            ->groupBy('poliza_id');
        $totalAnexos = $anexoMap->flatten()->count();
        $this->info("  → {$totalAnexos} anexos loaded across {$anexoMap->count()} pólizas");

        // ─── Step 2: Link poliza_id on recibos missing it ─────────────
        $this->info('');
        $this->info('--- Step 2: Linking poliza_id ---');

        $missingPolizaQuery = ReciboCaja::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->whereNull('poliza_id')
            ->whereNotNull('poliza_numero')
            ->where('poliza_numero', '!=', '');

        $totalMissing = $missingPolizaQuery->count();
        $this->info("Recibos without poliza_id (with poliza_numero): $totalMissing");

        $linked = 0;
        $notFound = 0;
        $alsoLinkedCliente = 0;

        $bar = $this->output->createProgressBar($totalMissing);
        $bar->start();

        ReciboCaja::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->whereNull('poliza_id')
            ->whereNotNull('poliza_numero')
            ->where('poliza_numero', '!=', '')
            ->chunkById($chunkSize, function ($recibos) use ($polizaMap, $dryRun, &$linked, &$notFound, &$alsoLinkedCliente, $bar) {
                foreach ($recibos as $recibo) {
                    $bar->advance();

                    $polizaNumero = trim($recibo->poliza_numero);
                    $poliza = $polizaMap->get($polizaNumero);

                    if (!$poliza) {
                        $notFound++;
                        continue;
                    }

                    $update = [
                        'poliza_id' => $poliza->id,
                        'prima_neta_poliza' => $poliza->premium_amount,
                        'prima_total_poliza' => $poliza->total_amount,
                    ];

                    // Also link cliente_id if missing
                    if (!$recibo->cliente_id && $poliza->client_id) {
                        $update['cliente_id'] = $poliza->client_id;
                        $alsoLinkedCliente++;
                    }

                    if (!$dryRun) {
                        DB::table('recibos_caja')
                            ->where('id', $recibo->id)
                            ->update($update);
                    }
                    $linked++;
                }
            });

        $bar->finish();
        $this->newLine();
        $this->info("  Linked poliza_id: $linked | Not found: $notFound | Also linked cliente_id: $alsoLinkedCliente");

        // ─── Step 3: Link anexo_poliza_id ─────────────────────────────
        $this->info('');
        $this->info('--- Step 3: Linking anexo_poliza_id ---');

        // Find recibos that have metadata.numero_anexo but no anexo_poliza_id
        $withAnexoMetadata = ReciboCaja::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->whereNull('anexo_poliza_id')
            ->whereNotNull('poliza_id')
            ->whereRaw("JSON_EXTRACT(metadata, '$.numero_anexo') IS NOT NULL");

        $totalWithAnexo = $withAnexoMetadata->count();
        $this->info("Recibos with metadata.numero_anexo but no anexo_poliza_id: $totalWithAnexo");

        $anexoLinked = 0;
        $anexoNotFound = 0;

        $bar2 = $this->output->createProgressBar($totalWithAnexo);
        $bar2->start();

        ReciboCaja::withoutGlobalScopes()
            ->where('broker_id', $brokerId)
            ->whereNull('anexo_poliza_id')
            ->whereNotNull('poliza_id')
            ->whereRaw("JSON_EXTRACT(metadata, '$.numero_anexo') IS NOT NULL")
            ->chunkById($chunkSize, function ($recibos) use ($anexoMap, $dryRun, &$anexoLinked, &$anexoNotFound, $bar2) {
                foreach ($recibos as $recibo) {
                    $bar2->advance();

                    $meta = is_array($recibo->metadata) ? $recibo->metadata : json_decode($recibo->metadata, true);
                    $numAnexo = $meta['numero_anexo'] ?? null;
                    if (!$numAnexo) {
                        $anexoNotFound++;
                        continue;
                    }

                    // Find matching anexo for this poliza
                    $polizaAnexos = $anexoMap->get($recibo->poliza_id);
                    if (!$polizaAnexos) {
                        $anexoNotFound++;
                        continue;
                    }

                    // Match by anexo_number (could be "1", "2", "ANEXO DE CUADRE 0", etc.)
                    $matched = $polizaAnexos->first(function ($anexo) use ($numAnexo) {
                        return trim((string) $anexo->anexo_number) === trim((string) $numAnexo);
                    });

                    if (!$matched) {
                        $anexoNotFound++;
                        continue;
                    }

                    if (!$dryRun) {
                        DB::table('recibos_caja')
                            ->where('id', $recibo->id)
                            ->update(['anexo_poliza_id' => $matched->id]);
                    }
                    $anexoLinked++;
                }
            });

        $bar2->finish();
        $this->newLine();
        $this->info("  Linked anexo_poliza_id: $anexoLinked | Not found: $anexoNotFound");

        // ─── Step 4: Update prima fields on ALL recibos with poliza_id ─
        $this->info('');
        $this->info('--- Step 4: Updating prima fields on all linked recibos ---');

        if (!$dryRun) {
            $updated = DB::statement("
                UPDATE recibos_caja r
                INNER JOIN polizas p ON r.poliza_id = p.id
                SET
                    r.prima_neta_poliza = p.premium_amount,
                    r.prima_total_poliza = p.total_amount
                WHERE r.broker_id = ?
                  AND r.poliza_id IS NOT NULL
                  AND r.deleted_at IS NULL
                  AND (
                    r.prima_neta_poliza IS NULL
                    OR r.prima_total_poliza IS NULL
                    OR ABS(COALESCE(r.prima_neta_poliza,0) - COALESCE(p.premium_amount,0)) > 0.01
                    OR ABS(COALESCE(r.prima_total_poliza,0) - COALESCE(p.total_amount,0)) > 0.01
                  )
            ", [$brokerId]);

            $affectedPrima = DB::select("SELECT ROW_COUNT() as cnt")[0]->cnt ?? 0;
            $this->info("  Prima fields updated on $affectedPrima recibos");
        } else {
            $mismatchCount = DB::table('recibos_caja as r')
                ->join('polizas as p', 'r.poliza_id', '=', 'p.id')
                ->where('r.broker_id', $brokerId)
                ->whereNull('r.deleted_at')
                ->where(function ($q) {
                    $q->whereNull('r.prima_neta_poliza')
                      ->orWhereNull('r.prima_total_poliza')
                      ->orWhereRaw('ABS(COALESCE(r.prima_neta_poliza,0) - COALESCE(p.premium_amount,0)) > 0.01')
                      ->orWhereRaw('ABS(COALESCE(r.prima_total_poliza,0) - COALESCE(p.total_amount,0)) > 0.01');
                })
                ->count();
            $this->info("  Would update prima fields on $mismatchCount recibos");
        }

        // ─── Step 5: Also link cliente_id from poliza where missing ────
        $this->info('');
        $this->info('--- Step 5: Linking cliente_id from póliza ---');

        if (!$dryRun) {
            DB::statement("
                UPDATE recibos_caja r
                INNER JOIN polizas p ON r.poliza_id = p.id
                SET r.cliente_id = p.client_id
                WHERE r.broker_id = ?
                  AND r.poliza_id IS NOT NULL
                  AND r.cliente_id IS NULL
                  AND p.client_id IS NOT NULL
                  AND r.deleted_at IS NULL
            ", [$brokerId]);
            $affectedCliente = DB::select("SELECT ROW_COUNT() as cnt")[0]->cnt ?? 0;
            $this->info("  Linked cliente_id on $affectedCliente recibos");
        } else {
            $missingCliente = DB::table('recibos_caja as r')
                ->join('polizas as p', 'r.poliza_id', '=', 'p.id')
                ->where('r.broker_id', $brokerId)
                ->whereNull('r.deleted_at')
                ->whereNull('r.cliente_id')
                ->whereNotNull('p.client_id')
                ->count();
            $this->info("  Would link cliente_id on $missingCliente recibos");
        }

        // ─── Summary ──────────────────────────────────────────────────
        $this->newLine();
        $this->info('=== Summary ===');
        $finalStats = DB::table('recibos_caja')
            ->where('broker_id', $brokerId)
            ->whereNull('deleted_at')
            ->selectRaw("
                COUNT(*) as total,
                SUM(poliza_id IS NOT NULL) as con_poliza,
                SUM(poliza_id IS NULL) as sin_poliza,
                SUM(anexo_poliza_id IS NOT NULL) as con_anexo,
                SUM(cliente_id IS NOT NULL) as con_cliente
            ")
            ->first();
        $this->table(
            ['Total', 'Con poliza_id', 'Sin poliza_id', 'Con anexo_id', 'Con cliente_id'],
            [[(array)$finalStats]]
        );

        if ($dryRun) {
            $this->warn('*** DRY RUN — no changes were made. Run without --dry-run to apply. ***');
        }

        return 0;
    }
}
