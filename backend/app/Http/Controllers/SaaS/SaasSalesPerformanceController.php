<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\SalesPerformance;
use App\Models\User;
use App\Models\SalesTeam;
use App\Models\SalesTeamMember;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;

class SaasSalesPerformanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brokerId = $request->user()->broker_id;
        $query = SalesPerformance::forBroker($brokerId)->with('user');

        if ($request->filled('period')) {
            $query->where('period', $request->period);
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->filled('month') && $request->filled('year')) {
            $query->where('month', $request->month)->where('year', $request->year);
        }

        $performances = $query->orderBy('ranking')->paginate($request->get('per_page', 15));

        return response()->json($performances);
    }

    public function store(Request $request): JsonResponse
    {
        $brokerId = $request->user()->broker_id;
        $validated = $request->validate([
            'user_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id')->where(fn($q) => $q->where('broker_id', $brokerId)),
            ],
            'period' => 'required|string',
            'month' => 'required|integer|min:1|max:12',
            'year' => 'required|integer|min:2020|max:2030',
            'sales_current_month' => 'nullable|numeric|min:0',
            'sales_previous_month' => 'nullable|numeric|min:0',
            'monthly_goal' => 'nullable|numeric|min:0',
            'fulfillment_percentage' => 'nullable|numeric|min:0|max:100',
            'commissions' => 'nullable|numeric|min:0',
            'new_clients' => 'nullable|integer|min:0',
            'calls' => 'nullable|integer|min:0',
            'meetings' => 'nullable|integer|min:0',
            'proposals' => 'nullable|integer|min:0',
            'conversion_rate' => 'nullable|numeric|min:0|max:100',
            'average_ticket' => 'nullable|numeric|min:0',
            'ranking' => 'nullable|integer|min:1',
            'notes' => 'nullable|string',
        ]);

        $validated['broker_id'] = $brokerId;

        // Calcular fulfillment_percentage si no se proporciona
        if (!isset($validated['fulfillment_percentage']) && isset($validated['sales_current_month']) && isset($validated['monthly_goal']) && $validated['monthly_goal'] > 0) {
            $validated['fulfillment_percentage'] = ($validated['sales_current_month'] / $validated['monthly_goal']) * 100;
        }

        $performance = SalesPerformance::create($validated);
        return response()->json(['message' => 'Métrica de rendimiento creada', 'data' => $performance->load('user')], 201);
    }

    public function show(Request $request, SalesPerformance $performance): JsonResponse
    {
        $this->authorizePerformance($request, $performance);
        return response()->json($performance->load('user'));
    }

    public function update(Request $request, SalesPerformance $performance): JsonResponse
    {
        $this->authorizePerformance($request, $performance);
        $brokerId = $request->user()->broker_id;
        $validated = $request->validate([
            'user_id' => [
                'sometimes',
                'integer',
                Rule::exists('users', 'id')->where(fn($q) => $q->where('broker_id', $brokerId)),
            ],
            'period' => 'sometimes|required|string',
            'month' => 'sometimes|required|integer|min:1|max:12',
            'year' => 'sometimes|required|integer|min:2020|max:2030',
            'sales_current_month' => 'nullable|numeric|min:0',
            'sales_previous_month' => 'nullable|numeric|min:0',
            'monthly_goal' => 'nullable|numeric|min:0',
            'fulfillment_percentage' => 'nullable|numeric|min:0|max:100',
            'commissions' => 'nullable|numeric|min:0',
            'new_clients' => 'nullable|integer|min:0',
            'calls' => 'nullable|integer|min:0',
            'meetings' => 'nullable|integer|min:0',
            'proposals' => 'nullable|integer|min:0',
            'conversion_rate' => 'nullable|numeric|min:0|max:100',
            'average_ticket' => 'nullable|numeric|min:0',
            'ranking' => 'nullable|integer|min:1',
            'notes' => 'nullable|string',
        ]);

        // Recalcular fulfillment_percentage si se actualizan ventas o meta
        if ((isset($validated['sales_current_month']) || isset($validated['monthly_goal'])) &&
            (!isset($validated['fulfillment_percentage']))) {
            $sales = $validated['sales_current_month'] ?? $performance->sales_current_month;
            $goal = $validated['monthly_goal'] ?? $performance->monthly_goal;
            if ($goal > 0) {
                $validated['fulfillment_percentage'] = ($sales / $goal) * 100;
            }
        }

        $performance->update($validated);
        return response()->json(['message' => 'Métrica de rendimiento actualizada', 'data' => $performance->load('user')]);
    }

    public function destroy(Request $request, SalesPerformance $performance): JsonResponse
    {
        $this->authorizePerformance($request, $performance);
        $performance->delete();
        return response()->json(['message' => 'Métrica de rendimiento eliminada']);
    }

    public function calculateMetrics(Request $request): JsonResponse
    {
        $brokerId = $request->user()->broker_id;
        $period = $request->get('period', date('Y-m'));
        $month = $request->get('month', (int)date('m'));
        $year = $request->get('year', (int)date('Y'));

        // Obtener todos los usuarios activos del broker
        $users = User::where('broker_id', $brokerId)->where('status', 'active')->get();

        $calculated = [];
        foreach ($users as $user) {
            // Aquí irían los cálculos basados en leads, pólizas, etc.
            // Por ahora, crear métricas básicas
            $performance = SalesPerformance::firstOrNew([
                'broker_id' => $brokerId,
                'user_id' => $user->id,
                'period' => $period,
            ]);

            if (!$performance->exists) {
                $performance->fill([
                    'month' => $month,
                    'year' => $year,
                    'sales_current_month' => 0,
                    'sales_previous_month' => 0,
                    'monthly_goal' => 0,
                    'fulfillment_percentage' => 0,
                    'commissions' => 0,
                    'new_clients' => 0,
                    'calls' => 0,
                    'meetings' => 0,
                    'proposals' => 0,
                    'conversion_rate' => 0,
                    'average_ticket' => 0,
                ]);
                $performance->save();
            }

            $calculated[] = $performance->load('user');
        }

        return response()->json([
            'message' => 'Métricas calculadas',
            'data' => $calculated
        ]);
    }

    public function topPerformers(Request $request): JsonResponse
    {
        $brokerId = $request->user()->broker_id;
        $period = $request->get('period', date('Y-m'));
        $limit = $request->get('limit', 10);

        $topPerformers = SalesPerformance::forBroker($brokerId)
            ->forPeriod($period)
            ->with('user')
            ->orderBy('fulfillment_percentage', 'desc')
            ->orderBy('sales_current_month', 'desc')
            ->limit($limit)
            ->get();

        // Asignar rankings
        $topPerformers->each(function ($performance, $index) {
            $performance->ranking = $index + 1;
            $performance->save();
        });

        return response()->json($topPerformers);
    }

    public function getMetrics(Request $request): JsonResponse
    {
        $brokerId = $request->user()->broker_id;
        $period = $request->get('period', 'month');

        // Calcular métricas generales
        $query = SalesPerformance::forBroker($brokerId);

        if ($period === 'month') {
            $query->where('period', date('Y-m'));
        } elseif ($period === 'week') {
            // Lógica para semana actual
            $query->where('period', date('Y-m'));
        } elseif ($period === 'year') {
            $query->where('year', date('Y'));
        }

        $performances = $query->get();

        $totalSales = $performances->sum('sales_current_month');
        $totalGoals = $performances->sum('monthly_goal');
        $activeAgents = $performances->where('fulfillment_percentage', '>', 0)->count();
        $activeTeams = SalesTeam::forBroker($brokerId)->count();

        return response()->json([
            'total_sales' => $totalSales,
            'total_goals' => $totalGoals,
            'achievement_rate' => $totalGoals > 0 ? ($totalSales / $totalGoals) * 100 : 0,
            'active_agents' => $activeAgents,
            'active_teams' => $activeTeams,
            'period' => $period
        ]);
    }

    public function getAgentsPerformance(Request $request): JsonResponse
    {
        $brokerId = $request->user()->broker_id;
        $period = $request->get('period', 'month');
        $limit = $request->get('limit', 10);
        $sortBy = $request->get('sort_by', 'monthly_sales');

        $query = SalesPerformance::forBroker($brokerId)->with('user');

        if ($period === 'month') {
            $query->where('period', date('Y-m'));
        } elseif ($period === 'week') {
            $query->where('period', date('Y-m'));
        } elseif ($period === 'year') {
            $query->where('year', date('Y'));
        }

        if ($request->filled('team_id')) {
            // Filtrar por miembros del equipo
            $teamMembers = SalesTeamMember::where('team_id', $request->team_id)->pluck('user_id');
            $query->whereIn('user_id', $teamMembers);
        }

        // Ordenar
        switch ($sortBy) {
            case 'monthly_sales':
                $query->orderBy('sales_current_month', 'desc');
                break;
            case 'achievement':
                $query->orderBy('fulfillment_percentage', 'desc');
                break;
            case 'conversion_rate':
                $query->orderBy('conversion_rate', 'desc');
                break;
            default:
                $query->orderBy('sales_current_month', 'desc');
        }

        $performances = $query->limit($limit)->get();

        $result = $performances->map(function ($performance, $index) {
            return [
                'id' => $performance->user_id,
                'name' => $performance->user->name ?? 'Usuario ' . $performance->user_id,
                'email' => $performance->user->email ?? '',
                'monthly_sales' => $performance->sales_current_month ?? 0,
                'monthly_goal' => $performance->monthly_goal ?? 0,
                'achievement_percentage' => $performance->fulfillment_percentage ?? 0,
                'commission_earned' => $performance->commissions ?? 0,
                'new_clients' => $performance->new_clients ?? 0,
                'calls_made' => $performance->calls ?? 0,
                'meetings_scheduled' => $performance->meetings ?? 0,
                'proposals_sent' => $performance->proposals ?? 0,
                'conversion_rate' => $performance->conversion_rate ?? 0,
                'status' => 'active'
            ];
        });

        return response()->json($result);
    }

    public function getTeamsPerformance(Request $request): JsonResponse
    {
        $brokerId = $request->user()->broker_id;
        $period = $request->get('period', 'month');
        $limit = $request->get('limit', 10);

        $teams = SalesTeam::forBroker($brokerId)->with(['members.user', 'leader'])->get();

        $result = $teams->map(function ($team) use ($period) {
            $members = $team->members ?? [];
            $teamPerformances = SalesPerformance::whereIn('user_id', $members->pluck('user_id'))
                ->when($period === 'month', fn($q) => $q->where('period', date('Y-m')))
                ->when($period === 'year', fn($q) => $q->where('year', date('Y')))
                ->get();

            $totalSales = $teamPerformances->sum('sales_current_month');
            $totalGoals = $teamPerformances->sum('monthly_goal');
            $avgConversion = $teamPerformances->avg('conversion_rate') ?? 0;

            $topPerformer = $teamPerformances->sortByDesc('sales_current_month')->first();

            return [
                'id' => $team->id,
                'name' => $team->name,
                'leader_name' => $team->leader->name ?? 'Sin líder',
                'total_members' => $members->count(),
                'team_sales' => $totalSales,
                'team_goal' => $totalGoals,
                'achievement_percentage' => $totalGoals > 0 ? ($totalSales / $totalGoals) * 100 : 0,
                'average_conversion' => $avgConversion,
                'top_performer' => $topPerformer ? ($topPerformer->user->name ?? 'N/A') : 'N/A'
            ];
        })->sortByDesc('team_sales')->take($limit);

        return response()->json($result->values());
    }

    public function getStatistics(Request $request): JsonResponse
    {
        $brokerId = $request->user()->broker_id;
        $period = $request->get('period', 'month');

        $query = SalesPerformance::forBroker($brokerId);

        if ($period === 'month') {
            $query->where('period', date('Y-m'));
        } elseif ($period === 'year') {
            $query->where('year', date('Y'));
        }

        $performances = $query->get();

        $totalRevenue = $performances->sum('sales_current_month');
        $totalCommissions = $performances->sum('commissions');
        $avgConversionRate = $performances->avg('conversion_rate') ?? 0;

        $topPerformer = $performances->sortByDesc('sales_current_month')->first();
        // Obtener equipos como array desde la respuesta JSON
        $teamsResponse = $this->getTeamsPerformance($request);
        $teamsData = $teamsResponse->getData(true);
        $topTeam = $teamsData[0] ?? null;

        $currentMonth = $performances->sum('sales_current_month');
        $previousMonth = SalesPerformance::forBroker($brokerId)
            ->where('period', date('Y-m', strtotime('-1 month')))
            ->sum('sales_current_month');

        $salesGrowth = $previousMonth > 0 ? (($currentMonth - $previousMonth) / $previousMonth) * 100 : 0;

        return response()->json([
            'period' => $period === 'month' ? date('F Y') : date('Y'),
            'total_revenue' => $totalRevenue,
            'total_commissions' => $totalCommissions,
            'average_conversion_rate' => $avgConversionRate,
            'top_performing_agent' => $topPerformer ? [
                'id' => $topPerformer->user_id,
                'name' => $topPerformer->user->name ?? 'N/A',
                'monthly_sales' => $topPerformer->sales_current_month ?? 0,
                'achievement_percentage' => $topPerformer->fulfillment_percentage ?? 0
            ] : null,
            'top_performing_team' => $topTeam,
            'trends' => [
                'sales_growth' => $salesGrowth,
                'conversion_improvement' => 0, // Placeholder
                'new_clients_growth' => 0 // Placeholder
            ]
        ]);
    }

    public function exportPerformance(Request $request): JsonResponse
    {
        $brokerId = $request->user()->broker_id;
        $period = $request->get('period', 'month');
        $format = $request->get('format', 'csv');

        $query = SalesPerformance::forBroker($brokerId)->with('user');

        if ($period === 'month') {
            $query->where('period', date('Y-m'));
        } elseif ($period === 'year') {
            $query->where('year', date('Y'));
        }

        $performances = $query->get();

        $data = $performances->map(function ($performance) {
            return [
                'Nombre' => $performance->user->name ?? 'N/A',
                'Email' => $performance->user->email ?? '',
                'Ventas del Mes' => $performance->sales_current_month ?? 0,
                'Meta del Mes' => $performance->monthly_goal ?? 0,
                'Cumplimiento (%)' => $performance->fulfillment_percentage ?? 0,
                'Comisiones' => $performance->commissions ?? 0,
                'Nuevos Clientes' => $performance->new_clients ?? 0,
                'Llamadas' => $performance->calls ?? 0,
                'Reuniones' => $performance->meetings ?? 0,
                'Propuestas' => $performance->proposals ?? 0,
                'Tasa Conversión (%)' => $performance->conversion_rate ?? 0,
                'Ranking' => $performance->ranking ?? 0
            ];
        });

        // Aquí iría la lógica para generar CSV/Excel
        // Por ahora, devolver los datos
        return response()->json([
            'message' => 'Export data prepared',
            'data' => $data,
            'format' => $format
        ]);
    }

    private function authorizePerformance(Request $request, SalesPerformance $performance): void
    {
        if ($performance->broker_id !== ($request->user()->broker_id ?? 0)) {
            abort(403, 'Acceso denegado');
        }
    }
}