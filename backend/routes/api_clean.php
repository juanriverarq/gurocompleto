<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Log;

/*
|--------------------------------------------------------------------------
| API Routes - VERSIÓN LIMPIA PARA RESOLVER PROBLEMA DE MIDDLEWARE
|--------------------------------------------------------------------------
*/

// RUTA DE PRUEBA SIMPLE (SIN MIDDLEWARE)
Route::get('/test-simple-clean', function() {
    return response()->json([
        'success' => true,
        'message' => 'Ruta simple funcionando - sin middleware',
        'timestamp' => now()
    ]);
});

// RUTA DE PRUEBA CON MIDDLEWARE UNIFICADO
Route::middleware(['unified.auth', 'throttle:api', 'clamp.pagination'])->get('/test-unified-clean', function(Request $request) {
    Log::info('✅ RUTA LIMPIA CON MIDDLEWARE EJECUTÁNDOSE');
    
    $user = \App\Http\Middleware\UnifiedAuthMiddleware::getAuthenticatedUser($request);
    
    return response()->json([
        'success' => true,
        'message' => 'Middleware UnifiedAuth funcionando correctamente',
        'middleware_executed' => true,
        'auth_type' => $request->get('auth_type'),
        'user_found' => $user !== null,
        'user_data' => $user ? [
            'id' => $user->id,
            'email' => $user->email,
            'name' => $user->name
        ] : null,
        'timestamp' => now(),
        'source' => 'api_clean.php'
    ]);
});

// RUTA SAAS/ME-SIMPLE LIMPIA
Route::middleware(['unified.auth', 'throttle:api'])->get('/saas/me-simple-clean', function(Request $request) {
    Log::info('🎯 RUTA SAAS ME-SIMPLE LIMPIA EJECUTÁNDOSE');
    
    $user = \App\Http\Middleware\UnifiedAuthMiddleware::getAuthenticatedUser($request);
    
    if (!$user) {
        return response()->json([
            'success' => false,
            'message' => 'Usuario no autenticado'
        ], 401);
    }
    
    $broker = $user->getPrimaryBroker();
    
    return response()->json([
        'success' => true,
        'data' => [
            'user' => [
                'id' => $user->id,
                'nombre' => $user->name,
                'email' => $user->email,
                'user_type' => $user->user_type,
                'broker_id' => $user->broker_id,
            ],
            'broker' => $broker ? [
                'id' => $broker->id,
                'nombre' => $broker->name,
                'email' => $broker->email,
                'plan' => $broker->plan,
                'status' => $broker->status,
            ] : null
        ],
        'source' => 'api_clean.php - MIDDLEWARE FUNCIONANDO'
    ]);
});
