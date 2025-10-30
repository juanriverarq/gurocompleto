<?php

namespace App\Services;

/**
 * Servicio para extraer datos específicos de transcripciones según tipo de campaña
 */
class VoiceAgentDataExtractor
{
    /**
     * Extraer campos adicionales específicos por tipo de campaña
     */
    public static function extractFieldByType(string $text, string $fieldType, ?string $customPattern = null, float $confidence = 0.7): ?array
    {
        // Si hay un patrón personalizado, usarlo
        if ($customPattern) {
            if (preg_match('/' . $customPattern . '/i', $text, $matches)) {
                return [
                    'value' => trim($matches[1] ?? $matches[0]),
                    'confidence' => $confidence,
                    'source' => 'custom_pattern',
                    'pattern_used' => $customPattern
                ];
            }
            return null;
        }

        // Patrones específicos para nuevos tipos de campañas
        switch ($fieldType) {
            case 'satisfaction_rating':
            case 'calificacion':
                if (preg_match('/(?:calificación|calificacion|rating|puntaje|nota)?\s*(?:es|de|del)?\s*(\d{1,2})(?:\s*(?:de|sobre|\/)\s*10)?/i', $text, $m)) {
                    $rating = (int)$m[1];
                    if ($rating >= 1 && $rating <= 10) {
                        return ['value' => $rating, 'confidence' => 0.9, 'source' => 'rating_pattern'];
                    }
                }
                break;

            case 'recommendation_score':
            case 'nps':
                if (preg_match('/(?:recomendaría|recomendar|recomendación)?\s*(?:con)?\s*(?:un)?\s*(\d{1,2})(?:\s*(?:de|sobre|\/)\s*10)?/i', $text, $m)) {
                    $score = (int)$m[1];
                    if ($score >= 1 && $score <= 10) {
                        return ['value' => $score, 'confidence' => 0.9, 'source' => 'nps_pattern'];
                    }
                }
                break;

            case 'feedback':
            case 'comentarios':
                if (preg_match('/(?:opinión|opinion|comentario|feedback|experiencia|me pareció|pienso que|creo que)\s*(?:es|fue|que)?\s*([^\n\.]{10,200})/i', $text, $m)) {
                    return ['value' => trim($m[1]), 'confidence' => 0.6, 'source' => 'feedback_pattern'];
                }
                break;

            case 'improvement_suggestions':
            case 'sugerencias':
                if (preg_match('/(?:mejorar|mejora|sugerencia|sugiero|podrían|deberían)\s*([^\n\.]{10,200})/i', $text, $m)) {
                    return ['value' => trim($m[0]), 'confidence' => 0.7, 'source' => 'suggestion_pattern'];
                }
                break;

            case 'positive_aspects':
            case 'aspectos_positivos':
                if (preg_match('/(?:me gustó|me gusta|valoro|aprecio|excelente|bueno|bien)\s*([^\n\.]{10,200})/i', $text, $m)) {
                    return ['value' => trim($m[0]), 'confidence' => 0.6, 'source' => 'positive_pattern'];
                }
                break;

            case 'preferred_contact_method':
            case 'metodo_contacto':
                if (preg_match('/(?:prefiero|mejor|contacto por|contactarme por)\s*(whatsapp|email|correo|llamada|teléfono|telefono)/i', $text, $m)) {
                    return ['value' => strtolower($m[1]), 'confidence' => 0.8, 'source' => 'contact_method_pattern'];
                }
                break;
        }

        return null;
    }

    /**
     * Obtener configuración de campos por defecto según tipo de campaña
     */
    public static function getDefaultCollectFields(string $campaignType): array
    {
        switch ($campaignType) {
            case 'payment_reminder':
                return [
                    'phone' => ['enabled' => true, 'type' => 'phone'],
                    'email' => ['enabled' => true, 'type' => 'email'],
                    'debt_amount' => ['enabled' => true, 'type' => 'amount']
                ];
            
            case 'customer_welcome':
                return [
                    'email' => ['enabled' => true, 'type' => 'email'],
                    'phone' => ['enabled' => true, 'type' => 'phone'],
                    'preferred_contact_method' => ['enabled' => true, 'type' => 'preferred_contact_method']
                ];
            
            case 'satisfaction_survey':
                return [
                    'satisfaction_rating' => ['enabled' => true, 'type' => 'satisfaction_rating'],
                    'recommendation_score' => ['enabled' => true, 'type' => 'recommendation_score'],
                    'feedback' => ['enabled' => true, 'type' => 'feedback'],
                    'improvement_suggestions' => ['enabled' => false, 'type' => 'improvement_suggestions'],
                    'positive_aspects' => ['enabled' => false, 'type' => 'positive_aspects']
                ];
            
            default:
                return [
                    'email' => ['enabled' => true, 'type' => 'email'],
                    'phone' => ['enabled' => true, 'type' => 'phone']
                ];
        }
    }
}