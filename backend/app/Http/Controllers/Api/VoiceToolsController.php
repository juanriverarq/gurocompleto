<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VoiceCampaignCall;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

/**
 * Controlador para manejar Custom Tools de ElevenLabs
 * Recibe datos estructurados durante las llamadas
 */
class VoiceToolsController extends Controller
{
    /**
     * Recibir datos recolectados por Custom Tool de ElevenLabs
     * 
     * Este endpoint es llamado por ElevenLabs cuando el agente usa un Custom Tool
     * durante la llamada para recolectar datos del cliente
     */
    public function collectData(Request $request, string $conversationId = 'unknown'): JsonResponse
    {
        try {
            // Si conversation_id viene como "unknown", intentar obtenerlo del body
            if ($conversationId === 'unknown' || empty($conversationId)) {
                $conversationId = $request->input('conversation_id') ?? 'unknown';
            }
            
            Log::info('🔧 [VOICE TOOLS] Recibiendo datos de Custom Tool', [
                'conversation_id_path' => $conversationId,
                'conversation_id_body' => $request->input('conversation_id'),
                'payload' => $request->all(),
                'url' => $request->fullUrl()
            ]);

            // Si aún es "unknown", buscar la última llamada activa
            if ($conversationId === 'unknown') {
                Log::info('🔍 [VOICE TOOLS] conversation_id es unknown, buscando última llamada activa');
                
                // Buscar la última llamada que esté en progreso o recién iniciada
                $call = VoiceCampaignCall::whereIn('status', [
                    'pending', 'initiated', 'ringing', 'answered', 'in_progress'
                ])
                ->where('created_at', '>=', now()->subMinutes(10))
                ->orderBy('id', 'desc')
                ->first();
                
                if ($call) {
                    Log::info('✅ [VOICE TOOLS] Llamada encontrada por estado activo', [
                        'call_id' => $call->id,
                        'recipient' => $call->recipient_name,
                        'status' => $call->status
                    ]);
                } else {
                    Log::warning('⚠️ [VOICE TOOLS] No se encontró ninguna llamada activa reciente');
                }
            } else {
                // Buscar la llamada por conversation_id con múltiples intentos
                $call = VoiceCampaignCall::where('elevenlabs_conversation_id', $conversationId)->first();
                
                if (!$call) {
                    // Fallback 1: buscar por elevenlabs_call_id
                    $call = VoiceCampaignCall::where('elevenlabs_call_id', $conversationId)->first();
                }
                
                if (!$call) {
                    // Fallback 2: buscar por conversation_id sin prefijo
                    $cleanId = str_replace('conv_', '', $conversationId);
                    $call = VoiceCampaignCall::where('elevenlabs_conversation_id', 'LIKE', "%{$cleanId}%")->first();
                }
            }

            if (!$call) {
                Log::warning('🔧 [VOICE TOOLS] Llamada no encontrada después de todos los fallbacks', [
                    'conversation_id' => $conversationId,
                    'payload' => $request->all()
                ]);
                
                // Guardar en caché genérico para la próxima llamada que complete
                $cacheKey = 'tool_data:latest';
                \Cache::put($cacheKey, [
                    'data' => $request->all(),
                    'timestamp' => now()->toDateTimeString(),
                    'conversation_id' => $conversationId
                ], now()->addHours(2));
                
                Log::info('💾 [VOICE TOOLS] Datos guardados en caché genérico', [
                    'cache_key' => $cacheKey,
                    'data' => $request->all()
                ]);
                
                // Retornar success para no bloquear la llamada
                return response()->json([
                    'success' => true,
                    'message' => 'Datos recibidos y guardados, se aplicarán al completar la llamada'
                ]);
            }

            // Validar datos recibidos
            $validator = Validator::make($request->all(), [
                'email' => 'nullable|email',
                'phone' => 'nullable|string',
                'debt_amount' => 'nullable|numeric',
                'payment_commitment_date' => 'nullable|date',
                'satisfaction_rating' => 'nullable|integer|min:1|max:10',
                'recommendation_score' => 'nullable|integer|min:1|max:10',
                'feedback' => 'nullable|string',
                'improvement_suggestions' => 'nullable|string',
                'positive_aspects' => 'nullable|string',
                'preferred_contact_method' => 'nullable|string|in:whatsapp,email,phone',
                'has_questions' => 'nullable|boolean'
            ]);

            if ($validator->fails()) {
                Log::warning('🔧 [VOICE TOOLS] Datos inválidos', [
                    'errors' => $validator->errors(),
                    'data' => $request->all()
                ]);
            }

            // Obtener metadata actual
            $meta = is_array($call->call_metadata) ? $call->call_metadata : [];
            $existingData = $meta['collected_data'] ?? [];

            // Preparar nuevos datos con estructura consistente
            $newData = [];
            foreach ($request->all() as $field => $value) {
                if ($value !== null && $value !== '') {
                    $newData[$field] = [
                        'value' => $value,
                        'confidence' => 1.0, // Datos del tool tienen máxima confianza
                        'source' => 'elevenlabs_tool',
                        'collected_at' => now()->toDateTimeString()
                    ];
                }
            }

            // Merge con datos existentes (tool data tiene prioridad)
            $meta['collected_data'] = array_merge($existingData, $newData);
            
            // Marcar que se usó tool
            $meta['tool_used'] = true;
            $meta['tool_called_at'] = now()->toDateTimeString();

            // Actualizar llamada
            $call->update(['call_metadata' => $meta]);

            Log::info('✅ [VOICE TOOLS] Datos guardados exitosamente', [
                'call_id' => $call->id,
                'conversation_id' => $conversationId,
                'fields_collected' => array_keys($newData)
            ]);

            // Respuesta para ElevenLabs
            return response()->json([
                'success' => true,
                'message' => 'Datos guardados correctamente',
                'data' => [
                    'fields_saved' => array_keys($newData),
                    'call_id' => $call->id
                ]
            ]);

        } catch (\Throwable $e) {
            Log::error('❌ [VOICE TOOLS] Error procesando datos del tool', [
                'conversation_id' => $conversationId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            // Retornar success para no bloquear la llamada
            return response()->json([
                'success' => true,
                'message' => 'Error procesando datos, se reintentará en webhook',
                'error' => $e->getMessage()
            ], 200);
        }
    }

    /**
     * Programar envío de enlace de pago (llamado por Custom Tool durante la llamada)
     */
    public function schedulePaymentLink(Request $request, string $conversationId): JsonResponse
    {
        try {
            Log::info('🔧 [VOICE TOOLS] Programando envío de enlace de pago', [
                'conversation_id' => $conversationId,
                'data' => $request->all()
            ]);

            $validator = Validator::make($request->all(), [
                'phone' => 'required|string',
                'amount_cop' => 'required|numeric|min:100',
                'customer_name' => 'nullable|string',
                'reference' => 'nullable|string'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Datos inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            $call = VoiceCampaignCall::where('elevenlabs_conversation_id', $conversationId)->first();
            
            if (!$call) {
                $call = VoiceCampaignCall::where('elevenlabs_call_id', $conversationId)->first();
            }

            $schedule = [
                'phone' => $request->get('phone'),
                'amount_cop' => (int) $request->get('amount_cop'),
                'customer_name' => $request->get('customer_name') ?: ($call->recipient_name ?? 'Cliente'),
                'reference' => $request->get('reference') ?: ('CONV-' . $conversationId),
                'scheduled_at' => now()->toDateTimeString()
            ];

            if ($call) {
                $meta = is_array($call->call_metadata) ? $call->call_metadata : [];
                $meta['payment_on_completion'] = $schedule;
                $call->update(['call_metadata' => $meta]);
            }

            Log::info('✅ [VOICE TOOLS] Enlace de pago programado', [
                'conversation_id' => $conversationId,
                'call_id' => $call->id ?? null
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Enlace de pago programado para envío al finalizar la llamada',
                'data' => $schedule
            ]);

        } catch (\Throwable $e) {
            Log::error('❌ [VOICE TOOLS] Error programando enlace', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Se procesará en webhook'
            ], 200);
        }
    }

    /**
     * Webhook genérico para cualquier Custom Tool
     */
    public function handleToolCall(Request $request, string $conversationId): JsonResponse
    {
        try {
            $toolName = $request->input('tool_name');
            $parameters = $request->input('parameters', []);

            Log::info('🔧 [VOICE TOOLS] Tool call recibido', [
                'conversation_id' => $conversationId,
                'tool_name' => $toolName,
                'parameters' => $parameters
            ]);

            $call = VoiceCampaignCall::where('elevenlabs_conversation_id', $conversationId)
                ->orWhere('elevenlabs_call_id', $conversationId)
                ->first();

            if ($call) {
                $meta = is_array($call->call_metadata) ? $call->call_metadata : [];
                
                // Guardar datos del tool
                if (!isset($meta['tool_calls'])) {
                    $meta['tool_calls'] = [];
                }
                
                $meta['tool_calls'][] = [
                    'tool_name' => $toolName,
                    'parameters' => $parameters,
                    'called_at' => now()->toDateTimeString()
                ];

                // Si es un tool de recolección, también guardar en collected_data
                if (in_array($toolName, ['collect_payment_data', 'collect_welcome_data', 'collect_survey_data'])) {
                    $existingData = $meta['collected_data'] ?? [];
                    
                    foreach ($parameters as $field => $value) {
                        if ($value !== null && $value !== '') {
                            $existingData[$field] = [
                                'value' => $value,
                                'confidence' => 1.0,
                                'source' => 'elevenlabs_tool:' . $toolName,
                                'collected_at' => now()->toDateTimeString()
                            ];
                        }
                    }
                    
                    $meta['collected_data'] = $existingData;
                }

                $call->update(['call_metadata' => $meta]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Tool call procesado',
                'data' => [
                    'tool_name' => $toolName,
                    'fields_saved' => array_keys($parameters)
                ]
            ]);

        } catch (\Throwable $e) {
            Log::error('❌ [VOICE TOOLS] Error en tool call', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Se procesará en webhook'
            ], 200);
        }
    }

    /**
     * Consultar información del sistema (llamado por Custom Tool durante la llamada)
     */
    public function querySystem(Request $request, string $conversationId): JsonResponse
    {
        try {
            Log::info('🔍 [VOICE TOOLS] Consulta al sistema recibida', [
                'conversation_id' => $conversationId,
                'query' => $request->input('query')
            ]);

            $validator = Validator::make($request->all(), [
                'query' => 'required|string|max:500',
                'context' => 'nullable|array'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Consulta inválida',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Buscar la llamada para obtener el broker_id
            $call = VoiceCampaignCall::where('elevenlabs_conversation_id', $conversationId)
                ->orWhere('elevenlabs_call_id', $conversationId)
                ->first();

            if (!$call) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se pudo identificar la llamada'
                ], 404);
            }

            $brokerId = $call->broker_id;
            $query = $request->input('query');
            $context = $request->input('context', []);

            // Usar el servicio de consultas
            $queryService = app(\App\Services\ChatbotQueryService::class);
            $result = $queryService->processQuery($query, $brokerId, $context);

            // Guardar la consulta en metadata
            $meta = is_array($call->call_metadata) ? $call->call_metadata : [];
            if (!isset($meta['queries'])) {
                $meta['queries'] = [];
            }
            $meta['queries'][] = [
                'query' => $query,
                'result' => $result,
                'timestamp' => now()->toDateTimeString()
            ];
            $call->update(['call_metadata' => $meta]);

            Log::info('✅ [VOICE TOOLS] Consulta procesada', [
                'conversation_id' => $conversationId,
                'query_type' => $result['query_type'] ?? 'unknown'
            ]);

            return response()->json([
                'success' => true,
                'data' => $result['data'] ?? [],
                'response' => $result['formatted_response'] ?? 'Información procesada'
            ]);

        } catch (\Throwable $e) {
            Log::error('❌ [VOICE TOOLS] Error en consulta al sistema', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'No pude procesar tu consulta en este momento',
                'error' => config('app.debug') ? $e->getMessage() : null
            ], 200);
        }
    }

    /**
     * Consultar pólizas específicamente (llamado por Custom Tool durante la llamada)
     */
    public function queryPolicies(Request $request, string $conversationId): JsonResponse
    {
        try {
            Log::info('🔍 [VOICE TOOLS] Consulta de pólizas recibida', [
                'conversation_id' => $conversationId,
                'filters' => $request->all()
            ]);

            $call = VoiceCampaignCall::where('elevenlabs_conversation_id', $conversationId)
                ->orWhere('elevenlabs_call_id', $conversationId)
                ->first();

            if (!$call) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se pudo identificar la llamada'
                ], 404);
            }

            $brokerId = $call->broker_id;
            $ramo = $request->input('ramo');
            $diasVencimiento = $request->input('dias_vencimiento', 30);

            // Construir consulta
            $query = "cuántas pólizas";
            if ($ramo) {
                $query .= " de " . $ramo;
            }
            if ($request->has('proximas_vencer') && $request->input('proximas_vencer')) {
                $query .= " próximas a vencer en " . $diasVencimiento . " días";
            }

            $queryService = app(\App\Services\ChatbotQueryService::class);
            $result = $queryService->processQuery($query, $brokerId, $request->all());

            return response()->json([
                'success' => true,
                'data' => $result['data'] ?? [],
                'response' => $result['formatted_response'] ?? 'Información de pólizas procesada'
            ]);

        } catch (\Throwable $e) {
            Log::error('❌ [VOICE TOOLS] Error consultando pólizas', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'No pude consultar las pólizas en este momento'
            ], 200);
        }
    }

    /**
     * Consultar clientes específicamente (llamado por Custom Tool durante la llamada)
     */
    public function queryClients(Request $request, string $conversationId): JsonResponse
    {
        try {
            Log::info('🔍 [VOICE TOOLS] Consulta de clientes recibida', [
                'conversation_id' => $conversationId,
                'data' => $request->all()
            ]);

            $call = VoiceCampaignCall::where('elevenlabs_conversation_id', $conversationId)
                ->orWhere('elevenlabs_call_id', $conversationId)
                ->first();

            if (!$call) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se pudo identificar la llamada'
                ], 404);
            }

            $brokerId = $call->broker_id;
            $clienteId = $request->input('cliente_id');

            $query = $clienteId ? "pólizas del cliente" : "cuántos clientes tengo";
            $context = $clienteId ? ['cliente_id' => $clienteId] : [];

            $queryService = app(\App\Services\ChatbotQueryService::class);
            $result = $queryService->processQuery($query, $brokerId, $context);

            return response()->json([
                'success' => true,
                'data' => $result['data'] ?? [],
                'response' => $result['formatted_response'] ?? 'Información de clientes procesada'
            ]);

        } catch (\Throwable $e) {
            Log::error('❌ [VOICE TOOLS] Error consultando clientes', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'No pude consultar los clientes en este momento'
            ], 200);
        }
    }
}