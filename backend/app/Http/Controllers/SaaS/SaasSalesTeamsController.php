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
        // 1) broker_id explícito (query/body) o headers de desarrollo
        $fromRequest = (int) ($request->input('broker_id') ?? 0);
        $fromHeader = (int) ($request->header('X-Dev-Broker-Id') ?? $request->header('X-Broker-Id') ?? 0);
        if ($fromRequest > 0) {
            return $fromRequest;
        }
        if ($fromHeader > 0) {
            return $fromHeader;
        }

        // 2) Usuario autenticado (Firebase/Empleado) con broker_id
        $user = $request->user();
        if ($user && isset($user->broker_id) && $user->broker_id) {
            return (int) $user->broker_id;
        }

        // 3) Fallback de entorno para desarrollo local
        $fallback = (int) (env('DEV_FALLBACK_BROKER_ID') ?? 0);
        if ($fallback > 0) {
            return $fallback;
        }

        // 4) Último recurso: primer broker activo en BD
        $firstActive = \App\Models\Broker::query()->active()->orderBy('id')->value('id');
        return $firstActive ? (int) $firstActive : null;
    }

    public function index(Request $request): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) {
            return response()->json([
                'success' => false,
                'message' => 'broker_id requerido (query/body o header X-Dev-Broker-Id) o configure DEV_FALLBACK_BROKER_ID'
            ], 400);
        }
        $teams = SalesTeam::forBroker($brokerId)
            ->with(['leader', 'leaderVendedor', 'members.user', 'members.vendedor'])
            ->paginate($request->get('per_page', 15));
        
        // Enriquecer respuesta con nombres de vendedores
        $teams->getCollection()->transform(function ($team) {
            if ($team->leaderVendedor) {
                $team->leader_name = $team->leaderVendedor->nombres;
            } elseif ($team->leader) {
                $team->leader_name = $team->leader->name;
            }
            
            $team->members->transform(function ($member) {
                if ($member->vendedor) {
                    $member->vendedor_name = $member->vendedor->nombres;
                } elseif ($member->user) {
                    $member->vendedor_name = $member->user->name;
                }
                return $member;
            });
            
            return $team;
        });
        
        return response()->json($teams);
    }

    public function store(Request $request): JsonResponse
    {
        $brokerId = $this->resolveBrokerId($request);
        if (!$brokerId) {
            return response()->json([
                'success' => false,
                'message' => 'broker_id requerido (body o header X-Dev-Broker-Id) o configure DEV_FALLBACK_BROKER_ID'
            ], 400);
        }
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'territory' => 'nullable|string|max:255',
            'specialty' => 'nullable|string|max:255',
            'leader_user_id' => 'nullable|integer',
            'status' => 'nullable|string|in:active,inactive,restructuring',
        ]);
        $validated['broker_id'] = $brokerId;
        $team = SalesTeam::create($validated);
        return response()->json(['message' => 'Equipo creado', 'data' => $team], 201);
    }

    public function show(Request $request, SalesTeam $team): JsonResponse
    {
        $this->authorizeTeam($request, $team);
        $team->load(['leader', 'leaderVendedor', 'members.user', 'members.vendedor']);
        
        // Enriquecer con nombres
        if ($team->leaderVendedor) {
            $team->leader_name = $team->leaderVendedor->nombres;
        } elseif ($team->leader) {
            $team->leader_name = $team->leader->name;
        }
        
        $team->members->transform(function ($member) {
            if ($member->vendedor) {
                $member->vendedor_name = $member->vendedor->nombres;
            } elseif ($member->user) {
                $member->vendedor_name = $member->user->name;
            }
            return $member;
        });
        
        return response()->json($team);
    }

    public function update(Request $request, SalesTeam $team): JsonResponse
    {
        $this->authorizeTeam($request, $team);
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'territory' => 'nullable|string|max:255',
            'specialty' => 'nullable|string|max:255',
            'leader_user_id' => 'nullable|integer',
            'status' => 'nullable|string|in:active,inactive,restructuring',
        ]);
        $team->update($validated);
        return response()->json(['message' => 'Equipo actualizado', 'data' => $team->fresh(['leader', 'leaderVendedor', 'members.user', 'members.vendedor'])]);
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
        $members = $team->members()->with(['user', 'vendedor'])->get();
        
        // Enriquecer con nombres
        $members->transform(function ($member) {
            if ($member->vendedor) {
                $member->vendedor_name = $member->vendedor->nombres;
            } elseif ($member->user) {
                $member->vendedor_name = $member->user->name;
            }
            return $member;
        });
        
        return response()->json($members);
    }

    public function addMember(Request $request, SalesTeam $team): JsonResponse
    {
        $this->authorizeTeam($request, $team);
        $validated = $request->validate([
            'user_id' => 'required|integer',
            'role' => 'nullable|string|max:100',
            'monthly_goal' => 'nullable|numeric|min:0',
            'status' => 'nullable|string|in:active,inactive',
        ]);
        
        // Validar que el miembro no esté ya en el equipo
        $exists = SalesTeamMember::where('team_id', $team->id)
            ->where('user_id', $validated['user_id'])
            ->exists();
        
        if ($exists) {
            return response()->json([
                'success' => false,
                'message' => 'Este vendedor ya es miembro del equipo'
            ], 422);
        }
        
        $validated['team_id'] = $team->id;
        $validated['status'] = $validated['status'] ?? 'active';
        $member = SalesTeamMember::create($validated);
        $member->load(['user', 'vendedor']);
        
        // Enriquecer con nombre
        if ($member->vendedor) {
            $member->vendedor_name = $member->vendedor->nombres;
        } elseif ($member->user) {
            $member->vendedor_name = $member->user->name;
        }
        
        return response()->json(['message' => 'Miembro agregado', 'data' => $member], 201);
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


