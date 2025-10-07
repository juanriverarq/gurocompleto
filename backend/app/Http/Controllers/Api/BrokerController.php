<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Traits\RequiresAuth;
use App\Models\Broker;

class BrokerController extends Controller
{
    use RequiresAuth;

    /**
     * Obtener configuración del broker autenticado
     */
    public function getSettings(Request $request): JsonResponse
    {
      return $this->executeWithAuth($request, function ($user, $brokerId) {
        $broker = Broker::findOrFail($brokerId);
        return response()->json([
          'success' => true,
          'settings' => $broker->settings ?? [],
        ]);
      });
    }

    /**
     * Actualizar configuración del broker (incluye voice_calls_markup_percent)
     */
    public function updateSettings(Request $request): JsonResponse
    {
      return $this->executeWithAuth($request, function ($user, $brokerId) use ($request) {
        $request->validate([
          'voice_calls_markup_percent' => 'nullable|integer|min:0|max:200',
        ]);

        $broker = Broker::findOrFail($brokerId);
        $settings = $broker->settings ?? [];

        if ($request->has('voice_calls_markup_percent')) {
          $settings['voice_calls_markup_percent'] = (int) $request->input('voice_calls_markup_percent');
        }

        $broker->settings = $settings;
        $broker->save();

        return response()->json([
          'success' => true,
          'settings' => $broker->settings,
        ]);
      });
    }
}
