<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

// Selección dinámica del archivo de rutas API
// En producción usar rutas endurecidas si USE_SECURE_ROUTES=true
$apiRoutesFile = env('USE_SECURE_ROUTES', false)
    ? __DIR__ . '/../routes/api_secure.php'
    : __DIR__ . '/../routes/api.php';

return Application::configure(basePath: dirname(__DIR__))
    ->withProviders([
        App\Providers\FirebaseServiceProvider::class,
    ])
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: $apiRoutesFile,
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Registrar CORS como middleware GLOBAL
        $middleware->append(\Illuminate\Http\Middleware\HandleCors::class);
        
        $middleware->alias([
            'saas.auth' => \App\Http\Middleware\SaasAuth::class,
            'firebase.auth' => \App\Http\Middleware\FirebaseAuthMiddleware::class,
            'unified.auth' => \App\Http\Middleware\UnifiedAuthMiddleware::class,
            'global.broker.auth' => \App\Http\Middleware\GlobalBrokerAuth::class,
            'security.auth' => \App\Http\Middleware\SecurityAuthMiddleware::class,
            'security.audit' => \App\Http\Middleware\SecurityAuditMiddleware::class,
            'clamp.pagination' => \App\Http\Middleware\ClampPagination::class,
            'siniestro.permissions' => \App\Http\Middleware\CheckSiniestroPermissions::class,
            'rate.limit.siniestros' => \App\Http\Middleware\RateLimitSiniestros::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
