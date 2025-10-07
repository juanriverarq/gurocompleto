<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class CheckSiniestroPermissions
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, string $permission = null): Response
    {
        // Obtener usuario autenticado desde diferentes fuentes (unificado)
        $user = $this->getAuthenticatedUser($request);

        if (!$user) {
            return response()->json([
                'error' => 'Usuario no autenticado',
                'message' => 'Debe estar autenticado para acceder a esta funcionalidad'
            ], 401);
        }

        // Los masters tienen acceso completo
        if ($user->user_type === 'MASTER' || $user->rol === 'admin') {
            return $next($request);
        }

        // Verificar permisos específicos si se requiere
        if ($permission && !$this->hasPermission($user, $permission)) {
            return response()->json([
                'error' => 'Permisos insuficientes',
                'message' => 'No tiene permisos para realizar esta acción',
                'required_permission' => $permission
            ], 403);
        }

        // Verificar que el usuario tenga broker_id
        $brokerId = $this->getBrokerId($user);
        if (!$brokerId) {
            return response()->json([
                'error' => 'Usuario sin broker asignado',
                'message' => 'El usuario no tiene un broker asignado'
            ], 400);
        }

        // Establecer broker_id en el request para uso posterior
        $request->merge(['broker_id' => $brokerId]);

        return $next($request);
    }

    /**
     * Verificar si el usuario tiene un permiso específico
     */
    private function hasPermission($user, string $permission): bool
    {
        $permissions = $user->permissions ?? [];

        // Verificar permisos directos
        if (in_array($permission, $permissions)) {
            return true;
        }

        // Verificar permisos por módulo - actualizado para coincidir con RolBroker
        $modulePermissions = [
            'siniestros.ver_todos' => ['siniestros.ver', 'siniestros.*'],
            'siniestros.ver' => ['siniestros.ver', 'siniestros.*'],
            'siniestros.crear' => ['siniestros.crear', 'siniestros.*'],
            'siniestros.editar' => ['siniestros.editar', 'siniestros.*'],
            'siniestros.eliminar' => ['siniestros.eliminar', 'siniestros.*'],
            'siniestros.reportar' => ['siniestros.reportar', 'siniestros.*'],
            'siniestros.procesar' => ['siniestros.procesar', 'siniestros.*'],
            'siniestros.cerrar' => ['siniestros.cerrar', 'siniestros.*'],
        ];

        if (isset($modulePermissions[$permission])) {
            foreach ($modulePermissions[$permission] as $requiredPerm) {
                if (in_array($requiredPerm, $permissions)) {
                    return true;
                }
            }
        }

        return false;
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

    /**
     * Obtener broker ID del usuario
     */
    private function getBrokerId($user): ?int
    {
        if ($user instanceof \App\Models\EmpleadoBroker) {
            return $user->broker_id;
        }

        if ($user instanceof \App\Models\User) {
            return $user->broker_id;
        }

        return null;
    }
}