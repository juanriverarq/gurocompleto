<?php

namespace App\Providers;

use App\Services\WhatsAppBridgeService;
use App\Services\ChatbotProcessorService;
use App\Services\WhatsAppClassificationService;
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
        // Registrar WhatsAppBridgeService como singleton
        $this->app->singleton(WhatsAppBridgeService::class, function ($app) {
            return new WhatsAppBridgeService();
        });

        // Registrar WhatsAppClassificationService
        $this->app->singleton(WhatsAppClassificationService::class, function ($app) {
            return new WhatsAppClassificationService();
        });

        // Registrar ChatbotProcessorService
        $this->app->singleton(ChatbotProcessorService::class, function ($app) {
            return new ChatbotProcessorService(
                $app->make(WhatsAppBridgeService::class),
                $app->make(WhatsAppClassificationService::class),
                $app->make(\App\Services\AIResponseService::class)
            );
        });
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

        // Rate limit por aseguradora (global): protege al microservicio externo
        // y al portal de la aseguradora contra saturación cuando muchos brokers
        // sincronizan en paralelo. SyncInsurerJob::middleware() lo usa.
        RateLimiter::for('insurer:hdi', fn () => Limit::perMinute(2));
        RateLimiter::for('insurer:sura', fn () => Limit::perMinute(2));
        RateLimiter::for('insurer:bolivar', fn () => Limit::perMinute(2));
        RateLimiter::for('insurer:axa-colpatria', fn () => Limit::perMinute(2));
        RateLimiter::for('insurer:seguros-del-estado', fn () => Limit::perMinute(1));
        RateLimiter::for('insurer:la-equidad', fn () => Limit::perMinute(2));
        RateLimiter::for('insurer:allianz', fn () => Limit::perMinute(2));

        // Rate limit para sync de DETALLES por broker: 30 pólizas/min POR broker.
        // El limiter recibe el SyncPolizaDetailJob y aplica el `by()` con su broker_id.
        RateLimiter::for('polizadetail', function ($job) {
            $brokerId = method_exists($job, 'brokerIdForRate') ? $job->brokerIdForRate() : 'anon';
            return Limit::perMinute(30)->by("broker:{$brokerId}");
        });
    }
}
