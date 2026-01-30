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

            // Buscar o crear la conversación
            $conversation = WhatsAppConversation::where('whatsapp_instance_id', $instance->id)
                ->where('phone', $phone)
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

            Log::info('📥 [META WEBHOOK] Payload recibido', [
                'payload' => $payload
            ]);

            // Verificar que sea un evento de WhatsApp
            if (!isset($payload['entry'])) {
                return response()->json(['status' => 'ignored', 'reason' => 'no entry']);
            }

            foreach ($payload['entry'] as $entry) {
                if (!isset($entry['changes'])) continue;

                foreach ($entry['changes'] as $change) {
                    if ($change['field'] !== 'messages') continue;

                    $value = $change['value'];
                    $phoneNumberId = $value['metadata']['phone_number_id'] ?? null;

                    if (!$phoneNumberId) {
                        Log::warning('⚠️ [META WEBHOOK] No phone_number_id en payload');
                        continue;
                    }

                    // Buscar la instancia por phone_number_id
                    $instance = WhatsAppInstance::where('cloud_api_phone_id', $phoneNumberId)->first();

                    if (!$instance) {
                        Log::warning('⚠️ [META WEBHOOK] Instancia no encontrada', [
                            'phone_number_id' => $phoneNumberId
                        ]);
                        continue;
                    }

                    // Procesar mensajes entrantes
                    if (isset($value['messages'])) {
                        foreach ($value['messages'] as $message) {
                            $this->processMetaIncomingMessage($instance, $message, $value['contacts'] ?? []);
                        }
                    }

                    // Procesar actualizaciones de estado
                    if (isset($value['statuses'])) {
                        foreach ($value['statuses'] as $status) {
                            $this->processMetaStatusUpdate($instance, $status);
                        }
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
                    $mediaUrl = $mediaId ? $cloudApiService->downloadMedia($instance, $mediaId, $mimeType) : null;
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
                    $mediaUrl = $mediaId ? $cloudApiService->downloadMedia($instance, $mediaId, $mimeType) : null;
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
                    $mediaUrl = $mediaId ? $cloudApiService->downloadMedia($instance, $mediaId, $mimeType) : null;
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
                    $mediaUrl = $mediaId ? $cloudApiService->downloadMedia($instance, $mediaId, $mimeType) : null;
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

            // Buscar o crear conversación
            $conversation = WhatsAppConversation::firstOrCreate(
                [
                    'whatsapp_instance_id' => $instance->id,
                    'phone' => $phone
                ],
                [
                    'broker_id' => $instance->broker_id,
                    'contact_name' => $contactName,
                    'status' => 'pending',
                    'last_message_at' => now()
                ]
            );

            // Actualizar nombre si viene
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
                'recipient' => $recipientId
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
}