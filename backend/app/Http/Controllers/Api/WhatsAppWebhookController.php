<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Campaign;
use App\Models\CampaignExecution;
use App\Models\CampaignMessage;
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
}