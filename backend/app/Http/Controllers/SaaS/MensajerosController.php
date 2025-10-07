<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\Mensajero;
use App\Models\Broker;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class MensajerosController extends Controller
{
    /**
     * Get the broker ID for the current user with fallback for development
     */
    private function getBrokerId(Request $request)
    {
        $user = Auth::user();
        
        if ($user && $user->broker_id) {
            return $user->broker_id;
        }
        
        $devBrokerId = $request->header('X-Dev-Broker-Id');
        if ($devBrokerId) {
            return (int) $devBrokerId;
        }
        
        $firstBroker = Broker::first();
        if ($firstBroker) {
            return $firstBroker->id;
        }
        
        throw new \Exception('No se pudo determinar el broker para el usuario');
    }

    /**
     * Display a listing of mensajeros
     */
    public function index(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $query = Mensajero::forBroker($brokerId);

            if ($request->has('search') && !empty($request->search)) {
                $query->search($request->search);
            }

            // Filtros específicos
            if ($request->has('activo') && $request->activo !== null) {
                if ($request->activo === 'true' || $request->activo === '1') {
                    $query->activos();
                } else {
                    $query->inactivos();
                }
            }

            if ($request->has('ciudad') && !empty($request->ciudad)) {
                $query->byCiudad($request->ciudad);
            }

            if ($request->has('vehiculo') && !empty($request->vehiculo)) {
                $query->byVehiculo($request->vehiculo);
            }

            if ($request->has('con_tarifa') && $request->con_tarifa === 'true') {
                $query->conTarifa();
            }

            $sortField = $request->get('sort_field', 'nombre');
            $sortDirection = $request->get('sort_direction', 'asc');
            
            if ($sortField === 'nombre') {
                $query->orderByName($sortDirection);
            } else {
                $query->orderBy($sortField, $sortDirection);
            }

            $perPage = $request->get('per_page', 15);
            $mensajeros = $query->paginate($perPage);

            return response()->json([
                'success' => true,
                'message' => 'Mensajeros obtenidos exitosamente',
                'data' => $mensajeros->items(),
                'pagination' => [
                    'current_page' => $mensajeros->currentPage(),
                    'last_page' => $mensajeros->lastPage(),
                    'per_page' => $mensajeros->perPage(),
                    'total' => $mensajeros->total(),
                    'from' => $mensajeros->firstItem(),
                    'to' => $mensajeros->lastItem(),
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener los mensajeros: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store a newly created mensajero
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
                ],
                'telefono' => 'nullable|string|max:50',
                'celular' => 'nullable|string|max:50',
                'email' => [
                    'nullable',
                    'email',
                    'max:255',
                    Rule::unique('mensajeros')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    }),
                ],
                'direccion' => 'nullable|string',
                'ciudad' => 'nullable|string|max:255',
                'vehiculo' => [
                    'nullable',
                    'string',
                    Rule::in(array_keys(Mensajero::VEHICULOS)),
                ],
                'activo' => 'required|boolean',
                'tarifa_base' => 'nullable|numeric|min:0',
                'observaciones' => 'nullable|string',
            ], [
                'nombre.required' => 'El nombre es obligatorio',
                'nombre.string' => 'El nombre debe ser texto',
                'nombre.max' => 'El nombre no puede exceder 255 caracteres',
                'telefono.max' => 'El teléfono no puede exceder 50 caracteres',
                'celular.max' => 'El celular no puede exceder 50 caracteres',
                'email.email' => 'El email debe tener un formato válido',
                'email.max' => 'El email no puede exceder 255 caracteres',
                'email.unique' => 'Ya existe un mensajero con este email',
                'direccion.string' => 'La dirección debe ser texto',
                'ciudad.string' => 'La ciudad debe ser texto',
                'ciudad.max' => 'La ciudad no puede exceder 255 caracteres',
                'vehiculo.in' => 'El tipo de vehículo debe ser válido',
                'activo.required' => 'El estado activo es obligatorio',
                'activo.boolean' => 'El estado activo debe ser verdadero o falso',
                'tarifa_base.numeric' => 'La tarifa base debe ser un número',
                'tarifa_base.min' => 'La tarifa base debe ser mayor o igual a 0',
                'observaciones.string' => 'Las observaciones deben ser texto',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $mensajero = Mensajero::create([
                'nombre' => $request->nombre,
                'telefono' => $request->telefono,
                'celular' => $request->celular,
                'email' => $request->email,
                'direccion' => $request->direccion,
                'ciudad' => $request->ciudad,
                'vehiculo' => $request->vehiculo,
                'activo' => $request->activo,
                'tarifa_base' => $request->tarifa_base,
                'observaciones' => $request->observaciones,
                'broker_id' => $brokerId,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Mensajero creado exitosamente',
                'data' => $mensajero,
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al crear el mensajero: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Display the specified mensajero
     */
    public function show(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $mensajero = Mensajero::forBroker($brokerId)->findOrFail($id);

            return response()->json([
                'success' => true,
                'message' => 'Mensajero obtenido exitosamente',
                'data' => $mensajero,
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Mensajero no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener el mensajero: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update the specified mensajero
     */
    public function update(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $mensajero = Mensajero::forBroker($brokerId)->findOrFail($id);
            
            $validator = Validator::make($request->all(), [
                'nombre' => [
                    'required',
                    'string',
                    'max:255',
                ],
                'telefono' => 'nullable|string|max:50',
                'celular' => 'nullable|string|max:50',
                'email' => [
                    'nullable',
                    'email',
                    'max:255',
                    Rule::unique('mensajeros')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    })->ignore($id),
                ],
                'direccion' => 'nullable|string',
                'ciudad' => 'nullable|string|max:255',
                'vehiculo' => [
                    'nullable',
                    'string',
                    Rule::in(array_keys(Mensajero::VEHICULOS)),
                ],
                'activo' => 'required|boolean',
                'tarifa_base' => 'nullable|numeric|min:0',
                'observaciones' => 'nullable|string',
            ], [
                'nombre.required' => 'El nombre es obligatorio',
                'nombre.string' => 'El nombre debe ser texto',
                'nombre.max' => 'El nombre no puede exceder 255 caracteres',
                'telefono.max' => 'El teléfono no puede exceder 50 caracteres',
                'celular.max' => 'El celular no puede exceder 50 caracteres',
                'email.email' => 'El email debe tener un formato válido',
                'email.max' => 'El email no puede exceder 255 caracteres',
                'email.unique' => 'Ya existe un mensajero con este email',
                'direccion.string' => 'La dirección debe ser texto',
                'ciudad.string' => 'La ciudad debe ser texto',
                'ciudad.max' => 'La ciudad no puede exceder 255 caracteres',
                'vehiculo.in' => 'El tipo de vehículo debe ser válido',
                'activo.required' => 'El estado activo es obligatorio',
                'activo.boolean' => 'El estado activo debe ser verdadero o falso',
                'tarifa_base.numeric' => 'La tarifa base debe ser un número',
                'tarifa_base.min' => 'La tarifa base debe ser mayor o igual a 0',
                'observaciones.string' => 'Las observaciones deben ser texto',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $mensajero->update([
                'nombre' => $request->nombre,
                'telefono' => $request->telefono,
                'celular' => $request->celular,
                'email' => $request->email,
                'direccion' => $request->direccion,
                'ciudad' => $request->ciudad,
                'vehiculo' => $request->vehiculo,
                'activo' => $request->activo,
                'tarifa_base' => $request->tarifa_base,
                'observaciones' => $request->observaciones,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Mensajero actualizado exitosamente',
                'data' => $mensajero,
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Mensajero no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar el mensajero: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Remove the specified mensajero
     */
    public function destroy(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $mensajero = Mensajero::forBroker($brokerId)->findOrFail($id);
            
            $mensajero->delete();

            return response()->json([
                'success' => true,
                'message' => 'Mensajero eliminado exitosamente',
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Mensajero no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar el mensajero: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get all vehicle types available
     */
    public function vehiculos(Request $request)
    {
        try {
            $vehiculos = collect(Mensajero::VEHICULOS)->map(function ($nombre, $key) {
                return [
                    'value' => $key,
                    'label' => $nombre,
                ];
            })->values();

            return response()->json([
                'success' => true,
                'message' => 'Tipos de vehículos obtenidos exitosamente',
                'data' => $vehiculos,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener los tipos de vehículos: ' . $e->getMessage(),
            ], 500);
        }
    }
}
