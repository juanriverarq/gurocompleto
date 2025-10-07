<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TestElevenLabsCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'test:elevenlabs {phone?} {--message=Test message from ElevenLabs integration}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Test ElevenLabs ConvoAI integration for voice calls';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $phone = $this->argument('phone') ?? '+573001234567'; // Número de prueba
        $message = $this->option('message');
        
        $this->info('Testing ElevenLabs ConvoAI Integration');
        $this->info('==================================');
        $this->info("Phone: {$phone}");
        $this->info("Message: {$message}");
        $this->newLine();
        
        // Verificar configuración
        $apiKey = env('ELEVENLABS_API_KEY');
        $agentId = env('ELEVENLABS_AGENT_ID');
        
        if (!$apiKey || !$agentId) {
            $this->error('ElevenLabs configuration is missing!');
            $this->error('Please set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID in your .env file');
            return 1;
        }
        
        $this->info('Configuration:');
        $this->info("API Key: " . substr($apiKey, 0, 8) . '...');
        $this->info("Agent ID: {$agentId}");
        $this->newLine();
        
        // Preparar payload
        $payload = [
            'agent_id' => $agentId,
            'phone_number' => $phone,
            'custom_llm_extra_body' => [
                'system_prompt' => "Eres un asistente virtual amigable que llama en nombre de una compañía de seguros. Tu mensaje principal es: {$message}. Mantén la conversación breve y profesional. Si la persona no está interesada, respeta su decisión y termina la llamada cordialmente.",
                'temperature' => 0.7
            ],
            'metadata' => [
                'test_call' => true,
                'initiated_by' => 'artisan_command',
                'message_content' => $message
            ]
        ];
        
        $this->info('Payload prepared. Making request to ElevenLabs...');
        
        try {
            // Usar el payload correcto para el endpoint de Twilio
            $payload = [
                'agent_id' => $agentId,
                'agent_phone_number_id' => env('ELEVENLABS_PHONE_NUMBER_ID', 'pn_60af9b3f5b4e4f001f0e1e1f'),
                'to_number' => $phone,
                'conversation_initiation_client_data' => [
                    'system_prompt' => "Eres un asistente virtual amigable que llama en nombre de una compañía de seguros. Tu mensaje principal es: {$message}. Mantén la conversación breve y profesional. Si la persona no está interesada, respeta su decisión y termina la llamada cordialmente.",
                    'temperature' => 0.7
                ],
                'metadata' => [
                    'contact_name' => 'Test User',
                    'campaign_type' => 'test_campaign',
                    'message_content' => $message
                ]
            ];
            
            $response = Http::withHeaders([
                'xi-api-key' => $apiKey,
                'Content-Type' => 'application/json'
            ])->timeout(30)->post('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', $payload);
            
            $this->newLine();
            $this->info("Response Status: {$response->status()}");
            
            if ($response->successful()) {
                $responseData = $response->json();
                
                $this->info('✅ Call initiated successfully!');
                $this->info('Response:');
                $this->line(json_encode($responseData, JSON_PRETTY_PRINT));
                
                if (isset($responseData['conversation_id'])) {
                    $this->info("Conversation ID: {$responseData['conversation_id']}");
                }
                
                return 0;
            } else {
                $this->error('❌ Call failed!');
                $this->error("Status: {$response->status()}");
                $this->error("Body: {$response->body()}");
                
                return 1;
            }
            
        } catch (\Exception $e) {
            $this->error('❌ Exception occurred!');
            $this->error($e->getMessage());
            
            Log::error('ElevenLabs test command failed', [
                'error' => $e->getMessage(),
                'phone' => $phone,
                'message' => $message
            ]);
            
            return 1;
        }
    }
}
