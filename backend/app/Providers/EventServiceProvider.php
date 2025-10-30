<?php

namespace App\Providers;

use App\Events\ClienteCreated;
use App\Events\PolizaCreated;
use App\Events\LeadCreated;
use App\Events\SiniestroCreated;
use App\Listeners\ClienteCreatedListener;
use App\Listeners\PolizaCreatedListener;
use App\Listeners\LeadCreatedListener;
use App\Listeners\SiniestroCreatedListener;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    /**
     * The event listener mappings for the application.
     *
     * @var array<class-string, array<int, class-string>>
     */
    protected $listen = [
        // Voice Campaign Triggers - Eventos de negocio
        ClienteCreated::class => [
            ClienteCreatedListener::class,
        ],
        PolizaCreated::class => [
            PolizaCreatedListener::class,
        ],
        LeadCreated::class => [
            LeadCreatedListener::class,
        ],
        SiniestroCreated::class => [
            SiniestroCreatedListener::class,
        ],
    ];

    /**
     * Register any events for your application.
     */
    public function boot(): void
    {
        //
    }

    /**
     * Determine if events and listeners should be automatically discovered.
     */
    public function shouldDiscoverEvents(): bool
    {
        return false;
    }
}