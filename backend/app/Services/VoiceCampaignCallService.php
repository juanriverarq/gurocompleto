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
     * Inicia una sola llamada de campaña de voz con VAPI y registra la VoiceCampaignCall.
     *
     * Opciones soportadas:
     * - execution_id?: int (para asociar a una ejecución existente)
     * - message_template?: string (override del template de la campaña)
     * - phone_number_id?: string
     * - voice_id?: string (ElevenLabs voice ID)
     * - voice_settings?: array
     * - agent_name?: string
     * - collect_config?: array (override de post_call_tools.collect)
     * - background_sound?: string ('office', 'off')
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
            // 1) Resolver overrides y configuración base (VAPI)
            // IMPORTANTE: Siempre usar el phoneNumberId de VAPI, no el de ElevenLabs
            $phoneNumberId = env('VAPI_PHONE_NUMBER_ID');
            $voiceId       = $options['voice_id']        ?? $campaign->elevenlabs_voice_id ?? 'YPh7OporwNAJ28F5IQrm'; // Angie por defecto
            $agentName     = $options['agent_name']      ?? ($campaign->agent_name ?: 'tu asesor');
            $messageTpl    = $options['message_template'] ?? (string) $campaign->voice_message_template;
            $collectConfig = $options['collect_config']   ?? (is_array($campaign->settings) ? data_get($campaign->settings, 'post_call_tools.collect', null) : null);
            $backgroundSound = $options['background_sound'] ?? 'office'; // Sonido de oficina por defecto

            $vapiApiKey    = env('VAPI_PRIVATE_KEY');
            if (!$vapiApiKey || !$phoneNumberId) {
                throw new \RuntimeException('Missing VAPI credentials (VAPI_PRIVATE_KEY or VAPI_PHONE_NUMBER_ID)');
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
                    'elevenlabs_agent_id_used' => 'vapi_transient', // VAPI usa agentes transient
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
                'elevenlabs_agent_id'          => 'vapi_transient',
                'elevenlabs_phone_number_id'   => $phoneNumberId,
            ]);

            // 5) Preparar payload VAPI
            // Obtener nombre comercial del broker
            $broker = null;
            if ($campaign->broker_id) {
                $broker = \App\Models\Broker::find($campaign->broker_id);
            }
            $brokerCommercialName = $broker?->name ?? env('DEFAULT_COMPANY_NAME', 'GURO Seguros');
            
            // IMPORTANTE: Usar siempre el nombre del broker, no el del contacto
            // El contacto puede tener company_name de la aseguradora, no de la agencia
            $companyName = $brokerCommercialName;
            
            Log::info('🏢 [VOICE CALL] Nombre de empresa para llamada', [
                'broker_id' => $campaign->broker_id,
                'broker_name' => $broker?->name,
                'brokerCommercialName' => $brokerCommercialName,
                'companyName_final' => $companyName,
            ]);
            $policyNumber  = $contact['policy_number'] ?? data_get($contact, 'custom_data.policy_number') ?? 'N/A';
            $debtAmountRaw = $contact['debt_amount'] ?? data_get($contact, 'custom_data.debt_amount') ?? 0;
            $dueDateRaw    = $contact['payment_due_date'] ?? data_get($contact, 'custom_data.payment_due_date') ?? Carbon::now()->addDays(5)->format('Y-m-d');
            $customerName  = $contact['name'] ?? data_get($contact, 'custom_data.customer_name') ?? 'Cliente';
            
            // Formatear fecha en español (ej: "15 de enero de 2026")
            $dueDate = $this->formatDateInSpanish($dueDateRaw);

            $dynamicVars = [
                'customer_name'    => $customerName,
                'company_name'     => $companyName,
                'policy_number'    => (string) $policyNumber,
                'debt_amount'      => is_numeric($debtAmountRaw) ? (float) $debtAmountRaw : (string) $debtAmountRaw,
                'payment_due_date' => $dueDate,
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
            $safeCompany      = $companyName ?: $brokerCommercialName;
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

{$toolsSection}
");

            // Payload VAPI con agente transient (inline)
            $payload = [
                'phoneNumberId' => $phoneNumberId,
                'customer' => [
                    'number' => $formattedPhone,
                    'name' => $customerName,
                ],
                // Agente transient (inline) - no requiere crear agente previamente
                'assistant' => [
                    'name' => $agentDisplayName,
                    'firstMessage' => $firstMessage,
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
                    'endCallPhrases' => ['hasta pronto', 'que tengas buen día', 'adiós'],
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
                    'voicemailDetection' => [
                        'provider' => 'twilio',
                        'enabled' => true,
                        'machineDetectionTimeout' => 15,
                        'voicemailDetectionTypes' => ['machine_end_beep', 'machine_end_silence', 'machine_start'],
                    ],
                ],
                'metadata' => [
                    'contact_name' => $customerName,
                    'campaign_id' => $campaign->id,
                    'campaign_type' => 'voice_campaign',
                    'voice_campaign_call_id' => $call->id,
                    'broker_id' => $campaign->broker_id,
                ],
            ];

            Log::info('🔊 [VOICE CALL SERVICE] Enviando llamada con VAPI', [
                'campaign_id' => $campaign->id,
                'to' => $formattedPhone,
                'phone_number_id' => $phoneNumberId,
                'background_sound' => $backgroundSound,
            ]);

            // 6) Llamar a VAPI
            $resp = Http::withHeaders([
                'Authorization' => 'Bearer ' . $vapiApiKey,
                'Content-Type' => 'application/json',
            ])->timeout(30)->post('https://api.vapi.ai/call/phone', $payload);

            if ($resp->successful()) {
                $data = $resp->json();
                $callId = $data['id'] ?? null; // VAPI usa 'id' para el call ID

                // Marcar iniciada y guardar metadata remota
                $call->markAsInitiated($callId);
                $call->updateElevenLabsInfo($data); // Reutilizamos el método existente

                Log::info('✅ [VAPI] Llamada iniciada exitosamente', [
                    'vapi_call_id' => $callId,
                    'status' => $data['status'] ?? 'queued',
                ]);

                return [
                    'success' => true,
                    'call_id' => $callId,
                    'status' => $data['status'] ?? 'queued',
                    'response_data' => $data,
                    'error' => null,
                    'voice_campaign_call_id' => $call->id,
                ];
            }

            $errorBody = $resp->json();
            $errorMessage = $errorBody['message'] ?? $errorBody['error'] ?? ('VAPI API Error (' . $resp->status() . ')');
            
            Log::error('❌ [VAPI] Error en llamada', [
                'status' => $resp->status(),
                'error' => $errorMessage,
                'body' => $errorBody,
            ]);
            
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

    /**
     * Formatear fecha en español para pronunciación natural (sin año)
     * Ej: "2026-01-15" -> "15 de enero"
     */
    private function formatDateInSpanish($date): string
    {
        try {
            if (empty($date) || $date === 'N/A') {
                return 'próximamente';
            }
            
            $carbon = $date instanceof Carbon ? $date : Carbon::parse($date);
            
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
}