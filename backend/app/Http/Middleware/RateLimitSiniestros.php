<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpFoundation\Response;

class RateLimitSiniestros
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, string $maxAttempts = '60', string $decayMinutes = '1'): Response
    {
        $user = $this->getAuthenticatedUser($request);
        $key = 'siniestros:' . ($user ? $user->id : $request->ip());

        if (RateLimiter::tooManyAttempts($key, (int) $maxAttempts)) {
            return response()->json([
                'error' => 'Demasiadas solicitudes',
                'message' => 'Has excedido el límite de solicitudes. Inténtalo de nuevo en unos minutos.',
                'retry_after' => RateLimiter::availableIn($key)
            ], 429);
        }

        RateLimiter::hit($key, (int) $decayMinutes * 60);

        return $next($request);
    }

    /**
     * Obtener usuario autenticado desde diferentes fuentes
     */
    private function getAuthenticatedUser(Request $request)
    {
        // Intentar obtener desde UnifiedAuthMiddleware (empleados)
        $empleado = $request->get('authenticated_empleado');
        if ($empleado) {
            return $empleado;
        }

        // Intentar obtener desde Firebase Auth
        $firebaseUser = $request->get('authenticated_user');
        if ($firebaseUser) {
            return $firebaseUser;
        }

        // Intentar desde Laravel Auth (fallback)
        $user = $request->user();
        if ($user) {
            return $user;
        }

        return null;
    }
}