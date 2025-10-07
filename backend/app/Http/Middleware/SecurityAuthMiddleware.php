<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Services\PermissionService;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use App\Models\User;
use App\Models\EmpleadoBroker;
use App\Models\Broker;

class SecurityAuthMiddleware
{
    protected $permissionService;

    public function __construct(PermissionService $permissionService)
    {
        $this->permissionService = $permissionService;
    }

    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @param  mixed  ...$permissions
     */
    public function handle(Request $request, Closure $next, ...$permissions): Response
    {
        // Obtener usuario autenticado
        $user = $this->getAuthenticatedUser($request);

        if (!$user) {
            Log::warning('SecurityAuthMiddleware: Usuario no autenticado', [
                'url' => $request->url(),
                'method' => $request->method(),
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Usuario no autenticado',
                'error' => 'Se requiere autenticación para acceder a este recurso'
            ], 401);
        }

        // Establecer contexto del broker para multi-tenancy
        $brokerId = $this->getBrokerId($user);
        if ($brokerId) {
            $request->merge(['broker_id' => $brokerId]);
            // Establecer en el contenedor de la aplicación para acceso global
            app()->instance('current_broker_id', $brokerId);
        }

        // Rate limiting para operaciones sensibles
        if ($this->shouldRateLimit($request)) {
            $key = $this->getRateLimitKey($request, $user);
            $maxAttempts = $this->getRateLimitMaxAttempts($request);

            if (RateLimiter::tooManyAttempts($key, $maxAttempts)) {
                Log::warning('🚦 Rate limit excedido', [
                    'user_id' => $user->id,
                    'url' => $request->path(),
                    'ip' => $request->ip()
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'Demasiadas solicitudes. Intente nuevamente en unos minutos.',
                    'error' => 'RATE_LIMIT_EXCEEDED',
                    'retry_after' => RateLimiter::availableIn($key)
                ], 429);
            }
            RateLimiter::hit($key);
            $request->merge(['rate_limited' => true]);
        }

        // Verificar permisos específicos si se requieren
        if (!empty($permissions)) {
            if (!$this->checkPermissions($user, $permissions)) {
                Log::warning('SecurityAuthMiddleware: Permisos insuficientes', [
                    'user_id' => $user->id ?? 'unknown',
                    'user_type' => get_class($user),
                    'permissions_required' => $permissions,
                    'permissions_user' => $this->permissionService->getUserPermissions($user),
                    'url' => $request->url(),
                    'ip' => $request->ip()
                ]);

                return response()->json([
                    'success' => false,
                    'message' => 'Permisos insuficientes para esta acción',
                    'error' => 'No tienes los permisos necesarios para acceder a este recurso',
                    'required_permissions' => $permissions,
                    'user_permissions' => $this->permissionService->getPermissionsByModule($user)
                ], 403);
            }

            $request->merge(['permissions_checked' => $permissions]);
        }

        // Validar estado del usuario
        if (!$this->validateUserStatus($user)) {
            return response()->json([
                'success' => false,
                'message' => 'Su cuenta está suspendida o inactiva',
                'error' => 'USER_INACTIVE'
            ], 403);
        }

        // Agregar información del usuario al request para uso posterior
        $request->merge([
            'authenticated_user' => $user,
            'user_permissions' => $this->permissionService->getUserPermissions($user),
            'is_admin' => $this->isAdmin($user)
        ]);

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

    /**
     * Obtener broker ID del usuario
     */
    private function getBrokerId($user): ?int
    {
        if ($user instanceof EmpleadoBroker) {
            return $user->broker_id;
        }

        if ($user instanceof User) {
            return $user->broker_id;
        }

        return null;
    }

    /**
     * Verificar si el usuario es administrador
     */
    private function isAdmin($user): bool
    {
        if ($user instanceof EmpleadoBroker) {
            return $user->rol && $user->rol->es_admin;
        }

        if ($user instanceof User) {
            return $user->user_type === 'MASTER' || $user->user_type === 'ADMIN';
        }

        return false;
    }

    /**
     * Verificar si debe aplicarse rate limiting
     */
    private function shouldRateLimit(Request $request): bool
    {
        $sensitiveMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
        return in_array($request->method(), $sensitiveMethods);
    }

    /**
     * Generar clave para rate limiting
     */
    private function getRateLimitKey(Request $request, $user): string
    {
        $userId = $user->id ?? 'unknown';
        $ip = $request->ip();
        return "rate_limit:{$userId}:{$ip}:" . md5($request->path());
    }

    /**
     * Obtener máximo de intentos para rate limiting
     */
    private function getRateLimitMaxAttempts(Request $request): int
    {
        $path = $request->path();

        // Endpoints más sensibles tienen límites más bajos
        if (str_contains($path, 'empleados') || str_contains($path, 'roles')) {
            return 10; // 10 requests per minute
        }

        if (str_contains($path, 'wallet') || str_contains($path, 'comisiones')) {
            return 20; // 20 requests per minute
        }

        return 60; // 60 requests per minute por defecto
    }

    /**
     * Validar estado del usuario
     */
    private function validateUserStatus($user): bool
    {
        if ($user instanceof EmpleadoBroker) {
            return $user->estado === 'activo' && $user->acceso_activo;
        }

        if ($user instanceof User) {
            return $user->status === 'active';
        }

        return false;
    }

    /**
     * Verificar permisos del usuario
     */
    private function checkPermissions($user, array $permissions): bool
    {
        // Los administradores tienen acceso total
        if ($this->isAdmin($user)) {
            return true;
        }

        // Verificar que tenga al menos uno de los permisos requeridos
        return $this->permissionService->hasAnyPermission($user, $permissions);
    }

    /**
     * Método helper para verificar permisos específicos
     */
    public static function hasPermission(Request $request, string $permission): bool
    {
        $user = $request->get('authenticated_user') ?? $request->get('authenticated_empleado');
        if (!$user) return false;

        $permissionService = app(PermissionService::class);
        return $permissionService->hasPermission($user, $permission);
    }

    /**
     * Método helper para verificar acceso a módulo
     */
    public static function canAccessModule(Request $request, string $module): bool
    {
        $user = $request->get('authenticated_user') ?? $request->get('authenticated_empleado');
        if (!$user) return false;

        $permissionService = app(PermissionService::class);
        return $permissionService->canAccessModule($user, $module);
    }

    /**
     * Método helper para obtener broker ID del contexto actual
     */
    public static function getCurrentBrokerId(Request $request = null): ?int
    {
        // Intentar obtener del request actual
        if ($request) {
            return $request->get('broker_id');
        }

        // Intentar obtener del contenedor de la aplicación
        return app()->has('current_broker_id') ? app('current_broker_id') : null;
    }
}