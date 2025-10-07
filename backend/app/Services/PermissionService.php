<?php

namespace App\Services;

use App\Models\User;
use App\Models\EmpleadoBroker;
use App\Models\RolBroker;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class PermissionService
{
    /**
     * Cache TTL en minutos
     */
    const CACHE_TTL = 60;

    /**
     * Verificar si un usuario tiene un permiso específico
     */
    public function hasPermission($user, string $permission): bool
    {
        if (!$user) {
            return false;
        }

        // Cache key
        $cacheKey = "permissions.{$user->id}." . md5($permission);

        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($user, $permission) {
            return $this->checkPermission($user, $permission);
        });
    }

    /**
     * Verificar permiso sin cache (para validaciones en tiempo real)
     */
    public function checkPermission($user, string $permission): bool
    {
        if (!$user) {
            return false;
        }

        // Usuarios MASTER tienen todos los permisos
        if ($this->isMasterUser($user)) {
            return true;
        }

        // Si es empleado, verificar permisos del rol
        if ($this->isEmployee($user)) {
            return $this->checkEmployeePermission($user, $permission);
        }

        // Para usuarios Firebase, verificar permisos directos
        if ($this->isFirebaseUser($user)) {
            return $this->checkFirebaseUserPermission($user, $permission);
        }

        return false;
    }

    /**
     * Verificar si el usuario puede acceder a un módulo específico
     */
    public function canAccessModule($user, string $module): bool
    {
        if (!$user) {
            return false;
        }

        // Usuarios MASTER tienen acceso a todo
        if ($this->isMasterUser($user)) {
            return true;
        }

        // Verificar acceso al módulo específico
        $modulePermission = $module . '.*';
        return $this->hasPermission($user, $modulePermission) ||
               $this->hasPermission($user, $module . '.ver') ||
               $this->hasPermission($user, $module . '.view');
    }

    /**
     * Obtener todos los permisos del usuario
     */
    public function getUserPermissions($user): array
    {
        if (!$user) {
            return [];
        }

        $cacheKey = "user_permissions.{$user->id}";

        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($user) {
            return $this->loadUserPermissions($user);
        });
    }

    /**
     * Obtener permisos organizados por módulo
     */
    public function getPermissionsByModule($user): array
    {
        $permissions = $this->getUserPermissions($user);
        $byModule = [];

        foreach ($permissions as $permission) {
            if (str_contains($permission, '.')) {
                [$module, $action] = explode('.', $permission, 2);
                if (!isset($byModule[$module])) {
                    $byModule[$module] = [];
                }
                $byModule[$module][] = $action;
            }
        }

        return $byModule;
    }

    /**
     * Verificar múltiples permisos (al menos uno requerido)
     */
    public function hasAnyPermission($user, array $permissions): bool
    {
        foreach ($permissions as $permission) {
            if ($this->hasPermission($user, $permission)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Verificar que tenga todos los permisos especificados
     */
    public function hasAllPermissions($user, array $permissions): bool
    {
        foreach ($permissions as $permission) {
            if (!$this->hasPermission($user, $permission)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Limpiar cache de permisos para un usuario
     */
    public function clearUserCache($userId): void
    {
        $patterns = [
            "permissions.{$userId}.*",
            "user_permissions.{$userId}",
            "employee_permissions.{$userId}",
        ];

        foreach ($patterns as $pattern) {
            Cache::forget($pattern);
        }
    }

    /**
     * Verificar si es usuario MASTER
     */
    private function isMasterUser($user): bool
    {
        return $user instanceof User && $user->user_type === 'MASTER';
    }

    /**
     * Verificar si es empleado
     */
    private function isEmployee($user): bool
    {
        return $user instanceof EmpleadoBroker;
    }

    /**
     * Verificar si es usuario Firebase
     */
    private function isFirebaseUser($user): bool
    {
        return $user instanceof User && $user->firebase_uid;
    }

    /**
     * Verificar permisos de empleado
     */
    private function checkEmployeePermission(EmpleadoBroker $empleado, string $permission): bool
    {
        if (!$empleado->rol) {
            return false;
        }

        return $empleado->rol->tienePermiso($permission);
    }

    /**
     * Verificar permisos de usuario Firebase
     */
    private function checkFirebaseUserPermission(User $user, string $permission): bool
    {
        $userPermissions = $user->permissions ?? [];

        // Verificación exacta
        if (in_array($permission, $userPermissions)) {
            return true;
        }

        // Verificación con wildcards
        if (in_array('*', $userPermissions)) {
            return true;
        }

        // Verificación por módulo
        if (str_contains($permission, '.')) {
            $module = explode('.', $permission)[0];
            $moduleWildcard = $module . '.*';

            if (in_array($moduleWildcard, $userPermissions)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Cargar permisos del usuario
     */
    private function loadUserPermissions($user): array
    {
        if ($this->isMasterUser($user)) {
            return ['*']; // Todos los permisos
        }

        if ($this->isEmployee($user)) {
            return $user->obtenerPermisos();
        }

        if ($this->isFirebaseUser($user)) {
            return $user->permissions ?? [];
        }

        return [];
    }

    /**
     * Validar sintaxis de permiso
     */
    public function validatePermissionSyntax(string $permission): bool
    {
        // Formatos válidos:
        // - modulo.accion
        // - modulo.*
        // - *

        if ($permission === '*') {
            return true;
        }

        if (!str_contains($permission, '.')) {
            return false;
        }

        $parts = explode('.', $permission);
        if (count($parts) !== 2) {
            return false;
        }

        [$module, $action] = $parts;

        // Módulo debe tener al menos 2 caracteres
        if (strlen($module) < 2) {
            return false;
        }

        // Acción debe ser alfanumérica o * o contener guiones bajos
        if (!preg_match('/^[a-zA-Z0-9_*]+$/', $action)) {
            return false;
        }

        return true;
    }

    /**
     * Obtener jerarquía de permisos (para compatibilidad)
     */
    public function getPermissionHierarchy(): array
    {
        return [
            'admin' => ['*'],
            'supervisor' => [
                'clientes.*', 'polizas.*', 'siniestros.*', 'comisiones.ver_equipo',
                'dashboard.ver_metricas_equipo', 'reportes.generar'
            ],
            'asesor' => [
                'clientes.crear', 'clientes.editar', 'clientes.ver_propios',
                'polizas.crear', 'polizas.editar', 'polizas.ver_propias',
                'siniestros.crear', 'siniestros.ver_propios',
                'dashboard.ver_metricas_propias'
            ],
            'vendedor' => [
                'clientes.crear', 'polizas.crear', 'dashboard.ver_metricas_propias'
            ]
        ];
    }

    /**
     * Log de validación de permisos (para debugging)
     */
    public function logPermissionCheck($user, string $permission, bool $result): void
    {
        if (!config('app.debug')) {
            return;
        }

        Log::debug('🔐 Permission Check', [
            'user_id' => $user ? $user->id : null,
            'user_type' => $user ? get_class($user) : null,
            'permission' => $permission,
            'result' => $result,
            'user_permissions' => $user ? $this->getUserPermissions($user) : []
        ]);
    }
}