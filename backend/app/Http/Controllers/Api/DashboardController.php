<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Broker;
use App\Models\Cliente;
use App\Models\Poliza;
use App\Models\Siniestro;
use App\Models\CommercialTask;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Configurar Carbon en español
Carbon::setLocale('es');

class DashboardController extends Controller
{
    /**
     * Obtener datos del dashboard para el broker autenticado
     */
    public function getDashboardData(Request $request)
    {
        try {
            $user = $request->user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario no autenticado'
                ], 401);
            }
            
            // Obtener el broker del usuario
            $broker = $user->getPrimaryBroker();
            
            if (!$broker) {
                return response()->json([
                    'success' => false,
                    'message' => 'Usuario no tiene broker asignado',
                    'needs_onboarding' => true
                ], 403);
            }
            
            // Obtener filtros de fecha si existen
            $startDate = $request->get('start_date');
            $endDate = $request->get('end_date');
            
            Log::info('🏢 Dashboard data request', [
                'user_id' => $user->id,
                'broker_id' => $broker->id,
                'broker_name' => $broker->name,
                'start_date' => $startDate,
                'end_date' => $endDate
            ]);
            
            // Query base para pólizas con filtro de fecha opcional
            $polizaQuery = Poliza::where('broker_id', $broker->id);
            if ($startDate && $endDate) {
                $polizaQuery->where(function($q) use ($startDate, $endDate) {
                    $q->whereBetween(DB::raw('COALESCE(issue_date, start_date, created_at)'), [$startDate, $endDate]);
                });
            }
            
            // OPTIMIZACIÓN: Estadísticas de pólizas en una sola consulta
            $polizaStats = (clone $polizaQuery)
                ->selectRaw('
                    COUNT(*) as total_polizas,
                    COUNT(CASE WHEN status = "active" THEN 1 END) as polizas_activas,
                    COUNT(CASE WHEN status = "expired" THEN 1 END) as polizas_vencidas,
                    COUNT(CASE WHEN status = "cancelled" THEN 1 END) as polizas_canceladas,
                    COUNT(CASE WHEN status = "active" AND end_date <= DATE_ADD(NOW(), INTERVAL 30 DAY) THEN 1 END) as polizas_por_vencer,
                    SUM(CASE WHEN status = "active" THEN premium_amount ELSE 0 END) as valor_total_primas,
                    SUM(CASE WHEN status = "active" THEN commission_amount ELSE 0 END) as comision_total,
                    SUM(CASE WHEN status = "active" THEN insured_amount ELSE 0 END) as valor_total_asegurado
                ')
                ->first();

            // Query base para clientes con filtro de fecha opcional
            $clienteQuery = Cliente::where('broker_id', $broker->id);
            if ($startDate && $endDate) {
                $clienteQuery->whereBetween('created_at', [$startDate, $endDate]);
            }

            // OPTIMIZACIÓN: Estadísticas de clientes en una sola consulta
            $clienteStats = (clone $clienteQuery)
                ->selectRaw('
                    COUNT(*) as total_clientes,
                    COUNT(CASE WHEN status = "active" THEN 1 END) as clientes_activos,
                    COUNT(CASE WHEN status = "prospect" THEN 1 END) as clientes_prospectos
                ')
                ->first();

            // Query base para siniestros con filtro de fecha opcional
            $siniestroStats = ['total_siniestros' => 0, 'siniestros_pendientes' => 0, 'siniestros_aprobados' => 0];
            if (class_exists('App\Models\Siniestro')) {
                $siniestroQuery = Siniestro::where('broker_id', $broker->id);
                if ($startDate && $endDate) {
                    $siniestroQuery->whereBetween('created_at', [$startDate, $endDate]);
                }
                
                $siniestroStats = $siniestroQuery
                    ->selectRaw('
                        COUNT(*) as total_siniestros,
                        COUNT(CASE WHEN estado IN ("reportado", "en_revision", "asignado", "investigacion", "peritaje") THEN 1 END) as siniestros_pendientes,
                        COUNT(CASE WHEN estado IN ("aprobado", "pagado") THEN 1 END) as siniestros_aprobados
                    ')
                    ->first();
            }

            // Extraer valores de las estadísticas optimizadas
            $totalPolizas = (int) $polizaStats->total_polizas;
            $polizasActivas = (int) $polizaStats->polizas_activas;
            $polizasVencidas = (int) $polizaStats->polizas_vencidas;
            $polizasCanceladas = (int) $polizaStats->polizas_canceladas;
            $polizasPorVencer = (int) $polizaStats->polizas_por_vencer;
            $valorTotalPrimas = (float) $polizaStats->valor_total_primas;
            $comisionTotal = (float) $polizaStats->comision_total;
            $valorTotalAsegurado = (float) $polizaStats->valor_total_asegurado;

            $totalClientes = (int) $clienteStats->total_clientes;
            $clientesActivos = (int) $clienteStats->clientes_activos;
            $clientesProspectos = (int) $clienteStats->clientes_prospectos;

            $totalSiniestros = (int) $siniestroStats->total_siniestros;
            $siniestrosPendientes = (int) $siniestroStats->siniestros_pendientes;
            $siniestrosAprobados = (int) $siniestroStats->siniestros_aprobados;
            
            // Distribución por tipo de póliza con filtro de fecha
            $polizasPorTipoQuery = Poliza::where('broker_id', $broker->id);
            if ($startDate && $endDate) {
                $polizasPorTipoQuery->where(function($q) use ($startDate, $endDate) {
                    $q->whereBetween(DB::raw('COALESCE(issue_date, start_date, created_at)'), [$startDate, $endDate]);
                });
            }
            
            $polizasPorTipo = $polizasPorTipoQuery
                ->selectRaw('type, COUNT(*) as total')
                ->groupBy('type')
                ->get()
                ->mapWithKeys(function ($item) {
                    return [$item->type => $item->total];
                });
            
            // Pólizas recientes con filtro de fecha
            $polizasRecientesQuery = Poliza::where('broker_id', $broker->id);
            if ($startDate && $endDate) {
                $polizasRecientesQuery->where(function($q) use ($startDate, $endDate) {
                    $q->whereBetween(DB::raw('COALESCE(issue_date, start_date, created_at)'), [$startDate, $endDate]);
                });
            }
            
            $polizasRecientes = $polizasRecientesQuery
                ->with('client')
                ->orderBy('created_at', 'desc')
                ->limit(5)
                ->get()
                ->map(function ($poliza) {
                    return [
                        'id' => $poliza->id,
                        'policy_number' => $poliza->policy_number,
                        'product_name' => $poliza->product_name,
                        'client_name' => $poliza->client_name,
                        'premium_amount' => $poliza->premium_amount,
                        'status' => $poliza->status,
                        'insurance_company' => $poliza->insurance_company,
                        'created_at' => $poliza->created_at
                            ? ($poliza->created_at instanceof \Carbon\Carbon
                                ? $poliza->created_at->format('Y-m-d H:i:s')
                                : \Carbon\Carbon::parse($poliza->created_at)->format('Y-m-d H:i:s'))
                            : now()->format('Y-m-d H:i:s')
                    ];
                });
            
            // OPTIMIZACIÓN: Tareas comerciales y ventas en una sola consulta
            $tareasActivas = 0;
            if (class_exists('App\Models\CommercialTask')) {
                $tareasActivas = CommercialTask::where('broker_id', $broker->id)
                    ->where('status', '!=', 'completed')
                    ->count();
            }

            // OPTIMIZACIÓN: Ventas del mes actual y anterior con filtro de fecha
            $ventasQuery = Poliza::where('broker_id', $broker->id);
            if ($startDate && $endDate) {
                $ventasQuery->where(function($q) use ($startDate, $endDate) {
                    $q->whereBetween(DB::raw('COALESCE(issue_date, start_date, created_at)'), [$startDate, $endDate]);
                });
            }
            
            $ventasStats = (clone $ventasQuery)
                ->selectRaw('
                    COUNT(CASE WHEN MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) THEN 1 END) as ventas_del_mes,
                    COUNT(CASE WHEN MONTH(created_at) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND YEAR(created_at) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) THEN 1 END) as ventas_mes_anterior
                ')
                ->first();

            $ventasDelMes = (int) $ventasStats->ventas_del_mes;
            $ventasMesAnterior = (int) $ventasStats->ventas_mes_anterior;
            
            $crecimientoVentas = $ventasMesAnterior > 0 
                ? round((($ventasDelMes - $ventasMesAnterior) / $ventasMesAnterior) * 100, 1)
                : ($ventasDelMes > 0 ? 100 : 0);
            
            return response()->json([
                'success' => true,
                'data' => [
                    'broker' => [
                        'id' => $broker->id,
                        'name' => $broker->name,
                        'legal_name' => $broker->legal_name,
                        'status' => $broker->status,
                        'plan' => $broker->plan ?? 'basic'
                    ],
                    'resumen_polizas' => [
                        'total' => $totalPolizas,
                        'activas' => $polizasActivas,
                        'vencidas' => $polizasVencidas,
                        'canceladas' => $polizasCanceladas,
                        'por_vencer' => $polizasPorVencer
                    ],
                    'finanzas' => [
                        'valor_total_primas' => number_format($valorTotalPrimas, 2),
                        'comision_total' => number_format($comisionTotal, 2),
                        'valor_total_asegurado' => number_format($valorTotalAsegurado, 2),
                        'valor_primas_numero' => $valorTotalPrimas,
                        'comision_numero' => $comisionTotal,
                        'valor_asegurado_numero' => $valorTotalAsegurado
                    ],
                    'clientes' => [
                        'total' => $totalClientes,
                        'activos' => $clientesActivos,
                        'prospectos' => $clientesProspectos,
                        'porcentaje_crecimiento' => $totalClientes > 0 ? round(($clientesActivos / $totalClientes) * 100, 1) : 0
                    ],
                    'siniestros' => [
                        'total' => $totalSiniestros,
                        'pendientes' => $siniestrosPendientes,
                        'aprobados' => $siniestrosAprobados
                    ],
                    'polizas_por_tipo' => $polizasPorTipo,
                    'polizas_recientes' => $polizasRecientes,
                    'tareas_comerciales' => [
                        'activas' => $tareasActivas
                    ],
                    'ventas' => [
                        'del_mes' => $ventasDelMes,
                        'mes_anterior' => $ventasMesAnterior,
                        'crecimiento_porcentaje' => $crecimientoVentas
                    ],
                    'timestamp' => now()->toISOString()
                ]
            ]);
            
        } catch (\Exception $e) {
            Log::error('Error al obtener datos del dashboard', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener datos del dashboard: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Obtener métricas específicas del dashboard
     */
    public function getMetrics(Request $request)
    {
        try {
            $user = $request->user();
            $broker = $user->getPrimaryBroker();
            
            if (!$broker) {
                return response()->json([
                    'success' => false,
                    'message' => 'Broker no encontrado'
                ], 404);
            }
            
            // Métricas básicas
            $metrics = [
                'polizas_activas' => Poliza::where('broker_id', $broker->id)->where('status', 'active')->count(),
                'clientes_activos' => Cliente::where('broker_id', $broker->id)->where('status', 'active')->count(),
                'prima_total' => Poliza::where('broker_id', $broker->id)->where('status', 'active')->sum('premium_amount'),
                'comisiones_mes' => Poliza::where('broker_id', $broker->id)
                    ->where('status', 'active')
                    ->whereMonth('created_at', Carbon::now()->month)
                    ->sum('commission_amount')
            ];
            
            return response()->json([
                'success' => true,
                'metrics' => $metrics
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener métricas: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Primas por periodo (week|month|year) agregadas por fecha de emisión (fallback a created_at)
     * Devuelve labels y data para gráfico.
     */
    public function getPrimasChart(Request $request)
    {
        try {
            // Resolver broker para ambos tipos de sesión (Firebase User o Empleado)
            $broker = null;
            $authType = $request->get('auth_type');

            if ($authType === 'empleado') {
                $empleado = $request->get('authenticated_empleado');
                $brokerId = $request->get('authenticated_broker_id') ?? $request->get('broker_id') ?? ($empleado->broker_id ?? null);
                if ($brokerId) {
                    $broker = \App\Models\Broker::find((int) $brokerId);
                }
            } else {
                $user = $request->user() ?: $request->get('authenticated_user');
                if ($user && method_exists($user, 'getPrimaryBroker')) {
                    $broker = $user->getPrimaryBroker();
                }
                if (!$broker) {
                    $brokerId = $request->get('authenticated_broker_id') ?? $request->get('broker_id');
                    if ($brokerId) {
                        $broker = \App\Models\Broker::find((int) $brokerId);
                    }
                }
            }

            if (!$broker) {
                return response()->json([
                    'success' => false,
                    'message' => 'Broker no encontrado'
                ], 404);
            }

            $period = $request->get('period', 'month'); // week | month | year
            
            // Verificar si hay fechas personalizadas
            $customStartDate = $request->get('start_date');
            $customEndDate = $request->get('end_date');

            // Rango de fechas según periodo o fechas personalizadas
            $now = Carbon::now();
            
            if ($customStartDate && $customEndDate) {
                // Usar fechas personalizadas del calendario
                $start = Carbon::parse($customStartDate)->startOfDay();
                $end = Carbon::parse($customEndDate)->endOfDay();
                
                // Determinar intervalo basado en el rango de días
                $daysDiff = $start->diffInDays($end);
                if ($daysDiff <= 7) {
                    $interval = 'day';
                } elseif ($daysDiff <= 90) {
                    $interval = 'week';
                } else {
                    $interval = 'month';
                }
            } elseif ($period === 'week') {
                $start = $now->copy()->startOfWeek();
                $end = $now->copy()->endOfWeek();
                $interval = 'day';
            } elseif ($period === 'year') {
                $start = $now->copy()->startOfYear();
                $end = $now->copy()->endOfYear();
                $interval = 'month';
            } else { // month => últimos 12 meses
                $start = $now->copy()->subMonthsNoOverflow(11)->startOfMonth();
                $end = $now->copy()->endOfMonth();
                $interval = 'month';
            }

            // Construir buckets vacíos para asegurar continuidad de fechas
            $buckets = [];
            $cursor = $start->copy();
            while ($cursor <= $end) {
                if ($interval === 'day') {
                    $key = $cursor->format('Y-m-d');
                    $label = $cursor->translatedFormat('D d');
                    $cursor->addDay();
                } elseif ($interval === 'week') {
                    $key = $cursor->format('Y-W');
                    $label = 'Sem ' . $cursor->format('W');
                    $cursor->addWeek();
                } else { // month
                    $key = $cursor->format('Y-m');
                    $label = $cursor->translatedFormat('M Y');
                    $cursor->addMonthNoOverflow();
                }
                $buckets[$key] = ['label' => $label, 'value' => 0];
            }

            // Agregar primas usando issue_date si existe, si no start_date, si no created_at
            $usePrimaNeta = Schema::hasColumn('polizas', 'prima_neta');
            // Métrica neta: prima_neta si existe; si no, total_amount - vat_amount; si tampoco, premium_amount
            $sumExpr = $usePrimaNeta
                ? 'SUM(prima_neta)'
                : 'SUM(COALESCE(total_amount - COALESCE(vat_amount,0), premium_amount))';

            $rows = Poliza::query()
                ->selectRaw(
                    "COALESCE(DATE_FORMAT(issue_date, '%Y-%m-%d'), DATE_FORMAT(start_date, '%Y-%m-%d'), DATE_FORMAT(created_at, '%Y-%m-%d')) as f, {$sumExpr} as total"
                )
                ->where('broker_id', $broker->id)
                ->where('status', 'active')
                ->where(function($q) use ($start, $end) {
                    $q->whereBetween(DB::raw('COALESCE(issue_date, start_date, created_at)'), [$start->toDateString(), $end->toDateString()]);
                })
                ->groupBy('f')
                ->orderBy('f')
                ->get();

            foreach ($rows as $row) {
                $date = Carbon::parse($row->f);
                if ($interval === 'day') {
                    $key = $date->format('Y-m-d');
                } elseif ($interval === 'week') {
                    $key = $date->format('Y-W');
                } else {
                    $key = $date->format('Y-m');
                }
                if (isset($buckets[$key])) {
                    $buckets[$key]['value'] += (float) $row->total;
                }
            }

            $labels = array_values(array_map(fn($b) => $b['label'], $buckets));
            $data = array_values(array_map(fn($b) => round($b['value'], 2), $buckets));

            return response()->json([
                'success' => true,
                'data' => [
                    'labels' => $labels,
                    'data' => $data,
                    'start' => $start->toDateString(),
                    'end' => $end->toDateString(),
                    'period' => $period,
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener primas por periodo: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Clientes por periodo (week|month|year) - devuelve labels y data (conteo)
     */
    public function getClientesChart(Request $request)
    {
        try {
            $user = $request->user();
            if (!$user) {
                return response()->json(['success' => false, 'message' => 'No autenticado'], 401);
            }
            $broker = $user->getPrimaryBroker();
            if (!$broker) {
                return response()->json(['success' => false, 'message' => 'Broker no encontrado'], 404);
            }

            $period = $request->get('period', 'month'); // week | month | year

            $now = Carbon::now();
            if ($period === 'week') {
                $start = $now->copy()->startOfWeek();
                $end = $now->copy()->endOfWeek();
                $interval = 'day';
            } elseif ($period === 'year') {
                $start = $now->copy()->startOfYear();
                $end = $now->copy()->endOfYear();
                $interval = 'month';
            } else { // month => últimos 12 meses
                $start = $now->copy()->subMonthsNoOverflow(11)->startOfMonth();
                $end = $now->copy()->endOfMonth();
                $interval = 'month';
            }

            // Buckets
            $buckets = [];
            $cursor = $start->copy();
            while ($cursor <= $end) {
                if ($interval === 'day') {
                    $key = $cursor->format('Y-m-d');
                    $label = $cursor->translatedFormat('D d');
                    $cursor->addDay();
                } else {
                    $key = $cursor->format('Y-m');
                    $label = $cursor->translatedFormat('M Y');
                    $cursor->addMonthNoOverflow();
                }
                $buckets[$key] = ['label' => $label, 'value' => 0];
            }

            $rows = Cliente::query()
                ->selectRaw("DATE_FORMAT(COALESCE(created_at, NOW()), '%Y-%m-%d') as f, COUNT(*) as total")
                ->where('broker_id', $broker->id)
                ->whereBetween(DB::raw('DATE(COALESCE(created_at, NOW()))'), [$start->toDateString(), $end->toDateString()])
                ->groupBy('f')
                ->orderBy('f')
                ->get();

            foreach ($rows as $row) {
                $date = Carbon::parse($row->f);
                $key = $interval === 'day' ? $date->format('Y-m-d') : $date->format('Y-m');
                if (isset($buckets[$key])) {
                    $buckets[$key]['value'] = (int) $row->total;
                }
            }

            $labels = array_values(array_map(fn($b) => $b['label'], $buckets));
            $data = array_values(array_map(fn($b) => (int) $b['value'], $buckets));

            return response()->json([
                'success' => true,
                'data' => [
                    'labels' => $labels,
                    'data' => $data,
                    'start' => $start->toDateString(),
                    'end' => $end->toDateString(),
                    'period' => $period,
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener clientes por periodo: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Pólizas por periodo (week|month|year) - devuelve labels y data (conteo)
     */
    public function getPolizasChart(Request $request)
    {
        try {
            $user = $request->user();
            if (!$user) {
                return response()->json(['success' => false, 'message' => 'No autenticado'], 401);
            }
            $broker = $user->getPrimaryBroker();
            if (!$broker) {
                return response()->json(['success' => false, 'message' => 'Broker no encontrado'], 404);
            }

            $period = $request->get('period', 'month'); // week | month | year

            $now = Carbon::now();
            if ($period === 'week') {
                $start = $now->copy()->startOfWeek();
                $end = $now->copy()->endOfWeek();
                $interval = 'day';
            } elseif ($period === 'year') {
                $start = $now->copy()->startOfYear();
                $end = $now->copy()->endOfYear();
                $interval = 'month';
            } else { // month => últimos 12 meses
                $start = $now->copy()->subMonthsNoOverflow(11)->startOfMonth();
                $end = $now->copy()->endOfMonth();
                $interval = 'month';
            }

            // Buckets
            $buckets = [];
            $cursor = $start->copy();
            while ($cursor <= $end) {
                if ($interval === 'day') {
                    $key = $cursor->format('Y-m-d');
                    $label = $cursor->translatedFormat('D d');
                    $cursor->addDay();
                } else {
                    $key = $cursor->format('Y-m');
                    $label = $cursor->translatedFormat('M Y');
                    $cursor->addMonthNoOverflow();
                }
                $buckets[$key] = ['label' => $label, 'value' => 0];
            }

            // Usar issue_date/start_date/created_at para bucketear
            $rows = Poliza::query()
                ->selectRaw("COALESCE(DATE_FORMAT(issue_date, '%Y-%m-%d'), DATE_FORMAT(start_date, '%Y-%m-%d'), DATE_FORMAT(created_at, '%Y-%m-%d')) as f, COUNT(*) as total")
                ->where('broker_id', $broker->id)
                ->where('status', 'active')
                ->where(function($q) use ($start, $end) {
                    $q->whereBetween(DB::raw('COALESCE(issue_date, start_date, created_at)'), [$start->toDateString(), $end->toDateString()]);
                })
                ->groupBy('f')
                ->orderBy('f')
                ->get();

            foreach ($rows as $row) {
                $date = Carbon::parse($row->f);
                $key = $interval === 'day' ? $date->format('Y-m-d') : $date->format('Y-m');
                if (isset($buckets[$key])) {
                    $buckets[$key]['value'] = (int) $row->total;
                }
            }

            $labels = array_values(array_map(fn($b) => $b['label'], $buckets));
            $data = array_values(array_map(fn($b) => (int) $b['value'], $buckets));

            return response()->json([
                'success' => true,
                'data' => [
                    'labels' => $labels,
                    'data' => $data,
                    'start' => $start->toDateString(),
                    'end' => $end->toDateString(),
                    'period' => $period,
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener pólizas por periodo: ' . $e->getMessage()
            ], 500);
        }
    }
}
