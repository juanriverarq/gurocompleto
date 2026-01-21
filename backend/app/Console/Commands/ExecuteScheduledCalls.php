<?php

namespace App\Console\Commands;

use App\Models\VoiceCampaign;
use App\Models\VoiceCampaignScheduledCall;
use App\Services\VoiceCampaignCallService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ExecuteScheduledCalls extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'voice:execute-scheduled-calls 
                            {--batch-size=20 : Número máximo de llamadas simultáneas}
                            {--campaign= : ID de campaña específica (opcional)}
                            {--dry-run : Solo mostrar qué llamadas se ejecutarían}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Ejecuta las llamadas programadas pendientes en lotes';

    /**
     * Ventana horaria permitida para llamadas (hora local Colombia)
     */
    protected int $startHour = 8;  // 8:00 AM
    protected int $endHour = 20;   // 8:00 PM

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $batchSize = (int) $this->option('batch-size');
        $campaignId = $this->option('campaign');
        $dryRun = $this->option('dry-run');

        // Verificar ventana horaria
        $now = Carbon::now('America/Bogota');
        $currentHour = $now->hour;

        if ($currentHour < $this->startHour || $currentHour >= $this->endHour) {
            $this->warn("⏰ Fuera de horario permitido ({$this->startHour}:00 - {$this->endHour}:00). Hora actual: {$currentHour}:00");
            Log::info('📞 [SCHEDULED CALLS] Fuera de horario permitido', [
                'current_hour' => $currentHour,
                'allowed_start' => $this->startHour,
                'allowed_end' => $this->endHour,
            ]);
            return 0;
        }

        $this->info("🚀 Ejecutando llamadas programadas (lote máximo: {$batchSize})");
        $this->info("📅 Fecha/Hora: {$now->format('Y-m-d H:i:s')} (Colombia)");

        // Buscar llamadas pendientes
        $query = VoiceCampaignScheduledCall::query()
            ->where('status', VoiceCampaignScheduledCall::STATUS_PENDING)
            ->whereDate('scheduled_date', '<=', Carbon::today())
            ->whereHas('campaign', function ($q) {
                // Buscar campañas activas (puede ser 'active' o 'running')
                $q->whereIn('status', [VoiceCampaign::STATUS_ACTIVE, VoiceCampaign::STATUS_RUNNING, 'active', 'running']);
            })
            ->with(['campaign', 'client', 'poliza'])
            ->orderBy('priority', 'asc')
            ->orderBy('scheduled_date', 'asc');

        if ($campaignId) {
            $query->where('voice_campaign_id', $campaignId);
        }

        $pendingCalls = $query->limit($batchSize)->get();

        if ($pendingCalls->isEmpty()) {
            $this->info("✅ No hay llamadas pendientes para ejecutar");
            return 0;
        }

        $this->info("📞 Encontradas {$pendingCalls->count()} llamadas pendientes");

        if ($dryRun) {
            $this->warn("🔍 Modo dry-run: mostrando llamadas sin ejecutar");
            $this->table(
                ['ID', 'Cliente', 'Teléfono', 'Campaña', 'Razón', 'Prioridad'],
                $pendingCalls->map(fn($c) => [
                    $c->id,
                    $c->client_name,
                    $c->client_phone,
                    $c->campaign?->name ?? 'N/A',
                    $c->reason,
                    $c->priority,
                ])->toArray()
            );
            return 0;
        }

        // Verificar llamadas en curso para no exceder el límite
        $inProgressCount = VoiceCampaignScheduledCall::where('status', 'called')->count();
        $availableSlots = max(0, $batchSize - $inProgressCount);

        if ($availableSlots === 0) {
            $this->warn("⚠️ Ya hay {$inProgressCount} llamadas en curso. Esperando...");
            return 0;
        }

        $callsToExecute = $pendingCalls->take($availableSlots);
        $this->info("📞 Ejecutando {$callsToExecute->count()} llamadas (slots disponibles: {$availableSlots})");

        $callService = app(VoiceCampaignCallService::class);
        $executed = 0;
        $failed = 0;

        foreach ($callsToExecute as $scheduledCall) {
            try {
                $this->line("  → Llamando a {$scheduledCall->client_name} ({$scheduledCall->client_phone})...");

                // Marcar como en proceso (status = 'called')
                $scheduledCall->update(['status' => VoiceCampaignScheduledCall::STATUS_CALLED]);

                // Ejecutar la llamada
                $result = $callService->startSingleCall(
                    $scheduledCall->campaign,
                    $scheduledCall->contact_data,
                    ['poliza_id' => $scheduledCall->poliza_id]
                );

                if ($result['success']) {
                    // Asociar la llamada real con la programada
                    $callId = $result['call']->id ?? null;
                    $scheduledCall->update([
                        'voice_campaign_call_id' => $callId,
                        'called_at' => now(),
                    ]);
                    $executed++;
                    $this->info("    ✅ Llamada iniciada correctamente (ID: {$callId})");
                } else {
                    $errorMsg = $result['error'] ?? $result['message'] ?? 'Error desconocido';
                    $scheduledCall->markAsFailed($errorMsg);
                    $failed++;
                    $this->error("    ❌ Error: {$errorMsg}");
                }

                // Pequeña pausa entre llamadas para no saturar
                usleep(500000); // 0.5 segundos

            } catch (\Throwable $e) {
                $scheduledCall->markAsFailed($e->getMessage());
                $failed++;
                $this->error("    ❌ Excepción: {$e->getMessage()}");
                Log::error('📞 [SCHEDULED CALLS] Error ejecutando llamada', [
                    'scheduled_call_id' => $scheduledCall->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $this->newLine();
        $this->info("📊 Resumen:");
        $this->info("   - Ejecutadas: {$executed}");
        $this->info("   - Fallidas: {$failed}");

        Log::info('📞 [SCHEDULED CALLS] Lote ejecutado', [
            'executed' => $executed,
            'failed' => $failed,
            'batch_size' => $batchSize,
        ]);

        return 0;
    }
}
