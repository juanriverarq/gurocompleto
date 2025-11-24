<?php

namespace App\Http\Controllers\SaaS;

use App\Http\Controllers\Controller;
use App\Models\SalesFunnel;
use App\Models\User;
use App\Models\Cliente;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\Rule;
use Carbon\Carbon;

class SaasSalesFunnelController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $brokerId = \App\Http\Middleware\UnifiedAuthMiddleware::getBrokerId($request)
                ?? optional($request->user())->broker_id;
            
            $query = SalesFunnel::forBroker($brokerId)
                               ->with(['assignedAgent', 'creator', 'client'])
                               ->orderBy('created_at', 'desc');

            // Filtros
            if ($request->filled('stage')) {
                $query->byStage($request->stage);
            }

            if ($request->filled('insurance_type')) {
                $query->byInsuranceType($request->insurance_type);
            }

            if ($request->filled('lead_source')) {
                $query->byLeadSource($request->lead_source);
            }

            if ($request->filled('quality_rating')) {
                $query->byQuality($request->quality_rating);
            }

            if ($request->filled('assigned_agent_id')) {
                $query->assignedTo($request->assigned_agent_id);
            }

            if ($request->filled('search')) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('first_name', 'like', "%{$search}%")
                      ->orWhere('last_name', 'like', "%{$search}%")
                      ->orWhere('email', 'like', "%{$search}%")
                      ->orWhere('phone', 'like', "%{$search}%")
                      ->orWhere('company_name', 'like', "%{$search}%");
                });
            }

            if ($request->filled('potential_value_min')) {
                $query->where('potential_value', '>=', $request->potential_value_min);
            }

            if ($request->filled('potential_value_max')) {
                $query->where('potential_value', '<=', $request->potential_value_max);
            }

            if ($request->filled('close_probability_min')) {
                $query->where('close_probability', '>=', $request->close_probability_min);
            }

            if ($request->filled('expected_close_date_from')) {
                $query->where('expected_close_date', '>=', $request->expected_close_date_from);
            }

            if ($request->filled('expected_close_date_to')) {
                $query->where('expected_close_date', '<=', $request->expected_close_date_to);
            }

            if ($request->filled('created_from')) {
                $query->where('created_at', '>=', $request->created_from);
            }

            if ($request->filled('created_to')) {
                $query->where('created_at', '<=', $request->created_to);
            }

            // Filtros especiales
            if ($request->boolean('active_only')) {
                $query->activeLeads();
            }

            if ($request->boolean('needing_follow_up')) {
                $query->needingFollowUp();
            }

            if ($request->boolean('high_value')) {
                $query->highValue();
            }

            if ($request->boolean('high_probability')) {
                $query->highProbability();
            }

            if ($request->boolean('stale_leads')) {
                $query->staleLeads();
            }

            if ($request->boolean('expected_to_close_soon')) {
                $query->expectedToCloseSoon();
            }

            $leads = $query->paginate($request->get('per_page', 15));

            return response()->json($leads);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al obtener leads',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $brokerId = \App\Http\Middleware\UnifiedAuthMiddleware::getBrokerId($request)
                ?? optional($request->user())->broker_id;
            $validated = $request->validate([
                'first_name' => 'required|string|max:255',
                'last_name' => 'required|string|max:255',
                'email' => [
                    'nullable',
                    'email',
                    Rule::unique('sales_funnel', 'email')->where(function ($q) use ($brokerId) {
                        if ($brokerId) {
                            $q->where('broker_id', $brokerId);
                        }
                        return $q;
                    }),
                ],
                'phone' => 'nullable|string|max:20',
                'secondary_phone' => 'nullable|string|max:20',
                'document_type' => 'nullable|string|max:10',
                'document_number' => 'nullable|string|max:20',
                'company_name' => 'nullable|string|max:255',
                'company_size' => 'nullable|in:small,medium,large',
                'industry' => 'nullable|string|max:100',
                'position' => 'nullable|string|max:100',
                'city' => 'nullable|string|max:100',
                'department' => 'nullable|string|max:100',
                'address' => 'nullable|string|max:500',
                'stage' => 'required|in:' . implode(',', array_keys(SalesFunnel::STAGES)),
                'business_state' => 'nullable|in:' . implode(',', array_keys(SalesFunnel::BUSINESS_STATES)),
                'lead_source' => 'required|in:' . implode(',', array_keys(SalesFunnel::LEAD_SOURCES)),
                'insurance_type' => 'required|in:' . implode(',', array_keys(SalesFunnel::INSURANCE_TYPES)),
                'potential_value' => 'required|numeric|min:0',
                'close_probability' => 'required|integer|min:0|max:100',
                'expected_close_date' => 'nullable|date|after:today',
                'assigned_agent_id' => 'nullable|exists:users,id',
                'client_id' => 'nullable|exists:clientes,id',
                'preferred_contact_method' => 'required|in:' . implode(',', array_keys(SalesFunnel::CONTACT_METHODS)),
                'preferred_contact_time' => 'nullable|in:' . implode(',', array_keys(SalesFunnel::CONTACT_TIMES)),
                'notes' => 'nullable|string|max:2000',
                'insurance_details' => 'nullable|array',
                'custom_fields' => 'nullable|array',
                'quality_rating' => 'required|in:' . implode(',', array_keys(SalesFunnel::QUALITY_RATINGS)),
                'lead_score' => 'nullable|integer|min:0|max:100',
                'next_follow_up_at' => 'nullable|date|after:now'
            ]);

            $actor = \App\Http\Middleware\UnifiedAuthMiddleware::getAuthenticatedUser($request);
            $validated['broker_id'] = $brokerId;
            $validated['created_by'] = $actor ? $actor->id : (optional($request->user())->id);
            $validated['stage_changed_at'] = now();
            $validated['lead_score'] = $validated['lead_score'] ?? 50;

            $lead = SalesFunnel::create($validated);

            $lead->addActivity('lead_created', [
                'source' => $validated['lead_source'],
                'stage' => $validated['stage'],
                'potential_value' => $validated['potential_value']
            ]);

            return response()->json([
                'message' => 'Lead creado exitosamente',
                'lead' => $lead->load(['assignedAgent', 'creator'])
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al crear lead',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, $id): JsonResponse
    {
        try {
            $brokerId = \App\Http\Middleware\UnifiedAuthMiddleware::getBrokerId($request)
                ?? optional($request->user())->broker_id;
            
            $lead = SalesFunnel::forBroker($brokerId)
                              ->with(['assignedAgent', 'creator', 'client'])
                              ->findOrFail($id);

            return response()->json($lead);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Lead no encontrado',
                'message' => $e->getMessage()
            ], 404);
        }
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(string $id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $id): JsonResponse
    {
        try {
            \Log::info('🔄 [DEBUG] SaasSalesFunnelController::update', [
                'id' => $id,
                'input_data' => $request->all()
            ]);
            
            $brokerId = \App\Http\Middleware\UnifiedAuthMiddleware::getBrokerId($request)
                ?? optional($request->user())->broker_id;
            
            $lead = SalesFunnel::forBroker($brokerId)->findOrFail($id);

            $validated = $request->validate([
                'first_name' => 'sometimes|required|string|max:255',
                'last_name' => 'sometimes|required|string|max:255',
                'email' => [
                    'nullable',
                    'email',
                    Rule::unique('sales_funnel', 'email')->ignore($lead->id)
                ],
                'phone' => 'nullable|string|max:20',
                'secondary_phone' => 'nullable|string|max:20',
                'document_type' => 'nullable|string|max:10',
                'document_number' => 'nullable|string|max:20',
                'company_name' => 'nullable|string|max:255',
                'company_size' => 'nullable|in:small,medium,large',
                'industry' => 'nullable|string|max:100',
                'position' => 'nullable|string|max:100',
                'city' => 'nullable|string|max:100',
                'department' => 'nullable|string|max:100',
                'address' => 'nullable|string|max:500',
                'stage' => 'sometimes|required|in:' . implode(',', array_keys(SalesFunnel::STAGES)),
                'business_state' => 'nullable|in:' . implode(',', array_keys(SalesFunnel::BUSINESS_STATES)),
                'lead_source' => 'sometimes|required|in:' . implode(',', array_keys(SalesFunnel::LEAD_SOURCES)),
                'insurance_type' => 'sometimes|required|in:' . implode(',', array_keys(SalesFunnel::INSURANCE_TYPES)),
                'potential_value' => 'sometimes|required|numeric|min:0',
                'close_probability' => 'sometimes|required|integer|min:0|max:100',
                'expected_close_date' => 'nullable|date|after:today',
                'assigned_agent_id' => 'nullable|exists:users,id',
                'preferred_contact_method' => 'sometimes|required|in:' . implode(',', array_keys(SalesFunnel::CONTACT_METHODS)),
                'preferred_contact_time' => 'nullable|in:' . implode(',', array_keys(SalesFunnel::CONTACT_TIMES)),
                'notes' => 'nullable|string|max:2000',
                'qualifying_notes' => 'nullable|string|max:2000',
                'presentation_notes' => 'nullable|string|max:2000',
                'negotiation_notes' => 'nullable|string|max:2000',
                'insurance_details' => 'nullable|array',
                'custom_fields' => 'nullable|array',
                'quality_rating' => 'sometimes|required|in:' . implode(',', array_keys(SalesFunnel::QUALITY_RATINGS)),
                'lead_score' => 'nullable|integer|min:0|max:100',
                'next_follow_up_at' => 'nullable|date|after:now'
            ]);

            // Si cambia la etapa, actualizar fechas relacionadas
            if (isset($validated['stage']) && $validated['stage'] !== $lead->stage) {
                $validated['stage_changed_at'] = now();
                $validated['days_in_current_stage'] = 0;
                
                $lead->addActivity('stage_changed', [
                    'from_stage' => $lead->stage,
                    'to_stage' => $validated['stage'],
                    'notes' => $request->stage_change_notes
                ]);
            }

            $lead->update($validated);

            return response()->json([
                'message' => 'Lead actualizado exitosamente',
                'lead' => $lead->load(['assignedAgent', 'creator', 'client'])
            ]);

        } catch (\Exception $e) {
            \Log::error('❌ [ERROR] SaasSalesFunnelController::update', [
                'id' => $id,
                'error_message' => $e->getMessage(),
                'error_trace' => $e->getTraceAsString(),
                'input_data' => $request->all()
            ]);
            
            return response()->json([
                'error' => 'Error al actualizar lead',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Request $request, $id): JsonResponse
    {
        try {
            $brokerId = \App\Http\Middleware\UnifiedAuthMiddleware::getBrokerId($request)
                ?? optional($request->user())->broker_id;
            
            $lead = SalesFunnel::forBroker($brokerId)->findOrFail($id);

            $lead->addActivity('lead_deleted', [
                'deleted_by' => $request->user()->id,
                'reason' => $request->deletion_reason
            ]);

            $lead->delete();

            return response()->json([
                'message' => 'Lead eliminado exitosamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al eliminar lead',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get statistics for the broker's sales funnel
     */
    public function statistics(Request $request): JsonResponse
    {
        try {
            $brokerId = \App\Http\Middleware\UnifiedAuthMiddleware::getBrokerId($request)
                ?? optional($request->user())->broker_id;
            $statistics = SalesFunnel::getStatistics($brokerId);

            return response()->json($statistics);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al obtener estadísticas',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get leads needing attention
     */
    public function needingAttention(Request $request): JsonResponse
    {
        try {
            $brokerId = \App\Http\Middleware\UnifiedAuthMiddleware::getBrokerId($request)
                ?? optional($request->user())->broker_id;
            
            $needingFollowUp = SalesFunnel::forBroker($brokerId)
                                         ->needingFollowUp()
                                         ->with(['assignedAgent'])
                                         ->get();

            $staleLeads = SalesFunnel::forBroker($brokerId)
                                    ->staleLeads()
                                    ->with(['assignedAgent'])
                                    ->get();

            $expectedToCloseSoon = SalesFunnel::forBroker($brokerId)
                                             ->expectedToCloseSoon()
                                             ->with(['assignedAgent'])
                                             ->get();

            return response()->json([
                'needing_follow_up' => $needingFollowUp,
                'stale_leads' => $staleLeads,
                'expected_to_close_soon' => $expectedToCloseSoon
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al obtener leads que necesitan atención',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Move lead to next stage
     */
    public function moveToNextStage(Request $request, $id): JsonResponse
    {
        try {
            $brokerId = \App\Http\Middleware\UnifiedAuthMiddleware::getBrokerId($request)
                ?? optional($request->user())->broker_id;
            
            $lead = SalesFunnel::forBroker($brokerId)->findOrFail($id);

            $request->validate([
                'notes' => 'nullable|string|max:2000'
            ]);

            $lead->moveToNextStage($request->notes);

            return response()->json([
                'message' => 'Lead movido a la siguiente etapa',
                'lead' => $lead->load(['assignedAgent', 'creator', 'client'])
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al mover lead a la siguiente etapa',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Move lead to specific stage
     */
    public function moveToStage(Request $request, $id): JsonResponse
    {
        try {
            $brokerId = \App\Http\Middleware\UnifiedAuthMiddleware::getBrokerId($request)
                ?? optional($request->user())->broker_id;
            
            $lead = SalesFunnel::forBroker($brokerId)->findOrFail($id);

            $request->validate([
                'stage' => 'required|in:' . implode(',', array_keys(SalesFunnel::STAGES)),
                'notes' => 'nullable|string|max:2000'
            ]);

            $lead->moveToStage($request->stage, $request->notes);

            return response()->json([
                'message' => 'Lead movido a la etapa ' . SalesFunnel::STAGES[$request->stage],
                'lead' => $lead->load(['assignedAgent', 'creator', 'client'])
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al mover lead a la etapa',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Close lead as won
     */
    public function closeAsWon(Request $request, $id): JsonResponse
    {
        try {
            $brokerId = \App\Http\Middleware\UnifiedAuthMiddleware::getBrokerId($request)
                ?? optional($request->user())->broker_id;
            
            $lead = SalesFunnel::forBroker($brokerId)->findOrFail($id);

            $request->validate([
                'final_value' => 'required|numeric|min:0',
                'policy_number' => 'nullable|string|max:50',
                'notes' => 'nullable|string|max:2000'
            ]);

            $lead->closeAsWon($request->final_value, $request->policy_number, $request->notes);

            return response()->json([
                'message' => 'Lead cerrado como ganado',
                'lead' => $lead->load(['assignedAgent', 'creator', 'client'])
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al cerrar lead como ganado',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Close lead as lost
     */
    public function closeAsLost(Request $request, $id): JsonResponse
    {
        try {
            $brokerId = \App\Http\Middleware\UnifiedAuthMiddleware::getBrokerId($request)
                ?? optional($request->user())->broker_id;
            
            $lead = SalesFunnel::forBroker($brokerId)->findOrFail($id);

            $request->validate([
                'reason' => 'required|string|max:500',
                'notes' => 'nullable|string|max:2000'
            ]);

            $lead->closeAsLost($request->reason, $request->notes);

            return response()->json([
                'message' => 'Lead cerrado como perdido',
                'lead' => $lead->load(['assignedAgent', 'creator', 'client'])
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al cerrar lead como perdido',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Schedule follow up
     */
    public function scheduleFollowUp(Request $request, $id): JsonResponse
    {
        try {
            $brokerId = \App\Http\Middleware\UnifiedAuthMiddleware::getBrokerId($request)
                ?? optional($request->user())->broker_id;
            
            $lead = SalesFunnel::forBroker($brokerId)->findOrFail($id);

            $request->validate([
                'follow_up_date' => 'required|date|after:now',
                'notes' => 'nullable|string|max:2000'
            ]);

            $lead->scheduleFollowUp(Carbon::parse($request->follow_up_date), $request->notes);

            return response()->json([
                'message' => 'Seguimiento programado exitosamente',
                'lead' => $lead->load(['assignedAgent', 'creator', 'client'])
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al programar seguimiento',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Record contact
     */
    public function recordContact(Request $request, $id): JsonResponse
    {
        try {
            $brokerId = \App\Http\Middleware\UnifiedAuthMiddleware::getBrokerId($request)
                ?? optional($request->user())->broker_id;
            
            $lead = SalesFunnel::forBroker($brokerId)->findOrFail($id);

            $request->validate([
                'method' => 'required|in:' . implode(',', array_keys(SalesFunnel::CONTACT_METHODS)),
                'notes' => 'nullable|string|max:2000',
                'details' => 'nullable|array'
            ]);

            $lead->recordContact($request->method, $request->notes, $request->details ?? []);

            return response()->json([
                'message' => 'Contacto registrado exitosamente',
                'lead' => $lead->load(['assignedAgent', 'creator', 'client'])
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al registrar contacto',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update lead score
     */
    public function updateScore(Request $request, $id): JsonResponse
    {
        try {
            $brokerId = \App\Http\Middleware\UnifiedAuthMiddleware::getBrokerId($request)
                ?? optional($request->user())->broker_id;
            
            $lead = SalesFunnel::forBroker($brokerId)->findOrFail($id);

            $request->validate([
                'score' => 'required|integer|min:0|max:100',
                'reason' => 'nullable|string|max:500'
            ]);

            $lead->updateScore($request->score, $request->reason);

            return response()->json([
                'message' => 'Puntuación actualizada exitosamente',
                'lead' => $lead->load(['assignedAgent', 'creator', 'client'])
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al actualizar puntuación',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Convert lead to client
     */
    public function convertToClient(Request $request, $id): JsonResponse
    {
        try {
            $brokerId = \App\Http\Middleware\UnifiedAuthMiddleware::getBrokerId($request)
                ?? optional($request->user())->broker_id;
            
            $lead = SalesFunnel::forBroker($brokerId)->findOrFail($id);

            $client = $lead->convertToClient();

            return response()->json([
                'message' => 'Lead convertido a cliente exitosamente',
                'client' => $client,
                'lead' => $lead->load(['assignedAgent', 'creator', 'client'])
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al convertir lead a cliente',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get available agents for assignment
     */
    public function getAvailableAgents(Request $request): JsonResponse
    {
        try {
            $brokerId = $request->user()->broker_id;
            
            $agents = User::where('broker_id', $brokerId)
                         ->where('status', 'active')
                         ->select('id', 'first_name', 'last_name', 'email')
                         ->get();

            return response()->json($agents);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Error al obtener agentes disponibles',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get constants for form options
     */
    public function getConstants(): JsonResponse
    {
        return response()->json([
            'stages' => SalesFunnel::STAGES,
            'lead_sources' => SalesFunnel::LEAD_SOURCES,
            'insurance_types' => SalesFunnel::INSURANCE_TYPES,
            'quality_ratings' => SalesFunnel::QUALITY_RATINGS,
            'contact_methods' => SalesFunnel::CONTACT_METHODS,
            'contact_times' => SalesFunnel::CONTACT_TIMES,
            'company_sizes' => SalesFunnel::COMPANY_SIZES
        ]);
    }
}
