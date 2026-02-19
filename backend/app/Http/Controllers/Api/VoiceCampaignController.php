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
                
                // Programar llamadas automáticamente según el objetivo de la campaña
                $schedulerResult = null;
                try {
                    $scheduler = new \App\Services\VoiceCampaignSchedulerService();
                    $schedulerResult = $scheduler->scheduleCallsForCampaign($campaign);
                    Log::info('📅 [VOICE CAMPAIGN] Llamadas programadas automáticamente', [
                        'campaign_id' => $campaign->id,
                        'scheduled' => $schedulerResult['scheduled'] ?? 0,
                    ]);
                } catch (\Throwable $e) {
                    Log::warning('📅 [VOICE CAMPAIGN] Error programando llamadas', [
                        'campaign_id' => $campaign->id,
                        'error' => $e->getMessage(),
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
                        'stats' => $campaign->getStats(),
                        'scheduled_calls' => $schedulerResult['scheduled'] ?? 0,
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
     * Controlar los faloss positivos del resultado de la llamada cuando finaliza
     */
    private function verifyFalsePositive(string $transcript, string $summary, bool $currentObjective): bool
    {
        try {
            $aiApiKey = env('AI_API_KEY', env('DEEPSEEK_API_KEY'));
            $aiApiUrl = env('AI_API_URL', env('DEEPSEEK_API_URL', 'https://api.deepseek.com/v1/chat/completions'));
            
            if (!$aiApiKey || !$aiApiUrl || empty($transcript)) {
                Log::warning('⚠️ [VERIFY FALSE POSITIVE] API keys no configuradas', [
                    'has_ai_key' => !empty($aiApiKey),
                    'has_ai_url' => !empty($aiApiUrl),
                    'has_transcript' => !empty($transcript)
                ]);
                return $currentObjective; // Sin API configuradas
            }

            Log::info('⚖️ [VERIFY FALSE POSITIVE] Iniciando auditoría de cumplimiento', [
                'call_objective_before' => $currentObjective,
                'transcript_length' => strlen($transcript)
            ]);

            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $aiApiKey,
                'Content-Type' => 'application/json',
            ])->timeout(15)->post($aiApiUrl, [
                'model' => env('AI_MODEL', 'deepseek-chat'), 
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'Eres un auditor de calidad de llamadas. Tu objetivo es validar si el asistente de voz logró el objetivo comercial. Responde ÚNICAMENTE un JSON válido: {"objetivo_confirmado": boolean, "razon": "explicación breve"}'
                    ],
                    [
                        'role' => 'user',
                        'content' => "Analiza si en esta llamada el cliente aceptó la propuesta o cumplió el objetivo.\n\nResumen: $summary\nTranscripción: $transcript"
                    ]
                ],
                'response_format' => ['type' => 'json_object'],
                'temperature' => 0.1 // Temperatura baja para mayor precisión y menos creatividad
            ]);

            if ($response->successful()) {
                $result = $response->json();
                $contentRaw = $result['choices'][0]['message']['content'] ?? '{}';
                
                // Limpiar posibles bloques de código markdown
                $contentRaw = preg_replace('/^```json\s*|```$/', '', trim($contentRaw));
                
                $content = json_decode($contentRaw, true);
                
                if (isset($content['objetivo_confirmado'])) {
                    Log::info('✅ [VERIFY FALSE POSITIVE] Auditoría completada', [
                        'decision' => $content['objetivo_confirmado'],
                        'razon' => $content['razon'] ?? 'N/A'
                    ]);
                    return (bool) $content['objetivo_confirmado'];
                }
            } else {
                Log::warning('⚠️ [VERIFY FALSE POSITIVE] Error en API externa', [
                    'status' => $response->status(),
                    'body' => $response->body()
                ]);
            }

            return $currentObjective;
        } catch (\Throwable $e) {
            Log::error('❌ [VERIFY FALSE POSITIVE] Error crítico', ['error' => $e->getMessage()]);
            return $currentObjective;
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
                    $twilioRatePerMin = (float) env('TWILIO_USD_PER_MIN', 0.0338); // Tarifa Colombia móvil
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
                        VoiceCampaignCall::STATUS_PENDING,
                        VoiceCampaignCall::STATUS_INITIATED,
                        VoiceCampaignCall::STATUS_RINGING,
                        VoiceCampaignCall::STATUS_ANSWERED,
                        VoiceCampaignCall::STATUS_IN_PROGRESS,
                    ];

                    // Terminar ejecución si no quedan llamadas activas
                    if ($call->execution) {
                        $remainingInExec = $call->execution->calls()->whereIn('status', $activeStatuses)->count();
                        if ($remainingInExec === 0 && !$call->execution->isCompleted()) {
                            $call->execution->markAsCompleted();
                        }
                    }
                    
                    // Verificar si la campaña debe marcarse como completada
                    $campaign = $call->voiceCampaign;
                    if ($campaign && $campaign->status === VoiceCampaign::STATUS_RUNNING) {
                        // Contar llamadas activas de TODA la campaña (no solo de la ejecución)
                        $remainingInCampaign = VoiceCampaignCall::where('voice_campaign_id', $campaign->id)
                            ->whereIn('status', $activeStatuses)
                            ->count();
                        
                        Log::info('🔍 [VOICE CAMPAIGN] Verificando estado de campaña', [
                            'campaign_id' => $campaign->id,
                            'remaining_active_calls' => $remainingInCampaign,
                        ]);
                        
                        if ($remainingInCampaign === 0) {
                            // Verificar si tiene llamadas programadas pendientes o triggers activos
                            $hasPendingScheduledCalls = \App\Models\VoiceCampaignScheduledCall::where('voice_campaign_id', $campaign->id)
                                ->where('status', \App\Models\VoiceCampaignScheduledCall::STATUS_PENDING)
                                ->exists();
                            
                            $hasTriggers = \App\Models\VoiceCampaignTrigger::where('voice_campaign_id', $campaign->id)
                                ->where('enabled', true)
                                ->exists();
                            
                            if ($hasPendingScheduledCalls || $hasTriggers) {
                                Log::info('📅 [VOICE CAMPAIGN] Campaña permanece activa (tiene llamadas programadas o triggers)', [
                                    'campaign_id' => $campaign->id,
                                    'campaign_name' => $campaign->name,
                                    'has_scheduled_calls' => $hasPendingScheduledCalls,
                                    'has_triggers' => $hasTriggers
                                ]);
                            } else {
                                // Campaña inmediata sin triggers ni llamadas pendientes: marcar como completada
                                $totalCalls = VoiceCampaignCall::where('voice_campaign_id', $campaign->id)->count();
                                $completedCalls = VoiceCampaignCall::where('voice_campaign_id', $campaign->id)->where('status', VoiceCampaignCall::STATUS_COMPLETED)->count();
                                $failedCalls = VoiceCampaignCall::where('voice_campaign_id', $campaign->id)->where('status', VoiceCampaignCall::STATUS_FAILED)->count();
                                
                                $campaign->status = VoiceCampaign::STATUS_COMPLETED;
                                $campaign->calls_made = $totalCalls;
                                $campaign->calls_successful = $completedCalls;
                                $campaign->calls_failed = $failedCalls;
                                $campaign->save();
                                
                                Log::info('✅ [VOICE CAMPAIGN] Campaña inmediata completada automáticamente', [
                                    'campaign_id' => $campaign->id,
                                    'campaign_name' => $campaign->name,
                                    'calls_made' => $totalCalls,
                                    'calls_successful' => $completedCalls,
                                    'calls_failed' => $failedCalls,
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
     * Webhook para eventos post-llamada de VAPI
     */
    public function receiveVapiWebhook(Request $request): JsonResponse
    {
        try {
            $payload = $request->all();
            $messageType = $payload['message']['type'] ?? $payload['type'] ?? null;
            
            Log::info('🔔 [VAPI WEBHOOK] Payload recibido', [
                'message_type' => $messageType,
                'payload_keys' => array_keys($payload),
                'full_payload' => json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
            ]);

            // VAPI envía el call ID en diferentes ubicaciones según el tipo de mensaje
            $callId = data_get($payload, 'message.call.id')
                ?? data_get($payload, 'call.id')
                ?? data_get($payload, 'id')
                ?? null;

            Log::info('🔔 [VAPI WEBHOOK] Call ID extraído', [
                'call_id' => $callId,
                'from_message_call_id' => data_get($payload, 'message.call.id'),
                'from_call_id' => data_get($payload, 'call.id'),
                'from_id' => data_get($payload, 'id'),
            ]);

            if (!$callId) {
                Log::warning('🔔 [VAPI WEBHOOK] call_id faltante en payload');
                return response()->json(['success' => false, 'message' => 'call_id faltante'], 400);
            }

            // Buscar la llamada por el ID de VAPI (guardado como elevenlabs_conversation_id)
            $call = VoiceCampaignCall::where('elevenlabs_conversation_id', $callId)->first();
            Log::info('🔔 [VAPI WEBHOOK] Búsqueda por elevenlabs_conversation_id', [
                'call_id' => $callId,
                'found' => $call ? true : false,
            ]);
            
            if (!$call) {
                $call = VoiceCampaignCall::where('elevenlabs_call_id', $callId)->first();
                Log::info('🔔 [VAPI WEBHOOK] Búsqueda por elevenlabs_call_id', [
                    'call_id' => $callId,
                    'found' => $call ? true : false,
                ]);
            }

            if (!$call) {
                Log::warning('🔔 [VAPI WEBHOOK] Llamada no encontrada en BD', ['call_id' => $callId]);
                return response()->json(['success' => true]); // idempotente
            }
            
            Log::info('🔔 [VAPI WEBHOOK] Llamada encontrada, procesando...', [
                'db_call_id' => $call->id,
                'message_type' => $messageType,
            ]);

            // Procesar según tipo de mensaje
            if ($messageType === 'end-of-call-report') {
                $this->processVapiEndOfCallReport($call, $payload);
            } elseif ($messageType === 'status-update') {
                $this->processVapiStatusUpdate($call, $payload);
            } elseif ($messageType === 'transcript') {
                $this->processVapiTranscript($call, $payload);
            }

            return response()->json(['success' => true]);
        } catch (\Throwable $e) {
            Log::error('❌ [VAPI WEBHOOK] Error procesando webhook', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['success' => false, 'message' => 'Error interno'], 500);
        }
    }

    /**
     * Procesar reporte de fin de llamada de VAPI
     * 
     * NOTA: Este webhook se usa principalmente para ejecutar ACCIONES post-llamada
     * como envío de WhatsApp con enlace de pago, etc.
     * La sincronización de estados y contadores se hace vía polling con syncCampaignRealtime()
     * para mayor confiabilidad y tiempo real.
     */
    private function processVapiEndOfCallReport(VoiceCampaignCall $call, array $payload): void
    {
        $message = $payload['message'] ?? $payload;
        $callData = $message['call'] ?? [];
        
        // El status puede venir en diferentes ubicaciones según el tipo de evento
        $status = $message['status'] ?? $callData['status'] ?? 'unknown';
        $endedReason = $message['endedReason'] ?? $callData['endedReason'] ?? null;
        
        // Si el status es 'unknown' o 'queued' pero tenemos endedReason, la llamada terminó
        if (in_array($status, ['unknown', 'queued']) && $endedReason) {
            $status = 'ended';
        }
        
        // Si es un end-of-call-report, la llamada definitivamente terminó
        $messageType = $message['type'] ?? $payload['type'] ?? null;
        if ($messageType === 'end-of-call-report') {
            $status = 'ended';
        }
        $transcript = $message['transcript'] ?? null;
        $summary = $message['summary'] ?? null;
        $recordingUrl = $message['recordingUrl'] ?? $callData['recordingUrl'] ?? null;
        $durationSeconds = (int) ($callData['duration'] ?? $message['durationSeconds'] ?? 0);
        
        // Obtener análisis de VAPI
        $analysis = $message['analysis'] ?? $callData['analysis'] ?? [];
        $structuredData = $analysis['structuredData'] ?? [];

        //Analisis - Extraemos successEvaluation y los datos que vienen del structuredData 
        $successEvaluation = $analysis['successEvaluation'] ?? null;
        $objectiveAchieved = $structuredData['objetivo_logrado'] ?? null;
        $isHuman = $structuredData['interaccion_humana'] ?? null;

        // --- ARBITRAJE DE FALSOS POSITIVOS ---
        // Se revisan si el sistema CREE que hubo éxito, pero hay dudas razonables:
        // - El successEvaluation es bajo (menor a 6)
        // - La duración es muy corta para un cierre real (menos de 25 seg)
        $isSuspiciousSuccess = ($objectiveAchieved === true) && (
            ($successEvaluation !== null && (float)$successEvaluation < 6) || 
            ($durationSeconds < 25)
        );

        if ($isSuspiciousSuccess && !empty($transcript)) {
            Log::info("⚖️ [VAPI ARBITRAJE] Validando posible falso positivo para call_id: " . $call->id);
            
            // Se llama a la funcion correspondiente
            $verifiedResult = $this->verifyFalsePositive($transcript, $summary ?? '', $objectiveAchieved);
            
            if ($verifiedResult !== $objectiveAchieved) {
                Log::warning("🚨 [VAPI ARBITRAJE] Resultado corregido: de TRUE a FALSE", [
                    'call_id' => $call->id
                ]);
                $objectiveAchieved = $verifiedResult;
            }
        }

        //Objetivo - Si NO vino objetivo_logrado en el structuredData, buscamos en el successEvaluation (Fallback)
        if ($objectiveAchieved === null) {
            if ($successEvaluation !== null) {
                if (is_numeric($successEvaluation)) {
                    $objectiveAchieved = (float) $successEvaluation >= 6;
                } elseif (is_bool($successEvaluation)) {
                    $objectiveAchieved = $successEvaluation;
                }
            } else {
                // Si ni siquiera hay successEvaluation, el último recurso es la contactabilidad
                $objectiveAchieved = null; // Lo dejamos nulo por ahora
            }
        }
        
        Log::info('🔔 [VAPI WEBHOOK] Procesando end-of-call-report', [
            'call_id' => $call->id,
            'status' => $status,
            'ended_reason' => $endedReason,
            'duration' => $durationSeconds,
            'has_transcript' => !empty($transcript),
            'has_summary' => !empty($summary),
            'success_evaluation' => $successEvaluation,
        ]);

        // Determinar si la llamada fue exitosa
        // Razones que indican que NO hubo contacto real
        $noContactReasons = ['no-answer', 'busy', 'dial-no-answer', 'dial-busy', 'customer-did-not-answer', 'customer-busy', 'machine-detected', 'voicemail', 'failed'];
        
        // Razones que indican que el cliente contestó (contactabilidad)
        $contactedReasons = ['customer-ended-call', 'assistant-ended-call', 'max-duration-reached', 'assistant-said-end-call-phrase'];
        
        // CONTACTABILIDAD: Determinar si hubo contacto real (para estado de llamada: completed/failed)
        // Si el cliente contestó y hubo conversación = CONTACTADO (llamada completed)
        // $wasContacted = in_array($endedReason, $contactedReasons) || 
        //                 ($durationSeconds >= 3 && !in_array($endedReason, $noContactReasons));

        //CONTACTABILIDAD: Determinar si hubo contacto real (para estado de llamada: completed/failed)
        // 1. Limpiamos el transcript para contar solo palabras reales
        $cleanTranscript = trim($transcript ?? '');
        $wordCount = !empty($cleanTranscript) ? str_word_count($cleanTranscript) : 0;

        // 2. Definimos si hubo diálogo real
        $hasRealDialogue = $wordCount > 20;

        // 3. LA GRAN VALIDACIÓN DE CONTACTABILIDAD
        // Si VAPI cree que es humano, hay suficiente texto (fue conversación), duracion(menos de 10 segundos, el agente se presenta y saluda), o si viene algun estado de VAPI, por defecto fue contactado
        $wasContacted = (
            ($isHuman !== false) &&             
            $hasRealDialogue &&                 
            $durationSeconds > 10
        ) || (in_array($endedReason, $contactedReasons) || ($durationSeconds > 10 && !in_array($endedReason, $noContactReasons)));   
        
        if ($objectiveAchieved === null) {
            $objectiveAchieved = $wasContacted;
        }
        
        // OBJETIVO: Evaluar si se cumplió el objetivo de la llamada (para successEvaluation)
        // Esto es independiente de la contactabilidad
        // $objectiveAchieved = false;
        
        // if ($successEvaluation !== null) {
        //     // Si es numérico, >= 5 es éxito (escala 1-10)
        //     if (is_numeric($successEvaluation)) {
        //         $objectiveAchieved = (float) $successEvaluation >= 5;
        //     }
        //     // Si es booleano
        //     elseif (is_bool($successEvaluation)) {
        //         $objectiveAchieved = $successEvaluation;
        //     }
        //     // Si es string: 'pass', 'true', 'yes', 'success' = éxito
        //     elseif (is_string($successEvaluation)) {
        //         $objectiveAchieved = in_array(strtolower($successEvaluation), ['true', 'yes', 'success', '1', 'pass'], true);
        //     }
        // } else {
        //     // Si no hay successEvaluation, usar contactabilidad como fallback para el objetivo
        //     $objectiveAchieved = $wasContacted;
        // }
        
        Log::info('📊 [VAPI WEBHOOK] Evaluación de llamada', [
            'call_id' => $call->id,
            'success_evaluation_raw' => $successEvaluation,
            'ended_reason' => $endedReason,
            'duration' => $durationSeconds,
            'was_contacted' => $wasContacted,
            'objective_achieved' => $objectiveAchieved,
        ]);

        // ESTADO DE LLAMADA: Basado en CONTACTABILIDAD (si contestó = completed)
        if ($wasContacted) {
            $call->markAsCompleted(['result' => VoiceCampaignCall::RESULT_SUCCESS], $durationSeconds);
        } else {
            $resultCode = $this->mapVapiEndedReasonToResult($endedReason);
            $call->markAsFailed($resultCode, $endedReason);
        }

        // Guardar análisis y transcript
        // call_successful = objetivo cumplido (para mostrar en UI)
        $analysisData = [
            'transcript_summary' => $summary,
            'call_successful' => $objectiveAchieved,
            'was_contacted' => $wasContacted,
            'termination_reason' => $endedReason,
            'vapi_status' => $status,
        ];
        $call->update([
            'call_result' => $analysisData,
            'duration_seconds' => $durationSeconds,
            'call_recording_url' => $recordingUrl,
        ]);

        // Guardar transcript completo en metadata
        if ($transcript) {
            $meta = is_array($call->call_metadata) ? $call->call_metadata : [];
            $meta['transcript'] = $transcript;
            $call->update(['call_metadata' => $meta]);
        }

        // Calcular costos de VAPI
        try {
            $cost = $message['cost'] ?? $callData['cost'] ?? 0;
            $costBreakdown = $message['costBreakdown'] ?? [];
            
            // Obtener TRM y markup del broker
            $trm = (float) env('COP_TRM_RATE', 4500);
            $markupPercent = (float) env('VOICE_MARKUP_PERCENT', 40);
            
            // Intentar obtener markup personalizado del broker
            $broker = $call->broker;
            if ($broker && is_array($broker->settings) && isset($broker->settings['voice_calls_markup_percent'])) {
                $markupPercent = (float) $broker->settings['voice_calls_markup_percent'];
            }
            
            // Minutos facturados (por minuto adelantado - se redondea hacia arriba)
            $billedMinutes = (int) ceil($durationSeconds / 60);
            
            // Tarifa de telefonía Colombia móvil: $0.0338/min (por minuto anticipado)
            $phoneRatePerMin = (float) env('TWILIO_USD_PER_MIN', 0.0338);
            
            // Costos de VAPI (TTS = voz IA, transport = telefonía)
            // Si VAPI no proporciona desglose, calculamos telefonía con tarifa Colombia
            $voiceCostUsd = (float) ($costBreakdown['tts'] ?? 0);
            $phoneCostUsd = (float) ($costBreakdown['transport'] ?? 0);
            
            // Si no hay costo de telefonía de VAPI, calcular con tarifa Colombia
            if ($phoneCostUsd <= 0 && $billedMinutes > 0) {
                $phoneCostUsd = round($billedMinutes * $phoneRatePerMin, 6);
            }
            
            // Costo total: usar el de VAPI si existe, sino calcular
            $totalUsd = is_numeric($cost) && (float)$cost > 0 
                ? round((float) $cost, 6) 
                : round($voiceCostUsd + $phoneCostUsd, 6);
            
            // Calcular con markup del 40%
            $totalWithMarkupUsd = round($totalUsd * (1 + ($markupPercent / 100)), 6);
            
            // Convertir a COP
            $voiceCostCop = round($voiceCostUsd * $trm, 2);
            $phoneCostCop = round($phoneCostUsd * $trm, 2);
            $totalCop = round($totalUsd * $trm, 2);
            $totalWithMarkupCop = round($totalWithMarkupUsd * $trm, 2);
            
            $call->update([
                'elevenlabs_cost_usd' => $voiceCostUsd,  // Costo de voz IA
                'elevenlabs_cost_cop' => $voiceCostCop,
                'twilio_cost_usd' => $phoneCostUsd,      // Costo de telefonía
                'twilio_cost_cop' => $phoneCostCop,
                'twilio_minutes' => $billedMinutes,       // Minutos facturados
                'total_cost_usd' => $totalUsd,
                'total_cost_cop' => $totalCop,
                'total_cost_with_markup_usd' => $totalWithMarkupUsd,
                'total_cost_with_markup_cop' => $totalWithMarkupCop,
            ]);
            
            Log::info('💰 [VAPI COST] Costos calculados', [
                'call_id' => $call->id,
                'total_usd' => $totalUsd,
                'markup_percent' => $markupPercent,
                'total_with_markup_usd' => $totalWithMarkupUsd,
                'total_with_markup_cop' => $totalWithMarkupCop,
                'billed_minutes' => $billedMinutes,
            ]);
        } catch (\Throwable $e) {
            Log::warning('⚠️ [VAPI COST] No se pudieron calcular costos', ['error' => $e->getMessage()]);
        }

        // Enviar WhatsApp si está configurado
        $this->handlePostCallWhatsApp($call);

        // Crear tarea de seguimiento comercial si está configurado
        $this->handleFollowUpTask($call, $objectiveAchieved, $endedReason);

        // Crear negocio en embudo de ventas si está configurado
        $this->handleCreateDeal($call, $objectiveAchieved, $endedReason);

        // Sincronizar estado de llamada programada (si existe)
        // IMPORTANTE: Usar wasContacted (contactabilidad) para el estado, no objectiveAchieved
        try {
            $scheduledCall = \App\Models\VoiceCampaignScheduledCall::where('voice_campaign_call_id', $call->id)->first();
            if ($scheduledCall) {
                if ($wasContacted) {
                    $scheduledCall->update([
                        'status' => \App\Models\VoiceCampaignScheduledCall::STATUS_COMPLETED,
                        'status_reason' => 'Llamada completada exitosamente',
                    ]);
                } else {
                    $scheduledCall->update([
                        'status' => \App\Models\VoiceCampaignScheduledCall::STATUS_FAILED,
                        'status_reason' => $endedReason ?: 'No contestó',
                    ]);
                }
                Log::info('📅 [VAPI WEBHOOK] Estado de llamada programada sincronizado', [
                    'scheduled_call_id' => $scheduledCall->id,
                    'new_status' => $scheduledCall->status,
                    'was_contacted' => $wasContacted,
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning('⚠️ [VAPI WEBHOOK] No se pudo sincronizar llamada programada', ['error' => $e->getMessage()]);
        }

        // Actualizar contadores y verificar si la campaña debe completarse
        try {
            $call->execution?->updateCounters();
            $call->voiceCampaign?->updateCallCounters();
            
            $campaign = $call->voiceCampaign;
            if ($campaign && $campaign->status === VoiceCampaign::STATUS_RUNNING) {
                // Verificar si tiene llamadas programadas pendientes o triggers activos
                $hasPendingScheduledCalls = \App\Models\VoiceCampaignScheduledCall::where('voice_campaign_id', $campaign->id)
                    ->where('status', \App\Models\VoiceCampaignScheduledCall::STATUS_PENDING)
                    ->exists();
                
                $hasTriggers = \App\Models\VoiceCampaignTrigger::where('voice_campaign_id', $campaign->id)
                    ->where('enabled', true)
                    ->exists();
                
                // Contar llamadas activas de la campaña
                $activeStatuses = [
                    VoiceCampaignCall::STATUS_PENDING,
                    VoiceCampaignCall::STATUS_INITIATED,
                    VoiceCampaignCall::STATUS_RINGING,
                    VoiceCampaignCall::STATUS_ANSWERED,
                    VoiceCampaignCall::STATUS_IN_PROGRESS,
                ];
                $remainingActiveCalls = VoiceCampaignCall::where('voice_campaign_id', $campaign->id)
                    ->whereIn('status', $activeStatuses)
                    ->count();
                
                Log::info('🔍 [VAPI WEBHOOK] Verificando estado de campaña', [
                    'campaign_id' => $campaign->id,
                    'remaining_active_calls' => $remainingActiveCalls,
                    'has_pending_scheduled' => $hasPendingScheduledCalls,
                    'has_triggers' => $hasTriggers,
                ]);
                
                // Verificar si es una campaña con llamadas programadas (scheduled) - estas NUNCA se completan automáticamente
                $isScheduledCampaign = \App\Models\VoiceCampaignScheduledCall::where('voice_campaign_id', $campaign->id)->exists();
                
                if ($isScheduledCampaign || $hasPendingScheduledCalls || $hasTriggers) {
                    Log::info('📅 [VAPI WEBHOOK] Campaña permanece activa (es programada, tiene triggers o llamadas pendientes)', [
                        'campaign_id' => $campaign->id,
                        'campaign_name' => $campaign->name,
                        'is_scheduled_campaign' => $isScheduledCampaign,
                        'has_pending_scheduled' => $hasPendingScheduledCalls,
                        'has_triggers' => $hasTriggers,
                    ]);
                } elseif ($remainingActiveCalls === 0) {
                    // Solo campañas INMEDIATAS (sin scheduled calls ni triggers) se marcan como completadas
                    $totalCalls = VoiceCampaignCall::where('voice_campaign_id', $campaign->id)->count();
                    $completedCalls = VoiceCampaignCall::where('voice_campaign_id', $campaign->id)->where('status', VoiceCampaignCall::STATUS_COMPLETED)->count();
                    $failedCalls = VoiceCampaignCall::where('voice_campaign_id', $campaign->id)->where('status', VoiceCampaignCall::STATUS_FAILED)->count();
                    
                    $campaign->status = VoiceCampaign::STATUS_COMPLETED;
                    $campaign->calls_made = $totalCalls;
                    $campaign->calls_successful = $completedCalls;
                    $campaign->calls_failed = $failedCalls;
                    $campaign->save();
                    
                    Log::info('✅ [VAPI WEBHOOK] Campaña inmediata completada automáticamente', [
                        'campaign_id' => $campaign->id,
                        'campaign_name' => $campaign->name,
                        'calls_made' => $totalCalls,
                        'calls_successful' => $completedCalls,
                        'calls_failed' => $failedCalls,
                    ]);
                }
            }
        } catch (\Throwable $e) {
            Log::warning('⚠️ [VAPI] No se pudieron actualizar contadores', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Procesar actualización de estado de VAPI
     */
    private function processVapiStatusUpdate(VoiceCampaignCall $call, array $payload): void
    {
        $message = $payload['message'] ?? $payload;
        $status = $message['status'] ?? null;
        
        Log::info('🔔 [VAPI WEBHOOK] Status update', [
            'call_id' => $call->id,
            'status' => $status,
        ]);

        // Mapear estados de VAPI a nuestros estados
        $statusMap = [
            'queued' => VoiceCampaignCall::STATUS_PENDING,
            'ringing' => VoiceCampaignCall::STATUS_RINGING,
            'in-progress' => VoiceCampaignCall::STATUS_IN_PROGRESS,
            'forwarding' => VoiceCampaignCall::STATUS_IN_PROGRESS,
            'ended' => VoiceCampaignCall::STATUS_COMPLETED,
        ];

        if (isset($statusMap[$status])) {
            $call->update(['status' => $statusMap[$status]]);
        }
    }

    /**
     * Procesar transcript de VAPI
     */
    private function processVapiTranscript(VoiceCampaignCall $call, array $payload): void
    {
        $message = $payload['message'] ?? $payload;
        $transcript = $message['transcript'] ?? null;
        
        if ($transcript) {
            $meta = is_array($call->call_metadata) ? $call->call_metadata : [];
            $meta['transcript'] = $transcript;
            $call->update(['call_metadata' => $meta]);
        }
    }

    /**
     * Mapear razón de fin de llamada de VAPI a código de resultado
     */
    private function mapVapiEndedReasonToResult(?string $endedReason): string
    {
        $map = [
            'customer-ended-call' => VoiceCampaignCall::RESULT_SUCCESS,
            'assistant-ended-call' => VoiceCampaignCall::RESULT_SUCCESS,
            'customer-did-not-answer' => VoiceCampaignCall::RESULT_NO_ANSWER,
            'customer-busy' => VoiceCampaignCall::RESULT_BUSY,
            'voicemail' => VoiceCampaignCall::RESULT_VOICEMAIL,
            'silence-timed-out' => VoiceCampaignCall::RESULT_NO_ANSWER,
            'max-duration-reached' => VoiceCampaignCall::RESULT_SUCCESS,
            'error' => VoiceCampaignCall::RESULT_API_ERROR,
        ];

        return $map[$endedReason] ?? VoiceCampaignCall::RESULT_UNKNOWN;
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
            Log::warning('⚠️ [TRANSLATION] Error en traducción', ['error' => $e->getMessage()]);
            return $text;
        }
    }

    /**
     * Formatear fecha en español para pronunciación natural (sin año)
     * Ej: "2026-01-15" -> "quince de enero"
     */
    private function formatDateInSpanish($date): string
    {
        try {
            if (empty($date) || $date === 'N/A') {
                return 'próximamente';
            }
            
            $carbon = $date instanceof \Carbon\Carbon ? $date : Carbon::parse($date);
            
            $meses = [
                1 => 'enero', 2 => 'febrero', 3 => 'marzo', 4 => 'abril',
                5 => 'mayo', 6 => 'junio', 7 => 'julio', 8 => 'agosto',
                9 => 'septiembre', 10 => 'octubre', 11 => 'noviembre', 12 => 'diciembre'
            ];
            
            $dia = $carbon->day;
            $mes = $meses[$carbon->month];
            
            return "{$dia} de {$mes}";
        } catch (\Throwable $e) {
            return (string) $date;
        }
    }

    /**
     * Convertir número a palabras en español (1-31 para días)
     */
    private function numberToSpanishWords(int $num): string
    {
        $words = [
            1 => 'primero', 2 => 'dos', 3 => 'tres', 4 => 'cuatro', 5 => 'cinco',
            6 => 'seis', 7 => 'siete', 8 => 'ocho', 9 => 'nueve', 10 => 'diez',
            11 => 'once', 12 => 'doce', 13 => 'trece', 14 => 'catorce', 15 => 'quince',
            16 => 'dieciséis', 17 => 'diecisiete', 18 => 'dieciocho', 19 => 'diecinueve',
            20 => 'veinte', 21 => 'veintiuno', 22 => 'veintidós', 23 => 'veintitrés',
            24 => 'veinticuatro', 25 => 'veinticinco', 26 => 'veintiséis', 27 => 'veintisiete',
            28 => 'veintiocho', 29 => 'veintinueve', 30 => 'treinta', 31 => 'treinta y uno'
        ];
        return $words[$num] ?? (string) $num;
    }

    /**
     * Convertir año a palabras en español
     */
    private function yearToSpanishWords(int $year): string
    {
        $years = [
            2024 => 'dos mil veinticuatro',
            2025 => 'dos mil veinticinco',
            2026 => 'dos mil veintiséis',
            2027 => 'dos mil veintisiete',
            2028 => 'dos mil veintiocho',
            2029 => 'dos mil veintinueve',
            2030 => 'dos mil treinta',
        ];
        return $years[$year] ?? (string) $year;
    }

    /**
     * Formatear monto en español para pronunciación natural
     * Ej: 150000 -> "ciento cincuenta mil pesos"
     */
    private function formatAmountInSpanish($amount): string
    {
        try {
            if (!is_numeric($amount) || $amount <= 0) {
                return 'el monto pendiente';
            }
            
            $amount = (int) $amount;
            
            // Para montos grandes, usar formato simplificado
            if ($amount >= 1000000) {
                $millones = floor($amount / 1000000);
                $resto = $amount % 1000000;
                if ($resto > 0) {
                    $miles = floor($resto / 1000);
                    return "{$millones} millón" . ($millones > 1 ? 'es' : '') . " {$miles} mil pesos";
                }
                return "{$millones} millón" . ($millones > 1 ? 'es' : '') . " de pesos";
            } elseif ($amount >= 1000) {
                $miles = floor($amount / 1000);
                $resto = $amount % 1000;
                if ($resto > 0) {
                    return "{$miles} mil {$resto} pesos";
                }
                return "{$miles} mil pesos";
            } else {
                return "{$amount} pesos";
            }
        } catch (\Throwable $e) {
            return number_format($amount, 0, ',', '.') . ' pesos';
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
            $noAnswerSent = $meta['no_answer_whatsapp_sent_at'] ?? null;
            $scheduled = data_get($meta, 'payment_on_completion'); // Programado durante la llamada/tool

            $campaign = $call->voiceCampaign;
            $toolsCfg = is_array($campaign?->settings) ? ($campaign->settings['post_call_tools'] ?? null) : null;
            $whatsappCfg = is_array($toolsCfg) ? ($toolsCfg['whatsapp'] ?? null) : null;
            
            // Verificar si la llamada fue no contestada
            $callResult = is_array($call->call_result) ? $call->call_result : [];
            $terminationReason = $callResult['termination_reason'] ?? null;
            $noAnswerReasons = ['customer-did-not-answer', 'no-answer', 'busy', 'customer-busy', 'dial-no-answer', 'dial-busy', 'voicemail'];
            $wasNoAnswer = in_array($terminationReason, $noAnswerReasons);
            
            // Si fue no contestada y está habilitado el WhatsApp para no contestados
            if ($wasNoAnswer && !$noAnswerSent) {
                $noAnswerEnabled = is_array($whatsappCfg) && ($whatsappCfg['noAnswerEnabled'] ?? false);
                
                if ($noAnswerEnabled) {
                    $noAnswerTemplate = $whatsappCfg['noAnswerTemplate'] ?? 'Hola {customer_name}, intentamos comunicarnos contigo sin éxito. Por favor contáctanos.';
                    
                    $this->sendNoAnswerWhatsApp($call, $whatsappCfg, $noAnswerTemplate);
                    return;
                }
            }

            if ($alreadySent) {
                Log::info('ℹ️ [WHATSAPP PAYMENT] Enlace ya enviado anteriormente', [
                    'call_id' => $call->id,
                    'sent_at' => $alreadySent
                ]);
                return;
            }

            // Debemos enviar si:
            // - WhatsApp está habilitado en la campaña, o
            // - Existe un schedule explícito de envío programado (aunque la campaña no tenga WhatsApp habilitado)
            $shouldSend = (is_array($whatsappCfg) && ($whatsappCfg['enabled'] ?? false)) || is_array($scheduled);

            if (!$shouldSend) {
                return;
            }
            
            // No enviar enlace de pago si fue no contestada
            if ($wasNoAnswer) {
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
     * Enviar WhatsApp cuando el cliente no contesta
     */
    private function sendNoAnswerWhatsApp(VoiceCampaignCall $call, ?array $whatsappCfg, string $template): void
    {
        try {
            $waPhone = $this->formatPhoneNumber((string) $call->recipient_phone);
            $customerName = $call->recipient_name ?: 'Cliente';
            $companyName = $call->voiceCampaign?->broker?->name ?? 'Tu agencia de seguros';
            
            // Reemplazar variables en el template
            $message = str_replace(
                ['{customer_name}', '{company_name}', '{phone}'],
                [$customerName, $companyName, $waPhone],
                $template
            );
            
            // Resolver instancia
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
                    // No bloquear
                }
            }
            
            if (empty($instanceId)) {
                Log::warning('⚠️ [WHATSAPP NO-ANSWER] No hay instancia disponible', ['call_id' => $call->id]);
                return;
            }
            
            Log::info('📱 [WHATSAPP NO-ANSWER] Enviando mensaje por no contestar', [
                'call_id' => $call->id,
                'phone' => $waPhone,
                'customer_name' => $customerName,
                'instance_id' => $instanceId,
            ]);
            
            // Enviar mensaje
            $waBase = rtrim(env('WHATSAPP_SERVICE_URL', 'http://localhost:3000/api/v1'), '/');
            $resp = \Illuminate\Support\Facades\Http::retry(2, 500)
                ->post($waBase . '/messages/send', [
                    'phone' => $waPhone,
                    'message' => $message,
                ]);
            
            if ($resp->ok()) {
                $meta = is_array($call->call_metadata) ? $call->call_metadata : [];
                $meta['no_answer_whatsapp_sent_at'] = now()->toDateTimeString();
                $meta['no_answer_whatsapp_message'] = $message;
                $call->update(['call_metadata' => $meta]);
                
                Log::info('✅ [WHATSAPP NO-ANSWER] Mensaje enviado exitosamente', [
                    'call_id' => $call->id,
                    'phone' => $waPhone
                ]);
            } else {
                Log::warning('❌ [WHATSAPP NO-ANSWER] Falló envío', [
                    'call_id' => $call->id,
                    'response' => $resp->body()
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('❌ [WHATSAPP NO-ANSWER] Error', [
                'call_id' => $call->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Crear tarea de seguimiento comercial si está configurado en la campaña
     */
    private function handleFollowUpTask(VoiceCampaignCall $call, bool $callSuccessful, ?string $endedReason): void
    {
        try {
            $campaign = $call->voiceCampaign;
            if (!$campaign) {
                return;
            }

            $settings = is_array($campaign->settings) ? $campaign->settings : [];
            $postCallTools = $settings['post_call_tools'] ?? [];
            
            // Verificar si el seguimiento está habilitado
            $followUpEnabled = $postCallTools['followUpEnabled'] ?? false;
            if (!$followUpEnabled) {
                return;
            }

            $followUpCondition = $postCallTools['followUpCondition'] ?? 'call_successful';
            $followUpDays = (int) ($postCallTools['followUpDays'] ?? 3);
            $followUpDescription = $postCallTools['followUpDescription'] ?? '';

            // Determinar si se cumple la condición
            $shouldCreateTask = false;
            $isNoAnswer = in_array($endedReason, ['customer-did-not-answer', 'no-answer', 'busy', 'machine-detected']);
            
            switch ($followUpCondition) {
                case 'call_successful':
                    $shouldCreateTask = $callSuccessful;
                    break;
                case 'call_failed':
                    $shouldCreateTask = !$callSuccessful && !$isNoAnswer;
                    break;
                case 'no_answer':
                    $shouldCreateTask = $isNoAnswer;
                    break;
                case 'always':
                    $shouldCreateTask = true;
                    break;
            }

            if (!$shouldCreateTask) {
                Log::info('📋 [FOLLOW-UP] Condición no cumplida, no se crea tarea', [
                    'call_id' => $call->id,
                    'condition' => $followUpCondition,
                    'call_successful' => $callSuccessful,
                    'ended_reason' => $endedReason,
                ]);
                return;
            }

            // Obtener datos del cliente
            $scheduledCall = \App\Models\VoiceCampaignScheduledCall::where('voice_campaign_call_id', $call->id)->first();
            $clientId = $scheduledCall?->client_id;
            $polizaId = $scheduledCall?->poliza_id;
            $contactData = is_array($scheduledCall?->contact_data) ? $scheduledCall->contact_data : [];
            $customerName = $contactData['customer_name'] ?? $contactData['name'] ?? 'Cliente';

            // Crear la tarea de seguimiento
            $dueDate = now()->addDays($followUpDays)->format('Y-m-d');
            
            $taskData = [
                'broker_id' => $campaign->broker_id,
                'client_id' => $clientId,
                'poliza_id' => $polizaId,
                'created_by' => $campaign->created_by ?? 1,
                'title' => "Seguimiento: {$customerName}",
                'description' => $this->buildFollowUpDescription($call, $callSuccessful, $endedReason, $customerName, $followUpDescription),
                'type' => 'seguimiento_cliente',
                'status' => 'pendiente',
                'priority' => $callSuccessful ? 'media' : 'alta',
                'due_date' => $dueDate,
                'contact_method' => 'phone',
                'contact_phone' => $contactData['phone'] ?? null,
                'has_reminder' => true,
                'reminder_at' => now()->addDays($followUpDays)->subHours(2)->format('Y-m-d H:i:s'),
                'external_reference' => "voice_call:{$call->id}",
            ];

            $task = \App\Models\CommercialTask::create($taskData);

            Log::info('✅ [FOLLOW-UP] Tarea de seguimiento creada', [
                'call_id' => $call->id,
                'task_id' => $task->id,
                'client_id' => $clientId,
                'due_date' => $dueDate,
                'condition' => $followUpCondition,
            ]);

        } catch (\Throwable $e) {
            Log::error('❌ [FOLLOW-UP] Error creando tarea de seguimiento', [
                'call_id' => $call->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Construir descripción para la tarea de seguimiento
     */
    private function buildFollowUpDescription(VoiceCampaignCall $call, bool $callSuccessful, ?string $endedReason, string $customerName, string $customDescription = ''): string
    {
        $campaign = $call->voiceCampaign;
        $campaignName = $campaign?->name ?? 'Campaña de voz';
        
        $resultText = $callSuccessful ? 'exitosa' : 'no exitosa';
        if ($endedReason === 'customer-did-not-answer') {
            $resultText = 'no contestada';
        } elseif ($endedReason === 'busy') {
            $resultText = 'ocupado';
        }

        $description = "";
        
        // Agregar descripción personalizada si existe
        if (!empty($customDescription)) {
            $description .= "{$customDescription}\n\n---\n\n";
        }
        
        $description .= "📞 Campaña: {$campaignName}\n";
        $description .= "👤 Cliente: {$customerName}\n";
        $description .= "📊 Resultado: Llamada {$resultText}\n";
        $description .= "📅 Fecha llamada: " . $call->created_at->format('d/m/Y H:i') . "\n";
        
        if ($call->call_result && isset($call->call_result['transcript_summary'])) {
            $description .= "\n📝 Resumen:\n" . $call->call_result['transcript_summary'];
        }

        return $description;
    }

    /**
     * Crear negocio en embudo de ventas si está configurado
     */
    private function handleCreateDeal(VoiceCampaignCall $call, bool $callSuccessful, ?string $endedReason): void
    {
        try {
            $campaign = $call->voiceCampaign;
            if (!$campaign) {
                return;
            }

            $settings = is_array($campaign->settings) ? $campaign->settings : [];
            $postCallTools = $settings['post_call_tools'] ?? [];
            
            // Verificar si crear negocio está habilitado
            $createDealEnabled = $postCallTools['createDealEnabled'] ?? false;
            if (!$createDealEnabled) {
                return;
            }

            $createDealContactability = $postCallTools['createDealContactability'] ?? 'any';
            $createDealObjective = $postCallTools['createDealObjective'] ?? 'any';
            $createDealStage = $postCallTools['createDealStage'] ?? 'lead';
            $createDealDescription = $postCallTools['createDealDescription'] ?? '';

            // Determinar contactabilidad
            $isNoAnswer = in_array($endedReason, ['customer-did-not-answer', 'no-answer', 'busy', 'machine-detected']);
            $wasContacted = !$isNoAnswer;
            
            // Evaluar condición de contactabilidad
            $contactabilityMet = true;
            if ($createDealContactability === 'contacted' && !$wasContacted) {
                $contactabilityMet = false;
            } elseif ($createDealContactability === 'not_contacted' && $wasContacted) {
                $contactabilityMet = false;
            }
            
            // Evaluar condición de cumplimiento del objetivo
            $objectiveMet = true;
            if ($createDealObjective === 'achieved' && !$callSuccessful) {
                $objectiveMet = false;
            } elseif ($createDealObjective === 'not_achieved' && $callSuccessful) {
                $objectiveMet = false;
            }

            // Ambas condiciones deben cumplirse
            $shouldCreateDeal = $contactabilityMet && $objectiveMet;

            if (!$shouldCreateDeal) {
                Log::info('📊 [CREATE-DEAL] Condición no cumplida, no se crea negocio', [
                    'call_id' => $call->id,
                    'contactability' => $createDealContactability,
                    'objective' => $createDealObjective,
                    'was_contacted' => $wasContacted,
                    'call_successful' => $callSuccessful,
                    'contactability_met' => $contactabilityMet,
                    'objective_met' => $objectiveMet,
                ]);
                return;
            }

            // Obtener datos del contacto
            $contactData = is_array($call->contact_data) ? $call->contact_data : [];
            $customerName = $contactData['customer_name'] ?? $contactData['name'] ?? 'Cliente';
            $clientId = $contactData['client_id'] ?? null;
            $polizaId = $contactData['poliza_id'] ?? null;

            // Obtener ramo de la póliza si existe
            $ramoId = null;
            $insuranceType = 'auto';
            if ($polizaId) {
                $poliza = \App\Models\Poliza::find($polizaId);
                if ($poliza) {
                    $ramoId = $poliza->ramo_id;
                    // Mapear ramo a insurance_type
                    if ($poliza->ramo) {
                        $ramoNombre = strtolower($poliza->ramo->nombre ?? '');
                        if (str_contains($ramoNombre, 'auto') || str_contains($ramoNombre, 'veh')) {
                            $insuranceType = 'auto';
                        } elseif (str_contains($ramoNombre, 'vida')) {
                            $insuranceType = 'life';
                        } elseif (str_contains($ramoNombre, 'salud')) {
                            $insuranceType = 'health';
                        } elseif (str_contains($ramoNombre, 'hogar')) {
                            $insuranceType = 'home';
                        } else {
                            $insuranceType = 'multiple';
                        }
                    }
                }
            }

            // Separar nombre y apellido
            $nameParts = explode(' ', $customerName, 2);
            $firstName = $nameParts[0] ?? 'Cliente';
            $lastName = $nameParts[1] ?? '';

            // Crear el negocio en el embudo de ventas
            $dealData = [
                'broker_id' => $campaign->broker_id,
                'created_by' => $campaign->created_by ?? 1,
                'client_id' => $clientId,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $contactData['email'] ?? null,
                'phone' => $contactData['phone'] ?? null,
                'stage' => $createDealStage,
                'lead_source' => 'cold_call',
                'insurance_type' => $insuranceType,
                'ramo_id' => $ramoId,
                'poliza_id' => $polizaId,
                'potential_value' => $contactData['policy_value'] ?? 0,
                'close_probability' => $callSuccessful ? 50 : 20,
                'quality_rating' => $callSuccessful ? 'warm' : 'cold',
                'description' => $this->buildDealDescription($call, $callSuccessful, $endedReason, $customerName, $createDealDescription),
                'notes' => !empty($createDealDescription) 
                    ? "{$createDealDescription}\n\n---\nNegocio creado automáticamente desde campaña de voz: {$campaign->name}"
                    : "Negocio creado automáticamente desde campaña de voz: {$campaign->name}",
                'external_reference' => "voice_call:{$call->id}",
                'first_contact_at' => now(),
                'last_contact_at' => now(),
            ];

            $deal = \App\Models\SalesFunnel::create($dealData);

            Log::info('✅ [CREATE-DEAL] Negocio creado en embudo de ventas', [
                'call_id' => $call->id,
                'deal_id' => $deal->id,
                'client_id' => $clientId,
                'stage' => $createDealStage,
                'condition' => $createDealCondition,
            ]);

        } catch (\Throwable $e) {
            Log::error('❌ [CREATE-DEAL] Error creando negocio', [
                'call_id' => $call->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Construir descripción para el negocio
     */
    private function buildDealDescription(VoiceCampaignCall $call, bool $callSuccessful, ?string $endedReason, string $customerName, string $customDescription = ''): string
    {
        $campaign = $call->voiceCampaign;
        $campaignName = $campaign?->name ?? 'Campaña de voz';
        
        $resultText = $callSuccessful ? 'exitosa - cliente interesado' : 'no exitosa';
        if ($endedReason === 'customer-did-not-answer') {
            $resultText = 'no contestada';
        } elseif ($endedReason === 'busy') {
            $resultText = 'ocupado';
        }

        $description = "";
        
        if (!empty($customDescription)) {
            $description .= "{$customDescription}\n\n---\n\n";
        }
        
        $description .= "🔄 Origen: Campaña de renovación\n";
        $description .= "📞 Campaña: {$campaignName}\n";
        $description .= "👤 Cliente: {$customerName}\n";
        $description .= "📊 Resultado llamada: {$resultText}\n";
        $description .= "📅 Fecha contacto: " . $call->created_at->format('d/m/Y H:i') . "\n";
        
        if ($call->call_result && isset($call->call_result['transcript_summary'])) {
            $description .= "\n📝 Resumen de la conversación:\n" . $call->call_result['transcript_summary'];
        }

        return $description;
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
            $basePayUrl = env('PAYMENT_BASE_URL', 'https://pagos.segurossura.com.co/pagos');
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
                    'elevenlabs_phone_number_id' => $campaign->elevenlabs_phone_number_id,
                    'contact_data' => $contact, // Guardar datos del contacto para uso en disparadores
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
                    $errorMsg = $callResult['error'] ?? 'Unknown error';
                    if (is_array($errorMsg)) {
                        $errorMsg = json_encode($errorMsg);
                    }
                    $call->markAsFailed(VoiceCampaignCall::RESULT_API_ERROR, (string) $errorMsg);
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
     * Realizar llamada usando VAPI (con sonido de fondo de oficina)
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
            $vapiApiKey = env('VAPI_PRIVATE_KEY');
            $voiceId = $voiceId ?: 'YPh7OporwNAJ28F5IQrm'; // Angie por defecto
            $backgroundSound = 'office'; // Sonido de oficina por defecto

            // Obtener nombre comercial del broker y resolver VAPI phone number ID
            $broker = null;
            if ($campaign && $campaign->broker_id) {
                $broker = Broker::find($campaign->broker_id);
            }
            $brokerCommercialName = $broker?->name ?? env('DEFAULT_COMPANY_NAME', 'GURO Seguros');

            // Resolver VAPI phone number ID: buscar en las líneas del broker
            $vapiPhoneNumberId = env('VAPI_PHONE_NUMBER_ID'); // fallback global
            if ($broker && $campaign) {
                $brokerSettings = is_array($broker->settings) ? $broker->settings : [];
                $brokerPhoneLines = $brokerSettings['voice_phone_numbers'] ?? [];
                $campaignPhoneId = $campaign->elevenlabs_phone_number_id ?? null;

                foreach ($brokerPhoneLines as $line) {
                    // Si la campaña tiene un phone_number_id de ElevenLabs, buscar la línea que coincida
                    if ($campaignPhoneId && ($line['phone_number_id'] ?? '') === $campaignPhoneId) {
                        if (!empty($line['vapi_phone_number_id'])) {
                            $vapiPhoneNumberId = $line['vapi_phone_number_id'];
                            Log::info('📞 [VAPI] Using broker phone line', [
                                'vapi_id' => $vapiPhoneNumberId,
                                'phone'   => $line['phone_number'] ?? '',
                            ]);
                        }
                        break;
                    }
                }

                // Si no se encontró por campaignPhoneId, usar la primera línea del broker que tenga VAPI ID
                if ($vapiPhoneNumberId === env('VAPI_PHONE_NUMBER_ID') && !empty($brokerPhoneLines)) {
                    foreach ($brokerPhoneLines as $line) {
                        if (!empty($line['vapi_phone_number_id'])) {
                            $vapiPhoneNumberId = $line['vapi_phone_number_id'];
                            break;
                        }
                    }
                }
            }
            $phoneNumberId = $vapiPhoneNumberId;

            if (!$vapiApiKey || !$phoneNumberId) {
                throw new \Exception('VAPI configuration missing (VAPI_PRIVATE_KEY or VAPI_PHONE_NUMBER_ID)');
            }
            
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
            $plateNumber   = $contact['plate_number'] ?? data_get($contact, 'custom_data.plate_number') ?? data_get($contact, 'custom_data.placa') ?? '';
            $policyType    = $contact['policy_type'] ?? data_get($contact, 'custom_data.policy_type') ?? 'auto';
            $debtAmountRaw = $contact['debt_amount'] ?? data_get($contact, 'custom_data.debt_amount') ?? 0;
            $dueDateRaw    = $contact['payment_due_date'] ?? data_get($contact, 'custom_data.payment_due_date') ?? Carbon::now()->addDays(5)->format('Y-m-d');
            $customerName  = $contact['name'] ?? data_get($contact, 'custom_data.customer_name') ?? 'Cliente';
            
            // Formatear fecha en español (sin año)
            $dueDate = $this->formatDateInSpanish($dueDateRaw);
            
            // Formatear monto en español (ej: "ciento cincuenta mil pesos")
            $debtAmountFormatted = $this->formatAmountInSpanish($debtAmountRaw);

            $dynamicVars = [
                // snake_case (recomendado)
                'customer_name'    => $customerName,
                'company_name'     => $companyName,
                'agent_name'       => $agentName ?: 'tu asesor',
                'policy_number'    => (string) $policyNumber,
                'plate_number'     => (string) $plateNumber,
                'policy_type'      => (string) $policyType,
                'debt_amount'      => $debtAmountFormatted,
                'payment_due_date' => (string) $dueDate,
                // aliases más comunes para compatibilidad con distintos agentes (camelCase y variantes)
                'user_name'        => $customerName,
                'client_name'      => $customerName,
                'customerName'     => $customerName,
                'companyName'      => $companyName,
                'agentName'        => $agentName ?: 'tu asesor',
                'policyNumber'     => (string) $policyNumber,
                'plateNumber'      => (string) $plateNumber,
                'policyType'       => (string) $policyType,
                'paymentDueDate'   => (string) $dueDate,
                'debtAmount'       => $debtAmountFormatted,
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

            //Detectar si se quiere dejar un mensaje en el buzon de voz 
            $detectVoicemail = $campaignSettings['voicemail_config']['enabled'] ?? false;

            if($detectVoicemail){
                $rawVoicemailMessage = $campaignSettings['voicemail_config']['message'] ?? '';
                $voicemailMessage = str_replace(
                    ['{customer_name}', '{company_name}'], 
                    [$customerName, $companyName], 
                    $rawVoicemailMessage
                );
                $voicemailPayload = [
                    'voicemailDetection' => [
                        'provider' => 'vapi',
                        'beepMaxAwaitSeconds' => 25,
                        'backoffPlan' => [
                            'maxRetries' => 5,
                            'startAtSeconds' => 2.5
                        ]
                    ],
                    'voicemailMessage' => $voicemailMessage,
                ];
            }else{
                $voicemailPayload = [
                    'voicemailDetection' => [
                        'provider' => 'vapi',
                        'beepMaxAwaitSeconds' => 0,
                        'backoffPlan' => [
                            'maxRetries' => 3,
                            'startAtSeconds' => 1.0
                        ]
                    ],
                ];
            }

            // Construir primer mensaje según tipo de campaña
            $agentDisplayName = $agentName ?: 'tu asesor';
            $safeCompany = $companyName ?: $brokerCommercialName;
            
            // Detectar si es campaña de venta cruzada
            $templateId = $campaignSettings['template_id'] ?? null;
            $isCrossSell = $templateId === 'cross_sell';

            $personalizedFirstMessage = "!Hola¡, ¿Tengo el gusto de hablar con " . $customerName . "?";
            
            // if ($isCrossSell) {
                // Venta cruzada: saludo con empresa pero sin mencionar pólizas
                // $personalizedFirstMessage = "¡Hola " . $customerName . "! Soy " . $agentDisplayName . " de " . $safeCompany . ", tu asesor de seguros ¿cómo estás?";
            // } else {
                // Otras campañas: mencionar póliza/placa si aplica
            //     $policyTypeLabel = !empty($policyType) ? "tu seguro de {$policyType}" : "tu póliza";
            //     $plateInfo = (!empty($plateNumber)) ? " del vehículo placa {$plateNumber}" : "";
            //     $personalizedFirstMessage = "Hola " . $customerName . ", soy " . $agentDisplayName . " de " . $safeCompany . ". " .
            //                                 "Quería hablar contigo sobre " . $policyTypeLabel . $plateInfo . ". ¿Tienes un momento?";
            // }

            if ($isCrossSell) {
                // Venta cruzada: saludo con empresa pero sin mencionar pólizas
                $firstIntroduction = "Le habla " . $agentDisplayName . " de " . $safeCompany . ", tu asesor de seguros ¿cómo estás?";
            } else {
                // Otras campañas: mencionar póliza/placa si aplica
                $policyTypeLabel = !empty($policyType) ? "tu seguro de {$policyType}" : "tu póliza";
                $plateInfo = (!empty($plateNumber)) ? " del vehículo placa {$plateNumber}" : "";
                $firstIntroduction = "Le habla " . $agentDisplayName . " de " . $safeCompany . ". " .
                                            "Quería hablar contigo sobre " . $policyTypeLabel . $plateInfo . ". ¿Tienes un momento?";
            }
            
            // Obtener system_prompt personalizado de la campaña si existe
            $customSystemPrompt = $campaignSettings['system_prompt'] ?? null;

            // Construir instrucciones condicionales de WhatsApp
            $whatsappInstruccion = $whatsappEnabled
                ? " y pregunta si desea recibir el enlace de pago por WhatsApp. Si acepta, confirma el número de WhatsApp sea el mismo donde se está llamando"
                : "";
            
            $whatsappCierre = $whatsappEnabled
                ? "\n   - Si el cliente aceptó recibir el enlace por WhatsApp, confirma el número de WhatsApp sea el mismo donde se está llamando"
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

            // Fecha actual para contexto temporal
            $todayDate = Carbon::now()->locale('es')->isoFormat('dddd D [de] MMMM [de] YYYY');
            $todayContext = "Hoy es {$todayDate}.";
            
            // Determinar el prompt según el tipo de campaña
            if ($isCrossSell) {
                // PROMPT ESPECÍFICO PARA VENTA CRUZADA - PLAN VIDA DEUDOR
                $finalPrompt = trim("
# Personalidad  
Eres {$agentDisplayName}, asesor de {$safeCompany}. Tu estilo es amable, natural y directo. Hablas español de Colombia.

# REGLAS DE CONVERSACIÓN
- Validación: Ya preguntaste por {$customerName}. Si confirma ser esa persona: Preséntate con '{$firstIntroduction}'.Si niega ser esa persona: Di \"Disculpa la confusión, que tengas un buen día\" y usa endCall.
- SIEMPRE espera la respuesta del cliente antes de continuar.
- Mantén respuestas cortas (máximo 2-3 oraciones).
- NUNCA uses símbolos como %, $, o #. Escribe siempre los números, simbolos y porcentajes en palabras (ejemplo: 'por ciento', 'pesos', 'punto'). Habla exclusivamente en español de Colombia.
- Cuando digas números de póliza o placas, dilo dígito por dígito en español.
- NO pidas el número de teléfono, ya lo tienes.

# QUÉ ES EL PLAN VIDA DEUDOR (para responder preguntas)
Es un seguro que protege tus deudas. Si falleces o pierdes más del cincuenta por ciento de tu capacidad laboral, el seguro paga el saldo pendiente de tus créditos. Así evitas dejarle deudas a tu familia.

Coberturas:
- Vida: Si falleces, SURA paga tu deuda pendiente.
- Invalidez (opcional): Si pierdes capacidad laboral, cubre la deuda.
- Auxilio funerario (opcional): Suma adicional para gastos funerarios.

Requisitos: Tener entre 18 y 70 años.

IMPORTANTE: No profundices mucho. Si preguntan detalles, di: \"Un especialista te explicará todo por WhatsApp, sin compromiso.\"

# OBJETIVO
Ofrecer el Plan Vida Deudor y lograr que el cliente acepte que un especialista lo contacte por WhatsApp para revisar si puede ahorrar en el seguro de sus créditos.

# FLUJO DE CONVERSACIÓN

1. SALUDO (ya enviado como primer mensaje, continúa desde aquí)
   ESPERA la respuesta del cliente al saludo.

2. INTRODUCIR EL TEMA (usa este enfoque):
   \"Oye, te cuento rápido. ¿Sabías que si tienes algún crédito, tarjeta o préstamo, es muy probable que ya estés pagando un seguro de vida deudor sin saberlo? Los bancos lo incluyen en las cuotas. ¿Tienes algún crédito actualmente?\"
   ESPERA respuesta.

3. SEGÚN LA RESPUESTA:

   **SI TIENE CRÉDITOS:**
   - \"Perfecto. El Plan Vida Deudor cubre tus deudas si algo te llegara a pasar, y podemos revisar si estás pagando de más. ¿Te gustaría que un especialista te contacte por WhatsApp para darte una cotización sin compromiso?\"
   - Si acepta: \"Excelente, te va a llegar un mensaje por WhatsApp. El especialista revisará tus créditos y te dirá exactamente cuánto puedes ahorrar.\"
   - Pregunta su edad: \"Solo para confirmar, ¿cuántos años tienes? El plan es para personas entre 18 y 70 años.\"
   - Luego ve al CIERRE.
   
   **SI NO TIENE CRÉDITOS:**
   - \"Entiendo. Si en algún momento adquieres un crédito, este seguro te puede ayudar a proteger a tu familia y ahorrar. ¿Hay algo más en lo que pueda ayudarte?\"
   - ESPERA respuesta y ve al CIERRE.

   **SI NO ESTÁ INTERESADO:**
   - \"Entiendo perfectamente. ¿Hay algo más en lo que pueda ayudarte?\"
   - ESPERA respuesta y ve al CIERRE.

4. SI PREGUNTA DETALLES DEL PLAN:
   - \"El Plan Vida Deudor cubre el saldo de tus créditos si falleces o pierdes capacidad laboral. También puede incluir auxilio funerario. Un especialista te puede explicar todo mejor por WhatsApp, ¿te parece?\"

# CIERRE DE LA LLAMADA (MUY IMPORTANTE)

## REGLA: SIEMPRE pregunta \"¿Hay algo más en lo que pueda ayudarte?\" ANTES de despedirte.

Después de que el cliente responda (\"no\", \"nada más\", \"igualmente\", etc.), despídete:
\"Perfecto, muchas gracias por tu tiempo. ¡Que tengas un excelente día! ¡Hasta pronto!\"

## Casos especiales:
- **No lo llamen más**: \"Entendido, disculpa la molestia. ¡Que tengas buen día!\"
- **Está ocupado**: \"Entiendo, ¿te puedo llamar en otro momento?\"

# GUARDRAILS
- No des asesoría financiera detallada.
- Solo pide la edad (18-70 años).
- Si preguntan mucho, deriva al especialista por WhatsApp.
- NUNCA termines sin despedirte cordialmente.
- ESPERA la respuesta del cliente antes de despedirte.

# FINALIZAR LA LLAMADA (MUY IMPORTANTE)
Después de despedirte cordialmente, USA la función endCall para terminar la llamada inmediatamente.
NO sigas hablando después de despedirte. Invoca endCall y la llamada terminará.

{$toolsSection}
");
            } elseif (!empty($customSystemPrompt)) {
                // Usar system_prompt personalizado de la campaña si existe
                $finalPrompt = str_replace(
                    ['{{customer_name}}', '{{company_name}}', '{{agent_name}}', '{{payment_due_date}}', '{{debt_amount}}'],
                    [$customerName, $safeCompany, $agentDisplayName, $dueDate, $debtAmountFormatted],
                    $customSystemPrompt
                );
                // Agregar contexto de fecha actual al inicio
                $finalPrompt = "# Contexto temporal\n{$todayContext}\n\n" . $finalPrompt;
            } else {
                // Prompt por defecto para cobranza
                $finalPrompt = trim("
# Contexto temporal
{$todayContext}

# Personality
Eres {$agentDisplayName}, una asesora de {$safeCompany}. Tienes una personalidad amable, directa y resolutiva. Hablas español de Colombia.

# Environment
Estás realizando una llamada telefónica a un cliente. Mantente profesional y breve.
Datos de contexto disponibles (si aplican):
- Cliente: {$customerName}
- Seguro: {$policyIdentifier}
- Fecha límite: {$dueDate}
- Deuda estimada: {$debtAmountFormatted}

# Tone
Mantén respuestas cortas y directas (máximo 2-3 oraciones). Evita repetir lo que ya se dijo; reformula solo si el cliente no entendió.

# Goal
Tu objetivo es que el cliente entienda claramente el motivo de la llamada (recordatorio de pago), defina el siguiente paso (pago ahora o cuándo){$whatsappInstruccion}. Si no es inmediato, confirma fecha tentativa de pago.

Plan de conversación y orden:
1) Validación: Ya preguntaste por {$customerName}.
    - Si confirma ser esa persona: Preséntate con '{$firstIntroduction}'.
    - Si niega ser esa persona: Di \"Disculpa la confusión, que tengas un buen día\" y usa endCall.
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

# FINALIZAR LA LLAMADA
Después de despedirte cordialmente, USA la función endCall para terminar la llamada inmediatamente.
NO sigas hablando después de despedirte. Invoca endCall y la llamada terminará.

{$toolsSection}
");
            }

            // Payload VAPI con agente transient (inline)
            $payload = [
                'phoneNumberId' => $phoneNumberId,
                'customer' => [
                    'number' => $phone,
                    'name' => $customerName,
                ],
                // Agente transient (inline) - no requiere crear agente previamente
                'assistant' => [
                    'name' => $agentDisplayName,
                    'firstMessage' => $personalizedFirstMessage,
                    'firstMessageMode' => 'assistant-waits-for-user', //Hacemos que el agente espere a que el usuario hable primero
                    'model' => [
                        'provider' => 'openai',
                        'model' => 'gpt-4o-mini',
                        'temperature' => 0.4,
                        'messages' => [
                            [
                                'role' => 'system',
                                'content' => $finalPrompt,
                            ],
                        ],
                        'tools' => [
                            [
                                'type' => 'endCall',
                            ],
                        ],
                    ],
                    'voice' => [
                        'provider' => '11labs',
                        'voiceId' => $voiceId,
                        'stability' => 0.5, // Balance entre consistencia y expresividad
                        'similarityBoost' => 0.75,
                        'style' => 0.4, // Más expresividad emocional
                        'useSpeakerBoost' => true, // Mejora claridad
                    ],
                    'language' => 'es',
                    'transcriber' => [
                        'provider' => 'deepgram',
                        'model' => 'nova-2',
                        'language' => 'es-419', // Español Latinoamérica
                    ],
                    'backgroundSound' => $backgroundSound, // 'office' para sonido de fondo
                    'backchannelingEnabled' => true, // Sonidos de confirmación "mmhm"
                    'backgroundDenoisingEnabled' => true,
                    'maxDurationSeconds' => 600, // 10 minutos máximo
                    'numWordsToInterruptAssistant' => 2,
                    'endCallPhrases' => ['hasta pronto', 'que tengas buen día', 'que tengas un excelente día', 'adiós', 'chao', 'hasta luego', 'que estés bien', 'cuídate mucho', 'buen día'],
                    'silenceTimeoutSeconds' => 30,
                    'responseDelaySeconds' => 0.4,
                    'startSpeakingPlan' => [
                        'waitSeconds' => 0.4,
                        'smartEndpointingEnabled' => true,
                    ],
                    'stopSpeakingPlan' => [
                        'numWords' => 2,
                        'voiceSeconds' => 0.2,
                    ],
                    // Configuración de detección de buzón de voz
                    ...$voicemailPayload,
                    // Configuración de análisis post-llamada en español
                    'analysisPlan' => [
                        'summaryPrompt' => 'Genera un resumen conciso en ESPAÑOL de la conversación telefónica. Incluye: el propósito de la llamada, los puntos principales discutidos, el resultado o acuerdo alcanzado, y cualquier seguimiento necesario. Máximo 3-4 oraciones.',
                        'successEvaluationPrompt' => '#ROL
Actua como un Auditor de Calidad de un Call Center, experto en analisis de sentimientos y conversion.

#TAREA
Evalua el exito de la llamada en una escala del 1 al 10, donde:
- 1: El cliente colgó de inmediato o hubo un rechazo hostil.
- 5: El cliente escuchó la propuesta completa pero no se comprometió (llamada informativa)
- 10: El cliente aceptó explicitamente el objetivo (ej. envío de Whatsapp, agendamiento o pago)

##CRITERIOS DE EVALUACION
Para asignar la nota, analiza:
1. Progreso del objetivo: ¿Que tanto avanzó el asesor hacia el cierre o cumplimiento del objetivo?
2. Engagement: ¿El cliente hizo preguntas o solo dijo "si" por compromiso?
3. Objeciones: ¿El cliente mostró interes real o solo buscaba terminar la llamada?

No te limites a números enteros, puedes usar decimales si la llamada lo amerita (ej. 6.5 si el interes del cliente fue alto pero falto compromiso al final). Responde unicamente con el numero',
                        'successEvaluationRubric' => 'NumericScale',
                        'structuredDataPrompt' => '## TAREA
Analiza la conversación y extrae los siguientes puntos clave:
- interaccion_humana: ¿Cuando se hizo la llamada y se contestó ,¿Habló una persona real? (true/false)
- objetivo_logrado: Determina si se cumplió el propósito de la llamada (ej. aceptó el link de pago, aceptó la cotización de vida deudor o confirmó la fecha de pago).
- resultado_tecnico: Clasifica la naturaleza técnica de la llamada: "CONTACTO_EFECTIVO" (conversación fluida), "OCUPADO" (el cliente no puede hablar),"EQUIVOCADO" (persona equivocada), "BUZON" (contestador detectado), o "FALLA_TECNICA" (se corta o no se escucha).',
                        'structuredDataSchema' => [
                            'type' => 'object',
                            'required' => ['interaccion_humana', 'objetivo_logrado', 'resultado_tecnico'],
                            'properties' => [
                                'interaccion_humana' => [
                                    'type' => 'boolean',
                                    'description' => 'Marcalo como TRUE si habló una persona real y respondió coherentemente. O marcalo FALSE si fue una maquina, musica de espera o nadie habló.'
                                ],
                                'objetivo_logrado' => [
                                    'type' => 'boolean',
                                    'description' => 'Marcalo como TRUE si se cumplió el objetivo principal de la llamada o si aceptó la sesoria y el seguimiento.'
                                ],
                                'resultado_tecnico' => [
                                    'type' => 'string',
                                    'enum' => ['CONTACTO_EFECTIVO', 'OCUPADO', 'EQUIVOCADO', 'BUZON', 'FALLA_TECNICA'],
                                    'description' => 'Marca alguna de estas opciones teniendo en cuenta la clasificación tecnica de la llamada.'
                                ]
                            ]
                        ]
                    ],
                ],
                'metadata' => [
                    'contact_name' => $customerName,
                    'campaign_id' => $campaign->id ?? null,
                    'campaign_type' => 'voice_campaign',
                    'broker_id' => $campaign->broker_id ?? null,
                ],
            ];

            // Agregar server URL al assistant para recibir webhooks
            $webhookUrl = env('VAPI_WEBHOOK_URL', env('APP_URL') . '/api/saas/voice-campaigns/webhooks/vapi');
            $payload['assistant']['server'] = [
                'url' => $webhookUrl,
            ];

            Log::info('🔊 [VAPI] Enviando llamada con sonido de fondo de oficina', [
                'to' => $phone,
                'phone_number_id' => $phoneNumberId,
                'background_sound' => $backgroundSound,
                'first_message_preview' => mb_substr($personalizedFirstMessage, 0, 160),
                'webhook_url' => $webhookUrl,
            ]);

            // Realizar request a VAPI
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $vapiApiKey,
                'Content-Type' => 'application/json'
            ])->timeout(30)->post('https://api.vapi.ai/call/phone', $payload);

            if ($response->successful()) {
                $responseData = $response->json();
                
                Log::info('✅ [VAPI] Llamada iniciada exitosamente', [
                    'vapi_call_id' => $responseData['id'] ?? null,
                    'status' => $responseData['status'] ?? 'queued',
                ]);
                
                return [
                    'success' => true,
                    'call_id' => $responseData['id'] ?? null,
                    'status' => $responseData['status'] ?? 'queued',
                    'response_data' => $responseData
                ];
            } else {
                $errorBody = $response->json();
                $errorMessage = $errorBody['message'] ?? $errorBody['error'] ?? 'VAPI API Error';
                
                Log::error('❌ [VAPI] Error en llamada', [
                    'status' => $response->status(),
                    'error' => $errorMessage,
                    'body' => $errorBody,
                ]);
                
                return [
                    'success' => false,
                    'error' => $errorMessage,
                    'status_code' => $response->status()
                ];
            }

        } catch (\Exception $e) {
            Log::error('🔊 [VAPI] Exception in call', [
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
        // Obtener valores raw
        $dueDateRaw = $contact['payment_due_date'] ?? data_get($contact, 'custom_data.payment_due_date') ?? '';
        $debtAmountRaw = data_get($contact, 'custom_data.debt_amount') ?? $contact['debt_amount'] ?? '';
        
        // Formatear fecha y monto en español para pronunciación natural
        $dueDateFormatted = $this->formatDateInSpanish($dueDateRaw);
        $debtAmountFormatted = $this->formatAmountInSpanish($debtAmountRaw);
        
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
            // Negocio (para plantillas con placeholders) - FORMATEADOS EN ESPAÑOL
            'company_name' => $contact['company_name'] ?? data_get($contact, 'custom_data.company_name') ?? '',
            'policy_number' => $contact['policy_number'] ?? data_get($contact, 'custom_data.policy_number') ?? '',
            'plate_number' => $contact['plate_number'] ?? data_get($contact, 'custom_data.plate_number') ?? data_get($contact, 'custom_data.placa') ?? '',
            'policy_type' => $contact['policy_type'] ?? data_get($contact, 'custom_data.policy_type') ?? 'auto',
            'agent_name' => $contact['agent_name'] ?? data_get($contact, 'custom_data.agent_name') ?? '',
            'payment_due_date' => $dueDateFormatted,
            'debt_amount' => $debtAmountFormatted,
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

            // Búsqueda general: busca en teléfono, nombre del cliente, agente y estado
            if ($request->has('search') && $request->search) {
                $searchTerm = $request->search;
                $query->where(function($q) use ($searchTerm) {
                    $q->where('recipient_phone', 'LIKE', '%' . $searchTerm . '%')
                      ->orWhere('recipient_name', 'LIKE', '%' . $searchTerm . '%')
                      ->orWhere('status', 'LIKE', '%' . $searchTerm . '%')
                      ->orWhereHas('voiceCampaign', function($subQ) use ($searchTerm) {
                          $subQ->where('agent_name', 'LIKE', '%' . $searchTerm . '%')
                               ->orWhere('name', 'LIKE', '%' . $searchTerm . '%');
                      });
                });
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
                                  $voiceCostUsd = (float) ($call->elevenlabs_cost_usd ?? 0);  // Costo voz IA
                                  $phoneCostUsd = (float) ($call->twilio_cost_usd ?? 0);      // Costo telefonía
                                  $totalUsd = (float) ($call->total_cost_usd ?? ($voiceCostUsd + $phoneCostUsd));
                                  $totalWithMarkupUsd = (float) ($call->total_cost_with_markup_usd ?? $totalUsd);
 
                                  // Obtener markup del broker
                                  $markupPercent = (float) env('VOICE_MARKUP_PERCENT', 40);
                                  $broker = $call->broker;
                                  if ($broker && is_array($broker->settings) && isset($broker->settings['voice_calls_markup_percent'])) {
                                      $markupPercent = (float) $broker->settings['voice_calls_markup_percent'];
                                  }
                                  
                                  // Minutos facturados (por minuto adelantado)
                                  $billedMinutes = (int) ($call->twilio_minutes ?? 0);
                                  
                                  $data['costs'] = [
                                      // Costos de voz IA (TTS)
                                      'voice_usd' => round($voiceCostUsd, 6),
                                      'voice_cop' => round($voiceCostUsd * $trm, 2),
                                      // Costos de telefonía (Colombia móvil: $0.0338/min)
                                      'phone_usd' => round($phoneCostUsd, 6),
                                      'phone_cop' => round($phoneCostUsd * $trm, 2),
                                      'billed_minutes' => $billedMinutes,
                                      // Totales
                                      'total_usd' => round($totalUsd, 6),
                                      'total_cop' => round($totalUsd * $trm, 2),
                                      'total_with_markup_usd' => round($totalWithMarkupUsd, 6),
                                      'total_with_markup_cop' => round($totalWithMarkupUsd * $trm, 2),
                                      'cop_rate' => $trm,
                                      'markup_percent' => $markupPercent,
                                  ];
                              } catch (\Throwable $e) {
                                  // Silencioso: si algo falla en costos, no bloquea el historial
                              }
 
                              // Agregar datos recolectados al reporte
                              if (is_array($call->call_metadata) && isset($call->call_metadata['collected_data'])) {
                                  $data['collected_data'] = $call->call_metadata['collected_data'];
                              }
                              
                              // Agregar transcript desde call_metadata
                              if (is_array($call->call_metadata) && isset($call->call_metadata['transcript'])) {
                                  $data['call_transcript'] = $call->call_metadata['transcript'];
                              } elseif ($call->call_transcript) {
                                  $data['call_transcript'] = $call->call_transcript;
                              }

                              // Agregar análisis de ElevenLabs si existe en call_result
                              if (is_array($call->call_result)) {
                                  $data['elevenlabs_analysis'] = $call->call_result;
                              }
                              
                              // Agregar URL de grabación si existe
                              if ($call->call_recording_url) {
                                  $data['call_recording_url'] = $call->call_recording_url;
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
     * Sincronizar datos de una llamada desde VAPI API
     * Útil cuando el webhook falló o los datos no llegaron
     */
    public function syncCallFromVapi(Request $request, $callId): JsonResponse
    {
        try {
            $call = VoiceCampaignCall::find($callId);
            if (!$call) {
                return response()->json(['success' => false, 'message' => 'Llamada no encontrada'], 404);
            }

            $vapiCallId = $call->elevenlabs_conversation_id;
            if (!$vapiCallId) {
                return response()->json(['success' => false, 'message' => 'Esta llamada no tiene ID de VAPI'], 400);
            }

            $vapiApiKey = env('VAPI_PRIVATE_KEY');
            if (!$vapiApiKey) {
                return response()->json(['success' => false, 'message' => 'VAPI API key no configurada'], 500);
            }

            // Llamar a VAPI API para obtener detalles de la llamada
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $vapiApiKey,
            ])->timeout(30)->get("https://api.vapi.ai/call/{$vapiCallId}");

            if (!$response->successful()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error al obtener datos de VAPI',
                    'vapi_status' => $response->status(),
                    'vapi_error' => $response->json()
                ], 400);
            }

            $vapiData = $response->json();
            $before = $call->only(['status', 'duration_seconds', 'total_cost_usd', 'call_recording_url']);

            // Extraer datos de VAPI
            $artifact = $vapiData['artifact'] ?? [];
            $costBreakdown = $vapiData['costBreakdown'] ?? [];
            $analysis = $vapiData['analysis'] ?? [];
            
            // Duración
            $startedAt = $vapiData['startedAt'] ?? null;
            $endedAt = $vapiData['endedAt'] ?? null;
            $durationSeconds = 0;
            if ($startedAt && $endedAt) {
                $durationSeconds = (int) (strtotime($endedAt) - strtotime($startedAt));
            }

            // Costos
            $trm = (float) env('COP_TRM_RATE', 4500);
            $markupPercent = (float) env('VOICE_MARKUP_PERCENT', 40);
            $broker = $call->broker;
            if ($broker && is_array($broker->settings) && isset($broker->settings['voice_calls_markup_percent'])) {
                $markupPercent = (float) $broker->settings['voice_calls_markup_percent'];
            }

            // Minutos facturados (por minuto adelantado - se redondea hacia arriba)
            $billedMinutes = (int) ceil($durationSeconds / 60);
            
            // Tarifa de telefonía Colombia móvil: $0.0338/min
            $phoneRatePerMin = (float) env('TWILIO_USD_PER_MIN', 0.0338);
            
            // Costos de VAPI
            $voiceCostUsd = (float) ($costBreakdown['tts'] ?? 0);
            $phoneCostUsd = (float) ($costBreakdown['transport'] ?? 0);
            
            // Si no hay costo de telefonía de VAPI, calcular con tarifa Colombia
            if ($phoneCostUsd <= 0 && $billedMinutes > 0) {
                $phoneCostUsd = round($billedMinutes * $phoneRatePerMin, 6);
            }
            
            // Costo total: usar el de VAPI si existe, sino calcular
            $totalUsd = (float) ($vapiData['cost'] ?? 0);
            if ($totalUsd <= 0) {
                $totalUsd = round($voiceCostUsd + $phoneCostUsd, 6);
            }
            
            $totalWithMarkupUsd = round($totalUsd * (1 + ($markupPercent / 100)), 6);

            // Grabación y transcripción
            $recordingUrl = $artifact['recordingUrl'] ?? $artifact['stereoRecordingUrl'] ?? null;
            $transcript = $artifact['transcript'] ?? null;

            // Actualizar llamada
            $updateData = [
                'duration_seconds' => $durationSeconds,
                'elevenlabs_cost_usd' => $voiceCostUsd,
                'elevenlabs_cost_cop' => round($voiceCostUsd * $trm, 2),
                'twilio_cost_usd' => $phoneCostUsd,
                'twilio_cost_cop' => round($phoneCostUsd * $trm, 2),
                'twilio_minutes' => $billedMinutes,
                'total_cost_usd' => $totalUsd,
                'total_cost_cop' => round($totalUsd * $trm, 2),
                'total_cost_with_markup_usd' => $totalWithMarkupUsd,
                'total_cost_with_markup_cop' => round($totalWithMarkupUsd * $trm, 2),
            ];

            if ($recordingUrl) {
                $updateData['call_recording_url'] = $recordingUrl;
            }

            // Actualizar status si la llamada terminó
            $vapiStatus = $vapiData['status'] ?? null;
            if ($vapiStatus === 'ended' && $call->status !== 'completed') {
                $updateData['status'] = 'completed';
                $updateData['call_ended_at'] = $endedAt ? now()->parse($endedAt) : now();
            }

            $call->update($updateData);

            // Guardar transcript en metadata
            if ($transcript) {
                $meta = is_array($call->call_metadata) ? $call->call_metadata : [];
                $meta['transcript'] = $transcript;
                $meta['vapi_analysis'] = $analysis;
                $meta['synced_from_vapi_at'] = now()->toIso8601String();
                $call->update(['call_metadata' => $meta]);
            }

            $after = $call->fresh()->only(['status', 'duration_seconds', 'total_cost_usd', 'call_recording_url']);

            Log::info('🔄 [VAPI SYNC] Llamada sincronizada desde VAPI', [
                'call_id' => $call->id,
                'vapi_call_id' => $vapiCallId,
                'before' => $before,
                'after' => $after,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Datos sincronizados desde VAPI',
                'call_id' => $call->id,
                'before' => $before,
                'after' => $after,
                'has_recording' => !empty($recordingUrl),
                'has_transcript' => !empty($transcript),
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [VAPI SYNC] Error al sincronizar', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'message' => 'Error al sincronizar desde VAPI',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Sincronizar múltiples llamadas pendientes desde VAPI
     */
    public function syncPendingCallsFromVapi(Request $request): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            if (!$brokerId) {
                return response()->json(['success' => false, 'message' => 'Broker no identificado'], 401);
            }

            // Buscar llamadas que tienen VAPI ID pero no tienen datos completos
            $pendingCalls = VoiceCampaignCall::forBroker($brokerId)
                ->whereNotNull('elevenlabs_conversation_id')
                ->where(function ($q) {
                    $q->whereNull('total_cost_usd')
                      ->orWhere('total_cost_usd', 0)
                      ->orWhereNull('call_recording_url');
                })
                ->where('created_at', '>=', now()->subDays(7)) // Solo últimos 7 días
                ->limit(20) // Máximo 20 por request
                ->get();

            if ($pendingCalls->isEmpty()) {
                return response()->json([
                    'success' => true,
                    'message' => 'No hay llamadas pendientes de sincronizar',
                    'synced' => 0
                ]);
            }

            $synced = 0;
            $errors = [];

            foreach ($pendingCalls as $call) {
                try {
                    // Simular request para reutilizar syncCallFromVapi
                    $result = $this->syncCallFromVapi($request, $call->id);
                    $data = json_decode($result->getContent(), true);
                    if ($data['success'] ?? false) {
                        $synced++;
                    } else {
                        $errors[] = ['call_id' => $call->id, 'error' => $data['message'] ?? 'Unknown'];
                    }
                } catch (\Exception $e) {
                    $errors[] = ['call_id' => $call->id, 'error' => $e->getMessage()];
                }
            }

            return response()->json([
                'success' => true,
                'message' => "Sincronizadas {$synced} de {$pendingCalls->count()} llamadas",
                'synced' => $synced,
                'total_pending' => $pendingCalls->count(),
                'errors' => $errors
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al sincronizar llamadas pendientes',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Sincronizar estado de campaña en tiempo real desde VAPI API
     * Este endpoint consulta directamente VAPI para obtener el estado actual de las llamadas
     * Ideal para polling desde el frontend cada 3-5 segundos durante ejecución de campaña
     */
    public function syncCampaignRealtime(Request $request, int $campaignId): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            if (!$brokerId) {
                return response()->json(['success' => false, 'message' => 'Broker no identificado'], 401);
            }

            $campaign = VoiceCampaign::forBroker($brokerId)->find($campaignId);
            if (!$campaign) {
                return response()->json(['success' => false, 'message' => 'Campaña no encontrada'], 404);
            }

            $vapiApiKey = env('VAPI_PRIVATE_KEY');
            if (!$vapiApiKey) {
                return response()->json(['success' => false, 'message' => 'VAPI API key no configurada'], 500);
            }

            // Solo obtener llamadas que NO están finalizadas (evita re-sincronizar las ya completadas)
            // Estados finales: completed, failed - no necesitan sincronización
            $activeStatuses = [
                VoiceCampaignCall::STATUS_PENDING,
                VoiceCampaignCall::STATUS_INITIATED,
                VoiceCampaignCall::STATUS_RINGING,
                VoiceCampaignCall::STATUS_ANSWERED,
                VoiceCampaignCall::STATUS_IN_PROGRESS,
            ];
            
            $calls = $campaign->calls()
                ->whereNotNull('elevenlabs_conversation_id')
                ->whereIn('status', $activeStatuses)
                ->where('created_at', '>=', now()->subHours(24))
                ->get();
            
            // Si no hay llamadas activas, verificar si la campaña debe marcarse como completada
            if ($calls->isEmpty()) {
                $campaignCompleted = false;
                
                // Solo marcar como completada si es campaña INMEDIATA y está en running
                // Las campañas programadas/recurrentes NO se marcan automáticamente
                $isImmediateCampaign = $campaign->campaign_type === VoiceCampaign::TYPE_IMMEDIATE;
                
                if ($isImmediateCampaign && $campaign->status === VoiceCampaign::STATUS_RUNNING) {
                    $hasPendingScheduledCalls = \App\Models\VoiceCampaignScheduledCall::where('voice_campaign_id', $campaign->id)
                        ->where('status', \App\Models\VoiceCampaignScheduledCall::STATUS_PENDING)
                        ->exists();
                    
                    $hasTriggers = \App\Models\VoiceCampaignTrigger::where('voice_campaign_id', $campaign->id)
                        ->where('enabled', true)
                        ->exists();
                    
                    if (!$hasPendingScheduledCalls && !$hasTriggers) {
                        $campaign->status = VoiceCampaign::STATUS_COMPLETED;
                        $campaign->save();
                        $campaignCompleted = true;
                        
                        Log::info('✅ [VAPI REALTIME SYNC] Campaña INMEDIATA marcada como completada', [
                            'campaign_id' => $campaign->id,
                            'campaign_name' => $campaign->name,
                            'campaign_type' => $campaign->campaign_type,
                        ]);
                    }
                }
                
                return response()->json([
                    'success' => true,
                    'campaign' => [
                        'id' => $campaign->id,
                        'status' => $campaign->status,
                        'calls_made' => $campaign->calls_made,
                        'calls_successful' => $campaign->calls_successful,
                        'calls_failed' => $campaign->calls_failed,
                        'progress_percentage' => $campaign->progress_percentage,
                    ],
                    'synced' => 0,
                    'updated' => [],
                    'campaign_completed' => $campaignCompleted || $campaign->isCompleted(),
                    'remaining_active_calls' => 0,
                    'message' => 'No hay llamadas activas para sincronizar',
                ]);
            }

            $synced = 0;
            $updated = [];
            $campaignCompleted = false;

            foreach ($calls as $call) {
                $vapiCallId = $call->elevenlabs_conversation_id;
                if (!$vapiCallId) continue;

                try {
                    // Consultar VAPI API
                    $response = Http::withHeaders([
                        'Authorization' => 'Bearer ' . $vapiApiKey,
                    ])->timeout(10)->get("https://api.vapi.ai/call/{$vapiCallId}");

                    if (!$response->successful()) continue;

                    $vapiData = $response->json();
                    $vapiStatus = $vapiData['status'] ?? 'unknown';
                    $endedReason = $vapiData['endedReason'] ?? null;

                    // Mapear estado de VAPI a nuestro estado
                    $newStatus = $this->mapVapiStatusToLocal($vapiStatus);
                    $oldStatus = $call->status;

                    // Solo actualizar si cambió el estado
                    if ($newStatus !== $oldStatus) {
                        // Extraer datos adicionales si la llamada terminó
                        if ($vapiStatus === 'ended') {
                            $this->syncCallDataFromVapi($call, $vapiData);
                        } else {
                            $call->update(['status' => $newStatus]);
                        }
                        
                        $updated[] = [
                            'call_id' => $call->id,
                            'old_status' => $oldStatus,
                            'new_status' => $newStatus,
                            'vapi_status' => $vapiStatus,
                        ];
                        $synced++;
                    }
                } catch (\Exception $e) {
                    // Ignorar errores individuales, continuar con las demás
                    continue;
                }
            }

            // Actualizar contadores de la campaña
            $campaign->updateCallCounters();

            // Verificar si la campaña debe marcarse como completada
            $activeStatuses = [
                VoiceCampaignCall::STATUS_PENDING,
                VoiceCampaignCall::STATUS_INITIATED,
                VoiceCampaignCall::STATUS_RINGING,
                VoiceCampaignCall::STATUS_ANSWERED,
                VoiceCampaignCall::STATUS_IN_PROGRESS,
            ];
            $remainingCalls = $campaign->calls()->whereIn('status', $activeStatuses)->count();

            // Si no quedan llamadas activas y la campaña es INMEDIATA en running, marcarla como completada
            // Las campañas programadas/recurrentes NO se marcan automáticamente
            $isImmediateCampaign = $campaign->campaign_type === VoiceCampaign::TYPE_IMMEDIATE;
            
            if ($remainingCalls === 0 && $isImmediateCampaign && $campaign->status === VoiceCampaign::STATUS_RUNNING) {
                // Verificar si tiene llamadas programadas pendientes o triggers activos
                $hasPendingScheduledCalls = \App\Models\VoiceCampaignScheduledCall::where('voice_campaign_id', $campaign->id)
                    ->where('status', \App\Models\VoiceCampaignScheduledCall::STATUS_PENDING)
                    ->exists();
                
                $hasTriggers = \App\Models\VoiceCampaignTrigger::where('voice_campaign_id', $campaign->id)
                    ->where('enabled', true)
                    ->exists();
                
                if (!$hasPendingScheduledCalls && !$hasTriggers) {
                    // Campaña INMEDIATA sin triggers ni llamadas pendientes: marcar como completada
                    $campaign->status = VoiceCampaign::STATUS_COMPLETED;
                    $campaign->save();
                    $campaignCompleted = true;
                    
                    Log::info('✅ [VAPI REALTIME SYNC] Campaña INMEDIATA marcada como completada', [
                        'campaign_id' => $campaign->id,
                        'campaign_name' => $campaign->name,
                        'campaign_type' => $campaign->campaign_type,
                    ]);
                }
            }

            $campaign->refresh();

            return response()->json([
                'success' => true,
                'campaign' => [
                    'id' => $campaign->id,
                    'status' => $campaign->status,
                    'calls_made' => $campaign->calls_made,
                    'calls_successful' => $campaign->calls_successful,
                    'calls_failed' => $campaign->calls_failed,
                    'progress_percentage' => $campaign->progress_percentage,
                ],
                'synced' => $synced,
                'updated' => $updated,
                'campaign_completed' => $campaignCompleted,
                'remaining_active_calls' => $remainingCalls,
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [VAPI REALTIME SYNC] Error', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'message' => 'Error al sincronizar campaña',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Mapear estado de VAPI a estado local
     */
    private function mapVapiStatusToLocal(string $vapiStatus): string
    {
        $map = [
            'queued' => VoiceCampaignCall::STATUS_PENDING,
            'ringing' => VoiceCampaignCall::STATUS_RINGING,
            'in-progress' => VoiceCampaignCall::STATUS_IN_PROGRESS,
            'forwarding' => VoiceCampaignCall::STATUS_IN_PROGRESS,
            'ended' => VoiceCampaignCall::STATUS_COMPLETED,
        ];
        return $map[$vapiStatus] ?? VoiceCampaignCall::STATUS_FAILED;
    }

    /**
     * Sincronizar datos completos de una llamada desde VAPI
     */
    private function syncCallDataFromVapi(VoiceCampaignCall $call, array $vapiData): void
    {
        $artifact = $vapiData['artifact'] ?? [];
        $costBreakdown = $vapiData['costBreakdown'] ?? [];
        $analysis = $vapiData['analysis'] ?? [];
        
        // Duración
        $startedAt = $vapiData['startedAt'] ?? null;
        $endedAt = $vapiData['endedAt'] ?? null;
        $durationSeconds = 0;
        if ($startedAt && $endedAt) {
            $durationSeconds = (int) (strtotime($endedAt) - strtotime($startedAt));
        }

        // Costos
        $trm = (float) env('COP_TRM_RATE', 4500);
        $markupPercent = (float) env('VOICE_MARKUP_PERCENT', 40);
        $broker = $call->broker;
        if ($broker && is_array($broker->settings) && isset($broker->settings['voice_calls_markup_percent'])) {
            $markupPercent = (float) $broker->settings['voice_calls_markup_percent'];
        }

        $voiceCostUsd = (float) ($costBreakdown['tts'] ?? 0);
        $phoneCostUsd = (float) ($costBreakdown['transport'] ?? 0);
        $billedMinutes = (int) ceil($durationSeconds / 60);
        
        if ($phoneCostUsd == 0 && $durationSeconds > 0) {
            $phoneRatePerMin = (float) env('TWILIO_USD_PER_MIN', 0.0338);
            $phoneCostUsd = $billedMinutes * $phoneRatePerMin;
        }

        $totalUsd = $voiceCostUsd + $phoneCostUsd;
        $totalWithMarkupUsd = $totalUsd * (1 + $markupPercent / 100);

        // Recording URL
        $recordingUrl = $artifact['stereoRecordingUrl'] 
            ?? $artifact['recordingUrl'] 
            ?? $vapiData['recordingUrl'] 
            ?? null;

        // Transcript
        $transcript = $artifact['transcript'] ?? $vapiData['transcript'] ?? null;

        // Determinar si fue exitosa - usar successEvaluation de VAPI si está disponible
        $endedReason = $vapiData['endedReason'] ?? null;
        $successEvaluation = $analysis['successEvaluation'] ?? null;
        
        // Razones que indican que NO hubo contacto real
        $noContactReasons = ['no-answer', 'busy', 'dial-no-answer', 'dial-busy', 'customer-did-not-answer', 'customer-busy', 'machine-detected', 'voicemail', 'failed'];
        
        // Determinar si hubo contacto real (el cliente contestó y hubo conversación)
        $wasContacted = $durationSeconds >= 10 && !in_array($endedReason, $noContactReasons);
        
        // Si VAPI proporciona successEvaluation, usarlo para determinar éxito del objetivo
        if ($successEvaluation !== null) {
            // successEvaluation puede ser boolean o string "true"/"false"
            $callSuccessful = filter_var($successEvaluation, FILTER_VALIDATE_BOOLEAN);
        } else {
            // Fallback: si hubo contacto real, considerar exitosa (aunque haya terminado por silencio)
            // silence-timed-out después de conversación = cliente contactado pero no cerró objetivo
            $callSuccessful = $wasContacted;
        }

        // Actualizar llamada
        $call->update([
            'status' => $callSuccessful ? VoiceCampaignCall::STATUS_COMPLETED : VoiceCampaignCall::STATUS_FAILED,
            'duration_seconds' => $durationSeconds,
            'call_recording_url' => $recordingUrl,
            'elevenlabs_cost_usd' => $voiceCostUsd,
            'twilio_cost_usd' => $phoneCostUsd,
            'twilio_minutes' => $billedMinutes,
            'total_cost_usd' => $totalUsd,
            'total_cost_with_markup_usd' => $totalWithMarkupUsd,
            'call_result' => [
                'transcript_summary' => $analysis['summary'] ?? null,
                'call_successful' => $callSuccessful,
                'termination_reason' => $endedReason,
                'vapi_status' => 'ended',
            ],
        ]);

        // Guardar transcript en metadata
        if ($transcript) {
            $meta = is_array($call->call_metadata) ? $call->call_metadata : [];
            $meta['transcript'] = $transcript;
            $meta['synced_from_vapi_at'] = now()->toIso8601String();
            $call->update(['call_metadata' => $meta]);
        }

        // Sincronizar estado de llamada programada (si existe)
        try {
            $scheduledCall = \App\Models\VoiceCampaignScheduledCall::where('voice_campaign_call_id', $call->id)->first();
            if ($scheduledCall && $scheduledCall->status === 'called') {
                if ($callSuccessful) {
                    $scheduledCall->markAsCompleted();
                } else {
                    $scheduledCall->markAsFailed($endedReason ?? 'Llamada no exitosa');
                }
                Log::info('📅 [SCHEDULED CALL] Estado sincronizado', [
                    'scheduled_call_id' => $scheduledCall->id,
                    'new_status' => $scheduledCall->status,
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning('⚠️ [SCHEDULED CALL] Error sincronizando estado', ['error' => $e->getMessage()]);
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
     * Ejecutar campaña manualmente
     * POST /saas/voice-campaigns/{id}/execute
     */
    public function execute(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = (int) $this->getBrokerId($request);
            $campaign = VoiceCampaign::forBroker($brokerId)->where('id', $id)->first();

            if (!$campaign) {
                return response()->json(['success' => false, 'message' => 'Campaña no encontrada'], 404);
            }

            // Verificar que la campaña tenga contactos
            if (empty($campaign->contacts) || count($campaign->contacts) === 0) {
                return response()->json([
                    'success' => false, 
                    'message' => 'La campaña no tiene contactos configurados'
                ], 400);
            }

            // Solo permitir ejecutar campañas en draft, scheduled o paused
            $allowedStatuses = [VoiceCampaign::STATUS_DRAFT, VoiceCampaign::STATUS_SCHEDULED, VoiceCampaign::STATUS_PAUSED];
            if (!in_array($campaign->status, $allowedStatuses)) {
                return response()->json([
                    'success' => false, 
                    'message' => 'Solo se pueden ejecutar campañas en estado borrador, programadas o pausadas. Estado actual: ' . $campaign->status
                ], 400);
            }

            Log::info('🔊 [VOICE CAMPAIGN] Executing campaign manually', [
                'campaign_id' => $campaign->id,
                'campaign_name' => $campaign->name,
                'contacts_count' => count($campaign->contacts)
            ]);

            // Ejecutar la campaña
            $execution = $this->executeVoiceCampaign($campaign);

            return response()->json([
                'success' => true,
                'message' => 'Campaña ejecutada exitosamente',
                'execution_id' => $execution->id,
                'data' => $campaign->fresh()
            ]);
        } catch (\Throwable $e) {
            Log::error('Error al ejecutar campaña', [
                'campaign_id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false, 
                'message' => 'Error al ejecutar campaña: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reiniciar/Repetir campaña (para campañas completadas o canceladas)
     * POST /saas/voice-campaigns/{id}/restart
     */
    public function restart(Request $request, int $id): JsonResponse
    {
        try {
            $brokerId = (int) $this->getBrokerId($request);
            $campaign = VoiceCampaign::forBroker($brokerId)->where('id', $id)->first();

            if (!$campaign) {
                return response()->json(['success' => false, 'message' => 'Campaña no encontrada'], 404);
            }

            // Solo permitir reiniciar campañas completadas o canceladas
            if (!in_array($campaign->status, [VoiceCampaign::STATUS_COMPLETED, VoiceCampaign::STATUS_CANCELLED])) {
                return response()->json([
                    'success' => false, 
                    'message' => 'Solo se pueden reiniciar campañas completadas o canceladas'
                ], 400);
            }

            // Resetear el estado de la campaña
            $campaign->update([
                'is_active' => true,
                'status' => VoiceCampaign::STATUS_RUNNING,
                'last_execution' => now(),
            ]);

            // Habilitar triggers
            $this->setTriggersEnabled((int)$campaign->id, true);

            // Ejecutar la campaña
            $result = $this->execute($request, $id);
            $resultData = json_decode($result->getContent(), true);

            return response()->json([
                'success' => true,
                'message' => 'Campaña reiniciada y ejecutándose',
                'data' => $campaign->fresh(),
                'execution_id' => $resultData['execution_id'] ?? null,
            ]);
        } catch (\Throwable $e) {
            Log::error('Error al reiniciar campaña', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error al reiniciar campaña: ' . $e->getMessage()], 500);
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
     * Obtener llamadas programadas de una campaña
     */
    public function getScheduledCalls(Request $request, int $campaignId): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $campaign = VoiceCampaign::forBroker($brokerId)->findOrFail($campaignId);
            
            $scheduler = new \App\Services\VoiceCampaignSchedulerService();
            $result = $scheduler->getScheduledCalls($campaign, [
                'status' => $request->get('status'),
                'date' => $request->get('date'),
                'from_date' => $request->get('from_date'),
                'to_date' => $request->get('to_date'),
            ]);
            
            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener llamadas programadas',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Programar llamadas para una campaña basándose en su objetivo
     */
    public function scheduleCallsForCampaign(Request $request, int $campaignId): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $campaign = VoiceCampaign::forBroker($brokerId)->findOrFail($campaignId);
            
            $scheduler = new \App\Services\VoiceCampaignSchedulerService();
            $result = $scheduler->scheduleCallsForCampaign($campaign, [
                'days_before' => $request->get('days_before', [7, 3, 1, 0]),
                'days_after' => $request->get('days_after', [1, 3, 5]),
                'limit' => $request->get('limit', 500),
            ]);
            
            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al programar llamadas',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Refrescar llamadas programadas de una campaña
     * Agrega nuevas pólizas/clientes que ahora aplican para la campaña
     */
    public function refreshScheduledCalls(Request $request, int $campaignId): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $campaign = VoiceCampaign::forBroker($brokerId)->findOrFail($campaignId);
            
            $scheduler = new \App\Services\VoiceCampaignSchedulerService();
            $result = $scheduler->refreshScheduledCalls($campaign);
            
            return response()->json([
                'success' => true,
                'data' => $result,
                'message' => "Se agregaron {$result['scheduled']} nuevas llamadas programadas"
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al refrescar llamadas',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Ejecutar una llamada programada específica
     */
    public function executeScheduledCall(Request $request, int $scheduledCallId): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $scheduledCall = \App\Models\VoiceCampaignScheduledCall::query()
                ->where('broker_id', $brokerId)
                ->findOrFail($scheduledCallId);
            
            if ($scheduledCall->status !== \App\Models\VoiceCampaignScheduledCall::STATUS_PENDING) {
                return response()->json([
                    'success' => false,
                    'message' => 'Esta llamada ya fue procesada'
                ], 400);
            }
            
            $campaign = $scheduledCall->campaign;
            $contact = $scheduledCall->contact_data;
            
            // Marcar como en cola
            $scheduledCall->markAsQueued();
            
            // Ejecutar la llamada
            $callService = new \App\Services\VoiceCampaignCallService();
            $result = $callService->startSingleCall($campaign, $contact);
            
            if ($result['success']) {
                $scheduledCall->markAsCalled($result['voice_campaign_call_id']);
            } else {
                $scheduledCall->markAsFailed($result['error'] ?? 'Error desconocido');
            }
            
            return response()->json([
                'success' => $result['success'],
                'data' => $result
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al ejecutar llamada programada',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reintentar una llamada programada fallida (no contestada, ocupado, etc.)
     */
    public function retryScheduledCall(Request $request, int $scheduledCallId): JsonResponse
    {
        try {
            $brokerId = $this->getBrokerId($request);
            
            $scheduledCall = \App\Models\VoiceCampaignScheduledCall::query()
                ->where('broker_id', $brokerId)
                ->findOrFail($scheduledCallId);
            
            // Solo permitir reintentar llamadas fallidas por razones de no contacto
            $retryableReasons = [
                'customer-did-not-answer', 'no-answer', 'busy', 'customer-busy', 
                'dial-no-answer', 'dial-busy', 'silence-timed-out', 'voicemail'
            ];
            
            if ($scheduledCall->status !== \App\Models\VoiceCampaignScheduledCall::STATUS_FAILED) {
                return response()->json([
                    'success' => false,
                    'message' => 'Solo se pueden reintentar llamadas fallidas'
                ], 400);
            }
            
            if (!in_array($scheduledCall->status_reason, $retryableReasons)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Esta llamada no puede reintentarse por el tipo de error'
                ], 400);
            }
            
            // Resetear el estado a pendiente
            $scheduledCall->update([
                'status' => \App\Models\VoiceCampaignScheduledCall::STATUS_PENDING,
                'status_reason' => null,
                'voice_campaign_call_id' => null,
                'retry_count' => $scheduledCall->retry_count + 1,
            ]);
            
            return response()->json([
                'success' => true,
                'message' => 'Llamada programada para reintento',
                'data' => [
                    'id' => $scheduledCall->id,
                    'status' => 'pending',
                    'retry_count' => $scheduledCall->retry_count,
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al reintentar llamada',
                'error' => $e->getMessage()
            ], 500);
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
