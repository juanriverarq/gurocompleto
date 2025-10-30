<?php

namespace App\Listeners;

use App\Events\ClienteCreated;
use App\Services\VoiceCampaignTriggerProcessor;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;

class ClienteCreatedListener implements ShouldQueue
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
    public function handle(ClienteCreated $event): void
    {
        try {
            Log::info('[ClienteCreatedListener] Processing new client event', [
                'cliente_id' => $event->cliente->id,
                'broker_id' => $event->cliente->broker_id,
                'nombre' => $event->cliente->nombre
            ]);

            // Procesar triggers de tipo 'new_client'
            VoiceCampaignTriggerProcessor::processEvent(
                $event->cliente->broker_id,
                'new_client',
                $event->cliente->toArray(),
                'Cliente',
                $event->cliente->id
            );

            Log::info('[ClienteCreatedListener] Event processed successfully');
        } catch (\Exception $e) {
            Log::error('[ClienteCreatedListener] Error processing event', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            // No re-lanzar excepción para evitar fallos en la creación del cliente
            // El trigger se puede reintentar manualmente si es necesario
        }
    }
}