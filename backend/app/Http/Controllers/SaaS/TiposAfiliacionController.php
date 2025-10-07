<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\TipoAfiliacion;
use App\Models\Broker;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class TiposAfiliacionController extends Controller
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
     * Display a listing of tipos de afiliación
     */
    public function index(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            // Construir la query base con aislamiento multi-tenant
            $query = TipoAfiliacion::forBroker($brokerId);

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
            $tiposAfiliacion = $query->paginate($perPage);

            return response()->json([
                'success' => true,
                'message' => 'Tipos de afiliación obtenidos exitosamente',
                'data' => $tiposAfiliacion->items(),
                'pagination' => [
                    'current_page' => $tiposAfiliacion->currentPage(),
                    'last_page' => $tiposAfiliacion->lastPage(),
                    'per_page' => $tiposAfiliacion->perPage(),
                    'total' => $tiposAfiliacion->total(),
                    'from' => $tiposAfiliacion->firstItem(),
                    'to' => $tiposAfiliacion->lastItem(),
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener los tipos de afiliación: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store a newly created tipo de afiliación
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
                    Rule::unique('tipos_afiliacion')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    }),
                ],
            ], [
                'nombre.required' => 'El nombre es obligatorio',
                'nombre.string' => 'El nombre debe ser texto',
                'nombre.max' => 'El nombre no puede exceder 255 caracteres',
                'nombre.unique' => 'Ya existe un tipo de afiliación con este nombre',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors(),
                ], 422);
            }

            // Crear el tipo de afiliación
            $tipoAfiliacion = TipoAfiliacion::create([
                'nombre' => $request->nombre,
                'broker_id' => $brokerId,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Tipo de afiliación creado exitosamente',
                'data' => $tipoAfiliacion,
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al crear el tipo de afiliación: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Display the specified tipo de afiliación
     */
    public function show(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $tipoAfiliacion = TipoAfiliacion::forBroker($brokerId)->findOrFail($id);

            return response()->json([
                'success' => true,
                'message' => 'Tipo de afiliación obtenido exitosamente',
                'data' => $tipoAfiliacion,
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Tipo de afiliación no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener el tipo de afiliación: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update the specified tipo de afiliación
     */
    public function update(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $tipoAfiliacion = TipoAfiliacion::forBroker($brokerId)->findOrFail($id);
            
            // Validación
            $validator = Validator::make($request->all(), [
                'nombre' => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('tipos_afiliacion')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    })->ignore($id),
                ],
            ], [
                'nombre.required' => 'El nombre es obligatorio',
                'nombre.string' => 'El nombre debe ser texto',
                'nombre.max' => 'El nombre no puede exceder 255 caracteres',
                'nombre.unique' => 'Ya existe un tipo de afiliación con este nombre',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors(),
                ], 422);
            }

            // Actualizar el tipo de afiliación
            $tipoAfiliacion->update([
                'nombre' => $request->nombre,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Tipo de afiliación actualizado exitosamente',
                'data' => $tipoAfiliacion,
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Tipo de afiliación no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar el tipo de afiliación: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Remove the specified tipo de afiliación
     */
    public function destroy(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $tipoAfiliacion = TipoAfiliacion::forBroker($brokerId)->findOrFail($id);
            
            $tipoAfiliacion->delete();

            return response()->json([
                'success' => true,
                'message' => 'Tipo de afiliación eliminado exitosamente',
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Tipo de afiliación no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar el tipo de afiliación: ' . $e->getMessage(),
            ], 500);
        }
    }
}
