<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Servicio para enviar mensajes de WhatsApp post-llamada según tipo de campaña
 */
class VoiceAgentWhatsAppService
{
    /**
     * Enviar mensaje de WhatsApp según tipo de campaña
     */
    public static function sendPostCallMessage(
        string $campaignType,
        int $brokerId,
        string $phone,
        string $customerName,
        string $reference,
        ?string $instanceId = null,
        ?string $template = null,
        array $metadata = []
    ): bool {
        switch ($campaignType) {
            case 'payment_reminder':
                $amountCop = $metadata['amount_cop'] ?? 125000;
                $conversationId = $metadata['conversation_id'] ?? $reference;
                return self::sendPaymentLink($brokerId, $phone, $customerName, $amountCop, $reference, $conversationId, $instanceId, $template);
            
            case 'customer_welcome':
                return self::sendWelcomeMessage($brokerId, $phone, $customerName, $reference, $instanceId, $template, $metadata);
            
            case 'satisfaction_survey':
                return self::sendSurveyThankYou($brokerId, $phone, $customerName, $instanceId, $template);
            
            default:
                return false;
        }
    }

    /**
     * Enviar enlace de pago por WhatsApp
     */
    private static function sendPaymentLink(
        int $brokerId,
        string $phone,
        string $customerName,
        int $amountCop,
        string $reference,
        string $conversationId,
        ?string $instanceId = null,
        ?string $template = null
    ): bool {
        try {
            $waBase = rtrim(env('WHATSAPP_SERVICE_URL', 'http://localhost:3000/api/v1'), '/');
            $basePayUrl = env('PAYMENT_BASE_URL', 'https://pay.guro.app/pay');
            $paymentUrl = $basePayUrl . '?' . http_build_query([
                'ref' => $reference,
                'amount' => $amountCop,
                'conv' => $conversationId,
                'broker' => $brokerId,
            ]);

            $defaultMessage = "Hola {$customerName}, te compartimos tu enlace de pago: {$paymentUrl} \n\nSi necesitas ayuda, responde a este mensaje.";
            $message = $template ? strtr($template, [
                '{customer_name}' => $customerName,
                '{amount_cop}' => (string) $amountCop,
                '{reference}' => $reference,
                '{payment_link}' => $paymentUrl,
            ]) : $defaultMessage;

            return self::sendMessage($brokerId, $phone, $message, $instanceId, 'payment_link');
        } catch (\Throwable $e) {
            Log::error('❌ [WHATSAPP PAYMENT] Error enviando enlace de pago', ['error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * Enviar mensaje de bienvenida por WhatsApp
     */
    private static function sendWelcomeMessage(
        int $brokerId,
        string $phone,
        string $customerName,
        string $reference,
        ?string $instanceId = null,
        ?string $template = null,
        array $metadata = []
    ): bool {
        try {
            $companyName = env('DEFAULT_COMPANY_NAME', 'GURO Seguros');
            $appLink = env('APP_LINK', 'https://app.guro.com');
            $supportPhone = env('SUPPORT_PHONE', '+57 300 123 4567');
            
            $policyNumber = data_get($metadata, 'collected_data.policy_number.value') ?? $reference;
            $insuranceType = data_get($metadata, 'collected_data.insurance_type.value') ?? 'tu seguro';
            
            $defaultMessage = "¡Hola {$customerName}! 👋\n\n" .
                            "Gracias por confiar en {$companyName}. Aquí está tu información de bienvenida:\n\n" .
                            "📋 Póliza: {$policyNumber}\n" .
                            "🛡️ Cobertura: {$insuranceType}\n\n" .
                            "📱 Descarga nuestra app: {$appLink}\n" .
                            "📞 Línea de atención: {$supportPhone}\n" .
                            "💬 Escríbenos aquí para cualquier duda\n\n" .
                            "¡Estamos para servirte!";
            
            $message = $template ? strtr($template, [
                '{customer_name}' => $customerName,
                '{company_name}' => $companyName,
                '{policy_number}' => $policyNumber,
                '{insurance_type}' => $insuranceType,
                '{app_link}' => $appLink,
                '{support_phone}' => $supportPhone,
            ]) : $defaultMessage;

            return self::sendMessage($brokerId, $phone, $message, $instanceId, 'welcome');
        } catch (\Throwable $e) {
            Log::error('❌ [WHATSAPP WELCOME] Error enviando mensaje de bienvenida', ['error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * Enviar agradecimiento por encuesta por WhatsApp
     */
    private static function sendSurveyThankYou(
        int $brokerId,
        string $phone,
        string $customerName,
        ?string $instanceId = null,
        ?string $template = null
    ): bool {
        try {
            $companyName = env('DEFAULT_COMPANY_NAME', 'GURO Seguros');
            
            $defaultMessage = "Hola {$customerName},\n\n" .
                            "Muchas gracias por tu tiempo y por compartir tu opinión con nosotros. " .
                            "Tu feedback es muy valioso y nos ayuda a mejorar cada día.\n\n" .
                            "Si tienes alguna pregunta o necesitas ayuda, no dudes en escribirnos.\n\n" .
                            "Saludos,\n" .
                            "Equipo {$companyName}";
            
            $message = $template ? strtr($template, [
                '{customer_name}' => $customerName,
                '{company_name}' => $companyName,
            ]) : $defaultMessage;

            return self::sendMessage($brokerId, $phone, $message, $instanceId, 'survey_thanks');
        } catch (\Throwable $e) {
            Log::error('❌ [WHATSAPP SURVEY] Error enviando agradecimiento', ['error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * Método genérico para enviar mensajes de WhatsApp
     */
    private static function sendMessage(
        int $brokerId,
        string $phone,
        string $message,
        ?string $instanceId = null,
        string $label = 'voice_campaign'
    ): bool {
        try {
            $waBase = rtrim(env('WHATSAPP_SERVICE_URL', 'http://localhost:3000/api/v1'), '/');

            if ($instanceId) {
                $url = $waBase . '/instances/' . $instanceId . '/send-message';
                $resp = Http::retry(2, 500)->post($url, [
                    'phone' => $phone,
                    'message' => $message,
                    'options' => ['broker_id' => $brokerId, 'label' => $label]
                ]);
                return $resp->ok() && (bool) ($resp->json('success'));
            }

            // Legacy endpoint
            $payload = [
                'phone' => $phone,
                'message' => $message,
                'options' => ['broker_id' => $brokerId, 'label' => $label]
            ];
            $legacyUrl = $waBase . '/messages/send';
            $resp = Http::retry(2, 500)->post($legacyUrl, $payload);
            return $resp->ok() && (bool) ($resp->json('success'));

        } catch (\Throwable $e) {
            Log::error('❌ [WHATSAPP] Error enviando mensaje', ['error' => $e->getMessage(), 'label' => $label]);
            return false;
        }
    }
}