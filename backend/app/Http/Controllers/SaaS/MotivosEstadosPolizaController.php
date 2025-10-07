<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\MotivoEstadoPoliza;
use App\Models\Broker;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class MotivosEstadosPolizaController extends Controller
{
    /**
     * Get the broker ID for the current user (supports both Firebase users and employees)
     */
    private function getBrokerId(Request $request)
    {
        \Log::info('🔍 [DEBUG] MotivosEstadosPolizaController::getBrokerId - INICIANDO', [
            'step' => 'inicio',
            'request_has_authenticated_broker_id' => $request->has('authenticated_broker_id'),
            'authenticated_broker_id_value' => $request->get('authenticated_broker_id'),
            'auth_type' => $request->get('auth_type')
        ]);

        // 1. Primero intentar obtener desde el middleware GlobalBrokerAuth
        if ($request->has('authenticated_broker_id')) {
            $brokerId = $request->get('authenticated_broker_id');
            \Log::info('✅ [DEBUG] getBrokerId - ENCONTRADO desde middleware', [
                'broker_id' => $brokerId,
                'source' => 'middleware_authenticated_broker_id'
            ]);
            return $brokerId;
        }

        // 2. Intentar obtener desde broker_id directo del request
        if ($request->has('broker_id')) {
            $brokerId = $request->get('broker_id');
            \Log::info('✅ [DEBUG] getBrokerId - ENCONTRADO desde request broker_id', [
                'broker_id' => $brokerId,
                'source' => 'request_broker_id'
            ]);
            return $brokerId;
        }

        \Log::info('🔍 [DEBUG] getBrokerId - No encontrado en middleware, probando usuarios autenticados');

        // 3. Verificar tipo de autenticación y obtener usuario correspondiente
        $authType = $request->get('auth_type');
        $user = null;

        if ($authType === 'empleado') {
            // Usuario autenticado como empleado
            $user = $request->get('authenticated_empleado');
            \Log::info('🔍 [DEBUG] getBrokerId - Usuario empleado', [
                'user_exists' => $user !== null,
                'user_id' => $user ? $user->id : null,
                'user_broker_id' => $user ? $user->broker_id : null
            ]);
        } else {
            // Usuario Firebase o tradicional
            $user = $request->user();

            \Log::info('🔍 [DEBUG] getBrokerId - Usuario Firebase del request', [
                'user_exists' => $user !== null,
                'user_id' => $user ? $user->id : null,
                'user_email' => $user ? $user->email : null,
                'user_broker_id' => $user ? $user->broker_id : null
            ]);

            // 4. Si no hay usuario, intentar obtenerlo de Auth (fallback)
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
            \Log::info('✅ [DEBUG] getBrokerId - ENCONTRADO desde usuario', [
                'broker_id' => $user->broker_id,
                'user_id' => $user->id,
                'user_type' => get_class($user),
                'source' => 'authenticated_user'
            ]);
            return $user->broker_id;
        }

        // Solo en desarrollo: Header de desarrollo
        if (app()->environment('local', 'development')) {
            $devBrokerId = $request->header('X-Dev-Broker-Id');
            if ($devBrokerId) {
                \Log::info('✅ [DEBUG] getBrokerId - ENCONTRADO desde header desarrollo', [
                    'broker_id' => (int) $devBrokerId,
                    'source' => 'dev_header'
                ]);
                return (int) $devBrokerId;
            }

            // Solo en desarrollo: Primer broker como último recurso
            $firstBroker = Broker::first();
            if ($firstBroker) {
                \Log::info('✅ [DEBUG] getBrokerId - ENCONTRADO primer broker desarrollo', [
                    'broker_id' => $firstBroker->id,
                    'source' => 'first_broker_dev'
                ]);
                return $firstBroker->id;
            }
        }

        // Si no hay usuario autenticado, lanzar excepción
        if (!$user) {
            \Log::error('❌ [DEBUG] getBrokerId - FALLA: Usuario no autenticado', [
                'auth_type' => $authType,
                'has_authenticated_empleado' => $request->has('authenticated_empleado'),
                'has_authenticated_user' => $request->has('authenticated_user')
            ]);
            throw new \Exception('Usuario no autenticado');
        }

        // Si el usuario no tiene broker_id, lanzar excepción
        if (!isset($user->broker_id) || !$user->broker_id) {
            \Log::error('❌ [DEBUG] getBrokerId - FALLA: Usuario no tiene broker asignado', [
                'user_id' => $user->id,
                'user_type' => get_class($user),
                'user_broker_id' => $user->broker_id ?? 'null'
            ]);
            throw new \Exception('Usuario no tiene un broker asignado');
        }

        return null; // Nunca debería llegar aquí
    }

    /**
     * Display a listing of motivos estados póliza
     */
    public function index(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $query = MotivoEstadoPoliza::forBroker($brokerId);

            if ($request->has('search') && !empty($request->search)) {
                $query->search($request->search);
            }

            // Filtros específicos por tipo
            if ($request->has('cancelacion') && $request->cancelacion !== null) {
                if ($request->cancelacion === 'true' || $request->cancelacion === '1') {
                    $query->forCancelacion();
                }
            }

            if ($request->has('no_renovacion') && $request->no_renovacion !== null) {
                if ($request->no_renovacion === 'true' || $request->no_renovacion === '1') {
                    $query->forNoRenovacion();
                }
            }

            if ($request->has('creacion_anexo') && $request->creacion_anexo !== null) {
                if ($request->creacion_anexo === 'true' || $request->creacion_anexo === '1') {
                    $query->forCreacionAnexo();
                }
            }

            $sortField = $request->get('sort_field', 'nombre');
            $sortDirection = $request->get('sort_direction', 'asc');
            
            if ($sortField === 'nombre') {
                $query->orderByName($sortDirection);
            } else {
                $query->orderBy($sortField, $sortDirection);
            }

            $perPage = $request->get('per_page', 15);
            $motivosEstados = $query->paginate($perPage);

            return response()->json([
                'success' => true,
                'message' => 'Motivos estados póliza obtenidos exitosamente',
                'data' => $motivosEstados->items(),
                'pagination' => [
                    'current_page' => $motivosEstados->currentPage(),
                    'last_page' => $motivosEstados->lastPage(),
                    'per_page' => $motivosEstados->perPage(),
                    'total' => $motivosEstados->total(),
                    'from' => $motivosEstados->firstItem(),
                    'to' => $motivosEstados->lastItem(),
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener los motivos estados póliza: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store a newly created motivo estado póliza
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
                    Rule::unique('motivos_estados_poliza')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    }),
                ],
                'cancelacion' => 'required|boolean',
                'no_renovacion' => 'required|boolean',
                'creacion_anexo' => 'required|boolean',
            ], [
                'nombre.required' => 'El nombre es obligatorio',
                'nombre.string' => 'El nombre debe ser texto',
                'nombre.max' => 'El nombre no puede exceder 255 caracteres',
                'nombre.unique' => 'Ya existe un motivo de estado de póliza con este nombre',
                'cancelacion.required' => 'El campo cancelación es obligatorio',
                'cancelacion.boolean' => 'El campo cancelación debe ser verdadero o falso',
                'no_renovacion.required' => 'El campo no renovación es obligatorio',
                'no_renovacion.boolean' => 'El campo no renovación debe ser verdadero o falso',
                'creacion_anexo.required' => 'El campo creación anexo es obligatorio',
                'creacion_anexo.boolean' => 'El campo creación anexo debe ser verdadero o falso',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $motivoEstado = MotivoEstadoPoliza::create([
                'nombre' => $request->nombre,
                'cancelacion' => $request->cancelacion,
                'no_renovacion' => $request->no_renovacion,
                'creacion_anexo' => $request->creacion_anexo,
                'broker_id' => $brokerId,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Motivo estado póliza creado exitosamente',
                'data' => $motivoEstado,
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al crear el motivo estado póliza: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Display the specified motivo estado póliza
     */
    public function show(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $motivoEstado = MotivoEstadoPoliza::forBroker($brokerId)->findOrFail($id);

            return response()->json([
                'success' => true,
                'message' => 'Motivo estado póliza obtenido exitosamente',
                'data' => $motivoEstado,
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Motivo estado póliza no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener el motivo estado póliza: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update the specified motivo estado póliza
     */
    public function update(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $motivoEstado = MotivoEstadoPoliza::forBroker($brokerId)->findOrFail($id);
            
            $validator = Validator::make($request->all(), [
                'nombre' => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('motivos_estados_poliza')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    })->ignore($id),
                ],
                'cancelacion' => 'required|boolean',
                'no_renovacion' => 'required|boolean',
                'creacion_anexo' => 'required|boolean',
            ], [
                'nombre.required' => 'El nombre es obligatorio',
                'nombre.string' => 'El nombre debe ser texto',
                'nombre.max' => 'El nombre no puede exceder 255 caracteres',
                'nombre.unique' => 'Ya existe un motivo de estado de póliza con este nombre',
                'cancelacion.required' => 'El campo cancelación es obligatorio',
                'cancelacion.boolean' => 'El campo cancelación debe ser verdadero o falso',
                'no_renovacion.required' => 'El campo no renovación es obligatorio',
                'no_renovacion.boolean' => 'El campo no renovación debe ser verdadero o falso',
                'creacion_anexo.required' => 'El campo creación anexo es obligatorio',
                'creacion_anexo.boolean' => 'El campo creación anexo debe ser verdadero o falso',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $motivoEstado->update([
                'nombre' => $request->nombre,
                'cancelacion' => $request->cancelacion,
                'no_renovacion' => $request->no_renovacion,
                'creacion_anexo' => $request->creacion_anexo,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Motivo estado póliza actualizado exitosamente',
                'data' => $motivoEstado,
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Motivo estado póliza no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar el motivo estado póliza: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Remove the specified motivo estado póliza
     */
    public function destroy(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $motivoEstado = MotivoEstadoPoliza::forBroker($brokerId)->findOrFail($id);
            
            $motivoEstado->delete();

            return response()->json([
                'success' => true,
                'message' => 'Motivo estado póliza eliminado exitosamente',
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Motivo estado póliza no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar el motivo estado póliza: ' . $e->getMessage(),
            ], 500);
        }
    }
}
