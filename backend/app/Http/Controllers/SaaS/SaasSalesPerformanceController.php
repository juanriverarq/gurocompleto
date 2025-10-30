<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\SalesPerformance;
use App\Models\User;
use App\Models\SalesTeam;
use App\Models\SalesTeamMember;
use App\Models\SalesFunnel;
use App\Models\Poliza;
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
    
        $now = now();
        if ($period === 'week') {
            $start = $now->copy()->startOfWeek();
            $end = $now->copy()->endOfWeek();
        } elseif ($period === 'year') {
            $start = $now->copy()->startOfYear();
            $end = $now->copy()->endOfYear();
        } else {
            $start = $now->copy()->startOfMonth();
            $end = $now->copy()->endOfMonth();
        }
    
        // Ventas reales desde pólizas o (fallback) embudo cerrado ganado
        $polizaSales = (float) Poliza::byBroker($brokerId)
            ->whereNotNull('assigned_user_id')
            ->whereBetween('issue_date', [$start->toDateString(), $end->toDateString()])
            ->sum(\DB::raw('COALESCE(total_amount, premium_amount, 0)'));
    
        $funnelSales = (float) SalesFunnel::forBroker($brokerId)
            ->where('stage', 'closed_won')
            ->whereBetween('closed_at', [$start, $end])
            ->sum(\DB::raw('COALESCE(final_value, potential_value, 0)'));
    
        $totalSales = $polizaSales > 0 ? $polizaSales : $funnelSales;
    
        // Metas del equipo desde miembros
        $totalGoals = (float) SalesTeamMember::whereHas('team', function($q) use ($brokerId) {
            $q->where('broker_id', $brokerId);
        })->sum('monthly_goal');
    
        // Vendedores activos (miembros no inactivos)
        $activeAgents = (int) SalesTeamMember::whereHas('team', function($q) use ($brokerId) {
            $q->where('broker_id', $brokerId);
        })->where('status', '!=', 'inactive')->count();
    
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
        $limit = (int) $request->get('limit', 10);
        $sortBy = $request->get('sort_by', 'monthly_sales');
        $teamId = $request->get('team_id');
    
        $membersQuery = SalesTeamMember::whereHas('team', function($q) use ($brokerId) {
            $q->where('broker_id', $brokerId);
        })->with(['user', 'vendedor', 'team']);
    
        if (!empty($teamId)) {
            $membersQuery->where('team_id', (int) $teamId);
        }
    
        $teamMembers = $membersQuery->get();
        if ($teamMembers->isEmpty()) {
            return response()->json([]);
        }
    
        $memberIds = $teamMembers->pluck('user_id')->filter()->unique()->values();
    
        $now = now();
        if ($period === 'week') {
            $start = $now->copy()->startOfWeek();
            $end = $now->copy()->endOfWeek();
        } elseif ($period === 'year') {
            $start = $now->copy()->startOfYear();
            $end = $now->copy()->endOfYear();
        } else {
            $start = $now->copy()->startOfMonth();
            $end = $now->copy()->endOfMonth();
        }
    
        // Agregados por agente desde Pólizas
        $polizaAgg = Poliza::byBroker($brokerId)
            ->whereNotNull('assigned_user_id')
            ->whereIn('assigned_user_id', $memberIds)
            ->whereBetween('issue_date', [$start->toDateString(), $end->toDateString()])
            ->selectRaw('assigned_user_id as user_id, SUM(COALESCE(total_amount, premium_amount, 0)) as sales, SUM(COALESCE(commission_amount, 0)) as commissions, COUNT(*) as policies, COUNT(DISTINCT client_id) as clients')
            ->groupBy('assigned_user_id')
            ->get()
            ->keyBy('user_id');
    
        // Agregados por agente desde Embudo (cerrados ganados)
        $wonAgg = SalesFunnel::forBroker($brokerId)
            ->where('stage', 'closed_won')
            ->whereIn('assigned_agent_id', $memberIds)
            ->whereBetween('closed_at', [$start, $end])
            ->selectRaw('assigned_agent_id as user_id, SUM(COALESCE(final_value, potential_value, 0)) as sales, COUNT(*) as deals')
            ->groupBy('assigned_agent_id')
            ->get()
            ->keyBy('user_id');
    
        // Leads creados en el periodo (para tasa de conversión)
        $leadsAgg = SalesFunnel::forBroker($brokerId)
            ->whereIn('assigned_agent_id', $memberIds)
            ->whereBetween('created_at', [$start, $end])
            ->selectRaw('assigned_agent_id as user_id, COUNT(*) as leads')
            ->groupBy('assigned_agent_id')
            ->get()
            ->keyBy('user_id');
    
        $items = $teamMembers->map(function ($member) use ($polizaAgg, $wonAgg, $leadsAgg) {
            $uid = (int) $member->user_id;
    
            $salesFromPolicies = (float) ($polizaAgg->get($uid)->sales ?? 0);
            $commissions = (float) ($polizaAgg->get($uid)->commissions ?? 0);
            $newClients = (int) ($polizaAgg->get($uid)->clients ?? 0);
    
            $salesFromWon = (float) ($wonAgg->get($uid)->sales ?? 0);
            $wonDeals = (int) ($wonAgg->get($uid)->deals ?? 0);
    
            $totalLeads = (int) ($leadsAgg->get($uid)->leads ?? 0);
    
            $monthlySales = $salesFromPolicies > 0 ? $salesFromPolicies : $salesFromWon;
    
            $goal = (float) ($member->monthly_goal ?? 0);
            $achievement = $goal > 0 ? ($monthlySales / $goal) * 100 : 0;
    
            $conversion = $totalLeads > 0 ? ($wonDeals / $totalLeads) * 100 : 0;
    
            $userName = $member->vendedor->nombres ?? $member->user->name ?? 'Vendedor ' . $uid;
    
            return [
                'id' => $uid,
                'name' => $userName,
                'email' => $member->vendedor->email ?? $member->user->email ?? '',
                'team_name' => $member->team->name ?? '',
                'monthly_sales' => $monthlySales,
                'monthly_goal' => $goal,
                'achievement_percentage' => $achievement,
                'commission_earned' => $commissions,
                'new_clients' => $newClients,
                'calls_made' => 0,
                'meetings_scheduled' => 0,
                'proposals_sent' => 0,
                'conversion_rate' => $conversion,
                'ranking' => 0,
                'status' => $member->status === 'inactive' ? 'inactive' : 'active'
            ];
        });
    
        // Ordenar, limitar y asignar ranking
        $sorted = collect($items)->sortByDesc(function ($item) use ($sortBy) {
            if ($sortBy === 'achievement_percentage') return $item['achievement_percentage'];
            if ($sortBy === 'conversion_rate') return $item['conversion_rate'];
            return $item['monthly_sales'];
        })->values();
    
        $limited = $sorted->take($limit)->values()->map(function($item, $index) {
            $item['ranking'] = $index + 1;
            return $item;
        });
    
        return response()->json($limited);
    }

    public function getTeamsPerformance(Request $request): JsonResponse
    {
        $brokerId = $request->user()->broker_id;
        $period = $request->get('period', 'month');
        $limit = (int) $request->get('limit', 10);
    
        $now = now();
        if ($period === 'week') {
            $start = $now->copy()->startOfWeek();
            $end = $now->copy()->endOfWeek();
        } elseif ($period === 'year') {
            $start = $now->copy()->startOfYear();
            $end = $now->copy()->endOfYear();
        } else {
            $start = $now->copy()->startOfMonth();
            $end = $now->copy()->endOfMonth();
        }
    
        $teams = SalesTeam::forBroker($brokerId)->with(['members.user', 'members.vendedor', 'leader'])->get();
    
        $result = $teams->map(function ($team) use ($start, $end) {
            $members = $team->members ?? collect();
            $memberIds = $members->pluck('user_id')->filter()->unique()->values();
    
            if ($memberIds->isEmpty()) {
                return [
                    'id' => $team->id,
                    'name' => $team->name,
                    'leader_name' => $team->leader->name ?? 'Sin líder',
                    'total_members' => 0,
                    'team_sales' => 0,
                    'team_goal' => 0,
                    'achievement_percentage' => 0,
                    'average_conversion' => 0,
                    'top_performer' => 'N/A'
                ];
            }
    
            $polizaSales = (float) Poliza::whereIn('assigned_user_id', $memberIds)
                ->whereBetween('issue_date', [$start->toDateString(), $end->toDateString()])
                ->sum(\DB::raw('COALESCE(total_amount, premium_amount, 0)'));
    
            $funnelSales = (float) SalesFunnel::whereIn('assigned_agent_id', $memberIds)
                ->where('stage', 'closed_won')
                ->whereBetween('closed_at', [$start, $end])
                ->sum(\DB::raw('COALESCE(final_value, potential_value, 0)'));
    
            $teamSales = $polizaSales > 0 ? $polizaSales : $funnelSales;
    
            $teamGoal = (float) $members->sum('monthly_goal');
    
            // Conversión promedio del equipo
            $wonCount = (int) SalesFunnel::whereIn('assigned_agent_id', $memberIds)
                ->where('stage', 'closed_won')
                ->whereBetween('closed_at', [$start, $end])
                ->count();
    
            $totalLeads = (int) SalesFunnel::whereIn('assigned_agent_id', $memberIds)
                ->whereBetween('created_at', [$start, $end])
                ->count();
    
            $avgConversion = $totalLeads > 0 ? ($wonCount / $totalLeads) * 100 : 0;
    
            // Top performer dentro del equipo
            $salesByMember = collect($memberIds)->mapWithKeys(function($uid) use ($start, $end) {
                $p = (float) Poliza::where('assigned_user_id', $uid)
                    ->whereBetween('issue_date', [$start->toDateString(), $end->toDateString()])
                    ->sum(\DB::raw('COALESCE(total_amount, premium_amount, 0)'));
                $f = (float) SalesFunnel::where('assigned_agent_id', $uid)
                    ->where('stage', 'closed_won')
                    ->whereBetween('closed_at', [$start, $end])
                    ->sum(\DB::raw('COALESCE(final_value, potential_value, 0)'));
                return [$uid => ($p > 0 ? $p : $f)];
            });
    
            $topUserId = (int) ($salesByMember->sortDesc()->keys()->first() ?? 0);
            $topName = 'N/A';
            if ($topUserId) {
                $member = $members->firstWhere('user_id', $topUserId);
                if ($member) {
                    $topName = $member->vendedor->nombres ?? ($member->user->name ?? 'N/A');
                }
            }
    
            return [
                'id' => $team->id,
                'name' => $team->name,
                'leader_name' => $team->leader->name ?? 'Sin líder',
                'total_members' => $members->count(),
                'team_sales' => $teamSales,
                'team_goal' => $teamGoal,
                'achievement_percentage' => $teamGoal > 0 ? ($teamSales / $teamGoal) * 100 : 0,
                'average_conversion' => $avgConversion,
                'top_performer' => $topName
            ];
        })->sortByDesc('team_sales')->take($limit)->values();
    
        return response()->json($result);
    }

    public function getStatistics(Request $request): JsonResponse
    {
        $brokerId = $request->user()->broker_id;
        $period = $request->get('period', 'month');
    
        // Obtener agentes y equipos usando los endpoints ya agregados (con datos reales)
        $agentsResponse = $this->getAgentsPerformance($request);
        $agentsData = $agentsResponse->getData(true);
    
        $teamsResponse = $this->getTeamsPerformance($request);
        $teamsData = $teamsResponse->getData(true);
    
        $totalRevenue = 0;
        $totalCommissions = 0;
        $avgConversionRate = 0;
    
        if (is_array($agentsData) && count($agentsData) > 0) {
            foreach ($agentsData as $a) {
                $totalRevenue += (float) ($a['monthly_sales'] ?? 0);
                $totalCommissions += (float) ($a['commission_earned'] ?? 0);
                $avgConversionRate += (float) ($a['conversion_rate'] ?? 0);
            }
            $avgConversionRate = $avgConversionRate / max(1, count($agentsData));
        }
    
        $topPerformer = is_array($agentsData) && count($agentsData) > 0 ? $agentsData[0] : null;
        $topTeam = is_array($teamsData) && count($teamsData) > 0 ? $teamsData[0] : null;
    
        // Tendencia vs mes anterior (revenue desde pólizas o fallback embudo)
        $now = now();
        $prevStart = $now->copy()->subMonth()->startOfMonth();
        $prevEnd = $now->copy()->subMonth()->endOfMonth();
    
        $prevRevenue = (float) Poliza::byBroker($brokerId)
            ->whereNotNull('assigned_user_id')
            ->whereBetween('issue_date', [$prevStart->toDateString(), $prevEnd->toDateString()])
            ->sum(\DB::raw('COALESCE(total_amount, premium_amount, 0)'));
    
        if ($prevRevenue <= 0) {
            $prevRevenue = (float) SalesFunnel::forBroker($brokerId)
                ->where('stage', 'closed_won')
                ->whereBetween('closed_at', [$prevStart, $prevEnd])
                ->sum(\DB::raw('COALESCE(final_value, potential_value, 0)'));
        }
    
        $salesGrowth = $prevRevenue > 0 ? (($totalRevenue - $prevRevenue) / $prevRevenue) * 100 : 0;
    
        return response()->json([
            'period' => $period === 'month' ? date('F Y') : ($period === 'year' ? date('Y') : 'current'),
            'total_revenue' => $totalRevenue,
            'total_commissions' => $totalCommissions,
            'average_conversion_rate' => $avgConversionRate,
            'top_performing_agent' => $topPerformer ? [
                'id' => $topPerformer['id'],
                'name' => $topPerformer['name'],
                'monthly_sales' => $topPerformer['monthly_sales'],
                'achievement_percentage' => $topPerformer['achievement_percentage']
            ] : null,
            'top_performing_team' => $topTeam,
            'trends' => [
                'sales_growth' => $salesGrowth,
                'conversion_improvement' => 0,
                'new_clients_growth' => 0
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