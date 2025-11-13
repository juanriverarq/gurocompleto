<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use App\Models\SubscriptionIntent;
use App\Mail\SubscriptionIntentCreated;

class SubscriptionIntentController extends Controller
{
    public function store(Request $request)
    {
        try {
            $user = $request->user();
            if (!$user) {
                return response()->json(['success' => false, 'message' => 'No autenticado'], 401);
            }

            $validator = Validator::make($request->all(), [
                'users' => 'required|integer|min:1',
                'period' => 'required|in:monthly,annual',
                'storageGB' => 'nullable|integer|min:5',
                'modules' => 'required|array',
                'totals' => 'required|array',
                'source' => 'nullable|string|max:64',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Datos inválidos',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $intent = SubscriptionIntent::create([
                'user_id' => $user->id,
                'users_count' => (int) $request->input('users'),
                'period' => $request->input('period'),
                'storage_gb' => (int) ($request->input('storageGB') ?? 5),
                'modules' => $request->input('modules', []),
                'totals' => $request->input('totals', []),
                'status' => 'pending',
                'source' => $request->input('source', 'pricing_calculator'),
            ]);

            try {
                Mail::to($user->email)->send(new SubscriptionIntentCreated($intent));
            } catch (\Throwable $e) {
                Log::warning('No se pudo enviar correo de SubscriptionIntent', [
                    'intent_id' => $intent->id,
                    'error' => $e->getMessage(),
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Selección registrada correctamente',
                'data' => [
                    'id' => $intent->id,
                ],
            ], 201);
        } catch (\Throwable $e) {
            Log::error('Error guardando SubscriptionIntent', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Error interno al guardar la selección',
            ], 500);
        }
    }
}


