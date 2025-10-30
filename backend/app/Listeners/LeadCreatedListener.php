<?php

namespace App\Listeners;

use App\Events\LeadCreated;
use App\Services\VoiceCampaignTriggerProcessor;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;

class LeadCreatedListener implements ShouldQueue
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
    public function handle(LeadCreated $event): void
    {
        try {
            Log::info('[LeadCreatedListener] Processing new lead event', [
                'lead_id' => $event->lead->id,
                'broker_id' => $event->lead->broker_id,
                'nombre' => $event->lead->nombre
            ]);

            // Procesar triggers de tipo 'new_lead'
            VoiceCampaignTriggerProcessor::processEvent(
                $event->lead->broker_id,
                'new_lead',
                $event->lead->toArray(),
                'Lead',
                $event->lead->id
            );

            Log::info('[LeadCreatedListener] Event processed successfully');
        } catch (\Exception $e) {
            Log::error('[LeadCreatedListener] Error processing event', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
        }
    }
}