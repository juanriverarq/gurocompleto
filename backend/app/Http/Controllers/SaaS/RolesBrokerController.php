<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\RolBroker;
use App\Models\Broker;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class RolesBrokerController extends Controller
{
    /**
     * Get the broker ID for the current user (Firebase or Employee)
     */
    private function getBrokerId(Request $request)
    {
        // Prioridad 1: Broker ID del middleware unificado
        $brokerId = \App\Http\Middleware\UnifiedAuthMiddleware::getBrokerId($request);
        if ($brokerId) {
            return $brokerId;
        }
        
        // Prioridad 2: Usuario autenticado tradicional
        $user = Auth::user();
        if ($user && $user->broker_id) {
            return $user->broker_id;
        }
        
        // Prioridad 3: Header de desarrollo
        $devBrokerId = $request->header('X-Dev-Broker-Id');
        if ($devBrokerId) {
            return (int) $devBrokerId;
        }
        
        // Prioridad 4: Primer broker en desarrollo
        $firstBroker = Broker::first();
        if ($firstBroker) {
            return $firstBroker->id;
        }
        
        throw new \Exception('No se pudo determinar el broker para el usuario');
    }

    /**
     * Display a listing of roles
     */
    public function index(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $query = RolBroker::forBroker($brokerId)->withCount('empleados');

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

            if ($request->has('nivel_acceso') && !empty($request->nivel_acceso)) {
                $query->byNivelAcceso($request->nivel_acceso);
            }

            if ($request->has('es_admin') && $request->es_admin !== null) {
                if ($request->es_admin === 'true' || $request->es_admin === '1') {
                    $query->admins();
                }
            }

            $sortField = $request->get('sort_field', 'nivel_acceso');
            $sortDirection = $request->get('sort_direction', 'asc');
            
            if ($sortField === 'nivel_acceso') {
                $query->orderByNivel($sortDirection);
            } else {
                $query->orderBy($sortField, $sortDirection);
            }

            $perPage = $request->get('per_page', 15);
            $roles = $query->paginate($perPage);

            return response()->json([
                'success' => true,
                'message' => 'Roles obtenidos exitosamente',
                'data' => $roles->items(),
                'pagination' => [
                    'current_page' => $roles->currentPage(),
                    'last_page' => $roles->lastPage(),
                    'per_page' => $roles->perPage(),
                    'total' => $roles->total(),
                    'from' => $roles->firstItem(),
                    'to' => $roles->lastItem(),
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener los roles: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store a newly created role
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
                'slug' => [
                    'nullable',
                    'string',
                    'max:255',
                    Rule::unique('roles_broker')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    }),
                ],
                'descripcion' => 'nullable|string',
                'permisos' => 'nullable|array',
                'permisos.*' => 'string',
                'color' => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
                'activo' => 'required|boolean',
                'nivel_acceso' => [
                    'required',
                    'integer',
                    Rule::in(array_keys(RolBroker::NIVELES_ACCESO)),
                ],
                'es_admin' => 'required|boolean',
            ], [
                'nombre.required' => 'El nombre es obligatorio',
                'nombre.string' => 'El nombre debe ser texto',
                'nombre.max' => 'El nombre no puede exceder 255 caracteres',
                'slug.unique' => 'Ya existe un rol con este identificador',
                'descripcion.string' => 'La descripción debe ser texto',
                'permisos.array' => 'Los permisos deben ser un array',
                'color.regex' => 'El color debe ser un código hexadecimal válido',
                'activo.required' => 'El estado activo es obligatorio',
                'activo.boolean' => 'El estado activo debe ser verdadero o falso',
                'nivel_acceso.required' => 'El nivel de acceso es obligatorio',
                'nivel_acceso.integer' => 'El nivel de acceso debe ser un número entero',
                'nivel_acceso.in' => 'El nivel de acceso debe ser válido',
                'es_admin.required' => 'Debe especificar si es administrador',
                'es_admin.boolean' => 'El campo es administrador debe ser verdadero o falso',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $rol = RolBroker::create([
                'nombre' => $request->nombre,
                'slug' => $request->slug,
                'descripcion' => $request->descripcion,
                'permisos' => $request->permisos ?? [],
                'color' => $request->color ?? '#6B7280',
                'activo' => $request->activo,
                'nivel_acceso' => $request->nivel_acceso,
                'es_admin' => $request->es_admin,
                'broker_id' => $brokerId,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Rol creado exitosamente',
                'data' => $rol->load('empleados'),
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al crear el rol: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Display the specified role
     */
    public function show(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $rol = RolBroker::forBroker($brokerId)
                ->withCount('empleados')
                ->with('empleados')
                ->findOrFail($id);

            return response()->json([
                'success' => true,
                'message' => 'Rol obtenido exitosamente',
                'data' => $rol,
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Rol no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener el rol: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update the specified role
     */
    public function update(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $rol = RolBroker::forBroker($brokerId)->findOrFail($id);
            
            $validator = Validator::make($request->all(), [
                'nombre' => [
                    'required',
                    'string',
                    'max:255',
                ],
                'slug' => [
                    'nullable',
                    'string',
                    'max:255',
                    Rule::unique('roles_broker')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    })->ignore($id),
                ],
                'descripcion' => 'nullable|string',
                'permisos' => 'nullable|array',
                'permisos.*' => 'string',
                'color' => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
                'activo' => 'required|boolean',
                'nivel_acceso' => [
                    'required',
                    'integer',
                    Rule::in(array_keys(RolBroker::NIVELES_ACCESO)),
                ],
                'es_admin' => 'required|boolean',
            ], [
                'nombre.required' => 'El nombre es obligatorio',
                'nombre.string' => 'El nombre debe ser texto',
                'nombre.max' => 'El nombre no puede exceder 255 caracteres',
                'slug.unique' => 'Ya existe un rol con este identificador',
                'descripcion.string' => 'La descripción debe ser texto',
                'permisos.array' => 'Los permisos deben ser un array',
                'color.regex' => 'El color debe ser un código hexadecimal válido',
                'activo.required' => 'El estado activo es obligatorio',
                'activo.boolean' => 'El estado activo debe ser verdadero o falso',
                'nivel_acceso.required' => 'El nivel de acceso es obligatorio',
                'nivel_acceso.integer' => 'El nivel de acceso debe ser un número entero',
                'nivel_acceso.in' => 'El nivel de acceso debe ser válido',
                'es_admin.required' => 'Debe especificar si es administrador',
                'es_admin.boolean' => 'El campo es administrador debe ser verdadero o falso',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $rol->update([
                'nombre' => $request->nombre,
                'slug' => $request->slug ?? $rol->slug,
                'descripcion' => $request->descripcion,
                'permisos' => $request->permisos ?? [],
                'color' => $request->color ?? $rol->color,
                'activo' => $request->activo,
                'nivel_acceso' => $request->nivel_acceso,
                'es_admin' => $request->es_admin,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Rol actualizado exitosamente',
                'data' => $rol->load('empleados'),
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Rol no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar el rol: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Remove the specified role
     */
    public function destroy(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $rol = RolBroker::forBroker($brokerId)->findOrFail($id);
            
            // Verificar si el rol tiene empleados asignados
            if ($rol->empleados()->count() > 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se puede eliminar el rol porque tiene empleados asignados',
                ], 400);
            }
            
            $rol->delete();

            return response()->json([
                'success' => true,
                'message' => 'Rol eliminado exitosamente',
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Rol no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar el rol: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Obtener los permisos disponibles
     */
    public function permisos()
    {
        try {
            return response()->json([
                'success' => true,
                'message' => 'Permisos obtenidos exitosamente',
                'data' => RolBroker::PERMISOS_DISPONIBLES
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener permisos: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener los niveles de acceso disponibles
     */
    public function nivelesAcceso()
    {
        try {
            return response()->json([
                'success' => true,
                'message' => 'Niveles de acceso obtenidos exitosamente',
                'data' => RolBroker::NIVELES_ACCESO
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener niveles de acceso: ' . $e->getMessage()
            ], 500);
        }
    }
}
