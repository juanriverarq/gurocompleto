<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\Cobertura;
use App\Models\Broker;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class CoberturasController extends Controller
{
    /**
     * Get the broker ID for the current user with fallback for development
     */
    private function getBrokerId(Request $request)
    {
        // Intentar obtener el usuario autenticado
        $user = Auth::user();
        
        if ($user && $user->broker_id) {
            return $user->broker_id;
        }
        
        // Fallback para desarrollo: intentar obtener de header personalizado
        $devBrokerId = $request->header('X-Dev-Broker-Id');
        if ($devBrokerId) {
            return (int) $devBrokerId;
        }
        
        // Fallback final: usar el primer broker disponible
        $firstBroker = Broker::first();
        if ($firstBroker) {
            return $firstBroker->id;
        }
        
        throw new \Exception('No se pudo determinar el broker para el usuario');
    }

    /**
     * Display a listing of coberturas
     */
    public function index(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            // Construir la query base con aislamiento multi-tenant
            $query = Cobertura::forBroker($brokerId);

            // Aplicar filtros
            if ($request->has('search') && !empty($request->search)) {
                $query->search($request->search);
            }

            // Ordenamiento
            $sortField = $request->get('sort_field', 'nombre');
            $sortDirection = $request->get('sort_direction', 'asc');
            
            if ($sortField === 'nombre') {
                $query->orderByName($sortDirection);
            } else {
                $query->orderBy($sortField, $sortDirection);
            }

            // Paginación
            $perPage = $request->get('per_page', 15);
            $coberturas = $query->paginate($perPage);

            return response()->json([
                'success' => true,
                'message' => 'Coberturas obtenidas exitosamente',
                'data' => $coberturas->items(),
                'pagination' => [
                    'current_page' => $coberturas->currentPage(),
                    'last_page' => $coberturas->lastPage(),
                    'per_page' => $coberturas->perPage(),
                    'total' => $coberturas->total(),
                    'from' => $coberturas->firstItem(),
                    'to' => $coberturas->lastItem(),
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener las coberturas: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store a newly created cobertura
     */
    public function store(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            // Validación
            $validator = Validator::make($request->all(), [
                'nombre' => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('coberturas')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    }),
                ],
            ], [
                'nombre.required' => 'El nombre es obligatorio',
                'nombre.string' => 'El nombre debe ser texto',
                'nombre.max' => 'El nombre no puede exceder 255 caracteres',
                'nombre.unique' => 'Ya existe una cobertura con este nombre',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors(),
                ], 422);
            }

            // Crear la cobertura
            $cobertura = Cobertura::create([
                'nombre' => $request->nombre,
                'broker_id' => $brokerId,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Cobertura creada exitosamente',
                'data' => $cobertura,
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al crear la cobertura: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Display the specified cobertura
     */
    public function show(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $cobertura = Cobertura::forBroker($brokerId)->findOrFail($id);

            return response()->json([
                'success' => true,
                'message' => 'Cobertura obtenida exitosamente',
                'data' => $cobertura,
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Cobertura no encontrada',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener la cobertura: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update the specified cobertura
     */
    public function update(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $cobertura = Cobertura::forBroker($brokerId)->findOrFail($id);
            
            // Validación
            $validator = Validator::make($request->all(), [
                'nombre' => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('coberturas')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    })->ignore($id),
                ],
            ], [
                'nombre.required' => 'El nombre es obligatorio',
                'nombre.string' => 'El nombre debe ser texto',
                'nombre.max' => 'El nombre no puede exceder 255 caracteres',
                'nombre.unique' => 'Ya existe una cobertura con este nombre',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors(),
                ], 422);
            }

            // Actualizar la cobertura
            $cobertura->update([
                'nombre' => $request->nombre,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Cobertura actualizada exitosamente',
                'data' => $cobertura,
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Cobertura no encontrada',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar la cobertura: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Remove the specified cobertura
     */
    public function destroy(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $cobertura = Cobertura::forBroker($brokerId)->findOrFail($id);
            
            $cobertura->delete();

            return response()->json([
                'success' => true,
                'message' => 'Cobertura eliminada exitosamente',
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Cobertura no encontrada',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar la cobertura: ' . $e->getMessage(),
            ], 500);
        }
    }
}
