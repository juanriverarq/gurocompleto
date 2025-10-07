<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;

class FirebaseAuthMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json([
                'error' => 'Token de autorización requerido',
                'message' => 'Debes incluir un token de Firebase en el header Authorization'
            ], 401);
        }

        try {
            // Validar el token JWT de Firebase manualmente
            $decodedToken = $this->verifyFirebaseToken($token);
            
            if (!$decodedToken) {
                return response()->json([
                    'error' => 'Token inválido',
                    'message' => 'El token de Firebase proporcionado no es válido'
                ], 401);
            }

            // Extraer información del usuario del token
            $uid = $decodedToken->sub ?? $decodedToken->user_id ?? null;
            $email = $decodedToken->email ?? null;
            $name = $decodedToken->name ?? 'Usuario';
            $emailVerified = $decodedToken->email_verified ?? false;
            $picture = $decodedToken->picture ?? null;

            if (!$uid) {
                return response()->json([
                    'error' => 'Token inválido',
                    'message' => 'No se pudo extraer el UID del token'
                ], 401);
            }

            Log::info('Token Firebase verificado correctamente', [
                'uid' => $uid,
                'email' => $email,
                'email_verified' => $emailVerified
            ]);

            // Buscar o crear el usuario en la base de datos local
            $user = User::where('firebase_uid', $uid)->first();

            if (!$user) {
                // Si viene de Custom Token de empleado, puede no traer email
                $claimsArray = isset($claimsArray) ? $claimsArray : json_decode(json_encode($decodedToken), true);
                $isEmpleado = ($claimsArray['user_type'] ?? null) === 'EMPLEADO';
                $resolvedEmail = $email;
                if ($isEmpleado && empty($resolvedEmail)) {
                    // Generar email sintético único basado en UID
                    $uidSanitized = str_replace([':', ' '], ['.', ''], (string) $uid);
                    $resolvedEmail = $uidSanitized . '@empleado.local';
                }

                // Crear nuevo usuario con privilegios mínimos por defecto
                $user = User::create([
                    'firebase_uid' => $uid,
                    'name' => $name ?: ($isEmpleado ? 'Empleado' : 'Usuario'),
                    'email' => $resolvedEmail,
                    'email_verified_at' => $emailVerified ? now() : null,
                    'avatar' => $picture,
                    'provider' => $isEmpleado ? 'firebase_custom' : 'firebase',
                    'status' => 'active',
                    'user_type' => $isEmpleado ? 'EMPLEADO' : 'USUARIO',
                    'broker_id' => $isEmpleado && isset($claimsArray['broker_id']) ? (int) $claimsArray['broker_id'] : null,
                    'last_login_at' => now(),
                ]);

                Log::info('Nuevo usuario creado desde Firebase', [
                    'user_id' => $user->id,
                    'firebase_uid' => $uid,
                    'is_empleado' => $isEmpleado,
                    'needs_onboarding' => !$isEmpleado
                ]);
            } else {
                // Actualizar datos del usuario existente
                $user->update([
                    'name' => $name ?: $user->name,
                    'email' => $email ?: $user->email,
                    'email_verified_at' => $emailVerified ? now() : $user->email_verified_at,
                    'avatar' => $picture ?: $user->avatar,
                    'last_login_at' => now(),
                ]);
            }

            // Agregar el usuario autenticado a la request
            $request->setUserResolver(function () use ($user) {
                return $user;
            });

            // Agregar información adicional de Firebase a la request
            $claimsArray = json_decode(json_encode($decodedToken), true);
            $request->merge([
                'firebase_uid' => $uid,
                'firebase_token' => $claimsArray,
                'firebase_claims' => $claimsArray
            ]);

            // Si viene de empleado (custom token), mapear broker_id y adjuntar info del empleado
            if (($claimsArray['user_type'] ?? null) === 'EMPLEADO') {
                if (isset($claimsArray['broker_id'])) {
                    $request->merge(['broker_id' => (int) $claimsArray['broker_id']]);
                }
                // Intentar resolver empleado para consumo de controladores
                try {
                    $empleadoId = isset($claimsArray['empleado_id']) ? (int) $claimsArray['empleado_id'] : null;
                    if ($empleadoId) {
                        \Log::debug('FirebaseAuthMiddleware: resolviendo empleado desde claims', ['empleado_id' => $empleadoId]);
                        $empleado = \App\Models\EmpleadoBroker::with(['rol', 'broker'])->find($empleadoId);
                        if ($empleado) {
                            $request->merge(['authenticated_empleado' => $empleado]);
                            $request->merge(['auth_type' => 'empleado']);
                        }
                    }
                } catch (\Throwable $t) {
                }
            }

            return $next($request);

        } catch (\Exception $e) {
            Log::error('Error al verificar token Firebase', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'error' => 'Error de autenticación',
                'message' => 'No se pudo verificar el token de Firebase: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Verificar token de Firebase validando firma RS256 contra JWKS de Google
     */
    private function verifyFirebaseToken(string $token): ?object
    {
        try {
            $parts = explode('.', $token);
            if (count($parts) !== 3) {
                throw new \Exception('Token JWT inválido');
            }

            [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;
            $headerJson = $this->base64UrlDecode($encodedHeader);
            $payloadJson = $this->base64UrlDecode($encodedPayload);
            $signature = $this->base64UrlDecode($encodedSignature);

            $header = json_decode($headerJson);
            $payload = json_decode($payloadJson);
            if (!$header || !$payload) {
                throw new \Exception('No se pudo decodificar header/payload del token');
            }

            // Validación de claims básicos
            $now = time();
            if (isset($payload->exp) && $payload->exp < $now) {
                throw new \Exception('Token expirado');
            }
            if (isset($payload->iat) && $payload->iat > $now + 300) {
                throw new \Exception('Token usado antes de tiempo');
            }
            $projectId = config('firebase.project_id', 'guro-b3911');
            if (isset($payload->aud) && $payload->aud !== $projectId) {
                throw new \Exception('Audience inválido');
            }
            $expectedIssuer = 'https://securetoken.google.com/' . $projectId;
            if (isset($payload->iss) && $payload->iss !== $expectedIssuer) {
                throw new \Exception('Issuer inválido');
            }
            if (!isset($payload->sub) || empty($payload->sub)) {
                throw new \Exception('Token no contiene sub');
            }

            // Obtener certificados públicos de Google (cacheados)
            $kid = $header->kid ?? null;
            if (!$kid) {
                throw new \Exception('Header sin kid');
            }

            $certs = Cache::remember('firebase_x509_certs', 60 * 60, function () {
                $url = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
                $resp = Http::timeout(5)->get($url);
                if (!$resp->ok()) {
                    throw new \Exception('No se pudieron obtener certificados públicos');
                }
                return $resp->json();
            });

            if (!isset($certs[$kid])) {
                // Forzar refresco y reintentar una vez
                Cache::forget('firebase_x509_certs');
                $certs = Cache::remember('firebase_x509_certs', 60 * 60, function () {
                    $url = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
                    $resp = Http::timeout(5)->get($url);
                    if (!$resp->ok()) {
                        throw new \Exception('No se pudieron obtener certificados públicos (retry)');
                    }
                    return $resp->json();
                });
                if (!isset($certs[$kid])) {
                    throw new \Exception('Certificado no encontrado para kid');
                }
            }

            $publicCert = $certs[$kid];

            // Verificar firma RS256
            $dataToVerify = $encodedHeader . '.' . $encodedPayload;
            $pubKey = openssl_pkey_get_public($publicCert);
            if ($pubKey === false) {
                throw new \Exception('No se pudo cargar la llave pública');
            }
            $verified = openssl_verify($dataToVerify, $signature, $pubKey, OPENSSL_ALGO_SHA256);
            openssl_free_key($pubKey);

            if ($verified !== 1) {
                throw new \Exception('Firma JWT inválida');
            }

            Log::info('Token Firebase validado exitosamente (firma y claims)', [
                'uid' => $payload->sub,
                'email' => $payload->email ?? null,
            ]);

            return $payload;

        } catch (\Exception $e) {
            Log::error('Error validando token Firebase: ' . $e->getMessage());
            return null;
        }
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
}
