<?php

namespace App\Events;

use App\Models\Cliente;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ClienteCreated
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public Cliente $cliente;

    /**
     * Create a new event instance.
     */
    public function __construct(Cliente $cliente)
    {
        $this->cliente = $cliente;
    }
}