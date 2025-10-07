<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Cache\RateLimiting\Limit;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Rate limiting global por broker o IP
        RateLimiter::for('api', function (Request $request) {
            $user = $request->user();
            $brokerId = $user?->broker_id;
            $key = $brokerId ? ('broker:'.$brokerId) : ('ip:'.$request->ip());

            // Límite conservador por minuto. Ajustable por entorno si se requiere.
            return Limit::perMinute((int) env('API_RATE_LIMIT_PER_MINUTE', 120))
                ->by($key);
        });
    }
}
