<?php

namespace App\Events;

use App\Models\Poliza;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PolizaCreated
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public Poliza $poliza;

    /**
     * Create a new event instance.
     */
    public function __construct(Poliza $poliza)
    {
        $this->poliza = $poliza;
    }
}