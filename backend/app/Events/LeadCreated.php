<?php

namespace App\Events;

use App\Models\Lead;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class LeadCreated
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public Lead $lead;

    /**
     * Create a new event instance.
     */
    public function __construct(Lead $lead)
    {
        $this->lead = $lead;
    }
}