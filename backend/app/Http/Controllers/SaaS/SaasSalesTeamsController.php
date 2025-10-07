<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\SalesTeam;
use App\Models\SalesTeamMember;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class SaasSalesTeamsController extends Controller
{
    /**
     * Resolver broker_id para rutas públicas o con auth.
     * Prioridad: body/query broker_id -> user->broker_id -> env DEV_FALLBACK_BROKER_ID
     */
    private function resolveBrokerId(Request $request): ?int
    {
        $fromRequest = (int) ($request->input('broker_id') ?? 0);
        if ($fromRequest > 0) {
            return $fromRequest;
        }
        $user = $request->user();
        if ($user && isset($user->broker_id)) {
            return (int) $user->broker_id;
        }
        $fallback = (int) (env('DEV_FALLBACK_BROKER_ID') ?? 0);
        if ($fallback > 0) {
            return $fallback;
        }
        // Último recurso: primer broker activo en BD
        $firstActive = \App\Models\Broker::query()->active()->orderBy('id')->value('id');
        return $firstActive ? (int) $firstActive : null;
    }

    public function index(Request $request): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) {
            return response()->json([
                'success' => false,
                'message' => 'broker_id requerido (en query/body) o configure DEV_FALLBACK_BROKER_ID'
            ], 400);
        }
        $teams = SalesTeam::forBroker($brokerId)->with(['leader', 'members.user'])->paginate($request->get('per_page', 15));
        return response()->json($teams);
    }

    public function store(Request $request): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) {
            return response()->json([
                'success' => false,
                'message' => 'broker_id requerido (en body) o configure DEV_FALLBACK_BROKER_ID'
            ], 400);
        }
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'territory' => 'nullable|string|max:255',
            'specialty' => 'nullable|string|max:255',
            'leader_user_id' => 'nullable|integer|exists:users,id',
            'status' => 'nullable|string|in:active,inactive,restructuring',
        ]);
        $validated['broker_id'] = $brokerId;
        $team = SalesTeam::create($validated);
        return response()->json(['message' => 'Equipo creado', 'data' => $team], 201);
    }

    public function show(Request $request, SalesTeam $team): JsonResponse
    {
        $this->authorizeTeam($request, $team);
        return response()->json($team->load(['leader', 'members.user']));
    }

    public function update(Request $request, SalesTeam $team): JsonResponse
    {
        $this->authorizeTeam($request, $team);
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'territory' => 'nullable|string|max:255',
            'specialty' => 'nullable|string|max:255',
            'leader_user_id' => 'nullable|integer|exists:users,id',
            'status' => 'nullable|string|in:active,inactive,restructuring',
        ]);
        $team->update($validated);
        return response()->json(['message' => 'Equipo actualizado', 'data' => $team->fresh(['leader'])]);
    }

    public function destroy(Request $request, SalesTeam $team): JsonResponse
    {
        $this->authorizeTeam($request, $team);
        $team->delete();
        return response()->json(['message' => 'Equipo eliminado']);
    }

    public function members(Request $request, SalesTeam $team): JsonResponse
    {
        $this->authorizeTeam($request, $team);
        return response()->json($team->members()->with('user')->get());
    }

    public function addMember(Request $request, SalesTeam $team): JsonResponse
    {
        $this->authorizeTeam($request, $team);
        $validated = $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'role' => 'nullable|string|max:100',
            'monthly_goal' => 'nullable|numeric|min:0',
            'status' => 'nullable|string|in:active,inactive',
        ]);
        $validated['team_id'] = $team->id;
        $member = SalesTeamMember::create($validated);
        return response()->json(['message' => 'Miembro agregado', 'data' => $member->load('user')], 201);
    }

    public function removeMember(Request $request, SalesTeam $team, int $userId): JsonResponse
    {
        $this->authorizeTeam($request, $team);
        SalesTeamMember::where('team_id', $team->id)->where('user_id', $userId)->delete();
        return response()->json(['message' => 'Miembro removido']);
    }

    private function authorizeTeam(Request $request, SalesTeam $team): void
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId || $team->broker_id !== $brokerId) {
            abort(403, 'Acceso denegado');
        }
    }
}


