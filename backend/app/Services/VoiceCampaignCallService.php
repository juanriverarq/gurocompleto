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
                'contact_data'                 => $contact, // Guardar datos del contacto para uso en disparadores
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
            $customerNameFull  = $contact['name'] ?? data_get($contact, 'custom_data.customer_name') ?? 'Cliente';
            // Usar solo primer nombre y primer apellido para que suene natural
            $customerName = $this->getShortName($customerNameFull);
            
            // Información adicional de la póliza
            $plateNumberRaw   = $contact['plate_number'] ?? data_get($contact, 'custom_data.plate_number') ?? '';
            // Limpiar placa: si es null, 'null', 'N/A', vacío o solo espacios, dejarlo vacío
            $plateNumber      = $this->getCleanPlateNumber($plateNumberRaw);
            $policyTypeRaw    = $contact['policy_type'] ?? data_get($contact, 'custom_data.policy_type') ?? '';
            // Limpiar tipo de póliza: si es 'otros' o vacío, usar descripción genérica
            $policyType       = (!empty($policyTypeRaw) && strtolower($policyTypeRaw) !== 'otros') ? $policyTypeRaw : '';
            $insuranceCompany = $contact['insurance_company'] ?? data_get($contact, 'custom_data.insurance_company') ?? '';
            $issueDateRaw     = $contact['issue_date'] ?? data_get($contact, 'custom_data.issue_date') ?? '';
            $endDateRaw       = $contact['end_date'] ?? data_get($contact, 'custom_data.end_date') ?? '';
            
            // Formatear fechas en español (ej: "15 de enero de 2026")
            $dueDate   = $this->formatDateInSpanish($dueDateRaw);
            $issueDate = $issueDateRaw ? $this->formatDateInSpanish($issueDateRaw) : '';
            $endDate   = $endDateRaw ? $this->formatDateInSpanish($endDateRaw) : '';
            
            // Fecha y hora actual en español
            $now = Carbon::now('America/Bogota');
            $currentDate = $this->formatDateInSpanish($now->format('Y-m-d'));
            $currentTime = $now->format('g:i a'); // ej: "2:30 pm"

            $dynamicVars = [
                'customer_name'     => $customerName,
                'company_name'      => $companyName,
                'policy_number'     => (string) $policyNumber,
                'debt_amount'       => is_numeric($debtAmountRaw) ? (float) $debtAmountRaw : (string) $debtAmountRaw,
                'payment_due_date'  => $dueDate,
                'plate_number'      => $plateNumber,
                'policy_type'       => $policyType,
                'insurance_company' => $insuranceCompany,
                'issue_date'        => $issueDate,
                'end_date'          => $endDate,
                'current_date'      => $currentDate,
                'current_time'      => $currentTime,
                // Aliases
                'user_name'         => $customerName,
                'client_name'       => $customerName,
                'customerName'      => $customerName,
                'companyName'       => $companyName,
                'policyNumber'      => (string) $policyNumber,
                'paymentDueDate'    => (string) $dueDate,
                'debtAmount'        => is_numeric($debtAmountRaw) ? (float) $debtAmountRaw : (string) $debtAmountRaw,
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
            
            // Detectar si es campaña de venta cruzada (cross_sell)
            $templateId = is_array($campaign->settings) ? ($campaign->settings['template_id'] ?? null) : null;
            $isCrossSell = $templateId === 'cross_sell';
            
            // Construir saludo según tipo de campaña
            if ($isCrossSell) {
                // Venta cruzada: saludo con empresa pero sin mencionar pólizas
                $firstMessage = "¡Hola {$customerName}! Soy {$agentDisplayName} de {$safeCompany}, ¿cómo estás?";
            } else {
                // Otras campañas: mencionar póliza/placa si aplica
                $policyTypeLabel = !empty($policyType) ? "tu seguro de {$policyType}" : "tu póliza";
                // Solo mencionar placa si existe, no está vacía y es válida
                $plateInfo = (!empty($plateNumber)) ? " del vehículo placa {$plateNumber}" : "";
                $firstMessage = "Hola {$customerName}, soy {$agentDisplayName} de {$safeCompany}. " .
                                    "Quería hablar contigo sobre {$policyTypeLabel}{$plateInfo}. ¿Tienes un momento?";
            }

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

            // Prompt diferente para venta cruzada vs otras campañas
            if ($isCrossSell) {
                $finalPrompt = trim("
# Personalidad  
Eres {$agentDisplayName}, asesor de {$safeCompany}. Tu estilo es amable, natural y directo. Hablas español de Colombia.

# REGLAS DE CONVERSACIÓN
- SIEMPRE espera la respuesta del cliente antes de continuar.
- Mantén respuestas cortas (máximo 2-3 oraciones).
- Usa \"cincuenta por ciento\" en lugar de \"50%\".
- NO pidas el número de teléfono, ya lo tienes.

# QUÉ ES EL PLAN VIDA DEUDOR (para que sepas responder preguntas)
Es un seguro que protege tus deudas. Si falleces o pierdes más del cincuenta por ciento de tu capacidad laboral, el seguro paga el saldo pendiente de tus créditos. Así evitas dejarle deudas a tu familia.

Coberturas:
- Vida: Si falleces, SURA paga tu deuda pendiente.
- Invalidez (opcional): Si pierdes capacidad laboral, cubre la deuda.
- Auxilio funerario (opcional): Suma adicional para gastos funerarios.

Requisitos: Tener entre 18 y 70 años.

IMPORTANTE: No profundices mucho. Si preguntan detalles, di: \"Un especialista te explicará todo por WhatsApp, sin compromiso.\"

# OBJETIVO
Ofrecer el Plan Vida Deudor y lograr que el cliente acepte que un especialista lo contacte por WhatsApp para revisar si puede ahorrar en el seguro de sus créditos.

# FLUJO DE CONVERSACIÓN

1. SALUDO Y PRESENTACIÓN:
   \"¡Hola {$customerName}! Soy {$agentDisplayName} de {$safeCompany}, ¿cómo estás?\"
   ESPERA respuesta.

2. INTRODUCIR EL TEMA (usa este enfoque):
   \"Oye, te cuento rápido. ¿Sabías que si tienes algún crédito, tarjeta o préstamo, es muy probable que ya estés pagando un seguro de vida deudor sin saberlo? Los bancos lo incluyen en las cuotas. ¿Tienes algún crédito actualmente?\"
   ESPERA respuesta.

3. SEGÚN LA RESPUESTA:

   **SI TIENE CRÉDITOS:**
   - \"Perfecto. El Plan Vida Deudor cubre tus deudas si algo te llegara a pasar, y podemos revisar si estás pagando de más. ¿Te gustaría que un especialista te contacte por WhatsApp para darte una cotización sin compromiso?\"
   - Si acepta: \"Excelente, te va a llegar un mensaje por WhatsApp. El especialista revisará tus créditos y te dirá exactamente cuánto puedes ahorrar.\"
   - Pregunta su edad: \"Solo para confirmar, ¿cuántos años tienes? El plan es para personas entre 18 y 70 años.\"
   
   **SI NO TIENE CRÉDITOS:**
   - \"Entiendo. Si en algún momento adquieres un crédito, este seguro te puede ayudar a proteger a tu familia y ahorrar. ¿Hay algo más en lo que pueda ayudarte?\"
   ESPERA respuesta y ve al CIERRE.

   **SI NO ESTÁ INTERESADO:**
   - \"Entiendo perfectamente. ¿Hay algo más en lo que pueda ayudarte?\"
   ESPERA respuesta y ve al CIERRE.

4. SI PREGUNTA DETALLES DEL PLAN:
   - \"El Plan Vida Deudor cubre el saldo de tus créditos si falleces o pierdes capacidad laboral. También puede incluir auxilio funerario. Un especialista te puede explicar todo mejor por WhatsApp, ¿te parece?\"

# CIERRE DE LA LLAMADA (MUY IMPORTANTE)

## REGLA: SIEMPRE pregunta \"¿Hay algo más en lo que pueda ayudarte?\" ANTES de despedirte.

Después de que el cliente responda (\"no\", \"nada más\", etc.), despídete:
\"Perfecto, muchas gracias por tu tiempo. ¡Que tengas un excelente día!\"

## Casos especiales:
- **No lo llamen más**: \"Entendido, disculpa la molestia. ¡Que tengas buen día!\"
- **Está ocupado**: \"Entiendo, ¿te puedo llamar en otro momento?\"

# GUARDRAILS
- No des asesoría financiera detallada.
- Solo pide la edad (18-70 años).
- Si preguntan mucho, deriva al especialista por WhatsApp.
- NUNCA termines sin despedirte cordialmente.
- ESPERA la respuesta del cliente antes de despedirte.

# FINALIZAR LA LLAMADA (MUY IMPORTANTE)
Después de despedirte cordialmente, USA la función endCall para terminar la llamada inmediatamente.
NO sigas hablando después de despedirte. Invoca endCall y la llamada terminará.

{$toolsSection}
");
            } else {
                $finalPrompt = trim("
# Personality
Eres {$agentDisplayName}, una asesora de {$safeCompany}. Tienes una personalidad amable, directa y resolutiva. Hablas español de Colombia.

# FECHA Y HORA ACTUAL (MUY IMPORTANTE)
HOY es {$currentDate} y son las {$currentTime} (hora Colombia).
Usa esta información para responder preguntas sobre fechas:
- Si preguntan \"¿qué día es hoy?\" → responde \"{$currentDate}\"
- Si dicen \"mañana\" → calcula basándote en que hoy es {$currentDate}
- Si dicen \"la próxima semana\" → calcula basándote en la fecha actual

# Environment
Estás realizando una llamada telefónica a un cliente. Mantente profesional y breve.
Datos de contexto disponibles (usa SOLO si el cliente pregunta):
- Cliente: {$customerName}
- Tipo de seguro: {$policyType}
- Placa del vehículo: {$plateNumber}
- Aseguradora: {$insuranceCompany}
- Fecha límite de pago: {$dueDate}
- Contexto de campaña: {$personalizedMsg}

# REGLAS DE PRONUNCIACIÓN (CRÍTICO)
- NUNCA menciones el número de póliza. Refiérete al \"seguro de {$policyType}\" o \"seguro de tu vehículo placa {$plateNumber}\".
- NUNCA menciones montos de dinero. Si preguntan cuánto deben, di: \"El monto exacto lo vas a ver en el enlace que te envío por WhatsApp. ¿Te lo mando?\"
- Las fechas pronúncialas en palabras naturales: \"quince de enero\" en lugar de \"15/01\".

# Tone
Mantén respuestas cortas y directas (máximo 2-3 oraciones). Evita repetir lo que ya se dijo; reformula solo si el cliente no entendió.

# Goal
Tu objetivo es que el cliente entienda claramente el motivo de la llamada (recordatorio de pago de su seguro), defina el siguiente paso (pago ahora o cuándo){$whatsappInstruccion}. Si no es inmediato, confirma fecha tentativa de pago.

Plan de conversación y orden:
1) Apertura (breve):
   - Saluda por el nombre del cliente y preséntate con el nombre del agente y la compañía.
   - INMEDIATAMENTE indica el motivo: \"Te llamo porque en nuestro sistema aparece un pago pendiente de tu seguro de {$policyType}. ¿Ya pudiste realizarlo?\"
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
- NUNCA digas números de póliza.
- NUNCA digas montos de dinero.

{$toolsSection}
");
            }

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
                        'tools' => [
                            [
                                'type' => 'endCall',
                            ],
                        ],
                    ],
                    'voice' => [
                        'provider' => '11labs',
                        'voiceId' => $voiceId,
                        'stability' => 0.7, // Mayor estabilidad para conexiones lentas
                        'similarityBoost' => 0.8,
                        'style' => 0.2, // Menos expresividad = más consistente en baja señal
                        'useSpeakerBoost' => true, // Mejora claridad
                        'optimizeStreamingLatency' => 4, // Máxima optimización de latencia (0-4)
                    ],
                    'language' => 'es',
                    'transcriber' => [
                        'provider' => 'deepgram',
                        'model' => 'nova-2',
                        'language' => 'es-419', // Español Latinoamérica
                        'endpointing' => 300, // Más tolerante a pausas (ms)
                        'smartFormat' => true,
                    ],
                    'backgroundSound' => $backgroundSound,
                    'backchannelingEnabled' => true,
                    'backgroundDenoisingEnabled' => true,
                    'maxDurationSeconds' => 600,
                    'numWordsToInterruptAssistant' => 3, // Más palabras para evitar interrupciones falsas
                    'endCallPhrases' => ['hasta pronto', 'que tengas buen día', 'que tengas un excelente día', 'adiós', 'chao', 'hasta luego', 'que estés bien', 'cuídate mucho', 'buen día'],
                    'silenceTimeoutSeconds' => 45, // Más tolerante a silencios en mala señal
                    'responseDelaySeconds' => 0.6, // Más tiempo para procesar en conexiones lentas
                    'startSpeakingPlan' => [
                        'waitSeconds' => 0.8, // Esperar más antes de hablar
                        'smartEndpointingEnabled' => true,
                        'transcriptionEndpointingPlan' => [
                            'onPunctuationSeconds' => 0.5, // Esperar después de puntuación
                            'onNoPunctuationSeconds' => 1.2, // Esperar si no hay puntuación
                            'onNumberSeconds' => 0.8, // Esperar después de números
                        ],
                    ],
                    'stopSpeakingPlan' => [
                        'numWords' => 3, // Más palabras para confirmar interrupción
                        'voiceSeconds' => 0.4, // Más tiempo de voz para confirmar
                        'backoffSeconds' => 1.0, // Tiempo de espera antes de retomar
                    ],
                    'voicemailDetection' => [
                        'provider' => 'twilio',
                        'enabled' => true,
                        'machineDetectionTimeout' => 15,
                        'voicemailDetectionTypes' => ['machine_end_beep', 'machine_end_silence', 'machine_start'],
                    ],
                    'analysisPlan' => [
                        'summaryPlan' => [
                            'enabled' => true,
                        ],
                        'successEvaluationPlan' => [
                            'enabled' => true,
                            'rubric' => 'AutomaticRubric',
                        ],
                        'structuredDataPlan' => [
                            'enabled' => false,
                        ],
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
            $rawErrorMessage = $errorBody['message'] ?? $errorBody['error'] ?? ('VAPI API Error (' . $resp->status() . ')');
            // Asegurar que errorMessage sea string
            if (is_array($rawErrorMessage)) {
                $rawErrorMessage = json_encode($rawErrorMessage);
            }
            
            // Traducir errores comunes a mensajes más descriptivos en español
            $errorMessage = $this->translateVapiError((string) $rawErrorMessage, $formattedPhone);
            
            Log::error('❌ [VAPI] Error en llamada', [
                'status' => $resp->status(),
                'error' => $errorMessage,
                'raw_error' => $rawErrorMessage,
                'body' => $errorBody,
                'phone' => $formattedPhone,
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

    /**
     * Traduce errores de VAPI a mensajes descriptivos en español
     */
    private function translateVapiError(string $rawError, string $phone): string
    {
        $rawLower = strtolower($rawError);
        
        // Detectar errores de número inválido
        if (str_contains($rawLower, 'invalid') && str_contains($rawLower, 'phone')) {
            return "Número de teléfono inválido: {$phone}";
        }
        if (str_contains($rawLower, 'invalid number') || str_contains($rawLower, 'invalid_number')) {
            return "Número de teléfono inválido: {$phone}";
        }
        if (str_contains($rawLower, 'unallocated') || str_contains($rawLower, 'not allocated')) {
            return "Número no asignado o inexistente: {$phone}";
        }
        if (str_contains($rawLower, 'invalid destination')) {
            return "Destino inválido: {$phone}";
        }
        
        // Detectar errores de formato
        if (str_contains($rawLower, 'e.164') || str_contains($rawLower, 'format')) {
            return "Formato de número incorrecto: {$phone} (debe ser +57XXXXXXXXXX)";
        }
        
        // Detectar errores de conexión
        if (str_contains($rawLower, 'timeout') || str_contains($rawLower, 'timed out')) {
            return "Tiempo de espera agotado al conectar";
        }
        if (str_contains($rawLower, 'connection') || str_contains($rawLower, 'network')) {
            return "Error de conexión de red";
        }
        
        // Detectar errores de autenticación
        if (str_contains($rawLower, 'unauthorized') || str_contains($rawLower, 'authentication')) {
            return "Error de autenticación con el servicio de llamadas";
        }
        
        // Detectar errores de cuota/límite
        if (str_contains($rawLower, 'quota') || str_contains($rawLower, 'limit') || str_contains($rawLower, 'rate')) {
            return "Límite de llamadas excedido, intente más tarde";
        }
        
        // Si no se reconoce, devolver el error original pero más legible
        if (empty($rawError) || $rawError === 'Error desconocido') {
            return "Error al iniciar llamada a {$phone}";
        }
        
        return $rawError;
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

    /**
     * Obtener nombre corto (primer nombre + primer apellido) para que suene natural
     * Ej: "JUAN CARLOS PEREZ GOMEZ" -> "Juan Pérez"
     */
    private function getShortName(string $fullName): string
    {
        if (empty($fullName) || $fullName === 'Cliente') {
            return 'Cliente';
        }

        // Limpiar y dividir el nombre
        $parts = preg_split('/\s+/', trim($fullName));
        $parts = array_filter($parts); // Eliminar vacíos
        
        if (count($parts) === 0) {
            return 'Cliente';
        }
        
        // Capitalizar correctamente (primera letra mayúscula, resto minúscula)
        $capitalize = function($word) {
            return mb_strtoupper(mb_substr($word, 0, 1)) . mb_strtolower(mb_substr($word, 1));
        };
        
        if (count($parts) === 1) {
            // Solo un nombre
            return $capitalize($parts[0]);
        }
        
        if (count($parts) === 2) {
            // Nombre y apellido
            return $capitalize($parts[0]) . ' ' . $capitalize($parts[1]);
        }
        
        // Más de 2 partes: tomar primer nombre y primer apellido (asumiendo que los apellidos están al final)
        // Patrón común: NOMBRE1 NOMBRE2 APELLIDO1 APELLIDO2
        // Tomamos el primero y el tercero (o el segundo si solo hay 3)
        $firstName = $capitalize($parts[0]);
        
        // Si hay 3 partes, el apellido es el último
        // Si hay 4+ partes, asumimos que los apellidos empiezan en la posición 2
        $lastNameIndex = count($parts) >= 4 ? 2 : count($parts) - 1;
        $lastName = $capitalize($parts[$lastNameIndex]);
        
        return "{$firstName} {$lastName}";
    }

    /**
     * Limpiar número de placa - retorna vacío si es inválido
     */
    private function getCleanPlateNumber($plateNumber): string
    {
        if (empty($plateNumber)) {
            return '';
        }
        
        if (!is_string($plateNumber)) {
            return '';
        }
        
        $cleaned = trim($plateNumber);
        
        // Valores inválidos que no deben mostrarse
        $invalidValues = ['null', 'n/a', 'na', 'undefined', '-', '', '0', 'ninguna', 'sin placa'];
        
        if (in_array(strtolower($cleaned), $invalidValues, true)) {
            return '';
        }
        
        return $cleaned;
    }
}