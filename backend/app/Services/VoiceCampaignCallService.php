<?php

namespace App\Services;

use App\Models\VoiceCampaign;
use App\Models\VoiceCampaignCall;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class VoiceCampaignCallService
{
    /**
     * Inicia una sola llamada de campaña de voz con ElevenLabs y registra la VoiceCampaignCall.
     *
     * Opciones soportadas:
     * - execution_id?: int (para asociar a una ejecución existente)
     * - message_template?: string (override del template de la campaña)
     * - agent_id?: string
     * - phone_number_id?: string
     * - voice_id?: string
     * - voice_settings?: array
     * - agent_name?: string
     * - collect_config?: array (override de post_call_tools.collect)
     *
     * Retorna:
     *   [
     *     'success' => bool,
     *     'call_id' => string|null,
     *     'status' => string|null,
     *     'response_data' => array|null,
     *     'error' => string|null,
     *     'voice_campaign_call_id' => int|null
     *   ]
     */
    public function startSingleCall(VoiceCampaign $campaign, array $contact, array $options = []): array
    {
        try {
            // 1) Resolver overrides y configuración base
            $agentId       = $options['agent_id']        ?? $campaign->elevenlabs_agent_id ?? env('ELEVENLABS_AGENT_ID');
            $phoneNumberId = $options['phone_number_id'] ?? $campaign->elevenlabs_phone_number_id ?? env('ELEVENLABS_PHONE_NUMBER_ID');
            $voiceId       = $options['voice_id']        ?? $campaign->elevenlabs_voice_id ?? null;
            $voiceSettings = $options['voice_settings']  ?? $campaign->voice_settings ?? null;
            $agentName     = $options['agent_name']      ?? ($campaign->agent_name ?: 'tu asesor');
            $messageTpl    = $options['message_template'] ?? (string) $campaign->voice_message_template;
            $collectConfig = $options['collect_config']   ?? (is_array($campaign->settings) ? data_get($campaign->settings, 'post_call_tools.collect', null) : null);

            $elevenApiKey  = env('ELEVENLABS_API_KEY');
            if (!$elevenApiKey || !$agentId || !$phoneNumberId) {
                throw new \RuntimeException('Missing ElevenLabs credentials (API key / agent_id / phone_number_id)');
            }

            // 2) Normalizar teléfono y mensaje
            $rawPhone        = (string) ($contact['phone'] ?? $contact['celular_principal'] ?? '');
            $formattedPhone  = $this->formatPhoneNumber($rawPhone);
            $personalizedMsg = $this->processMessageVariables($messageTpl, $contact);

            // 3) Crear ejecución si no existe (para triggers que no tienen ejecución previa)
            $executionId = $options['execution_id'] ?? null;
            if (!$executionId) {
                // Crear una ejecución "trigger-based" para agrupar estas llamadas
                $execution = \App\Models\VoiceCampaignExecution::create([
                    'voice_campaign_id' => $campaign->id,
                    'broker_id' => $campaign->broker_id,
                    'execution_date' => now(),
                    'status' => \App\Models\VoiceCampaignExecution::STATUS_PENDING,
                    'started_at' => now(),
                    'targets_found' => 1,
                    'elevenlabs_agent_id_used' => $agentId,
                    'elevenlabs_phone_number_id_used' => $phoneNumberId,
                ]);
                $executionId = $execution->id;
            }

            // 4) Crear registro de llamada (PENDING)
            /** @var VoiceCampaignCall $call */
            $call = VoiceCampaignCall::create([
                'voice_campaign_id'            => $campaign->id,
                'voice_campaign_execution_id'  => $executionId,
                'broker_id'                    => $campaign->broker_id,
                'recipient_phone'              => $formattedPhone,
                'recipient_name'               => $contact['name'] ?? null,
                'voice_message_content'        => $personalizedMsg,
                'status'                       => VoiceCampaignCall::STATUS_PENDING,
                'elevenlabs_agent_id'          => $agentId,
                'elevenlabs_phone_number_id'   => $phoneNumberId,
            ]);

            // 5) Preparar payload ElevenLabs (reutiliza la misma lógica del controlador)
            $companyName   = $contact['company_name'] ?? data_get($contact, 'custom_data.company_name') ?? env('DEFAULT_COMPANY_NAME', 'GURO Seguros');
            $policyNumber  = $contact['policy_number'] ?? data_get($contact, 'custom_data.policy_number') ?? 'N/A';
            $debtAmountRaw = $contact['debt_amount'] ?? data_get($contact, 'custom_data.debt_amount') ?? 0;
            $dueDate       = $contact['payment_due_date'] ?? data_get($contact, 'custom_data.payment_due_date') ?? Carbon::now()->addDays(5)->format('Y-m-d');
            $customerName  = $contact['name'] ?? data_get($contact, 'custom_data.customer_name') ?? 'Cliente';

            $dynamicVars = [
                'customer_name'    => $customerName,
                'company_name'     => $companyName,
                'policy_number'    => (string) $policyNumber,
                'debt_amount'      => is_numeric($debtAmountRaw) ? (float) $debtAmountRaw : (string) $debtAmountRaw,
                'payment_due_date' => (string) $dueDate,
                // Aliases
                'user_name'        => $customerName,
                'client_name'      => $customerName,
                'customerName'     => $customerName,
                'companyName'      => $companyName,
                'policyNumber'     => (string) $policyNumber,
                'paymentDueDate'   => (string) $dueDate,
                'debtAmount'       => is_numeric($debtAmountRaw) ? (float) $debtAmountRaw : (string) $debtAmountRaw,
            ];

            // Instrucciones de recolección
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
                // No bloquear en caso de error
            }

            // WhatsApp habilitado?
            $whatsappEnabled = false;
            $postCallTools = is_array($campaign->settings) ? ($campaign->settings['post_call_tools'] ?? []) : [];
            $waCfg         = is_array($postCallTools) ? ($postCallTools['whatsapp'] ?? []) : null;
            if (is_array($waCfg) && ($waCfg['enabled'] ?? false)) {
                $whatsappEnabled = true;
            }

            $agentDisplayName = $agentName ?: 'tu asesor';
            $safeCompany      = $companyName ?: 'tu compañía de seguros';
            $firstMessage     = "Hola {$customerName}, soy {$agentDisplayName} de {$safeCompany}. " .
                                "Quería hablar contigo sobre tu póliza {$policyNumber}. ¿Te puedo contar los detalles?";

            $whatsappInstruccion = $whatsappEnabled
                ? " y pregunta si desea recibir el enlace de pago por WhatsApp. Si acepta, confirma el número de WhatsApp (puede ser el mismo de la llamada u otro)"
                : "";
            $whatsappCierre = $whatsappEnabled
                ? "\n   - Si el cliente aceptó recibir el enlace por WhatsApp, confirma el número"
                : "";
            $whatsappGuardrail = $whatsappEnabled
                ? "\n- Solo ofrece el envío por WhatsApp si el cliente lo acepta. Si no tiene WhatsApp, simplemente confirma la fecha de pago."
                : "\n- NO menciones WhatsApp en ningún momento. Solo confirma la fecha en que puede realizar el pago.";

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
- Contexto de campaña: {$personalizedMsg}

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
4) Cierre (recolección de datos al final):
   - Solo si corresponde y el cliente acepta continuar o finalizar, realiza la recolección de datos requerida.
   - Pide todos los datos en una sola tanda (no interrumpas el flujo con datos administrativos antes).
   - Anuncia la transición: \"Antes de finalizar, necesito confirmar unos datos cortos\".
   - Para cada dato activo, usa EXACTAMENTE el formato: \"campo: valor\"
     (ej.: \"email: usuario@dominio.com\", \"número de documento: 123456789\", \"address: Calle 10 # 20-30\").
   - Si ya obtuviste un dato durante la conversación, no lo repitas; confírmalo una única vez.{$whatsappCierre}
   - SIEMPRE despídete cordialmente antes de finalizar la llamada
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
- CRÍTICO: NUNCA termines la llamada sin una despedida cordial. Incluso si el cliente dice \"no\" o \"nada más\", DEBES responder con una despedida apropiada antes de colgar.
- La despedida es OBLIGATORIA en todas las llamadas, sin excepción.

# Tools
Usa estas instrucciones únicamente en el paso 4 (Cierre), no antes.
{$collectInstruction}
");

            $payload = [
                'agent_id' => $agentId,
                'agent_phone_number_id' => $phoneNumberId,
                'to_number' => $formattedPhone,
                'dynamic_variables' => $dynamicVars,
                'conversation_config_override' => [
                    'agent' => [
                        'prompt' => [ 'prompt' => $finalPrompt ],
                        'first_message' => $firstMessage,
                        'firstMessage' => $firstMessage,
                        'language' => 'es',
                    ],
                    'tts' => array_filter([
                        'voice_id' => $voiceId ?: null,
                    ]),
                ],
                'conversation_initiation_client_data' => [
                    'conversation_config_override' => [
                        'agent' => [
                            'prompt' => [ 'prompt' => $finalPrompt ],
                            'first_message' => $firstMessage,
                            'firstMessage' => $firstMessage,
                            'language' => 'es',
                        ],
                        'tts' => array_filter([
                            'voice_id' => $voiceId ?: null,
                        ]),
                    ],
                    'custom_variables' => [
                        'customer_name' => $customerName,
                        'phone_number'  => $contact['phone'] ?? '',
                        'email'         => $contact['email'] ?? '',
                        'company_name'  => $companyName,
                        'policy_number' => (string) $policyNumber,
                        'payment_due_date' => (string) $dueDate,
                    ],
                    'temperature' => 0.4,
                ],
                'overrides' => [
                    'agent' => [
                        'prompt' => [ 'prompt' => trim("Eres un asistente virtual profesional de una compañía de seguros.
Contexto de campaña: {$personalizedMsg}
{$collectInstruction}") ],
                        'first_message' => $firstMessage,
                        'firstMessage' => $firstMessage,
                        'language' => 'es',
                    ],
                    'tts' => array_filter([
                        'voice_id' => $voiceId ?: null,
                        'voiceId'  => $voiceId ?: null,
                    ]),
                ],
                'metadata' => [
                    'contact_name' => $customerName,
                    'campaign_type' => 'voice_campaign',
                    'dynamic_variables_sent' => array_keys($dynamicVars),
                    'collect_instruction' => !empty($collectInstruction),
                ],
            ];

            Log::info('🔊 [VOICE CALL SERVICE] Enviando llamada (single) con ElevenLabs', [
                'campaign_id' => $campaign->id,
                'to' => $formattedPhone,
                'agent_id' => $agentId,
            ]);

            // 6) Llamar a ElevenLabs
            $resp = Http::withHeaders([
                'xi-api-key'   => $elevenApiKey,
                'Content-Type' => 'application/json',
            ])->timeout(30)->post('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', $payload);

            if ($resp->successful()) {
                $data = $resp->json();
                $convId = $data['conversation_id'] ?? $data['id'] ?? null;

                // Marcar iniciada y guardar metadata remota
                $call->markAsInitiated($convId);
                $call->updateElevenLabsInfo($data);

                return [
                    'success' => true,
                    'call_id' => $convId,
                    'status' => $data['status'] ?? 'initiated',
                    'response_data' => $data,
                    'error' => null,
                    'voice_campaign_call_id' => $call->id,
                ];
            }

            $errorMessage = $resp->json('detail') ?? ('ElevenLabs API Error (' . $resp->status() . ')');
            $call->markAsFailed(VoiceCampaignCall::RESULT_API_ERROR, $errorMessage);

            return [
                'success' => false,
                'call_id' => null,
                'status' => null,
                'response_data' => $resp->json(),
                'error' => $errorMessage,
                'voice_campaign_call_id' => $call->id,
            ];
        } catch (\Throwable $e) {
            Log::error('❌ [VOICE CALL SERVICE] Error iniciando llamada', [
                'campaign_id' => $campaign->id ?? null,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'call_id' => null,
                'status' => null,
                'response_data' => null,
                'error' => 'Connection error: ' . $e->getMessage(),
                'voice_campaign_call_id' => null,
            ];
        }
    }

    // =========================
    // Helpers internos
    // =========================

    private function formatPhoneNumber(string $phone): string
    {
        $phone = preg_replace('/[^0-9+]/', '', $phone ?? '');

        if (substr($phone, 0, 1) === '+') {
            return $phone;
        }
        if (substr($phone, 0, 2) === '57' && strlen($phone) === 12) {
            return '+' . $phone;
        }
        if (strlen($phone) === 10 && substr($phone, 0, 1) === '3') {
            return '+57' . $phone;
        }
        return $phone;
    }

    private function processMessageVariables(string $messageTemplate, array $contact): string
    {
        $vars = [
            'nombre'           => $contact['name'] ?? $contact['nombre'] ?? $contact['first_name'] ?? '',
            'apellidos'        => $contact['apellidos'] ?? $contact['last_name'] ?? '',
            'customer_name'    => $contact['name'] ?? (($contact['first_name'] ?? '') . ' ' . ($contact['last_name'] ?? '')) ?: 'Cliente',
            'first_name'       => $contact['first_name'] ?? $contact['nombre'] ?? '',
            'last_name'        => $contact['last_name'] ?? $contact['apellidos'] ?? '',
            'email_principal'  => $contact['email'] ?? $contact['email_principal'] ?? '',
            'email'            => $contact['email'] ?? $contact['email_principal'] ?? '',
            'celular_principal'=> $contact['phone'] ?? $contact['celular_principal'] ?? '',
            'phone'            => $contact['phone'] ?? $contact['celular_principal'] ?? '',
            'ciudad'           => $contact['ciudad'] ?? $contact['city'] ?? '',
            'city'             => $contact['city'] ?? $contact['ciudad'] ?? '',
            'company_name'     => $contact['company_name'] ?? data_get($contact, 'custom_data.company_name') ?? '',
            'policy_number'    => $contact['policy_number'] ?? data_get($contact, 'custom_data.policy_number') ?? '',
            'payment_due_date' => $contact['payment_due_date'] ?? data_get($contact, 'custom_data.payment_due_date') ?? '',
            'debt_amount'      => (string) (data_get($contact, 'custom_data.debt_amount') ?? $contact['debt_amount'] ?? ''),
        ];

        $processed = $messageTemplate;
        foreach ($vars as $key => $value) {
            $processed = preg_replace('/\{\{\s*' . preg_quote($key, '/') . '\s*\}\}/', (string)$value, $processed);
            $processed = preg_replace('/\{\s*' . preg_quote($key, '/') . '\s*\}/', (string)$value, $processed);
        }
        return $processed;
    }
}