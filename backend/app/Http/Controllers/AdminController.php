<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\User;

class AdminController extends Controller
{
    /**
     * Obtener estadísticas del dashboard de administración
     */
    public function getStats(): JsonResponse
    {
        try {
            $totalUsuarios = User::count();
            $usuariosActivos = User::where('status', 'active')->count();
            $usuariosInactivos = User::where('status', 'inactive')->count();
            $usuariosSuspendidos = User::where('status', 'suspended')->count();

            $stats = [
                'total_usuarios' => $totalUsuarios,
                'usuarios_activos' => $usuariosActivos,
                'usuarios_inactivos' => $usuariosInactivos,
                'usuarios_suspendidos' => $usuariosSuspendidos,
                'total_roles' => 5, // Placeholder
                'total_companias' => 1, // Placeholder
                'total_sucursales' => 3, // Placeholder
                'logins_ultimo_mes' => 150, // Placeholder
                'usuarios_por_vinculacion' => [
                    'PLANTA' => 20,
                    'INDEPENDIENTE' => 15,
                    'FREELANCE' => 8,
                    'EXTERNO' => 5
                ],
                'usuarios_por_rol' => [
                    'ADMINISTRADOR' => 2,
                    'GERENTE' => 5,
                    'SUPERVISOR' => 8,
                    'AGENTE' => 25,
                    'ASISTENTE' => 10
                ]
            ];

            return response()->json([
                'success' => true,
                'data' => $stats
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener estadísticas: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener lista de usuarios con paginación y filtros
     */
    public function getUsers(Request $request): JsonResponse
    {
        try {
            $query = User::query();

            // Aplicar filtros
            if ($request->has('search') && $request->search) {
                $query->where(function ($q) use ($request) {
                    $q->where('name', 'like', '%' . $request->search . '%')
                      ->orWhere('email', 'like', '%' . $request->search . '%');
                });
            }

            if ($request->has('estado') && $request->estado) {
                $query->where('status', $request->estado);
            }

            // Paginación
            $perPage = $request->get('per_page', 10);
            $users = $query->paginate($perPage);

            // Transformar datos para el frontend
            $transformedUsers = $users->getCollection()->map(function ($user) {
                return [
                    'id' => $user->id,
                    'nombre_completo' => $user->name,
                    'correo_corporativo' => $user->email,
                    'estado' => $user->status ?? 'ACTIVO',
                    'tipo_vinculacion' => 'PLANTA', // Placeholder
                    'rol_id' => '1', // Placeholder
                    'fecha_ingreso' => $user->created_at->toISOString(),
                    'fecha_ultima_conexion' => $user->last_login_at?->toISOString(),
                    'foto_perfil' => $user->avatar,
                    'firebase_uid' => $user->firebase_uid,
                    'created_at' => $user->created_at->toISOString(),
                    'updated_at' => $user->updated_at->toISOString()
                ];
            });

            $users->setCollection($transformedUsers);

            return response()->json([
                'success' => true,
                'data' => $users
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener usuarios: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener lista de roles
     */
    public function getRoles(): JsonResponse
    {
        try {
            $roles = [
                [
                    'id' => '1',
                    'nombre' => 'Administrador General',
                    'descripcion' => 'Acceso completo al sistema',
                    'permisos' => [],
                    'modulos_acceso' => ['TODOS'],
                    'created_at' => now()->toISOString(),
                    'updated_at' => now()->toISOString()
                ],
                [
                    'id' => '2',
                    'nombre' => 'Gerente Comercial',
                    'descripcion' => 'Gestión comercial y equipos',
                    'permisos' => [],
                    'modulos_acceso' => ['CLIENTES', 'CRM', 'REPORTES'],
                    'created_at' => now()->toISOString(),
                    'updated_at' => now()->toISOString()
                ],
                [
                    'id' => '3',
                    'nombre' => 'Supervisor',
                    'descripcion' => 'Supervisión de operaciones',
                    'permisos' => [],
                    'modulos_acceso' => ['SINIESTROS', 'RENOVACIONES'],
                    'created_at' => now()->toISOString(),
                    'updated_at' => now()->toISOString()
                ]
            ];

            return response()->json([
                'success' => true,
                'data' => $roles
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener roles: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener lista de compañías
     */
    public function getCompanies(): JsonResponse
    {
        try {
            $companies = [
                [
                    'id' => '1',
                    'nombre' => 'Guro Seguros',
                    'nit' => '900123456-1',
                    'representante_legal' => 'Juan Pérez',
                    'correo_general' => 'info@guro.com',
                    'ciudad' => 'Bogotá',
                    'direccion' => 'Calle 100 #15-20',
                    'created_at' => now()->toISOString(),
                    'updated_at' => now()->toISOString()
                ]
            ];

            return response()->json([
                'success' => true,
                'data' => $companies
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener compañías: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener lista de sucursales
     */
    public function getSucursales(): JsonResponse
    {
        try {
            $sucursales = [
                [
                    'id' => '1',
                    'nombre' => 'Sucursal Principal',
                    'ciudad' => 'Bogotá',
                    'telefono' => '601-234-5678',
                    'compania_id' => '1',
                    'created_at' => now()->toISOString(),
                    'updated_at' => now()->toISOString()
                ],
                [
                    'id' => '2',
                    'nombre' => 'Sucursal Medellín',
                    'ciudad' => 'Medellín',
                    'telefono' => '604-234-5678',
                    'compania_id' => '1',
                    'created_at' => now()->toISOString(),
                    'updated_at' => now()->toISOString()
                ],
                [
                    'id' => '3',
                    'nombre' => 'Sucursal Cali',
                    'ciudad' => 'Cali',
                    'telefono' => '602-234-5678',
                    'compania_id' => '1',
                    'created_at' => now()->toISOString(),
                    'updated_at' => now()->toISOString()
                ]
            ];

            return response()->json([
                'success' => true,
                'data' => $sucursales
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener sucursales: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Crear nuevo usuario (placeholder)
     */
    public function createUser(Request $request): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'Funcionalidad en desarrollo'
        ], 501);
    }

    /**
     * Actualizar usuario (placeholder)
     */
    public function updateUser(Request $request, $id): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'Funcionalidad en desarrollo'
        ], 501);
    }

    /**
     * Eliminar usuario (placeholder)
     */
    public function deleteUser($id): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'Funcionalidad en desarrollo'
        ], 501);
    }

    /**
     * Cambiar estado de usuario (placeholder)
     */
    public function toggleUserStatus(Request $request, $id): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'Funcionalidad en desarrollo'
        ], 501);
    }
}
