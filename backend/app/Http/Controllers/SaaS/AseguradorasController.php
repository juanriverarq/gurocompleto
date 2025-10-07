<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\Aseguradora;
use App\Models\Broker;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class AseguradorasController extends Controller
{
    /**
     * Get the broker ID for the current user (supports both Firebase users and employees)
     */
    private function getBrokerId(Request $request)
    {
        \Log::info('🔍 [DEBUG] AseguradorasController::getBrokerId - INICIANDO', [
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
     * Display a listing of aseguradoras
     */
    public function index(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $query = Aseguradora::forBroker($brokerId);

            if ($request->has('search') && !empty($request->search)) {
                $query->search($request->search);
            }

            $sortField = $request->get('sort_field', 'nombre');
            $sortDirection = $request->get('sort_direction', 'asc');
            
            if ($sortField === 'nombre') {
                $query->orderByName($sortDirection);
            } else {
                $query->orderBy($sortField, $sortDirection);
            }

            $perPage = $request->get('per_page', 15);
            $aseguradoras = $query->paginate($perPage);

            return response()->json([
                'success' => true,
                'message' => 'Aseguradoras obtenidas exitosamente',
                'data' => $aseguradoras->items(),
                'pagination' => [
                    'current_page' => $aseguradoras->currentPage(),
                    'last_page' => $aseguradoras->lastPage(),
                    'per_page' => $aseguradoras->perPage(),
                    'total' => $aseguradoras->total(),
                    'from' => $aseguradoras->firstItem(),
                    'to' => $aseguradoras->lastItem(),
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener las aseguradoras: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store a newly created aseguradora
     */
    public function store(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            // Compatibilidad de planillas: si viene 'nit' y no 'cuit', usarlo
            if (!$request->filled('cuit') && $request->filled('nit')) {
                $request->merge(['cuit' => $request->input('nit')]);
            }
            // Normalizar vacíos a null para reglas nullable|...
            foreach (['cuit','email','direccion','telefono','cuenta_bancaria','link_pago','codigo_intermediario','retencion','iva','retencion_iva'] as $field) {
                if ($request->has($field) && trim((string)$request->input($field)) === '') {
                    $request->merge([$field => null]);
                }
            }

            // Comportamiento estándar: si ya existe, que fallen las validaciones únicas (422)

            $validator = Validator::make($request->all(), [
                'nombre' => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('aseguradoras')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    }),
                ],
                'cuit' => [
                    'nullable',
                    'string',
                    'max:50',
                    Rule::unique('aseguradoras')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    }),
                ],
                'email' => [
                    'nullable',
                    'email',
                    'max:255',
                    Rule::unique('aseguradoras')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    }),
                ],
                'direccion' => 'nullable|string|max:1000',
                'telefono' => 'nullable|string|max:50',
                'cuenta_bancaria' => 'nullable|string|max:100',
                // Aceptar texto simple para link de pago (no exigir esquema http/https)
                'link_pago' => 'nullable|string|max:500',
                'codigo_intermediario' => 'nullable|string|max:50',
                'retencion' => 'nullable|numeric|min:0|max:100',
                'iva' => 'nullable|numeric|min:0|max:100',
                'retencion_iva' => 'nullable|numeric|min:0|max:100',
            ], [
                'nombre.required' => 'El nombre es obligatorio',
                'nombre.string' => 'El nombre debe ser texto',
                'nombre.max' => 'El nombre no puede exceder 255 caracteres',
                'nombre.unique' => 'Ya existe una aseguradora con este nombre',
                'cuit.unique' => 'Ya existe una aseguradora con este NIT',
                'cuit.max' => 'El NIT no puede exceder 50 caracteres',
                'email.email' => 'El email debe tener un formato válido',
                'email.max' => 'El email no puede exceder 255 caracteres',
                'email.unique' => 'Ya existe una aseguradora con este email',
                'direccion.max' => 'La dirección no puede exceder 1000 caracteres',
                'telefono.max' => 'El teléfono no puede exceder 50 caracteres',
                'cuenta_bancaria.max' => 'La cuenta bancaria no puede exceder 100 caracteres',
                'link_pago.url' => 'El link de pago debe ser una URL válida',
                'link_pago.max' => 'El link de pago no puede exceder 500 caracteres',
                'codigo_intermediario.max' => 'El código de intermediario no puede exceder 50 caracteres',
                'retencion.numeric' => 'La retención debe ser un número',
                'retencion.min' => 'La retención debe ser mayor o igual a 0',
                'retencion.max' => 'La retención no puede ser mayor a 100',
                'iva.numeric' => 'El IVA debe ser un número',
                'iva.min' => 'El IVA debe ser mayor o igual a 0',
                'iva.max' => 'El IVA no puede ser mayor a 100',
                'retencion_iva.numeric' => 'La retención IVA debe ser un número',
                'retencion_iva.min' => 'La retención IVA debe ser mayor o igual a 0',
                'retencion_iva.max' => 'La retención IVA no puede ser mayor a 100',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $aseguradora = Aseguradora::create([
                'nombre' => $request->nombre,
                'cuit' => $request->cuit,
                'email' => $request->email,
                'direccion' => $request->direccion,
                'telefono' => $request->telefono,
                'cuenta_bancaria' => $request->cuenta_bancaria,
                'link_pago' => $request->link_pago,
                'codigo_intermediario' => $request->codigo_intermediario,
                'retencion' => $request->retencion ?? 0,
                'iva' => $request->iva ?? 0,
                'retencion_iva' => $request->retencion_iva ?? 0,
                'broker_id' => $brokerId,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Aseguradora creada exitosamente',
                'data' => $aseguradora,
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al crear la aseguradora: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Display the specified aseguradora
     */
    public function show(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $aseguradora = Aseguradora::forBroker($brokerId)->findOrFail($id);

            return response()->json([
                'success' => true,
                'message' => 'Aseguradora obtenida exitosamente',
                'data' => $aseguradora,
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Aseguradora no encontrada',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener la aseguradora: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update the specified aseguradora
     */
    public function update(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $aseguradora = Aseguradora::forBroker($brokerId)->findOrFail($id);
            // Compatibilidad de planillas: si viene 'nit' y no 'cuit', usarlo
            if (!$request->filled('cuit') && $request->filled('nit')) {
                $request->merge(['cuit' => $request->input('nit')]);
            }
            // Normalizar vacíos a null para reglas nullable|...
            foreach (['cuit','email','direccion','telefono','cuenta_bancaria','link_pago','codigo_intermediario','retencion','iva','retencion_iva'] as $field) {
                if ($request->has($field) && trim((string)$request->input($field)) === '') {
                    $request->merge([$field => null]);
                }
            }

            $validator = Validator::make($request->all(), [
                'nombre' => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('aseguradoras')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    })->ignore($id),
                ],
                'cuit' => [
                    'nullable',
                    'string',
                    'max:50',
                    Rule::unique('aseguradoras')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    })->ignore($id),
                ],
                'email' => [
                    'nullable',
                    'email',
                    'max:255',
                    Rule::unique('aseguradoras')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    })->ignore($id),
                ],
                'direccion' => 'nullable|string|max:1000',
                'telefono' => 'nullable|string|max:50',
                'cuenta_bancaria' => 'nullable|string|max:100',
                'link_pago' => 'nullable|string|max:500',
                'codigo_intermediario' => 'nullable|string|max:50',
                'retencion' => 'nullable|numeric|min:0|max:100',
                'iva' => 'nullable|numeric|min:0|max:100',
                'retencion_iva' => 'nullable|numeric|min:0|max:100',
            ], [
                'nombre.required' => 'El nombre es obligatorio',
                'nombre.string' => 'El nombre debe ser texto',
                'nombre.max' => 'El nombre no puede exceder 255 caracteres',
                'nombre.unique' => 'Ya existe una aseguradora con este nombre',
                'cuit.unique' => 'Ya existe una aseguradora con este NIT',
                'cuit.max' => 'El NIT no puede exceder 50 caracteres',
                'email.email' => 'El email debe tener un formato válido',
                'email.max' => 'El email no puede exceder 255 caracteres',
                'email.unique' => 'Ya existe una aseguradora con este email',
                'direccion.max' => 'La dirección no puede exceder 1000 caracteres',
                'telefono.max' => 'El teléfono no puede exceder 50 caracteres',
                'cuenta_bancaria.max' => 'La cuenta bancaria no puede exceder 100 caracteres',
                'link_pago.url' => 'El link de pago debe ser una URL válida',
                'link_pago.max' => 'El link de pago no puede exceder 500 caracteres',
                'codigo_intermediario.max' => 'El código de intermediario no puede exceder 50 caracteres',
                'retencion.numeric' => 'La retención debe ser un número',
                'retencion.min' => 'La retención debe ser mayor o igual a 0',
                'retencion.max' => 'La retención no puede ser mayor a 100',
                'iva.numeric' => 'El IVA debe ser un número',
                'iva.min' => 'El IVA debe ser mayor o igual a 0',
                'iva.max' => 'El IVA no puede ser mayor a 100',
                'retencion_iva.numeric' => 'La retención IVA debe ser un número',
                'retencion_iva.min' => 'La retención IVA debe ser mayor o igual a 0',
                'retencion_iva.max' => 'La retención IVA no puede ser mayor a 100',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $aseguradora->update([
                'nombre' => $request->nombre,
                'cuit' => $request->cuit,
                'email' => $request->email,
                'direccion' => $request->direccion,
                'telefono' => $request->telefono,
                'cuenta_bancaria' => $request->cuenta_bancaria,
                'link_pago' => $request->link_pago,
                'codigo_intermediario' => $request->codigo_intermediario,
                'retencion' => $request->retencion ?? 0,
                'iva' => $request->iva ?? 0,
                'retencion_iva' => $request->retencion_iva ?? 0,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Aseguradora actualizada exitosamente',
                'data' => $aseguradora,
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Aseguradora no encontrada',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar la aseguradora: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Remove the specified aseguradora
     */
    public function destroy(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $aseguradora = Aseguradora::forBroker($brokerId)->findOrFail($id);
            
            $aseguradora->delete();

            return response()->json([
                'success' => true,
                'message' => 'Aseguradora eliminada exitosamente',
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Aseguradora no encontrada',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar la aseguradora: ' . $e->getMessage(),
            ], 500);
        }
    }
}
