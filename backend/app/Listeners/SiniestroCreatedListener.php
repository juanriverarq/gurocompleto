<?php

namespace App\Listeners;

use App\Events\SiniestroCreated;
use App\Services\VoiceCampaignTriggerProcessor;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;

class SiniestroCreatedListener implements ShouldQueue
{
    use InteractsWithQueue;

    /**
     * Create the event listener.
     */
    public function __construct()
    {
        //
    }

    /**
     * Handle the event.
     */
    public function handle(SiniestroCreated $event): void
    {
        try {
            Log::info('[SiniestroCreatedListener] Processing new siniestro event', [
                'siniestro_id' => $event->siniestro->id,
                'broker_id' => $event->siniestro->broker_id,
                'numero_siniestro' => $event->siniestro->numero_siniestro ?? 'N/A'
            ]);

            // Procesar triggers de tipo 'new_siniestro'
            VoiceCampaignTriggerProcessor::processEvent(
                $event->siniestro->broker_id,
                'new_siniestro',
                $event->siniestro->toArray(),
                'Siniestro',
                $event->siniestro->id
            );

            Log::info('[SiniestroCreatedListener] Event processed successfully');
        } catch (\Exception $e) {
            Log::error('[SiniestroCreatedListener] Error processing event', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
        }
    }
}