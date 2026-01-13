<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VoiceCampaign;
use App\Models\VoiceCampaignExecution;
use App\Models\VoiceCampaignCall;
use App\Models\VoiceCampaignTrigger;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Carbon\Carbon;
use App\Traits\RequiresAuth;
use App\Models\Broker;
use App\Services\ElevenLabsClient;
use Illuminate\Support\Facades\Http as FacadesHttp;

class VoiceCampaignController extends Controller
{
    use RequiresAuth;

    /**
     * Asegura que si WhatsApp post-call está habilitado pero sin instance_id, se asigne automáticamente
     * la primera instancia conectada del microservicio y se persista en settings.
     */
    private function ensureWhatsappInstanceId(array $settings): array
    {
        try {
            $tools = is_array($settings['post_call_tools'] ?? null) ? $settings['post_call_tools'] : [];
            $wa = is_array($tools['whatsapp'] ?? null) ? $tools['whatsapp'] : [];
            $enabled = (bool) ($wa['enabled'] ?? false);
            $instanceId = $wa['instance_id'] ?? null;
            if ($enabled && empty($instanceId)) {
                $waBase = rtrim(env('WHATSAPP_SERVICE_URL', 'http://localhost:3000/api/v1'), '/');
                $resp = \Illuminate\Support\Facades\Http::retry(2, 500)->get($waBase . '/instances');
                if ($resp->ok() && ($resp->json('success'))) {
                    $instances = $resp->json('instances') ?? [];
                    $connected = collect($instances)->firstWhere('connected', true);
                    if ($connected && !empty($connected['instanceId'])) {
                        $settings['post_call_tools']['whatsapp']['instance_id'] = $connected['instanceId'];
                    }
                }
            }
        } catch (\Throwable $e) {
            \Log::warning('⚠️ [VOICE CAMPAIGN] No se pudo auto-asignar instancia WA', [ 'error' => $e->getMessage() ]);
        }
        return $settings;
    }

    /**
     * Obtener todas las campañas de voz
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            Log::info('🔊 [VOICE CAMPAIGNS] Listing campaigns', [
                'broker_id' => $brokerId,
                'user_id' => $request->user()?->id
            ]);

            $query = VoiceCampaign::forBroker($brokerId);

            // Aplicar filtros
            if ($request->has('type')) {
                $query->ofType($request->type);
            }

            if ($request->has('status')) {
                $query->withStatus($request->status);
            }

            if ($request->has('active')) {
                $query->where('is_active', $request->boolean('active'));
            }

            // Paginación
            $limit = $request->get('limit', 15);
            $offset = $request->get('offset', 0);

            $campaigns = $query->orderBy('created_at', 'desc')
                            ->skip($offset)
                            ->take($limit)
                            ->get()
                            ->map(function ($campaign) {
                                return array_merge($campaign->toArray(), [
                                    'stats' => $campaign->getStats()
                                ]);
                            });

            $total = $query->count();

            return response()->json([
                'success' => true,
                'data' => $campaigns,
                'total' => $total,
                'limit' => $limit,
                'offset' => $offset
            ]);

        } catch (\Exception $e) {
            Log::error('🔊 [VOICE CAMPAIGNS] Error listing campaigns', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al obtener campañas de voz',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Crear campaña de voz inmediata
     */
    public function createImmediate(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            Log::info('🔊 [VOICE CAMPAIGN] Creating immediate campaign', [
                'broker_id' => $brokerId,
                'request_data' => $request->all()
            ]);

            // Validación
            $validator = Validator::make($request->all(), [
                'name' => 'required|string|max:255',
                'description' => 'nullable|string',
                'voice_message_template' => 'required|string',
                'contacts' => 'nullable|array', // Nullable si hay triggers
                'contacts.*.phone' => 'required_with:contacts|string',
                'contacts.*.name' => 'nullable|string',
                'elevenlabs_agent_id' => 'nullable|string',
                'elevenlabs_phone_number_id' => 'nullable|string',
                'elevenlabs_voice_id' => 'nullable|string',
                'agent_name' => 'nullable|string|max:255',
                'voice_settings' => 'nullable|array',
                'settings' => 'nullable|array',

                // Disparadores opcionales incluidos en creación de campaña
                'triggers' => 'nullable|array',
                'triggers.*.type' => 'required_with:triggers|in:' . implode(',', \App\Models\VoiceCampaignTrigger::TYPES),
                'triggers.*.enabled' => 'boolean',
                'triggers.*.window_config' => 'nullable|array',
                'triggers.*.limits' => 'nullable|array',
                'triggers.*.filters' => 'nullable|array',
                'triggers.*.expiry_offsets' => 'nullable|array',
                'triggers.*.mapping' => 'nullable|array',
            ]);

            if ($validator->fails()) {
                Log::warning('🔊 [VOICE CAMPAIGN] Validación fallida', [
                    'errors' => $validator->errors()->toArray(),
                    'request_data' => $request->all()
                ]);
                
                return response()->json([
                    'success' => false,
                    'message' => 'Datos de entrada inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Validación adicional: si no hay triggers, debe haber al menos 1 contacto
            $hasTriggers = !empty($request->input('triggers'));
            $hasContacts = !empty($request->input('contacts'));
            
            if (!$hasTriggers && !$hasContacts) {
                Log::warning('🔊 [VOICE CAMPAIGN] Sin triggers ni contactos', [
                    'has_triggers' => $hasTriggers,
                    'has_contacts' => $hasContacts
                ]);
                
                return response()->json([
                    'success' => false,
                    'message' => 'Debes proporcionar contactos o configurar disparadores automáticos',
                    'errors' => ['contacts' => ['Se requiere al menos un contacto o un disparador configurado']]
                ], 422);
            }

            DB::beginTransaction();

            // Normalizar settings: asignar instance_id si WhatsApp post-call está habilitado y no viene definido
            $incomingSettings = $request->input('settings', []);
            $normalizedSettings = $this->ensureWhatsappInstanceId($incomingSettings);

            // Crear la campaña
            $campaign = VoiceCampaign::create([
                'broker_id' => $brokerId,
                'name' => $request->name,
                'description' => $request->description,
                'campaign_type' => VoiceCampaign::TYPE_IMMEDIATE,
                'voice_message_template' => $request->voice_message_template,
                'contacts' => $request->contacts,
                'status' => VoiceCampaign::STATUS_DRAFT,
                'total_targets' => count($request->contacts),
                'elevenlabs_agent_id' => $request->elevenlabs_agent_id ?: env('ELEVENLABS_AGENT_ID'),
                'elevenlabs_phone_number_id' => $request->elevenlabs_phone_number_id ?: env('ELEVENLABS_PHONE_NUMBER_ID'),
                'elevenlabs_voice_id' => $request->elevenlabs_voice_id,
                'agent_name' => $request->agent_name,
                'voice_settings' => $request->voice_settings,
                'settings' => $normalizedSettings,
                'created_by' => $request->user()?->id
            ]);

            // Crear triggers opcionales incluidos en el payload
            $createdTriggers = [];
            $incomingTriggers = $request->input('triggers');
            if (is_array($incomingTriggers) && !empty($incomingTriggers)) {
                foreach ($incomingTriggers as $t) {
                    try {
                        $createdTriggers[] = VoiceCampaignTrigger::create([
                            'voice_campaign_id' => $campaign->id,
                            'type' => (string) ($t['type'] ?? 'new_client'),
                            'enabled' => (bool) ($t['enabled'] ?? false),
                            'window_config' => $t['window_config'] ?? null,
                            'limits' => $t['limits'] ?? null,
                            'filters' => $t['filters'] ?? null,
                            'expiry_offsets' => $t['expiry_offsets'] ?? null,
                            'mapping' => $t['mapping'] ?? null,
                            'status' => 'healthy',
                            'created_by' => $request->user()?->id,
                            'updated_by' => $request->user()?->id,
                        ]);
                    } catch (\Throwable $e) {
                        \Log::warning('🔊 [VOICE CAMPAIGN] No se pudo crear trigger en createImmediate', ['error' => $e->getMessage()]);
                    }
                }
            }

            // Si viene save_as_draft=true, NO ejecutar; devolver como borrador
            $saveAsDraft = $request->boolean('save_as_draft', false);
            if ($saveAsDraft) {
                // Si hay triggers creados, marcar campaña como running (en curso esperando eventos)
                if (!empty($createdTriggers)) {
                    $campaign->update([
                        'status' => VoiceCampaign::STATUS_RUNNING,
                        'is_active' => true,
                        'last_execution' => now()
                    ]);
                }
                
                DB::commit();
                return response()->json([
                    'success' => true,
                    'message' => !empty($createdTriggers)
                        ? 'Campaña de voz en curso con disparadores automáticos'
                        : 'Campaña de voz guardada como borrador',
                    'data' => [
                        'campaign' => $campaign->fresh(),
                        'triggers' => $createdTriggers,
                        'stats' => $campaign->getStats()
                    ]
                ], 201);
            }

            // Ejecutar inmediatamente
            $execution = $this->executeVoiceCampaign($campaign);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Campaña de voz inmediata creada y ejecutada',
                'data' => [
                    'campaign' => $campaign,
                    'execution' => $execution,
                    'triggers' => $createdTriggers,
                    'stats' => $campaign->getStats()
                ]
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            
            Log::error('🔊 [VOICE CAMPAIGN] Error creating immediate campaign', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al crear campaña inmediata de voz',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Webhook para eventos post-llamada de ElevenLabs
     */
    public function receiveElevenLabsWebhook(Request $request): JsonResponse
    {
        try {
            // Logging mejorado del payload recibido
            $payload = $request->all();
            $eventType = $payload['type'] ?? null;
            
            Log::info('🔔 [ELEVENLABS WEBHOOK] Payload recibido', [
                'event_type' => $eventType,
                'payload_keys' => array_keys($payload),
                'data_keys' => array_keys($payload['data'] ?? []),
                'has_status' => isset($payload['data']['status']),
                'status_value' => $payload['data']['status'] ?? null,
                'has_analysis' => isset($payload['data']['analysis']),
                'has_transcript' => isset($payload['data']['transcript']),
                'conversation_id' => data_get($payload, 'data.conversation_id')
            ]);

            // Intentar resolver conversation_id desde múltiples ubicaciones (compatibilidad con variantes de ElevenLabs)
            $conversationId = data_get($payload, 'data.conversation_id')
                ?? data_get($payload, 'data.id')
                ?? data_get($payload, 'conversation_id')
                ?? data_get($payload, 'id')
                ?? null;

            if (!$conversationId) {
                Log::warning('🔔 [ELEVENLABS WEBHOOK] conversation_id/id faltante en payload', [
                    'payload_keys' => array_keys($payload),
                    'data_keys' => array_keys($payload['data'] ?? []),
                ]);
                return response()->json(['success' => false, 'message' => 'conversation_id faltante'], 400);
            }

            /** @var VoiceCampaignCall|null $call */
            $call = VoiceCampaignCall::where('elevenlabs_conversation_id', $conversationId)->first();

            // Fallback: algunos responses usan "id" como conversation id y se guardó inicialmente como elevenlabs_call_id
            if (!$call) {
                $call = VoiceCampaignCall::where('elevenlabs_call_id', $conversationId)->first();
                if ($call && empty($call->elevenlabs_conversation_id)) {
                    // Normalizar para que próximos webhooks encuentren el registro
                    $call->update(['elevenlabs_conversation_id' => $conversationId]);
                }
            }

            if (!$call) {
                Log::warning('ELEVENLABS WEBHOOK: Llamada no encontrada por conversation_id/call_id', [
                    'conversation_id' => $conversationId,
                    'hint' => 'Verificar que en el inicio de la llamada se haya persistido conversation_id'
                ]);
                return response()->json(['success' => true]); // idempotente
            }

            // Algunos webhooks pueden no anidar en "data", usar fallback a nivel raíz
            $data = $payload['data'] ?? [];
            if (!is_array($data) || empty($data)) {
                $data = $payload;
            }
            $status = data_get($data, 'status') ?? data_get($payload, 'status');
            $analysis = data_get($data, 'analysis') ?? data_get($payload, 'analysis');
            $transcript = data_get($data, 'transcript') ?? data_get($payload, 'transcript');
            $metadata = data_get($data, 'metadata') ?? data_get($payload, 'metadata');

            // Si es un webhook de AUDIO, solo marcamos que hay audio disponible y salimos
            if ($eventType === 'post_call_audio') {
                $call->update(['has_audio' => true]);
                return response()->json(['success' => true]);
            }

            // SOLUCIÓN: Hacer la condición de terminal más flexible y robusta
            $terminalStatuses = ['done', 'completed', 'finished', 'ended', 'hangup', 'stopped'];
            $terminalEvents = ['post_call_transcription', 'post_call_summary', 'conversation_completed', 'conversation_ended', 'call_ended'];

            $statusLc = is_string($status) ? strtolower($status) : (string)$status;
            $eventLc = is_string($eventType) ? strtolower($eventType) : (string)$eventType;

            $isTerminal = in_array($statusLc, $terminalStatuses, true)
                          || is_array($analysis)
                          || is_array($transcript)
                          || in_array($eventLc, $terminalEvents, true);
            
            // Logging mejorado para debug
            Log::info('🔔 [ELEVENLABS WEBHOOK] Evaluando si es terminal', [
                'conversation_id' => $conversationId,
                'status' => $status,
                'has_analysis' => is_array($analysis),
                'has_transcript' => is_array($transcript),
                'event_type' => $eventType,
                'is_terminal' => $isTerminal
            ]);
            
            if ($isTerminal) {
                // Primero, verificar si hay datos del tool en caché
                try {
                    // Intentar caché específico por conversation_id
                    $cachedToolData = \Cache::get('tool_data:' . $conversationId);
                    
                    // Si no hay, intentar caché genérico (para cuando conversation_id es unknown)
                    if (!$cachedToolData) {
                        $cachedToolData = \Cache::get('tool_data:latest');
                        if ($cachedToolData) {
                            Log::info('💾 [ELEVENLABS WEBHOOK] Usando datos del caché genérico', [
                                'conversation_id' => $conversationId,
                                'cached_timestamp' => $cachedToolData['timestamp'] ?? 'N/A'
                            ]);
                            $cachedToolData = $cachedToolData['data'] ?? $cachedToolData;
                        }
                    }
                    
                    if ($cachedToolData) {
                        Log::info('💾 [ELEVENLABS WEBHOOK] Recuperando datos del tool desde caché', [
                            'conversation_id' => $conversationId,
                            'cached_data' => $cachedToolData
                        ]);
                        
                        $meta = is_array($call->call_metadata) ? $call->call_metadata : [];
                        $existingData = $meta['collected_data'] ?? [];
                        
                        // Agregar datos del tool con máxima confianza
                        foreach ($cachedToolData as $field => $value) {
                            if ($value !== null && $value !== '' && $field !== 'conversation_id' && $field !== 'timestamp') {
                                $existingData[$field] = [
                                    'value' => $value,
                                    'confidence' => 1.0,
                                    'source' => 'elevenlabs_tool',
                                    'collected_at' => now()->toDateTimeString()
                                ];
                            }
                        }
                        
                        $meta['collected_data'] = $existingData;
                        $meta['tool_used'] = true;
                        $meta['tool_data_from_cache'] = true;
                        $call->update(['call_metadata' => $meta]);
                        
                        // Limpiar cachés
                        \Cache::forget('tool_data:' . $conversationId);
                        \Cache::forget('tool_data:latest');
                        
                        Log::info('✅ [ELEVENLABS WEBHOOK] Datos del tool aplicados desde caché', [
                            'call_id' => $call->id,
                            'fields' => array_keys($existingData)
                        ]);
                    }
                } catch (\Throwable $e) {
                    Log::warning('⚠️ [ELEVENLABS WEBHOOK] Error recuperando datos del tool desde caché', [
                        'error' => $e->getMessage()
                    ]);
                }
                
                // Extraer datos recolectados dinámicamente desde transcript (como fallback)
                try {
                    $fullTranscriptText = '';
                    if (is_array($transcript)) {
                        $fullTranscriptText = collect($transcript)
                            ->map(function ($t) {
                                // Soportar múltiples posibles claves de texto del transcript
                                $msg = $t['message'] ?? $t['content'] ?? $t['text'] ?? '';
                                // Normalizar a string
                                return is_string($msg) ? $msg : json_encode($msg);
                            })
                            ->implode("\n");
                    } elseif (is_string($transcript)) {
                        $fullTranscriptText = $transcript;
                    }
                    
                    if ($fullTranscriptText) {
                        $campaign = $call->voiceCampaign;
                        $allowed = [];
                        if ($campaign && is_array($campaign->settings)) {
                            $allowed = $campaign->settings['post_call_tools']['collect'] ?? [];
                        }

                        $collected = $this->extractCollectedData($fullTranscriptText, $allowed);
                        if (!empty($collected)) {
                            $meta = is_array($call->call_metadata) ? $call->call_metadata : [];
                            $prev = isset($meta['collected_data']) && is_array($meta['collected_data']) ? $meta['collected_data'] : [];
                            // Merge sin sobrescribir datos del tool (tienen prioridad)
                            $meta['collected_data'] = array_merge($collected, $prev);
                            $call->update(['call_metadata' => $meta]);
                        }
                    }
                } catch (\Throwable $e) {
                    Log::error('Error extrayendo datos recolectados', ['error' => $e->getMessage()]);
                }

                // Extraer y persistir análisis completo de ElevenLabs
                try {
                    $analysisData = [];
                    if (is_array($analysis)) {
                        $analysisData = $analysis;
                        
                        // Traducir transcript_summary al español si viene en inglés
                        if (isset($analysisData['transcript_summary']) && is_string($analysisData['transcript_summary'])) {
                            $summary = $analysisData['transcript_summary'];
                            // Detectar si está en inglés (heurística simple)
                            if ($this->isEnglish($summary)) {
                                $translated = $this->translateToSpanish($summary);
                                if ($translated !== $summary) {
                                    $analysisData['transcript_summary'] = $translated;
                                    $analysisData['transcript_summary_original'] = $summary;
                                    Log::info('✅ [TRANSLATION] Resumen traducido al español', [
                                        'conversation_id' => $conversationId,
                                        'original_length' => strlen($summary),
                                        'translated_length' => strlen($translated)
                                    ]);
                                }
                            }
                        }
                    }
                    // Añadir termination_reason desde metadata
                    if ($terminationReason = data_get($metadata, 'termination_reason')) {
                        $analysisData['termination_reason'] = $terminationReason;
                    }
                    // Persistir en call_result para acceso desde frontend
                    if (!empty($analysisData)) {
                        $call->update(['call_result' => $analysisData]);
                    }
                } catch (\Throwable $e) {
                    Log::warning('⚠️ [ELEVENLABS ANALYSIS] Error persistiendo análisis', ['error' => $e->getMessage()]);
                }

                // Clasificación robusta de resultado post-llamada
                $callSuccessfulRaw = data_get($analysis, 'call_successful', null);
                $durationSeconds = (int) (data_get($metadata, 'call_duration_secs') ?? 0);

                // Señales positivas cuando ElevenLabs no envía call_successful explícito
                $hasTranscriptArr = is_array($transcript) && count($transcript) > 0;
                $positiveStatus = in_array($statusLc, ['done','completed','finished','ended'], true);
                $positiveDuration = $durationSeconds >= 5;

                $callSuccessful = false;
                if (is_bool($callSuccessfulRaw)) {
                    $callSuccessful = $callSuccessfulRaw;
                } elseif (is_string($callSuccessfulRaw)) {
                    $lc = strtolower($callSuccessfulRaw);
                    $callSuccessful = in_array($lc, ['success','successful','yes','true','completed','done'], true);
                } else {
                    // Inferir éxito si hubo conversación real aunque falte la bandera
                    $callSuccessful = $positiveStatus || $hasTranscriptArr || $positiveDuration;
                }

                // Persistir estado final
                if ($callSuccessful) {
                    $call->markAsCompleted(['analysis' => $analysis ?? null], $durationSeconds);
                } else {
                    // Conservar detalle de motivo para diagnóstico en UI/logs
                    $failReason = 'call_unsuccessful_or_unknown';
                    if (is_string($statusLc) && $statusLc !== '') {
                        $failReason .= "|status={$statusLc}";
                    }
                    if (!$hasTranscriptArr) {
                        $failReason .= '|no_transcript';
                    }
                    if ($durationSeconds <= 0) {
                        $failReason .= '|zero_duration';
                    }
                    $call->markAsFailed(VoiceCampaignCall::RESULT_REJECTED, $failReason);
                }

                // Calcular y persistir costos (ElevenLabs + Twilio) y totales
                try {
                    $creditRate = (float) env('ELEVENLABS_CREDIT_USD_RATE', 0.000198);
                    $twilioRatePerMin = (float) env('TWILIO_USD_PER_MIN', 0.0287);
                    $trm = (float) env('COP_TRM_RATE', 4500);
                    $markupPercent = (float) env('VOICE_MARKUP_PERCENT', 40);

                    // ElevenLabs credits (varias posibles claves en metadata/analysis)
                    $credits = (float) (
                        data_get($metadata, 'cost_credits') ??
                        data_get($metadata, 'cost') ??
                        data_get($analysis, 'credit_cost') ??
                        0
                    );
                    $elevenUsd = round($credits * $creditRate, 6);

                    // Si viene costo directo en USD, usarlo con prioridad
                    $costUsdDirect = data_get($metadata, 'cost_usd');
                    if (is_numeric($costUsdDirect)) {
                        $elevenUsd = round((float) $costUsdDirect, 6);
                    }

                    // Twilio costo por minutos completos
                    $twilioMinutes = $durationSeconds > 0 ? (int) ceil($durationSeconds / 60) : 0;
                    $twilioUsd = round($twilioMinutes * $twilioRatePerMin, 6);

                    // Totales
                    $totalUsd = round($elevenUsd + $twilioUsd, 6);
                    $totalWithMarkupUsd = round($totalUsd * (1 + ($markupPercent / 100)), 6);

                    // Valores en COP
                    $elevenCop = round($elevenUsd * $trm, 2);
                    $twilioCop = round($twilioUsd * $trm, 2);
                    $totalCop = round($totalUsd * $trm, 2);
                    $totalWithMarkupCop = round($totalWithMarkupUsd * $trm, 2);

                    $call->update([
                        'elevenlabs_credits' => $credits,
                        'elevenlabs_cost_usd' => $elevenUsd,
                        'elevenlabs_cost_cop' => $elevenCop,
                        'twilio_minutes' => $twilioMinutes,
                        'twilio_cost_usd' => $twilioUsd,
                        'twilio_cost_cop' => $twilioCop,
                        'total_cost_usd' => $totalUsd,
                        'total_cost_cop' => $totalCop,
                        'total_cost_with_markup_usd' => $totalWithMarkupUsd,
                        'total_cost_with_markup_cop' => $totalWithMarkupCop,
                    ]);
                } catch (\Throwable $e) {
                    Log::warning('⚠️ [ELEVENLABS COST] No se pudieron calcular costos', ['error' => $e->getMessage()]);
                }

                // Enviar WhatsApp si está configurado
                $this->handlePostCallWhatsApp($call);

                // Actualizar contadores de ejecución y campaña
                try {
                    $call->execution?->updateCounters();
                    $call->voiceCampaign?->updateCallCounters();
                } catch (\Throwable $e) {
                    Log::warning('⚠️ [VOICE CAMPAIGN] No se pudieron actualizar contadores', ['error' => $e->getMessage()]);
                }

                // Marcar ejecución/campaña como completadas si no quedan llamadas activas
                // IMPORTANTE: Solo para campañas sin triggers (immediate/scheduled finitas)
                try {
                    $activeStatuses = [
                        \App\Models\VoiceCampaignCall::STATUS_PENDING,
                        \App\Models\VoiceCampaignCall::STATUS_INITIATED,
                        \App\Models\VoiceCampaignCall::STATUS_RINGING,
                        \App\Models\VoiceCampaignCall::STATUS_ANSWERED,
                        \App\Models\VoiceCampaignCall::STATUS_IN_PROGRESS,
                    ];

                    $remainingInExec = $call->execution
                        ? $call->execution->calls()->whereIn('status', $activeStatuses)->count()
                        : 0;

                    if ($remainingInExec === 0) {
                        // Terminar ejecución
                        if ($call->execution && !$call->execution->isCompleted()) {
                            $call->execution->markAsCompleted();
                        }
                        
                        // Solo terminar campaña si NO tiene triggers activos (campañas finitas)
                        $campaign = $call->voiceCampaign;
                        if ($campaign && !$campaign->isCompleted()) {
                            $hasTriggers = \App\Models\VoiceCampaignTrigger::where('voice_campaign_id', $campaign->id)
                                ->where('enabled', true)
                                ->exists();
                            
                            if (!$hasTriggers) {
                                // Campaña sin triggers: verificar si no quedan llamadas activas y marcar como completada
                                $remainingInCampaign = $campaign->calls()->whereIn('status', $activeStatuses)->count();
                                if ($remainingInCampaign === 0) {
                                    $campaign->markAsCompleted();
                                    Log::info('✅ [VOICE CAMPAIGN] Campaña sin triggers completada', [
                                        'campaign_id' => $campaign->id,
                                        'campaign_name' => $campaign->name
                                    ]);
                                }
                            } else {
                                // Campaña con triggers: mantener activa (running) para futuros eventos
                                Log::info('ℹ️ [VOICE CAMPAIGN] Campaña con triggers permanece activa', [
                                    'campaign_id' => $campaign->id,
                                    'campaign_name' => $campaign->name,
                                    'active_triggers' => $hasTriggers
                                ]);
                            }
                        }
                    }
                } catch (\Throwable $e) {
                    Log::warning('⚠️ [VOICE CAMPAIGN] No se pudo evaluar cierre de ejecución/campaña', ['error' => $e->getMessage()]);
                }
            }

            return response()->json(['success' => true]);
        } catch (\Throwable $e) {
            Log::error('❌ [ELEVENLABS WEBHOOK] Error procesando webhook', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['success' => false, 'message' => 'Error interno'], 500);
        }
    }

    /**
     * Detectar si un texto está en inglés (heurística simple)
     */
    private function isEnglish(string $text): bool
    {
        // Palabras comunes en inglés que no existen en español
        $englishWords = ['the', 'and', 'was', 'were', 'have', 'has', 'been', 'will', 'would', 'could', 'should', 'their', 'there', 'they'];
        $textLower = strtolower($text);
        
        $englishWordCount = 0;
        foreach ($englishWords as $word) {
            if (preg_match('/\b' . $word . '\b/', $textLower)) {
                $englishWordCount++;
            }
        }
        
        // Si encuentra 2 o más palabras en inglés, probablemente está en inglés
        return $englishWordCount >= 2;
    }

    /**
     * Traducir texto al español usando DeepSeek/AI configurado
     */
    private function translateToSpanish(string $text): string
    {
        try {
            $aiApiKey = env('AI_API_KEY', env('DEEPSEEK_API_KEY'));
            $aiApiUrl = env('AI_API_URL', env('DEEPSEEK_API_URL', 'https://api.deepseek.com/v1/chat/completions'));
            
            if (!$aiApiKey || !$aiApiUrl) {
                Log::warning('⚠️ [TRANSLATION] API keys no configuradas', [
                    'has_ai_key' => !empty($aiApiKey),
                    'has_ai_url' => !empty($aiApiUrl)
                ]);
                return $text; // Sin traducción si no hay API configurada
            }

            Log::info('🌐 [TRANSLATION] Iniciando traducción', [
                'text_length' => strlen($text),
                'text_preview' => substr($text, 0, 100)
            ]);

            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $aiApiKey,
                'Content-Type' => 'application/json',
            ])->timeout(15)->post($aiApiUrl, [
                'model' => env('AI_MODEL', 'deepseek-chat'),
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'Eres un traductor profesional. Traduce el texto al español de forma natural y fluida. Responde SOLO con la traducción, sin explicaciones adicionales.'
                    ],
                    [
                        'role' => 'user',
                        'content' => "Traduce este texto al español:\n\n{$text}"
                    ]
                ],
                'temperature' => 0.3,
                'max_tokens' => 1000
            ]);

            if ($response->successful()) {
                $result = $response->json();
                $translated = $result['choices'][0]['message']['content'] ?? $text;
                $cleanTranslated = trim($translated);
                
                Log::info('✅ [TRANSLATION] Traducción exitosa', [
                    'original_length' => strlen($text),
                    'translated_length' => strlen($cleanTranslated)
                ]);
                
                return $cleanTranslated;
            } else {
                Log::warning('⚠️ [TRANSLATION] API respondió con error', [
                    'status' => $response->status(),
                    'body' => $response->body()
                ]);
            }

            return $text;
        } catch (\Throwable $e) {
            Log::error('❌ [TRANSLATION] Error traduciendo con DeepSeek', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return $text;
        }
    }

    /**
     * Manejar envío de WhatsApp post-llamada
     */
    private function handlePostCallWhatsApp(VoiceCampaignCall $call): void
    {
        try {
            $meta = is_array($call->call_metadata) ? $call->call_metadata : [];
            $alreadySent = $meta['payment_link_sent_at'] ?? null;
            $scheduled = data_get($meta, 'payment_on_completion'); // Programado durante la llamada/tool

            if ($alreadySent) {
                Log::info('ℹ️ [WHATSAPP PAYMENT] Enlace ya enviado anteriormente', [
                    'call_id' => $call->id,
                    'sent_at' => $alreadySent
                ]);
                return;
            }

            $campaign = $call->voiceCampaign;
            $toolsCfg = is_array($campaign?->settings) ? ($campaign->settings['post_call_tools'] ?? null) : null;
            $whatsappCfg = is_array($toolsCfg) ? ($toolsCfg['whatsapp'] ?? null) : null;

            // Debemos enviar si:
            // - WhatsApp está habilitado en la campaña, o
            // - Existe un schedule explícito de envío programado (aunque la campaña no tenga WhatsApp habilitado)
            $shouldSend = (is_array($whatsappCfg) && ($whatsappCfg['enabled'] ?? false)) || is_array($scheduled);

            if (!$shouldSend) {
                return;
            }

            // Seleccionar número destino:
            // Prioridad: schedule.phone -> collected_data.phone -> número original
            $waPhone = (string) $call->recipient_phone;
            try {
                $scheduledPhone = is_array($scheduled) ? ($scheduled['phone'] ?? null) : null;
                $collectedPhone = data_get($meta, 'collected_data.phone.value');
                $rawPhone = $scheduledPhone ?: $collectedPhone ?: $waPhone;
                if (!empty($rawPhone)) {
                    $waPhone = $this->formatPhoneNumber((string) $rawPhone);
                }
            } catch (\Throwable $e) {
                // Si algo falla al leer/normalizar, mantén el número original
            }

            // Definir nombre del cliente y referencia
            $customerName = (string) (
                ($scheduled['customer_name'] ?? null) ?:
                ($call->recipient_name ?: 'Cliente')
            );
            $reference = (string) (
                ($scheduled['reference'] ?? null) ?:
                ('CONV-' . $call->elevenlabs_conversation_id)
            );

            // Definir monto: priorizar schedule.amount_cop, luego datos recolectados (debt_amount), luego default
            $amountCop = 125000;
            if (is_array($scheduled) && isset($scheduled['amount_cop'])) {
                $amountCop = (int) $scheduled['amount_cop'];
            } else {
                $collectedDebt = data_get($meta, 'collected_data.debt_amount.value');
                if (is_numeric($collectedDebt)) {
                    $amountCop = (int) $collectedDebt;
                }
            }

            // Resolver instancia: usar la configurada, o auto-asignar una conectada si falta
            $instanceId = is_array($whatsappCfg) ? ($whatsappCfg['instance_id'] ?? null) : null;
            if (empty($instanceId)) {
                try {
                    $waBase = rtrim(env('WHATSAPP_SERVICE_URL', 'http://localhost:3000/api/v1'), '/');
                    $resp = \Illuminate\Support\Facades\Http::retry(2, 500)->get($waBase . '/instances');
                    if ($resp->ok() && ($resp->json('success'))) {
                        $instances = $resp->json('instances') ?? [];
                        $connected = collect($instances)->firstWhere('connected', true);
                        if ($connected && !empty($connected['instanceId'])) {
                            $instanceId = $connected['instanceId'];
                        }
                    }
                } catch (\Throwable $e) {
                    // No bloquear por no poder resolver instancia
                }
            }

            // Template
            $template = is_array($whatsappCfg) ? ($whatsappCfg['template'] ?? null) : null;

            Log::info('📱 [WHATSAPP PAYMENT] Intentando enviar enlace de pago', [
                'call_id' => $call->id,
                'conversation_id' => $call->elevenlabs_conversation_id,
                'phone_selected' => $waPhone,
                'phone_original' => $call->recipient_phone,
                'customer_name' => $customerName,
                'amount_cop' => $amountCop,
                'reference' => $reference,
                'broker_id' => $call->broker_id,
                'instance_id' => $instanceId,
                'scheduled' => (bool) $scheduled,
            ]);

            $success = $this->sendWhatsAppPaymentLink(
                (int) $call->broker_id,
                (string) $waPhone,
                (string) $customerName,
                (int) $amountCop,
                (string) $reference,
                (string) $call->elevenlabs_conversation_id,
                $instanceId,
                $template
            );

            if ($success) {
                $meta['payment_link_sent_at'] = now()->toDateTimeString();
                // Guardar parámetros utilizados para trazabilidad
                $meta['payment_link_params'] = [
                    'phone' => $waPhone,
                    'amount_cop' => $amountCop,
                    'customer_name' => $customerName,
                    'reference' => $reference,
                    'instance_id' => $instanceId,
                ];
                $call->update(['call_metadata' => $meta]);
                Log::info('✅ [WHATSAPP PAYMENT] Enlace enviado exitosamente', [
                    'call_id' => $call->id,
                    'phone' => $waPhone
                ]);
            } else {
                Log::warning('❌ [WHATSAPP PAYMENT] Falló envío de WhatsApp', [
                    'call_id' => $call->id,
                    'phone' => $waPhone
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('❌ [WHATSAPP PAYMENT] Error enviando link', [
                'call_id' => $call->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Extracción dinámica de datos desde transcript
     */
    private function extractCollectedData(string $text, array $allowedCollect = []): array
    {
        $result = [];
        
        // Si no hay configuración específica, usar campos por defecto
        if (empty($allowedCollect)) {
            $allowedCollect = [
                'email' => ['enabled' => true],
                'document_id' => ['enabled' => true],
                'address' => ['enabled' => true],
                'phone' => ['enabled' => true]
            ];
        }

        foreach ($allowedCollect as $fieldName => $config) {
            if (!is_array($config) || !($config['enabled'] ?? false)) {
                continue;
            }

            $fieldType = $config['type'] ?? $fieldName;
            $customPattern = $config['pattern'] ?? null;
            $confidence = (float) ($config['confidence'] ?? 0.7);

            $extracted = $this->extractFieldByType($text, $fieldType, $customPattern, $confidence);
            if ($extracted) {
                $result[$fieldName] = $extracted;
            }
        }

        return $result;
    }

    /**
     * Extrae un campo específico basado en su tipo
     */
    private function extractFieldByType(string $text, string $fieldType, ?string $customPattern = null, float $confidence = 0.7): ?array
    {
        // Si hay un patrón personalizado, usarlo
        if ($customPattern) {
            if (preg_match('/' . $customPattern . '/i', $text, $matches)) {
                return [
                    'value' => trim($matches[1] ?? $matches[0]),
                    'confidence' => $confidence,
                    'source' => 'custom_pattern',
                    'pattern_used' => $customPattern
                ];
            }
            return null;
        }

        // Patrones predefinidos por tipo
        switch ($fieldType) {
            case 'email':
                if (preg_match('/([a-zA-Z0-9_\.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9\.-]+)/', $text, $m)) {
                    return ['value' => $m[1], 'confidence' => 0.8, 'source' => 'email_pattern'];
                }
                break;

            case 'document_id':
            case 'cedula':
                if (preg_match('/\b(\d{6,12})\b/', $text, $m)) {
                    return ['value' => $m[1], 'confidence' => 0.6, 'source' => 'document_pattern'];
                }
                break;

            case 'address':
            case 'direccion':
                if (preg_match('/\b(Calle|Cra\.?|Carrera|Avenida|Av\.?|Transversal|Diagonal)\s+[^\n,]{3,80}/i', $text, $m)) {
                    return ['value' => trim($m[0]), 'confidence' => 0.5, 'source' => 'address_pattern'];
                }
                break;

            case 'phone':
            case 'telefono':
                if (preg_match('/\b3\d{9}\b/', $text, $m)) {
                    return ['value' => $m[0], 'confidence' => 0.7, 'source' => 'phone_pattern'];
                }
                break;

            case 'name':
            case 'nombre':
                if (preg_match('/(?:me llamo|soy|mi nombre es)\s+([A-Za-záéíóúñ\s]{2,30})/i', $text, $m)) {
                    return ['value' => trim($m[1]), 'confidence' => 0.6, 'source' => 'name_pattern'];
                }
                break;

            case 'age':
            case 'edad':
                if (preg_match('/(?:tengo|edad|años?)\s*(\d{1,3})\s*(?:años?|year)/i', $text, $m)) {
                    return ['value' => (int)$m[1], 'confidence' => 0.7, 'source' => 'age_pattern'];
                }
                break;

            case 'date':
            case 'fecha':
                if (preg_match('/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/', $text, $m)) {
                    return ['value' => $m[0], 'confidence' => 0.6, 'source' => 'date_pattern'];
                }
                break;

            case 'amount':
            case 'monto':
                if (preg_match('/(?:\$|pesos?)\s*([0-9,\.]+)/', $text, $m)) {
                    return ['value' => $m[1], 'confidence' => 0.7, 'source' => 'amount_pattern'];
                }
                break;

            case 'yes_no':
            case 'si_no':
                if (preg_match('/\b(sí|si|yes|no|not?)\b/i', $text, $m)) {
                    $value = strtolower($m[1]);
                    $normalized = in_array($value, ['sí', 'si', 'yes']) ? 'yes' : 'no';
                    return ['value' => $normalized, 'confidence' => 0.8, 'source' => 'yes_no_pattern'];
                }
                break;

            case 'custom_text':
            default:
                // Para campos de texto libre, buscar después de palabras clave
                $keywords = ['es', 'son', 'tengo', 'mi', 'el', 'la'];
                foreach ($keywords as $keyword) {
                    if (preg_match('/\b' . $keyword . '\s+([^\n\.,]{2,50})/i', $text, $m)) {
                        return ['value' => trim($m[1]), 'confidence' => 0.4, 'source' => 'text_pattern'];
                    }
                }
                break;
        }

        return null;
    }

    /**
     * Enviar enlace de pago por WhatsApp
     */
    private function sendWhatsAppPaymentLink(int $brokerId, string $phone, string $customerName, int $amountCop, string $reference, string $conversationId, ?string $instanceId = null, ?string $template = null): bool
    {
        try {
            $waBase = rtrim(env('WHATSAPP_SERVICE_URL', 'http://localhost:3000/api/v1'), '/');
            $basePayUrl = env('PAYMENT_BASE_URL', 'https://pay.guro.app/pay');
            $paymentUrl = $basePayUrl . '?' . http_build_query([
                'ref' => $reference,
                'amount' => $amountCop,
                'conv' => $conversationId,
                'broker' => $brokerId,
            ]);

            $defaultMessage = "Hola {$customerName}, te compartimos tu enlace de pago: {$paymentUrl} \n\nSi necesitas ayuda, responde a este mensaje.";
            $message = $template ? strtr($template, [
                '{customer_name}' => $customerName,
                '{amount_cop}' => (string) $amountCop,
                '{reference}' => $reference,
                '{payment_link}' => $paymentUrl,
            ]) : $defaultMessage;

            if ($instanceId) {
                $url = $waBase . '/instances/' . $instanceId . '/send-message';
                $resp = FacadesHttp::retry(2, 500)->post($url, [
                    'phone' => $phone,
                    'message' => $message,
                    'options' => [ 'broker_id' => $brokerId, 'label' => 'payment_link' ]
                ]);
                return $resp->ok() && (bool) ($resp->json('success'));
            }

            // Legacy endpoint
            $payload = [
                'phone' => $phone,
                'message' => $message,
                'options' => [ 'broker_id' => $brokerId, 'label' => 'payment_link' ]
            ];
            $legacyUrl = $waBase . '/messages/send';
            $resp = FacadesHttp::retry(2, 500)->post($legacyUrl, $payload);
            return $resp->ok() && (bool) ($resp->json('success'));

        } catch (\Throwable $e) {
            Log::error('❌ [WHATSAPP PAYMENT] Error en helper sendWhatsAppPaymentLink', [ 'error' => $e->getMessage() ]);
            return false;
        }
    }

    /**
     * Ejecutar una campaña de voz (lógica interna)
     */
    private function executeVoiceCampaign(VoiceCampaign $campaign): VoiceCampaignExecution
    {
        Log::info('🔊 [VOICE EXECUTION] Starting campaign execution', [
            'campaign_id' => $campaign->id,
            'campaign_name' => $campaign->name,
            'total_contacts' => count($campaign->contacts)
        ]);

        // Crear ejecución
        $execution = VoiceCampaignExecution::create([
            'voice_campaign_id' => $campaign->id,
            'broker_id' => $campaign->broker_id,
            'execution_date' => now(),
            'status' => VoiceCampaignExecution::STATUS_PENDING,
            'started_at' => now(),
            'targets_found' => count($campaign->contacts),
            'elevenlabs_agent_id_used' => $campaign->elevenlabs_agent_id,
            'elevenlabs_phone_number_id_used' => $campaign->elevenlabs_phone_number_id
        ]);

        // Marcar campaña como activa
        $campaign->markAsStarted();
        $execution->markAsStarted();

        // Ejecutar llamadas
        $successCount = 0;
        $failedCount = 0;

        foreach ($campaign->contacts as $contact) {
            try {
                $formattedPhone = $this->formatPhoneNumber($contact['phone']);
                
                // Procesar variables dinámicas en el mensaje
                $personalizedMessage = $this->processMessageVariables(
                    $campaign->voice_message_template, 
                    $contact
                );

                // Crear registro de llamada
                $call = VoiceCampaignCall::create([
                    'voice_campaign_id' => $campaign->id,
                    'voice_campaign_execution_id' => $execution->id,
                    'broker_id' => $campaign->broker_id,
                    'recipient_phone' => $formattedPhone,
                    'recipient_name' => $contact['name'] ?? null,
                    'voice_message_content' => $personalizedMessage,
                    'status' => VoiceCampaignCall::STATUS_PENDING,
                    'elevenlabs_agent_id' => $campaign->elevenlabs_agent_id,
                    'elevenlabs_phone_number_id' => $campaign->elevenlabs_phone_number_id
                ]);

                // Realizar llamada con ElevenLabs
                $callResult = $this->makeElevenLabsCall(
                    $formattedPhone,
                    $personalizedMessage,
                    $contact,
                    $campaign->elevenlabs_agent_id,
                    $campaign->elevenlabs_phone_number_id,
                    $campaign->elevenlabs_voice_id,
                    $campaign->voice_settings,
                    $campaign->agent_name,
                    is_array($campaign->settings) ? data_get($campaign->settings, 'post_call_tools.collect', null) : null,
                    $campaign
                );

                if ($callResult['success']) {
                    $successCount++;
                    $call->markAsInitiated($callResult['call_id']);
                    $call->updateElevenLabsInfo($callResult['response_data']);
                } else {
                    $failedCount++;
                    $call->markAsFailed(VoiceCampaignCall::RESULT_API_ERROR, $callResult['error']);
                }

                // Pausa entre llamadas
                usleep(500000); // 0.5 segundos

            } catch (\Exception $callError) {
                $failedCount++;
                Log::error('🔊 [VOICE CALL] Error processing call', [
                    'contact' => $contact,
                    'error' => $callError->getMessage()
                ]);
            }
        }

        // Actualizar contadores de ejecución
        $execution->update([
            'calls_made' => $successCount + $failedCount,
            'calls_successful' => $successCount,
            'calls_failed' => $failedCount
        ]);
        
        // Actualizar campaña
        $campaign->update([
            'calls_made' => $successCount + $failedCount,
            'calls_successful' => $successCount,
            'calls_failed' => $failedCount
        ]);

        return $execution;
    }

    /**
     * Realizar llamada usando ElevenLabs ConvoAI
     */
    private function makeElevenLabsCall(
        string $phone,
        string $message,
        array $contact,
        ?string $agentId = null,
        ?string $phoneNumberId = null,
        ?string $voiceId = null,
        ?array $voiceSettings = null,
        ?string $agentName = null,
        ?array $collectConfig = null,
        $campaign = null
    ): array {
        try {
            $elevenLabsApiKey = env('ELEVENLABS_API_KEY');
            $agentId = $agentId ?: env('ELEVENLABS_AGENT_ID');
            $phoneNumberId = $phoneNumberId ?: env('ELEVENLABS_PHONE_NUMBER_ID');

            if (!$elevenLabsApiKey || !$agentId || !$phoneNumberId) {
                throw new \Exception('ElevenLabs configuration missing');
            }

            // Obtener nombre comercial del broker
            $broker = null;
            if ($campaign && $campaign->broker_id) {
                $broker = Broker::find($campaign->broker_id);
            }
            $brokerCommercialName = $broker?->name ?? env('DEFAULT_COMPANY_NAME', 'GURO Seguros');
            
            // IMPORTANTE: Usar siempre el nombre del broker, no el del contacto
            // El contacto puede tener company_name de la aseguradora, no de la agencia
            $companyName = $brokerCommercialName;
            
            Log::info('🏢 [VOICE CAMPAIGN] Nombre de empresa para llamada', [
                'broker_id' => $campaign->broker_id ?? null,
                'broker_name' => $broker?->name,
                'brokerCommercialName' => $brokerCommercialName,
                'companyName_final' => $companyName,
            ]);
            $policyNumber  = $contact['policy_number'] ?? data_get($contact, 'custom_data.policy_number') ?? 'N/A';
            $debtAmountRaw = $contact['debt_amount'] ?? data_get($contact, 'custom_data.debt_amount') ?? 0;
            $dueDate       = $contact['payment_due_date'] ?? data_get($contact, 'custom_data.payment_due_date') ?? Carbon::now()->addDays(5)->format('Y-m-d');
            $customerName  = $contact['name'] ?? data_get($contact, 'custom_data.customer_name') ?? 'Cliente';

            $dynamicVars = [
                // snake_case (recomendado)
                'customer_name'    => $customerName,
                'company_name'     => $companyName,
                'policy_number'    => (string) $policyNumber,
                'debt_amount'      => is_numeric($debtAmountRaw) ? (float) $debtAmountRaw : (string) $debtAmountRaw,
                'payment_due_date' => (string) $dueDate,
                // aliases más comunes para compatibilidad con distintos agentes (camelCase y variantes)
                'user_name'        => $customerName,
                'client_name'      => $customerName,
                'customerName'     => $customerName,
                'companyName'      => $companyName,
                'policyNumber'     => (string) $policyNumber,
                'paymentDueDate'   => (string) $dueDate,
                'debtAmount'       => is_numeric($debtAmountRaw) ? (float) $debtAmountRaw : (string) $debtAmountRaw,
            ];

            // Construir instrucción de recolección de datos basada en configuración de campaña
            $collectInstruction = '';
            try {
                $enabledFields = [];
                if (is_array($collectConfig)) {
                    foreach ($collectConfig as $fname => $cfg) {
                        if (is_array($cfg) && ($cfg['enabled'] ?? false)) {
                            $enabledFields[] = $fname;
                        }
                    }
                }
                if (!empty($enabledFields)) {
                    $collectInstruction =
                        "Durante la llamada, solicita y confirma los siguientes datos del cliente: " .
                        implode(', ', $enabledFields) .
                        ". Cuando el usuario proporcione un dato, repítelo y confírmalo. " .
                        "Pronuncia los datos usando el formato 'campo: valor' por ejemplo 'email: usuario@dominio.com', " .
                        "'número de documento: 123456789', 'address: Calle 10 # 20-30'. " .
                        "No finalices la llamada hasta intentar recolectar estos datos.";
                }
            } catch (\Throwable $e) {
                // no bloquear en caso de error al construir instrucciones
            }

            // Detectar si WhatsApp está habilitado en la campaña
            $whatsappEnabled = false;
            $campaignSettings = is_array($campaign->settings) ? $campaign->settings : [];
            $postCallTools = $campaignSettings['post_call_tools'] ?? [];
            $whatsappConfig = $postCallTools['whatsapp'] ?? [];
            if (is_array($whatsappConfig) && ($whatsappConfig['enabled'] ?? false)) {
                $whatsappEnabled = true;
            }

            // Forzar un primer mensaje personalizado para dirigirse por el nombre del cliente
            $agentDisplayName = $agentName ?: 'tu asesor';
            $safeCompany = $companyName ?: $brokerCommercialName;
            $personalizedFirstMessage = "Hola {$customerName}, soy {$agentDisplayName} de {$safeCompany}. " .
                                        "Quería hablar contigo sobre tu póliza {$policyNumber}. ¿Te puedo contar los detalles?";

            // Construir instrucciones condicionales de WhatsApp
            $whatsappInstruccion = $whatsappEnabled
                ? " y pregunta si desea recibir el enlace de pago por WhatsApp. Si acepta, confirma el número de WhatsApp (puede ser el mismo de la llamada u otro)"
                : "";
            
            $whatsappCierre = $whatsappEnabled
                ? "\n   - Si el cliente aceptó recibir el enlace por WhatsApp, confirma el número"
                : "";
            
            $whatsappGuardrail = $whatsappEnabled
                ? "\n- Solo ofrece el envío por WhatsApp si el cliente lo acepta. Si no tiene WhatsApp, simplemente confirma la fecha de pago."
                : "\n- NO menciones WhatsApp en ningún momento. Solo confirma la fecha en que puede realizar el pago.";

            // Construir sección de cierre según si hay recolección de datos o no
            $hasDataCollection = !empty($collectInstruction);
            $cierreSection = $hasDataCollection
                ? "4) Cierre (recolección de datos al final):
   - Solo si corresponde y el cliente acepta continuar o finalizar, realiza la recolección de datos requerida.
   - Pide todos los datos en una sola tanda (no interrumpas el flujo con datos administrativos antes).
   - Anuncia la transición: \"Antes de finalizar, necesito confirmar unos datos cortos\".
   - Para cada dato activo, usa EXACTAMENTE el formato: \"campo: valor\"
     (ej.: \"email: usuario@dominio.com\", \"número de documento: 123456789\", \"address: Calle 10 # 20-30\").
   - Si ya obtuviste un dato durante la conversación, no lo repitas; confírmalo una única vez.{$whatsappCierre}
   - Al final, pregunta: \"¿Hay algo más en lo que pueda ayudarte?\" y ESPERA la respuesta del cliente.
   - Solo después de que el cliente responda (\"no\", \"nada más\", \"eso es todo\", etc.), despídete cordialmente."
                : "4) Cierre y despedida:
   - Una vez confirmada la acción (fecha de pago, compromiso, etc.), pregunta: \"¿Hay algo más en lo que pueda ayudarte?\"
   - IMPORTANTE: ESPERA a que el cliente responda antes de despedirte. No te despidas inmediatamente después de preguntar.
   - Solo cuando el cliente confirme que no necesita nada más, despídete cordialmente: \"Perfecto, {$customerName}. Muchas gracias por tu tiempo. Que tengas un excelente día. ¡Hasta pronto!\"{$whatsappCierre}
   - NO solicites datos adicionales si no están configurados.";

            $toolsSection = $hasDataCollection
                ? "# Tools
Usa estas instrucciones únicamente en el paso 4 (Cierre), no antes.
{$collectInstruction}"
                : "# Tools
No hay datos adicionales que recolectar en esta llamada. Procede directamente al cierre y despedida una vez confirmada la acción del cliente.";

            // Prompt final con políticas conversacionales con estructura tipo ElevenLabs (personalizado a nuestro caso)
            $finalPrompt = trim("
# Personality
Eres {$agentDisplayName}, una asesora de {$safeCompany}. Tienes una personalidad amable, directa y resolutiva. Hablas español de Colombia.

# Environment
Estás realizando una llamada telefónica a un cliente. Mantente profesional y breve.
Datos de contexto disponibles (si aplican):
- Cliente: {$customerName}
- Póliza: {$policyNumber}
- Fecha límite: {$dueDate}
- Deuda estimada: {$debtAmountRaw}
- Contexto de campaña: {$message}

# Tone
Mantén respuestas cortas y directas (máximo 2-3 oraciones). Evita repetir lo que ya se dijo; reformula solo si el cliente no entendió.

# Goal
Tu objetivo es que el cliente entienda claramente el motivo de la llamada (recordatorio de pago), defina el siguiente paso (pago ahora o cuándo){$whatsappInstruccion}. Si no es inmediato, confirma fecha tentativa de pago.

Plan de conversación y orden:
1) Apertura (breve):
   - Saluda por el nombre del cliente y preséntate con el nombre del agente y la compañía.
   - INMEDIATAMENTE indica el motivo de la llamada en una sola oración.
2) Desarrollo (resolver el objetivo):
   - Atiende el objetivo principal primero (recordar vencimiento, falta de cobertura, opciones de pago).
   - Haz solo las preguntas estrictamente necesarias para avanzar la intención principal.
   - Evita repetir lo que ya se dijo; reformula solo si el cliente no entendió.
   - Mantén respuestas cortas y directas (máximo 2-3 oraciones).
3) Confirmación de decisiones (según políticas):
   - Confirma con el cliente la acción acordada (p. ej., envío del enlace por WhatsApp al mismo número u otro, compromiso de pago inmediato o fecha y recordatorio).
   - NO solicites datos aún. Primero cierra la decisión y recibe la respuesta del cliente.
{$cierreSection}
5) Si el cliente está ocupado:
   - Ofrece reagendar de forma proactiva y NO recolectes datos en ese momento.

# Guardrails
- Sé amable pero directa.
- No uses tecnicismos innecesarios.
- Si el cliente está molesto, no presiones.
- Usa el nombre del cliente una vez que lo sepas.
- No repitas información salvo para confirmar una única vez.
- No enumeres opciones extensas; entrega la información esencial.
- Mantén el control del flujo y redirige con suavidad si el cliente se desvía.
- No pidas datos administrativos hasta el cierre, salvo que sean imprescindibles para avanzar.
- Siempre usa español de Colombia.{$whatsappGuardrail}
- CRÍTICO: NUNCA termines la llamada sin una despedida cordial.
- La despedida es OBLIGATORIA en todas las llamadas, sin excepción.
- IMPORTANTE: Cuando preguntes \"¿Hay algo más en lo que pueda ayudarte?\", ESPERA a que el cliente responda. No hables encima de su respuesta.
- Solo después de que el cliente confirme que no necesita nada más (\"no\", \"no gracias\", \"eso es todo\", \"nada más\"), despídete cordialmente: \"Perfecto, muchas gracias por tu tiempo. Que tengas un excelente día. ¡Hasta pronto!\"
- NO te despidas mientras el cliente aún está hablando o antes de que responda a tu pregunta.

{$toolsSection}
");

            // Payload para ElevenLabs (Twilio Outbound) con overrides y variables dinámicas
            $payload = [
                'agent_id' => $agentId,
                'agent_phone_number_id' => $phoneNumberId,
                'to_number' => $phone,
                // Suministrar variables para placeholders del agente
                'dynamic_variables' => $dynamicVars,
                // Redundancia: enviar overrides a nivel raíz (algunos entornos los requieren)
                'conversation_config_override' => [
                    'agent' => [
                        'prompt' => [
                            'prompt' => $finalPrompt
                        ],
                        // Enviar ambas variantes por compatibilidad
                        'first_message' => $personalizedFirstMessage,
                        'firstMessage' => $personalizedFirstMessage,
                        'language' => 'es'
                    ],
                    'tts' => [
                        'voice_id' => $voiceId ?: null,
                    ]
                ],
                // Versión oficial usando conversation_initiation_client_data
                'conversation_initiation_client_data' => [
                    'conversation_config_override' => [
                        'agent' => [
                            // Prompt contextual + instrucciones de recolección
                            'prompt' => [
                                'prompt' => $finalPrompt
                            ],
                            // Forzar saludo inicial personalizado por nombre (ambas variantes)
                            'first_message' => $personalizedFirstMessage,
                            'firstMessage' => $personalizedFirstMessage,
                            'language' => 'es'
                        ],
                        'tts' => [
                            'voice_id' => $voiceId ?: null,
                        ]
                    ],
                    // Variables redundantes para compatibilidad
                    'custom_variables' => [
                        'customer_name' => $customerName,
                        'phone_number' => $contact['phone'] ?? '',
                        'email' => $contact['email'] ?? '',
                        'company_name' => $companyName,
                        'policy_number' => (string) $policyNumber,
                        'payment_due_date' => (string) $dueDate,
                    ],
                    'temperature' => 0.4
                ],
                // Alias de overrides según documentación del SDK/Widget (algunos entornos requieren esta clave)
                'overrides' => [
                    'agent' => [
                        'prompt' => [
                            'prompt' => trim("Eres un asistente virtual profesional de una compañía de seguros.
Contexto de campaña: {$message}
{$collectInstruction}")
                        ],
                        'first_message' => $personalizedFirstMessage,
                        'firstMessage' => $personalizedFirstMessage,
                        'language' => 'es'
                    ],
                    'tts' => [
                        'voice_id' => $voiceId ?: null,
                        'voiceId' => $voiceId ?: null,
                    ]
                ],
                'metadata' => [
                    'contact_name' => $customerName,
                    'campaign_type' => 'voice_campaign',
                    'dynamic_variables_sent' => array_keys($dynamicVars),
                    'collect_instruction' => !empty($collectInstruction),
                ]
            ];

            Log::info('🔊 [ELEVENLABS API] Enviando llamada con overrides + dynamic_variables', [
                'to' => $phone,
                'agent_id' => $agentId,
                'vars' => $dynamicVars,
                'first_message_preview' => mb_substr($personalizedFirstMessage, 0, 160),
                'voice_override' => (bool) $voiceId,
                'override_paths' => ['conversation_config_override', 'conversation_initiation_client_data.conversation_config_override']
            ]);

            // Realizar request a ElevenLabs
            $response = Http::withHeaders([
                'xi-api-key' => $elevenLabsApiKey,
                'Content-Type' => 'application/json'
            ])->timeout(30)->post('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', $payload);

            if ($response->successful()) {
                $responseData = $response->json();
                
                return [
                    'success' => true,
                    'call_id' => $responseData['conversation_id'] ?? $responseData['id'] ?? null,
                    'status' => $responseData['status'] ?? 'initiated',
                    'response_data' => $responseData
                ];
            } else {
                $errorMessage = $response->json()['detail'] ?? 'ElevenLabs API Error';
                
                return [
                    'success' => false,
                    'error' => $errorMessage,
                    'status_code' => $response->status()
                ];
            }

        } catch (\Exception $e) {
            Log::error('🔊 [ELEVENLABS API] Exception in call', [
                'phone' => $phone,
                'error' => $e->getMessage()
            ]);
            
            return [
                'success' => false,
                'error' => 'Connection error: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Formatear número de teléfono
     */
    private function formatPhoneNumber(string $phone): string
    {
        // Remover espacios y caracteres especiales excepto el +
        $phone = preg_replace('/[^0-9+]/', '', $phone);
        
        // Si ya tiene +, devolverlo tal como está
        if (substr($phone, 0, 1) === '+') {
            return $phone;
        }
        
        // Si ya empieza con 57, agregar solo el +
        if (substr($phone, 0, 2) === '57' && strlen($phone) == 12) {
            return '+' . $phone;
        }
        
        // Si no tiene código de país, agregar +57 para Colombia
        if (strlen($phone) == 10 && substr($phone, 0, 1) == '3') {
            $phone = '+57' . $phone;
        }
        
        return $phone;
    }

    /**
     * Procesar variables dinámicas en mensaje
     */
    private function processMessageVariables(string $messageTemplate, array $contact): string
    {
        // Variables estándar de clientes + variables de negocio usadas por el agente
        $availableVariables = [
            // Identidad
            'nombre' => $contact['name'] ?? $contact['nombre'] ?? $contact['first_name'] ?? '',
            'apellidos' => $contact['apellidos'] ?? $contact['last_name'] ?? '',
            'customer_name' => $contact['name'] ?? (($contact['first_name'] ?? '') . ' ' . ($contact['last_name'] ?? '')) ?: 'Cliente',
            'first_name' => $contact['first_name'] ?? $contact['nombre'] ?? '',
            'last_name' => $contact['last_name'] ?? $contact['apellidos'] ?? '',
            // Contacto
            'email_principal' => $contact['email'] ?? $contact['email_principal'] ?? '',
            'email' => $contact['email'] ?? $contact['email_principal'] ?? '',
            'celular_principal' => $contact['phone'] ?? $contact['celular_principal'] ?? '',
            'phone' => $contact['phone'] ?? $contact['celular_principal'] ?? '',
            'ciudad' => $contact['ciudad'] ?? $contact['city'] ?? '',
            'city' => $contact['city'] ?? $contact['ciudad'] ?? '',
            // Negocio (para plantillas con placeholders)
            'company_name' => $contact['company_name'] ?? data_get($contact, 'custom_data.company_name') ?? '',
            'policy_number' => $contact['policy_number'] ?? data_get($contact, 'custom_data.policy_number') ?? '',
            'payment_due_date' => $contact['payment_due_date'] ?? data_get($contact, 'custom_data.payment_due_date') ?? '',
            'debt_amount' => (string) (data_get($contact, 'custom_data.debt_amount') ?? $contact['debt_amount'] ?? ''),
        ];

        $processedMessage = $messageTemplate;

        // Reemplazar cada variable encontrada
        foreach ($availableVariables as $variable => $value) {
            // Reemplazar formato {{variable}}
            $pattern1 = '/\{\{\s*' . preg_quote($variable, '/') . '\s*\}\}/';
            $processedMessage = preg_replace($pattern1, $value, $processedMessage);
            
            // Reemplazar formato {variable}
            $pattern2 = '/\{\s*' . preg_quote($variable, '/') . '\s*\}/';
            $processedMessage = preg_replace($pattern2, $value, $processedMessage);
        }

        return $processedMessage;
    }

    /**
     * Obtener historial de llamadas
     */
    public function getCallHistory(Request $request): JsonResponse
    {
        try {
            // Resolver broker_id de forma robusta para evitar 500 por null
            $brokerId = $this->getBrokerId($request);
            if (!$brokerId) {
                // Fallbacks: middleware unificado o usuario Firebase
                $brokerId = $request->get('authenticated_broker_id') ?: ($request->user()?->broker_id ?? null);
            }
            if (!$brokerId && app()->environment('local', 'development', 'testing')) {
                // En local permitir header de desarrollo
                $dev = (int) ($request->header('X-Dev-Broker-Id') ?: 0);
                if ($dev > 0) { $brokerId = $dev; }
            }
            if (!$brokerId) {
                // Devolver 200 con dataset vacío para no romper el frontend en local o entornos sin auth
                $limit = (int) $request->get('limit', 15);
                $offset = (int) $request->get('offset', 0);
                Log::warning('📞 [CALL HISTORY] Broker no resuelto, devolviendo dataset vacío');
                return response()->json([
                    'success' => true,
                    'data' => [],
                    'total' => 0,
                    'limit' => $limit,
                    'offset' => $offset
                ]);
            }
            $brokerId = (int) $brokerId;

            $query = VoiceCampaignCall::forBroker($brokerId)
                                     ->with([
                                         'voiceCampaign:id,name,elevenlabs_agent_id,agent_name',
                                         // Quitar success_rate (no es columna en BD). Seleccionar solo columnas reales.
                                         'execution:id,voice_campaign_id,broker_id,execution_date,status,started_at,completed_at,calls_made,calls_successful,calls_failed,total_duration_seconds,average_duration_seconds'
                                     ]);

            // Filtros opcionales
            if ($request->has('campaign_id')) {
                $query->where('voice_campaign_id', $request->campaign_id);
            }

            if ($request->has('status')) {
                $query->where('status', $request->status);
            }

            if ($request->has('phone')) {
                $query->where('recipient_phone', 'LIKE', '%' . $request->phone . '%');
            }

            // Paginación
            $limit = $request->get('limit', 15);
            $offset = $request->get('offset', 0);

            $calls = $query->orderBy('created_at', 'desc')
                          ->skip($offset)
                          ->take($limit)
                          ->get()
                          ->map(function ($call) {
                              $data = $call->getStats();
 
                              // Agregar bloque normalizado de costos (para consumo del frontend)
                              try {
                                  $trm = (float) (env('COP_TRM_RATE', 4500));
                                  $elevenUsd = (float) ($call->elevenlabs_cost_usd ?? 0);
                                  $twilioUsd = (float) ($call->twilio_cost_usd ?? 0);
                                  $totalUsd = (float) ($call->total_cost_usd ?? ($elevenUsd + $twilioUsd));
                                  $totalWithMarkupUsd = (float) ($call->total_cost_with_markup_usd ?? $totalUsd);
 
                                  $data['costs'] = [
                                      'elevenlabs_usd' => round($elevenUsd, 6),
                                      'elevenlabs_cop' => round($elevenUsd * $trm, 2),
                                      'elevenlabs_credits' => (float) ($call->elevenlabs_credits ?? 0),
                                      'twilio_usd' => round($twilioUsd, 6),
                                      'twilio_cop' => round($twilioUsd * $trm, 2),
                                      'twilio_minutes' => (int) ($call->twilio_minutes ?? 0),
                                      'total_usd' => round($totalUsd, 6),
                                      'total_cop' => round($totalUsd * $trm, 2),
                                      'total_with_markup_usd' => round($totalWithMarkupUsd, 6),
                                      'total_with_markup_cop' => round($totalWithMarkupUsd * $trm, 2),
                                      'cop_rate' => $trm,
                                  ];
                              } catch (\Throwable $e) {
                                  // Silencioso: si algo falla en costos, no bloquea el historial
                              }
 
                              // Agregar datos recolectados al reporte
                              if (is_array($call->call_metadata) && isset($call->call_metadata['collected_data'])) {
                                  $data['collected_data'] = $call->call_metadata['collected_data'];
                              }

                              // Agregar análisis de ElevenLabs si existe en call_result
                              if (is_array($call->call_result)) {
                                  $data['elevenlabs_analysis'] = $call->call_result;
                              }
 
                              return $data;
                          });

            $total = $query->count();

            return response()->json([
                'success' => true,
                'data' => $calls,
                'total' => $total,
                'limit' => $limit,
                'offset' => $offset
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener historial de llamadas',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener estadísticas de campañas de voz
     */
    public function getStats(Request $request): JsonResponse
    {
        try {
            // Resolver broker_id de forma robusta para evitar 500 por null
            $brokerId = $this->getBrokerId($request);
            if (!$brokerId) {
                $brokerId = $request->get('authenticated_broker_id') ?: ($request->user()?->broker_id ?? null);
            }
            if (!$brokerId && app()->environment('local', 'development', 'testing')) {
                $dev = (int) ($request->header('X-Dev-Broker-Id') ?: 0);
                if ($dev > 0) { $brokerId = $dev; }
            }
            if (!$brokerId) {
                Log::warning('📊 [VOICE STATS] Broker no resuelto, devolviendo estadísticas vacías');
                return response()->json([
                    'success' => true,
                    'data' => [
                        'total_campaigns' => 0,
                        'active_campaigns' => 0,
                        'completed_campaigns' => 0,
                        'total_calls_made' => 0,
                        'total_successful_calls' => 0,
                        'total_failed_calls' => 0,
                        'overall_success_rate' => 0
                    ]
                ]);
            }
            $brokerId = (int) $brokerId;

            $stats = [
                'total_campaigns' => VoiceCampaign::forBroker($brokerId)->count(),
                'active_campaigns' => VoiceCampaign::forBroker($brokerId)->active()->count(),
                'completed_campaigns' => VoiceCampaign::forBroker($brokerId)->withStatus(VoiceCampaign::STATUS_COMPLETED)->count(),
                'total_calls_made' => VoiceCampaign::forBroker($brokerId)->sum('calls_made'),
                'total_successful_calls' => VoiceCampaign::forBroker($brokerId)->sum('calls_successful'),
                'total_failed_calls' => VoiceCampaign::forBroker($brokerId)->sum('calls_failed'),
            ];

            $stats['overall_success_rate'] = $stats['total_calls_made'] > 0 ? 
                round(($stats['total_successful_calls'] / $stats['total_calls_made']) * 100, 2) : 0;

            return response()->json([
                'success' => true,
                'data' => $stats
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener estadísticas',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    /**
     * Pausar/Reanudar campañas (toggle)
     * PATCH /saas/voice-campaigns/{id}/toggle
     */
    public function toggle(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = (int) $this->getBrokerId($request);
            /** @var VoiceCampaign|null $campaign */
            $campaign = VoiceCampaign::forBroker($brokerId)->where('id', $id)->first();

            if (!$campaign) {
                return response()->json(['success' => false, 'message' => 'Campaña no encontrada'], 404);
            }

            $newActive = !$campaign->is_active;
            $newStatus = $newActive ? VoiceCampaign::STATUS_RUNNING : VoiceCampaign::STATUS_PAUSED;

            $campaign->update([
                'is_active' => $newActive,
                'status' => $newStatus,
                'last_execution' => now(),
            ]);

            // Habilitar/Deshabilitar los triggers asociados
            $this->setTriggersEnabled((int)$campaign->id, $newActive);

            // Si pausamos, cancelar llamadas activas de esta campaña
            if (!$newActive) {
                $cancelled = $this->cancelActiveCalls((int)$campaign->id);
                \Log::info('🔇 [VOICE CAMPAIGN] Campaña pausada, llamadas canceladas', [
                    'campaign_id' => $campaign->id,
                    'cancelled_active_calls' => $cancelled,
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => $newActive ? 'Campaña reanudada' : 'Campaña pausada',
                'data' => [
                    'campaign' => $campaign->fresh(),
                    'stats' => $campaign->getStats(),
                ],
            ]);
        } catch (\Throwable $e) {
            \Log::error('❌ [VOICE CAMPAIGN] Error en toggle', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error al actualizar estado'], 500);
        }
    }

    /**
     * Pausar campaña explícitamente
     * POST /saas/voice-campaigns/{id}/pause (si agregas la ruta)
     */
    public function pause(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = (int) $this->getBrokerId($request);
            $campaign = VoiceCampaign::forBroker($brokerId)->where('id', $id)->first();

            if (!$campaign) {
                return response()->json(['success' => false, 'message' => 'Campaña no encontrada'], 404);
            }

            $campaign->update([
                'is_active' => false,
                'status' => VoiceCampaign::STATUS_PAUSED,
                'last_execution' => now(),
            ]);

            $this->setTriggersEnabled((int)$campaign->id, false);
            $cancelled = $this->cancelActiveCalls((int)$campaign->id);

            return response()->json([
                'success' => true,
                'message' => 'Campaña pausada',
                'data' => [
                    'campaign' => $campaign->fresh(),
                    'cancelled_active_calls' => $cancelled,
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => 'Error al pausar campaña'], 500);
        }
    }

    /**
     * Reanudar campaña explícitamente
     * POST /saas/voice-campaigns/{id}/resume (si agregas la ruta)
     */
    public function resume(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = (int) $this->getBrokerId($request);
            $campaign = VoiceCampaign::forBroker($brokerId)->where('id', $id)->first();

            if (!$campaign) {
                return response()->json(['success' => false, 'message' => 'Campaña no encontrada'], 404);
            }

            $campaign->update([
                'is_active' => true,
                'status' => VoiceCampaign::STATUS_RUNNING,
                'last_execution' => now(),
            ]);

            $this->setTriggersEnabled((int)$campaign->id, true);

            return response()->json([
                'success' => true,
                'message' => 'Campaña reanudada',
                'data' => $campaign->fresh(),
            ]);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => 'Error al reanudar campaña'], 500);
        }
    }

    /**
     * Cancelar campaña (no elimina, deja estado final)
     * POST /saas/voice-campaigns/{id}/cancel (si agregas la ruta)
     */
    public function cancel(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = (int) $this->getBrokerId($request);
            $campaign = VoiceCampaign::forBroker($brokerId)->where('id', $id)->first();

            if (!$campaign) {
                return response()->json(['success' => false, 'message' => 'Campaña no encontrada'], 404);
            }

            $campaign->update([
                'is_active' => false,
                'status' => VoiceCampaign::STATUS_CANCELLED,
                'last_execution' => now(),
            ]);

            $this->setTriggersEnabled((int)$campaign->id, false);
            $cancelled = $this->cancelActiveCalls((int)$campaign->id);

            return response()->json([
                'success' => true,
                'message' => 'Campaña cancelada',
                'data' => [
                    'campaign' => $campaign->fresh(),
                    'cancelled_active_calls' => $cancelled,
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => 'Error al cancelar campaña'], 500);
        }
    }

    /**
     * Eliminar campaña
     * DELETE /saas/voice-campaigns/{id}
     * Parámetro opcional: force=true para forzar cancelación y eliminación
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = (int) $this->getBrokerId($request);
            /** @var VoiceCampaign|null $campaign */
            $campaign = VoiceCampaign::forBroker($brokerId)->where('id', $id)->first();

            if (!$campaign) {
                return response()->json(['success' => false, 'message' => 'Campaña no encontrada'], 404);
            }

            $isRunning = $campaign->isInProgress();
            $force = $request->boolean('force', false);

            if ($isRunning && !$force) {
                return response()->json([
                    'success' => false,
                    'message' => 'La campaña está en ejecución. Pausa o usa force=true para eliminar.'
                ], 409);
            }

            // Deshabilitar triggers y cancelar llamadas activas antes de eliminar
            $this->setTriggersEnabled((int)$campaign->id, false);
            $this->cancelActiveCalls((int)$campaign->id);

            $campaign->delete();

            return response()->json(['success' => true, 'message' => 'Campaña eliminada']);
        } catch (\Throwable $e) {
            \Log::error('❌ [VOICE CAMPAIGN] Error al eliminar', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error al eliminar campaña'], 500);
        }
    }

    // =========================
    // Helpers internos de control
    // =========================

    /**
     * Habilitar/Deshabilitar todos los triggers de una campaña
     */
    private function setTriggersEnabled(int $campaignId, bool $enabled): void
    {
        try {
            VoiceCampaignTrigger::where('voice_campaign_id', $campaignId)
                ->update(['enabled' => $enabled, 'updated_by' => auth()->id()]);
        } catch (\Throwable $e) {
            \Log::warning('⚠️ [VOICE CAMPAIGN] No se pudieron actualizar triggers', [
                'campaign_id' => $campaignId,
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Cancelar llamadas activas de una campaña (evita conflictos cuando hay varias campañas)
     * Retorna cantidad de registros afectados.
     */
    private function cancelActiveCalls(int $campaignId): int
    {
        try {
            $active = [
                VoiceCampaignCall::STATUS_PENDING,
                VoiceCampaignCall::STATUS_INITIATED,
                VoiceCampaignCall::STATUS_RINGING,
                VoiceCampaignCall::STATUS_ANSWERED,
                VoiceCampaignCall::STATUS_IN_PROGRESS,
            ];

            return VoiceCampaignCall::where('voice_campaign_id', $campaignId)
                ->whereIn('status', $active)
                ->update([
                    'status' => VoiceCampaignCall::STATUS_CANCELLED,
                    'call_ended_at' => now(),
                    'error_message' => 'Cancelled by user/campaign state change'
                ]);
        } catch (\Throwable $e) {
            \Log::warning('⚠️ [VOICE CAMPAIGN] No se pudieron cancelar llamadas activas', [
                'campaign_id' => $campaignId,
                'error' => $e->getMessage()
            ]);
            return 0;
        }
    }
}
