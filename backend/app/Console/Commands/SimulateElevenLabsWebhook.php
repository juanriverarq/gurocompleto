<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class SimulateElevenLabsWebhook extends Command
{
    protected $signature = 'voice:webhook:simulate {conversation_id} {--status=done}';
    protected $description = 'Simula el webhook de ElevenLabs post-llamada para una conversation_id dada';

    public function handle(): int
    {
        $conversationId = $this->argument('conversation_id');
        $status = $this->option('status');

        $payload = [
            'type' => 'post_call_transcription',
            'data' => [
                'conversation_id' => $conversationId,
                'status' => $status,
                'analysis' => [
                    'call_successful' => 'success',
                    'duration_seconds' => 60,
                    'twilio_minutes' => 1,
                    'eleven_cost_usd' => 0.005,
                    'twilio_cost_usd' => 0.02,
                    'total_cost_usd' => 0.025,
                ],
                'transcript' => [
                    [ 'speaker' => 'agent', 'message' => 'Hola, soy el agente virtual.'],
                    [ 'speaker' => 'user', 'message' => 'Gracias.'],
                ],
                'metadata' => [
                    'notes' => 'Simulado desde CLI',
                ]
            ]
        ];

        $url = url('/api/saas/voice-campaigns/webhooks/elevenlabs');
        $this->info("POST {$url}");

        // Firmar si hay secreto configurado (mismo esquema que el controlador)
        $headers = ['Content-Type' => 'application/json'];
        $secret = env('ELEVENLABS_WEBHOOK_SECRET');
        if ($secret) {
            $timestamp = time();
            $raw = json_encode($payload);
            $signed = $timestamp . '.' . $raw;
            $sig = hash_hmac('sha256', $signed, $secret);
            $headers['elevenlabs-signature'] = 't=' . $timestamp . ',v0=' . $sig;
        }

        $resp = Http::withHeaders($headers)->post($url, $payload);
        $this->info('Status: ' . $resp->status());
        $this->line($resp->body());

        return $resp->ok() ? self::SUCCESS : self::FAILURE;
    }
}


