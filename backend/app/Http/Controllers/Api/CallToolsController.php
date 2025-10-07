<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Cache;
use App\Traits\RequiresAuth;

class CallToolsController extends Controller
{
    use RequiresAuth;

    /**
     * Enviar enlace de pago por WhatsApp durante la llamada.
     * Ejemplo básico: genera un link y lo envía vía whatsapp-service.
     */
    public function sendPaymentLink(Request $request, string $conversationId): JsonResponse
    {
        try {
            // Autenticación del usuario/broker
            $authError = $this->validateAuthOrFail($request);
            if ($authError) { return $authError; }

            $brokerId = $this->getBrokerId($request);

            $validator = Validator::make($request->all(), [
                'phone' => 'required|string',
                'amount_cop' => 'required|numeric|min:100',
                'customer_name' => 'nullable|string|max:120',
                'reference' => 'nullable|string|max:120',
                'idempotency_key' => 'nullable|string|max:120',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Datos inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            $phone = $this->formatPhoneE164($request->get('phone'));
            $amountCop = (int) $request->get('amount_cop');
            $customerName = trim($request->get('customer_name') ?: 'Cliente');
            $reference = $request->get('reference') ?: ('CONV-' . $conversationId);

            // 1) Generar enlace de pago básico (placeholder configurable)
            $basePayUrl = env('PAYMENT_BASE_URL', 'https://pay.guro.app/pay');
            $paymentUrl = $basePayUrl . '?' . http_build_query([
                'ref' => $reference,
                'amount' => $amountCop,
                'conv' => $conversationId,
                'broker' => $brokerId,
            ]);

            // 2) Construir mensaje
            $message = "Hola {$customerName}, te compartimos tu enlace de pago: {$paymentUrl} \n\n" .
                       "Si necesitas ayuda, responde a este mensaje.";

            // 3) Enviar por whatsapp-service
            $waBase = rtrim(env('WHATSAPP_SERVICE_URL', 'http://127.0.0.1:3300/api/v1'), '/');
            $payload = [
                'phone' => $phone,
                'message' => $message,
                'options' => [
                    'broker_id' => $brokerId,
                    'label' => 'payment_link',
                ]
            ];

            $waResp = Http::retry(2, 500)->post($waBase . '/messages/send', $payload);
            if (!$waResp->ok() || !($waResp->json('success'))) {
                Log::warning('📴 [CALL TOOL] Falló envío WhatsApp (ruta legacy), intentando vía instancia', [
                    'conversation_id' => $conversationId,
                    'broker_id' => $brokerId,
                    'status' => $waResp->status(),
                    'body' => $waResp->body()
                ]);

                // Fallback: usar multi-instancia
                $instancesResp = Http::retry(2, 500)->get($waBase . '/instances');
                if ($instancesResp->ok() && ($instancesResp->json('success'))) {
                    $instances = $instancesResp->json('instances') ?? [];
                    $connected = collect($instances)->firstWhere('connected', true);
                    $instanceId = $connected['instanceId'] ?? null;
                    if ($instanceId) {
                        $instResp = Http::retry(2, 500)->post($waBase . '/instances/' . $instanceId . '/send-message', [
                            'phone' => $phone,
                            'message' => $message,
                            'options' => [ 'broker_id' => $brokerId, 'label' => 'payment_link' ]
                        ]);
                        if (!$instResp->ok() || !($instResp->json('success'))) {
                            Log::error('❌ [CALL TOOL] Falló envío WhatsApp vía instancia', [
                                'instance_id' => $instanceId,
                                'status' => $instResp->status(),
                                'body' => $instResp->body()
                            ]);
                            return response()->json([
                                'success' => false,
                                'message' => 'No se pudo enviar el WhatsApp (instancia)',
                                'payment_url' => $paymentUrl,
                            ], 502);
                        }
                        $msgId = $instResp->json('messageId');
                        Log::info('✅ [CALL TOOL] Enlace de pago enviado por WhatsApp (instancia)', [
                            'conversation_id' => $conversationId,
                            'broker_id' => $brokerId,
                            'phone' => $phone,
                            'amount_cop' => $amountCop,
                            'reference' => $reference,
                            'message_id' => $msgId,
                            'instance_id' => $instanceId
                        ]);
                        return response()->json([
                            'success' => true,
                            'payment_url' => $paymentUrl,
                            'whatsapp' => [ 'sent' => true, 'message_id' => $msgId, 'instance_id' => $instanceId ]
                        ]);
                    }
                }

                return response()->json([
                    'success' => false,
                    'message' => 'No se pudo enviar el WhatsApp',
                    'payment_url' => $paymentUrl,
                ], 502);
            }

            $msgId = $waResp->json('messageId');

            Log::info('✅ [CALL TOOL] Enlace de pago enviado por WhatsApp', [
                'conversation_id' => $conversationId,
                'broker_id' => $brokerId,
                'phone' => $phone,
                'amount_cop' => $amountCop,
                'reference' => $reference,
                'message_id' => $msgId
            ]);

            return response()->json([
                'success' => true,
                'payment_url' => $paymentUrl,
                'whatsapp' => [
                    'sent' => true,
                    'message_id' => $msgId,
                ]
            ]);

        } catch (\Throwable $e) {
            Log::error('❌ [CALL TOOL] Error enviando enlace de pago', [
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Error interno'
            ], 500);
        }
    }

    private function formatPhoneE164(string $phone): string
    {
        $p = preg_replace('/[^0-9+]/', '', $phone);
        if (substr($p, 0, 1) === '+') {
            return $p;
        }
        if (substr($p, 0, 2) === '57' && strlen($p) === 12) {
            return '+' . $p;
        }
        if (strlen($p) === 10 && substr($p, 0, 1) === '3') {
            return '+57' . $p;
        }
        return $p;
    }

    /**
     * Programar el envío del enlace de pago al finalizar la llamada (webhook).
     * Guarda en call_metadata.payment_on_completion los datos requeridos.
     */
    public function schedulePaymentLink(Request $request, string $conversationId): JsonResponse
    {
        try {
            // Autenticación
            $authError = $this->validateAuthOrFail($request);
            if ($authError) { return $authError; }
            $brokerId = $this->getBrokerId($request);

            $validator = Validator::make($request->all(), [
                'phone' => 'required|string',
                'amount_cop' => 'required|numeric|min:100',
                'customer_name' => 'nullable|string|max:120',
                'reference' => 'nullable|string|max:120',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Datos inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            /** @var \App\Models\VoiceCampaignCall|null $call */
            $call = \App\Models\VoiceCampaignCall::where('elevenlabs_conversation_id', $conversationId)->first();
            $schedule = [
                'broker_id' => $brokerId,
                'phone' => $request->get('phone'),
                'amount_cop' => (int) $request->get('amount_cop'),
                'customer_name' => $request->get('customer_name') ?: ($call->recipient_name ?? 'Cliente'),
                'reference' => $request->get('reference') ?: ('CONV-' . $conversationId),
            ];

            if (!$call) {
                // Guardar en caché hasta que llegue el webhook y/o se persista la llamada
                Cache::put('call:payment_on_completion:' . $conversationId, $schedule, now()->addHours(2));
            } else {
                $meta = is_array($call->call_metadata) ? $call->call_metadata : [];
                $meta['payment_on_completion'] = $schedule;
                unset($meta['payment_link_sent_at']);
                $call->update(['call_metadata' => $meta]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Envío de enlace programado para el fin de la llamada',
                'data' => [ 'conversation_id' => $conversationId ]
            ]);
        } catch (\Throwable $e) {
            Log::error('❌ [CALL TOOL] Error programando envío de pago', [ 'error' => $e->getMessage() ]);
            return response()->json(['success' => false, 'message' => 'Error interno'], 500);
        }
    }
}


