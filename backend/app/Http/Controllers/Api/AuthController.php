<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use App\Models\User;
use App\Models\Broker;
use App\Models\SubscriptionIntent;

class AuthController extends Controller
{
    /**
     * Sincronizar usuario de Firebase con Laravel
     */
    public function syncFirebaseUser(Request $request)
    {
        try {
            // El middleware ya ha autenticado al usuario y lo ha puesto en la request
            $user = $request->user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario no encontrado'
                ], 404);
            }

            // Obtener información adicional de Firebase del middleware
            $firebaseUid = $request->firebase_uid;
            $firebaseClaims = $request->firebase_claims;

            Log::info('Sincronización de usuario Firebase', [
                'user_id' => $user->id,
                'firebase_uid' => $firebaseUid,
                'email' => $user->email
            ]);

            // Actualizar información del usuario
            $user->updateLastLogin();

            // Si el cliente envía una selección de pricing durante el registro/login, persistirla
            $selection = $request->input('pricing_selection') ?? $request->input('selection');
            $intentCreatedId = null;
            if (is_array($selection)) {
                try {
                    $validator = Validator::make($selection, [
                        'users' => 'required|integer|min:1',
                        'period' => 'required|in:monthly,annual',
                        'storageGB' => 'nullable|integer|min:5',
                        'modules' => 'required|array',
                        'totals' => 'required|array',
                    ]);
                    if ($validator->fails()) {
                        Log::warning('pricing_selection inválida en syncFirebaseUser', [
                            'errors' => $validator->errors()->toArray(),
                        ]);
                    } else {
                        $intent = SubscriptionIntent::create([
                            'user_id' => $user->id,
                            'users_count' => (int) ($selection['users'] ?? 1),
                            'period' => (string) $selection['period'],
                            'storage_gb' => (int) ($selection['storageGB'] ?? 5),
                            'modules' => $selection['modules'] ?? [],
                            'totals' => $selection['totals'] ?? [],
                            'status' => 'pending',
                            'source' => (string) ($selection['source'] ?? 'sync_firebase_user'),
                        ]);
                        $intentCreatedId = $intent->id;
                    }
                } catch (\Throwable $e) {
                    Log::error('Error creando SubscriptionIntent en syncFirebaseUser', [
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Usuario sincronizado correctamente',
                'user' => [
                    'id' => $user->id,
                    'firebase_uid' => $user->firebase_uid,
                    'name' => $user->name,
                    'email' => $user->email,
                    'email_verified_at' => $user->email_verified_at,
                    'avatar' => $user->avatar,
                    'provider' => $user->provider,
                    'user_type' => $user->user_type,
                    'status' => $user->status,
                    'broker_id' => $user->broker_id,
                    'has_broker' => $user->getPrimaryBroker() !== null,
                    'created_at' => $user->created_at,
                    'updated_at' => $user->updated_at,
                ],
                'firebase_claims' => $firebaseClaims ?? [],
                'subscription_intent_id' => $intentCreatedId,
            ]);

        } catch (\Exception $e) {
            Log::error('Error en sincronización Firebase', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error sincronizando usuario: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Autenticación con Google para mobile (incluye simulación)
     */
    public function googleMobile(Request $request)
    {
        try {
            Log::info('Inicio de autenticación Google Mobile', [
                'platform' => $request->input('platform'),
                'device' => $request->input('device'),
                'simulation' => $request->input('simulation', false)
            ]);

            $userData = $request->input('user_data');
            $isSimulation = $request->input('simulation', false);
            
            // Validar datos requeridos
            if (!$userData || !isset($userData['email']) || !isset($userData['name'])) {
                return response()->json([
                    'success' => false,
                    'error' => 'Datos de usuario incompletos'
                ], 400);
            }

            $email = $userData['email'];
            $name = $userData['name'];
            $googleId = $userData['id'] ?? null;
            $avatar = $userData['picture'] ?? null;

            // Buscar o crear usuario
            $user = User::where('email', $email)->first();

            if (!$user) {
                // Crear nuevo usuario
                $user = User::create([
                    'name' => $name,
                    'email' => $email,
                    'firebase_uid' => $googleId ?? uniqid('google_'),
                    'provider' => $isSimulation ? 'google_simulation' : 'google',
                    'avatar' => $avatar,
                    'user_type' => 'MASTER',
                    'status' => 'active',
                    'email_verified_at' => now(),
                ]);

                Log::info('Usuario creado desde Google Mobile', [
                    'user_id' => $user->id,
                    'email' => $user->email,
                    'simulation' => $isSimulation
                ]);
            } else {
                // Actualizar usuario existente
                $user->update([
                    'name' => $name,
                    'avatar' => $avatar,
                    'provider' => $isSimulation ? 'google_simulation' : 'google',
                    'email_verified_at' => now(),
                ]);

                Log::info('Usuario actualizado desde Google Mobile', [
                    'user_id' => $user->id,
                    'email' => $user->email,
                    'simulation' => $isSimulation
                ]);
            }

            // Actualizar último login
            $user->updateLastLogin();

            // Generar token JWT
            $token = auth('api')->login($user);

            return response()->json([
                'success' => true,
                'message' => $isSimulation ? 'Autenticación simulada exitosa' : 'Autenticación Google exitosa',
                'data' => [
                    'user' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'phone' => $user->phone,
                        'role' => $user->role ?? 'user',
                        'avatar' => $user->avatar,
                        'broker_id' => $user->broker_id,
                        'user_type' => $user->user_type,
                        'provider' => $user->provider,
                    ],
                    'token' => $token,
                ],
                'simulation' => $isSimulation
            ]);

        } catch (\Exception $e) {
            Log::error('Error en autenticación Google Mobile', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error en autenticación: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Registro de usuario
     */
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:6|confirmed',
        
        ]);

        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'firebase_uid' => uniqid(),
            'password' => bcrypt($request->password),
        ]);

        // Aquí se puede enviar un correo de verificación usando Firebase
        // Firebase::sendEmailConfirmation($user);

        return response()->json(['success' => true, 'message' => 'Usuario registrado. Verifica tu correo.']);
    }


    /**
     * Obtener información del usuario autenticado
     */
    public function me(Request $request)
    {
        try {
            $user = $request->user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario no autenticado'
                ], 401);
            }

            $broker = $user->getPrimaryBroker();
            $needsOnboarding = !$broker;

            // Si necesita onboarding, devolver 403
            if ($needsOnboarding) {
                return response()->json([
                    'success' => false,
                    'needs_onboarding' => true,
                    'onboarding_step' => 'create_broker',
                    'message' => 'Usuario necesita crear un broker para acceder al sistema',
                    'user_info' => [
                        'name' => $user->name,
                        'email' => $user->email,
                        'tipo_usuario' => $user->user_type ?: 'MASTER'
                    ]
                ], 403);
            }

            // Si tiene broker, devolver información completa
            return response()->json([
                'success' => true,
                'user' => [
                    'id' => $user->id,
                    'firebase_uid' => $user->firebase_uid,
                    'name' => $user->name,
                    'email' => $user->email,
                    'email_verified_at' => $user->email_verified_at,
                    'avatar' => $user->avatar,
                    'provider' => $user->provider,
                    'user_type' => $user->user_type,
                    'status' => $user->status,
                    'broker_id' => $user->broker_id,
                    'role' => $user->role,
                    'permissions' => $user->permissions ?? [],
                    'created_at' => $user->created_at,
                    'updated_at' => $user->updated_at,
                    'last_login_at' => $user->last_login_at,
                ],
                'broker' => [
                    'id' => $broker->id,
                    'name' => $broker->name,
                    'legal_name' => $broker->legal_name,
                    'document_number' => $broker->document_number,
                    'email' => $broker->email,
                    'phone' => $broker->phone,
                    'status' => $broker->status,
                    'plan' => $broker->plan,
                    'logo' => $broker->getLogoUrl(),
                    'theme' => $broker->getThemeConfig(),
                    'branding' => [
                        'logo' => $broker->getLogoUrl(),
                        'colores' => [
                            'primario' => '#635BFF',
                            'secundario' => '#16CDC7',
                            'acento' => '#36c96c'
                        ],
                        'nombre_comercial' => $broker->name
                    ]
                ],
                'needs_onboarding' => false,
                'firebase_claims' => $request->firebase_claims ?? []
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo perfil', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error obteniendo perfil: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Crear broker (onboarding)
     */
    public function createBroker(Request $request)
    {
        try {
            $user = $request->user();
            
            Log::info('=== INICIO createBroker ===', [
                'user_id' => $user ? $user->id : 'null',
                'user_email' => $user ? $user->email : 'null',
                'request_data' => $request->all()
            ]);
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario no autenticado'
                ], 401);
            }

            // Verificar si ya tiene un broker
            $primaryBroker = $user->getPrimaryBroker();
            Log::info('Verificando broker existente', [
                'user_id' => $user->id,
                'has_primary_broker' => $primaryBroker ? 'SÍ' : 'NO',
                'primary_broker_id' => $primaryBroker ? $primaryBroker->id : 'null'
            ]);
            
            if ($primaryBroker) {
                return response()->json([
                    'success' => false,
                    'message' => 'Ya tienes un broker asociado'
                ], 400);
            }

            $validator = Validator::make($request->all(), [
                'name' => 'required|string|max:255',
                'legal_name' => 'nullable|string|max:255',
                'document_type' => 'nullable|string|in:NIT,RUT,CC,CE',
                'document_number' => 'required|string|max:50|unique:brokers,document_number',
                'email' => 'required|email|unique:brokers,email',
                'phone' => 'nullable|string|max:20',
                'address' => 'nullable|string',
                'city' => 'nullable|string|max:100',
                'state' => 'nullable|string|max:100',
                'country' => 'nullable|string|max:100',
                'industry' => 'nullable|string|max:100',
                'description' => 'nullable|string',
                'website' => 'nullable|url',
            ]);

            if ($validator->fails()) {
                Log::warning('Validación falló', [
                    'user_id' => $user->id,
                    'validation_errors' => $validator->errors(),
                    'request_data' => $request->all()
                ]);
                
                return response()->json([
                    'success' => false,
                    'message' => 'Datos inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Crear el broker (arranca en modo "Agencia Automática" por defecto)
            $broker = Broker::create(array_merge($validator->validated(), [
                'owner_id' => $user->id,
                'status' => 'trial',
                'plan' => 'starter',
                'country' => $request->country ?? 'Colombia',
                'features' => ['operativa_automatica'],
                // Cambiado a 7 días de prueba
                'trial_ends_at' => now()->addDays(7),
            ]));

            // Actualizar el usuario como MASTER y asociarlo al broker
            $user->update([
                'user_type' => 'MASTER',
                'broker_id' => $broker->id,
                'role' => 'super_admin',
                'permissions' => [], // Los masters tienen acceso a todo
            ]);

            Log::info('Broker creado exitosamente', [
                'user_id' => $user->id,
                'broker_id' => $broker->id,
                'broker_name' => $broker->name
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Broker creado exitosamente',
                'broker' => [
                    'id' => $broker->id,
                    'name' => $broker->name,
                    'legal_name' => $broker->legal_name,
                    'document_number' => $broker->document_number,
                    'email' => $broker->email,
                    'phone' => $broker->phone,
                    'status' => $broker->status,
                    'plan' => $broker->plan,
                    'trial_ends_at' => $broker->trial_ends_at,
                    'max_users' => $broker->max_users,
                    'max_clients' => $broker->max_clients,
                    'max_policies' => $broker->max_policies,
                ],
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'user_type' => $user->user_type,
                    'role' => $user->role,
                    'broker_id' => $user->broker_id,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error creando broker', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error creando broker: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Actualizar perfil del usuario
     */
    public function updateProfile(Request $request)
    {
        try {
            $user = $request->user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario no autenticado'
                ], 401);
            }

            $validator = Validator::make($request->all(), [
                'name' => 'sometimes|string|max:255',
                'phone' => 'sometimes|string|max:20',
                'avatar' => 'sometimes|string|max:500',
                'settings' => 'sometimes|array',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Datos inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            $user->update($validator->validated());

            return response()->json([
                'success' => true,
                'message' => 'Perfil actualizado exitosamente',
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'avatar' => $user->avatar,
                    'settings' => $user->settings,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error actualizando perfil', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error actualizando perfil: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Logout (no necesario para Firebase, pero mantenemos compatibilidad)
     */
    public function logout(Request $request)
    {
        try {
            // Con Firebase, el logout se maneja en el frontend
            // Aquí solo actualizamos la última actividad
            $user = $request->user();
            if ($user) {
                $user->updateLastLogin();
            }

            return response()->json([
                'success' => true,
                'message' => 'Logout exitoso'
            ]);

        } catch (\Exception $e) {
            Log::error('Error en logout', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error en logout: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Verificar estado de email (para debugging/admin)
     */
    public function checkEmailVerification(Request $request)
    {
        try {
            $email = $request->input('email');
            
            if (!$email) {
                // Si no se proporciona email, devolver info del usuario autenticado
                $user = $request->user();
                
                if (!$user) {
                    return response()->json([
                        'success' => false,
                        'message' => 'No se proporcionó email y no hay usuario autenticado'
                    ], 400);
                }
            } else {
                // Buscar usuario por email
                $user = User::where('email', $email)->first();
                
                if (!$user) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Usuario no encontrado'
                    ], 404);
                }
            }

            return response()->json([
                'success' => true,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'firebase_uid' => $user->firebase_uid,
                    'provider' => $user->provider,
                    'email_verified' => $user->hasVerifiedEmail(),
                    'email_verified_at' => $user->email_verified_at,
                    'user_type' => $user->user_type,
                    'status' => $user->status,
                    'created_at' => $user->created_at,
                    'last_login_at' => $user->last_login_at,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error verificando email', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error verificando email: ' . $e->getMessage()
            ], 500);
        }
    }
}
