<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use Illuminate\Http\Request;
use Carbon\Carbon;
use App\Models\Campaign;
use App\Models\User;
use App\Http\Controllers\Api\CampaignController;

class RunScheduledCampaigns extends Command
{
    /**
     * Ejecuta campañas de WhatsApp programadas cuya hora ya llegó
     *
     * Uso manual:
     *   php artisan campaigns:run-scheduled --limit=50
     */
    protected $signature = 'campaigns:run-scheduled {--limit=20}';

    protected $description = 'Ejecuta campañas programadas (scheduled_date/next_execution <= now)';

    public function handle(): int
    {
        // Evitar concurrencia (corre cada minuto en scheduler)
        $lock = Cache::lock('campaigns:run-scheduled-lock', 55);
        if (!$lock->get()) {
            $this->info('Otro proceso está ejecutándose. Omitiendo...');
            return 0;
        }

        try {
            $now = Carbon::now();
            $limit = (int) $this->option('limit') ?: 20;

            // Buscar campañas de tipo scheduled y listas para ejecutarse
            $campaigns = Campaign::query()
                ->where('campaign_type', 'scheduled')
                ->whereIn('status', ['scheduled', 'active']) // permitir reintentos si quedó en active
                ->where(function ($q) use ($now) {
                    $q->whereNotNull('scheduled_date')
                      ->where('scheduled_date', '<=', $now)
                      ->orWhere(function ($q2) use ($now) {
                          $q2->whereNotNull('next_execution')
                             ->where('next_execution', '<=', $now);
                      });
                })
                ->orderByRaw('COALESCE(scheduled_date, next_execution) ASC')
                ->limit($limit)
                ->get();

            if ($campaigns->isEmpty()) {
                $this->info('No hay campañas programadas para ejecutar.');
                return 0;
            }

            $this->info(sprintf('Encontradas %d campañas programadas para ejecutar', $campaigns->count()));
            Log::info('📅 [SCHEDULER] Campañas programadas encontradas', ['count' => $campaigns->count()]);

            // Usar el mismo controlador que la UI para reutilizar validaciones y flujo
            $controller = app(CampaignController::class);

            $executed = 0;
            $failed = 0;

            foreach ($campaigns as $campaign) {
                try {
                    $this->line(sprintf('→ Ejecutando campaña #%d "%s" (broker_id=%d)', $campaign->id, $campaign->name, $campaign->broker_id));

                    // Resolver un usuario del broker (necesario para RequiresAuth/getBrokerId)
                    /** @var \App\Models\User|null $user */
                    $user = User::where('broker_id', $campaign->broker_id)->first();
                    if (!$user) {
                        $failed++;
                        $msg = 'No se encontró usuario asociado al broker para ejecutar la campaña';
                        $this->warn("   ⚠️ {$msg}");
                        Log::warning('📅 [SCHEDULER] Sin usuario para broker', [
                            'campaign_id' => $campaign->id,
                            'broker_id'   => $campaign->broker_id,
                        ]);
                        continue;
                    }

                    // Crear Request simulado con user resolver (igual que en endpoints de debug existentes)
                    $request = Request::create("/api/saas/campaigns/{$campaign->id}/execute-now", 'POST');
                    $request->setUserResolver(function () use ($user) {
                        return $user;
                    });

                    // Ejecutar reutilizando la lógica de [`CampaignController::executeNow()`](backend/app/Http/Controllers/Api/CampaignController.php:1790)
                    $response = $controller->executeNow($campaign->id, $request);

                    $status = method_exists($response, 'getStatusCode') ? $response->getStatusCode() : null;
                    if ($status !== null && $status >= 200 && $status < 300) {
                        $executed++;
                        $this->info('   ✅ Ejecutada');
                    } else {
                        $failed++;
                        $body = method_exists($response, 'getContent') ? $response->getContent() : '';
                        $this->warn("   ❌ Error HTTP {$status} {$body}");
                        Log::error('📅 [SCHEDULER] Error ejecutando campaña', [
                            'campaign_id' => $campaign->id,
                            'status'      => $status,
                            'body'        => $body,
                        ]);
                    }

                    // Pequeña pausa entre campañas para evitar picos
                    usleep(250000); // 0.25s
                } catch (\Throwable $e) {
                    $failed++;
                    $this->error('   ❌ Excepción ejecutando campaña: ' . $e->getMessage());
                    Log::error('📅 [SCHEDULER] Exception ejecutando campaña', [
                        'campaign_id' => $campaign->id,
                        'error'       => $e->getMessage(),
                        'trace'       => $e->getTraceAsString(),
                    ]);
                }
            }

            $this->info(sprintf('Resumen: ejecutadas OK=%d, fallidas=%d', $executed, $failed));
            Log::info('📅 [SCHEDULER] Resumen de ejecución', ['ok' => $executed, 'failed' => $failed]);

            // Devolver código 1 solo si todo falló
            return $failed > 0 && $executed === 0 ? 1 : 0;
        } finally {
            optional($lock)->release();
        }
    }
}