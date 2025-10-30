<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use App\Models\EmailCampaign;
use App\Models\EmailCampaignRecipient;

class SendgridWebhookController extends Controller
{
    public function handle(Request $request): JsonResponse
    {
        try {
            // Seguridad opcional: Bearer token configurable
            $expected = (string) env('SENDGRID_WEBHOOK_TOKEN', '');
            $auth = (string) $request->header('Authorization', '');
            if ($expected) {
                if (stripos($auth, 'Bearer ') !== 0 || trim(substr($auth, 7)) !== $expected) {
                    return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
                }
            }

            $payload = $request->json()->all();

            // SendGrid envía un array de eventos; tolerar objeto único
            if (isset($payload['event'])) {
                $events = [$payload];
            } elseif (isset($payload[0]) || is_array($payload)) {
                $events = $payload;
            } else {
                return response()->json(['success' => false, 'message' => 'Invalid payload'], 422);
            }

            $processed = 0;

            foreach ($events as $evt) {
                if (!is_array($evt)) {
                    continue;
                }

                $eventType = strtolower((string) ($evt['event'] ?? ''));
                $email = strtolower(trim((string) ($evt['email'] ?? '')));
                // sg_message_id (y algunas instalaciones usan 'sg_message_id:' con dos puntos)
                $sgMessageId = (string) ($evt['sg_message_id'] ?? ($evt['sg_message_id:'] ?? ''));
                $timestamp = isset($evt['timestamp']) ? (int) $evt['timestamp'] : null;
                // Datos personalizados enviados en el correo
                $customArgs = $evt['custom_args'] ?? ($evt['unique_args'] ?? []);

                // SendGrid puede enviar custom_args como strings, convertir a int
                $campaignId = isset($customArgs['campaign_id']) ? (int) $customArgs['campaign_id'] : 0;
                $recipientId = isset($customArgs['recipient_id']) ? (int) $customArgs['recipient_id'] : 0;
                
                // Log para debugging
                \Log::info('SendGrid webhook event received', [
                    'event' => $eventType,
                    'email' => $email,
                    'campaign_id' => $campaignId,
                    'recipient_id' => $recipientId,
                    'sg_message_id' => $sgMessageId,
                ]);

                $mapped = $this->mapStatus($eventType);
                if (!$mapped) {
                    continue;
                }

                // Resolver campaña opcionalmente (para refrescar métricas)
                $campaign = null;
                if ($campaignId > 0) {
                    $campaign = EmailCampaign::find($campaignId);
                }

                // Resolver destinatario por prioridad: id > sg_message_id > email
                $recipientQuery = EmailCampaignRecipient::query();
                if ($campaign) {
                    $recipientQuery->where('campaign_id', $campaign->id);
                }
                if ($recipientId > 0) {
                    $recipientQuery->where('id', $recipientId);
                } elseif ($sgMessageId) {
                    $recipientQuery->where('provider_message_id', $sgMessageId);
                } elseif ($email) {
                    $recipientQuery->where('email', $email);
                }

                $recipient = $recipientQuery->first();
                if (!$recipient) {
                    Log::warning('SendgridWebhook: recipient not found', [
                        'email' => $email,
                        'sg_message_id' => $sgMessageId,
                        'campaign_id' => $campaignId,
                        'recipient_id' => $recipientId,
                        'event' => $eventType
                    ]);
                    continue;
                }

                $now = now();
                $update = ['status' => $recipient->status];

                // Progresión de estados
                $order = [
                    'pending'   => 0,
                    'sent'      => 1,
                    'delivered' => 2,
                    'opened'    => 3,
                    'clicked'   => 4,
                    'failed'    => 10,
                ];
                $currentRank = $order[$recipient->status] ?? 0;
                $incomingRank = $order[$mapped] ?? 0;
                $finalStatus = $recipient->status;

                if ($mapped === 'failed') {
                    if ($currentRank < ($order['delivered'] ?? 2)) {
                        $finalStatus = 'failed';
                    }
                } else {
                    if ($incomingRank >= $currentRank) {
                        $finalStatus = $mapped;
                    }
                }

                $update['status'] = $finalStatus;
                if ($sgMessageId && !$recipient->provider_message_id) {
                    $update['provider_message_id'] = $sgMessageId;
                }

                $ts = $timestamp ? date('Y-m-d H:i:s', $timestamp) : $now;

                if ($finalStatus === 'sent') {
                    $update['sent_at'] = $recipient->sent_at ?: $ts;
                }
                if (in_array($finalStatus, ['delivered', 'opened', 'clicked'])) {
                    $update['sent_at'] = $recipient->sent_at ?: $ts;
                }
                if ($finalStatus === 'delivered') {
                    $update['delivered_at'] = $recipient->delivered_at ?: $ts;
                }
                if ($finalStatus === 'opened') {
                    $update['opened_at'] = $recipient->opened_at ?: $ts;
                    if (!$recipient->delivered_at) {
                        $update['delivered_at'] = $ts;
                    }
                }
                if ($finalStatus === 'clicked') {
                    $update['clicked_at'] = $recipient->clicked_at ?: $ts;
                    if (!$recipient->opened_at) {
                        $update['opened_at'] = $ts;
                    }
                    if (!$recipient->delivered_at) {
                        $update['delivered_at'] = $ts;
                    }
                }
                if ($finalStatus === 'failed') {
                    $update['failed_at'] = $now;
                    if (isset($evt['reason'])) {
                        $update['last_error'] = (string) $evt['reason'];
                    }
                    if (isset($evt['smtp-id']) && !$recipient->provider_message_id) {
                        $update['provider_message_id'] = (string) $evt['smtp-id'];
                    }
                }

                $recipient->update($update);

                if ($campaign) {
                    $campaign->refreshStats();
                }

                $processed++;
            }

            return response()->json(['success' => true, 'processed' => $processed]);
        } catch (\Throwable $e) {
            Log::error('SendgridWebhookController@handle error', ['e' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error interno'], 500);
        }
    }

    private function mapStatus(string $eventType): ?string
    {
        $map = [
            'processed' => 'sent',
            'deferred'  => null,
            'delivered' => 'delivered',
            'open'      => 'opened',
            'opened'    => 'opened',
            'click'     => 'clicked',
            'clicked'   => 'clicked',
            'bounce'    => 'failed',
            'dropped'   => 'failed',
            'blocked'   => 'failed',
            'spamreport'=> 'failed',
            'unsubscribe'=> null,
            'group_unsubscribe'=> null,
            'group_resubscribe'=> null,
        ];
        return $map[$eventType] ?? null;
    }
}