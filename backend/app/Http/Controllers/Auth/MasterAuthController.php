<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class MasterAuthController extends Controller
{
    /**
     * Login para cuentas master
     */
    public function login(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'email' => 'required|email',
                'password' => 'required|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Datos de validación incorrectos',
                    'errors' => $validator->errors()
                ], 422);
            }

            $user = User::where('email', $request->email)->first();

            if (!$user || !Hash::check($request->password, $user->password)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Credenciales incorrectas'
                ], 401);
            }

            if ($user->status !== 'active') {
                return response()->json([
                    'success' => false,
                    'message' => 'Cuenta inactiva. Contacte al administrador.'
                ], 401);
            }

            // Crear token
            $token = $user->createToken('master-token')->plainTextToken;

            // Actualizar último acceso
            $user->update(['last_login_at' => now()]);

            // Cargar brokers asociados
            $user->load('brokers');

            return response()->json([
                'success' => true,
                'message' => 'Login exitoso',
                'data' => [
                    'token' => $token,
                    'user' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'phone' => $user->phone,
                        'avatar' => $user->avatar,
                        'status' => $user->status,
                        'last_login_at' => $user->last_login_at,
                        'email_verified_at' => $user->email_verified_at,
                        'two_step_verification_enabled' => $user->two_step_verification_enabled,
                    ],
                    'brokers' => $user->brokers->map(function ($broker) {
                        return [
                            'id' => $broker->id,
                            'nombre' => $broker->nombre,
                            'nit' => $broker->nit,
                            'email' => $broker->email,
                            'ciudad' => $broker->ciudad,
                            'pais' => $broker->pais,
                            'dominio' => $broker->dominio,
                            'estado' => $broker->estado,
                            'plan' => $broker->plan,
                            'branding' => $broker->branding,
                        ];
                    }),
                    'stats' => [
                        'total_brokers' => $user->brokers->count(),
                        'active_brokers' => $user->brokers->where('estado', 'ACTIVO')->count(),
                    ]
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error en el servidor',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Logout para cuentas master
     */
    public function logout(Request $request)
    {
        try {
            $request->user()->currentAccessToken()->delete();

            return response()->json([
                'success' => true,
                'message' => 'Logout exitoso'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al cerrar sesión',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener información del usuario master autenticado
     */
    public function me(Request $request)
    {
        try {
            $user = $request->user();
            $user->load('brokers');

            return response()->json([
                'success' => true,
                'data' => [
                    'user' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'phone' => $user->phone,
                        'avatar' => $user->avatar,
                        'status' => $user->status,
                        'last_login_at' => $user->last_login_at,
                        'email_verified_at' => $user->email_verified_at,
                        'two_step_verification_enabled' => $user->two_step_verification_enabled,
                    ],
                    'brokers' => $user->brokers->map(function ($broker) {
                        return [
                            'id' => $broker->id,
                            'nombre' => $broker->nombre,
                            'nit' => $broker->nit,
                            'email' => $broker->email,
                            'ciudad' => $broker->ciudad,
                            'pais' => $broker->pais,
                            'dominio' => $broker->dominio,
                            'estado' => $broker->estado,
                            'plan' => $broker->plan,
                            'branding' => $broker->branding,
                        ];
                    }),
                    'stats' => [
                        'total_brokers' => $user->brokers->count(),
                        'active_brokers' => $user->brokers->where('estado', 'ACTIVO')->count(),
                    ]
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener información del usuario',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Registro de nueva cuenta master
     */
    public function register(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'name' => 'required|string|max:255',
                'email' => 'required|string|email|max:255|unique:users',
                'password' => 'required|string|min:8|confirmed',
                'phone' => 'nullable|string|max:20',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Datos de validación incorrectos',
                    'errors' => $validator->errors()
                ], 422);
            }

            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'phone' => $request->phone,
                'status' => 'active',
                'email_verified_at' => now(), // Auto-verificar para simplificar
            ]);

            $token = $user->createToken('master-token')->plainTextToken;

            return response()->json([
                'success' => true,
                'message' => 'Cuenta master creada exitosamente',
                'data' => [
                    'token' => $token,
                    'user' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'phone' => $user->phone,
                        'status' => $user->status,
                    ],
                    'brokers' => [],
                    'stats' => [
                        'total_brokers' => 0,
                        'active_brokers' => 0,
                    ]
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al crear la cuenta',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Refresh token
     */
    public function refresh(Request $request)
    {
        try {
            $user = $request->user();
            
            // Eliminar token actual
            $request->user()->currentAccessToken()->delete();
            
            // Crear nuevo token
            $token = $user->createToken('master-token')->plainTextToken;
            
            return response()->json([
                'success' => true,
                'message' => 'Token renovado exitosamente',
                'data' => [
                    'token' => $token
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al renovar token',
                'error' => $e->getMessage()
            ], 500);
        }
    }
} 