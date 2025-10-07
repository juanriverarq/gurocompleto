<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BrokerAuthService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class GlobalAuthController extends Controller
{
    protected $brokerAuthService;

    public function __construct(BrokerAuthService $brokerAuthService)
    {
        $this->brokerAuthService = $brokerAuthService;
    }

    /**
     * Obtener información del contexto global de autenticación
     */
    public function getGlobalContext(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            $context = $this->brokerAuthService->getCurrentContext();

            return response()->json([
                'success' => true,
                'data' => [
                    'user' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'user_type' => $user->user_type,
                        'role' => $user->role,
                        'avatar' => $user->avatar,
                        'permissions' => $user->permissions ?? []
                    ],
                    'broker' => $context['broker'],
                    'branding' => $this->brokerAuthService->getBrokerBranding(),
                    'is_authenticated' => $context['is_authenticated'],
                    'needs_onboarding' => $context['needs_onboarding'],
                    'server_time' => now()->toISOString()
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error obteniendo contexto global',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener solo información del broker actual
     */
    public function getCurrentBroker(Request $request): JsonResponse
    {
        try {
            $broker = BrokerAuthService::getCurrentBroker();

            if (!$broker) {
                return response()->json([
                    'success' => false,
                    'message' => 'No hay broker en el contexto actual',
                    'needs_onboarding' => true
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'id' => $broker->id,
                    'name' => $broker->name,
                    'legal_name' => $broker->legal_name,
                    'status' => $broker->status,
                    'plan' => $broker->plan,
                    'trial_ends_at' => $broker->trial_ends_at,
                    'logo_url' => $broker->logo_url,
                    'branding' => $this->brokerAuthService->getBrokerBranding()
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error obteniendo información del broker',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener configuración de branding del broker actual
     */
    public function getBranding(Request $request): JsonResponse
    {
        try {
            $branding = $this->brokerAuthService->getBrokerBranding();

            return response()->json([
                'success' => true,
                'data' => $branding
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error obteniendo branding',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Validar permisos del usuario actual
     */
    public function checkPermission(Request $request): JsonResponse
    {
        try {
            $permission = $request->input('permission');
            
            if (!$permission) {
                return response()->json([
                    'success' => false,
                    'message' => 'Permiso requerido'
                ], 400);
            }

            $user = $request->user();
            $hasPermission = $this->brokerAuthService->hasPermission($user, $permission);

            return response()->json([
                'success' => true,
                'data' => [
                    'has_permission' => $hasPermission,
                    'permission' => $permission,
                    'user_type' => $user->user_type
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error validando permisos',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener estadísticas del broker actual
     */
    public function getBrokerStats(Request $request): JsonResponse
    {
        try {
            $brokerId = BrokerAuthService::getCurrentBrokerId();
            
            if (!$brokerId) {
                return response()->json([
                    'success' => false,
                    'message' => 'No hay broker en el contexto actual'
                ], 404);
            }

            // Obtener estadísticas básicas
            $stats = [
                'total_clients' => \App\Models\Cliente::where('broker_id', $brokerId)->count(),
                'total_policies' => \App\Models\Poliza::where('broker_id', $brokerId)->count(),
                'active_policies' => \App\Models\Poliza::where('broker_id', $brokerId)
                    ->where('status', 'active')->count(),
                'total_claims' => \App\Models\Siniestro::where('broker_id', $brokerId)->count(),
                'pending_claims' => \App\Models\Siniestro::where('broker_id', $brokerId)
                    ->whereIn('estado', ['reportado', 'en_revision', 'asignado'])->count(),
            ];

            return response()->json([
                'success' => true,
                'data' => $stats
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error obteniendo estadísticas',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
