<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class ElevenLabsClient
{
    private string $baseUrl;
    private ?string $apiKey;

    public function __construct()
    {
        $this->baseUrl = rtrim(env('ELEVENLABS_API_BASE', 'https://api.elevenlabs.io'), '/');
        $this->apiKey = env('ELEVENLABS_API_KEY');
    }

    /**
     * Obtiene detalles de una conversación por ID desde ElevenLabs,
     * con cache por 5 minutos para evitar exceso de llamadas.
     */
    public function getConversationDetails(string $conversationId): ?array
    {
        if (!$this->apiKey) {
            Log::warning('[ElevenLabsClient] API key no configurada');
            return null;
        }

        $cacheKey = 'elevenlabs_conversation_'.$conversationId;

        return Cache::remember($cacheKey, now()->addMinutes(5), function () use ($conversationId) {
            try {
                // Usar endpoint v1 según documentación actual
                $url = $this->baseUrl.'/v1/convai/conversations/'.urlencode($conversationId);

                $response = Http::withHeaders([
                    'xi-api-key' => $this->apiKey,
                    'Accept' => 'application/json',
                ])->timeout(20)->get($url);

                if (!$response->ok()) {
                    Log::warning('[ElevenLabsClient] Error al obtener conversación', [
                        'conversation_id' => $conversationId,
                        'status' => $response->status(),
                        'body' => $response->body(),
                    ]);
                    return null;
                }

                $data = $response->json();
                return is_array($data) ? $data : null;
            } catch (\Throwable $e) {
                Log::error('[ElevenLabsClient] Excepción al obtener conversación', [
                    'conversation_id' => $conversationId,
                    'error' => $e->getMessage(),
                ]);
                return null;
            }
        });
    }
}


