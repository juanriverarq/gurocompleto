<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\CommercialTaskPriorityConfig;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class SaasCommercialTaskPriorityConfigController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $configs = CommercialTaskPriorityConfig::forBroker($brokerId);

            return response()->json(['data' => array_values($configs)]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al cargar configuraciones',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function update(Request $request, string $priorityKey): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $validator = Validator::make($request->all(), [
                'label' => 'sometimes|string|max:50',
                'icon' => 'sometimes|string|max:100',
                'color' => 'sometimes|string|max:20',
                'bg_color' => 'sometimes|string|max:50',
                'text_color' => 'sometimes|string|max:50',
                'first_notification_minutes' => 'sometimes|integer|min:0',
                'repeat_every_minutes' => 'sometimes|integer|min:0',
                'max_notifications' => 'sometimes|integer|min:1|max:20',
                'enabled' => 'sometimes|boolean',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'error' => 'Datos inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Asegurar que existe
            CommercialTaskPriorityConfig::getOrCreateDefaults($brokerId);

            $config = CommercialTaskPriorityConfig::where('broker_id', $brokerId)
                ->where('priority_key', $priorityKey)
                ->first();

            if (!$config) {
                return response()->json(['error' => 'Configuración no encontrada'], 404);
            }

            $config->update($validator->validated());

            return response()->json([
                'message' => 'Configuración actualizada',
                'data' => $config
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al actualizar',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function resetDefaults(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            $configs = CommercialTaskPriorityConfig::getOrCreateDefaults($brokerId);

            return response()->json([
                'message' => 'Configuraciones restauradas',
                'data' => array_map(fn($c) => $c->toArray(), $configs)
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al restaurar',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    private function getBrokerId(Request $request): int
    {
        // Preferir el helper unificado (soporta Firebase auth + fallbacks).
        $brokerId = \App\Http\Middleware\UnifiedAuthMiddleware::getBrokerId($request);
        if ($brokerId) return (int) $brokerId;

        if (app()->environment(['local', 'testing'])) {
            $devBrokerId = $request->header('X-Dev-Broker-Id');
            if ($devBrokerId) return (int) $devBrokerId;
        }

        $user = auth()->user();
        if ($user && $user->broker_id) return (int) $user->broker_id;

        if ($request->has('broker_id')) return (int) $request->broker_id;

        throw new \RuntimeException('No se pudo resolver broker_id para configurar prioridades.');
    }
}
