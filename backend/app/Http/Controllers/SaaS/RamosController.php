<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\Ramo;
use App\Models\ComisionAseguradora;
use App\Models\Broker;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class RamosController extends Controller
{
    /**
     * Get the broker ID for the current user (supports both Firebase users and employees)
     */
    private function getBrokerId(Request $request)
    {
        \Log::info('🔍 [DEBUG] RamosController::getBrokerId - INICIANDO', [
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
     * Display a listing of ramos
     */
    public function index(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $query = Ramo::forBroker($brokerId)->with('comisionesAseguradoras.aseguradora');

            if ($request->has('search') && !empty($request->search)) {
                $query->search($request->search);
            }

            // Ordenamiento seguro sobre columnas existentes
            $sortField = $request->get('sort_field', 'nombre');
            $sortDirection = $request->get('sort_direction', 'asc');

            if ($sortField === 'nombre') {
                $query->orderByName($sortDirection);
            } elseif (in_array($sortField, ['subramo', 'created_at', 'updated_at'])) {
                $query->orderBy($sortField, $sortDirection);
            } else {
                $query->orderByName('asc');
            }

            $perPage = (int) $request->get('per_page', 15);
            $perPage = $perPage > 0 ? $perPage : 15;
            $ramos = $query->paginate($perPage);

            return response()->json([
                'success' => true,
                'message' => 'Ramos obtenidos exitosamente',
                'data' => $ramos->items(),
                'pagination' => [
                    'current_page' => $ramos->currentPage(),
                    'last_page' => $ramos->lastPage(),
                    'per_page' => $ramos->perPage(),
                    'total' => $ramos->total(),
                    'from' => $ramos->firstItem(),
                    'to' => $ramos->lastItem(),
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener los ramos: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store a newly created ramo
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
                    Rule::unique('ramos')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    }),
                ],
                'subramo' => 'nullable|string|max:255',
                'calcular_iva_pri_a_pre' => 'sometimes|boolean',
                'vista_mapa_oportunidad' => 'sometimes|boolean',
                'comisiones_aseguradoras' => 'nullable|array',
                'comisiones_aseguradoras.*.aseguradora_id' => [
                    'required_with:comisiones_aseguradoras',
                    'integer',
                    'exists:aseguradoras,id',
                ],
                'comisiones_aseguradoras.*.porcentaje_iva' => 'nullable|numeric|min:0|max:100',
                'comisiones_aseguradoras.*.porcentaje_comision' => 'nullable|numeric|min:0|max:100',
                'comisiones_aseguradoras.*.pri_a_pre_por_defecto' => 'nullable|numeric|min:0|max:100',
            ], [
                'nombre.required' => 'El nombre es obligatorio',
                'nombre.string' => 'El nombre debe ser texto',
                'nombre.max' => 'El nombre no puede exceder 255 caracteres',
                'nombre.unique' => 'Ya existe un ramo con este nombre',
                'subramo.max' => 'El subramo no puede exceder 255 caracteres',
                'comisiones_aseguradoras.array' => 'Las comisiones deben ser un array',
                'comisiones_aseguradoras.*.aseguradora_id.required_with' => 'La aseguradora es obligatoria',
                'comisiones_aseguradoras.*.aseguradora_id.integer' => 'La aseguradora debe ser un número entero',
                'comisiones_aseguradoras.*.aseguradora_id.exists' => 'La aseguradora seleccionada no existe',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors(),
                ], 422);
            }

            // Validar que no se repitan aseguradoras en las comisiones
            if ($request->has('comisiones_aseguradoras') && is_array($request->comisiones_aseguradoras)) {
                $aseguradoras = collect($request->comisiones_aseguradoras)->pluck('aseguradora_id');
                if ($aseguradoras->count() !== $aseguradoras->unique()->count()) {
                    return response()->json([
                        'success' => false,
                        'message' => 'No se pueden tener comisiones duplicadas para la misma aseguradora',
                    ], 422);
                }
            }

            DB::beginTransaction();

            try {
                $ramo = Ramo::create([
                    'nombre' => $request->nombre,
                    'subramo' => $request->subramo,
                    'calcular_iva_pri_a_pre' => (bool) ($request->calcular_iva_pri_a_pre ?? false),
                    'vista_mapa_oportunidad' => (bool) ($request->vista_mapa_oportunidad ?? false),
                    'broker_id' => $brokerId,
                ]);

                // Crear las comisiones por aseguradora
                if ($request->has('comisiones_aseguradoras') && is_array($request->comisiones_aseguradoras)) {
                    foreach ($request->comisiones_aseguradoras as $comision) {
                        ComisionAseguradora::create([
                            'ramo_id' => $ramo->id,
                            'aseguradora_id' => $comision['aseguradora_id'],
                            'porcentaje_iva' => $comision['porcentaje_iva'] ?? 0,
                            'porcentaje_comision' => $comision['porcentaje_comision'] ?? 0,
                            'pri_a_pre_por_defecto' => $comision['pri_a_pre_por_defecto'] ?? 0,
                        ]);
                    }
                }

                // Cargar las relaciones para la respuesta
                $ramo->load('comisionesAseguradoras.aseguradora');

                DB::commit();

                return response()->json([
                    'success' => true,
                    'message' => 'Ramo creado exitosamente',
                    'data' => $ramo,
                ], 201);

            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al crear el ramo: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Display the specified ramo
     */
    public function show(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $ramo = Ramo::forBroker($brokerId)
                ->with('comisionesAseguradoras.aseguradora')
                ->findOrFail($id);

            return response()->json([
                'success' => true,
                'message' => 'Ramo obtenido exitosamente',
                'data' => $ramo,
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Ramo no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener el ramo: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update the specified ramo
     */
    public function update(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $ramo = Ramo::forBroker($brokerId)->findOrFail($id);
            
            $validator = Validator::make($request->all(), [
                'nombre' => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('ramos')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    })->ignore($id),
                ],
                'subramo' => 'nullable|string|max:255',
                'calcular_iva_pri_a_pre' => 'sometimes|boolean',
                'vista_mapa_oportunidad' => 'sometimes|boolean',
                'comisiones_aseguradoras' => 'nullable|array',
                'comisiones_aseguradoras.*.aseguradora_id' => [
                    'required_with:comisiones_aseguradoras',
                    'integer',
                    'exists:aseguradoras,id',
                ],
                'comisiones_aseguradoras.*.porcentaje_iva' => 'nullable|numeric|min:0|max:100',
                'comisiones_aseguradoras.*.porcentaje_comision' => 'nullable|numeric|min:0|max:100',
                'comisiones_aseguradoras.*.pri_a_pre_por_defecto' => 'nullable|numeric|min:0|max:100',
            ], [
                'nombre.required' => 'El nombre es obligatorio',
                'nombre.string' => 'El nombre debe ser texto',
                'nombre.max' => 'El nombre no puede exceder 255 caracteres',
                'nombre.unique' => 'Ya existe un ramo con este nombre',
                'subramo.max' => 'El subramo no puede exceder 255 caracteres',
                'comisiones_aseguradoras.array' => 'Las comisiones deben ser un array',
                'comisiones_aseguradoras.*.aseguradora_id.required_with' => 'La aseguradora es obligatoria',
                'comisiones_aseguradoras.*.aseguradora_id.integer' => 'La aseguradora debe ser un número entero',
                'comisiones_aseguradoras.*.aseguradora_id.exists' => 'La aseguradora seleccionada no existe',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors(),
                ], 422);
            }

            // Validar que no se repitan aseguradoras en las comisiones
            if ($request->has('comisiones_aseguradoras') && is_array($request->comisiones_aseguradoras)) {
                $aseguradoras = collect($request->comisiones_aseguradoras)->pluck('aseguradora_id');
                if ($aseguradoras->count() !== $aseguradoras->unique()->count()) {
                    return response()->json([
                        'success' => false,
                        'message' => 'No se pueden tener comisiones duplicadas para la misma aseguradora',
                    ], 422);
                }
            }

            DB::beginTransaction();

            try {
                $ramo->update([
                    'nombre' => $request->nombre,
                    'subramo' => $request->subramo,
                    'calcular_iva_pri_a_pre' => (bool) ($request->calcular_iva_pri_a_pre ?? $ramo->calcular_iva_pri_a_pre),
                    'vista_mapa_oportunidad' => (bool) ($request->vista_mapa_oportunidad ?? $ramo->vista_mapa_oportunidad),
                ]);

                // Eliminar las comisiones existentes
                ComisionAseguradora::where('ramo_id', $ramo->id)->delete();

                // Crear las nuevas comisiones
                if ($request->has('comisiones_aseguradoras') && is_array($request->comisiones_aseguradoras)) {
                    foreach ($request->comisiones_aseguradoras as $comision) {
                        ComisionAseguradora::create([
                            'ramo_id' => $ramo->id,
                            'aseguradora_id' => $comision['aseguradora_id'],
                            'porcentaje_iva' => $comision['porcentaje_iva'] ?? 0,
                            'porcentaje_comision' => $comision['porcentaje_comision'] ?? 0,
                            'pri_a_pre_por_defecto' => $comision['pri_a_pre_por_defecto'] ?? 0,
                        ]);
                    }
                }

                // Cargar las relaciones para la respuesta
                $ramo->load('comisionesAseguradoras.aseguradora');

                DB::commit();

                return response()->json([
                    'success' => true,
                    'message' => 'Ramo actualizado exitosamente',
                    'data' => $ramo,
                ]);

            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Ramo no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar el ramo: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Remove the specified ramo
     */
    public function destroy(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $ramo = Ramo::forBroker($brokerId)->findOrFail($id);
            
            DB::beginTransaction();

            try {
                // Eliminar las comisiones relacionadas (filtrar por ramo_id; la tabla no tiene broker_id)
                ComisionAseguradora::where('ramo_id', $ramo->id)->delete();

                // Eliminar el ramo
                $ramo->delete();

                DB::commit();

                return response()->json([
                    'success' => true,
                    'message' => 'Ramo eliminado exitosamente',
                ]);

            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Ramo no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar el ramo: ' . $e->getMessage(),
            ], 500);
        }
    }

    // Eliminado método categorias ya que el modelo actual no maneja categorías
}
