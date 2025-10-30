<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

use App\Traits\RequiresAuth;
use App\Models\VoiceCampaign;
use App\Models\VoiceCampaignTrigger;
use App\Models\VoiceCampaignTriggerLog;
use App\Services\VoiceCampaignTriggerProcessor;

class VoiceCampaignTriggersController extends Controller
{
    use RequiresAuth;

    /**
     * Lista los disparadores (triggers) de una campaña de voz.
     */
    public function index(Request $request, int $campaignId): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            // Verificar campaña del broker
            /** @var VoiceCampaign|null $campaign */
            $campaign = VoiceCampaign::forBroker((int)$brokerId)->where('id', $campaignId)->first();
            if (!$campaign) {
                return response()->json(['success' => false, 'message' => 'Campaña no encontrada'], 404);
            }

            $triggers = VoiceCampaignTrigger::forCampaign($campaignId)
                ->orderBy('id', 'asc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $triggers,
            ]);
        } catch (\Throwable $e) {
            Log::error('VOICE_CAMPAIGN_TRIGGERS@index error', ['e' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error al listar disparadores'], 500);
        }
    }

    /**
     * Crea un disparador (trigger) para una campaña.
     */
    public function store(Request $request, int $campaignId): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $campaign = VoiceCampaign::forBroker((int)$brokerId)->where('id', $campaignId)->first();
            if (!$campaign) {
                return response()->json(['success' => false, 'message' => 'Campaña no encontrada'], 404);
            }

            $validator = Validator::make($request->all(), [
                'type' => 'required|in:' . implode(',', VoiceCampaignTrigger::TYPES),
                'enabled' => 'boolean',
                'window_config' => 'nullable|array',
                'limits' => 'nullable|array',
                'filters' => 'nullable|array',
                'expiry_offsets' => 'nullable|array',
                'mapping' => 'nullable|array',
            ]);
            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Datos inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Validación específica para policy_expiry
            if (($request->input('type') === VoiceCampaignTrigger::TYPE_POLICY_EXPIRY) && $request->filled('expiry_offsets')) {
                $exp = (array)$request->input('expiry_offsets');
                if (!is_array($exp)) {
                    return response()->json(['success' => false, 'message' => 'expiry_offsets debe ser un objeto'], 422);
                }
            }

            $trigger = VoiceCampaignTrigger::create([
                'voice_campaign_id' => $campaign->id,
                'type' => $request->input('type'),
                'enabled' => (bool)$request->input('enabled', false),
                'window_config' => $request->input('window_config'),
                'limits' => $request->input('limits'),
                'filters' => $request->input('filters'),
                'expiry_offsets' => $request->input('expiry_offsets'),
                'mapping' => $request->input('mapping'),
                'status' => 'healthy',
                'created_by' => $request->user()?->id,
                'updated_by' => $request->user()?->id,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Disparador creado',
                'data' => $trigger,
            ], 201);
        } catch (\Throwable $e) {
            Log::error('VOICE_CAMPAIGN_TRIGGERS@store error', ['e' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error al crear disparador'], 500);
        }
    }

    /**
     * Actualiza un disparador (trigger) existente.
     */
    public function update(Request $request, int $triggerId): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            /** @var VoiceCampaignTrigger|null $trigger */
            $trigger = VoiceCampaignTrigger::query()
                ->where('id', $triggerId)
                ->first();

            if (!$trigger) {
                return response()->json(['success' => false, 'message' => 'Disparador no encontrado'], 404);
            }

            // Validar que el trigger pertenezca a una campaña del broker
            $campaign = VoiceCampaign::forBroker((int)$brokerId)->where('id', $trigger->voice_campaign_id)->first();
            if (!$campaign) {
                return response()->json(['success' => false, 'message' => 'No autorizado para este disparador'], 403);
            }

            $validator = Validator::make($request->all(), [
                'type' => 'sometimes|in:' . implode(',', VoiceCampaignTrigger::TYPES),
                'enabled' => 'sometimes|boolean',
                'window_config' => 'nullable|array',
                'limits' => 'nullable|array',
                'filters' => 'nullable|array',
                'expiry_offsets' => 'nullable|array',
                'mapping' => 'nullable|array',
                'status' => 'nullable|string|max:50'
            ]);
            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Datos inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            $payload = $validator->validated();
            $payload['updated_by'] = $request->user()?->id;

            $trigger->update($payload);

            return response()->json([
                'success' => true,
                'message' => 'Disparador actualizado',
                'data' => $trigger->fresh(),
            ]);
        } catch (\Throwable $e) {
            Log::error('VOICE_CAMPAIGN_TRIGGERS@update error', ['e' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error al actualizar disparador'], 500);
        }
    }

    /**
     * Elimina un disparador (trigger).
     */
    public function destroy(Request $request, int $triggerId): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            /** @var VoiceCampaignTrigger|null $trigger */
            $trigger = VoiceCampaignTrigger::query()
                ->where('id', $triggerId)
                ->first();

            if (!$trigger) {
                return response()->json(['success' => false, 'message' => 'Disparador no encontrado'], 404);
            }

            $campaign = VoiceCampaign::forBroker((int)$brokerId)->where('id', $trigger->voice_campaign_id)->first();
            if (!$campaign) {
                return response()->json(['success' => false, 'message' => 'No autorizado para este disparador'], 403);
            }

            $trigger->delete();

            return response()->json([
                'success' => true,
                'message' => 'Disparador eliminado',
            ]);
        } catch (\Throwable $e) {
            Log::error('VOICE_CAMPAIGN_TRIGGERS@destroy error', ['e' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error al eliminar disparador'], 500);
        }
    }

    /**
     * Test-run: ejecuta la evaluación REAL del trigger contra un payload de ejemplo.
     * Retorna el resultado de evaluación/ejecución del Processor (sin encolar).
     */
    public function testRun(Request $request, int $triggerId): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            /** @var VoiceCampaignTrigger|null $trigger */
            $trigger = VoiceCampaignTrigger::query()->where('id', $triggerId)->first();
            if (!$trigger) {
                return response()->json(['success' => false, 'message' => 'Disparador no encontrado'], 404);
            }

            /** @var VoiceCampaign|null $campaign */
            $campaign = VoiceCampaign::forBroker((int)$brokerId)->where('id', $trigger->voice_campaign_id)->first();
            if (!$campaign) {
                return response()->json(['success' => false, 'message' => 'No autorizado para este disparador'], 403);
            }

            // Muestra de entidad para evaluar (cliente, póliza, lead, siniestro, etc.)
            $sample = $request->input('sample', []);
            if (!is_array($sample)) {
                $sample = (array) $sample;
            }
            $entityType = (string) ($request->input('entity_type') ?? ($sample['__entity_type'] ?? 'sample'));
            $entityId   = $request->input('entity_id') ?? ($sample['id'] ?? $sample['poliza_id'] ?? $sample['cliente_id'] ?? null);

            /** @var VoiceCampaignTriggerProcessor $processor */
            $processor = app(VoiceCampaignTriggerProcessor::class);
            $result = $processor->processSingleTrigger($trigger->id, (int)$brokerId, $sample, $entityType, is_null($entityId) ? null : (string) $entityId);

            return response()->json([
                'success' => true,
                'message' => 'Test-run ejecutado',
                'trigger_id' => $trigger->id,
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            Log::error('VOICE_CAMPAIGN_TRIGGERS@testRun error', ['e' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error en test-run'], 500);
        }
    }

    /**
     * Preview-targets: devuelve una muestra de posibles objetivos que hoy pasarían los filtros.
     * Stub seguro: retorna lista vacía con metadata hasta implementar el Processor.
     */
    public function previewTargets(Request $request, int $triggerId): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);

            $trigger = VoiceCampaignTrigger::query()->where('id', $triggerId)->first();
            if (!$trigger) {
                return response()->json(['success' => false, 'message' => 'Disparador no encontrado'], 404);
            }

            $campaign = VoiceCampaign::forBroker((int)$brokerId)->where('id', $trigger->voice_campaign_id)->first();
            if (!$campaign) {
                return response()->json(['success' => false, 'message' => 'No autorizado para este disparador'], 403);
            }

            $limit = max(1, (int)$request->get('limit', 10));

            return response()->json([
                'success' => true,
                'data' => [],
                'meta' => [
                    'limit' => $limit,
                    'filters' => $trigger->filters,
                    'type' => $trigger->type,
                ]
            ]);
        } catch (\Throwable $e) {
            Log::error('VOICE_CAMPAIGN_TRIGGERS@previewTargets error', ['e' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error al previsualizar objetivos'], 500);
        }
    }

    /**
     * Procesa un evento de negocio contra todos los triggers habilitados del broker para ese tipo.
     * Body esperado:
     * {
     *   "type": "new_client|new_policy|policy_expiry|new_lead|new_siniestro",
     *   "entity": {...},              // payload de la entidad
     *   "entity_type": "cliente",     // opcional para logs
     *   "entity_id": 123              // opcional para logs
     * }
     */
    public function processEvent(Request $request): JsonResponse
    {
        try {
            $brokerId = (int) $this->getBrokerId($request);

            $validator = \Validator::make($request->all(), [
                'type' => 'required|in:' . implode(',', VoiceCampaignTrigger::TYPES),
                'entity' => 'required|array',
                'entity_type' => 'nullable|string|max:50',
                'entity_id' => 'nullable',
            ]);
            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Datos inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            $type = (string) $request->input('type');
            $entity = (array) $request->input('entity', []);
            $entityType = $request->input('entity_type');
            $entityId = $request->input('entity_id');

            /** @var VoiceCampaignTriggerProcessor $processor */
            $processor = app(VoiceCampaignTriggerProcessor::class);
            $result = $processor->processEvent($brokerId, $type, $entity, $entityType, $entityId);

            return response()->json([
                'success' => true,
                'message' => 'Evento procesado',
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            Log::error('VOICE_CAMPAIGN_TRIGGERS@processEvent error', ['e' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error al procesar evento'], 500);
        }
    }
}