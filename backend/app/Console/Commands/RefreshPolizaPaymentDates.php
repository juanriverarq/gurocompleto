<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Backfill polizas.payment_due_date desde cartera_items.
 *
 * Para cada póliza con cartera_items, calcula la fecha_limite_pago más
 * temprana de las cuotas pendientes y la copia a polizas.payment_due_date.
 * También actualiza payment_status (pending/overdue/paid).
 *
 * Uso:
 *   php artisan cartera:refresh-payment-dates [--broker=ID] [--dry-run]
 */
class RefreshPolizaPaymentDates extends Command
{
    protected $signature = 'cartera:refresh-payment-dates
                            {--broker= : ID del broker (opcional, default todos)}
                            {--dry-run : Solo mostrar qué cambiaría}';

    protected $description = 'Sincronizar polizas.payment_due_date desde cartera_items.fecha_limite_pago de la próxima cuota pendiente';

    public function handle(): int
    {
        $brokerId = $this->option('broker');
        $dryRun = (bool) $this->option('dry-run');

        $this->info('🔄 Refrescando payment_due_date de pólizas desde cartera_items...');
        if ($dryRun) {
            $this->warn('   (dry-run: no se aplicarán cambios)');
        }

        // Pólizas con al menos un cartera_item
        $polizaQuery = DB::table('cartera_items')
            ->select('poliza_id')
            ->whereNotNull('poliza_id')
            ->distinct();

        if ($brokerId) {
            $polizaQuery->where('broker_id', $brokerId);
        }

        $total = $polizaQuery->count();
        $this->info("📋 Pólizas a procesar: {$total}");

        if ($total === 0) {
            return 0;
        }

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $cambiosFecha = 0;
        $cambiosEstado = 0;
        $procesadas = 0;

        $polizaQuery->orderBy('poliza_id')->chunkById(500, function ($rows) use (&$cambiosFecha, &$cambiosEstado, &$procesadas, $bar, $dryRun) {
            foreach ($rows as $row) {
                $polizaId = $row->poliza_id;
                $procesadas++;

                $proxima = DB::table('cartera_items')
                    ->where('poliza_id', $polizaId)
                    ->where('recaudado_en_oficina', false)
                    ->where('recaudado_aseguradora', false)
                    ->where('recibo_pago_directo', false)
                    ->where('es_anticipo', false)
                    ->where('recibo_anulado', false)
                    ->whereNotNull('fecha_limite_pago')
                    ->min('fecha_limite_pago');

                $current = DB::table('polizas')
                    ->where('id', $polizaId)
                    ->value('payment_due_date');

                $nuevoEstado = null;
                if ($proxima === null) {
                    $nuevoEstado = 'paid';
                } else {
                    $nuevoEstado = strtotime($proxima) < strtotime(date('Y-m-d')) ? 'overdue' : 'pending';
                }

                $currentEstado = DB::table('polizas')->where('id', $polizaId)->value('payment_status');

                $needsUpdate = false;
                $payload = [];

                // Comparar fechas (normalizar a Y-m-d)
                $currentNorm = $current ? substr($current, 0, 10) : null;
                $proximaNorm = $proxima ? substr($proxima, 0, 10) : null;
                if ($currentNorm !== $proximaNorm) {
                    $payload['payment_due_date'] = $proxima;
                    $cambiosFecha++;
                    $needsUpdate = true;
                }

                if ($currentEstado !== $nuevoEstado) {
                    $payload['payment_status'] = $nuevoEstado;
                    $cambiosEstado++;
                    $needsUpdate = true;
                }

                if ($needsUpdate && !$dryRun) {
                    DB::table('polizas')->where('id', $polizaId)->update($payload);
                }

                $bar->advance();
            }
        }, 'poliza_id', 'poliza_id');

        $bar->finish();
        $this->newLine();

        $this->info('✅ Listo');
        $this->table(['Métrica', 'Valor'], [
            ['Pólizas procesadas', $procesadas],
            ['Cambios payment_due_date', $cambiosFecha],
            ['Cambios payment_status', $cambiosEstado],
            ['Modo', $dryRun ? 'dry-run' : 'aplicado'],
        ]);

        return 0;
    }
}
