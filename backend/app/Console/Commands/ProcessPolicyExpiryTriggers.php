<?php

namespace App\Console\Commands;

use App\Models\Poliza;
use App\Services\VoiceCampaignTriggerProcessor;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class ProcessPolicyExpiryTriggers extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'voice-campaigns:process-policy-expiry
                            {--days-range=60 : Rango de días a revisar (antes y después de hoy)}
                            {--broker-id= : Procesar solo un broker específico}
                            {--dry-run : Simular sin ejecutar triggers}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Procesa triggers de vencimiento de pólizas para campañas de voz automáticas';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $daysRange = (int) $this->option('days-range');
        $brokerId = $this->option('broker-id');
        $dryRun = $this->option('dry-run');

        $this->info('🔄 Iniciando procesamiento de triggers de vencimiento de pólizas...');
        $this->info("📅 Rango: {$daysRange} días antes y después de hoy");
        
        if ($dryRun) {
            $this->warn('⚠️  Modo DRY-RUN: No se ejecutarán triggers reales');
        }

        try {
            // Calcular rango de fechas
            $dateFrom = Carbon::now()->subDays($daysRange);
            $dateTo = Carbon::now()->addDays($daysRange);

            $this->info("📆 Buscando pólizas con vencimiento entre {$dateFrom->format('Y-m-d')} y {$dateTo->format('Y-m-d')}");

            // Construir query de pólizas
            $query = Poliza::whereBetween('fecha_vencimiento', [$dateFrom, $dateTo])
                ->whereNotNull('fecha_vencimiento');

            if ($brokerId) {
                $query->where('broker_id', $brokerId);
                $this->info("🏢 Filtrando por broker_id: {$brokerId}");
            }

            $polizas = $query->get();

            $this->info("📋 Encontradas {$polizas->count()} pólizas en el rango");

            if ($polizas->isEmpty()) {
                $this->warn('⚠️  No hay pólizas para procesar');
                return 0;
            }

            // Procesar cada póliza
            $processed = 0;
            $triggered = 0;
            $skipped = 0;
            $errors = 0;

            $progressBar = $this->output->createProgressBar($polizas->count());
            $progressBar->start();

            foreach ($polizas as $poliza) {
                try {
                    $processed++;

                    if ($dryRun) {
                        $this->newLine();
                        $this->line("  [DRY-RUN] Póliza #{$poliza->id} - {$poliza->numero_poliza} - Vence: {$poliza->fecha_vencimiento}");
                        $skipped++;
                    } else {
                        // Procesar trigger real
                        $result = VoiceCampaignTriggerProcessor::processEvent(
                            $poliza->broker_id,
                            'policy_expiry',
                            $poliza->toArray(),
                            'Poliza',
                            $poliza->id
                        );

                        if ($result['triggered'] ?? false) {
                            $triggered++;
                            Log::info('[ProcessPolicyExpiryTriggers] Trigger fired', [
                                'poliza_id' => $poliza->id,
                                'broker_id' => $poliza->broker_id
                            ]);
                        } else {
                            $skipped++;
                            Log::debug('[ProcessPolicyExpiryTriggers] Trigger skipped', [
                                'poliza_id' => $poliza->id,
                                'reason' => $result['reason'] ?? 'unknown'
                            ]);
                        }
                    }

                    $progressBar->advance();
                } catch (\Exception $e) {
                    $errors++;
                    Log::error('[ProcessPolicyExpiryTriggers] Error processing poliza', [
                        'poliza_id' => $poliza->id,
                        'error' => $e->getMessage()
                    ]);
                    $progressBar->advance();
                }
            }

            $progressBar->finish();
            $this->newLine(2);

            // Resumen
            $this->info('✅ Procesamiento completado');
            $this->table(
                ['Métrica', 'Cantidad'],
                [
                    ['Pólizas procesadas', $processed],
                    ['Triggers disparados', $triggered],
                    ['Triggers omitidos', $skipped],
                    ['Errores', $errors]
                ]
            );

            if ($dryRun) {
                $this->warn('⚠️  Esto fue una simulación. Ejecuta sin --dry-run para procesar realmente.');
            }

            return 0;
        } catch (\Exception $e) {
            $this->error('❌ Error fatal: ' . $e->getMessage());
            Log::error('[ProcessPolicyExpiryTriggers] Fatal error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return 1;
        }
    }
}