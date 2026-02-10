<?php

namespace App\Services;

use App\Models\WhatsAppInstance;
use Illuminate\Support\Facades\Log;

/**
 * WhatsAppBridgeService
 * =====================
 * Puente unificado para enviar mensajes de WhatsApp.
 * Usa exclusivamente Cloud API (Meta Graph API).
 */
class WhatsAppBridgeService
{
    protected WhatsAppCloudApiService $cloudApiService;

    public function __construct()
    {
        $this->cloudApiService = app(WhatsAppCloudApiService::class);
    }

    /**
     * Resolver instancia desde instance_id
     */
    protected function resolveInstance(string $instanceId): ?WhatsAppInstance
    {
        return WhatsAppInstance::where('instance_id', $instanceId)->first();
    }

    /**
     * Enviar mensaje de texto via Cloud API
     */
    public function sendMessage(string $instanceId, string $phone, string $message, array $options = []): array
    {
        $instance = $this->resolveInstance($instanceId);
        
        if (!$instance) {
            Log::error('Instance not found for sending message', ['instanceId' => $instanceId]);
            return ['success' => false, 'error' => 'Instance not found'];
        }

        try {
            $result = $this->cloudApiService->sendTextMessage($instance, $phone, $message);
            
            return [
                'success' => $result['success'] ?? false,
                'messageId' => $result['message_id'] ?? null,
                'data' => $result,
            ];
        } catch (\Exception $e) {
            Log::error('Error sending message via Cloud API', [
                'instanceId' => $instance->instance_id,
                'phone' => $phone,
                'error' => $e->getMessage()
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Enviar mensaje a instancia específica
     */
    public function sendToInstance(string $instanceId, string $phone, string $message): array
    {
        return $this->sendMessage($instanceId, $phone, $message);
    }

    // =========================================================================
    // SOPORTE MULTIMEDIA
    // =========================================================================

    /**
     * Enviar imagen
     */
    public function sendImage(string $instanceId, string $phone, string $imageUrl, ?string $caption = null): array
    {
        $instance = $this->resolveInstance($instanceId);
        if (!$instance) return ['success' => false, 'error' => 'Instance not found'];

        return $this->cloudApiService->sendImageMessage($instance, $phone, $imageUrl, $caption);
    }

    /**
     * Enviar documento/archivo
     */
    public function sendDocument(string $instanceId, string $phone, string $documentUrl, ?string $filename = null, ?string $caption = null): array
    {
        $instance = $this->resolveInstance($instanceId);
        if (!$instance) return ['success' => false, 'error' => 'Instance not found'];

        return $this->cloudApiService->sendDocumentMessage($instance, $phone, $documentUrl, $filename, $caption);
    }

    /**
     * Enviar audio/nota de voz
     */
    public function sendAudio(string $instanceId, string $phone, string $audioUrl, bool $ptt = false): array
    {
        $instance = $this->resolveInstance($instanceId);
        if (!$instance) return ['success' => false, 'error' => 'Instance not found'];

        return $this->cloudApiService->sendAudio($instance, $phone, $audioUrl);
    }

    /**
     * Enviar video
     */
    public function sendVideo(string $instanceId, string $phone, string $videoUrl, ?string $caption = null): array
    {
        $instance = $this->resolveInstance($instanceId);
        if (!$instance) return ['success' => false, 'error' => 'Instance not found'];

        return $this->cloudApiService->sendVideo($instance, $phone, $videoUrl, $caption);
    }

    /**
     * Enviar botones interactivos (list message)
     */
    public function sendListMessage(string $instanceId, string $phone, string $title, string $body, string $buttonText, array $sections): array
    {
        $instance = $this->resolveInstance($instanceId);
        if (!$instance) return ['success' => false, 'error' => 'Instance not found'];

        return $this->cloudApiService->sendListMessage($instance, $phone, $body, $buttonText, $sections);
    }

    /**
     * Enviar botones de respuesta rápida
     */
    public function sendButtonMessage(string $instanceId, string $phone, string $body, array $buttons, ?string $header = null, ?string $footer = null): array
    {
        $instance = $this->resolveInstance($instanceId);
        if (!$instance) return ['success' => false, 'error' => 'Instance not found'];

        return $this->cloudApiService->sendButtonMessage($instance, $phone, $body, $buttons, $header, $footer);
    }

    /**
     * Emitir evento via broadcasting (sin dependencia de microservicio)
     */
    public function emitSocketEvent(string $event, array $data): bool
    {
        // Socket events are now handled by Laravel broadcasting directly
        Log::info('Socket event emitted', ['event' => $event, 'data' => $data]);
        return true;
    }
}
