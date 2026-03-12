<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Models\WhatsAppInstance;

/**
 * YCloudWhatsAppService
 * =====================
 * Adapter for YCloud WhatsApp API (https://docs.ycloud.com/reference).
 * Mirrors the same interface as WhatsAppCloudApiService so the rest of Guro
 * (Bridge, Inbox, Campaigns, Chatbot) works transparently.
 *
 * Auth: X-API-Key header with the YCloud API key.
 * Base URL: https://api.ycloud.com/v2
 *
 * To switch back to direct Meta Cloud API, just change the instance's
 * connection_type from 'ycloud' to 'cloud_api' and set the Meta credentials.
 */
class YCloudWhatsAppService
{
    private string $baseUrl = 'https://api.ycloud.com/v2';

    /**
     * Get the YCloud API key from the instance settings or .env fallback.
     */
    private function getApiKey(WhatsAppInstance $instance): string
    {
        // Per-instance key takes priority, then global .env
        return $instance->settings['ycloud_api_key']
            ?? env('YCLOUD_API_KEY', '');
    }

    /**
     * Get the YCloud WABA phone number ID (stored in cloud_api_phone_id).
     * For YCloud, this is the wabaId + phoneNumberId combo.
     */
    private function getPhoneNumberId(WhatsAppInstance $instance): string
    {
        return $instance->cloud_api_phone_id ?? '';
    }

    /**
     * Get the WABA ID.
     */
    private function getWabaId(WhatsAppInstance $instance): string
    {
        return $instance->cloud_api_business_id ?? '';
    }

    /**
     * Build HTTP client with YCloud auth headers.
     */
    private function http(WhatsAppInstance $instance)
    {
        $apiKey = $this->getApiKey($instance);
        if (!$apiKey) {
            throw new \RuntimeException('YCLOUD_API_KEY not configured');
        }

        return Http::withHeaders([
            'X-API-Key' => $apiKey,
            'Content-Type' => 'application/json',
        ])->timeout(30);
    }

    // =========================================================================
    // SEND MESSAGES
    // YCloud endpoint: POST /v2/whatsapp/messages/sendDirectly
    // Docs: https://docs.ycloud.com/reference/whatsapp_message-send-directly
    //
    // YCloud uses its own payload format that wraps the Meta payload.
    // Key fields: from (phone number), to, type, text/image/document/etc.
    // =========================================================================

    /**
     * Send a text message.
     */
    public function sendTextMessage(WhatsAppInstance $instance, string $to, string $message): array
    {
        return $this->sendMessage($instance, [
            'from' => $instance->phone_number,
            'to' => $this->formatPhoneNumber($to),
            'type' => 'text',
            'text' => [
                'body' => $message,
            ],
        ]);
    }

    /**
     * Send a template message.
     */
    public function sendTemplateMessage(WhatsAppInstance $instance, string $to, string $templateName, string $languageCode = 'es', array $components = []): array
    {
        $payload = [
            'from' => $instance->phone_number,
            'to' => $this->formatPhoneNumber($to),
            'type' => 'template',
            'template' => [
                'name' => $templateName,
                'language' => [
                    'code' => $languageCode,
                ],
            ],
        ];

        if (!empty($components)) {
            $payload['template']['components'] = $components;
        }

        return $this->sendMessage($instance, $payload);
    }

    /**
     * Upload a local file to YCloud Media API.
     * POST https://api.ycloud.com/v2/whatsapp/media/upload
     * Returns the media ID that can be used in messages with 'id' instead of 'link'.
     */
    public function uploadMedia(WhatsAppInstance $instance, string $localPath, ?string $mimeType = null): ?string
    {
        try {
            // Resolve local storage path to absolute path
            $absolutePath = null;
            if (str_starts_with($localPath, '/storage/')) {
                $relativePath = str_replace('/storage/', '', $localPath);
                $absolutePath = storage_path('app/public/' . $relativePath);
            } elseif (str_starts_with($localPath, 'whatsapp-media/')) {
                $absolutePath = storage_path('app/public/' . $localPath);
            }

            if (!$absolutePath || !file_exists($absolutePath)) {
                Log::error('[YCloud] Media file not found for upload', ['path' => $localPath, 'absolute' => $absolutePath]);
                return null;
            }

            // Convert webm audio to ogg (WhatsApp doesn't accept video/webm)
            $uploadPath = $absolutePath;
            $uploadFilename = basename($absolutePath);
            $tempFile = null;
            if (str_ends_with(strtolower($absolutePath), '.webm')) {
                $tempFile = sys_get_temp_dir() . '/' . pathinfo($absolutePath, PATHINFO_FILENAME) . '.ogg';
                $cmd = "ffmpeg -y -i " . escapeshellarg($absolutePath) . " -c:a libopus -b:a 48k " . escapeshellarg($tempFile) . " 2>&1";
                $output = shell_exec($cmd);
                if (file_exists($tempFile) && filesize($tempFile) > 0) {
                    $uploadPath = $tempFile;
                    $uploadFilename = basename($tempFile);
                    Log::info('[YCloud] Converted webm to ogg', ['size' => filesize($tempFile)]);
                } else {
                    Log::warning('[YCloud] ffmpeg conversion failed, using original', ['output' => substr($output ?? '', -200)]);
                    $tempFile = null;
                }
            }

            $apiKey = $this->getApiKey($instance);
            $phoneNumberId = $this->getPhoneNumberId($instance);

            $response = Http::withHeaders([
                'X-API-Key' => $apiKey,
            ])->timeout(60)->attach(
                'file',
                file_get_contents($uploadPath),
                $uploadFilename
            )->post("{$this->baseUrl}/whatsapp/media/upload", [
                'phoneNumberId' => $phoneNumberId,
            ]);

            // Cleanup temp file
            if ($tempFile && file_exists($tempFile)) {
                @unlink($tempFile);
            }

            if ($response->successful()) {
                $body = trim($response->body());
                // YCloud returns the media ID as a plain string (not JSON)
                $mediaId = $body ?: null;
                // Try JSON parsing in case format changes
                $json = $response->json();
                if (is_array($json) && isset($json['id'])) {
                    $mediaId = $json['id'];
                }
                Log::info('[YCloud] Media uploaded successfully', ['media_id' => $mediaId, 'path' => $localPath]);
                return $mediaId;
            }

            Log::error('[YCloud] Media upload failed', ['status' => $response->status(), 'body' => $response->body()]);
            return null;
        } catch (\Exception $e) {
            Log::error('[YCloud] Error uploading media', ['error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Resolve media reference: ensure the URL is a live, publicly accessible link.
     * For local/ngrok URLs, auto-detects the current active ngrok tunnel.
     */
    private function resolveMediaRef(WhatsAppInstance $instance, string $url, ?string $storagePath = null): array
    {
        $isLocal = str_contains($url, 'localhost') || str_contains($url, '127.0.0.1') || str_contains($url, 'ngrok');

        if ($isLocal) {
            $url = $this->ensureLivePublicUrl($url);
        }

        return ['link' => $url];
    }

    /**
     * Ensure URL uses the current active ngrok tunnel (auto-detect from ngrok API).
     */
    private function ensureLivePublicUrl(string $url): string
    {
        $path = parse_url($url, PHP_URL_PATH);
        if (!$path) return $url;

        // Try to get current ngrok URL from its local API
        try {
            $response = Http::timeout(2)->get('http://127.0.0.1:4040/api/tunnels');
            if ($response->successful()) {
                $tunnels = $response->json()['tunnels'] ?? [];
                foreach ($tunnels as $tunnel) {
                    if (str_starts_with($tunnel['public_url'] ?? '', 'https://')) {
                        $liveUrl = rtrim($tunnel['public_url'], '/') . $path;
                        Log::info('[YCloud] Using live ngrok URL', ['url' => $liveUrl]);
                        return $liveUrl;
                    }
                }
            }
        } catch (\Exception $e) {
            // ngrok API not available, fall through
        }

        // Fallback: use NGROK_URL from .env
        $ngrokUrl = env('NGROK_URL', '');
        if ($ngrokUrl) {
            return rtrim($ngrokUrl, '/') . $path;
        }

        return $url;
    }

    /**
     * Send an image message.
     */
    public function sendImageMessage(WhatsAppInstance $instance, string $to, string $imageUrl, ?string $caption = null): array
    {
        $imageData = $this->resolveMediaRef($instance, $imageUrl);
        if ($caption) {
            $imageData['caption'] = $caption;
        }

        return $this->sendMessage($instance, [
            'from' => $instance->phone_number,
            'to' => $this->formatPhoneNumber($to),
            'type' => 'image',
            'image' => $imageData,
        ]);
    }

    /**
     * Send a document message.
     */
    public function sendDocumentMessage(WhatsAppInstance $instance, string $to, string $documentUrl, ?string $filename = null, ?string $caption = null): array
    {
        $docData = $this->resolveMediaRef($instance, $documentUrl);
        if ($filename) {
            $docData['filename'] = $filename;
        }
        if ($caption) {
            $docData['caption'] = $caption;
        }

        return $this->sendMessage($instance, [
            'from' => $instance->phone_number,
            'to' => $this->formatPhoneNumber($to),
            'type' => 'document',
            'document' => $docData,
        ]);
    }

    /**
     * Send an audio message.
     */
    public function sendAudio(WhatsAppInstance $instance, string $to, string $audioUrl): array
    {
        $audioData = $this->resolveMediaRef($instance, $audioUrl);

        return $this->sendMessage($instance, [
            'from' => $instance->phone_number,
            'to' => $this->formatPhoneNumber($to),
            'type' => 'audio',
            'audio' => $audioData,
        ]);
    }

    /**
     * Send a video message.
     */
    public function sendVideo(WhatsAppInstance $instance, string $to, string $videoUrl, ?string $caption = null): array
    {
        $videoData = $this->resolveMediaRef($instance, $videoUrl);
        if ($caption) {
            $videoData['caption'] = $caption;
        }

        return $this->sendMessage($instance, [
            'from' => $instance->phone_number,
            'to' => $this->formatPhoneNumber($to),
            'type' => 'video',
            'video' => $videoData,
        ]);
    }

    /**
     * Send interactive button message.
     */
    public function sendButtonMessage(WhatsAppInstance $instance, string $to, string $bodyText, array $buttons, ?string $header = null, ?string $footer = null): array
    {
        $buttonData = array_map(function ($button, $index) {
            return [
                'type' => 'reply',
                'reply' => [
                    'id' => $button['id'] ?? "btn_$index",
                    'title' => substr($button['title'], 0, 20),
                ],
            ];
        }, $buttons, array_keys($buttons));

        $interactive = [
            'type' => 'button',
            'body' => ['text' => $bodyText],
            'action' => ['buttons' => array_slice($buttonData, 0, 3)],
        ];

        if ($header) {
            $interactive['header'] = ['type' => 'text', 'text' => $header];
        }
        if ($footer) {
            $interactive['footer'] = ['text' => $footer];
        }

        return $this->sendMessage($instance, [
            'from' => $instance->phone_number,
            'to' => $this->formatPhoneNumber($to),
            'type' => 'interactive',
            'interactive' => $interactive,
        ]);
    }

    /**
     * Send interactive list message.
     */
    public function sendListMessage(WhatsAppInstance $instance, string $to, string $bodyText, string $buttonText, array $sections): array
    {
        return $this->sendMessage($instance, [
            'from' => $instance->phone_number,
            'to' => $this->formatPhoneNumber($to),
            'type' => 'interactive',
            'interactive' => [
                'type' => 'list',
                'body' => ['text' => $bodyText],
                'action' => [
                    'button' => substr($buttonText, 0, 20),
                    'sections' => $sections,
                ],
            ],
        ]);
    }

    /**
     * Mark a message as read.
     */
    public function markAsRead(WhatsAppInstance $instance, string $messageId): array
    {
        try {
            $response = $this->http($instance)
                ->post("{$this->baseUrl}/whatsapp/inboundMessages/{$messageId}/markAsRead");

            return [
                'success' => $response->successful(),
                'data' => $response->json(),
            ];
        } catch (\Exception $e) {
            Log::error('[YCloud] Error marking message as read', ['error' => $e->getMessage()]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    // =========================================================================
    // TEMPLATES
    // =========================================================================

    /**
     * List message templates.
     */
    public function getMessageTemplates(WhatsAppInstance $instance, ?string $status = null, ?int $limit = 50): array
    {
        try {
            $wabaId = $this->getWabaId($instance);
            if (!$wabaId) {
                return ['success' => false, 'error' => 'WABA ID not configured'];
            }

            $params = [
                'wabaId' => $wabaId,
                'limit' => $limit,
            ];
            if ($status) {
                $params['status'] = $status;
            }

            $response = $this->http($instance)
                ->get("{$this->baseUrl}/whatsapp/templates", $params);

            if ($response->successful()) {
                $data = $response->json();
                // Normalize YCloud response to match Meta format expected by frontend
                $templates = $data['items'] ?? $data['data'] ?? [];
                $templates = array_map(function ($t) {
                    // Map YCloud field names to Meta-compatible names
                    $t['id'] = $t['officialTemplateId'] ?? $t['id'] ?? $t['name'] ?? '';
                    // quality_score: Meta uses {score: 'GREEN'}, YCloud uses qualityRating string
                    $rating = $t['qualityRating'] ?? $t['quality_score']['score'] ?? null;
                    if ($rating && is_string($rating)) {
                        $t['quality_score'] = ['score' => strtoupper($rating)];
                    }
                    // rejected_reason
                    if (!isset($t['rejected_reason']) && isset($t['rejectedReason'])) {
                        $t['rejected_reason'] = $t['rejectedReason'];
                    }
                    return $t;
                }, $templates);
                return [
                    'success' => true,
                    'data' => $templates,
                    'paging' => $data['paging'] ?? [],
                ];
            }

            return [
                'success' => false,
                'error' => $response->json('message', 'Error fetching templates'),
            ];
        } catch (\Exception $e) {
            Log::error('[YCloud] Error getting templates', ['error' => $e->getMessage()]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Create a message template.
     */
    public function createMessageTemplate(WhatsAppInstance $instance, array $templateData): array
    {
        try {
            $wabaId = $this->getWabaId($instance);
            if (!$wabaId) {
                return ['success' => false, 'error' => 'WABA ID not configured'];
            }

            $payload = [
                'wabaId' => $wabaId,
                'name' => $templateData['name'],
                'language' => $templateData['language'] ?? 'es',
                'category' => $templateData['category'] ?? 'MARKETING',
                'components' => $templateData['components'] ?? [],
            ];

            Log::info('[YCloud] Creating template', ['name' => $payload['name'], 'category' => $payload['category']]);

            $response = $this->http($instance)
                ->post("{$this->baseUrl}/whatsapp/templates", $payload);

            if ($response->successful()) {
                $data = $response->json();
                // Normalize: ensure 'id' exists
                $data['id'] = $data['officialTemplateId'] ?? $data['id'] ?? $data['name'] ?? '';
                Log::info('[YCloud] Template created', ['name' => $data['name'] ?? '', 'status' => $data['status'] ?? '']);
                return [
                    'success' => true,
                    'data' => $data,
                ];
            }

            $errorBody = $response->json();
            Log::error('[YCloud] Error creating template', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return [
                'success' => false,
                'error' => $errorBody['message'] ?? 'Error creating template',
                'error_details' => $errorBody,
            ];
        } catch (\Exception $e) {
            Log::error('[YCloud] Error creating template', ['error' => $e->getMessage()]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Delete a message template.
     */
    public function deleteMessageTemplate(WhatsAppInstance $instance, string $templateName): array
    {
        try {
            $wabaId = $this->getWabaId($instance);
            if (!$wabaId) {
                return ['success' => false, 'error' => 'WABA ID not configured'];
            }

            Log::info('[YCloud] Deleting template', ['name' => $templateName, 'wabaId' => $wabaId]);

            $response = $this->http($instance)
                ->delete("{$this->baseUrl}/whatsapp/templates/{$wabaId}/{$templateName}");

            if ($response->successful()) {
                Log::info('[YCloud] Template deleted', ['name' => $templateName]);
                return ['success' => true];
            }

            Log::error('[YCloud] Error deleting template', ['status' => $response->status(), 'body' => $response->body()]);
            return [
                'success' => false,
                'error' => $response->json('message', 'Error deleting template'),
            ];
        } catch (\Exception $e) {
            Log::error('[YCloud] Error deleting template', ['error' => $e->getMessage()]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    // =========================================================================
    // BUSINESS PROFILE
    // =========================================================================

    public function getBusinessProfile(WhatsAppInstance $instance): array
    {
        try {
            $phoneNumberId = $this->getPhoneNumberId($instance);
            $response = $this->http($instance)
                ->get("{$this->baseUrl}/whatsapp/phoneNumbers/{$phoneNumberId}/profile");

            if ($response->successful()) {
                return [
                    'success' => true,
                    'data' => $response->json() ?? [],
                ];
            }

            return [
                'success' => false,
                'error' => $response->json('message', 'Error getting profile'),
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    // =========================================================================
    // MEDIA
    // =========================================================================

    /**
     * Get media URL — YCloud provides direct URLs in webhook payloads,
     * but for uploaded media we may need to retrieve it.
     */
    public function getMediaUrl(WhatsAppInstance $instance, string $mediaId): ?string
    {
        // YCloud webhook payloads already include direct media URLs,
        // so this is mostly a no-op. For completeness, try YCloud's media API.
        try {
            // YCloud media URLs are already accessible directly
            // If the mediaId is already a URL, return it
            if (filter_var($mediaId, FILTER_VALIDATE_URL)) {
                return $mediaId;
            }

            Log::info('[YCloud] Media ID received, returning as-is (YCloud provides direct URLs in webhooks)', [
                'media_id' => $mediaId,
            ]);
            return null;
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Download media — YCloud provides direct URLs that require API key auth.
     */
    public function downloadMedia(WhatsAppInstance $instance, string $mediaId, ?string $mimeType = null): ?string
    {
        try {
            $mediaUrl = $this->getMediaUrl($instance, $mediaId);
            if (!$mediaUrl) {
                Log::warning('[YCloud] downloadMedia: no media URL resolved', ['mediaId' => substr($mediaId, 0, 80)]);
                return null;
            }

            Log::info('[YCloud] Downloading media', ['url' => substr($mediaUrl, 0, 120), 'mimeType' => $mimeType]);

            // YCloud media download URLs require API key authentication
            $apiKey = $this->getApiKey($instance);
            $response = Http::withHeaders([
                'X-API-Key' => $apiKey,
            ])->timeout(30)->get($mediaUrl);

            if (!$response->successful()) {
                Log::warning('[YCloud] Media download failed', ['status' => $response->status(), 'url' => substr($mediaUrl, 0, 120)]);
                return null;
            }

            // Determine extension from mime type (strip codec suffixes like "; codecs=opus")
            $extension = 'bin';
            if ($mimeType) {
                $baseMime = strtolower(explode(';', $mimeType)[0]);
                $baseMime = trim($baseMime);
                $extensions = [
                    'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp',
                    'image/gif' => 'gif', 'video/mp4' => 'mp4', 'video/3gpp' => '3gp',
                    'audio/ogg' => 'ogg', 'audio/mpeg' => 'mp3', 'audio/aac' => 'aac',
                    'audio/amr' => 'amr', 'audio/mp4' => 'm4a',
                    'application/pdf' => 'pdf',
                    'application/vnd.ms-excel' => 'xls',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
                    'application/msword' => 'doc',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
                ];
                $extension = $extensions[$baseMime] ?? 'bin';
            }

            // Upload to Firebase Storage (Google Cloud Storage) instead of local
            $brokerId = $instance->broker_id ?? 0;
            $uniqueId = \Str::random(40);
            $gcsPath = "brokers/{$brokerId}/whatsapp-media/{$uniqueId}.{$extension}";

            try {
                $firebaseStorage = app(\Kreait\Firebase\Contract\Storage::class);
                $bucket = $this->getFirebaseBucket($firebaseStorage);

                $bucket->upload($response->body(), [
                    'name' => $gcsPath,
                    'metadata' => ['contentType' => $mimeType ?: 'application/octet-stream'],
                ]);

                // Generate public URL
                $publicUrl = null;
                try {
                    $object = $bucket->object($gcsPath);
                    $publicUrl = $object->signedUrl(new \DateTimeImmutable('+1 year'), ['version' => 'v4']);
                } catch (\Throwable $e) {
                    $enc = rawurlencode($gcsPath);
                    $bn = $bucket->name();
                    $publicUrl = "https://firebasestorage.googleapis.com/v0/b/{$bn}/o/{$enc}?alt=media";
                }

                Log::info('[YCloud] Media saved to GCS', ['gcsPath' => $gcsPath, 'size' => strlen($response->body())]);
                return $publicUrl;
            } catch (\Throwable $gcsError) {
                // Fallback to local storage if GCS fails
                Log::warning('[YCloud] GCS upload failed, saving locally', ['error' => $gcsError->getMessage()]);
                $filename = 'whatsapp-media/' . $uniqueId . '.' . $extension;
                \Storage::disk('public')->put($filename, $response->body());
                return '/storage/' . $filename;
            }
        } catch (\Exception $e) {
            Log::error('[YCloud] Error downloading media', ['error' => $e->getMessage()]);
            return null;
        }
    }

    // =========================================================================
    // CORE SEND METHOD
    // =========================================================================

    /**
     * Send a message via YCloud API.
     * POST https://api.ycloud.com/v2/whatsapp/messages/sendDirectly
     */
    private function sendMessage(WhatsAppInstance $instance, array $payload): array
    {
        try {
            $url = "{$this->baseUrl}/whatsapp/messages/sendDirectly";

            Log::info('[YCloud] Sending message', [
                'instance_id' => $instance->instance_id,
                'to' => $payload['to'] ?? 'N/A',
                'type' => $payload['type'] ?? 'N/A',
            ]);

            $response = $this->http($instance)->post($url, $payload);

            if ($response->successful()) {
                $data = $response->json();

                Log::info('[YCloud] Message sent successfully', [
                    'instance_id' => $instance->instance_id,
                    'ycloud_message_id' => $data['id'] ?? 'N/A',
                    'wamid' => $data['wamid'] ?? 'N/A',
                ]);

                return [
                    'success' => true,
                    'message_id' => $data['wamid'] ?? $data['id'] ?? null,
                    'data' => $data,
                ];
            }

            $error = $response->json();
            Log::error('[YCloud] Failed to send message', [
                'instance_id' => $instance->instance_id,
                'status' => $response->status(),
                'error' => $error,
            ]);

            return [
                'success' => false,
                'error' => $error['message'] ?? 'Failed to send message via YCloud',
                'error_code' => $error['code'] ?? null,
                'error_details' => $error,
            ];
        } catch (\Exception $e) {
            Log::error('[YCloud] Exception sending message', [
                'instance_id' => $instance->instance_id,
                'error' => $e->getMessage(),
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    // ─────────────────────────────────────────────────────────
    //  CONTACTS
    // ─────────────────────────────────────────────────────────

    /**
     * List contacts from YCloud.
     * GET /v2/contact/contacts?limit=100&offset=0
     */
    public function getContacts(WhatsAppInstance $instance, int $limit = 100, int $offset = 0, ?string $filter = null): array
    {
        try {
            $params = ['limit' => min($limit, 100), 'offset' => $offset];
            if ($filter) {
                $params['filter'] = $filter;
            }

            $response = $this->http($instance)->get("{$this->baseUrl}/contact/contacts", $params);

            if ($response->successful()) {
                return [
                    'success' => true,
                    'data' => $response->json(),
                ];
            }

            return [
                'success' => false,
                'error' => $response->json('message', 'Error fetching contacts'),
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Get a single contact by ID.
     * GET /v2/contact/contacts/{id}
     */
    public function getContact(WhatsAppInstance $instance, string $contactId): array
    {
        try {
            $response = $this->http($instance)->get("{$this->baseUrl}/contact/contacts/{$contactId}");

            if ($response->successful()) {
                return ['success' => true, 'data' => $response->json()];
            }

            return [
                'success' => false,
                'error' => $response->json('message', 'Contact not found'),
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Update a contact.
     * PATCH /v2/contact/contacts/{id}
     */
    public function updateContact(WhatsAppInstance $instance, string $contactId, array $data): array
    {
        try {
            $response = $this->http($instance)->patch("{$this->baseUrl}/contact/contacts/{$contactId}", $data);

            if ($response->successful()) {
                return ['success' => true, 'data' => $response->json()];
            }

            return [
                'success' => false,
                'error' => $response->json('message', 'Error updating contact'),
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Delete a contact.
     * DELETE /v2/contact/contacts/{id}
     */
    public function deleteContact(WhatsAppInstance $instance, string $contactId): array
    {
        try {
            $response = $this->http($instance)->delete("{$this->baseUrl}/contact/contacts/{$contactId}");

            if ($response->successful() || $response->status() === 204) {
                return ['success' => true];
            }

            return [
                'success' => false,
                'error' => $response->json('message', 'Error deleting contact'),
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Get Firebase Storage bucket
     */
    private function getFirebaseBucket($firebaseStorage)
    {
        $bucketName = env('FIREBASE_STORAGE_BUCKET') ?: config('firebase.storage_bucket');
        $projectId = config('firebase.project_id') ?: env('FIREBASE_PROJECT_ID');
        $candidates = array_filter([
            $bucketName,
            $projectId ? ($projectId . '.appspot.com') : null,
            $projectId ? ($projectId . '.firebasestorage.app') : null,
        ]);
        foreach ($candidates as $name) {
            try {
                $b = $firebaseStorage->getBucket($name);
                if (method_exists($b, 'exists') && $b->exists()) return $b;
            } catch (\Throwable $e) {}
        }
        return $firebaseStorage->getBucket();
    }

    /**
     * Format phone number — strip non-numeric except +, remove leading +.
     */
    private function formatPhoneNumber(string $phone): string
    {
        $phone = preg_replace('/[^0-9+]/', '', $phone);
        $phone = ltrim($phone, '+');
        return $phone;
    }
}
