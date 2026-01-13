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

            $source = $request->input('source', 'pricing_calculator');

            // Validación diferente según el source
            if ($source === 'onboarding_flow' || $source === 'sura_onboarding_flow') {
                // Flujo de onboarding simplificado (normal o Sura)
                $validator = Validator::make($request->all(), [
                    'modules' => 'required|array',
                    'phone' => 'nullable|string|max:32',
                    'employeeCount' => 'nullable|string|max:16',
                    'businessType' => 'nullable|string|max:64',
                    'source' => 'nullable|string|max:64',
                    'coupon' => 'nullable|array',
                ]);
            } else {
                // Flujo de pricing calculator
                $validator = Validator::make($request->all(), [
                    'users' => 'required|integer|min:1',
                    'period' => 'required|in:monthly,annual',
                    'storageGB' => 'nullable|integer|min:5',
                    'modules' => 'required|array',
                    'totals' => 'required|array',
                    'source' => 'nullable|string|max:64',
                ]);
            }

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Datos inválidos',
                    'errors' => $validator->errors(),
                ], 422);
            }

            // Preparar datos para guardar
            $intentData = [
                'user_id' => $user->id,
                'modules' => $request->input('modules', []),
                'status' => 'pending',
                'source' => $source,
            ];

            if ($source === 'onboarding_flow' || $source === 'sura_onboarding_flow') {
                // Datos del flujo de onboarding (normal o Sura)
                $intentData['users_count'] = 1; // Por defecto 1 usuario en trial
                $intentData['period'] = 'annual'; // Por defecto anual para aprovechar descuentos
                $intentData['storage_gb'] = 10; // Por defecto 10GB
                
                // Guardar cupón si existe
                $coupon = $request->input('coupon');
                
                $intentData['totals'] = [
                    'phone' => $request->input('phone'),
                    'employee_count' => $request->input('employeeCount'),
                    'business_type' => $request->input('businessType'),
                ];
                
                // Guardar cupón en el intent
                $intentData['coupon'] = $coupon;

                // Actualizar teléfono del usuario si se proporcionó
                if ($request->filled('phone')) {
                    $user->update(['phone' => $request->input('phone')]);
                }

                // Actualizar broker si existe
                if ($user->broker_id && $user->broker) {
                    $broker = $user->broker;
                    $updateData = [];
                    
                    if ($request->filled('phone')) {
                        $updateData['phone'] = $request->input('phone');
                    }
                    if ($request->filled('employeeCount')) {
                        // Mapear rango de empleados a max_users
                        $employeeMap = [
                            '1' => 1,
                            '2-5' => 5,
                            '6-10' => 10,
                            '11-20' => 20,
                            '21-50' => 50,
                            '50+' => 100,
                        ];
                        $updateData['max_users'] = $employeeMap[$request->input('employeeCount')] ?? 5;
                    }
                    if ($request->filled('businessType')) {
                        $updateData['industry'] = $request->input('businessType');
                    }
                    
                    // Guardar módulos seleccionados como features del broker
                    $updateData['features'] = $request->input('modules', []);
                    
                    if (!empty($updateData)) {
                        $broker->update($updateData);
                    }
                }
            } else {
                // Datos del flujo de pricing calculator
                $intentData['users_count'] = (int) $request->input('users');
                $intentData['period'] = $request->input('period');
                $intentData['storage_gb'] = (int) ($request->input('storageGB') ?? 5);
                $intentData['totals'] = $request->input('totals', []);
            }

            $intent = SubscriptionIntent::create($intentData);

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


