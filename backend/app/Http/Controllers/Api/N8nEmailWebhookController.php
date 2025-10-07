<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use App\Models\EmailCampaign;
use App\Models\EmailCampaignRecipient;
use App\Models\WebhookLog;

class N8nEmailWebhookController extends Controller
{
    public function handle(Request $request): JsonResponse
    {
        try {
            // Seguridad: Bearer debe coincidir con N8N_BEARER_TOKEN
            $auth = $request->header('Authorization', '');
            $expected = (string) env('N8N_BEARER_TOKEN', '');
            if (!$expected || stripos($auth, 'Bearer ') !== 0 || trim(substr($auth, 7)) !== $expected) {
                return response()->json(['success' => false, 'message' => 'Unauthorized'], 401);
            }

            // Log básico del webhook
            $headersMasked = collect($request->headers->all())
                ->map(function ($v, $k) {
                    $value = is_array($v) ? implode(';', $v) : (string) $v;
                    if (stripos($k, 'authorization') !== false) {
                        return '***';
                    }
                    return $value;
                });

            WebhookLog::create([
                'source' => 'n8n',
                'event_type' => $request->input('event') ?? 'email-status',
                'headers_masked' => $headersMasked,
                'payload' => $request->all(),
                'status_code' => 200,
                'processed_at' => now(),
            ]);

            $campaignId = (int) $request->input('campaign_id');
            if (!$campaignId) {
                return response()->json(['success' => false, 'message' => 'campaign_id requerido'], 422);
            }

            /** @var EmailCampaign|null $campaign */
            $campaign = EmailCampaign::find($campaignId);
            if (!$campaign) {
                return response()->json(['success' => false, 'message' => 'Campaña no encontrada'], 404);
            }

            // Resolver destinatario
            $recipientPayload = $request->input('recipient', []);
            $recipientId = (int) ($recipientPayload['id'] ?? 0);
            $emailRaw = (string) ($recipientPayload['email'] ?? '');
            $email = $emailRaw ? strtolower(trim($emailRaw)) : null;

            /** @var EmailCampaignRecipient|null $recipient */
            $recipient = null;
            if ($recipientId) {
                $recipient = EmailCampaignRecipient::where('campaign_id', $campaign->id)
                    ->where('id', $recipientId)->first();
            }
            if (!$recipient && $email) {
                $recipient = EmailCampaignRecipient::where('campaign_id', $campaign->id)
                    ->where('email', $email)->first();
            }

            if (!$recipient) {
                return response()->json(['success' => false, 'message' => 'Destinatario no encontrado'], 404);
            }

            // Normalizar estado entrante
            $incoming = strtolower((string) $request->input('status', ''));
            $mapped = $this->mapStatus($incoming);

            // Si no es válido, ignorar
            if (!$mapped) {
                return response()->json(['success' => true, 'message' => 'Estado ignorado'], 200);
            }

            // Progresión de estados (no degradar)
            $order = [
                'pending'   => 0,
                'sent'      => 1,
                'delivered' => 2,
                'opened'    => 3,
                'clicked'   => 4,
                'failed'    => 10, // failed es terminal, pero si ya hubo delivered/opened/clicked no bajar
            ];
            $current = $recipient->status ?? 'pending';
            $currentRank = $order[$current] ?? 0;
            $incomingRank = $order[$mapped] ?? 0;

            // Decidir estado final
            $finalStatus = $current;
            if ($mapped === 'failed') {
                // failed: solo si todavía no pasó a delivered/opened/clicked
                if ($currentRank < ($order['delivered'] ?? 2)) {
                    $finalStatus = 'failed';
                }
            } else {
                // estados normales: permitir progresar
                if ($incomingRank >= $currentRank) {
                    $finalStatus = $mapped;
                }
            }

            // Tiempos opcionales desde payload
            $now = now();
            $timestamps = [
                'sent'      => $request->input('timestamps.sent_at') ?: null,
                'delivered' => $request->input('timestamps.delivered_at') ?: null,
                'opened'    => $request->input('timestamps.opened_at') ?: null,
                'clicked'   => $request->input('timestamps.clicked_at') ?: null,
            ];

            // Actualizar recipient
            $update = ['status' => $finalStatus, 'updated_at' => $now];

            if ($request->filled('provider_message_id')) {
                $update['provider_message_id'] = (string) $request->input('provider_message_id');
            }

            if ($finalStatus === 'sent') {
                $update['sent_at'] = $timestamps['sent'] ? date('Y-m-d H:i:s', strtotime($timestamps['sent'])) : ($recipient->sent_at ?: $now);
            }
            if (in_array($finalStatus, ['delivered', 'opened', 'clicked'])) {
                // Garantizar cadenas temporales lógicas
                $update['sent_at'] = $recipient->sent_at ?: ($timestamps['sent'] ? date('Y-m-d H:i:s', strtotime($timestamps['sent'])) : $now);
            }
            if ($finalStatus === 'delivered') {
                $update['delivered_at'] = $timestamps['delivered'] ? date('Y-m-d H:i:s', strtotime($timestamps['delivered'])) : ($recipient->delivered_at ?: $now);
            }
            if ($finalStatus === 'opened') {
                $update['opened_at'] = $timestamps['opened'] ? date('Y-m-d H:i:s', strtotime($timestamps['opened'])) : ($recipient->opened_at ?: $now);
                // Si no estaba delivered, marcar delivered primero
                if (!$recipient->delivered_at) {
                    $update['delivered_at'] = $timestamps['delivered'] ? date('Y-m-d H:i:s', strtotime($timestamps['delivered'])) : $now;
                }
            }
            if ($finalStatus === 'clicked') {
                $update['clicked_at'] = $timestamps['clicked'] ? date('Y-m-d H:i:s', strtotime($timestamps['clicked'])) : ($recipient->clicked_at ?: $now);
                if (!$recipient->opened_at) {
                    $update['opened_at'] = $timestamps['opened'] ? date('Y-m-d H:i:s', strtotime($timestamps['opened'])) : $now;
                }
                if (!$recipient->delivered_at) {
                    $update['delivered_at'] = $timestamps['delivered'] ? date('Y-m-d H:i:s', strtotime($timestamps['delivered'])) : $now;
                }
            }
            if ($finalStatus === 'failed') {
                $update['failed_at'] = $now;
                if ($request->filled('error')) {
                    $update['last_error'] = (string) $request->input('error');
                }
            }

            $recipient->update($update);

            // Actualizar métricas agregadas de la campaña
            $campaign->refreshStats();

            return response()->json(['success' => true]);
        } catch (\Throwable $e) {
            Log::error('N8nEmailWebhookController@handle error', [
                'e' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['success' => false, 'message' => 'Error interno'], 500);
        }
    }

    private function mapStatus(string $incoming): ?string
    {
        // Normaliza estados comunes de proveedores/n8n a nuestro set
        $map = [
            'queued' => 'pending',
            'processing' => 'pending',
            'processed' => 'sent',
            'sent' => 'sent',
            'delivered' => 'delivered',
            'open' => 'opened',
            'opened' => 'opened',
            'click' => 'clicked',
            'clicked' => 'clicked',
            'failed' => 'failed',
            'bounce' => 'failed',
            'dropped' => 'failed',
            'error' => 'failed',
        ];

        return $map[$incoming] ?? null;
    }
}