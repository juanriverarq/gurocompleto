<?php

namespace App\Services;

use App\Models\WhatsAppInstance;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * WhatsAppBridgeService
 * =====================
 * Puente unificado para enviar mensajes de WhatsApp.
 * Soporta dos tipos de conexión:
 * - Baileys (via microservicio en puerto 3000)
 * - Cloud API (directo a Meta Graph API)
 * 
 * NO modifica el microservicio - solo se comunica via API/Webhooks.
 */
class WhatsAppBridgeService
{
    protected string $baseUrl;
    protected int $timeout;
    protected WhatsAppCloudApiService $cloudApiService;

    public function __construct()
    {
        $this->baseUrl = rtrim(env('WHATSAPP_SERVICE_URL', 'http://127.0.0.1:3000/api/v1'), '/');
        $this->timeout = (int) env('WHATSAPP_SERVICE_TIMEOUT', 30);
        $this->cloudApiService = app(WhatsAppCloudApiService::class);
    }

    /**
     * Verificar si el microservicio está disponible
     */
    public function isAvailable(): bool
    {
        try {
            $response = Http::timeout(5)->get("{$this->baseUrl}/health");
            return $response->successful();
        } catch (\Exception $e) {
            Log::warning('WhatsApp microservice not available', ['error' => $e->getMessage()]);
            return false;
        }
    }

    /**
     * Obtener todas las instancias
     */
    public function getInstances(): array
    {
        try {
            $response = Http::timeout($this->timeout)
                ->get("{$this->baseUrl}/instances");

            if ($response->successful()) {
                return $response->json('instances', []);
            }

            return [];
        } catch (\Exception $e) {
            Log::error('Error getting instances', ['error' => $e->getMessage()]);
            return [];
        }
    }

    /**
     * Obtener estado de una instancia
     */
    public function getInstanceStatus(string $instanceId): ?array
    {
        try {
            $response = Http::timeout($this->timeout)
                ->get("{$this->baseUrl}/instances/{$instanceId}/status");

            if ($response->successful()) {
                return $response->json();
            }

            return null;
        } catch (\Exception $e) {
            Log::error('Error getting instance status', [
                'instanceId' => $instanceId,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Crear una nueva instancia
     */
    public function createInstance(string $instanceId, array $settings = []): array
    {
        try {
            $response = Http::timeout($this->timeout)
                ->post("{$this->baseUrl}/instances", [
                    'instanceId' => $instanceId,
                    'webhook' => route('api.whatsapp.webhook'),
                    'settings' => $settings,
                ]);

            return [
                'success' => $response->successful(),
                'data' => $response->json(),
            ];
        } catch (\Exception $e) {
            Log::error('Error creating instance', [
                'instanceId' => $instanceId,
                'error' => $e->getMessage()
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Obtener QR de una instancia
     */
    public function getQR(string $instanceId): ?string
    {
        try {
            $response = Http::timeout($this->timeout)
                ->get("{$this->baseUrl}/instances/{$instanceId}/qr");

            if ($response->successful() && $response->json('success')) {
                return $response->json('qr');
            }

            return null;
        } catch (\Exception $e) {
            Log::error('Error getting QR', [
                'instanceId' => $instanceId,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Enviar mensaje de texto (detecta automáticamente el tipo de conexión)
     */
    public function sendMessage(string $instanceId, string $phone, string $message, array $options = []): array
    {
        // Buscar la instancia para determinar el tipo de conexión
        $instance = WhatsAppInstance::where('instance_id', $instanceId)->first();
        
        if (!$instance) {
            Log::error('Instance not found for sending message', ['instanceId' => $instanceId]);
            return ['success' => false, 'error' => 'Instance not found'];
        }

        // Si es Cloud API, usar el servicio de Cloud API
        if ($instance->connection_type === 'cloud_api') {
            return $this->sendViaCloudApi($instance, $phone, $message, $options);
        }

        // Si es Baileys, usar el microservicio
        return $this->sendViaBaileys($instanceId, $phone, $message, $options);
    }

    /**
     * Enviar mensaje via Cloud API (Meta Graph API)
     */
    protected function sendViaCloudApi(WhatsAppInstance $instance, string $phone, string $message, array $options = []): array
    {
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
     * Enviar mensaje via Baileys (microservicio)
     */
    protected function sendViaBaileys(string $instanceId, string $phone, string $message, array $options = []): array
    {
        try {
            $payload = [
                'instanceId' => $instanceId,
                'phone' => $phone,
                'message' => $message,
            ];

            if (!empty($options['media'])) {
                $payload['media'] = $options['media'];
            }

            $response = Http::timeout($this->timeout)
                ->post("{$this->baseUrl}/messages/send", $payload);

            $data = $response->json();

            return [
                'success' => $response->successful() && ($data['success'] ?? false),
                'messageId' => $data['messageId'] ?? null,
                'data' => $data,
            ];
        } catch (\Exception $e) {
            Log::error('Error sending message via Baileys', [
                'instanceId' => $instanceId,
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

    /**
     * Desconectar instancia
     */
    public function disconnectInstance(string $instanceId): bool
    {
        try {
            $response = Http::timeout($this->timeout)
                ->post("{$this->baseUrl}/api/v1/instances/{$instanceId}/disconnect");

            return $response->successful();
        } catch (\Exception $e) {
            Log::error('Error disconnecting instance', [
                'instanceId' => $instanceId,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Eliminar instancia
     */
    public function deleteInstance(string $instanceId): bool
    {
        try {
            $response = Http::timeout($this->timeout)
                ->delete("{$this->baseUrl}/api/v1/instances/{$instanceId}");

            return $response->successful();
        } catch (\Exception $e) {
            Log::error('Error deleting instance', [
                'instanceId' => $instanceId,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Registrar webhook en el microservicio para una instancia
     */
    public function registerWebhook(string $instanceId, string $webhookUrl): bool
    {
        try {
            $response = Http::timeout($this->timeout)
                ->post("{$this->baseUrl}/api/v1/instances/{$instanceId}/webhook", [
                    'url' => $webhookUrl,
                ]);

            return $response->successful();
        } catch (\Exception $e) {
            Log::error('Error registering webhook', [
                'instanceId' => $instanceId,
                'webhookUrl' => $webhookUrl,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    // =========================================================================
    // SOPORTE MULTIMEDIA
    // =========================================================================

    /**
     * Enviar imagen
     */
    public function sendImage(string $instanceId, string $phone, string $imageUrl, ?string $caption = null): array
    {
        $instance = WhatsAppInstance::where('instance_id', $instanceId)->first();
        
        if (!$instance) {
            return ['success' => false, 'error' => 'Instance not found'];
        }

        if ($instance->connection_type === 'cloud_api') {
            return $this->cloudApiService->sendImageMessage($instance, $phone, $imageUrl, $caption);
        }

        return $this->sendMediaViaBaileys($instanceId, $phone, 'image', $imageUrl, $caption);
    }

    /**
     * Enviar documento/archivo
     */
    public function sendDocument(string $instanceId, string $phone, string $documentUrl, ?string $filename = null, ?string $caption = null): array
    {
        $instance = WhatsAppInstance::where('instance_id', $instanceId)->first();
        
        if (!$instance) {
            return ['success' => false, 'error' => 'Instance not found'];
        }

        if ($instance->connection_type === 'cloud_api') {
            return $this->cloudApiService->sendDocumentMessage($instance, $phone, $documentUrl, $filename, $caption);
        }

        return $this->sendMediaViaBaileys($instanceId, $phone, 'document', $documentUrl, $caption, ['filename' => $filename]);
    }

    /**
     * Enviar audio/nota de voz
     */
    public function sendAudio(string $instanceId, string $phone, string $audioUrl, bool $ptt = false): array
    {
        $instance = WhatsAppInstance::where('instance_id', $instanceId)->first();
        
        if (!$instance) {
            return ['success' => false, 'error' => 'Instance not found'];
        }

        if ($instance->connection_type === 'cloud_api') {
            return $this->cloudApiService->sendAudio($instance, $phone, $audioUrl);
        }

        return $this->sendMediaViaBaileys($instanceId, $phone, 'audio', $audioUrl, null, ['ptt' => $ptt]);
    }

    /**
     * Enviar video
     */
    public function sendVideo(string $instanceId, string $phone, string $videoUrl, ?string $caption = null): array
    {
        $instance = WhatsAppInstance::where('instance_id', $instanceId)->first();
        
        if (!$instance) {
            return ['success' => false, 'error' => 'Instance not found'];
        }

        if ($instance->connection_type === 'cloud_api') {
            return $this->cloudApiService->sendVideo($instance, $phone, $videoUrl, $caption);
        }

        return $this->sendMediaViaBaileys($instanceId, $phone, 'video', $videoUrl, $caption);
    }

    /**
     * Enviar botones interactivos (list message)
     */
    public function sendListMessage(string $instanceId, string $phone, string $title, string $body, string $buttonText, array $sections): array
    {
        $instance = WhatsAppInstance::where('instance_id', $instanceId)->first();
        
        if (!$instance) {
            return ['success' => false, 'error' => 'Instance not found'];
        }

        if ($instance->connection_type === 'cloud_api') {
            return $this->cloudApiService->sendListMessage($instance, $phone, $body, $buttonText, $sections);
        }

        return $this->sendInteractiveViaBaileys($instanceId, $phone, 'list', [
            'title' => $title,
            'body' => $body,
            'buttonText' => $buttonText,
            'sections' => $sections,
        ]);
    }

    /**
     * Enviar botones de respuesta rápida
     */
    public function sendButtonMessage(string $instanceId, string $phone, string $body, array $buttons, ?string $header = null, ?string $footer = null): array
    {
        $instance = WhatsAppInstance::where('instance_id', $instanceId)->first();
        
        if (!$instance) {
            return ['success' => false, 'error' => 'Instance not found'];
        }

        if ($instance->connection_type === 'cloud_api') {
            return $this->cloudApiService->sendButtonMessage($instance, $phone, $body, $buttons, $header, $footer);
        }

        return $this->sendInteractiveViaBaileys($instanceId, $phone, 'buttons', [
            'body' => $body,
            'buttons' => $buttons,
            'header' => $header,
            'footer' => $footer,
        ]);
    }

    /**
     * Enviar media via Baileys (microservicio)
     */
    protected function sendMediaViaBaileys(string $instanceId, string $phone, string $mediaType, string $mediaUrl, ?string $caption = null, array $options = []): array
    {
        try {
            $payload = [
                'instanceId' => $instanceId,
                'phone' => $phone,
                'type' => $mediaType,
                'media' => [
                    'url' => $mediaUrl,
                    'caption' => $caption,
                    ...$options,
                ],
            ];

            $response = Http::timeout($this->timeout)
                ->post("{$this->baseUrl}/messages/send-media", $payload);

            $data = $response->json();

            return [
                'success' => $response->successful() && ($data['success'] ?? false),
                'messageId' => $data['messageId'] ?? null,
                'data' => $data,
            ];
        } catch (\Exception $e) {
            Log::error("Error sending {$mediaType} via Baileys", [
                'instanceId' => $instanceId,
                'phone' => $phone,
                'error' => $e->getMessage()
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Enviar mensaje interactivo via Baileys
     */
    protected function sendInteractiveViaBaileys(string $instanceId, string $phone, string $interactiveType, array $content): array
    {
        try {
            $payload = [
                'instanceId' => $instanceId,
                'phone' => $phone,
                'type' => 'interactive',
                'interactive' => [
                    'type' => $interactiveType,
                    ...$content,
                ],
            ];

            $response = Http::timeout($this->timeout)
                ->post("{$this->baseUrl}/messages/send-interactive", $payload);

            $data = $response->json();

            return [
                'success' => $response->successful() && ($data['success'] ?? false),
                'messageId' => $data['messageId'] ?? null,
                'data' => $data,
            ];
        } catch (\Exception $e) {
            Log::error("Error sending interactive {$interactiveType} via Baileys", [
                'instanceId' => $instanceId,
                'phone' => $phone,
                'error' => $e->getMessage()
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Emitir evento al microservicio para broadcasting via Socket.IO
     * Usado para notificar nuevos mensajes en tiempo real
     */
    public function emitSocketEvent(string $event, array $data): bool
    {
        try {
            $response = Http::timeout(5)
                ->post("{$this->baseUrl}/emit-event", [
                    'event' => $event,
                    'data' => $data,
                ]);

            return $response->successful();
        } catch (\Exception $e) {
            Log::warning('Error emitting socket event', [
                'event' => $event,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }
}
