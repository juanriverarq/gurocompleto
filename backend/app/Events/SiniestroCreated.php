<?php

namespace App\Events;

use App\Models\Siniestro;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SiniestroCreated
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public Siniestro $siniestro;

    /**
     * Create a new event instance.
     */
    public function __construct(Siniestro $siniestro)
    {
        $this->siniestro = $siniestro;
    }
}