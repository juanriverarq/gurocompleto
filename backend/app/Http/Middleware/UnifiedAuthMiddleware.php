<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Models\User;
use App\Models\EmpleadoBroker;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;

class UnifiedAuthMiddleware
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (config('app.debug')) {
            Log::info('🔥 UnifiedAuthMiddleware - INICIANDO', [
                'url' => $request->url(),
                'method' => $request->method(),
                'has_auth_header' => $request->hasHeader('Authorization')
            ]);
        }
        
        $authHeader = $request->header('Authorization');
        
        // Soportar token via query param (para <img>, <audio>, <video> que no pueden enviar headers)
        if ((!$authHeader || !str_starts_with($authHeader, 'Bearer ')) && $request->has('token')) {
            $authHeader = 'Bearer ' . $request->input('token');
        }

        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            Log::error('🔥 UnifiedAuthMiddleware - NO HAY TOKEN');
            return response()->json([
                'error' => 'Token de autorización requerido',
                'message' => 'Se requiere un token Bearer en el header Authorization'
            ], 401);
        }

        $token = substr($authHeader, 7);
        
        if (config('app.debug')) {
            Log::info('🔥 UnifiedAuthMiddleware - Token extraído', [
                'token_length' => strlen($token)
            ]);
        }

        
        // Primero intentar autenticación Firebase (más común)
        $firebaseUser = $this->authenticateFirebase($token, $request);

        // Caso especial: empleado autenticado vía Firebase Custom Token (claims personalizados)
        if ($request->get('auth_type') === 'empleado' && $request->get('authenticated_empleado')) {
            if (config('app.debug')) {
                Log::info('🔥 UnifiedAuthMiddleware - EMPLEADO vía Firebase claims detectado', [
                    'empleado_id' => optional($request->get('authenticated_empleado'))->id,
                    'broker_id' => $request->get('broker_id')
                ]);
            }
            return $next($request);
        }

        if ($firebaseUser) {
            if (config('app.debug')) {
                Log::info('🔥 UnifiedAuthMiddleware - FIREBASE AUTH EXITOSO', [
                    'user_id' => $firebaseUser->id,
                    'user_email' => $firebaseUser->email
                ]);
            }
            
            // Establecer el usuario autenticado
            $request->merge([
                'authenticated_user' => $firebaseUser,
                'auth_type' => 'firebase',
                'broker_id' => $firebaseUser->broker_id
            ]);
            
            // También establecer en el contexto de Laravel Auth para compatibilidad
            Auth::setUser($firebaseUser);
            
            return $next($request);
        }
        
        // Si Firebase falla, intentar autenticación de empleados con JWT firmados (HS256)
        $empleado = $this->authenticateEmpleado($token, $request);
        if ($empleado) {
            if (config('app.debug')) {
                Log::info('🔥 UnifiedAuthMiddleware - EMPLEADO AUTH EXITOSO (JWT HS256)', [
                    'empleado_id' => $empleado->id,
                    'empleado_email' => $empleado->email
                ]);
            }
            $request->merge([
                'authenticated_empleado' => $empleado,
                'auth_type' => 'empleado',
                'broker_id' => $empleado->broker_id
            ]);
            return $next($request);
        }
        
        Log::error('🔥 UnifiedAuthMiddleware - FALLÓ TODAS LAS AUTENTICACIONES');
        return response()->json([
            'error' => 'Token de autenticación inválido',
            'message' => 'No se pudo autenticar el token proporcionado'
        ], 401);
    }
    
    /**
     * Intentar autenticación con Firebase
     */
    private function authenticateFirebase(string $token, Request $request): ?User
    {
        try {
            // Log removido para mejorar rendimiento
            
            // Verificar si es un JWT válido
            $parts = explode('.', $token);
            if (count($parts) !== 3) {
                Log::warning('🔥 Firebase Auth - Token no es JWT válido');
                return null;
            }
            
            // Decodificar payload
            $payloadRaw = $parts[1];
            $payloadRaw = str_replace(['-', '_'], ['+', '/'], $payloadRaw);
            $payloadRaw .= str_repeat('=', (4 - strlen($payloadRaw) % 4) % 4);
            
            $payloadDecoded = base64_decode($payloadRaw);
            if (!$payloadDecoded) {
                Log::error('🔥 Firebase Auth - Error decodificando base64');
                return null;
            }
            
            $payload = json_decode($payloadDecoded);
            if (!$payload || !isset($payload->sub)) {
                Log::error('🔥 Firebase Auth - Payload inválido o sin sub');
                return null;
            }
            
            // Log removido para mejorar rendimiento

            // Detectar si es un Custom Token de empleado (claims personalizados)
            $empleadoId = null;
            $brokerIdFromClaims = null;
            // Intentar varias convenciones de nombres para robustez
            if (isset($payload->empleado_id)) { $empleadoId = (int) $payload->empleado_id; }
            if (isset($payload->empleadoId)) { $empleadoId = (int) $payload->empleadoId; }
            if (isset($payload->claims) && is_object($payload->claims)) {
                if (isset($payload->claims->empleado_id)) { $empleadoId = (int) $payload->claims->empleado_id; }
                if (isset($payload->claims->empleadoId)) { $empleadoId = (int) $payload->claims->empleadoId; }
                if (isset($payload->claims->broker_id)) { $brokerIdFromClaims = (int) $payload->claims->broker_id; }
                if (isset($payload->claims->brokerId)) { $brokerIdFromClaims = (int) $payload->claims->brokerId; }
            }
            if (isset($payload->broker_id)) { $brokerIdFromClaims = (int) $payload->broker_id; }
            if (isset($payload->brokerId)) { $brokerIdFromClaims = (int) $payload->brokerId; }

            if ($empleadoId) {
                $empleado = \App\Models\EmpleadoBroker::with(['broker','rol'])->find($empleadoId);
                if ($empleado) {
                    Log::info('🔥 Firebase Auth - Custom Token de EMPLEADO detectado (claims)', [
                        'empleado_id' => $empleadoId,
                        'broker_id_claim' => $brokerIdFromClaims,
                    ]);
                    // Autenticar como empleado en el request
                    $request->merge([
                        'authenticated_empleado' => $empleado,
                        'auth_type' => 'empleado',
                        'broker_id' => $brokerIdFromClaims ?: $empleado->broker_id,
                    ]);
                    // En este flujo no devolvemos User; el handle detectará auth_type=empleado y continuará
                    return null;
                } else {
                    Log::warning('🔥 Firebase Auth - empleado_id en claims pero no encontrado', [
                        'empleado_id' => $empleadoId
                    ]);
                }
            }

            // Fallback adicional: si no llegaron claims pero el UID del ID Token es "empleado:{id}"
            // interpretar como sesión de empleado (flujo con Firebase Custom Token)
            if (!$request->get('authenticated_empleado') && isset($payload->sub) && is_string($payload->sub)) {
                if (str_starts_with($payload->sub, 'empleado:')) {
                    $empleadoIdFromSub = (int) substr($payload->sub, strlen('empleado:'));
                    if ($empleadoIdFromSub > 0) {
                        $empleado = \App\Models\EmpleadoBroker::with(['broker','rol'])->find($empleadoIdFromSub);
                        if ($empleado) {
                            Log::info('🔥 Firebase Auth - UID patrón empleado:{id} detectado (sin claims), autenticando como EMPLEADO', [
                                'empleado_id' => $empleadoIdFromSub,
                            ]);
                            $request->merge([
                                'authenticated_empleado' => $empleado,
                                'auth_type' => 'empleado',
                                'broker_id' => $empleado->broker_id,
                            ]);
                            // En este flujo no devolvemos User; el handle detectará auth_type=empleado y continuará
                            return null;
                        }
                    }
                }
            }
            
            // Buscar usuario por firebase_uid
            $user = User::where('firebase_uid', $payload->sub)->first();
            
            if ($user) {
                return $user;
            }
            
            // Si no se encuentra por UID, buscar por email
            if (isset($payload->email)) {
                $user = User::where('email', $payload->email)->first();
                
                if ($user) {
                    // Actualizar el firebase_uid si no estaba establecido
                    if (!$user->firebase_uid) {
                        $user->firebase_uid = $payload->sub;
                        $user->save();
                    }
                    
                    return $user;
                }
            }
            
            Log::warning('🔥 Firebase Auth - Usuario NO encontrado', [
                'firebase_uid' => $payload->sub,
                'email' => $payload->email ?? 'NO_EMAIL'
            ]);
            
            return null;
            
        } catch (\Exception $e) {
            Log::error('🔥 Firebase Auth - Excepción', [
                'error' => $e->getMessage(),
                'line' => $e->getLine()
            ]);
            return null;
        }
    }
    
    /**
     * Intentar autenticación con empleado
     */
    private function authenticateEmpleado(string $token, Request $request): ?EmpleadoBroker
    {
        try {
            // 1) Intentar JWT HS256
            $payload = $this->verifyEmployeeJwtHs256($token);

            // 2) Fallback: token simple base64 { empleado_id, broker_id, exp }
            if (!$payload) {
                $decoded = json_decode(base64_decode($token), true);
                if (is_array($decoded) && isset($decoded['empleado_id'], $decoded['broker_id'], $decoded['exp'])) {
                    $payload = $decoded;
                }
            }

            if (!$payload) {
                return null;
            }

            // Validaciones mínimas requeridas
            if (!isset($payload['empleado_id']) || !isset($payload['broker_id']) || !isset($payload['exp'])) {
                Log::warning('🔥 Empleado Auth - Claims faltantes en token');
                return null;
            }
            if ((int) $payload['exp'] <= time()) {
                Log::warning('🔥 Empleado Auth - Token expirado');
                return null;
            }

            // Buscar empleado y validar acceso
            $empleado = EmpleadoBroker::with(['rol', 'broker'])->find($payload['empleado_id']);
            if (!$empleado) {
                Log::warning('🔥 Empleado Auth - Empleado no encontrado');
                return null;
            }
            if (!$empleado->puedeAcceder()) {
                Log::warning('🔥 Empleado Auth - Empleado no puede acceder');
                return null;
            }
            if ($empleado->broker_id !== (int) $payload['broker_id']) {
                Log::warning('🔥 Empleado Auth - Broker ID no coincide');
                return null;
            }
            return $empleado;
        } catch (\Throwable $e) {
            Log::error('🔥 Empleado Auth - Excepción', [ 'error' => $e->getMessage() ]);
            return null;
        }
    }

    /**
     * Verifica un JWT HS256 para empleados usando EMPLOYEE_JWT_SECRET
     * Retorna el payload como array si es válido, o null si inválido
     */
    private function verifyEmployeeJwtHs256(string $jwt): ?array
    {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) {
            return null;
        }
        [$headerB64, $payloadB64, $signatureB64] = $parts;
        $headerJson = $this->base64UrlDecode($headerB64);
        $payloadJson = $this->base64UrlDecode($payloadB64);
        $signature = $this->base64UrlDecode($signatureB64);

        $header = json_decode($headerJson, true);
        $payload = json_decode($payloadJson, true);
        if (!$header || !$payload) {
            return null;
        }
        if (($header['alg'] ?? null) !== 'HS256' || ($header['typ'] ?? null) !== 'JWT') {
            return null;
        }
        $secret = config('app.employee_jwt_secret', env('EMPLOYEE_JWT_SECRET'));
        if (!$secret) {
            Log::error('🛑 EMPLOYEE_JWT_SECRET no configurado');
            return null;
        }
        $data = $headerB64 . '.' . $payloadB64;
        $expected = hash_hmac('sha256', $data, $secret, true);
        if (!$this->timingSafeEquals($expected, $signature)) {
            return null;
        }
        return $payload;
    }

    private function timingSafeEquals(string $a, string $b): bool
    {
        if (strlen($a) !== strlen($b)) {
            return false;
        }
        $res = 0;
        for ($i = 0; $i < strlen($a); $i++) {
            $res |= ord($a[$i]) ^ ord($b[$i]);
        }
        return $res === 0;
    }

    private function base64UrlDecode(string $input): string
    {
        $remainder = strlen($input) % 4;
        if ($remainder) {
            $padlen = 4 - $remainder;
            $input .= str_repeat('=', $padlen);
        }
        $input = strtr($input, '-_', '+/');
        return base64_decode($input) ?: '';
    }

    /**
     * Obtener el usuario autenticado (Firebase o Empleado)
     */
    public static function getAuthenticatedUser(Request $request)
    {
        $authType = $request->get('auth_type');
        
        Log::info('🔥 getAuthenticatedUser - Tipo de auth', ['auth_type' => $authType]);
        
        if ($authType === 'firebase') {
            $user = $request->get('authenticated_user');
            Log::info('🔥 getAuthenticatedUser - Usuario Firebase', [
                'user_id' => $user ? $user->id : null,
                'user_email' => $user ? $user->email : null
            ]);
            return $user;
        } elseif ($authType === 'empleado') {
            $empleado = $request->get('authenticated_empleado');
            Log::info('🔥 getAuthenticatedUser - Empleado', [
                'empleado_id' => $empleado ? $empleado->id : null
            ]);
            return $empleado;
        }
        
        Log::warning('🔥 getAuthenticatedUser - No hay usuario autenticado');
        return null;
    }

    /**
     * Obtener el broker_id del usuario autenticado
     */
    public static function getBrokerId(Request $request): ?int
    {
        $brokerId = $request->get('broker_id');
        Log::info('🔥 getBrokerId', ['broker_id' => $brokerId]);
        return $brokerId;
    }

    /**
     * Verificar si es empleado
     */
    public static function isEmpleado(Request $request): bool
    {
        return $request->get('auth_type') === 'empleado';
    }

    /**
     * Verificar si es usuario Firebase
     */
    public static function isFirebaseUser(Request $request): bool
    {
        return $request->get('auth_type') === 'firebase';
    }
}
