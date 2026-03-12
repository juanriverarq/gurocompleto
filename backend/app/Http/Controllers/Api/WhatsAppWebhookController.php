<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Campaign;
use App\Models\CampaignExecution;
use App\Models\CampaignMessage;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Models\WhatsAppInstance;
use App\Models\WhatsAppConversation;
use App\Services\ChatbotProcessorService;
use App\Services\WhatsAppBridgeService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class WhatsAppWebhookController extends Controller
{
    /**
     * Webhook para recibir actualizaciones de envíos masivos desde el microservicio
     * El microservicio llama a este endpoint cuando completa un envío bulk
     */
    public function bulkSendComplete(Request $request): JsonResponse
    {
        try {
            Log::info('📥 [WEBHOOK] Recibida notificación de envío masivo completado', [
                'payload' => $request->all()
            ]);

            $campaignId = $request->input('campaign_id');
            $executionId = $request->input('execution_id');
            $results = $request->input('results', []);
            $stats = $request->input('stats', []);

            if (!$campaignId || !$executionId) {
                return response()->json([
                    'success' => false,
                    'message' => 'campaign_id y execution_id son requeridos'
                ], 400);
            }

            // Verificar que la campaña y ejecución existan
            $campaign = Campaign::find($campaignId);
            $execution = CampaignExecution::find($executionId);

            if (!$campaign || !$execution) {
                return response()->json([
                    'success' => false,
                    'message' => 'Campaña o ejecución no encontrada'
                ], 404);
            }

            Log::info('✅ [WEBHOOK] Procesando resultados de envío', [
                'campaign_id' => $campaignId,
                'execution_id' => $executionId,
                'results_count' => count($results),
                'stats' => $stats
            ]);

            // Actualizar mensajes según results detallados
            if (!empty($results)) {
                foreach ($results as $result) {
                    $phone = $result['phone'] ?? '';
                    $success = $result['success'] ?? false;
                    $messageId = $result['messageId'] ?? null;
                    $error = $result['error'] ?? null;

                    // Normalizar teléfono
                    $candidates = [$phone];
                    if (substr($phone, 0, 1) === '+') {
                        $candidates[] = ltrim($phone, '+');
                    } else {
                        $candidates[] = '+' . $phone;
                    }

                    CampaignMessage::where('campaign_id', $campaignId)
                        ->where('campaign_execution_id', $executionId)
                        ->whereIn('recipient_phone', $candidates)
                        ->where('status', CampaignMessage::STATUS_PENDING)
                        ->update([
                            'status' => $success ? CampaignMessage::STATUS_SENT : CampaignMessage::STATUS_FAILED,
                            'sent_at' => $success ? now() : null,
                            'failed_at' => !$success ? now() : null,
                            'whatsapp_message_id' => $messageId,
                            'error_message' => $error
                        ]);
                }
            }

            // Actualizar basado en stats si vienen
            $successCount = (int)($stats['successful'] ?? 0);
            $failedCount = (int)($stats['failed'] ?? 0);

            if ($successCount > 0) {
                $updated = CampaignMessage::where('campaign_id', $campaignId)
                    ->where('campaign_execution_id', $executionId)
                    ->where('status', CampaignMessage::STATUS_PENDING)
                    ->limit($successCount)
                    ->update([
                        'status' => CampaignMessage::STATUS_SENT,
                        'sent_at' => now()
                    ]);

                Log::info('✅ [WEBHOOK] Mensajes marcados como enviados', [
                    'updated' => $updated,
                    'expected' => $successCount
                ]);
            }

            if ($failedCount > 0) {
                $updated = CampaignMessage::where('campaign_id', $campaignId)
                    ->where('campaign_execution_id', $executionId)
                    ->where('status', CampaignMessage::STATUS_PENDING)
                    ->limit($failedCount)
                    ->update([
                        'status' => CampaignMessage::STATUS_FAILED,
                        'failed_at' => now(),
                        'error_message' => 'Error reportado por microservicio'
                    ]);

                Log::info('❌ [WEBHOOK] Mensajes marcados como fallidos', [
                    'updated' => $updated,
                    'expected' => $failedCount
                ]);
            }

            // Actualizar contadores
            $this->updateCampaignCounters($campaignId, $executionId);

            // Verificar si la campaña está completa
            $pendingCount = CampaignMessage::where('campaign_id', $campaignId)
                ->where('campaign_execution_id', $executionId)
                ->where('status', CampaignMessage::STATUS_PENDING)
                ->count();

            if ($pendingCount === 0) {
                $execution->update([
                    'status' => 'completed',
                    'completed_at' => now()
                ]);

                $campaign->update([
                    'status' => 'completed'
                ]);

                Log::info('🎯 [WEBHOOK] Campaña marcada como completada', [
                    'campaign_id' => $campaignId,
                    'execution_id' => $executionId
                ]);
            }

            // 💰 Cobro por WhatsApp enviado (idempotente por ejecución)
            try {
                $successCount = (int)($stats['successful'] ?? 0);
                if ($successCount <= 0) {
                    // Fallback: contar enviados en DB para esta ejecución
                    $successCount = CampaignMessage::where('campaign_id', $campaignId)
                        ->where('campaign_execution_id', $executionId)
                        ->where('status', CampaignMessage::STATUS_SENT)
                        ->count();
                }

                if ($successCount > 0) {
                    $alreadyCharged = WalletTransaction::where('reference_type', 'whatsapp_campaign_execution')
                        ->where('reference_id', $executionId)
                        ->exists();

                    if (!$alreadyCharged) {
                        $brokerId = (int) $campaign->broker_id;
                        $wallet = Wallet::firstOrCreate(
                            ['broker_id' => $brokerId],
                            [
                                'balance_cop' => 0,
                                'balance_usd' => 0,
                                'pending_balance' => 0,
                                'total_earnings' => 0,
                                'is_active' => true
                            ]
                        );

                        $costPerWhatsApp = 50;
                        $amount = $successCount * $costPerWhatsApp;

                        $balanceBefore = (float) $wallet->balance_cop;
                        $wallet->balance_cop = $balanceBefore - $amount; // permitir balance negativo
                        $wallet->save();

                        WalletTransaction::create([
                            'wallet_id' => $wallet->id,
                            'broker_id' => $brokerId,
                            'user_id' => null,
                            'type' => 'debit',
                            'amount_cop' => $amount,
                            'amount_usd' => 0,
                            'currency' => 'COP',
                            'description' => "WhatsApp campaña: {$campaign->name} (ejecución {$executionId})",
                            'reference_type' => 'whatsapp_campaign_execution',
                            'reference_id' => $executionId,
                            'balance_cop_after' => $wallet->balance_cop,
                            'metadata' => [
                                'campaign_id' => $campaignId,
                                'execution_id' => $executionId,
                                'messages_successful' => $successCount,
                                'cost_per_whatsapp' => $costPerWhatsApp
                            ]
                        ]);

                        Log::info('💰 [WALLET] Cargo aplicado por mensajes WhatsApp de campaña', [
                            'broker_id' => $brokerId,
                            'campaign_id' => $campaignId,
                            'execution_id' => $executionId,
                            'success_count' => $successCount,
                            'amount_cop' => $amount,
                            'balance_before' => $balanceBefore,
                            'balance_after' => $wallet->balance_cop
                        ]);
                    } else {
                        Log::info('💰 [WALLET] Cobro ya aplicado previamente (idempotente)', [
                            'campaign_id' => $campaignId,
                            'execution_id' => $executionId
                        ]);
                    }
                } else {
                    Log::info('💰 [WALLET] Sin mensajes exitosos para cobrar', [
                        'campaign_id' => $campaignId,
                        'execution_id' => $executionId
                    ]);
                }
            } catch (\Throwable $e) {
                Log::warning('💰 [WALLET] Error registrando cobro de campaña WhatsApp', [
                    'campaign_id' => $campaignId,
                    'execution_id' => $executionId,
                    'error' => $e->getMessage()
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Webhook procesado exitosamente'
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [WEBHOOK] Error procesando webhook de envío masivo', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error procesando webhook',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Actualizar contadores de campaña y ejecución
     */
    private function updateCampaignCounters(int $campaignId, int $executionId): void
    {
        try {
            $sentCount = CampaignMessage::where('campaign_id', $campaignId)
                ->where('status', CampaignMessage::STATUS_SENT)
                ->count();
            
            $deliveredCount = CampaignMessage::where('campaign_id', $campaignId)
                ->where('status', CampaignMessage::STATUS_DELIVERED)
                ->count();
            
            $failedCount = CampaignMessage::where('campaign_id', $campaignId)
                ->where('status', CampaignMessage::STATUS_FAILED)
                ->count();

            Campaign::where('id', $campaignId)->update([
                'sent_count' => $sentCount,
                'delivered_count' => $deliveredCount,
                'failed_count' => $failedCount
            ]);

            $executionSentCount = CampaignMessage::where('campaign_execution_id', $executionId)
                ->where('status', CampaignMessage::STATUS_SENT)
                ->count();
                
            $executionDeliveredCount = CampaignMessage::where('campaign_execution_id', $executionId)
                ->where('status', CampaignMessage::STATUS_DELIVERED)
                ->count();
                
            $executionFailedCount = CampaignMessage::where('campaign_execution_id', $executionId)
                ->where('status', CampaignMessage::STATUS_FAILED)
                ->count();

            CampaignExecution::where('id', $executionId)->update([
                'messages_sent' => $executionSentCount,
                'messages_delivered' => $executionDeliveredCount,
                'messages_failed' => $executionFailedCount
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [WEBHOOK] Error actualizando contadores', [
                'error' => $e->getMessage(),
                'campaign_id' => $campaignId,
                'execution_id' => $executionId
            ]);
        }
    }

    /**
     * Webhook para recibir cambios de estado de instancias WhatsApp desde el microservicio
     * Permite sincronización automática cuando el QR se escanea y la instancia se conecta
     */
    public function statusChange(Request $request): JsonResponse
    {
        try {
            // Verificar secret del webhook (seguridad básica)
            $webhookSecret = $request->header('X-Webhook-Secret');
            $expectedSecret = config('services.whatsapp.webhook_secret', 'guro-whatsapp-webhook-secret');
            
            if ($webhookSecret !== $expectedSecret) {
                Log::warning('⚠️ [WEBHOOK STATUS] Secret inválido recibido', [
                    'received' => $webhookSecret ? 'presente pero incorrecto' : 'ausente'
                ]);
                // No rechazar por ahora para facilitar desarrollo, solo loguear
            }

            $instanceId = $request->input('instance_id');
            $status = $request->input('status');
            $connected = $request->input('connected', false);
            $timestamp = $request->input('timestamp');
            $phoneNumber = $request->input('phone_number');

            Log::info('📥 [WEBHOOK STATUS] Recibida notificación de cambio de estado', [
                'instance_id' => $instanceId,
                'status' => $status,
                'connected' => $connected,
                'timestamp' => $timestamp,
                'phone_number' => $phoneNumber
            ]);

            if (!$instanceId) {
                return response()->json([
                    'success' => false,
                    'message' => 'instance_id es requerido'
                ], 400);
            }

            // Buscar la instancia por instance_id
            $instance = WhatsAppInstance::where('instance_id', $instanceId)->first();

            if (!$instance) {
                Log::warning('⚠️ [WEBHOOK STATUS] Instancia no encontrada en BD', [
                    'instance_id' => $instanceId
                ]);
                
                return response()->json([
                    'success' => false,
                    'message' => 'Instancia no encontrada'
                ], 404);
            }

            // Actualizar estado de la instancia
            $oldStatus = $instance->status;
            $updateData = [
                'status' => $status,
                'last_activity_at' => now()
            ];

            // Si se conectó, limpiar QR y actualizar timestamp de conexión
            if ($status === 'connected' || $connected === true) {
                $updateData['status'] = 'connected';
                $updateData['qr_code'] = null;
                $updateData['qr_expires_at'] = null;
                $updateData['last_connected_at'] = now();
                $updateData['error_message'] = null;
                $updateData['reconnect_attempts'] = 0;
            }

            // Si viene número de teléfono, actualizarlo
            if ($phoneNumber) {
                $updateData['phone_number'] = $phoneNumber;
            }

            $instance->update($updateData);

            Log::info('✅ [WEBHOOK STATUS] Estado de instancia actualizado', [
                'instance_id' => $instanceId,
                'old_status' => $oldStatus,
                'new_status' => $updateData['status'],
                'broker_id' => $instance->broker_id
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Estado actualizado exitosamente',
                'instance_id' => $instanceId,
                'old_status' => $oldStatus,
                'new_status' => $updateData['status']
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [WEBHOOK STATUS] Error procesando webhook de estado', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error procesando webhook',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Webhook para sincronizar instancias cuando el microservicio se reinicia
     * El microservicio puede llamar este endpoint al iniciar para obtener las instancias que debe restaurar
     * 
     * IMPORTANTE: Este endpoint permite reconexión automática sin borrar datos
     */
    public function syncInstances(Request $request): JsonResponse
    {
        try {
            Log::info('🔄 [WEBHOOK SYNC] Solicitud de sincronización de instancias recibida');

            // Verificar secret del webhook (seguridad básica)
            $webhookSecret = $request->header('X-Webhook-Secret');
            $expectedSecret = config('services.whatsapp.webhook_secret', 'guro-whatsapp-webhook-secret');
            
            if ($webhookSecret !== $expectedSecret) {
                Log::warning('⚠️ [WEBHOOK SYNC] Secret inválido', [
                    'received' => $webhookSecret ? 'presente pero incorrecto' : 'ausente'
                ]);
                // Continuar de todas formas para facilitar desarrollo
            }

            // Obtener todas las instancias Baileys activas de la BD
            $instances = WhatsAppInstance::where('connection_type', 'baileys')
                ->whereIn('status', ['connected', 'connecting', 'qr_pending', 'disconnected'])
                ->get();

            $instancesData = $instances->map(function ($instance) {
                return [
                    'instanceId' => $instance->instance_id,
                    'brokerId' => $instance->broker_id,
                    'phoneNumber' => $instance->phone_number,
                    'status' => $instance->status,
                    'webhookUrl' => $instance->webhook_url ?? route('api.whatsapp.webhook'),
                    'settings' => $instance->settings ?? [],
                    'lastConnectedAt' => $instance->last_connected_at?->toISOString(),
                ];
            });

            Log::info('✅ [WEBHOOK SYNC] Enviando lista de instancias para sincronización', [
                'total_instances' => $instances->count(),
                'instance_ids' => $instancesData->pluck('instanceId')->toArray()
            ]);

            return response()->json([
                'success' => true,
                'instances' => $instancesData,
                'total' => $instances->count(),
                'timestamp' => now()->toISOString()
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [WEBHOOK SYNC] Error en sincronización', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error en sincronización',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Webhook para notificar que el microservicio ha iniciado
     * Permite al backend saber que debe re-registrar las instancias
     */
    public function microserviceStartup(Request $request): JsonResponse
    {
        try {
            Log::info('🚀 [WEBHOOK STARTUP] Microservicio WhatsApp ha iniciado', [
                'timestamp' => $request->input('timestamp'),
                'version' => $request->input('version')
            ]);

            // Obtener instancias que estaban conectadas y marcarlas como "reconnecting"
            $connectedInstances = WhatsAppInstance::where('connection_type', 'baileys')
                ->where('status', 'connected')
                ->get();

            $reconnectResults = [];
            $microserviceUrl = rtrim(env('WHATSAPP_SERVICE_URL', 'http://127.0.0.1:3000'), '/');

            foreach ($connectedInstances as $instance) {
                try {
                    // Intentar recrear la instancia en el microservicio
                    $response = \Illuminate\Support\Facades\Http::timeout(10)
                        ->post("{$microserviceUrl}/api/v1/instances", [
                            'instanceId' => $instance->instance_id,
                            'webhook' => $instance->webhook_url ?? route('api.whatsapp.webhook'),
                            'settings' => $instance->settings ?? [],
                        ]);

                    if ($response->successful()) {
                        // Marcar como "connecting" - el microservicio intentará reconectar con la sesión guardada
                        $instance->update([
                            'status' => 'connecting',
                            'last_activity_at' => now(),
                            'error_message' => null,
                        ]);

                        $reconnectResults[] = [
                            'instance_id' => $instance->instance_id,
                            'status' => 'reconnecting',
                            'success' => true
                        ];

                        Log::info('✅ [WEBHOOK STARTUP] Instancia registrada para reconexión', [
                            'instance_id' => $instance->instance_id
                        ]);
                    } else {
                        $reconnectResults[] = [
                            'instance_id' => $instance->instance_id,
                            'status' => 'failed',
                            'success' => false,
                            'error' => $response->body()
                        ];
                    }
                } catch (\Exception $e) {
                    $reconnectResults[] = [
                        'instance_id' => $instance->instance_id,
                        'status' => 'error',
                        'success' => false,
                        'error' => $e->getMessage()
                    ];
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Startup procesado',
                'instances_to_reconnect' => count($connectedInstances),
                'results' => $reconnectResults
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [WEBHOOK STARTUP] Error procesando startup', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Webhook para recibir mensajes entrantes desde el microservicio
     * Este endpoint procesa los mensajes con el ChatbotProcessor
     */
    public function incomingMessage(Request $request, ChatbotProcessorService $processor): JsonResponse
    {
        try {
            Log::info('📥 [WEBHOOK MESSAGE] Mensaje entrante recibido', [
                'payload' => $request->all()
            ]);

            $data = [
                'instanceId' => $request->input('instance_id') ?? $request->input('instanceId'),
                'phone' => $request->input('phone'),
                'message' => $request->input('message') ?? $request->input('text') ?? '',
                'messageId' => $request->input('message_id') ?? $request->input('messageId'),
                'type' => $request->input('type', 'text'),
                'pushName' => $request->input('push_name') ?? $request->input('pushName'),
                'timestamp' => $request->input('timestamp'),
                'media' => $request->input('media'),
            ];

            if (!$data['instanceId'] || !$data['phone']) {
                return response()->json([
                    'success' => false,
                    'message' => 'instance_id y phone son requeridos'
                ], 400);
            }

            // Procesar mensaje con el ChatbotProcessor
            $result = $processor->processIncomingMessage($data);

            // Emitir evento via Socket.IO para actualización en tiempo real del Inbox
            $this->emitInboxMessageEvent($data, $result);

            Log::info('✅ [WEBHOOK MESSAGE] Mensaje procesado', [
                'instance_id' => $data['instanceId'],
                'phone' => $data['phone'],
                'processed' => $result['processed'] ?? false,
                'reason' => $result['reason'] ?? null,
            ]);

            return response()->json([
                'success' => true,
                'processed' => $result['processed'] ?? false,
                'reason' => $result['reason'] ?? null,
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [WEBHOOK MESSAGE] Error procesando mensaje entrante', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error procesando mensaje',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Webhook para sincronizar mensajes enviados desde el móvil
     * Esto permite que los mensajes enviados directamente desde WhatsApp aparezcan en el Inbox
     */
    public function syncMessage(Request $request): JsonResponse
    {
        try {
            Log::info('📱 [WEBHOOK SYNC] Mensaje para sincronizar recibido', [
                'payload' => $request->all()
            ]);

            $instanceId = $request->input('instance_id') ?? $request->input('instanceId');
            $phone = $request->input('phone');
            $message = $request->input('message') ?? '';
            $messageId = $request->input('message_id') ?? $request->input('messageId');
            $messageType = $request->input('type', 'text');
            $media = $request->input('media');
            $fromMe = $request->input('from_me', true);
            $timestamp = $request->input('timestamp');

            if (!$instanceId || !$phone) {
                return response()->json([
                    'success' => false,
                    'message' => 'instance_id y phone son requeridos'
                ], 400);
            }

            // Buscar la instancia
            $instance = WhatsAppInstance::where('instance_id', $instanceId)->first();
            if (!$instance) {
                return response()->json([
                    'success' => false,
                    'message' => 'Instancia no encontrada'
                ], 404);
            }

            // Buscar la conversación activa más reciente (priorizar activas sobre cerradas)
            $conversation = WhatsAppConversation::where('whatsapp_instance_id', $instance->id)
                ->where('phone', $phone)
                ->whereNotIn('status', ['closed'])
                ->orderByRaw("CASE WHEN status = 'in_progress' THEN 0 WHEN status = 'assigned' THEN 1 ELSE 2 END")
                ->orderBy('last_message_at', 'desc')
                ->first();

            if (!$conversation) {
                // Si no existe conversación, no sincronizar (solo sincronizamos en conversaciones existentes)
                Log::info('📱 [WEBHOOK SYNC] No hay conversación existente para este teléfono, ignorando', [
                    'phone' => $phone
                ]);
                return response()->json([
                    'success' => true,
                    'synced' => false,
                    'reason' => 'No existing conversation'
                ]);
            }

            // Verificar si el mensaje ya existe (evitar duplicados)
            $existingMessage = $conversation->messages()
                ->where('message_id', $messageId)
                ->first();

            if ($existingMessage) {
                return response()->json([
                    'success' => true,
                    'synced' => false,
                    'reason' => 'Message already exists'
                ]);
            }

            // Guardar el mensaje
            $newMessage = $conversation->addMessage([
                'message_id' => $messageId,
                'direction' => $fromMe ? 'outgoing' : 'incoming',
                'sender_type' => $fromMe ? 'agent' : 'client', // Asumimos que si es fromMe es un agente
                'message_type' => $messageType,
                'content' => $message,
                'media' => $media,
                'status' => 'sent',
                'created_at' => $timestamp ? new \DateTime($timestamp) : now(),
            ]);

            // Actualizar última actividad de la conversación
            $conversation->update([
                'last_message_at' => now(),
            ]);

            // Emitir evento via Socket.IO
            $bridge = app(WhatsAppBridgeService::class);
            $bridge->emitSocketEvent('inbox_message', [
                'conversationId' => $conversation->id,
                'message' => [
                    'id' => $newMessage->id ?? null,
                    'message_id' => $messageId,
                    'direction' => $fromMe ? 'outgoing' : 'incoming',
                    'sender_type' => $fromMe ? 'agent' : 'client',
                    'message_type' => $messageType,
                    'content' => $message,
                    'media' => $media,
                    'created_at' => now()->toIso8601String(),
                ],
                'phone' => $phone,
                'instanceId' => $instanceId,
            ]);

            Log::info('✅ [WEBHOOK SYNC] Mensaje sincronizado', [
                'conversation_id' => $conversation->id,
                'message_id' => $messageId,
                'from_me' => $fromMe,
            ]);

            return response()->json([
                'success' => true,
                'synced' => true,
                'conversation_id' => $conversation->id,
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [WEBHOOK SYNC] Error sincronizando mensaje', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error sincronizando mensaje',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Emitir evento de mensaje al microservicio para broadcasting via Socket.IO
     */
    protected function emitInboxMessageEvent(array $data, array $result): void
    {
        try {
            // Buscar la conversación asociada
            $instance = WhatsAppInstance::where('instance_id', $data['instanceId'])->first();
            if (!$instance) return;

            $conversation = WhatsAppConversation::where('whatsapp_instance_id', $instance->id)
                ->where('phone', $data['phone'])
                ->whereNotIn('status', ['closed'])
                ->orderByRaw("CASE WHEN status = 'in_progress' THEN 0 WHEN status = 'assigned' THEN 1 ELSE 2 END")
                ->orderBy('last_message_at', 'desc')
                ->first();

            if (!$conversation) return;

            // Obtener el último mensaje guardado
            $lastMessage = $conversation->messages()->latest()->first();

            if (!$lastMessage) return;

            // Emitir evento via el microservicio
            $bridge = app(WhatsAppBridgeService::class);
            $bridge->emitSocketEvent('inbox_message', [
                'conversationId' => $conversation->id,
                'message' => [
                    'id' => $lastMessage->id,
                    'message_id' => $lastMessage->message_id,
                    'direction' => $lastMessage->direction,
                    'sender_type' => $lastMessage->sender_type,
                    'message_type' => $lastMessage->message_type,
                    'content' => $lastMessage->content,
                    'media' => $lastMessage->media,
                    'created_at' => $lastMessage->created_at->toIso8601String(),
                ],
                'phone' => $data['phone'],
                'instanceId' => $data['instanceId'],
            ]);

            Log::info('📡 [WEBHOOK] Evento inbox_message emitido', [
                'conversation_id' => $conversation->id,
                'message_id' => $lastMessage->id,
            ]);

        } catch (\Exception $e) {
            Log::warning('⚠️ [WEBHOOK] Error emitiendo evento inbox_message', [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Webhook de verificación para Meta Cloud API (GET)
     * Meta llama este endpoint para verificar la URL del webhook
     */
    public function metaWebhookVerify(Request $request): \Illuminate\Http\Response
    {
        $mode = $request->query('hub_mode');
        $token = $request->query('hub_verify_token');
        $challenge = $request->query('hub_challenge');

        Log::info('🔐 [META WEBHOOK] Solicitud de verificación recibida', [
            'mode' => $mode,
            'token' => $token ? 'presente' : 'ausente',
            'challenge' => $challenge ? 'presente' : 'ausente'
        ]);

        // Buscar cualquier instancia Cloud API que tenga este verify_token
        $instance = WhatsAppInstance::where('connection_type', 'cloud_api')
            ->where('cloud_api_verify_token', $token)
            ->first();

        // También aceptar un token global configurado en .env
        $globalVerifyToken = config('services.whatsapp.cloud_api_verify_token', 'guro_webhook_verify_2024');

        if ($mode === 'subscribe' && ($instance || $token === $globalVerifyToken)) {
            Log::info('✅ [META WEBHOOK] Verificación exitosa');
            return response($challenge, 200)->header('Content-Type', 'text/plain');
        }

        Log::warning('❌ [META WEBHOOK] Verificación fallida', [
            'mode' => $mode,
            'token_match' => $instance ? 'instance_found' : ($token === $globalVerifyToken ? 'global_match' : 'no_match')
        ]);

        return response('Forbidden', 403);
    }

    /**
     * Webhook para recibir mensajes de Meta Cloud API (POST)
     * Meta envía mensajes entrantes y actualizaciones de estado aquí
     */
    public function metaWebhookReceive(Request $request): JsonResponse
    {
        try {
            $payload = $request->all();

            Log::info('📥 [META WEBHOOK] Payload recibido (raw)', [
                'raw' => $request->getContent()
            ]);

            // Verificar que sea un evento de WhatsApp
            if (!isset($payload['entry'])) {
                return response()->json(['status' => 'ignored', 'reason' => 'no entry']);
            }

            foreach ($payload['entry'] as $entry) {
                if (!isset($entry['changes'])) continue;

                foreach ($entry['changes'] as $change) {
                    $field = $change['field'] ?? '';
                    $value = $change['value'] ?? [];
                    $phoneNumberId = $value['metadata']['phone_number_id'] ?? null;

                    // ── Standard messages webhook ──
                    if ($field === 'messages') {
                        if (!$phoneNumberId) {
                            Log::warning('⚠️ [META WEBHOOK] No phone_number_id en payload');
                            continue;
                        }

                        $instance = WhatsAppInstance::where('cloud_api_phone_id', $phoneNumberId)->first();
                        if (!$instance) {
                            Log::warning('⚠️ [META WEBHOOK] Instancia no encontrada', ['phone_number_id' => $phoneNumberId]);
                            continue;
                        }

                        if (isset($value['messages'])) {
                            foreach ($value['messages'] as $message) {
                                $this->processMetaIncomingMessage($instance, $message, $value['contacts'] ?? []);
                            }
                        }
                        if (isset($value['statuses'])) {
                            foreach ($value['statuses'] as $status) {
                                $this->processMetaStatusUpdate($instance, $status);
                            }
                        }
                    }

                    // ── Coexistence: Message Echoes (messages sent from WhatsApp Business App) ──
                    elseif ($field === 'smb_message_echoes') {
                        Log::info('📱 [META COEX] smb_message_echoes recibido', ['phone_number_id' => $phoneNumberId]);
                        $instance = $phoneNumberId ? WhatsAppInstance::where('cloud_api_phone_id', $phoneNumberId)->first() : null;
                        if (!$instance) {
                            Log::warning('⚠️ [META COEX] No instance para message echo', ['phone_number_id' => $phoneNumberId]);
                            continue;
                        }
                        $echoes = $value['message_echoes'] ?? [];
                        foreach ($echoes as $echo) {
                            $this->processMetaMessageEcho($instance, $echo);
                        }
                    }

                    // ── Coexistence: App State Sync (contacts from WhatsApp Business App) ──
                    elseif ($field === 'smb_app_state_sync') {
                        Log::info('📱 [META COEX] smb_app_state_sync recibido', ['phone_number_id' => $phoneNumberId]);
                        $instance = $phoneNumberId ? WhatsAppInstance::where('cloud_api_phone_id', $phoneNumberId)->first() : null;
                        if (!$instance) {
                            Log::warning('⚠️ [META COEX] No instance para state sync', ['phone_number_id' => $phoneNumberId]);
                            continue;
                        }
                        $stateSync = $value['state_sync'] ?? [];
                        foreach ($stateSync as $syncItem) {
                            $this->processMetaStateSync($instance, $syncItem);
                        }
                    }

                    // ── Coexistence: History Sync (chat history from WhatsApp Business App) ──
                    elseif ($field === 'history') {
                        Log::info('📱 [META COEX] history webhook recibido', [
                            'phone_number_id' => $phoneNumberId,
                            'value_keys' => array_keys($value),
                        ]);

                        // Try to find instance — phone_number_id may be in value.metadata or entry.id for WABA-level
                        $instance = $phoneNumberId ? WhatsAppInstance::where('cloud_api_phone_id', $phoneNumberId)->first() : null;
                        if (!$instance) {
                            // Fallback: try to find by WABA ID (entry.id)
                            $wabaId = $entry['id'] ?? null;
                            if ($wabaId) {
                                $instance = WhatsAppInstance::where('cloud_api_business_id', $wabaId)->first();
                            }
                        }
                        if (!$instance) {
                            Log::warning('⚠️ [META COEX] No instance para history', [
                                'phone_number_id' => $phoneNumberId,
                                'waba_id' => $entry['id'] ?? null,
                            ]);
                            continue;
                        }

                        $historyItems = $value['history'] ?? [];
                        foreach ($historyItems as $historyItem) {
                            $this->processMetaHistorySync($instance, $historyItem);
                        }
                    }

                    else {
                        Log::info('📥 [META WEBHOOK] Campo no manejado', ['field' => $field]);
                    }
                }
            }

            return response()->json(['status' => 'ok']);

        } catch (\Exception $e) {
            Log::error('❌ [META WEBHOOK] Error procesando webhook', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            // Siempre responder 200 a Meta para evitar reintentos
            return response()->json(['status' => 'error', 'message' => $e->getMessage()]);
        }
    }

    /**
     * Procesar mensaje entrante de Meta Cloud API
     */
    protected function processMetaIncomingMessage(WhatsAppInstance $instance, array $message, array $contacts): void
    {
        try {
            $phone = $message['from'];
            $messageId = $message['id'];
            $timestamp = $message['timestamp'];
            $type = $message['type'];

            // Obtener nombre del contacto
            $contactName = null;
            foreach ($contacts as $contact) {
                if ($contact['wa_id'] === $phone) {
                    $contactName = $contact['profile']['name'] ?? null;
                    break;
                }
            }

            // Extraer contenido según tipo
            $content = '';
            $media = null;

            // Servicio para descargar media
            $cloudApiService = app(\App\Services\WhatsAppCloudApiService::class);

            switch ($type) {
                case 'text':
                    $content = $message['text']['body'] ?? '';
                    break;
                case 'image':
                    $content = $message['image']['caption'] ?? '[Imagen]';
                    $mediaId = $message['image']['id'] ?? null;
                    $mimeType = $message['image']['mime_type'] ?? null;
                    Log::info('📥 [MEDIA DOWNLOAD] Descargando imagen', ['mediaId' => substr($mediaId ?? '', 0, 80), 'mimeType' => $mimeType]);
                    $mediaUrl = $mediaId ? $cloudApiService->downloadMedia($instance, $mediaId, $mimeType) : null;
                    Log::info('📥 [MEDIA DOWNLOAD] Resultado imagen', ['url' => $mediaUrl]);
                    $media = [
                        'type' => 'image',
                        'id' => $mediaId,
                        'mime_type' => $mimeType,
                        'url' => $mediaUrl
                    ];
                    break;
                case 'audio':
                    $content = '[Audio]';
                    $mediaId = $message['audio']['id'] ?? null;
                    $mimeType = $message['audio']['mime_type'] ?? null;
                    Log::info('📥 [MEDIA DOWNLOAD] Descargando audio', ['mediaId' => substr($mediaId ?? '', 0, 80), 'mimeType' => $mimeType]);
                    $mediaUrl = $mediaId ? $cloudApiService->downloadMedia($instance, $mediaId, $mimeType) : null;
                    Log::info('📥 [MEDIA DOWNLOAD] Resultado audio', ['url' => $mediaUrl]);
                    $media = [
                        'type' => 'audio',
                        'id' => $mediaId,
                        'mime_type' => $mimeType,
                        'url' => $mediaUrl
                    ];
                    break;
                case 'video':
                    $content = $message['video']['caption'] ?? '[Video]';
                    $mediaId = $message['video']['id'] ?? null;
                    $mimeType = $message['video']['mime_type'] ?? null;
                    Log::info('📥 [MEDIA DOWNLOAD] Descargando video', ['mediaId' => substr($mediaId ?? '', 0, 80), 'mimeType' => $mimeType]);
                    $mediaUrl = $mediaId ? $cloudApiService->downloadMedia($instance, $mediaId, $mimeType) : null;
                    Log::info('📥 [MEDIA DOWNLOAD] Resultado video', ['url' => $mediaUrl]);
                    $media = [
                        'type' => 'video',
                        'id' => $mediaId,
                        'mime_type' => $mimeType,
                        'url' => $mediaUrl
                    ];
                    break;
                case 'document':
                    $content = $message['document']['filename'] ?? '[Documento]';
                    $mediaId = $message['document']['id'] ?? null;
                    $mimeType = $message['document']['mime_type'] ?? null;
                    Log::info('📥 [MEDIA DOWNLOAD] Descargando documento', ['mediaId' => substr($mediaId ?? '', 0, 80), 'mimeType' => $mimeType]);
                    $mediaUrl = $mediaId ? $cloudApiService->downloadMedia($instance, $mediaId, $mimeType) : null;
                    Log::info('📥 [MEDIA DOWNLOAD] Resultado documento', ['url' => $mediaUrl]);
                    $media = [
                        'type' => 'document',
                        'id' => $mediaId,
                        'mime_type' => $mimeType,
                        'filename' => $message['document']['filename'] ?? null,
                        'url' => $mediaUrl
                    ];
                    break;
                case 'location':
                    $content = '[Ubicación]';
                    $media = [
                        'type' => 'location',
                        'latitude' => $message['location']['latitude'] ?? null,
                        'longitude' => $message['location']['longitude'] ?? null
                    ];
                    break;
                case 'interactive':
                    // Respuesta a botón o lista
                    if (isset($message['interactive']['button_reply'])) {
                        $content = $message['interactive']['button_reply']['title'] ?? '';
                    } elseif (isset($message['interactive']['list_reply'])) {
                        $content = $message['interactive']['list_reply']['title'] ?? '';
                    }
                    break;
                case 'button':
                    $content = $message['button']['text'] ?? '';
                    break;
                default:
                    $content = "[{$type}]";
            }

            Log::info('📩 [META WEBHOOK] Mensaje entrante procesado', [
                'instance_id' => $instance->instance_id,
                'phone' => $phone,
                'type' => $type,
                'content_preview' => substr($content, 0, 50)
            ]);

            // Buscar o crear conversación (usar findOrCreateByPhone para excluir cerradas y priorizar activas)
            $conversation = WhatsAppConversation::findOrCreateByPhone(
                $instance->broker_id,
                $instance->id,
                $phone,
                $contactName
            );

            // Actualizar contact_name si viene y no lo tiene
            if ($contactName && !$conversation->contact_name) {
                $conversation->update(['contact_name' => $contactName]);
            }

            // Verificar si el mensaje ya existe (evitar duplicados)
            $existingMessage = $conversation->messages()
                ->where('message_id', $messageId)
                ->first();

            if ($existingMessage) {
                Log::info('⚠️ [META WEBHOOK] Mensaje duplicado ignorado', [
                    'message_id' => $messageId
                ]);
                return;
            }

            // Guardar mensaje
            $newMessage = $conversation->addMessage([
                'message_id' => $messageId,
                'direction' => 'incoming',
                'sender_type' => 'client',
                'message_type' => $type,
                'content' => $content,
                'media' => $media,
                'status' => 'delivered',
                'created_at' => \Carbon\Carbon::createFromTimestamp($timestamp)
            ]);

            // Actualizar conversación
            $conversation->update([
                'last_message_at' => now(),
                'last_message_preview' => substr($content, 0, 100),
                'unread_count' => $conversation->unread_count + 1
            ]);

            // Emitir evento Socket.IO
            $bridge = app(WhatsAppBridgeService::class);
            $bridge->emitSocketEvent('inbox_message', [
                'conversationId' => $conversation->id,
                'message' => [
                    'id' => $newMessage->id ?? null,
                    'message_id' => $messageId,
                    'direction' => 'incoming',
                    'sender_type' => 'client',
                    'message_type' => $type,
                    'content' => $content,
                    'media' => $media,
                    'created_at' => now()->toIso8601String(),
                ],
                'phone' => $phone,
                'instanceId' => $instance->instance_id,
                'contactName' => $contactName
            ]);

            // Procesar con ChatbotProcessor si está configurado
            try {
                $processor = app(ChatbotProcessorService::class);
                $processor->processIncomingMessage([
                    'instanceId' => $instance->instance_id,
                    'phone' => $phone,
                    'message' => $content,
                    'messageId' => $messageId,
                    'type' => $type,
                    'pushName' => $contactName,
                    'timestamp' => $timestamp,
                    'media' => $media,
                    'isCloudApi' => true
                ]);
            } catch (\Exception $e) {
                Log::warning('⚠️ [META WEBHOOK] Error en ChatbotProcessor', [
                    'error' => $e->getMessage()
                ]);
            }

        } catch (\Exception $e) {
            Log::error('❌ [META WEBHOOK] Error procesando mensaje entrante', [
                'error' => $e->getMessage(),
                'message_id' => $message['id'] ?? 'unknown'
            ]);
        }
    }

    /**
     * Procesar actualización de estado de Meta Cloud API
     */
    protected function processMetaStatusUpdate(WhatsAppInstance $instance, array $status): void
    {
        try {
            $messageId = $status['id'];
            $statusValue = $status['status']; // sent, delivered, read, failed
            $recipientId = $status['recipient_id'];
            $timestamp = $status['timestamp'];
            $errors = $status['errors'] ?? null;

            Log::info('📊 [META WEBHOOK] Actualización de estado', [
                'instance_id' => $instance->instance_id,
                'message_id' => $messageId,
                'status' => $statusValue,
                'recipient' => $recipientId,
                'errors' => $errors,
            ]);

            // Actualizar estado del mensaje en la base de datos
            // Buscar en campaign_messages
            $campaignMessage = \App\Models\CampaignMessage::where('whatsapp_message_id', $messageId)->first();
            if ($campaignMessage) {
                $newStatus = match($statusValue) {
                    'sent' => \App\Models\CampaignMessage::STATUS_SENT,
                    'delivered' => \App\Models\CampaignMessage::STATUS_DELIVERED,
                    'read' => \App\Models\CampaignMessage::STATUS_READ,
                    'failed' => \App\Models\CampaignMessage::STATUS_FAILED,
                    default => $campaignMessage->status
                };

                $updateData = ['status' => $newStatus];
                
                if ($statusValue === 'delivered') {
                    $updateData['delivered_at'] = now();
                } elseif ($statusValue === 'read') {
                    $updateData['read_at'] = now();
                } elseif ($statusValue === 'failed' && $errors) {
                    $updateData['error_message'] = json_encode($errors);
                }

                $campaignMessage->update($updateData);
            }

            // Buscar en conversation_messages
            $conversationMessage = \App\Models\WhatsAppConversationMessage::where('message_id', $messageId)->first();
            if ($conversationMessage) {
                $conversationMessage->update(['status' => $statusValue]);
            }

        } catch (\Exception $e) {
            Log::error('❌ [META WEBHOOK] Error procesando actualización de estado', [
                'error' => $e->getMessage(),
                'status' => $status
            ]);
        }
    }

    // =========================================================================
    // META COEXISTENCE HANDLERS
    // =========================================================================

    /**
     * Process message echo from WhatsApp Business App (coexistence).
     * These are messages the user sent FROM their phone that Meta mirrors to the API.
     * We save them as outgoing messages in the inbox.
     */
    protected function processMetaMessageEcho(WhatsAppInstance $instance, array $echo): void
    {
        try {
            $from = $echo['from'] ?? null; // Business phone number
            $to = $echo['to'] ?? null;     // Customer phone number
            $messageId = $echo['id'] ?? null;
            $timestamp = $echo['timestamp'] ?? time();
            $type = $echo['type'] ?? 'text';

            if (!$to || !$messageId) {
                Log::warning('⚠️ [META COEX] Echo sin datos suficientes', ['echo' => $echo]);
                return;
            }

            // Extract content based on type
            $content = '';
            $media = null;

            switch ($type) {
                case 'text':
                    $content = $echo['text']['body'] ?? '';
                    break;
                case 'image':
                    $content = $echo['image']['caption'] ?? '[Imagen]';
                    $media = ['type' => 'image', 'id' => $echo['image']['id'] ?? null, 'mime_type' => $echo['image']['mime_type'] ?? null];
                    break;
                case 'video':
                    $content = $echo['video']['caption'] ?? '[Video]';
                    $media = ['type' => 'video', 'id' => $echo['video']['id'] ?? null, 'mime_type' => $echo['video']['mime_type'] ?? null];
                    break;
                case 'audio':
                    $content = '[Audio]';
                    $media = ['type' => 'audio', 'id' => $echo['audio']['id'] ?? null, 'mime_type' => $echo['audio']['mime_type'] ?? null];
                    break;
                case 'document':
                    $content = $echo['document']['filename'] ?? '[Documento]';
                    $media = ['type' => 'document', 'id' => $echo['document']['id'] ?? null, 'mime_type' => $echo['document']['mime_type'] ?? null, 'filename' => $echo['document']['filename'] ?? null];
                    break;
                case 'location':
                    $content = '[Ubicación]';
                    $media = ['type' => 'location', 'latitude' => $echo['location']['latitude'] ?? null, 'longitude' => $echo['location']['longitude'] ?? null];
                    break;
                default:
                    $content = "[{$type}]";
            }

            // Download media if available
            if ($media && !empty($media['id'])) {
                try {
                    $cloudApiService = app(\App\Services\WhatsAppCloudApiService::class);
                    $mediaUrl = $cloudApiService->downloadMedia($instance, $media['id'], $media['mime_type'] ?? null);
                    if ($mediaUrl) {
                        $media['url'] = $mediaUrl;
                    }
                } catch (\Exception $e) {
                    Log::warning('⚠️ [META COEX] Error descargando media de echo', ['error' => $e->getMessage()]);
                }
            }

            // Find or create conversation
            $conversation = WhatsAppConversation::findOrCreateByPhone(
                $instance->broker_id,
                $instance->id,
                $to,
                null
            );

            // Avoid duplicates
            $existing = $conversation->messages()->where('message_id', $messageId)->first();
            if ($existing) {
                Log::info('⚠️ [META COEX] Echo duplicado ignorado', ['message_id' => $messageId]);
                return;
            }

            // Save as outgoing message (sent from Business App / phone)
            $newMessage = $conversation->addMessage([
                'message_id' => $messageId,
                'direction' => 'outgoing',
                'sender_type' => 'agent',
                'message_type' => $type,
                'content' => $content,
                'media' => $media,
                'status' => 'delivered',
                'created_at' => \Carbon\Carbon::createFromTimestamp($timestamp),
            ]);

            $conversation->update([
                'last_message_at' => now(),
                'last_message_preview' => substr($content, 0, 100),
            ]);

            // Emit socket event
            try {
                $bridge = app(WhatsAppBridgeService::class);
                $bridge->emitSocketEvent('inbox_message', [
                    'conversationId' => $conversation->id,
                    'message' => [
                        'id' => $newMessage->id ?? null,
                        'message_id' => $messageId,
                        'direction' => 'outgoing',
                        'sender_type' => 'agent',
                        'message_type' => $type,
                        'content' => $content,
                        'media' => $media,
                        'created_at' => now()->toIso8601String(),
                    ],
                    'phone' => $to,
                    'instanceId' => $instance->instance_id,
                ]);
            } catch (\Exception $e) {
                // Socket emission is non-critical
            }

            Log::info('📱 [META COEX] Echo sincronizado', [
                'instance_id' => $instance->instance_id,
                'to' => $to,
                'type' => $type,
                'content_preview' => substr($content, 0, 50),
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [META COEX] Error procesando message echo', [
                'error' => $e->getMessage(),
                'echo_id' => $echo['id'] ?? 'unknown',
            ]);
        }
    }

    /**
     * Process contact state sync from WhatsApp Business App (coexistence).
     * When the user adds/edits/deletes contacts in their phone app, Meta mirrors it here.
     */
    protected function processMetaStateSync(WhatsAppInstance $instance, array $syncItem): void
    {
        try {
            $type = $syncItem['type'] ?? '';
            $action = $syncItem['action'] ?? '';

            if ($type === 'contact') {
                $contact = $syncItem['contact'] ?? [];
                $phone = $contact['phone_number'] ?? null;
                $fullName = $contact['full_name'] ?? null;
                $firstName = $contact['first_name'] ?? null;
                $name = $fullName ?: $firstName ?: null;

                if (!$phone) {
                    Log::warning('⚠️ [META COEX] State sync sin phone', ['syncItem' => $syncItem]);
                    return;
                }

                Log::info('📱 [META COEX] Contact state sync', [
                    'action' => $action,
                    'phone' => $phone,
                    'name' => $name,
                    'instance_id' => $instance->instance_id,
                ]);

                // Update contact name in existing conversations for this instance
                if ($name && in_array($action, ['add', 'update', 'edit'])) {
                    $updated = WhatsAppConversation::where('broker_id', $instance->broker_id)
                        ->where('whatsapp_instance_id', $instance->id)
                        ->where('phone', $phone)
                        ->whereNull('contact_name')
                        ->orWhere(function ($q) use ($instance, $phone) {
                            $q->where('broker_id', $instance->broker_id)
                              ->where('whatsapp_instance_id', $instance->id)
                              ->where('phone', $phone)
                              ->where('contact_name', '');
                        })
                        ->update(['contact_name' => $name]);

                    // Also update contact_push_name if it wasn't set
                    WhatsAppConversation::where('broker_id', $instance->broker_id)
                        ->where('whatsapp_instance_id', $instance->id)
                        ->where('phone', $phone)
                        ->whereNull('contact_push_name')
                        ->update(['contact_push_name' => $name]);

                    Log::info('✅ [META COEX] Nombre de contacto actualizado', [
                        'phone' => $phone,
                        'name' => $name,
                        'conversations_updated' => $updated,
                    ]);
                }
            } else {
                Log::info('📱 [META COEX] State sync tipo no manejado', ['type' => $type, 'action' => $action]);
            }
        } catch (\Exception $e) {
            Log::error('❌ [META COEX] Error procesando state sync', [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Process history sync from WhatsApp Business App (coexistence).
     * When coexistence is activated and the user shares their chat history,
     * Meta sends historical messages in threads.
     */
    protected function processMetaHistorySync(WhatsAppInstance $instance, array $historyItem): void
    {
        try {
            // Check for errors (e.g., user declined history sharing)
            if (isset($historyItem['errors'])) {
                foreach ($historyItem['errors'] as $error) {
                    Log::warning('⚠️ [META COEX] History sync error from Meta', [
                        'code' => $error['code'] ?? null,
                        'title' => $error['title'] ?? null,
                        'message' => $error['message'] ?? null,
                    ]);
                }
                return;
            }

            $metadata = $historyItem['metadata'] ?? [];
            $phase = $metadata['phase'] ?? 'unknown';
            $chunkOrder = $metadata['chunk_order'] ?? 0;
            $progress = $metadata['progress'] ?? null;

            Log::info('📱 [META COEX] History sync chunk', [
                'instance_id' => $instance->instance_id,
                'phase' => $phase,
                'chunk_order' => $chunkOrder,
                'progress' => $progress,
            ]);

            $threads = $historyItem['threads'] ?? [];
            $totalMessages = 0;

            foreach ($threads as $thread) {
                $customerPhone = $thread['id'] ?? null;
                if (!$customerPhone) continue;

                $messages = $thread['messages'] ?? [];
                if (empty($messages)) continue;

                // Find or create conversation
                $conversation = WhatsAppConversation::findOrCreateByPhone(
                    $instance->broker_id,
                    $instance->id,
                    $customerPhone,
                    null
                );

                foreach ($messages as $msg) {
                    $messageId = $msg['id'] ?? null;
                    if (!$messageId) continue;

                    // Skip if already exists
                    if ($conversation->messages()->where('message_id', $messageId)->exists()) {
                        continue;
                    }

                    $msgFrom = $msg['from'] ?? '';
                    $msgTo = $msg['to'] ?? '';
                    $msgTimestamp = $msg['timestamp'] ?? time();
                    $msgType = $msg['type'] ?? 'text';
                    $historyContext = $msg['history_context'] ?? [];

                    // Determine direction: if 'from' is the business phone, it's outgoing
                    $isFromBusiness = isset($msg['to']); // echoes have 'to' field
                    $direction = $isFromBusiness ? 'outgoing' : 'incoming';

                    // Extract content
                    $content = '';
                    $media = null;
                    switch ($msgType) {
                        case 'text':
                            $content = $msg['text']['body'] ?? '';
                            break;
                        case 'image':
                            $content = $msg['image']['caption'] ?? '[Imagen]';
                            $media = ['type' => 'image', 'id' => $msg['image']['id'] ?? null];
                            break;
                        case 'video':
                            $content = $msg['video']['caption'] ?? '[Video]';
                            $media = ['type' => 'video', 'id' => $msg['video']['id'] ?? null];
                            break;
                        case 'audio':
                            $content = '[Audio]';
                            $media = ['type' => 'audio', 'id' => $msg['audio']['id'] ?? null];
                            break;
                        case 'document':
                            $content = $msg['document']['filename'] ?? '[Documento]';
                            $media = ['type' => 'document', 'id' => $msg['document']['id'] ?? null, 'filename' => $msg['document']['filename'] ?? null];
                            break;
                        default:
                            $content = "[{$msgType}]";
                    }

                    $conversation->addMessage([
                        'message_id' => $messageId,
                        'direction' => $direction,
                        'sender_type' => $direction === 'outgoing' ? 'agent' : 'client',
                        'message_type' => $msgType,
                        'content' => $content,
                        'media' => $media,
                        'status' => $historyContext['status'] ?? 'delivered',
                        'created_at' => \Carbon\Carbon::createFromTimestamp($msgTimestamp),
                    ]);

                    $totalMessages++;
                }

                // Update conversation with latest message info
                if (!empty($messages)) {
                    $lastMsg = end($messages);
                    $lastContent = '';
                    $lastType = $lastMsg['type'] ?? 'text';
                    switch ($lastType) {
                        case 'text': $lastContent = $lastMsg['text']['body'] ?? ''; break;
                        case 'image': $lastContent = $lastMsg['image']['caption'] ?? '[Imagen]'; break;
                        case 'video': $lastContent = $lastMsg['video']['caption'] ?? '[Video]'; break;
                        case 'audio': $lastContent = '[Audio]'; break;
                        case 'document': $lastContent = $lastMsg['document']['filename'] ?? '[Documento]'; break;
                        default: $lastContent = "[{$lastType}]";
                    }
                    $conversation->update([
                        'last_message_at' => \Carbon\Carbon::createFromTimestamp($lastMsg['timestamp'] ?? time()),
                        'last_message_preview' => substr($lastContent, 0, 100),
                    ]);
                }
            }

            Log::info('✅ [META COEX] History sync procesado', [
                'instance_id' => $instance->instance_id,
                'threads' => count($threads),
                'messages_imported' => $totalMessages,
                'phase' => $phase,
                'progress' => $progress,
            ]);

        } catch (\Exception $e) {
            Log::error('❌ [META COEX] Error procesando history sync', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    // =========================================================================
    // YCLOUD WEBHOOK (Coexistencia)
    // YCloud sends events to this endpoint. We translate them to the same
    // format used by Meta Cloud API and reuse processMetaIncomingMessage /
    // processMetaStatusUpdate so the entire Guro pipeline works identically.
    // =========================================================================

    /**
     * Webhook para recibir eventos de YCloud (POST)
     * Handles: whatsapp.inbound_message.received, whatsapp.message.updated
     */
    public function ycloudWebhookReceive(Request $request): JsonResponse
    {
        try {
            $payload = $request->all();

            Log::info('📥 [YCLOUD WEBHOOK] Payload recibido', [
                'type' => $payload['type'] ?? 'unknown',
                'id' => $payload['id'] ?? 'N/A',
            ]);

            $eventType = $payload['type'] ?? '';

            // ── Inbound message ──
            if ($eventType === 'whatsapp.inbound_message.received') {
                $this->processYCloudInboundMessage($payload);
            }

            // ── Outbound message status update (sent/delivered/read/failed) ──
            elseif ($eventType === 'whatsapp.message.updated') {
                $this->processYCloudMessageUpdate($payload);
            }

            // ── Business App history sync (coexistence) ── real event name from YCloud
            elseif (in_array($eventType, ['whatsapp.smb.history', 'whatsapp.business_app.history_message.received'])) {
                $this->processYCloudInboundMessage($payload);
            }

            // ── Business App sent message echoes (coexistence) ──
            elseif (in_array($eventType, ['whatsapp.smb.message.echoes', 'whatsapp.business_app.sent_message.synced'])) {
                $this->processYCloudOutboundEcho($payload);
            }

            // ── Business App state sync ──
            elseif ($eventType === 'whatsapp.smb.app.state.sync') {
                Log::info('📱 [YCLOUD WEBHOOK] Business App state sync', [
                    'payload' => json_encode($payload),
                ]);
            }

            else {
                Log::info('📥 [YCLOUD WEBHOOK] Evento no manejado', [
                    'type' => $eventType,
                    'payload_keys' => array_keys($payload),
                ]);
            }

            return response()->json(['status' => 'ok']);

        } catch (\Exception $e) {
            Log::error('❌ [YCLOUD WEBHOOK] Error procesando webhook', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // Always respond 200 to prevent YCloud retries
            return response()->json(['status' => 'error', 'message' => $e->getMessage()]);
        }
    }

    /**
     * Process YCloud inbound message by translating to Meta format and reusing
     * the existing processMetaIncomingMessage pipeline.
     *
     * YCloud payload structure for whatsapp.inbound_message.received:
     * {
     *   "id": "evt_...",
     *   "type": "whatsapp.inbound_message.received",
     *   "whatsappInboundMessage": {
     *     "id": "ycloud_msg_id",
     *     "wamid": "wamid.HB...",  ← WhatsApp message ID
     *     "wabaId": "...",
     *     "from": "573001234567",
     *     "to": "573009876543",
     *     "customerProfile": { "name": "Juan" },
     *     "type": "text",
     *     "text": { "body": "Hola" },
     *     "image": { "id": "...", "link": "https://...", "caption": "...", "mimeType": "..." },
     *     "document": { "id": "...", "link": "https://...", "filename": "...", "mimeType": "..." },
     *     "audio": { "id": "...", "link": "https://...", "mimeType": "..." },
     *     "video": { "id": "...", "link": "https://...", "caption": "...", "mimeType": "..." },
     *     "location": { "latitude": ..., "longitude": ... },
     *     "timestamp": "2026-02-25T20:00:00Z"
     *   }
     * }
     */
    protected function processYCloudInboundMessage(array $payload): void
    {
        $msg = $payload['whatsappInboundMessage'] ?? [];
        if (empty($msg)) {
            Log::warning('⚠️ [YCLOUD WEBHOOK] No whatsappInboundMessage in payload');
            return;
        }

        $wabaId = $msg['wabaId'] ?? null;
        $from = $msg['from'] ?? null;
        $to = $msg['to'] ?? null;

        if (!$from) {
            Log::warning('⚠️ [YCLOUD WEBHOOK] No from number in message');
            return;
        }

        // Normalize: YCloud sends +573... but Meta sends 573... — strip leading +
        $from = ltrim($from, '+');
        if ($to) $to = ltrim($to, '+');

        // Find instance by WABA ID or by phone number (to field)
        $instance = null;
        if ($wabaId) {
            $instance = WhatsAppInstance::where('cloud_api_business_id', $wabaId)
                ->where('connection_type', 'ycloud')
                ->first();
        }
        if (!$instance && $to) {
            $normalizedTo = preg_replace('/[^0-9]/', '', $to);
            $instance = WhatsAppInstance::where('connection_type', 'ycloud')
                ->get()
                ->first(function ($inst) use ($normalizedTo) {
                    $instPhone = preg_replace('/[^0-9]/', '', $inst->phone_number ?? '');
                    return $instPhone === $normalizedTo || str_ends_with($instPhone, $normalizedTo) || str_ends_with($normalizedTo, $instPhone);
                });
        }

        if (!$instance) {
            Log::warning('⚠️ [YCLOUD WEBHOOK] No YCloud instance found', [
                'waba_id' => $wabaId,
                'to' => $to,
            ]);
            return;
        }

        // Translate YCloud message to Meta format
        $type = $msg['type'] ?? 'text';
        $wamid = $msg['wamid'] ?? $msg['id'] ?? ('yc_' . uniqid());
        $timestamp = isset($msg['timestamp'])
            ? (string) strtotime($msg['timestamp'])
            : (string) time();

        $metaMessage = [
            'id' => $wamid,
            'from' => $from,
            'timestamp' => $timestamp,
            'type' => $type,
        ];

        // Map content fields — YCloud uses the same structure as Meta for most types
        switch ($type) {
            case 'text':
                $metaMessage['text'] = ['body' => $msg['text']['body'] ?? ''];
                break;
            case 'image':
                $img = $msg['image'] ?? [];
                $metaMessage['image'] = [
                    'id' => $img['link'] ?? $img['id'] ?? null, // YCloud provides direct link
                    'mime_type' => $img['mimeType'] ?? $img['mime_type'] ?? null,
                    'caption' => $img['caption'] ?? null,
                ];
                break;
            case 'audio':
                $aud = $msg['audio'] ?? [];
                $metaMessage['audio'] = [
                    'id' => $aud['link'] ?? $aud['id'] ?? null,
                    'mime_type' => $aud['mimeType'] ?? $aud['mime_type'] ?? null,
                ];
                break;
            case 'video':
                $vid = $msg['video'] ?? [];
                $metaMessage['video'] = [
                    'id' => $vid['link'] ?? $vid['id'] ?? null,
                    'mime_type' => $vid['mimeType'] ?? $vid['mime_type'] ?? null,
                    'caption' => $vid['caption'] ?? null,
                ];
                break;
            case 'document':
                $doc = $msg['document'] ?? [];
                $metaMessage['document'] = [
                    'id' => $doc['link'] ?? $doc['id'] ?? null,
                    'mime_type' => $doc['mimeType'] ?? $doc['mime_type'] ?? null,
                    'filename' => $doc['filename'] ?? null,
                ];
                break;
            case 'location':
                $loc = $msg['location'] ?? [];
                $metaMessage['location'] = [
                    'latitude' => $loc['latitude'] ?? null,
                    'longitude' => $loc['longitude'] ?? null,
                ];
                break;
            case 'interactive':
                $metaMessage['interactive'] = $msg['interactive'] ?? [];
                break;
            case 'button':
                $metaMessage['button'] = $msg['button'] ?? [];
                break;
            default:
                $metaMessage['text'] = ['body' => "[{$type}]"];
                $metaMessage['type'] = 'text';
        }

        // Build contacts array (same as Meta format)
        $contacts = [];
        $profileName = $msg['customerProfile']['name'] ?? null;
        if ($profileName) {
            $contacts[] = [
                'wa_id' => $from,
                'profile' => ['name' => $profileName],
            ];
        }

        Log::info('📩 [YCLOUD WEBHOOK] Procesando mensaje entrante via pipeline Meta', [
            'instance_id' => $instance->instance_id,
            'from' => $from,
            'type' => $type,
            'wamid' => $wamid,
        ]);

        // Reuse the existing Meta processing pipeline
        $this->processMetaIncomingMessage($instance, $metaMessage, $contacts);
    }

    /**
     * Process YCloud message status update.
     *
     * YCloud payload for whatsapp.message.updated:
     * {
     *   "type": "whatsapp.message.updated",
     *   "whatsappMessage": {
     *     "id": "ycloud_msg_id",
     *     "wamid": "wamid.HB...",
     *     "status": "sent" | "delivered" | "read" | "failed",
     *     "to": "573001234567",
     *     "errorCode": "...",
     *     "timestamp": "..."
     *   }
     * }
     */
    protected function processYCloudMessageUpdate(array $payload): void
    {
        $msg = $payload['whatsappMessage'] ?? [];
        if (empty($msg)) return;

        $wamid = $msg['wamid'] ?? $msg['id'] ?? null;
        if (!$wamid) return;

        $statusValue = $msg['status'] ?? null;
        if (!$statusValue) return;

        $to = $msg['to'] ?? '';
        $timestamp = isset($msg['timestamp'])
            ? (string) strtotime($msg['timestamp'])
            : (string) time();

        // Find the YCloud instance for this message
        $wabaId = $msg['wabaId'] ?? null;
        $instance = null;
        if ($wabaId) {
            $instance = WhatsAppInstance::where('cloud_api_business_id', $wabaId)
                ->where('connection_type', 'ycloud')
                ->first();
        }
        if (!$instance) {
            // Try to find by any ycloud instance (in most setups there's just one)
            $instance = WhatsAppInstance::where('connection_type', 'ycloud')->first();
        }

        if (!$instance) {
            Log::warning('⚠️ [YCLOUD WEBHOOK] No instance for status update', ['wamid' => $wamid]);
            return;
        }

        // Build Meta-compatible status and reuse existing pipeline
        $metaStatus = [
            'id' => $wamid,
            'status' => $statusValue,
            'timestamp' => $timestamp,
            'recipient_id' => $to,
            'errors' => null,
        ];

        if ($statusValue === 'failed') {
            $metaStatus['errors'] = [
                ['code' => $msg['errorCode'] ?? 'unknown', 'title' => 'YCloud delivery failed'],
            ];
        }

        Log::info('📊 [YCLOUD WEBHOOK] Status update via pipeline Meta', [
            'wamid' => $wamid,
            'status' => $statusValue,
        ]);

        $this->processMetaStatusUpdate($instance, $metaStatus);
    }

    /**
     * Process YCloud outbound echo — messages sent from the WhatsApp Business App
     * that need to be synced into Guro's inbox as outgoing messages.
     *
     * Event types: whatsapp.smb.message.echoes, whatsapp.business_app.sent_message.synced
     */
    protected function processYCloudOutboundEcho(array $payload): void
    {
        // YCloud echoes may use whatsappMessage or whatsappInboundMessage key
        $msg = $payload['whatsappMessage'] ?? $payload['whatsappInboundMessage'] ?? [];
        if (empty($msg)) {
            Log::info('📱 [YCLOUD WEBHOOK] Echo vacío, ignorando');
            return;
        }

        $wabaId = $msg['wabaId'] ?? null;
        $to = $msg['to'] ?? $msg['from'] ?? null;
        $from = $msg['from'] ?? null;

        if (!$to) {
            Log::warning('⚠️ [YCLOUD WEBHOOK] Echo sin destinatario');
            return;
        }

        // Normalize: strip leading +
        $to = ltrim($to, '+');
        if ($from) $from = ltrim($from, '+');

        // Find YCloud instance
        $instance = null;
        if ($wabaId) {
            $instance = WhatsAppInstance::where('cloud_api_business_id', $wabaId)
                ->where('connection_type', 'ycloud')
                ->first();
        }
        if (!$instance) {
            $instance = WhatsAppInstance::where('connection_type', 'ycloud')->first();
        }
        if (!$instance) {
            Log::warning('⚠️ [YCLOUD WEBHOOK] No instance para echo outbound');
            return;
        }

        // Extract message content
        $type = $msg['type'] ?? 'text';
        $wamid = $msg['wamid'] ?? $msg['id'] ?? ('yc_echo_' . uniqid());

        $content = '';
        $media = null;

        switch ($type) {
            case 'text':
                $content = $msg['text']['body'] ?? '';
                break;
            case 'image':
                $content = $msg['image']['caption'] ?? '[Imagen]';
                $media = ['type' => 'image', 'url' => $msg['image']['link'] ?? null, 'mime_type' => $msg['image']['mimeType'] ?? null];
                break;
            case 'audio':
                $content = '[Audio]';
                $media = ['type' => 'audio', 'url' => $msg['audio']['link'] ?? null, 'mime_type' => $msg['audio']['mimeType'] ?? null];
                break;
            case 'video':
                $content = $msg['video']['caption'] ?? '[Video]';
                $media = ['type' => 'video', 'url' => $msg['video']['link'] ?? null, 'mime_type' => $msg['video']['mimeType'] ?? null];
                break;
            case 'document':
                $content = $msg['document']['filename'] ?? '[Documento]';
                $media = ['type' => 'document', 'url' => $msg['document']['link'] ?? null, 'filename' => $msg['document']['filename'] ?? null];
                break;
            case 'template':
                $content = '[Plantilla: ' . ($msg['template']['name'] ?? 'N/A') . ']';
                break;
            default:
                $content = "[{$type}]";
        }

        // Determine the recipient phone (the customer)
        $customerPhone = $to;

        // Find or create conversation
        $conversation = WhatsAppConversation::findOrCreateByPhone(
            $instance->broker_id,
            $instance->id,
            $customerPhone,
            null
        );

        // Check for duplicate
        $existing = $conversation->messages()->where('message_id', $wamid)->first();
        if ($existing) {
            return;
        }

        // Save as outgoing message (sent from Business App)
        $newMessage = $conversation->addMessage([
            'message_id' => $wamid,
            'direction' => 'outgoing',
            'sender_type' => 'agent',
            'message_type' => $type,
            'content' => $content,
            'media' => $media,
            'status' => 'sent',
            'created_at' => isset($msg['timestamp']) ? \Carbon\Carbon::parse($msg['timestamp']) : now(),
        ]);

        // Update conversation
        $conversation->update([
            'last_message_at' => now(),
            'last_message_preview' => substr($content, 0, 100),
        ]);

        // Emit socket event so the inbox UI updates in real-time
        $bridge = app(WhatsAppBridgeService::class);
        $bridge->emitSocketEvent('inbox_message', [
            'conversationId' => $conversation->id,
            'message' => [
                'id' => $newMessage->id ?? null,
                'message_id' => $wamid,
                'direction' => 'outgoing',
                'sender_type' => 'agent',
                'message_type' => $type,
                'content' => $content,
                'media' => $media,
                'created_at' => now()->toIso8601String(),
            ],
            'phone' => $customerPhone,
            'instanceId' => $instance->instance_id,
        ]);

        Log::info('📱 [YCLOUD WEBHOOK] Echo outbound sincronizado', [
            'instance_id' => $instance->instance_id,
            'to' => $customerPhone,
            'type' => $type,
            'wamid' => $wamid,
        ]);
    }
}