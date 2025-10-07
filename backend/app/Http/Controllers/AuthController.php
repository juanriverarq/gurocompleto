<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\VerificationCode;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use App\Mail\TwoStepsVerificationMail;
use App\Mail\EmailVerificationMail;
use App\Mail\ForgotPasswordMail;
use Illuminate\Support\Facades\Log;
use App\Mail\WelcomeMail;
use Google_Client;

class AuthController extends Controller
{
    /**
     * Login de usuario
     */
    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|string|min:6',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de entrada inválidos',
                'errors' => $validator->errors()
            ], 400);
        }

        if (!Auth::attempt($request->only('email', 'password'))) {
            return response()->json([
                'success' => false,
                'message' => 'Credenciales inválidas'
            ], 401);
        }

        $user = Auth::user();
        
        // Verificar si el usuario tiene verificación en dos pasos habilitada
        if ($user->two_step_verification_enabled) {
            // Generar y enviar código de verificación
            $code = $this->generateVerificationCode($user->id, 'two_step');
            
            // Enviar código por email
            Mail::to($user->email)->send(new TwoStepsVerificationMail($code));
            
            return response()->json([
                'success' => true,
                'message' => 'Código de verificación enviado',
                'requires_two_step' => true,
                'masked_phone' => $this->maskPhone($user->phone)
            ]);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Inicio de sesión exitoso',
            'data' => [
                'token' => $token,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone ?? '',
                    'role' => $user->user_type ?? 'admin',
                    'avatar' => $user->avatar,
                    'broker_id' => $user->broker_id
                ]
            ],
            'requires_two_step' => false
        ]);
    }

    /**
     * Registro de usuario
     */
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de entrada inválidos',
                'errors' => $validator->errors()
            ], 400);
        }

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
        ]);

        // Enviar código de verificación de email
        $code = $this->generateVerificationCode($user->id, 'email_verification');
        Mail::to($user->email)->send(new EmailVerificationMail($code));

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Usuario registrado exitosamente. Verifica tu email.',
            'user' => $user,
            'token' => $token,
            'requires_email_verification' => true
        ], 201);
    }

    /**
     * Olvidé mi contraseña
     */
    public function forgotPassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email|exists:users',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Email no encontrado',
                'errors' => $validator->errors()
            ], 400);
        }

        $user = User::where('email', $request->email)->first();
        $code = $this->generateVerificationCode($user->id, 'password_reset');

        Mail::to($user->email)->send(new ForgotPasswordMail($code));

        return response()->json([
            'success' => true,
            'message' => 'Código de restablecimiento enviado a tu email'
        ]);
    }

    /**
     * Restablecer contraseña
     */
    public function resetPassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email|exists:users',
            'code' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validator->errors()
            ], 400);
        }

        $user = User::where('email', $request->email)->first();
        
        if (!$this->verifyCode($user->id, $request->code, 'password_reset')) {
            return response()->json([
                'success' => false,
                'message' => 'Código inválido o expirado'
            ], 400);
        }

        $user->password = Hash::make($request->password);
        $user->save();

        // Eliminar código usado
        $this->deleteUsedCode($user->id, $request->code);

        return response()->json([
            'success' => true,
            'message' => 'Contraseña restablecida exitosamente'
        ]);
    }

    /**
     * Enviar código de verificación en dos pasos
     */
    public function sendTwoStepsCode(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email|exists:users',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Email no encontrado',
                'errors' => $validator->errors()
            ], 400);
        }

        $user = User::where('email', $request->email)->first();
        $code = $this->generateVerificationCode($user->id, 'two_step');

        Mail::to($user->email)->send(new TwoStepsVerificationMail($code));

        return response()->json([
            'success' => true,
            'message' => 'Código de verificación enviado',
            'masked_phone' => $this->maskPhone($user->phone)
        ]);
    }

    /**
     * Verificar código de dos pasos
     */
    public function verifyTwoStepsCode(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email|exists:users',
            'code' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validator->errors()
            ], 400);
        }

        $user = User::where('email', $request->email)->first();
        
        if (!$this->verifyCode($user->id, $request->code, 'two_step')) {
            return response()->json([
                'success' => false,
                'message' => 'Código inválido o expirado'
            ], 400);
        }

        // Eliminar código usado
        $this->deleteUsedCode($user->id, $request->code);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Verificación exitosa',
            'user' => $user,
            'token' => $token
        ]);
    }

    /**
     * Enviar verificación de email
     */
    public function sendEmailVerification(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email|exists:users',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Email requerido y debe existir',
                'errors' => $validator->errors()
            ], 400);
        }

        $user = User::where('email', $request->email)->first();
        
        if ($user->hasVerifiedEmail()) {
            return response()->json([
                'success' => false,
                'message' => 'Email ya verificado'
            ], 400);
        }

        $code = $this->generateVerificationCode($user->id, 'email_verification');
        Mail::to($user->email)->send(new EmailVerificationMail($code));

        return response()->json([
            'success' => true,
            'message' => 'Código de verificación enviado'
        ]);
    }

    /**
     * Verificar email
     */
    public function verifyEmail(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'code' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Código requerido',
                'errors' => $validator->errors()
            ], 400);
        }

        // Buscar el código de verificación para encontrar al usuario
        $verificationCode = VerificationCode::where('code', $request->code)
            ->where('type', 'email_verification')
            ->where('expires_at', '>', now())
            ->first();

        if (!$verificationCode) {
            return response()->json([
                'success' => false,
                'message' => 'Código inválido o expirado'
            ], 400);
        }

        $user = User::find($verificationCode->user_id);
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Usuario no encontrado'
            ], 400);
        }

        $user->markEmailAsVerified();
        $this->deleteUsedCode($user->id, $request->code);

        return response()->json([
            'success' => true,
            'message' => 'Email verificado exitosamente'
        ]);
    }
    
    // Método duplicado de syncFirebaseUser eliminado para evitar colisiones
    
    /**
     * Autenticación con Google OAuth móvil (Opción A - OAuth puro)
     */
    public function googleMobileLogin(Request $request)
    {
        try {
            Log::info('🚀 [Google Mobile Auth] Iniciando autenticación Google móvil', [
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'data_received' => $request->except(['id_token']) // No loggear el token por seguridad
            ]);
            
            // Validar datos de entrada
            $validator = Validator::make($request->all(), [
                'id_token' => 'required|string',
                'device' => 'sometimes|string',
                'platform' => 'sometimes|string'
            ]);
            
            if ($validator->fails()) {
                Log::warning('🚀 [Google Mobile Auth] Validación fallida', [
                    'errors' => $validator->errors()
                ]);
                
                return response()->json([
                    'success' => false,
                    'message' => 'Datos de entrada inválidos',
                    'errors' => $validator->errors()
                ], 400);
            }
            
            // Verificar token con Google
            $client = new Google_Client();
            $client->setClientId(config('services.google_mobile.client_id'));
            
            $payload = $client->verifyIdToken($request->id_token);
            
            if (!$payload) {
                Log::error('🚀 [Google Mobile Auth] Token inválido');
                
                return response()->json([
                    'success' => false,
                    'message' => 'Token de Google inválido'
                ], 401);
            }
            
            Log::info('🚀 [Google Mobile Auth] Token validado exitosamente', [
                'google_user_id' => $payload['sub'],
                'email' => $payload['email'],
                'name' => $payload['name'] ?? 'Sin nombre'
            ]);
            
            // Buscar o crear usuario
            $user = User::firstOrCreate([
                'email' => $payload['email']
            ], [
                'name' => $payload['name'] ?? 'Usuario Google',
                'google_id' => $payload['sub'],
                'avatar' => $payload['picture'] ?? null,
                'provider' => 'google',
                'user_type' => 'user',
                'broker_id' => 1, // Broker por defecto
                'email_verified_at' => now(),
                'password' => Hash::make(Str::random(32)), // Contraseña aleatoria
            ]);
            
            // Actualizar última conexión
            $user->update([
                'last_login_at' => now(),
                'provider' => 'google'
            ]);
            
            // Crear token Sanctum
            $token = $user->createToken('mobile-app-google', ['mobile-access'])->plainTextToken;
            
            Log::info('🚀 [Google Mobile Auth] Autenticación exitosa', [
                'user_id' => $user->id,
                'email' => $user->email,
                'was_created' => $user->wasRecentlyCreated
            ]);
            
            // Enviar email de bienvenida si es nuevo usuario
            if ($user->wasRecentlyCreated) {
                try {
                    Mail::to($user->email)->send(new WelcomeMail($user));
                } catch (\Exception $e) {
                    Log::error('Error enviando email de bienvenida', [
                        'user_id' => $user->id,
                        'error' => $e->getMessage()
                    ]);
                }
            }
            
            return response()->json([
                'success' => true,
                'message' => 'Autenticación Google exitosa',
                'data' => [
                    'user' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'phone' => $user->phone ?? '',
                        'role' => $user->user_type ?? 'user',
                        'avatar' => $user->avatar,
                        'broker_id' => $user->broker_id,
                        'provider' => $user->provider,
                        'is_new_user' => $user->wasRecentlyCreated
                    ],
                    'token' => $token
                ]
            ]);
            
        } catch (\Exception $e) {
            Log::error('🚀 [Google Mobile Auth] Error en autenticación', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Error interno del servidor',
                'error' => config('app.debug') ? $e->getMessage() : 'Error de autenticación'
            ], 500);
        }
    }

    /**
     * Logout
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Sesión cerrada exitosamente'
        ]);
    }

    /**
     * Obtener perfil del usuario
     */
    public function profile(Request $request)
    {
        return response()->json([
            'success' => true,
            'user' => $request->user()
        ]);
    }

    /**
     * Actualizar perfil del usuario
     */
    public function updateProfile(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'phone' => 'sometimes|string|max:20',
            'avatar' => 'sometimes|string|max:500',
            'two_step_verification_enabled' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validator->errors()
            ], 400);
        }

        $user = $request->user();
        $user->update($request->only(['name', 'phone', 'avatar', 'two_step_verification_enabled']));

        return response()->json([
            'success' => true,
            'message' => 'Perfil actualizado exitosamente',
            'user' => $user
        ]);
    }

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

            // Actualizar información del usuario si es necesario
            $user->update([
                'last_login_at' => now(),
            ]);

            // Enviar email de bienvenida solo si es un usuario nuevo
            if ($user->wasRecentlyCreated) {
                try {
                    Mail::to($user->email)->send(new WelcomeMail($user));
                    Log::info('Email de bienvenida enviado', ['user_id' => $user->id]);
                } catch (\Exception $e) {
                    Log::error('Error enviando email de bienvenida', [
                        'user_id' => $user->id,
                        'error' => $e->getMessage()
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
                    'status' => $user->status,
                    'created_at' => $user->created_at,
                    'updated_at' => $user->updated_at,
                ],
                'firebase_claims' => $firebaseClaims
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
     * Obtener perfil del usuario autenticado
     */
    public function getProfile(Request $request)
    {
        try {
            $user = $request->user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario no autenticado'
                ], 401);
            }

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
                    'status' => $user->status,
                    'created_at' => $user->created_at,
                    'updated_at' => $user->updated_at,
                    'last_login_at' => $user->last_login_at,
                ],
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
     * Generar código de verificación
     */
    private function generateVerificationCode($userId, $type)
    {
        $code = str_pad(random_int(100000, 999999), 6, '0', STR_PAD_LEFT);
        
        VerificationCode::create([
            'user_id' => $userId,
            'code' => $code,
            'type' => $type,
            'expires_at' => now()->addMinutes(10)
        ]);

        return $code;
    }

    /**
     * Verificar código
     */
    private function verifyCode($userId, $code, $type)
    {
        return VerificationCode::where('user_id', $userId)
            ->where('code', $code)
            ->where('type', $type)
            ->where('expires_at', '>', now())
            ->exists();
    }

    /**
     * Eliminar código usado
     */
    private function deleteUsedCode($userId, $code)
    {
        VerificationCode::where('user_id', $userId)
            ->where('code', $code)
            ->delete();
    }

    /**
     * Enmascarar número de teléfono
     */
    private function maskPhone($phone)
    {
        if (!$phone) return null;
        
        $length = strlen($phone);
        if ($length <= 4) return $phone;
        
        return substr($phone, 0, 3) . str_repeat('*', $length - 7) . substr($phone, -4);
    }
}
