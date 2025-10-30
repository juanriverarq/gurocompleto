<?php

namespace App\Listeners;

use App\Events\PolizaCreated;
use App\Services\VoiceCampaignTriggerProcessor;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;

class PolizaCreatedListener implements ShouldQueue
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
    public function handle(PolizaCreated $event): void
    {
        try {
            Log::info('[PolizaCreatedListener] Processing new policy event', [
                'poliza_id' => $event->poliza->id,
                'broker_id' => $event->poliza->broker_id,
                'numero_poliza' => $event->poliza->numero_poliza
            ]);

            // Procesar triggers de tipo 'new_policy'
            VoiceCampaignTriggerProcessor::processEvent(
                $event->poliza->broker_id,
                'new_policy',
                $event->poliza->toArray(),
                'Poliza',
                $event->poliza->id
            );

            Log::info('[PolizaCreatedListener] Event processed successfully');
        } catch (\Exception $e) {
            Log::error('[PolizaCreatedListener] Error processing event', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
        }
    }
}