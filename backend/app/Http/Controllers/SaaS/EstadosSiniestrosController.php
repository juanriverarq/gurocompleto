<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\EstadoSiniestro;
use App\Models\Broker;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class EstadosSiniestrosController extends Controller
{
    /**
     * Get the broker ID for the current user with fallback for development
     */
    private function getBrokerId(Request $request)
    {
        \Log::info('🔍 [DEBUG] EstadosSiniestrosController::getBrokerId - INICIANDO', [
            'request_has_authenticated_broker_id' => $request->has('authenticated_broker_id'),
            'authenticated_broker_id_value' => $request->get('authenticated_broker_id'),
            'auth_type' => $request->get('auth_type')
        ]);

        // 1) Preferir el broker resuelto por GlobalBrokerAuth
        if ($request->has('authenticated_broker_id')) {
            $brokerId = $request->get('authenticated_broker_id');
            \Log::info('✅ [DEBUG] getBrokerId - ENCONTRADO desde middleware', ['broker_id' => $brokerId]);
            return $brokerId;
        }

        // 2) broker_id directo desde el request (claims o headers previos)
        if ($request->has('broker_id')) {
            $brokerId = $request->get('broker_id');
            \Log::info('✅ [DEBUG] getBrokerId - ENCONTRADO desde request broker_id', ['broker_id' => $brokerId]);
            return $brokerId;
        }

        // 3) Resolver según tipo de autenticación
        $authType = $request->get('auth_type');
        $user = null;

        if ($authType === 'empleado') {
            // Sesión de empleado autenticada por UnifiedAuthMiddleware
            $user = $request->get('authenticated_empleado');
            \Log::info('🔍 [DEBUG] getBrokerId - Usuario EMPLEADO', [
                'user_exists' => $user !== null,
                'user_id' => $user ? $user->id : null,
                'user_broker_id' => $user ? $user->broker_id : null
            ]);
        } else {
            // Usuario Firebase/Laravel
            $user = $request->user();
            \Log::info('🔍 [DEBUG] getBrokerId - Usuario Firebase del request', [
                'user_exists' => $user !== null,
                'user_id' => $user ? $user->id : null,
                'user_email' => $user ? $user->email : null,
                'user_broker_id' => $user ? $user->broker_id : null
            ]);

            // Fallback a Auth::user() si fuera necesario
            if (!$user) {
                \Log::info('🔍 [DEBUG] getBrokerId - No hay usuario en request, probando Auth::user()');
                $user = Auth::user();
                \Log::info('🔍 [DEBUG] getBrokerId - Usuario de Auth', [
                    'user_exists' => $user !== null,
                    'user_id' => $user ? $user->id : null,
                    'user_email' => $user ? $user->email : null,
                    'user_broker_id' => $user ? $user->broker_id : null
                ]);
            }
        }

        if ($user && isset($user->broker_id) && $user->broker_id) {
            \Log::info('✅ [DEBUG] getBrokerId - ENCONTRADO desde usuario autenticado', [
                'broker_id' => $user->broker_id,
                'user_id' => $user->id,
                'user_type' => get_class($user),
                'source' => 'authenticated_user'
            ]);
            return $user->broker_id;
        }

        // 4) Solo en desarrollo: header X-Dev-Broker-Id y primer broker
        if (app()->environment('local', 'development')) {
            $devBrokerId = $request->header('X-Dev-Broker-Id');
            if ($devBrokerId) {
                \Log::info('✅ [DEBUG] getBrokerId - ENCONTRADO desde header desarrollo', [
                    'broker_id' => (int) $devBrokerId,
                    'source' => 'dev_header'
                ]);
                return (int) $devBrokerId;
            }

            $firstBroker = Broker::first();
            if ($firstBroker) {
                \Log::info('✅ [DEBUG] getBrokerId - ENCONTRADO primer broker desarrollo', [
                    'broker_id' => $firstBroker->id,
                    'source' => 'first_broker_dev'
                ]);
                return $firstBroker->id;
            }
        }

        // 5) Errores explícitos
        if (!$user) {
            \Log::error('❌ [DEBUG] getBrokerId - FALLA: Usuario no autenticado', [
                'auth_type' => $authType,
                'has_authenticated_empleado' => $request->has('authenticated_empleado'),
                'has_authenticated_user' => $request->has('authenticated_user')
            ]);
            throw new \Exception('Usuario no autenticado');
        }

        if (!isset($user->broker_id) || !$user->broker_id) {
            \Log::error('❌ [DEBUG] getBrokerId - FALLA: Usuario no tiene broker asignado', [
                'user_id' => $user->id,
                'user_type' => get_class($user),
                'user_broker_id' => $user->broker_id ?? 'null'
            ]);
            throw new \Exception('Usuario no tiene un broker asignado');
        }

        // No debería llegar aquí
        return null;
    }

    /**
     * Display a listing of estados de siniestros
     */
    public function index(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $query = EstadoSiniestro::forBroker($brokerId);

            if ($request->has('search') && !empty($request->search)) {
                $query->search($request->search);
            }

            if ($request->has('color') && !empty($request->color)) {
                $query->byColor($request->color);
            }

            $sortField = $request->get('sort_field', 'nombre');
            $sortDirection = $request->get('sort_direction', 'asc');
            
            if ($sortField === 'nombre') {
                $query->orderByName($sortDirection);
            } else {
                $query->orderBy($sortField, $sortDirection);
            }

            $perPage = $request->get('per_page', 15);
            $estadosSiniestros = $query->paginate($perPage);

            return response()->json([
                'success' => true,
                'message' => 'Estados de siniestros obtenidos exitosamente',
                'data' => $estadosSiniestros->items(),
                'pagination' => [
                    'current_page' => $estadosSiniestros->currentPage(),
                    'last_page' => $estadosSiniestros->lastPage(),
                    'per_page' => $estadosSiniestros->perPage(),
                    'total' => $estadosSiniestros->total(),
                    'from' => $estadosSiniestros->firstItem(),
                    'to' => $estadosSiniestros->lastItem(),
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener los estados de siniestros: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store a newly created estado de siniestro
     */
    public function store(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $validator = Validator::make($request->all(), [
                'nombre' => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('estados_siniestros')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    }),
                ],
                'color' => [
                    'required',
                    'string',
                    'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/',
                ],
            ], [
                'nombre.required' => 'El nombre es obligatorio',
                'nombre.string' => 'El nombre debe ser texto',
                'nombre.max' => 'El nombre no puede exceder 255 caracteres',
                'nombre.unique' => 'Ya existe un estado de siniestro con este nombre',
                'color.required' => 'El color es obligatorio',
                'color.string' => 'El color debe ser texto',
                'color.regex' => 'El color debe ser un código hexadecimal válido (ej: #FF0000)',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $estadoSiniestro = EstadoSiniestro::create([
                'nombre' => $request->nombre,
                'color' => $request->color,
                'broker_id' => $brokerId,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Estado de siniestro creado exitosamente',
                'data' => $estadoSiniestro,
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al crear el estado de siniestro: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Display the specified estado de siniestro
     */
    public function show(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $estadoSiniestro = EstadoSiniestro::forBroker($brokerId)->findOrFail($id);

            return response()->json([
                'success' => true,
                'message' => 'Estado de siniestro obtenido exitosamente',
                'data' => $estadoSiniestro,
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Estado de siniestro no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener el estado de siniestro: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update the specified estado de siniestro
     */
    public function update(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $estadoSiniestro = EstadoSiniestro::forBroker($brokerId)->findOrFail($id);
            
            $validator = Validator::make($request->all(), [
                'nombre' => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('estados_siniestros')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    })->ignore($id),
                ],
                'color' => [
                    'required',
                    'string',
                    'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/',
                ],
            ], [
                'nombre.required' => 'El nombre es obligatorio',
                'nombre.string' => 'El nombre debe ser texto',
                'nombre.max' => 'El nombre no puede exceder 255 caracteres',
                'nombre.unique' => 'Ya existe un estado de siniestro con este nombre',
                'color.required' => 'El color es obligatorio',
                'color.string' => 'El color debe ser texto',
                'color.regex' => 'El color debe ser un código hexadecimal válido (ej: #FF0000)',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $estadoSiniestro->update([
                'nombre' => $request->nombre,
                'color' => $request->color,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Estado de siniestro actualizado exitosamente',
                'data' => $estadoSiniestro,
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Estado de siniestro no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar el estado de siniestro: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Remove the specified estado de siniestro
     */
    public function destroy(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $estadoSiniestro = EstadoSiniestro::forBroker($brokerId)->findOrFail($id);
            
            $estadoSiniestro->delete();

            return response()->json([
                'success' => true,
                'message' => 'Estado de siniestro eliminado exitosamente',
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Estado de siniestro no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar el estado de siniestro: ' . $e->getMessage(),
            ], 500);
        }
    }
}
