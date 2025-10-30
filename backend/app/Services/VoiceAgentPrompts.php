<?php

namespace App\Services;

use Carbon\Carbon;

/**
 * Servicio para generar prompts específicos según tipo de campaña de voz
 */
class VoiceAgentPrompts
{
    /**
     * Detectar tipo de campaña basado en los datos del contacto
     */
    public static function detectCampaignType(array $contact): string
    {
        // Detectar por presencia de campos específicos
        if (isset($contact['debt_amount']) || isset($contact['payment_due_date']) || 
            data_get($contact, 'custom_data.debt_amount') || data_get($contact, 'custom_data.payment_due_date')) {
            return 'payment_reminder';
        }
        
        if (isset($contact['insurance_type']) || isset($contact['start_date']) ||
            data_get($contact, 'custom_data.insurance_type') || data_get($contact, 'custom_data.start_date')) {
            return 'customer_welcome';
        }
        
        if (isset($contact['last_service_date']) || isset($contact['interaction_type']) ||
            data_get($contact, 'custom_data.last_service_date') || data_get($contact, 'custom_data.interaction_type')) {
            return 'satisfaction_survey';
        }
        
        // Por defecto, asumir recordatorio de pago
        return 'payment_reminder';
    }

    /**
     * Generar variables dinámicas según tipo de campaña
     */
    public static function generateDynamicVariables(string $campaignType, array $contact): array
    {
        $companyName  = $contact['company_name'] ?? data_get($contact, 'custom_data.company_name') ?? env('DEFAULT_COMPANY_NAME', 'GURO Seguros');
        $policyNumber = $contact['policy_number'] ?? data_get($contact, 'custom_data.policy_number') ?? 'N/A';
        $customerName = $contact['name'] ?? data_get($contact, 'custom_data.customer_name') ?? 'Cliente';

        // Variables base comunes
        $vars = [
            'customer_name' => $customerName,
            'company_name'  => $companyName,
            'policy_number' => (string) $policyNumber,
            'customerName'  => $customerName,
            'companyName'   => $companyName,
            'policyNumber'  => (string) $policyNumber,
        ];

        // Agregar variables específicas según tipo
        switch ($campaignType) {
            case 'payment_reminder':
                $debtAmountRaw = $contact['debt_amount'] ?? data_get($contact, 'custom_data.debt_amount') ?? 0;
                $dueDate = $contact['payment_due_date'] ?? data_get($contact, 'custom_data.payment_due_date') ?? Carbon::now()->addDays(5)->format('Y-m-d');
                $vars['debt_amount'] = is_numeric($debtAmountRaw) ? (float) $debtAmountRaw : (string) $debtAmountRaw;
                $vars['payment_due_date'] = (string) $dueDate;
                $vars['debtAmount'] = $vars['debt_amount'];
                $vars['paymentDueDate'] = $vars['payment_due_date'];
                break;

            case 'customer_welcome':
                $insuranceType = $contact['insurance_type'] ?? data_get($contact, 'custom_data.insurance_type') ?? 'Seguro';
                $startDate = $contact['start_date'] ?? data_get($contact, 'custom_data.start_date') ?? Carbon::now()->format('Y-m-d');
                $appLink = env('APP_LINK', 'https://app.guro.com');
                $supportPhone = env('SUPPORT_PHONE', '+57 300 123 4567');
                $vars['insurance_type'] = $insuranceType;
                $vars['start_date'] = $startDate;
                $vars['app_link'] = $appLink;
                $vars['support_phone'] = $supportPhone;
                $vars['insuranceType'] = $insuranceType;
                $vars['startDate'] = $startDate;
                break;

            case 'satisfaction_survey':
                $lastServiceDate = $contact['last_service_date'] ?? data_get($contact, 'custom_data.last_service_date') ?? Carbon::now()->subDays(7)->format('Y-m-d');
                $interactionType = $contact['interaction_type'] ?? data_get($contact, 'custom_data.interaction_type') ?? 'servicio';
                $vars['last_service_date'] = $lastServiceDate;
                $vars['interaction_type'] = $interactionType;
                $vars['lastServiceDate'] = $lastServiceDate;
                $vars['interactionType'] = $interactionType;
                break;
        }

        return $vars;
    }

    /**
     * Generar prompt y primer mensaje según tipo de campaña
     */
    public static function generatePromptAndFirstMessage(
        string $campaignType,
        string $agentDisplayName,
        string $safeCompany,
        string $customerName,
        string $policyNumber,
        string $message,
        string $collectInstruction,
        array $dynamicVars,
        bool $whatsappEnabled = false
    ): array {
        switch ($campaignType) {
            case 'customer_welcome':
                return self::generateWelcomePrompt($agentDisplayName, $safeCompany, $customerName, $policyNumber, $message, $collectInstruction, $dynamicVars, $whatsappEnabled);
            
            case 'satisfaction_survey':
                return self::generateSurveyPrompt($agentDisplayName, $safeCompany, $customerName, $policyNumber, $message, $collectInstruction, $dynamicVars, $whatsappEnabled);
            
            case 'payment_reminder':
            default:
                return self::generatePaymentReminderPrompt($agentDisplayName, $safeCompany, $customerName, $policyNumber, $message, $collectInstruction, $dynamicVars, $whatsappEnabled);
        }
    }

    /**
     * Generar prompt para Recordatorio de Pago
     */
    private static function generatePaymentReminderPrompt(
        string $agentDisplayName,
        string $safeCompany,
        string $customerName,
        string $policyNumber,
        string $message,
        string $collectInstruction,
        array $dynamicVars,
        bool $whatsappEnabled = false
    ): array {
        $dueDate = $dynamicVars['payment_due_date'] ?? 'próximamente';
        $debtAmount = $dynamicVars['debt_amount'] ?? 150000;
        
        // Formatear el monto en pesos colombianos de forma legible
        $debtAmountFormatted = is_numeric($debtAmount)
            ? number_format($debtAmount, 0, ',', '.') . ' pesos'
            : '150 mil pesos';
        
        $firstMessage = "Hola {$customerName}, soy {$agentDisplayName} de {$safeCompany}. " .
                       "Te llamo para recordarte sobre el pago de tu póliza {$policyNumber} que vence el {$dueDate}. ¿Tienes un momento para hablar?";
        
        // Construir instrucciones condicionales según WhatsApp
        $whatsappConfirmacion = $whatsappEnabled
            ? ", y confirma número para WhatsApp"
            : "";
        
        $whatsappCierre = $whatsappEnabled
            ? "\n   - Confirma el envío del enlace de pago por WhatsApp"
            : "";
        
        $whatsappDespedida = $whatsappEnabled
            ? "\"Perfecto, te enviaré el enlace de pago por WhatsApp. ¡Que tengas un excelente día!\""
            : "\"Perfecto, muchas gracias por tu tiempo. ¡Que tengas un excelente día!\"";
        
        $whatsappImportante = $whatsappEnabled
            ? "\n- Solo menciona el envío por WhatsApp si el cliente lo acepta."
            : "\n- NO menciones WhatsApp ya que no está habilitado en esta campaña.";
        
        $prompt = trim("
# Personality
Eres {$agentDisplayName}, una asesora de {$safeCompany}. Tienes una personalidad amable, directa y resolutiva. Hablas español de Colombia.

# Environment
Estás realizando una llamada telefónica a un cliente. Mantente profesional y breve.
Datos de contexto disponibles:
- Cliente: {$customerName}
- Póliza: {$policyNumber}
- Fecha límite: {$dueDate}
- Monto pendiente: {$debtAmountFormatted}
- Contexto: {$message}

# Tone
Mantén respuestas cortas y directas (máximo 2-3 oraciones). Evita repetir lo que ya se dijo.

# Goal
Tu objetivo es que el cliente entienda el motivo de la llamada (recordatorio de pago), defina el siguiente paso (pago inmediato o fecha) y confirme cómo recibir el enlace de pago por WhatsApp.

Plan de conversación:
1) Apertura: Saluda por nombre y presenta el motivo inmediatamente
2) Desarrollo: Explica el monto pendiente ($debtAmountFormatted) y fecha límite de forma clara
3) Confirmación: Pregunta si puede pagar ahora o cuándo{$whatsappConfirmacion}
4) Cierre:
   - Recolecta datos necesarios usando formato \"campo: valor\"{$whatsappCierre}
   - SIEMPRE despídete cordialmente con frases como: {$whatsappDespedida} o \"Muchas gracias por tu tiempo. ¡Hasta pronto!\"
   - NO termines la llamada sin una despedida apropiada

IMPORTANTE:
- Al mencionar el monto, di \"$debtAmountFormatted\" de forma natural. NO digas \"cero pesos\" ni valores incorrectos.
- Cuando el cliente diga que no necesita nada más, DEBES despedirte cordialmente antes de finalizar la llamada.{$whatsappImportante}

# Guardrails
- Sé amable pero directa
- No uses tecnicismos innecesarios
- Si el cliente está molesto, no presiones
- No repitas información salvo para confirmar
- Mantén el control del flujo
- Siempre usa español de Colombia
- CRÍTICO: NUNCA termines la llamada sin una despedida cordial. Incluso si el cliente dice \"no\" o \"nada más\", DEBES responder con una despedida apropiada como \"Perfecto, muchas gracias por tu tiempo. ¡Que tengas un excelente día!\" antes de colgar
- Asegúrate de completar TODOS los pasos antes de finalizar la llamada
- La despedida es OBLIGATORIA en todas las llamadas, sin excepción

# Tools
{$collectInstruction}
");
        
        return [$prompt, $firstMessage];
    }

    /**
     * Generar prompt para Bienvenida al Cliente
     */
    private static function generateWelcomePrompt(
        string $agentDisplayName,
        string $safeCompany,
        string $customerName,
        string $policyNumber,
        string $message,
        string $collectInstruction,
        array $dynamicVars,
        bool $whatsappEnabled = false
    ): array {
        $insuranceType = $dynamicVars['insurance_type'] ?? 'seguro';
        $startDate = $dynamicVars['start_date'] ?? 'hoy';
        $appLink = $dynamicVars['app_link'] ?? 'nuestra app';
        $supportPhone = $dynamicVars['support_phone'] ?? 'nuestra línea de atención';
        
        $firstMessage = "¡Hola {$customerName}! Soy {$agentDisplayName} de {$safeCompany}. " .
                       "Te damos la bienvenida como nuevo cliente. ¡Felicitaciones por tu nueva póliza de {$insuranceType}! " .
                       "¿Tienes unos minutos para que te cuente sobre tus beneficios?";
        
        // Construir instrucciones condicionales según WhatsApp
        $whatsappOferta = $whatsappEnabled
            ? "\n   - Ofrece enviar información por WhatsApp"
            : "";
        
        $whatsappGuardrail = $whatsappEnabled
            ? "\n- Si el cliente tiene prisa, ofrece enviar información por WhatsApp"
            : "\n- NO menciones WhatsApp ya que no está habilitado en esta campaña";
        
        $prompt = trim("
# Personality
Eres {$agentDisplayName}, una asesora de bienvenida de {$safeCompany}. Tienes una personalidad cálida, entusiasta y servicial. Hablas español de Colombia.

# Environment
Estás realizando una llamada de bienvenida a un nuevo cliente. Mantente profesional, amable y positiva.
Datos de contexto disponibles:
- Cliente: {$customerName}
- Póliza: {$policyNumber}
- Tipo de seguro: {$insuranceType}
- Fecha de inicio: {$startDate}
- Contexto: {$message}

# Tone
Mantén un tono cálido y acogedor. Respuestas claras y concisas (2-4 oraciones). Transmite confianza y disponibilidad.

# Goal
Tu objetivo es dar la bienvenida al cliente, explicar los principales beneficios de su póliza, verificar sus datos de contacto y asegurar que sepa cómo contactarnos.

Plan de conversación:
1) Apertura: Bienvenida entusiasta y felicitación por su nueva póliza
2) Desarrollo:
   - Explica 2-3 beneficios principales de su póliza
   - Menciona canales de atención (app, WhatsApp, teléfono)
   - Pregunta si tiene dudas sobre su cobertura
3) Confirmación:
   - Verifica email y teléfono de contacto
   - Pregunta su método de contacto preferido (WhatsApp, email, llamada)
4) Cierre: {$whatsappOferta}
   - Recolecta datos usando formato \"campo: valor\"
   - SIEMPRE despídete con calidez usando frases como: \"¡Bienvenido a la familia {$safeCompany}! Estamos aquí para lo que necesites. ¡Que tengas un excelente día!\" o \"Muchas gracias por confiar en nosotros. ¡Hasta pronto!\"
   - NO termines la llamada sin una despedida cálida y apropiada

# Guardrails
- Sé cálida y acogedora, pero profesional
- No abrumes con información técnica
- Escucha activamente las preguntas del cliente{$whatsappGuardrail}
- Siempre usa español de Colombia
- CRÍTICO: NUNCA termines la llamada sin una despedida cálida. Incluso si el cliente dice \"no\" o \"nada más\", DEBES responder con una despedida apropiada como \"¡Perfecto! Bienvenido a {$safeCompany}. Estamos para servirte. ¡Que tengas un excelente día!\" antes de colgar
- La despedida cálida es OBLIGATORIA en todas las llamadas de bienvenida, sin excepción

# Tools
{$collectInstruction}
");
        
        return [$prompt, $firstMessage];
    }

    /**
     * Generar prompt para Encuesta de Satisfacción
     */
    private static function generateSurveyPrompt(
        string $agentDisplayName,
        string $safeCompany,
        string $customerName,
        string $policyNumber,
        string $message,
        string $collectInstruction,
        array $dynamicVars,
        bool $whatsappEnabled = false
    ): array {
        $lastServiceDate = $dynamicVars['last_service_date'] ?? 'recientemente';
        $interactionType = $dynamicVars['interaction_type'] ?? 'nuestro servicio';
        
        $firstMessage = "Hola {$customerName}, soy {$agentDisplayName} de {$safeCompany}. ¿Cómo estás? " .
                       "Te llamo para conocer tu opinión sobre {$interactionType}. Solo te tomará 2-3 minutos. ¿Tienes un momento?";
        
        $prompt = trim("
# Personality
Eres {$agentDisplayName}, una asesora de experiencia del cliente de {$safeCompany}. Tienes una personalidad empática, profesional y orientada a escuchar. Hablas español de Colombia.

# Environment
Estás realizando una encuesta de satisfacción telefónica. Mantente profesional, empática y receptiva.
Datos de contexto disponibles:
- Cliente: {$customerName}
- Póliza: {$policyNumber}
- Último servicio: {$lastServiceDate}
- Tipo de interacción: {$interactionType}
- Contexto: {$message}

# Tone
Mantén un tono empático y profesional. Escucha activamente. Respuestas breves (1-2 oraciones por pregunta). Muestra genuino interés en el feedback.

# Goal
Tu objetivo es recopilar feedback honesto del cliente sobre su experiencia, medir su satisfacción y detectar áreas de mejora.

Plan de conversación:
1) Apertura: 
   - Saludo cordial y explicación breve del propósito
   - Menciona que tomará solo 2-3 minutos
2) Desarrollo (Preguntas clave):
   - \"Del 1 al 10, ¿qué tan satisfecho estás con nuestro servicio?\"
   - \"¿Qué es lo que más valoras de nuestro servicio?\"
   - \"¿Hay algo que podríamos mejorar?\"
   - \"¿Recomendarías {$safeCompany} a un amigo o familiar? Del 1 al 10\"
3) Profundización:
   - Si calificación < 7: \"Lamento escuchar eso. ¿Puedes contarme qué sucedió?\"
   - Si calificación >= 9: \"¡Qué bueno! ¿Qué fue lo que más te gustó?\"
4) Cierre:
   - Agradecer por el tiempo y feedback
   - Si hay problema: \"Vamos a revisar tu caso y te contactaremos pronto\"
   - Recolectar datos usando formato \"campo: valor\"
   - SIEMPRE despídete con gratitud usando frases como: \"Muchas gracias por tu tiempo y por compartir tu opinión. Tu feedback es muy valioso para nosotros. ¡Que tengas un excelente día!\" o \"Te agradecemos mucho por ayudarnos a mejorar. ¡Hasta pronto!\"
   - NO termines la llamada sin agradecer y despedirte apropiadamente

# Guardrails
- Sé empática y receptiva
- No interrumpas al cliente cuando comparte feedback
- No te pongas defensiva ante críticas
- Valida los sentimientos del cliente
- Si hay un problema serio, ofrece escalamiento
- Siempre usa español de Colombia
- CRÍTICO: NUNCA termines la llamada sin agradecer y despedirte. Incluso si el cliente dice \"no\" o \"nada más\", DEBES responder con una despedida apropiada como \"Muchas gracias por tu tiempo y por compartir tu opinión. ¡Que tengas un excelente día!\" antes de colgar
- El agradecimiento y despedida son OBLIGATORIOS en todas las encuestas, sin excepción

# Tools
{$collectInstruction}
");
        
        return [$prompt, $firstMessage];
    }
}