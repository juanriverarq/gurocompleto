<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\EmpleadoBroker;
use App\Models\RolBroker;
use App\Models\Broker;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class EmpleadosBrokerController extends Controller
{
    /**
     * Get the broker ID for the current user (Firebase or Employee)
     */
    private function getBrokerId(Request $request)
    {
        // Prioridad 1: Broker ID del middleware GlobalBrokerAuth
        if ($request->has('authenticated_broker_id')) {
            return $request->get('authenticated_broker_id');
        }

        // Prioridad 2: Broker ID del middleware unificado
        $brokerId = \App\Http\Middleware\UnifiedAuthMiddleware::getBrokerId($request);
        if ($brokerId) {
            return $brokerId;
        }

        // Prioridad 3: Usuario autenticado tradicional
        $user = Auth::user();
        if ($user && $user->broker_id) {
            return $user->broker_id;
        }

        // Prioridad 4: Header de desarrollo
        $devBrokerId = $request->header('X-Dev-Broker-Id');
        if ($devBrokerId) {
            return (int) $devBrokerId;
        }

        // Prioridad 5: Primer broker en desarrollo
        $firstBroker = Broker::first();
        if ($firstBroker) {
            return $firstBroker->id;
        }

        throw new \Exception('No se pudo determinar el broker para el usuario');
    }

    /**
     * Display a listing of employees
     */
    public function index(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $query = EmpleadoBroker::forBroker($brokerId)->with('rol');

            if ($request->has('search') && !empty($request->search)) {
                $query->search($request->search);
            }

            // Filtros específicos
            if ($request->has('estado') && !empty($request->estado)) {
                $query->byEstado($request->estado);
            }

            if ($request->has('tipo_vinculacion') && !empty($request->tipo_vinculacion)) {
                $query->byTipoVinculacion($request->tipo_vinculacion);
            }

            if ($request->has('rol_id') && !empty($request->rol_id)) {
                $query->byRol($request->rol_id);
            }

            if ($request->has('acceso_activo') && $request->acceso_activo !== null) {
                if ($request->acceso_activo === 'true' || $request->acceso_activo === '1') {
                    $query->conAccesoActivo();
                }
            }

            $sortField = $request->get('sort_field', 'nombres');
            $sortDirection = $request->get('sort_direction', 'asc');
            
            if ($sortField === 'nombres') {
                $query->orderByName($sortDirection);
            } else {
                $query->orderBy($sortField, $sortDirection);
            }

            $perPage = $request->get('per_page', 15);
            $empleados = $query->paginate($perPage);

            return response()->json([
                'success' => true,
                'message' => 'Empleados obtenidos exitosamente',
                'data' => $empleados->items(),
                'pagination' => [
                    'current_page' => $empleados->currentPage(),
                    'last_page' => $empleados->lastPage(),
                    'per_page' => $empleados->perPage(),
                    'total' => $empleados->total(),
                    'from' => $empleados->firstItem(),
                    'to' => $empleados->lastItem(),
                ],
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener los empleados: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Store a newly created employee
     */
    public function store(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $validator = Validator::make($request->all(), [
                'nombres' => 'required|string|max:255',
                'apellidos' => 'required|string|max:255',
                'tipo_documento' => [
                    'required',
                    Rule::in(array_keys(EmpleadoBroker::TIPOS_DOCUMENTO)),
                ],
                'numero_documento' => [
                    'required',
                    'string',
                    'max:50',
                    Rule::unique('empleados_broker')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    }),
                ],
                'email' => [
                    'required',
                    'email',
                    'max:255',
                    Rule::unique('empleados_broker')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    }),
                ],
                'usuario' => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('empleados_broker')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    }),
                ],
                'telefono' => 'nullable|string|max:50',
                'celular' => 'nullable|string|max:50',
                'fecha_nacimiento' => 'nullable|date',
                'direccion' => 'nullable|string',
                'ciudad' => 'nullable|string|max:255',
                'cargo' => 'nullable|string|max:255',
                'departamento' => 'nullable|string|max:255',
                'fecha_ingreso' => 'nullable|date',
                'estado' => [
                    'required',
                    Rule::in(array_keys(EmpleadoBroker::ESTADOS)),
                ],
                'tipo_vinculacion' => [
                    'required',
                    Rule::in(array_keys(EmpleadoBroker::TIPOS_VINCULACION)),
                ],
                'salario' => 'nullable|numeric|min:0',
                'acceso_activo' => 'required|boolean',
                'rol_id' => [
                    'nullable',
                    'integer',
                    Rule::exists('roles_broker', 'id')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    }),
                ],
                'observaciones' => 'nullable|string',
                // Credenciales (opcionales en creación)
                'password' => 'nullable|string|min:8|confirmed',
                'password_confirmation' => 'nullable|string',
                'requiere_cambio_password' => 'nullable|boolean',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $empleado = EmpleadoBroker::create([
                'nombres' => $request->nombres,
                'apellidos' => $request->apellidos,
                'tipo_documento' => $request->tipo_documento,
                'numero_documento' => $request->numero_documento,
                'email' => $request->email,
                'usuario' => $request->usuario,
                'telefono' => $request->telefono,
                'celular' => $request->celular,
                'fecha_nacimiento' => $request->fecha_nacimiento,
                'direccion' => $request->direccion,
                'ciudad' => $request->ciudad,
                'cargo' => $request->cargo,
                'departamento' => $request->departamento,
                'fecha_ingreso' => $request->fecha_ingreso,
                'estado' => $request->estado,
                'tipo_vinculacion' => $request->tipo_vinculacion,
                'salario' => $request->salario,
                'acceso_activo' => $request->acceso_activo,
                'rol_id' => $request->rol_id,
                'observaciones' => $request->observaciones,
                'broker_id' => $brokerId,
                'requiere_cambio_password' => (bool) $request->get('requiere_cambio_password', true),
                'creado_por' => Auth::id(),
            ]);

            // Si llegó password, establecerla y marcar fecha de cambio
            if ($request->filled('password')) {
                $empleado->update([
                    'password' => $request->password,
                    'password_changed_at' => now(),
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Empleado creado exitosamente',
                'data' => $empleado->load('rol'),
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al crear el empleado: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Display the specified employee
     */
    public function show(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $empleado = EmpleadoBroker::forBroker($brokerId)
                ->with(['rol', 'creadoPor', 'actualizadoPor'])
                ->findOrFail($id);

            return response()->json([
                'success' => true,
                'message' => 'Empleado obtenido exitosamente',
                'data' => $empleado,
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Empleado no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener el empleado: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update the specified employee
     */
    public function update(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $empleado = EmpleadoBroker::forBroker($brokerId)->findOrFail($id);
            
            $validator = Validator::make($request->all(), [
                'nombres' => 'required|string|max:255',
                'apellidos' => 'required|string|max:255',
                'tipo_documento' => [
                    'required',
                    Rule::in(array_keys(EmpleadoBroker::TIPOS_DOCUMENTO)),
                ],
                'numero_documento' => [
                    'required',
                    'string',
                    'max:50',
                    Rule::unique('empleados_broker')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    })->ignore($id),
                ],
                'email' => [
                    'required',
                    'email',
                    'max:255',
                    Rule::unique('empleados_broker')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    })->ignore($id),
                ],
                'usuario' => [
                    'required',
                    'string',
                    'max:255',
                    Rule::unique('empleados_broker')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    })->ignore($id),
                ],
                'telefono' => 'nullable|string|max:50',
                'celular' => 'nullable|string|max:50',
                'fecha_nacimiento' => 'nullable|date',
                'direccion' => 'nullable|string',
                'ciudad' => 'nullable|string|max:255',
                'cargo' => 'nullable|string|max:255',
                'departamento' => 'nullable|string|max:255',
                'fecha_ingreso' => 'nullable|date',
                'estado' => [
                    'required',
                    Rule::in(array_keys(EmpleadoBroker::ESTADOS)),
                ],
                'tipo_vinculacion' => [
                    'required',
                    Rule::in(array_keys(EmpleadoBroker::TIPOS_VINCULACION)),
                ],
                'salario' => 'nullable|numeric|min:0',
                'acceso_activo' => 'required|boolean',
                'rol_id' => [
                    'nullable',
                    'integer',
                    Rule::exists('roles_broker', 'id')->where(function ($query) use ($brokerId) {
                        return $query->where('broker_id', $brokerId);
                    }),
                ],
                'observaciones' => 'nullable|string',
                // Credenciales (opcionales en edición)
                'password' => 'nullable|string|min:8|confirmed',
                'password_confirmation' => 'nullable|string',
                'requiere_cambio_password' => 'nullable|boolean',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $empleado->update([
                'nombres' => $request->nombres,
                'apellidos' => $request->apellidos,
                'tipo_documento' => $request->tipo_documento,
                'numero_documento' => $request->numero_documento,
                'email' => $request->email,
                'usuario' => $request->usuario,
                'telefono' => $request->telefono,
                'celular' => $request->celular,
                'fecha_nacimiento' => $request->fecha_nacimiento,
                'direccion' => $request->direccion,
                'ciudad' => $request->ciudad,
                'cargo' => $request->cargo,
                'departamento' => $request->departamento,
                'fecha_ingreso' => $request->fecha_ingreso,
                'estado' => $request->estado,
                'tipo_vinculacion' => $request->tipo_vinculacion,
                'salario' => $request->salario,
                'acceso_activo' => $request->acceso_activo,
                'rol_id' => $request->rol_id,
                'observaciones' => $request->observaciones,
                'requiere_cambio_password' => $request->has('requiere_cambio_password')
                    ? (bool) $request->get('requiere_cambio_password')
                    : $empleado->requiere_cambio_password,
                'actualizado_por' => Auth::id(),
            ]);

            // Si llegó password en la edición, actualizarla
            if ($request->filled('password')) {
                $empleado->update([
                    'password' => $request->password,
                    'password_changed_at' => now(),
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Empleado actualizado exitosamente',
                'data' => $empleado->load('rol'),
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Empleado no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar el empleado: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Remove the specified employee
     */
    public function destroy(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $empleado = EmpleadoBroker::forBroker($brokerId)->findOrFail($id);
            
            $empleado->delete();

            return response()->json([
                'success' => true,
                'message' => 'Empleado eliminado exitosamente',
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Empleado no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar el empleado: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get estados disponibles
     */
    public function estados(Request $request)
    {
        try {
            $estados = collect(EmpleadoBroker::ESTADOS)->map(function ($nombre, $valor) {
                return [
                    'value' => $valor,
                    'label' => $nombre,
                ];
            })->values();

            return response()->json([
                'success' => true,
                'message' => 'Estados obtenidos exitosamente',
                'data' => $estados,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener los estados: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get tipos de vinculacion disponibles
     */
    public function tiposVinculacion(Request $request)
    {
        try {
            $tipos = collect(EmpleadoBroker::TIPOS_VINCULACION)->map(function ($nombre, $valor) {
                return [
                    'value' => $valor,
                    'label' => $nombre,
                ];
            })->values();

            return response()->json([
                'success' => true,
                'message' => 'Tipos de vinculación obtenidos exitosamente',
                'data' => $tipos,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener los tipos de vinculación: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get tipos de documento disponibles
     */
    public function tiposDocumento(Request $request)
    {
        try {
            $tipos = collect(EmpleadoBroker::TIPOS_DOCUMENTO)->map(function ($nombre, $valor) {
                return [
                    'value' => $valor,
                    'label' => $nombre,
                ];
            })->values();

            return response()->json([
                'success' => true,
                'message' => 'Tipos de documento obtenidos exitosamente',
                'data' => $tipos,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener los tipos de documento: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Cambiar contraseña de un empleado
     */
    public function cambiarPassword(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $empleado = EmpleadoBroker::forBroker($brokerId)->findOrFail($id);

            $validator = Validator::make($request->all(), [
                'password' => 'required|string|min:8|confirmed',
                'password_confirmation' => 'required|string',
                'requiere_cambio_password' => 'boolean',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de validación',
                    'errors' => $validator->errors(),
                ], 422);
            }

            $empleado->update([
                'password' => $request->password,
                'requiere_cambio_password' => $request->get('requiere_cambio_password', false),
                'password_changed_at' => now(),
                'actualizado_por' => Auth::id(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Contraseña cambiada exitosamente',
                'data' => [
                    'id' => $empleado->id,
                    'usuario' => $empleado->usuario,
                    'requiere_cambio_password' => $empleado->requiere_cambio_password,
                    'password_changed_at' => $empleado->password_changed_at,
                ],
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Empleado no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al cambiar la contraseña: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Generar nueva contraseña temporal para un empleado
     */
    public function generarPasswordTemporal(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $empleado = EmpleadoBroker::forBroker($brokerId)->findOrFail($id);

            $passwordTemporal = $empleado->generarPasswordTemporal();

            return response()->json([
                'success' => true,
                'message' => 'Contraseña temporal generada exitosamente',
                'data' => [
                    'id' => $empleado->id,
                    'usuario' => $empleado->usuario,
                    'password_temporal' => $passwordTemporal,
                    'requiere_cambio_password' => true,
                    'password_changed_at' => $empleado->password_changed_at,
                ],
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Empleado no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al generar contraseña temporal: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Resetear contraseña (solo para administradores)
     */
    public function resetPassword(Request $request, $id)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $empleado = EmpleadoBroker::forBroker($brokerId)->findOrFail($id);

            // Generar nueva contraseña aleatoria
            $nuevaPassword = 'Temp' . rand(100000, 999999);

            $empleado->update([
                'password' => $nuevaPassword,
                'requiere_cambio_password' => true,
                'password_changed_at' => now(),
                'actualizado_por' => Auth::id(),
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Contraseña reseteada exitosamente',
                'data' => [
                    'id' => $empleado->id,
                    'usuario' => $empleado->usuario,
                    'nueva_password' => $nuevaPassword,
                    'requiere_cambio_password' => true,
                    'password_changed_at' => $empleado->password_changed_at,
                ],
            ]);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Empleado no encontrado',
            ], 404);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al resetear la contraseña: ' . $e->getMessage(),
            ], 500);
        }
    }
}
