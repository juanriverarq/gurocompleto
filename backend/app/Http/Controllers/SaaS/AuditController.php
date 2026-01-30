<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\EmpleadoBroker;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class AuditController extends Controller
{
    /**
     * Lista de logs de auditoría con filtros
     */
    public function getAuditLogs(Request $request)
    {
        $brokerId = $request->get('authenticated_broker_id') ?? $request->get('broker_id');
        $perPage = (int) ($request->query('per_page', 50));
        $userId = $request->query('user_id');
        $module = $request->query('module');
        $action = $request->query('action');
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');

        $query = AuditLog::where('broker_id', $brokerId)
            ->orderBy('created_at', 'desc');

        if ($userId) {
            $query->where('user_id', $userId);
        }
        if ($module) {
            $query->where('module', $module);
        }
        if ($action) {
            $query->where('action', 'like', "%{$action}%");
        }
        if ($dateFrom) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }
        if ($dateTo) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        $logs = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $logs->items(),
            'pagination' => [
                'current_page' => $logs->currentPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
                'last_page' => $logs->lastPage(),
            ],
        ]);
    }

    /**
     * Estadísticas generales de auditoría
     */
    public function getAuditStats(Request $request)
    {
        $brokerId = $request->get('authenticated_broker_id') ?? $request->get('broker_id');
        $days = (int) ($request->query('days', 30));
        $startDate = Carbon::now()->subDays($days);

        // Total de acciones
        $totalActions = AuditLog::where('broker_id', $brokerId)
            ->where('created_at', '>=', $startDate)
            ->count();

        // Acciones por módulo
        $actionsByModule = AuditLog::where('broker_id', $brokerId)
            ->where('created_at', '>=', $startDate)
            ->select('module', DB::raw('count(*) as total'))
            ->groupBy('module')
            ->orderByDesc('total')
            ->limit(10)
            ->get();

        // Acciones por día
        $actionsByDay = AuditLog::where('broker_id', $brokerId)
            ->where('created_at', '>=', $startDate)
            ->select(DB::raw('DATE(created_at) as date'), DB::raw('count(*) as total'))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // Top usuarios activos
        $topUsers = AuditLog::where('broker_id', $brokerId)
            ->where('created_at', '>=', $startDate)
            ->whereNotNull('user_id')
            ->select('user_id', 'user_type', DB::raw('count(*) as total_actions'))
            ->groupBy('user_id', 'user_type')
            ->orderByDesc('total_actions')
            ->limit(10)
            ->get()
            ->map(function ($item) {
                $user = null;
                $userName = "Usuario #{$item->user_id}";
                $userEmail = null;
                
                // Buscar en EmpleadoBroker primero
                $empleado = EmpleadoBroker::find($item->user_id);
                if ($empleado) {
                    $userName = trim("{$empleado->nombres} {$empleado->apellidos}");
                    $userEmail = $empleado->email;
                } else {
                    // Buscar en Users
                    $userModel = \App\Models\User::find($item->user_id);
                    if ($userModel) {
                        $userName = $userModel->name ?? $userModel->email;
                        $userEmail = $userModel->email;
                    }
                }
                
                return [
                    'user_id' => $item->user_id,
                    'user_type' => $item->user_type,
                    'user_name' => $userName,
                    'user_email' => $userEmail,
                    'total_actions' => $item->total_actions,
                ];
            });

        // Tipos de acciones más comunes
        $topActions = AuditLog::where('broker_id', $brokerId)
            ->where('created_at', '>=', $startDate)
            ->select('action', DB::raw('count(*) as total'))
            ->groupBy('action')
            ->orderByDesc('total')
            ->limit(10)
            ->get();

        // Usuarios únicos activos
        $uniqueUsers = AuditLog::where('broker_id', $brokerId)
            ->where('created_at', '>=', $startDate)
            ->whereNotNull('user_id')
            ->distinct('user_id')
            ->count('user_id');

        return response()->json([
            'success' => true,
            'stats' => [
                'total_actions' => $totalActions,
                'unique_users' => $uniqueUsers,
                'period_days' => $days,
                'actions_by_module' => $actionsByModule,
                'actions_by_day' => $actionsByDay,
                'top_users' => $topUsers,
                'top_actions' => $topActions,
            ],
        ]);
    }

    /**
     * Obtener actividad de un usuario específico
     */
    public function getUserActivity(Request $request, $userId)
    {
        $brokerId = $request->get('authenticated_broker_id') ?? $request->get('broker_id');
        $days = (int) ($request->query('days', 30));
        $startDate = Carbon::now()->subDays($days);

        // Info del usuario - buscar en EmpleadoBroker o User
        $user = EmpleadoBroker::where('broker_id', $brokerId)->find($userId);
        $userInfo = null;
        
        if ($user) {
            $userInfo = [
                'id' => $user->id,
                'nombres' => $user->nombres,
                'apellidos' => $user->apellidos,
                'email' => $user->email,
                'cargo' => $user->cargo,
                'estado' => $user->estado,
            ];
        } else {
            // Buscar en tabla User
            $userModel = \App\Models\User::where('broker_id', $brokerId)->find($userId);
            if ($userModel) {
                $userInfo = [
                    'id' => $userModel->id,
                    'nombres' => $userModel->name ?? 'Usuario',
                    'apellidos' => '',
                    'email' => $userModel->email,
                    'cargo' => $userModel->user_type ?? 'Propietario',
                    'estado' => 'activo',
                ];
            }
        }
        
        if (!$userInfo) {
            return response()->json(['success' => false, 'message' => 'Usuario no encontrado'], 404);
        }

        // Estadísticas del usuario
        $totalActions = AuditLog::where('broker_id', $brokerId)
            ->where('user_id', $userId)
            ->where('created_at', '>=', $startDate)
            ->count();

        $actionsByModule = AuditLog::where('broker_id', $brokerId)
            ->where('user_id', $userId)
            ->where('created_at', '>=', $startDate)
            ->select('module', DB::raw('count(*) as total'))
            ->groupBy('module')
            ->orderByDesc('total')
            ->get();

        $actionsByDay = AuditLog::where('broker_id', $brokerId)
            ->where('user_id', $userId)
            ->where('created_at', '>=', $startDate)
            ->select(DB::raw('DATE(created_at) as date'), DB::raw('count(*) as total'))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $recentActions = AuditLog::where('broker_id', $brokerId)
            ->where('user_id', $userId)
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get();

        // Último acceso
        $lastAccess = AuditLog::where('broker_id', $brokerId)
            ->where('user_id', $userId)
            ->where('action', 'like', '%login%')
            ->orderBy('created_at', 'desc')
            ->first();

        // IPs utilizadas
        $ipsUsed = AuditLog::where('broker_id', $brokerId)
            ->where('user_id', $userId)
            ->where('created_at', '>=', $startDate)
            ->whereNotNull('ip_address')
            ->select('ip_address', DB::raw('count(*) as total'), DB::raw('MAX(created_at) as last_used'))
            ->groupBy('ip_address')
            ->orderByDesc('total')
            ->limit(10)
            ->get();

        return response()->json([
            'success' => true,
            'user' => array_merge($userInfo, [
                'ultimo_acceso' => $lastAccess?->created_at,
            ]),
            'stats' => [
                'total_actions' => $totalActions,
                'period_days' => $days,
                'actions_by_module' => $actionsByModule,
                'actions_by_day' => $actionsByDay,
                'ips_used' => $ipsUsed,
            ],
            'recent_actions' => $recentActions,
        ]);
    }

    /**
     * Dashboard general de todos los usuarios
     */
    public function getUsersDashboard(Request $request)
    {
        $brokerId = $request->get('authenticated_broker_id') ?? $request->get('broker_id');
        $days = (int) ($request->query('days', 30));
        $startDate = Carbon::now()->subDays($days);

        $allUsers = collect();

        // Empleados del broker
        $empleados = EmpleadoBroker::where('broker_id', $brokerId)
            ->where('estado', 'activo')
            ->get()
            ->map(function ($emp) use ($brokerId, $startDate) {
                $actions = AuditLog::where('broker_id', $brokerId)
                    ->where('user_id', $emp->id)
                    ->where('created_at', '>=', $startDate)
                    ->count();

                $lastAction = AuditLog::where('broker_id', $brokerId)
                    ->where('user_id', $emp->id)
                    ->orderBy('created_at', 'desc')
                    ->first();

                return [
                    'id' => $emp->id,
                    'nombres' => $emp->nombres,
                    'apellidos' => $emp->apellidos,
                    'email' => $emp->email,
                    'cargo' => $emp->cargo ?? 'Empleado',
                    'departamento' => $emp->departamento,
                    'total_actions' => $actions,
                    'last_activity' => $lastAction?->created_at,
                    'last_action' => $lastAction?->action,
                    'last_module' => $lastAction?->module,
                    'user_type' => 'empleado',
                ];
            });
        
        $allUsers = $allUsers->merge($empleados);

        // Usuarios (propietarios/masters) del broker
        $users = \App\Models\User::where('broker_id', $brokerId)
            ->where('status', 'active')
            ->get()
            ->map(function ($user) use ($brokerId, $startDate) {
                $actions = AuditLog::where('broker_id', $brokerId)
                    ->where('user_id', $user->id)
                    ->where('created_at', '>=', $startDate)
                    ->count();

                $lastAction = AuditLog::where('broker_id', $brokerId)
                    ->where('user_id', $user->id)
                    ->orderBy('created_at', 'desc')
                    ->first();

                return [
                    'id' => $user->id,
                    'nombres' => $user->name ?? 'Usuario',
                    'apellidos' => '',
                    'email' => $user->email,
                    'cargo' => $user->user_type === 'MASTER' ? 'Propietario' : ($user->user_type ?? 'Usuario'),
                    'departamento' => 'Administración',
                    'total_actions' => $actions,
                    'last_activity' => $lastAction?->created_at,
                    'last_action' => $lastAction?->action,
                    'last_module' => $lastAction?->module,
                    'user_type' => 'user',
                ];
            });
        
        $allUsers = $allUsers->merge($users);

        // Ordenar por acciones
        $employees = $allUsers->sortByDesc('total_actions')->values();

        // Resumen general
        $totalEmployees = $employees->count();
        $activeEmployees = $employees->filter(fn($e) => $e['total_actions'] > 0)->count();
        $inactiveEmployees = $totalEmployees - $activeEmployees;
        $totalActions = $employees->sum('total_actions');
        $avgActionsPerUser = $activeEmployees > 0 ? round($totalActions / $activeEmployees, 1) : 0;

        return response()->json([
            'success' => true,
            'summary' => [
                'total_employees' => $totalEmployees,
                'active_employees' => $activeEmployees,
                'inactive_employees' => $inactiveEmployees,
                'total_actions' => $totalActions,
                'avg_actions_per_user' => $avgActionsPerUser,
                'period_days' => $days,
            ],
            'employees' => $employees,
        ]);
    }

    /**
     * Crea un registro de auditoría
     */
    public function createAuditLog(Request $request)
    {
        $brokerId = $request->get('authenticated_broker_id') ?? $request->get('broker_id');
        
        $log = AuditLog::create([
            'broker_id' => $brokerId,
            'user_id' => $request->input('user_id'),
            'user_type' => $request->input('user_type'),
            'action' => $request->input('action'),
            'module' => $request->input('module'),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'path' => $request->input('path'),
            'method' => $request->input('method'),
            'request_payload' => $request->input('payload'),
            'response_status' => $request->input('status'),
            'metadata' => $request->input('metadata'),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Registro de auditoría creado.',
            'log' => $log,
        ]);
    }

    /**
     * Exportar logs de auditoría
     */
    public function exportAuditLogs(Request $request)
    {
        $brokerId = $request->get('authenticated_broker_id') ?? $request->get('broker_id');
        $dateFrom = $request->query('date_from', Carbon::now()->subDays(30)->toDateString());
        $dateTo = $request->query('date_to', Carbon::now()->toDateString());

        $logs = AuditLog::where('broker_id', $brokerId)
            ->whereDate('created_at', '>=', $dateFrom)
            ->whereDate('created_at', '<=', $dateTo)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $logs,
            'export_info' => [
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'total_records' => $logs->count(),
            ],
        ]);
    }

    /**
     * Alertas de seguridad
     */
    public function getSecurityAlerts(Request $request)
    {
        $brokerId = $request->get('authenticated_broker_id') ?? $request->get('broker_id');
        $days = (int) ($request->query('days', 7));
        $startDate = Carbon::now()->subDays($days);

        // Intentos de login fallidos
        $failedLogins = AuditLog::where('broker_id', $brokerId)
            ->where('created_at', '>=', $startDate)
            ->where('action', 'like', '%login_failed%')
            ->count();

        // Accesos desde IPs nuevas
        $newIps = AuditLog::where('broker_id', $brokerId)
            ->where('created_at', '>=', $startDate)
            ->whereNotNull('ip_address')
            ->select('ip_address', 'user_id', DB::raw('MIN(created_at) as first_seen'))
            ->groupBy('ip_address', 'user_id')
            ->havingRaw('MIN(created_at) >= ?', [$startDate])
            ->get();

        // Actividad fuera de horario (antes de 6am o después de 10pm)
        $offHoursActivity = AuditLog::where('broker_id', $brokerId)
            ->where('created_at', '>=', $startDate)
            ->whereRaw('HOUR(created_at) < 6 OR HOUR(created_at) >= 22')
            ->count();

        return response()->json([
            'success' => true,
            'alerts' => [
                'failed_logins' => $failedLogins,
                'new_ips_count' => $newIps->count(),
                'new_ips' => $newIps,
                'off_hours_activity' => $offHoursActivity,
                'period_days' => $days,
            ],
        ]);
    }
}