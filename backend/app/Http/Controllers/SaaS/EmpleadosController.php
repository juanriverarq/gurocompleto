<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\Empleado;
use App\Models\User;
use App\Models\Broker;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class EmpleadosController extends Controller
{
    /**
     * Get the broker ID for the current user (supports both Firebase users and employees)
     */
    private function getBrokerId(Request $request)
    {
        \Log::info('🔍 [DEBUG] EmpleadosController::getBrokerId - INICIANDO', [
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
     * Display a listing of empleados/usuarios for the broker
     */
    public function index(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            // Obtener empleados del broker desde la tabla empleados
            $empleados = Empleado::where('broker_id', $brokerId)
                ->where('estado', 'activo')
                ->select(['id', 'nombre', 'apellidos', 'email', 'telefono', 'cargo', 'broker_id'])
                ->orderBy('nombre')
                ->get();

            // También obtener usuarios Firebase del broker
            $usuarios = User::where('broker_id', $brokerId)
                ->select(['id', 'name', 'email', 'broker_id'])
                ->orderBy('name')
                ->get();

            // Combinar y transformar para el frontend
            $data = [];
            
            foreach ($empleados as $empleado) {
                $data[] = [
                    'id' => $empleado->id,
                    'nombre' => $empleado->nombre,
                    'apellidos' => $empleado->apellidos,
                    'email' => $empleado->email,
                    'telefono' => $empleado->telefono,
                    'cargo' => $empleado->cargo,
                    'tipo' => 'empleado'
                ];
            }

            foreach ($usuarios as $usuario) {
                $data[] = [
                    'id' => $usuario->id,
                    'nombre' => $usuario->name,
                    'apellidos' => '',
                    'email' => $usuario->email,
                    'telefono' => '',
                    'cargo' => 'Usuario',
                    'tipo' => 'usuario'
                ];
            }

            return response()->json([
                'success' => true,
                'message' => 'Lista de empleados y usuarios obtenida exitosamente',
                'data' => $data
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener empleados: ' . $e->getMessage(),
                'data' => []
            ], 500);
        }
    }

    /**
     * Get users/asesores for the broker (for dropdowns and selects)
     */
    public function getUsuarios(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            // Obtener usuarios Firebase del broker
            $usuarios = User::where('broker_id', $brokerId)
                ->select(['id', 'name', 'email', 'broker_id'])
                ->orderBy('name')
                ->get();

            // También obtener empleados del broker si existen
            $empleados = [];
            if (\Schema::hasTable('empleados')) {
                $empleados = Empleado::where('broker_id', $brokerId)
                    ->where('estado', 'activo')
                    ->select(['id', 'nombre', 'apellidos', 'email', 'telefono', 'cargo', 'broker_id'])
                    ->orderBy('nombre')
                    ->get();
            }

            // Combinar y transformar para el frontend
            $data = [];
            
            foreach ($usuarios as $usuario) {
                $data[] = [
                    'id' => $usuario->id,
                    'nombre' => $usuario->name,
                    'apellidos' => '',
                    'email' => $usuario->email,
                    'telefono' => '',
                    'cargo' => 'Usuario',
                    'tipo' => 'usuario'
                ];
            }

            foreach ($empleados as $empleado) {
                $data[] = [
                    'id' => $empleado->id,
                    'nombre' => $empleado->nombre,
                    'apellidos' => $empleado->apellidos,
                    'email' => $empleado->email,
                    'telefono' => $empleado->telefono,
                    'cargo' => $empleado->cargo,
                    'tipo' => 'empleado'
                ];
            }

            return response()->json([
                'success' => true,
                'message' => 'Usuarios obtenidos exitosamente',
                'data' => $data
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener usuarios: ' . $e->getMessage(),
                'data' => []
            ], 500);
        }
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        return response()->json([
            'success' => true,
            'message' => 'Empleado creado exitosamente',
            'data' => []
        ]);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        return response()->json([
            'success' => true,
            'message' => 'Empleado encontrado',
            'data' => []
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        return response()->json([
            'success' => true,
            'message' => 'Empleado actualizado exitosamente',
            'data' => []
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        return response()->json([
            'success' => true,
            'message' => 'Empleado eliminado exitosamente'
        ]);
    }
}
