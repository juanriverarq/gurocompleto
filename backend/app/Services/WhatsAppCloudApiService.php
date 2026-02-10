<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Models\WhatsAppInstance;

class WhatsAppCloudApiService
{
    private string $apiVersion = 'v22.0';
    private string $baseUrl = 'https://graph.facebook.com';

    /**
     * Enviar mensaje de texto
     */
    public function sendTextMessage(WhatsAppInstance $instance, string $to, string $message): array
    {
        return $this->sendMessage($instance, [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $this->formatPhoneNumber($to),
            'type' => 'text',
            'text' => [
                'preview_url' => false,
                'body' => $message
            ]
        ]);
    }

    /**
     * Enviar mensaje con plantilla
     */
    public function sendTemplateMessage(WhatsAppInstance $instance, string $to, string $templateName, string $languageCode = 'es', array $components = []): array
    {
        $payload = [
            'messaging_product' => 'whatsapp',
            'to' => $this->formatPhoneNumber($to),
            'type' => 'template',
            'template' => [
                'name' => $templateName,
                'language' => [
                    'code' => $languageCode
                ]
            ]
        ];

        if (!empty($components)) {
            $payload['template']['components'] = $components;
        }

        return $this->sendMessage($instance, $payload);
    }

    /**
     * Enviar mensaje con imagen
     */
    public function sendImageMessage(WhatsAppInstance $instance, string $to, string $imageUrl, ?string $caption = null): array
    {
        $imageData = ['link' => $imageUrl];
        if ($caption) {
            $imageData['caption'] = $caption;
        }

        return $this->sendMessage($instance, [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $this->formatPhoneNumber($to),
            'type' => 'image',
            'image' => $imageData
        ]);
    }

    /**
     * Enviar mensaje con documento
     */
    public function sendDocumentMessage(WhatsAppInstance $instance, string $to, string $documentUrl, ?string $filename = null, ?string $caption = null): array
    {
        $docData = ['link' => $documentUrl];
        if ($filename) {
            $docData['filename'] = $filename;
        }
        if ($caption) {
            $docData['caption'] = $caption;
        }

        return $this->sendMessage($instance, [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $this->formatPhoneNumber($to),
            'type' => 'document',
            'document' => $docData
        ]);
    }

    /**
     * Enviar mensaje con audio
     */
    public function sendAudio(WhatsAppInstance $instance, string $to, string $audioUrl): array
    {
        return $this->sendMessage($instance, [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $this->formatPhoneNumber($to),
            'type' => 'audio',
            'audio' => ['link' => $audioUrl]
        ]);
    }

    /**
     * Enviar mensaje con video
     */
    public function sendVideo(WhatsAppInstance $instance, string $to, string $videoUrl, ?string $caption = null): array
    {
        $videoData = ['link' => $videoUrl];
        if ($caption) {
            $videoData['caption'] = $caption;
        }

        return $this->sendMessage($instance, [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $this->formatPhoneNumber($to),
            'type' => 'video',
            'video' => $videoData
        ]);
    }

    /**
     * Enviar mensaje con botones interactivos
     */
    public function sendButtonMessage(WhatsAppInstance $instance, string $to, string $bodyText, array $buttons): array
    {
        $buttonData = array_map(function ($button, $index) {
            return [
                'type' => 'reply',
                'reply' => [
                    'id' => $button['id'] ?? "btn_$index",
                    'title' => substr($button['title'], 0, 20) // Max 20 chars
                ]
            ];
        }, $buttons, array_keys($buttons));

        return $this->sendMessage($instance, [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $this->formatPhoneNumber($to),
            'type' => 'interactive',
            'interactive' => [
                'type' => 'button',
                'body' => ['text' => $bodyText],
                'action' => ['buttons' => array_slice($buttonData, 0, 3)] // Max 3 buttons
            ]
        ]);
    }

    /**
     * Enviar mensaje con lista
     */
    public function sendListMessage(WhatsAppInstance $instance, string $to, string $bodyText, string $buttonText, array $sections): array
    {
        return $this->sendMessage($instance, [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $this->formatPhoneNumber($to),
            'type' => 'interactive',
            'interactive' => [
                'type' => 'list',
                'body' => ['text' => $bodyText],
                'action' => [
                    'button' => substr($buttonText, 0, 20),
                    'sections' => $sections
                ]
            ]
        ]);
    }

    /**
     * Marcar mensaje como leído
     */
    public function markAsRead(WhatsAppInstance $instance, string $messageId): array
    {
        return $this->sendMessage($instance, [
            'messaging_product' => 'whatsapp',
            'status' => 'read',
            'message_id' => $messageId
        ]);
    }

    /**
     * Obtener información del perfil de negocio
     */
    public function getBusinessProfile(WhatsAppInstance $instance): array
    {
        try {
            $response = Http::withToken($instance->cloud_api_token)
                ->get("{$this->baseUrl}/{$this->apiVersion}/{$instance->cloud_api_phone_id}/whatsapp_business_profile", [
                    'fields' => 'about,address,description,email,profile_picture_url,websites,vertical'
                ]);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'data' => $response->json()['data'][0] ?? []
                ];
            }

            return [
                'success' => false,
                'error' => $response->json()['error'] ?? 'Unknown error'
            ];
        } catch (\Exception $e) {
            Log::error('WhatsApp Cloud API - Error getting business profile', [
                'instance_id' => $instance->instance_id,
                'error' => $e->getMessage()
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Obtener URL de media desde media_id
     */
    public function getMediaUrl(WhatsAppInstance $instance, string $mediaId): ?string
    {
        try {
            $url = "{$this->baseUrl}/{$this->apiVersion}/{$mediaId}";
            
            Log::info('WhatsApp Cloud API - Getting media URL', [
                'media_id' => $mediaId,
                'url' => $url
            ]);

            $response = Http::withToken($instance->cloud_api_token)
                ->get($url);

            if ($response->successful()) {
                $mediaUrl = $response->json('url');
                Log::info('WhatsApp Cloud API - Media URL obtained', [
                    'media_id' => $mediaId,
                    'media_url' => $mediaUrl ? 'obtained' : 'null'
                ]);
                return $mediaUrl;
            }

            Log::warning('WhatsApp Cloud API - Error getting media URL', [
                'media_id' => $mediaId,
                'status' => $response->status(),
                'error' => $response->json()
            ]);
            return null;
        } catch (\Exception $e) {
            Log::error('WhatsApp Cloud API - Exception getting media URL', [
                'media_id' => $mediaId,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Descargar media y guardar localmente
     */
    public function downloadMedia(WhatsAppInstance $instance, string $mediaId, string $mimeType = null): ?string
    {
        try {
            // Primero obtener la URL del media
            $mediaUrl = $this->getMediaUrl($instance, $mediaId);
            if (!$mediaUrl) {
                return null;
            }

            // Descargar el archivo
            $response = Http::withToken($instance->cloud_api_token)
                ->timeout(30)
                ->get($mediaUrl);

            if (!$response->successful()) {
                Log::warning('WhatsApp Cloud API - Error downloading media', [
                    'media_id' => $mediaId,
                    'status' => $response->status()
                ]);
                return null;
            }

            // Determinar extensión basada en mime type
            $extension = 'bin';
            if ($mimeType) {
                $extensions = [
                    'image/jpeg' => 'jpg',
                    'image/png' => 'png',
                    'image/webp' => 'webp',
                    'image/gif' => 'gif',
                    'video/mp4' => 'mp4',
                    'video/3gpp' => '3gp',
                    'audio/ogg' => 'ogg',
                    'audio/mpeg' => 'mp3',
                    'audio/aac' => 'aac',
                    'application/pdf' => 'pdf',
                    'application/vnd.ms-excel' => 'xls',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
                    'application/msword' => 'doc',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
                ];
                $extension = $extensions[$mimeType] ?? 'bin';
            }

            // Guardar archivo
            $filename = 'whatsapp-media/' . $mediaId . '.' . $extension;
            \Storage::disk('public')->put($filename, $response->body());

            // Usar URL relativa para que funcione tanto en local como en producción
            return '/storage/' . $filename;
        } catch (\Exception $e) {
            Log::error('WhatsApp Cloud API - Exception downloading media', [
                'media_id' => $mediaId,
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Verificar webhook
     */
    public function verifyWebhook(string $mode, string $token, string $challenge, string $verifyToken): ?string
    {
        if ($mode === 'subscribe' && $token === $verifyToken) {
            return $challenge;
        }
        return null;
    }

    /**
     * Procesar webhook entrante
     */
    public function processWebhook(array $payload): array
    {
        $messages = [];
        $statuses = [];

        if (isset($payload['entry'])) {
            foreach ($payload['entry'] as $entry) {
                if (isset($entry['changes'])) {
                    foreach ($entry['changes'] as $change) {
                        if ($change['field'] === 'messages') {
                            $value = $change['value'];
                            
                            // Procesar mensajes entrantes
                            if (isset($value['messages'])) {
                                foreach ($value['messages'] as $message) {
                                    $messages[] = [
                                        'id' => $message['id'],
                                        'from' => $message['from'],
                                        'timestamp' => $message['timestamp'],
                                        'type' => $message['type'],
                                        'text' => $message['text']['body'] ?? null,
                                        'image' => $message['image'] ?? null,
                                        'document' => $message['document'] ?? null,
                                        'audio' => $message['audio'] ?? null,
                                        'video' => $message['video'] ?? null,
                                        'location' => $message['location'] ?? null,
                                        'contacts' => $message['contacts'] ?? null,
                                        'interactive' => $message['interactive'] ?? null,
                                        'button' => $message['button'] ?? null,
                                        'context' => $message['context'] ?? null,
                                    ];
                                }
                            }

                            // Procesar estados de mensajes
                            if (isset($value['statuses'])) {
                                foreach ($value['statuses'] as $status) {
                                    $statuses[] = [
                                        'id' => $status['id'],
                                        'status' => $status['status'],
                                        'timestamp' => $status['timestamp'],
                                        'recipient_id' => $status['recipient_id'],
                                        'errors' => $status['errors'] ?? null,
                                    ];
                                }
                            }
                        }
                    }
                }
            }
        }

        return [
            'messages' => $messages,
            'statuses' => $statuses
        ];
    }

    /**
     * Enviar mensaje genérico
     */
    private function sendMessage(WhatsAppInstance $instance, array $payload): array
    {
        try {
            if (!$instance->isCloudApi()) {
                return [
                    'success' => false,
                    'error' => 'Instance is not configured for Cloud API'
                ];
            }

            if (!$instance->cloud_api_token || !$instance->cloud_api_phone_id) {
                return [
                    'success' => false,
                    'error' => 'Missing Cloud API credentials'
                ];
            }

            $url = "{$this->baseUrl}/{$this->apiVersion}/{$instance->cloud_api_phone_id}/messages";

            Log::info('WhatsApp Cloud API - Sending message', [
                'instance_id' => $instance->instance_id,
                'to' => $payload['to'] ?? 'N/A',
                'type' => $payload['type'] ?? 'N/A'
            ]);

            $response = Http::withToken($instance->cloud_api_token)
                ->post($url, $payload);

            if ($response->successful()) {
                $data = $response->json();
                
                Log::info('WhatsApp Cloud API - Message sent successfully', [
                    'instance_id' => $instance->instance_id,
                    'message_id' => $data['messages'][0]['id'] ?? 'N/A'
                ]);

                return [
                    'success' => true,
                    'message_id' => $data['messages'][0]['id'] ?? null,
                    'data' => $data
                ];
            }

            $error = $response->json()['error'] ?? ['message' => 'Unknown error'];
            
            Log::error('WhatsApp Cloud API - Failed to send message', [
                'instance_id' => $instance->instance_id,
                'error' => $error
            ]);

            return [
                'success' => false,
                'error' => $error['message'] ?? 'Failed to send message',
                'error_code' => $error['code'] ?? null,
                'error_details' => $error
            ];

        } catch (\Exception $e) {
            Log::error('WhatsApp Cloud API - Exception sending message', [
                'instance_id' => $instance->instance_id,
                'error' => $e->getMessage()
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    // ==========================================
    // MESSAGE TEMPLATES MANAGEMENT (Meta Graph API)
    // ==========================================

    /**
     * Listar plantillas de mensaje del WABA
     */
    public function getMessageTemplates(WhatsAppInstance $instance, ?string $status = null, ?int $limit = 50): array
    {
        try {
            $wabaId = $instance->cloud_api_business_id;
            if (!$wabaId) {
                return ['success' => false, 'error' => 'WABA ID (cloud_api_business_id) no configurado en la instancia'];
            }

            $params = [
                'fields' => 'id,name,status,category,language,components,quality_score,rejected_reason',
                'limit' => $limit,
            ];
            if ($status) {
                $params['status'] = $status;
            }

            $response = Http::withToken($instance->cloud_api_token)
                ->get("{$this->baseUrl}/{$this->apiVersion}/{$wabaId}/message_templates", $params);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'data' => $response->json('data', []),
                    'paging' => $response->json('paging', []),
                ];
            }

            return [
                'success' => false,
                'error' => $response->json('error.message', 'Error al obtener plantillas'),
            ];
        } catch (\Exception $e) {
            Log::error('WhatsApp Cloud API - Error getting templates', ['error' => $e->getMessage()]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Crear una plantilla de mensaje (enviar a revisión de Meta)
     */
    public function createMessageTemplate(WhatsAppInstance $instance, array $templateData): array
    {
        try {
            $wabaId = $instance->cloud_api_business_id;
            if (!$wabaId) {
                return ['success' => false, 'error' => 'WABA ID no configurado'];
            }

            $payload = [
                'name' => $templateData['name'],
                'language' => $templateData['language'] ?? 'es',
                'category' => $templateData['category'] ?? 'MARKETING',
                'components' => $templateData['components'] ?? [],
            ];

            if (!empty($templateData['allow_category_change'])) {
                $payload['allow_category_change'] = true;
            }

            Log::info('WhatsApp Cloud API - Creating template', [
                'waba_id' => $wabaId,
                'name' => $payload['name'],
                'category' => $payload['category'],
            ]);

            $response = Http::withToken($instance->cloud_api_token)
                ->post("{$this->baseUrl}/{$this->apiVersion}/{$wabaId}/message_templates", $payload);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'data' => $response->json(),
                ];
            }

            $error = $response->json('error', []);
            return [
                'success' => false,
                'error' => $error['message'] ?? 'Error al crear plantilla',
                'error_code' => $error['code'] ?? null,
                'error_details' => $error,
            ];
        } catch (\Exception $e) {
            Log::error('WhatsApp Cloud API - Error creating template', ['error' => $e->getMessage()]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Eliminar una plantilla de mensaje
     */
    public function deleteMessageTemplate(WhatsAppInstance $instance, string $templateName): array
    {
        try {
            $wabaId = $instance->cloud_api_business_id;
            if (!$wabaId) {
                return ['success' => false, 'error' => 'WABA ID no configurado'];
            }

            $response = Http::withToken($instance->cloud_api_token)
                ->delete("{$this->baseUrl}/{$this->apiVersion}/{$wabaId}/message_templates", [
                    'name' => $templateName,
                ]);

            if ($response->successful()) {
                return ['success' => true];
            }

            return [
                'success' => false,
                'error' => $response->json('error.message', 'Error al eliminar plantilla'),
            ];
        } catch (\Exception $e) {
            Log::error('WhatsApp Cloud API - Error deleting template', ['error' => $e->getMessage()]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Formatear número de teléfono
     */
    private function formatPhoneNumber(string $phone): string
    {
        // Remover caracteres no numéricos excepto el +
        $phone = preg_replace('/[^0-9+]/', '', $phone);
        
        // Remover el + si existe
        $phone = ltrim($phone, '+');
        
        return $phone;
    }
}
