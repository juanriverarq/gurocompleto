<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Models\User;

class AuthService
{
    /**
     * Obtener el usuario autenticado desde Firebase o Empleado
     */
    public static function getAuthenticatedUser(Request $request): ?User
    {
        try {
            // Primero verificar si es un empleado autenticado
            $empleado = $request->get('authenticated_empleado');
            if ($empleado) {
                // Para empleados, crear un objeto User virtual con los datos necesarios
                $user = new User();
                $user->id = $empleado->id;
                $user->email = $empleado->email;
                $user->name = trim(($empleado->nombres ?? '') . ' ' . ($empleado->apellidos ?? ''));
                $user->broker_id = $empleado->broker_id;
                $user->user_type = 'EMPLEADO';
                $user->firebase_uid = 'empleado:' . $empleado->id;
                
                Log::info('✅ [AUTH SERVICE] Empleado autenticado encontrado', [
                    'empleado_id' => $empleado->id,
                    'email' => $empleado->email,
                    'broker_id' => $empleado->broker_id
                ]);
                return $user;
            }
            
            // Intentar obtener usuario desde el middleware firebase.auth
            $user = $request->user();
            
            if ($user) {
                Log::info('✅ [AUTH SERVICE] Usuario autenticado encontrado', [
                    'user_id' => $user->id,
                    'email' => $user->email,
                    'broker_id' => $user->broker_id,
                    'firebase_uid' => $user->firebase_uid,
                    'user_type' => $user->user_type
                ]);
                return $user;
            }
            
            Log::warning('⚠️ [AUTH SERVICE] No se encontró usuario autenticado');
            return null;
            
        } catch (\Exception $e) {
            Log::error('🚨 [AUTH SERVICE] Error obteniendo usuario autenticado', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return null;
        }
    }
    
    /**
     * Obtener el broker_id del usuario autenticado
     */
    public static function getBrokerId(Request $request): ?int
    {
        $user = self::getAuthenticatedUser($request);
        
        if (!$user) {
            Log::warning('⚠️ [AUTH SERVICE] No se puede obtener broker_id - usuario no autenticado');
            return null;
        }
        
        $brokerId = $user->broker_id;
        
        if (!$brokerId) {
            Log::warning('⚠️ [AUTH SERVICE] Usuario autenticado pero sin broker_id', [
                'user_id' => $user->id,
                'email' => $user->email
            ]);
            return null;
        }
        
        Log::info('✅ [AUTH SERVICE] Broker ID obtenido correctamente', [
            'broker_id' => $brokerId,
            'user_id' => $user->id,
            'email' => $user->email
        ]);
        
        return $brokerId;
    }
    
    /**
     * Obtener el broker completo del usuario autenticado
     */
    public static function getBroker(Request $request)
    {
        $user = self::getAuthenticatedUser($request);
        
        if (!$user) {
            return null;
        }
        
        return $user->getPrimaryBroker();
    }
    
    /**
     * Verificar si el usuario está autenticado y tiene broker
     */
    public static function validateAuth(Request $request): array
    {
        $user = self::getAuthenticatedUser($request);
        
        if (!$user) {
            return [
                'success' => false,
                'code' => 401,
                'message' => 'Usuario no autenticado',
                'data' => null
            ];
        }
        
        $brokerId = $user->broker_id;
        
        if (!$brokerId) {
            return [
                'success' => false,
                'code' => 403,
                'message' => 'Usuario sin broker asignado',
                'data' => null
            ];
        }
        
        return [
            'success' => true,
            'code' => 200,
            'message' => 'Autenticación válida',
            'data' => [
                'user' => $user,
                'broker_id' => $brokerId,
                'broker' => $user->getPrimaryBroker()
            ]
        ];
    }
    
    /**
     * Middleware estándar - aplicar a todas las rutas que requieren autenticación
     */
    public static function getStandardMiddleware(): array
    {
        return ['firebase.auth'];
    }
    
    /**
     * Respuesta estándar de error de autenticación
     */
    public static function unauthorizedResponse(string $customMessage = null)
    {
        return response()->json([
            'success' => false,
            'message' => $customMessage ?? 'Token de autorización requerido',
            'error' => 'Debes incluir un token de Firebase en el header Authorization'
        ], 401);
    }
    
    /**
     * Respuesta estándar de error de broker
     */
    public static function noBrokerResponse()
    {
        return response()->json([
            'success' => false,
            'message' => 'Broker no encontrado para el usuario',
            'error' => 'El usuario no tiene un broker asignado'
        ], 403);
    }
}
