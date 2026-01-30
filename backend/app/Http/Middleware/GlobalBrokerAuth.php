<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use App\Services\BrokerAuthService;

class GlobalBrokerAuth
{
    protected $brokerAuthService;

    public function __construct(BrokerAuthService $brokerAuthService)
    {
        $this->brokerAuthService = $brokerAuthService;
    }

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next)
    {
        try {
            // Soportar autenticación unificada: Firebase (User) o Empleado
            $authType = $request->get('auth_type');
            $user = $request->user();
            $broker = null;


            if ($authType === 'empleado') {
                // Caso empleado autenticado por UnifiedAuthMiddleware
                $empleado = $request->get('authenticated_empleado');
                if (!$empleado) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Empleado no autenticado',
                        'error_code' => 'UNAUTHENTICATED'
                    ], 401);
                }
                // Obtener broker desde relación o por ID
                $broker = $empleado->broker ?? \App\Models\Broker::find($empleado->broker_id);
                if (!$broker) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Empleado sin broker asignado',
                        'error_code' => 'NO_BROKER_ASSIGNED'
                    ], 403);
                }
            } else {
                // Caso Firebase/Laravel User
                if (!$user) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Usuario no autenticado',
                        'error_code' => 'UNAUTHENTICATED'
                    ], 401);
                }
                // Prioridad 1: broker_id desde claims (empleado via custom token)
                $claimedBrokerId = (int) ($request->get('broker_id') ?? 0);
                if ($claimedBrokerId > 0) {
                    $broker = \App\Models\Broker::find($claimedBrokerId);
                }
                // Prioridad 2: broker asignado al usuario
                if (!$broker) {
                    $broker = $this->brokerAuthService->getUserBroker($user);
                }
            }

            if (!$broker) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario sin broker asignado - Necesita completar onboarding',
                    'error_code' => 'NO_BROKER_ASSIGNED',
                    'needs_onboarding' => true
                ], 403);
            }

            // Verificar que el broker esté activo y no haya expirado el trial
            if (!$this->brokerAuthService->isBrokerActive($broker)) {
                $isTrialExpired = $broker->isTrial() && $broker->isTrialExpired();
                $error = [
                    'success' => false,
                    'message' => $isTrialExpired
                        ? 'Tu periodo de prueba ha expirado. Por favor, actualiza tu plan para continuar.'
                        : 'Broker inactivo o suspendido',
                    'error_code' => $isTrialExpired ? 'TRIAL_EXPIRED' : 'BROKER_INACTIVE',
                    'broker_id' => $broker->id,
                    'broker_name' => $broker->name,
                ];
                if ($broker->isTrial() || $isTrialExpired) {
                    $error['trial_ends_at'] = optional($broker->trial_ends_at)->toISOString();
                }
                return response()->json($error, 403);
            }

            // Establecer el broker en el contexto global
            $this->brokerAuthService->setBrokerContext($broker);

            // Agregar información del broker al request
            $request->merge([
                'authenticated_broker_id' => $broker->id,
                'authenticated_broker' => $broker,
                'authenticated_user' => $user
            ]);

            // Agregar headers de respuesta con información del broker
            $response = $next($request);

            if (method_exists($response, 'header')) {
                $response->header('X-Broker-ID', (string) $broker->id);
                $response->header('X-Broker-Name', (string) $broker->name);
                $response->header('X-User-Type', $authType === 'empleado' ? 'EMPLEADO' : ($user->user_type ?? 'USER'));
            }

            return $response;

        } catch (\Exception $e) {
            Log::error('Error en GlobalBrokerAuth middleware', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => $request->user() ? $request->user()->id : null,
                'url' => $request->fullUrl(),
                'method' => $request->method()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error en autenticación global',
                'error_code' => 'AUTH_ERROR'
            ], 500);
        }
    }
}
