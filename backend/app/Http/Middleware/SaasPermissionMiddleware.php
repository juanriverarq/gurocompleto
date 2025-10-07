<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SaasPermissionMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next, string $permission = null): Response
    {
        $user = $request->user();
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'No autenticado',
                'error' => 'UNAUTHENTICATED'
            ], 401);
        }

        // Si no se especifica permiso, permitir acceso
        if (!$permission) {
            return $next($request);
        }

        // Los usuarios MASTER tienen acceso completo
        if ($user->user_type === 'MASTER') {
            return $next($request);
        }

        // Verificar permisos específicos para otros tipos de usuario
        $userPermissions = $user->permissions ?? [];
        
        // Si el permiso es "admin", verificar tipo de usuario
        if ($permission === 'admin' && $user->user_type !== 'ADMIN' && $user->user_type !== 'MASTER') {
            return response()->json([
                'success' => false,
                'message' => 'Acceso denegado. Se requieren permisos de administrador.',
                'error' => 'INSUFFICIENT_PERMISSIONS'
            ], 403);
        }

        // Verificar permisos específicos en el array de permisos
        if (!in_array($permission, $userPermissions) && !in_array('*', $userPermissions)) {
            return response()->json([
                'success' => false,
                'message' => "Acceso denegado. Se requiere el permiso: {$permission}",
                'error' => 'INSUFFICIENT_PERMISSIONS'
            ], 403);
        }

        return $next($request);
    }
}
