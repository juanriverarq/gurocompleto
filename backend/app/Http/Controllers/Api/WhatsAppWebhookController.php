<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Campaign;
use App\Models\CampaignExecution;
use App\Models\CampaignMessage;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Models\WhatsAppInstance;
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
}