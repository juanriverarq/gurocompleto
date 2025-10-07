<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use App\Models\AuditLog;

class SecurityAuditMiddleware
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $startTime = microtime(true);

        // Obtener información del usuario antes de procesar
        $user = $request->get('authenticated_user');
        $empleado = $request->get('authenticated_empleado');
        $brokerId = $request->get('broker_id');

        $response = $next($request);

        $endTime = microtime(true);
        $duration = round(($endTime - $startTime) * 1000, 2); // ms

        // Registrar en auditoría para operaciones sensibles
        if ($this->isSensitiveOperation($request)) {
            try {
                AuditLog::create([
                    'user_id' => $user ? $user->id : null,
                    'empleado_id' => $empleado ? $empleado->id : null,
                    'broker_id' => $brokerId,
                    'action' => $this->getActionName($request),
                    'resource_type' => $this->getResourceType($request),
                    'resource_id' => $this->getResourceId($request),
                    'method' => $request->method(),
                    'url' => $request->path(),
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'status_code' => $response->getStatusCode(),
                    'response_time_ms' => $duration,
                    'request_data' => $this->sanitizeRequestData($request),
                    'old_values' => null, // Para operaciones de update
                    'new_values' => null, // Para operaciones de update
                    'metadata' => [
                        'auth_type' => $request->get('auth_type'),
                        'permissions_checked' => $request->get('permissions_checked', []),
                        'rate_limited' => $request->get('rate_limited', false),
                    ]
                ]);
            } catch (\Exception $e) {
                Log::error('Error creando registro de auditoría', [
                    'error' => $e->getMessage(),
                    'request' => $request->path(),
                    'user_id' => $user ? $user->id : null
                ]);
            }
        }

        // Log de seguridad para operaciones críticas
        if ($this->isCriticalOperation($request)) {
            Log::info('🔐 OPERACIÓN CRÍTICA EJECUTADA', [
                'method' => $request->method(),
                'url' => $request->path(),
                'user_id' => $user ? $user->id : ($empleado ? $empleado->id : null),
                'broker_id' => $brokerId,
                'status' => $response->getStatusCode(),
                'duration_ms' => $duration,
                'ip' => $request->ip(),
                'auth_type' => $request->get('auth_type')
            ]);
        }

        return $response;
    }

    /**
     * Determinar si es una operación sensible que requiere auditoría
     */
    private function isSensitiveOperation(Request $request): bool
    {
        $sensitiveRoutes = [
            'saas/empleados',
            'saas/roles',
            'saas/broker/settings',
            'saas/usuarios',
            'saas/polizas',
            'saas/siniestros',
            'saas/comisiones',
            'saas/wallet',
        ];

        $path = $request->path();

        foreach ($sensitiveRoutes as $route) {
            if (str_contains($path, $route)) {
                return true;
            }
        }

        // Operaciones de escritura siempre son sensibles
        return in_array($request->method(), ['POST', 'PUT', 'DELETE', 'PATCH']);
    }

    /**
     * Determinar si es una operación crítica que requiere logging especial
     */
    private function isCriticalOperation(Request $request): bool
    {
        $criticalRoutes = [
            'saas/empleados',
            'saas/roles',
            'saas/broker',
            'saas/wallet',
            'saas/auth',
        ];

        $path = $request->path();

        foreach ($criticalRoutes as $route) {
            if (str_contains($path, $route)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Obtener nombre de acción basado en el método HTTP y ruta
     */
    private function getActionName(Request $request): string
    {
        $method = $request->method();
        $path = $request->path();

        // Acciones específicas por ruta
        if (str_contains($path, 'empleados')) {
            return match($method) {
                'POST' => 'create_employee',
                'PUT' => 'update_employee',
                'DELETE' => 'delete_employee',
                default => 'view_employees'
            };
        }

        if (str_contains($path, 'roles')) {
            return match($method) {
                'POST' => 'create_role',
                'PUT' => 'update_role',
                'DELETE' => 'delete_role',
                default => 'view_roles'
            };
        }

        if (str_contains($path, 'polizas')) {
            return match($method) {
                'POST' => 'create_policy',
                'PUT' => 'update_policy',
                'DELETE' => 'delete_policy',
                default => 'view_policies'
            };
        }

        if (str_contains($path, 'siniestros')) {
            return match($method) {
                'POST' => 'create_claim',
                'PUT' => 'update_claim',
                'DELETE' => 'delete_claim',
                default => 'view_claims'
            };
        }

        if (str_contains($path, 'wallet')) {
            return match($method) {
                'POST' => 'wallet_transaction',
                default => 'view_wallet'
            };
        }

        // Acción genérica por método HTTP
        return match($method) {
            'POST' => 'create',
            'PUT', 'PATCH' => 'update',
            'DELETE' => 'delete',
            default => 'view'
        };
    }

    /**
     * Obtener tipo de recurso
     */
    private function getResourceType(Request $request): string
    {
        $path = $request->path();

        if (str_contains($path, 'empleados')) return 'employee';
        if (str_contains($path, 'roles')) return 'role';
        if (str_contains($path, 'polizas')) return 'policy';
        if (str_contains($path, 'siniestros')) return 'claim';
        if (str_contains($path, 'clientes')) return 'client';
        if (str_contains($path, 'comisiones')) return 'commission';
        if (str_contains($path, 'wallet')) return 'wallet';
        if (str_contains($path, 'broker')) return 'broker';

        return 'unknown';
    }

    /**
     * Obtener ID del recurso desde la ruta
     */
    private function getResourceId(Request $request): ?int
    {
        $path = $request->path();
        $segments = explode('/', $path);

        // Buscar el último segmento que sea numérico
        for ($i = count($segments) - 1; $i >= 0; $i--) {
            if (is_numeric($segments[$i])) {
                return (int) $segments[$i];
            }
        }

        return null;
    }

    /**
     * Sanitizar datos de la request para auditoría (remover datos sensibles)
     */
    private function sanitizeRequestData(Request $request): array
    {
        $data = $request->all();

        // Campos sensibles a remover
        $sensitiveFields = [
            'password',
            'password_confirmation',
            'current_password',
            'token',
            'api_key',
            'secret',
            'firebase_uid',
            'reset_password_token'
        ];

        foreach ($sensitiveFields as $field) {
            if (isset($data[$field])) {
                $data[$field] = '[REDACTED]';
            }
        }

        // Limitar tamaño de arrays grandes
        foreach ($data as $key => $value) {
            if (is_array($value) && count($value) > 10) {
                $data[$key] = array_slice($value, 0, 10);
                $data[$key]['...'] = (count($value) - 10) . ' more items';
            }
        }

        return $data;
    }
}