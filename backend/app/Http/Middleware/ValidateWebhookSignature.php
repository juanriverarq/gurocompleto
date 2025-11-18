<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware de Validación de Firmas de Webhooks
 * 
 * Valida la autenticidad de webhooks de servicios externos:
 * - ElevenLabs
 * - WhatsApp
 * - SendGrid
 * - Otros servicios
 * 
 * En desarrollo: Permite pasar sin validación (para testing)
 * En producción: Valida firma obligatoriamente
 */
class ValidateWebhookSignature
{
    /**
     * Servicios soportados y sus métodos de validación
     */
    private const WEBHOOK_SERVICES = [
        'elevenlabs' => 'validateElevenLabs',
        'whatsapp' => 'validateWhatsApp',
        'sendgrid' => 'validateSendGrid',
        'wompi' => 'validateWompi',
    ];

    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, string $service = null): Response
    {
        $environment = app()->environment();
        $isProduction = $environment === 'production';
        
        // Registrar webhook recibido
        Log::channel('webhooks')->info('Webhook received', [
            'service' => $service,
            'environment' => $environment,
            'path' => $request->path(),
            'method' => $request->method(),
            'ip' => $request->ip(),
            'timestamp' => now()->toISOString(),
        ]);
        
        // En desarrollo, permitir sin validación (facilita testing)
        if (!$isProduction) {
            Log::channel('webhooks')->debug('Webhook validation skipped (development mode)', [
                'service' => $service,
            ]);
            return $next($request);
        }
        
        // En producción, validar firma
        if (!$service || !isset(self::WEBHOOK_SERVICES[$service])) {
            Log::channel('security')->error('Unknown webhook service', [
                'service' => $service,
                'path' => $request->path(),
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Unknown webhook service'
            ], 400);
        }
        
        // Ejecutar validación específica del servicio
        $validationMethod = self::WEBHOOK_SERVICES[$service];
        $isValid = $this->$validationMethod($request);
        
        if (!$isValid) {
            Log::channel('security')->warning('Webhook signature validation failed', [
                'service' => $service,
                'ip' => $request->ip(),
                'path' => $request->path(),
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'Invalid webhook signature'
            ], 401);
        }
        
        // Validación exitosa
        Log::channel('webhooks')->info('Webhook signature validated successfully', [
            'service' => $service,
        ]);
        
        return $next($request);
    }

    /**
     * Validar webhook de ElevenLabs
     */
    private function validateElevenLabs(Request $request): bool
    {
        $signature = $request->header('X-ElevenLabs-Signature');
        $secret = config('security.elevenlabs_webhook_secret');
        
        if (empty($secret)) {
            Log::channel('security')->warning('ElevenLabs webhook secret not configured');
            return false;
        }
        
        if (empty($signature)) {
            return false;
        }
        
        // Calcular firma esperada
        $payload = $request->getContent();
        $expectedSignature = hash_hmac('sha256', $payload, $secret);
        
        return hash_equals($expectedSignature, $signature);
    }

    /**
     * Validar webhook de WhatsApp
     */
    private function validateWhatsApp(Request $request): bool
    {
        $signature = $request->header('X-Hub-Signature-256');
        $secret = config('security.whatsapp_webhook_secret');
        
        if (empty($secret)) {
            Log::channel('security')->warning('WhatsApp webhook secret not configured');
            return false;
        }
        
        if (empty($signature)) {
            return false;
        }
        
        // Remover prefijo "sha256="
        $signature = str_replace('sha256=', '', $signature);
        
        // Calcular firma esperada
        $payload = $request->getContent();
        $expectedSignature = hash_hmac('sha256', $payload, $secret);
        
        return hash_equals($expectedSignature, $signature);
    }

    /**
     * Validar webhook de SendGrid
     */
    private function validateSendGrid(Request $request): bool
    {
        $signature = $request->header('X-Twilio-Email-Event-Webhook-Signature');
        $timestamp = $request->header('X-Twilio-Email-Event-Webhook-Timestamp');
        $secret = config('security.sendgrid_webhook_secret');
        
        if (empty($secret) || empty($signature) || empty($timestamp)) {
            return false;
        }
        
        // Verificar timestamp (no más de 5 minutos de antigüedad)
        $currentTime = time();
        if (abs($currentTime - $timestamp) > 300) {
            Log::channel('security')->warning('SendGrid webhook timestamp too old', [
                'timestamp' => $timestamp,
                'current_time' => $currentTime,
            ]);
            return false;
        }
        
        // Calcular firma esperada
        $payload = $request->getContent();
        $data = $timestamp . $payload;
        $expectedSignature = base64_encode(hash_hmac('sha256', $data, $secret, true));
        
        return hash_equals($expectedSignature, $signature);
    }

    /**
     * Validar webhook de Wompi
     */
    private function validateWompi(Request $request): bool
    {
        $signature = $request->header('X-Event-Checksum');
        $secret = config('security.wompi_webhook_secret');
        
        if (empty($secret)) {
            Log::channel('security')->warning('Wompi webhook secret not configured');
            return false;
        }
        
        if (empty($signature)) {
            return false;
        }
        
        // Wompi usa el body completo para la firma
        $payload = $request->getContent();
        $expectedSignature = hash('sha256', $payload . $secret);
        
        return hash_equals($expectedSignature, $signature);
    }
}
