<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\EmpleadoBroker;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class EmpleadoAuthController extends Controller
{
    /**
     * Login de empleado
     */
    public function login(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'identifier' => 'required|string', // email o usuario
                'password' => 'required|string',
            ], [
                'identifier.required' => 'Email o usuario es obligatorio',
                'password.required' => 'La contraseña es obligatoria',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors(),
                ], 422);
            }

            // Buscar empleado por email o usuario
            $empleado = EmpleadoBroker::findForAuth($request->identifier);

            if (!$empleado) {
                return response()->json([
                    'success' => false,
                    'message' => 'Credenciales inválidas',
                ], 401);
            }

            // Verificar contraseña
            if (!Hash::check($request->password, $empleado->password)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Credenciales inválidas',
                ], 401);
            }

            // Verificar si el empleado puede acceder
            if (!$empleado->puedeAcceder()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Acceso denegado. Contacte al administrador.',
                ], 403);
            }

            // Generar Firebase Custom Token (para IdP único)
            $firebaseCustomToken = app(\App\Services\FirebaseCustomTokenService::class)->createForEmpleado($empleado);

            // Registrar acceso
            $empleado->registrarAcceso();

            // Cargar relaciones necesarias
            $empleado->load(['rol', 'broker']);

            // Preparar datos del broker con logo_url y branding completo
            $broker = $empleado->broker;
            $brokerData = $broker ? array_merge($broker->toArray(), [
                'logo_url' => $broker->getLogoUrl(),
                'favicon_url' => $broker->getFaviconUrl(),
                'branding' => array_merge(
                    is_array($broker->branding) ? $broker->branding : [],
                    [
                        'logo' => $broker->getLogoUrl(),
                        'favicon' => $broker->getFaviconUrl(),
                        'primary_color' => $broker->branding['primary_color'] ?? null,
                    ]
                ),
            ]) : null;

            return response()->json([
                'success' => true,
                'message' => 'Login exitoso',
                'data' => [
                    'firebase_custom_token' => $firebaseCustomToken,
                    'user_type' => 'empleado',
                    'empleado' => $empleado,
                    'broker' => $brokerData,
                    'permisos' => $empleado->obtenerPermisos(),
                    'first_login' => $empleado->first_login,
                    'requiere_cambio_password' => $empleado->requiere_cambio_password,
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error en el login: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Logout de empleado
     */
    public function logout(Request $request)
    {
        try {
            // Si tiene un token válido, invalidarlo
            $token = $request->bearerToken();
            if ($token) {
                // Aquí podrías invalidar el token en una cache/redis si usas JWT
                // Por ahora solo respondemos exitosamente
            }

            return response()->json([
                'success' => true,
                'message' => 'Logout exitoso',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error en el logout: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Cambiar contraseña
     */
    public function cambiarPassword(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'current_password' => 'required|string',
                'new_password' => 'required|string|min:6|confirmed',
            ], [
                'current_password.required' => 'La contraseña actual es obligatoria',
                'new_password.required' => 'La nueva contraseña es obligatoria',
                'new_password.min' => 'La nueva contraseña debe tener al menos 6 caracteres',
                'new_password.confirmed' => 'La confirmación de contraseña no coincide',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors(),
                ], 422);
            }

            // Obtener empleado autenticado (deberías implementar middleware)
            $empleadoId = $request->header('X-Empleado-Id'); // Temporal
            $empleado = EmpleadoBroker::find($empleadoId);

            if (!$empleado) {
                return response()->json([
                    'success' => false,
                    'message' => 'Empleado no encontrado',
                ], 404);
            }

            // Verificar contraseña actual
            if (!Hash::check($request->current_password, $empleado->password)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Contraseña actual incorrecta',
                ], 401);
            }

            // Actualizar contraseña
            $empleado->update([
                'password' => $request->new_password, // Se hashea automáticamente
                'requiere_cambio_password' => false,
                'first_login' => false,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Contraseña actualizada exitosamente',
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al cambiar contraseña: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Obtener perfil del empleado
     */
    public function perfil(Request $request)
    {
        try {
            // Obtener empleado autenticado (deberías implementar middleware)
            $empleadoId = $request->header('X-Empleado-Id'); // Temporal
            $empleado = EmpleadoBroker::with(['rol', 'broker'])->find($empleadoId);

            if (!$empleado) {
                return response()->json([
                    'success' => false,
                    'message' => 'Empleado no encontrado',
                ], 404);
            }

            return response()->json([
                'success' => true,
                'message' => 'Perfil obtenido exitosamente',
                'data' => [
                    'empleado' => $empleado,
                    'permisos' => $empleado->obtenerPermisos(),
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener perfil: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Verificar si un identificador es de empleado
     */
    public function verificarEmpleado(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'identifier' => 'required|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Identificador requerido',
                ], 422);
            }

            $empleado = EmpleadoBroker::where(function ($query) use ($request) {
                $query->where('email', $request->identifier)
                      ->orWhere('usuario', $request->identifier);
            })
            ->where('acceso_activo', true)
            ->where('estado', EmpleadoBroker::ESTADO_ACTIVO)
            ->first();

            return response()->json([
                'success' => true,
                'is_empleado' => $empleado ? true : false,
                'data' => $empleado ? [
                    'nombres' => $empleado->nombres,
                    'apellidos' => $empleado->apellidos,
                    'broker_nombre' => $empleado->broker->nombre ?? null,
                ] : null,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al verificar empleado: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Generar contraseña temporal para nuevo empleado
     */
    public function generarPasswordTemporal(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'usuario' => 'required|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario requerido',
                ], 422);
            }

            $empleado = EmpleadoBroker::where('usuario', $request->usuario)
                ->where('acceso_activo', true)
                ->first();

            if (!$empleado) {
                return response()->json([
                    'success' => false,
                    'message' => 'Empleado no encontrado',
                ], 404);
            }

            $passwordTemporal = $empleado->generarPasswordTemporal();

            return response()->json([
                'success' => true,
                'message' => 'Contraseña temporal generada',
                'password' => $passwordTemporal,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al generar contraseña: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Generar token de acceso simple (puedes mejorarlo con JWT)
     */
    // Método eliminado: ahora usamos FirebaseCustomTokenService

    /**
     * Validar token de acceso
     */
    public function validarToken(Request $request)
    {
        try {
            $token = $request->bearerToken();
            
            if (!$token) {
                return response()->json([
                    'success' => false,
                    'message' => 'Token no proporcionado',
                ], 401);
            }

            // Decodificar token simple
            $payload = json_decode(base64_decode($token), true);
            
            if (!$payload || !isset($payload['empleado_id']) || $payload['exp'] < time()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Token inválido o expirado',
                ], 401);
            }

            $empleado = EmpleadoBroker::with(['rol', 'broker'])->find($payload['empleado_id']);
            
            if (!$empleado || !$empleado->puedeAcceder()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Empleado no válido o sin acceso',
                ], 401);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'empleado' => $empleado,
                    'permisos' => $empleado->obtenerPermisos(),
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al validar token: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Devolver el contexto actualizado del empleado autenticado (rol, permisos, broker)
     */
    public function contexto(Request $request)
    {
        try {
            // Soporta autenticación por Firebase (custom token) con claims de empleado
            $empleado = $request->get('authenticated_empleado');
            if (!$empleado) {
                // Fallback: intentar resolver por claims en el middleware de Firebase
                $claims = $request->get('firebase_claims');
                $empleadoId = is_array($claims) ? ($claims['empleado_id'] ?? null) : null;
                if ($empleadoId) {
                    $empleado = EmpleadoBroker::with(['rol', 'broker'])->find($empleadoId);
                }
            }

            if (!$empleado || !$empleado->puedeAcceder()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Empleado no autenticado o sin acceso'
                ], 401);
            }

            // Recargar relaciones actuales desde BD para reflejar cambios de rol/permisos
            $empleado->load(['rol', 'broker']);

            // Calcular versión/ETag basada en cambios relevantes
            $version = $this->computeEmpleadoVersion($empleado);

            // Soportar If-None-Match
            $ifNoneMatch = $request->headers->get('If-None-Match');
            if ($ifNoneMatch && trim($ifNoneMatch, '"') === $version) {
                return response('', 304)->header('ETag', '"' . $version . '"');
            }

            // Preparar datos del broker con logo_url y branding completo
            $broker = $empleado->broker;
            $brokerData = $broker ? array_merge($broker->toArray(), [
                'logo_url' => $broker->getLogoUrl(),
                'favicon_url' => $broker->getFaviconUrl(),
                'branding' => array_merge(
                    is_array($broker->branding) ? $broker->branding : [],
                    [
                        'logo' => $broker->getLogoUrl(),
                        'favicon' => $broker->getFaviconUrl(),
                        'primary_color' => $broker->branding['primary_color'] ?? null,
                    ]
                ),
            ]) : null;

            return response()->json([
                'success' => true,
                'message' => 'Contexto de empleado',
                'data' => [
                    'empleado' => $empleado,
                    'broker' => $brokerData,
                    'permisos' => $empleado->obtenerPermisos(),
                    'version' => $version,
                ],
            ])->header('ETag', '"' . $version . '"')->header('Cache-Control', 'no-cache');

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error obteniendo contexto: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Endpoint ligero que retorna la versión (hash) del contexto de permisos del empleado
     */
    public function version(Request $request)
    {
        try {
            $empleado = $request->get('authenticated_empleado');
            if (!$empleado) {
                $claims = $request->get('firebase_claims');
                $empleadoId = is_array($claims) ? ($claims['empleado_id'] ?? null) : null;
                if ($empleadoId) {
                    $empleado = EmpleadoBroker::with(['rol'])->find($empleadoId);
                }
            }
            if (!$empleado) {
                return response()->json(['success' => false, 'message' => 'No autenticado'], 401);
            }
            $empleado->load(['rol']);
            $version = $this->computeEmpleadoVersion($empleado);
            return response()->json([
                'success' => true,
                'version' => $version,
            ])->header('ETag', '"' . $version . '"')->header('Cache-Control', 'no-cache');
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    private function computeEmpleadoVersion(EmpleadoBroker $empleado): string
    {
        $rol = $empleado->rol;
        $payload = [
            'empleado_id' => $empleado->id,
            'rol_id' => $rol?->id,
            'rol_updated_at' => optional($rol?->updated_at)->timestamp ?? null,
            'rol_permisos' => $rol?->permisos ?? [],
            'permisos_adicionales' => $empleado->permisos_adicionales ?? [],
        ];
        return sha1(json_encode($payload));
    }
}
