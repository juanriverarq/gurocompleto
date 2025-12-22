<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\Vendedor;
use App\Models\Broker;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class VendedoresController extends Controller
{
    /**
     * Get the broker ID for the current user (supports both Firebase users and employees)
     */
    private function getBrokerId(Request $request)
    {
        \Log::info('🔍 [DEBUG] VendedoresController::getBrokerId - INICIANDO', [
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
     * Display a listing of vendedores
     */
    public function index(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $query = Vendedor::forBroker($brokerId);

            if ($request->has('search') && !empty($request->search)) {
                $query->search($request->search);
            }

            // Filtros específicos
            if ($request->has('tipo_persona') && !empty($request->tipo_persona)) {
                $query->byTipoPersona($request->tipo_persona);
            }

            if ($request->has('es_agencia') && $request->es_agencia !== null) {
                if ($request->es_agencia === 'true' || $request->es_agencia === '1') {
                    $query->agencias();
                } else {
                    $query->vendedores();
                }
            }

            $sortField = $request->get('sort_field', 'nombres');
            $sortDirection = $request->get('sort_direction', 'asc');
            
            if ($sortField === 'nombres') {
                $query->orderByName($sortDirection);
            } else {
                $query->orderBy($sortField, $sortDirection);
            }

            // Si se pide como catálogo (all=true o per_page=all), devolver todos sin paginar
            $perPage = $request->get('per_page', 15);
            if ($perPage === 'all' || $request->get('all') === 'true' || $request->get('all') === '1') {
                $vendedores = $query->get();
                return response()->json([
                    'success' => true,
                    'message' => 'Vendedores obtenidos exitosamente',
                    'data' => $vendedores,
                ]);
            }
            
            $vendedores = $query->paginate((int) $perPage);

            return response()->json([
                'success' => true,
                'message' => 'Vendedores obtenidos exitosamente',
                'data' => $vendedores->items(),
                'pagination' => [
                    'current_page' => $vendedores->currentPage(),
                    'last_page' => $vendedores->lastPage(),
                    'per_page' => $vendedores->perPage(),
                    'total' => $vendedores->total(),
                    'from' => $vendedores->firstItem(),
                    'to' => $vendedores->lastItem(),
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener los vendedores: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store a newly created vendedor
     */
    public function store(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $validator = Validator::make($request->all(), [
                'nombres' => 'required|string|max:255',
                'tipo_documento' => [
                    'required',
                    'string',
                    Rule::in(array_keys(Vendedor::TIPOS_DOCUMENTO)),
                ],
                'numero_documento' => [
                    'required',
                    'string',
                    'max:50',
                    Rule::unique('vendedores')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    }),
                ],
                'telefono' => 'nullable|string|max:50',
                'celular' => 'nullable|string|max:50',
                'email' => [
                    'nullable',
                    'email',
                    'max:255',
                    Rule::unique('vendedores')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    }),
                ],
                'cuenta_bancaria' => 'nullable|string|max:100',
                'tipo_persona' => [
                    'required',
                    Rule::in(['natural', 'juridica']),
                ],
                'tipo_retencion' => [
                    'nullable',
                    'string',
                    Rule::in(array_keys(\App\Models\Vendedor::TIPOS_RETENCION)),
                ],
                'es_agencia' => 'required|boolean',
                'porcentaje_comision' => 'required|numeric|min:0|max:100',
                'calcular_comision_sobre' => [
                    'required',
                    Rule::in(['agencia', 'prima_neta']),
                ],
                'porcentaje_retencion' => 'nullable|numeric|min:0|max:100',
                'porcentaje_retencion_ica' => 'nullable|numeric|min:0|max:100',
                'porcentaje_iva' => 'nullable|numeric|min:0|max:100',
                'porcentaje_retencion_iva' => 'nullable|numeric|min:0|max:100',
                'comisiones_diferentes_por_ano' => 'required|boolean',
                'fecha_vinculacion' => 'nullable|date',
            ], [
                'nombres.required' => 'Los nombres son obligatorios',
                'nombres.string' => 'Los nombres deben ser texto',
                'nombres.max' => 'Los nombres no pueden exceder 255 caracteres',
                'tipo_documento.required' => 'El tipo de documento es obligatorio',
                'tipo_documento.in' => 'El tipo de documento debe ser válido',
                'numero_documento.required' => 'El número de documento es obligatorio',
                'numero_documento.max' => 'El número de documento no puede exceder 50 caracteres',
                'numero_documento.unique' => 'Ya existe un vendedor con este número de documento',
                'telefono.max' => 'El teléfono no puede exceder 50 caracteres',
                'celular.max' => 'El celular no puede exceder 50 caracteres',
                'email.email' => 'El email debe tener un formato válido',
                'email.max' => 'El email no puede exceder 255 caracteres',
                'email.unique' => 'Ya existe un vendedor con este email',
                'cuenta_bancaria.max' => 'La cuenta bancaria no puede exceder 100 caracteres',
                'tipo_persona.required' => 'El tipo de persona es obligatorio',
                'tipo_persona.in' => 'El tipo de persona debe ser natural o jurídica',
                'tipo_retencion.in' => 'El tipo de retención no es válido',
                'es_agencia.required' => 'Debe especificar si es agencia',
                'es_agencia.boolean' => 'El campo es agencia debe ser verdadero o falso',
                'porcentaje_comision.required' => 'El porcentaje de comisión es obligatorio',
                'porcentaje_comision.numeric' => 'El porcentaje de comisión debe ser un número',
                'porcentaje_comision.min' => 'El porcentaje de comisión debe ser mayor o igual a 0',
                'porcentaje_comision.max' => 'El porcentaje de comisión no puede ser mayor a 100',
                'calcular_comision_sobre.required' => 'Debe especificar sobre qué calcular la comisión',
                'calcular_comision_sobre.in' => 'El cálculo de comisión debe ser sobre agencia o prima neta',
                'porcentaje_retencion.numeric' => 'El porcentaje de retención debe ser un número',
                'porcentaje_retencion.min' => 'El porcentaje de retención debe ser mayor o igual a 0',
                'porcentaje_retencion.max' => 'El porcentaje de retención no puede ser mayor a 100',
                'porcentaje_retencion_ica.numeric' => 'El porcentaje de retención ICA debe ser un número',
                'porcentaje_retencion_ica.min' => 'El porcentaje de retención ICA debe ser mayor o igual a 0',
                'porcentaje_retencion_ica.max' => 'El porcentaje de retención ICA no puede ser mayor a 100',
                'porcentaje_iva.numeric' => 'El porcentaje de IVA debe ser un número',
                'porcentaje_iva.min' => 'El porcentaje de IVA debe ser mayor o igual a 0',
                'porcentaje_iva.max' => 'El porcentaje de IVA no puede ser mayor a 100',
                'porcentaje_retencion_iva.numeric' => 'El porcentaje de retención IVA debe ser un número',
                'porcentaje_retencion_iva.min' => 'El porcentaje de retención IVA debe ser mayor o igual a 0',
                'porcentaje_retencion_iva.max' => 'El porcentaje de retención IVA no puede ser mayor a 100',
                'comisiones_diferentes_por_ano.required' => 'Debe especificar si las comisiones son diferentes por año',
                'comisiones_diferentes_por_ano.boolean' => 'El campo comisiones diferentes por año debe ser verdadero o falso',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $vendedor = Vendedor::create([
                'nombres' => $request->nombres,
                'tipo_documento' => $request->tipo_documento,
                'numero_documento' => $request->numero_documento,
                'telefono' => $request->telefono,
                'celular' => $request->celular,
                'email' => $request->email,
                'cuenta_bancaria' => $request->cuenta_bancaria,
                'tipo_persona' => $request->tipo_persona,
                'tipo_retencion' => $request->tipo_retencion,
                'es_agencia' => $request->es_agencia,
                'porcentaje_comision' => $request->porcentaje_comision,
                'calcular_comision_sobre' => $request->calcular_comision_sobre,
                'porcentaje_retencion' => $request->porcentaje_retencion ?? 0,
                'porcentaje_retencion_ica' => $request->porcentaje_retencion_ica ?? 0,
                'porcentaje_iva' => $request->porcentaje_iva ?? 0,
                'porcentaje_retencion_iva' => $request->porcentaje_retencion_iva ?? 0,
                'comisiones_diferentes_por_ano' => $request->comisiones_diferentes_por_ano,
                'fecha_vinculacion' => $request->fecha_vinculacion,
                'broker_id' => $brokerId,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Vendedor creado exitosamente',
                'data' => $vendedor,
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al crear el vendedor: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Display the specified vendedor
     */
    public function show(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $vendedor = Vendedor::forBroker($brokerId)->findOrFail($id);

            return response()->json([
                'success' => true,
                'message' => 'Vendedor obtenido exitosamente',
                'data' => $vendedor,
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Vendedor no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener el vendedor: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update the specified vendedor
     */
    public function update(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $vendedor = Vendedor::forBroker($brokerId)->findOrFail($id);
            
            $validator = Validator::make($request->all(), [
                'nombres' => 'required|string|max:255',
                'tipo_documento' => [
                    'required',
                    'string',
                    Rule::in(array_keys(Vendedor::TIPOS_DOCUMENTO)),
                ],
                'numero_documento' => [
                    'required',
                    'string',
                    'max:50',
                    Rule::unique('vendedores')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    })->ignore($id),
                ],
                'telefono' => 'nullable|string|max:50',
                'celular' => 'nullable|string|max:50',
                'email' => [
                    'nullable',
                    'email',
                    'max:255',
                    Rule::unique('vendedores')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    })->ignore($id),
                ],
                'cuenta_bancaria' => 'nullable|string|max:100',
                'tipo_persona' => [
                    'required',
                    Rule::in(['natural', 'juridica']),
                ],
                'tipo_retencion' => [
                    'nullable',
                    'string',
                    Rule::in(array_keys(\App\Models\Vendedor::TIPOS_RETENCION)),
                ],
                'es_agencia' => 'required|boolean',
                'porcentaje_comision' => 'required|numeric|min:0|max:100',
                'calcular_comision_sobre' => [
                    'required',
                    Rule::in(['agencia', 'prima_neta']),
                ],
                'porcentaje_retencion' => 'nullable|numeric|min:0|max:100',
                'porcentaje_retencion_ica' => 'nullable|numeric|min:0|max:100',
                'porcentaje_iva' => 'nullable|numeric|min:0|max:100',
                'porcentaje_retencion_iva' => 'nullable|numeric|min:0|max:100',
                'comisiones_diferentes_por_ano' => 'required|boolean',
                'fecha_vinculacion' => 'nullable|date',
            ], [
                'nombres.required' => 'Los nombres son obligatorios',
                'nombres.string' => 'Los nombres deben ser texto',
                'nombres.max' => 'Los nombres no pueden exceder 255 caracteres',
                'tipo_documento.required' => 'El tipo de documento es obligatorio',
                'tipo_documento.in' => 'El tipo de documento debe ser válido',
                'numero_documento.required' => 'El número de documento es obligatorio',
                'numero_documento.max' => 'El número de documento no puede exceder 50 caracteres',
                'numero_documento.unique' => 'Ya existe un vendedor con este número de documento',
                'telefono.max' => 'El teléfono no puede exceder 50 caracteres',
                'celular.max' => 'El celular no puede exceder 50 caracteres',
                'email.email' => 'El email debe tener un formato válido',
                'email.max' => 'El email no puede exceder 255 caracteres',
                'email.unique' => 'Ya existe un vendedor con este email',
                'cuenta_bancaria.max' => 'La cuenta bancaria no puede exceder 100 caracteres',
                'tipo_persona.required' => 'El tipo de persona es obligatorio',
                'tipo_persona.in' => 'El tipo de persona debe ser natural o jurídica',
                'es_agencia.required' => 'Debe especificar si es agencia',
                'es_agencia.boolean' => 'El campo es agencia debe ser verdadero o falso',
                'porcentaje_comision.required' => 'El porcentaje de comisión es obligatorio',
                'porcentaje_comision.numeric' => 'El porcentaje de comisión debe ser un número',
                'porcentaje_comision.min' => 'El porcentaje de comisión debe ser mayor o igual a 0',
                'porcentaje_comision.max' => 'El porcentaje de comisión no puede ser mayor a 100',
                'calcular_comision_sobre.required' => 'Debe especificar sobre qué calcular la comisión',
                'calcular_comision_sobre.in' => 'El cálculo de comisión debe ser sobre agencia o prima neta',
                'porcentaje_retencion.numeric' => 'El porcentaje de retención debe ser un número',
                'porcentaje_retencion.min' => 'El porcentaje de retención debe ser mayor o igual a 0',
                'porcentaje_retencion.max' => 'El porcentaje de retención no puede ser mayor a 100',
                'porcentaje_retencion_ica.numeric' => 'El porcentaje de retención ICA debe ser un número',
                'porcentaje_retencion_ica.min' => 'El porcentaje de retención ICA debe ser mayor o igual a 0',
                'porcentaje_retencion_ica.max' => 'El porcentaje de retención ICA no puede ser mayor a 100',
                'porcentaje_iva.numeric' => 'El porcentaje de IVA debe ser un número',
                'porcentaje_iva.min' => 'El porcentaje de IVA debe ser mayor o igual a 0',
                'porcentaje_iva.max' => 'El porcentaje de IVA no puede ser mayor a 100',
                'porcentaje_retencion_iva.numeric' => 'El porcentaje de retención IVA debe ser un número',
                'porcentaje_retencion_iva.min' => 'El porcentaje de retención IVA debe ser mayor o igual a 0',
                'porcentaje_retencion_iva.max' => 'El porcentaje de retención IVA no puede ser mayor a 100',
                'comisiones_diferentes_por_ano.required' => 'Debe especificar si las comisiones son diferentes por año',
                'comisiones_diferentes_por_ano.boolean' => 'El campo comisiones diferentes por año debe ser verdadero o falso',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $vendedor->update([
                'nombres' => $request->nombres,
                'tipo_documento' => $request->tipo_documento,
                'numero_documento' => $request->numero_documento,
                'telefono' => $request->telefono,
                'celular' => $request->celular,
                'email' => $request->email,
                'cuenta_bancaria' => $request->cuenta_bancaria,
                'tipo_persona' => $request->tipo_persona,
                'tipo_retencion' => $request->tipo_retencion,
                'es_agencia' => $request->es_agencia,
                'porcentaje_comision' => $request->porcentaje_comision,
                'calcular_comision_sobre' => $request->calcular_comision_sobre,
                'porcentaje_retencion' => $request->porcentaje_retencion ?? 0,
                'porcentaje_retencion_ica' => $request->porcentaje_retencion_ica ?? 0,
                'porcentaje_iva' => $request->porcentaje_iva ?? 0,
                'porcentaje_retencion_iva' => $request->porcentaje_retencion_iva ?? 0,
                'comisiones_diferentes_por_ano' => $request->comisiones_diferentes_por_ano,
                'fecha_vinculacion' => $request->fecha_vinculacion,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Vendedor actualizado exitosamente',
                'data' => $vendedor,
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Vendedor no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar el vendedor: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Remove the specified vendedor
     */
    public function destroy(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $vendedor = Vendedor::forBroker($brokerId)->findOrFail($id);
            
            $vendedor->delete();

            return response()->json([
                'success' => true,
                'message' => 'Vendedor eliminado exitosamente',
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Vendedor no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar el vendedor: ' . $e->getMessage(),
            ], 500);
        }
    }
}
