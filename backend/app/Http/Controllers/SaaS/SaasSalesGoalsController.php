<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\SalesGoal;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;

class SaasSalesGoalsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $brokerId = $request->user()->broker_id;
        $query = SalesGoal::forBroker($brokerId)->with(['user', 'team']);
        if ($request->filled('period')) {
            $query->where('period', $request->period);
        }
        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }
        if ($request->filled('team_id')) {
            $query->where('team_id', $request->team_id);
        }
        return response()->json($query->orderBy('period', 'desc')->paginate($request->get('per_page', 15)));
    }

    public function store(Request $request): JsonResponse
    {
        $brokerId = $request->user()->broker_id;
        $validated = $request->validate([
            'user_id' => [
                'nullable',
                'integer',
                Rule::exists('users', 'id')->where(fn($q) => $q->where('broker_id', $brokerId)),
            ],
            'team_id' => [
                'nullable',
                'integer',
                Rule::exists('sales_teams', 'id')->where(fn($q) => $q->where('broker_id', $brokerId)),
            ],
            'period' => 'required|string',
            'type' => 'required|in:Primas,Pólizas,Comisiones,Clientes',
            'target_value' => 'required|numeric|min:0',
            'current_value' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date|after_or_equal:starts_at',
            'status' => 'nullable|string',
        ]);
        $validated['broker_id'] = $brokerId;
        $goal = SalesGoal::create($validated);
        return response()->json(['message' => 'Meta creada', 'data' => $goal->load(['user','team'])], 201);
    }

    public function show(Request $request, SalesGoal $goal): JsonResponse
    {
        $this->authorizeGoal($request, $goal);
        return response()->json($goal->load(['user','team']));
    }

    public function update(Request $request, SalesGoal $goal): JsonResponse
    {
        $this->authorizeGoal($request, $goal);
        $brokerId = $request->user()->broker_id;
        $validated = $request->validate([
            'user_id' => [
                'nullable',
                'integer',
                Rule::exists('users', 'id')->where(fn($q) => $q->where('broker_id', $brokerId)),
            ],
            'team_id' => [
                'nullable',
                'integer',
                Rule::exists('sales_teams', 'id')->where(fn($q) => $q->where('broker_id', $brokerId)),
            ],
            'period' => 'sometimes|required|string',
            'type' => 'sometimes|required|in:Primas,Pólizas,Comisiones,Clientes',
            'target_value' => 'sometimes|required|numeric|min:0',
            'current_value' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string',
            'starts_at' => 'nullable|date',
            'ends_at' => 'nullable|date|after_or_equal:starts_at',
            'status' => 'nullable|string',
        ]);
        $goal->update($validated);
        return response()->json(['message' => 'Meta actualizada', 'data' => $goal->load(['user','team'])]);
    }

    public function destroy(Request $request, SalesGoal $goal): JsonResponse
    {
        $this->authorizeGoal($request, $goal);
        $goal->delete();
        return response()->json(['message' => 'Meta eliminada']);
    }

    public function statistics(Request $request): JsonResponse
    {
        $brokerId = $request->user()->broker_id;
        $period = $request->get('period');
        $query = SalesGoal::forBroker($brokerId);
        if ($period) {
            $query->where('period', $period);
        }
        $goals = $query->get();
        $totalTarget = $goals->sum('target_value');
        $totalCurrent = $goals->sum('current_value');
        return response()->json([
            'total_goals' => $goals->count(),
            'total_target' => $totalTarget,
            'total_current' => $totalCurrent,
            'progress_percent' => $totalTarget > 0 ? ($totalCurrent / $totalTarget) * 100 : 0,
        ]);
    }

    private function authorizeGoal(Request $request, SalesGoal $goal): void
    {
        if ($goal->broker_id !== ($request->user()->broker_id ?? 0)) {
            abort(403, 'Acceso denegado');
        }
    }
}


