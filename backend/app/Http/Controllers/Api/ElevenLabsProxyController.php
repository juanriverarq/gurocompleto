<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ElevenLabsProxyController extends Controller
{
    /**
     * Proxy para generar TTS con ElevenLabs desde el backend.
     * Evita exponer la API key en el frontend y resuelve CORS/401.
     */
    public function tts(Request $request, string $voiceId)
    {
        try {
            $apiKey = env('ELEVENLABS_API_KEY');
            if (!$apiKey) {
                return response()->json(['message' => 'ELEVENLABS_API_KEY no configurada'], 500);
            }

            $text = (string) $request->input('text', '');
            if (trim($text) === '') {
                return response()->json(['message' => 'El campo text es requerido'], 422);
            }

            $modelId = (string) $request->input('model_id', 'eleven_multilingual_v2');
            $voiceSettings = (array) $request->input('voice_settings', []);

            // Construir payload compatible con ElevenLabs
            $payload = [
                'text' => $text,
                'model_id' => $modelId,
            ];

            if (!empty($voiceSettings)) {
                $payload['voice_settings'] = [
                    'stability' => $voiceSettings['stability'] ?? 0.4,
                    'similarity_boost' => $voiceSettings['similarity_boost'] ?? ($voiceSettings['similarityBoost'] ?? 0.6),
                    'style' => $voiceSettings['style'] ?? 0.7,
                    'use_speaker_boost' => $voiceSettings['use_speaker_boost'] ?? ($voiceSettings['useSpeakerBoost'] ?? true),
                ];
            }

            $url = 'https://api.elevenlabs.io/v1/text-to-speech/' . urlencode($voiceId);

            $response = Http::withHeaders([
                'xi-api-key' => $apiKey,
                'Accept' => 'audio/mpeg',
                'Content-Type' => 'application/json',
            ])->timeout(30)->post($url, $payload);

            if (!$response->ok()) {
                Log::warning('[ElevenLabs TTS] Error en respuesta', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                // Propagar código de estado original
                return response()->json([
                    'message' => 'Error en API de ElevenLabs',
                    'status' => $response->status(),
                    'detail' => $response->json() ?? $response->body(),
                ], $response->status());
            }

            return response($response->body(), 200)
                ->header('Content-Type', $response->header('Content-Type', 'audio/mpeg'));
        } catch (\Throwable $e) {
            Log::error('[ElevenLabs TTS] Excepción', [
                'error' => $e->getMessage(),
            ]);
            return response()->json(['message' => 'Error interno generando TTS'], 500);
        }
    }
}


