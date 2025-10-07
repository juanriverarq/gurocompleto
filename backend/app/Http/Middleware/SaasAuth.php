<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Facades\Log;

class SaasAuth
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next, ...$permissions): Response
    {
        // El middleware unificado ya verificó la autenticación
        // Solo necesitamos verificar permisos específicos
        
        $authType = $request->get('auth_type');
        
        if ($authType === 'empleado') {
            $empleado = $request->get('authenticated_empleado');
            
            if (!$empleado || !$empleado->puedeAcceder()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Acceso denegado para empleado'
                ], 403);
            }

            // Verificar permisos específicos para empleados
            if (!empty($permissions)) {
                $hasPermission = false;
                
                foreach ($permissions as $permission) {
                    // Verificar si tiene el permiso específico
                    if ($empleado->tienePermiso($permission)) {
                        $hasPermission = true;
                        break;
                    }
                    
                    // Verificar si tiene acceso completo al módulo
                    if (str_contains($permission, '.')) {
                        $modulo = explode('.', $permission)[0];
                        if ($empleado->tienePermiso($modulo . '.*') || $empleado->tienePermiso('*')) {
                            $hasPermission = true;
                            break;
                        }
                    }
                }
                
                if (!$hasPermission) {
                    Log::info('SaasAuth: Empleado sin permisos suficientes', [
                        'empleado_id' => $empleado->id,
                        'permisos_requeridos' => $permissions,
                        'permisos_empleado' => method_exists($empleado, 'obtenerPermisos') ? $empleado->obtenerPermisos() : ($empleado->rol->permisos ?? [])
                    ]);
                    
                    return response()->json([
                        'success' => false,
                        'message' => 'Sin permisos suficientes para esta acción'
                    ], 403);
                }
            }

            return $next($request);
        } 
        
        if ($authType === 'firebase' || (!$authType && $request->user())) {
            $user = $request->get('authenticated_user');
            if (!$user) {
                $user = $request->user();
            }
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario Firebase no encontrado'
                ], 401);
            }

            // Para usuarios Firebase, verificar si necesita onboarding
            // Solo bloquear si NO hay contexto de broker resuelto
            $hasBrokerContext = $request->get('authenticated_broker_id') || $request->get('broker_id') || ($user->broker_id ?? null);
            if (!$user->user_type && $user->firebase_uid && !$hasBrokerContext) {
                return response()->json([
                    'success' => false,
                    'message' => 'No tienes permisos para acceder al sistema SaaS. Necesitas crear un broker.',
                    'needs_onboarding' => true,
                    'onboarding_step' => 'create_broker',
                    'user_info' => [
                        'id' => $user->id,
                        'email' => $user->email,
                        'name' => $user->name
                    ]
                ], 403);
            }

            // Verificación de permisos específicos para usuarios Firebase (administradores/brokers)
            if (!empty($permissions)) {
                // Los usuarios MASTER tienen acceso total
                if (method_exists($user, 'isMaster') && $user->isMaster()) {
                    return $next($request);
                }
                
                // Usar PermissionService para unificar permisos (soporta wildcards y roles)
                $permService = app(\App\Services\PermissionService::class);
                $userPermissions = $permService->getUserPermissions($user);
                $hasPermission = false;
                
                foreach ($permissions as $permission) {
                    // Coincidencia exacta
                    if (in_array($permission, $userPermissions, true)) {
                        $hasPermission = true;
                        break;
                    }
                    
                    // Wildcards: * o modulo.*
                    if (in_array('*', $userPermissions, true)) {
                        $hasPermission = true;
                        break;
                    }
                    
                    if (str_contains($permission, '.')) {
                        $module = explode('.', $permission)[0];
                        if (in_array($module . '.*', $userPermissions, true)) {
                            $hasPermission = true;
                            break;
                        }
                    }
                }
                
                if (!$hasPermission) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Sin permisos suficientes para esta acción'
                    ], 403);
                }
            }

            return $next($request);
        }
        
        // Si no hay tipo de autenticación válido
        return response()->json([
            'success' => false,
            'message' => 'Tipo de autenticación no válido'
        ], 401);
    }
} 