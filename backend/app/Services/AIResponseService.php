<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

/**
 * AIResponseService
 * =================
 * Servicio para generar respuestas inteligentes usando DeepSeek, OpenAI o Claude.
 * Usado por el nodo 'ai_response' del chatbot.
 * 
 * Por defecto usa DeepSeek que es más económico y ya está integrado.
 */
class AIResponseService
{
    protected string $provider;
    protected string $deepseekKey;
    protected string $openaiKey;
    protected string $claudeKey;
    protected string $defaultModel;
    protected string $deepseekBaseUrl = 'https://api.deepseek.com/v1';

    public function __construct()
    {
        $this->provider = env('AI_PROVIDER', 'deepseek'); // 'deepseek', 'openai' o 'claude'
        $this->deepseekKey = env('DEEPSEEK_API_KEY', '');
        $this->openaiKey = env('OPENAI_API_KEY', '');
        $this->claudeKey = env('ANTHROPIC_API_KEY', '');
        $this->defaultModel = env('AI_MODEL', 'deepseek-chat');
    }

    /**
     * Generar respuesta de IA basada en contexto y mensaje del usuario
     */
    public function generateResponse(string $userMessage, array $context = [], array $options = []): array
    {
        $systemPrompt = $options['system_prompt'] ?? $this->getDefaultSystemPrompt($context);
        $conversationHistory = $options['conversation_history'] ?? [];
        $model = $options['model'] ?? $this->defaultModel;
        $maxTokens = $options['max_tokens'] ?? 500;
        $temperature = $options['temperature'] ?? 0.7;

        try {
            if ($this->provider === 'deepseek') {
                return $this->generateWithDeepSeek($userMessage, $systemPrompt, $conversationHistory, $model, $maxTokens, $temperature);
            }

            if ($this->provider === 'claude') {
                return $this->generateWithClaude($userMessage, $systemPrompt, $conversationHistory, $model, $maxTokens, $temperature);
            }

            return $this->generateWithOpenAI($userMessage, $systemPrompt, $conversationHistory, $model, $maxTokens, $temperature);
        } catch (\Exception $e) {
            Log::error('[AI SERVICE] Error generating response', [
                'provider' => $this->provider,
                'error' => $e->getMessage()
            ]);

            return [
                'success' => false,
                'error' => $e->getMessage(),
                'response' => null,
            ];
        }
    }

    /**
     * Generar respuesta con DeepSeek
     */
    protected function generateWithDeepSeek(string $userMessage, string $systemPrompt, array $history, string $model, int $maxTokens, float $temperature): array
    {
        if (empty($this->deepseekKey)) {
            return ['success' => false, 'error' => 'DeepSeek API key not configured', 'response' => null];
        }

        $messages = [
            ['role' => 'system', 'content' => $systemPrompt],
        ];

        foreach ($history as $msg) {
            $messages[] = [
                'role' => $msg['role'] ?? 'user',
                'content' => $msg['content'] ?? '',
            ];
        }

        $messages[] = ['role' => 'user', 'content' => $userMessage];

        $response = Http::withHeaders([
            'Authorization' => "Bearer {$this->deepseekKey}",
            'Content-Type' => 'application/json',
        ])->timeout(30)->post("{$this->deepseekBaseUrl}/chat/completions", [
            'model' => $model ?: 'deepseek-chat',
            'messages' => $messages,
            'max_tokens' => $maxTokens,
            'temperature' => $temperature,
        ]);

        if (!$response->successful()) {
            $error = $response->json('error.message') ?? 'DeepSeek API error';
            Log::error('[AI SERVICE] DeepSeek error', ['error' => $error, 'status' => $response->status()]);
            return ['success' => false, 'error' => $error, 'response' => null];
        }

        $data = $response->json();
        $content = $data['choices'][0]['message']['content'] ?? null;

        Log::info('[AI SERVICE] DeepSeek response generated', [
            'model' => $model,
            'tokens' => $data['usage'] ?? null
        ]);

        return [
            'success' => true,
            'response' => $content,
            'usage' => $data['usage'] ?? null,
            'model' => $model ?: 'deepseek-chat',
        ];
    }

    /**
     * Generar respuesta con OpenAI
     */
    protected function generateWithOpenAI(string $userMessage, string $systemPrompt, array $history, string $model, int $maxTokens, float $temperature): array
    {
        if (empty($this->openaiKey)) {
            return ['success' => false, 'error' => 'OpenAI API key not configured', 'response' => null];
        }

        $messages = [
            ['role' => 'system', 'content' => $systemPrompt],
        ];

        foreach ($history as $msg) {
            $messages[] = [
                'role' => $msg['role'] ?? 'user',
                'content' => $msg['content'] ?? '',
            ];
        }

        $messages[] = ['role' => 'user', 'content' => $userMessage];

        $response = Http::withHeaders([
            'Authorization' => "Bearer {$this->openaiKey}",
            'Content-Type' => 'application/json',
        ])->timeout(30)->post('https://api.openai.com/v1/chat/completions', [
            'model' => $model,
            'messages' => $messages,
            'max_tokens' => $maxTokens,
            'temperature' => $temperature,
        ]);

        if (!$response->successful()) {
            $error = $response->json('error.message') ?? 'OpenAI API error';
            Log::error('[AI SERVICE] OpenAI error', ['error' => $error, 'status' => $response->status()]);
            return ['success' => false, 'error' => $error, 'response' => null];
        }

        $data = $response->json();
        $content = $data['choices'][0]['message']['content'] ?? null;

        return [
            'success' => true,
            'response' => $content,
            'usage' => $data['usage'] ?? null,
            'model' => $model,
        ];
    }

    /**
     * Generar respuesta con Claude (Anthropic)
     */
    protected function generateWithClaude(string $userMessage, string $systemPrompt, array $history, string $model, int $maxTokens, float $temperature): array
    {
        if (empty($this->claudeKey)) {
            return ['success' => false, 'error' => 'Anthropic API key not configured', 'response' => null];
        }

        $claudeModel = $this->mapToClaudeModel($model);

        $messages = [];
        foreach ($history as $msg) {
            $messages[] = [
                'role' => $msg['role'] === 'assistant' ? 'assistant' : 'user',
                'content' => $msg['content'] ?? '',
            ];
        }
        $messages[] = ['role' => 'user', 'content' => $userMessage];

        $response = Http::withHeaders([
            'x-api-key' => $this->claudeKey,
            'anthropic-version' => '2023-06-01',
            'Content-Type' => 'application/json',
        ])->timeout(30)->post('https://api.anthropic.com/v1/messages', [
            'model' => $claudeModel,
            'max_tokens' => $maxTokens,
            'system' => $systemPrompt,
            'messages' => $messages,
        ]);

        if (!$response->successful()) {
            $error = $response->json('error.message') ?? 'Claude API error';
            Log::error('[AI SERVICE] Claude error', ['error' => $error, 'status' => $response->status()]);
            return ['success' => false, 'error' => $error, 'response' => null];
        }

        $data = $response->json();
        $content = $data['content'][0]['text'] ?? null;

        return [
            'success' => true,
            'response' => $content,
            'usage' => $data['usage'] ?? null,
            'model' => $claudeModel,
        ];
    }

    /**
     * Mapear modelo genérico a modelo de Claude
     */
    protected function mapToClaudeModel(string $model): string
    {
        $mapping = [
            'gpt-4' => 'claude-3-opus-20240229',
            'gpt-4o' => 'claude-3-5-sonnet-20241022',
            'gpt-4o-mini' => 'claude-3-haiku-20240307',
            'gpt-3.5-turbo' => 'claude-3-haiku-20240307',
        ];

        return $mapping[$model] ?? 'claude-3-haiku-20240307';
    }

    /**
     * Obtener prompt del sistema por defecto
     */
    protected function getDefaultSystemPrompt(array $context): string
    {
        $botName = $context['bot_name'] ?? 'Asistente';
        $companyName = $context['company_name'] ?? 'nuestra empresa';
        $customInstructions = $context['custom_instructions'] ?? '';

        $prompt = "Eres {$botName}, un asistente virtual amigable y profesional de {$companyName}. ";
        $prompt .= "Tu objetivo es ayudar a los clientes de manera eficiente y cordial. ";
        $prompt .= "Responde de forma concisa y clara, en español. ";
        $prompt .= "Si no sabes algo, admítelo honestamente y ofrece transferir a un agente humano. ";
        
        if (!empty($customInstructions)) {
            $prompt .= "\n\nInstrucciones adicionales: {$customInstructions}";
        }

        return $prompt;
    }

    /**
     * Clasificar intención del mensaje
     */
    public function classifyIntent(string $message, array $possibleIntents = []): array
    {
        if (empty($possibleIntents)) {
            $possibleIntents = ['consulta', 'queja', 'cotizacion', 'soporte', 'otro'];
        }

        $prompt = "Clasifica el siguiente mensaje del cliente en una de estas categorías: " . implode(', ', $possibleIntents) . ".\n\n";
        $prompt .= "Mensaje: \"{$message}\"\n\n";
        $prompt .= "Responde SOLO con el nombre de la categoría, sin explicación.";

        $result = $this->generateResponse($prompt, [], [
            'max_tokens' => 50,
            'temperature' => 0.3,
        ]);

        if (!$result['success']) {
            return ['success' => false, 'intent' => 'otro', 'confidence' => 0];
        }

        $intent = strtolower(trim($result['response']));
        
        $matchedIntent = 'otro';
        foreach ($possibleIntents as $possible) {
            if (str_contains($intent, strtolower($possible))) {
                $matchedIntent = $possible;
                break;
            }
        }

        return [
            'success' => true,
            'intent' => $matchedIntent,
            'raw_response' => $result['response'],
            'confidence' => 0.8,
        ];
    }

    /**
     * Extraer datos estructurados de un mensaje
     */
    public function extractData(string $message, array $fieldsToExtract): array
    {
        $fieldsStr = implode(', ', $fieldsToExtract);
        
        $prompt = "Del siguiente mensaje, extrae los siguientes datos si están presentes: {$fieldsStr}.\n\n";
        $prompt .= "Mensaje: \"{$message}\"\n\n";
        $prompt .= "Responde en formato JSON con los campos encontrados. Si un campo no está presente, usa null.";

        $result = $this->generateResponse($prompt, [], [
            'max_tokens' => 200,
            'temperature' => 0.2,
        ]);

        if (!$result['success']) {
            return ['success' => false, 'data' => []];
        }

        try {
            $jsonStr = $result['response'];
            if (preg_match('/\{.*\}/s', $jsonStr, $matches)) {
                $jsonStr = $matches[0];
            }
            $data = json_decode($jsonStr, true);
            
            return [
                'success' => true,
                'data' => $data ?? [],
            ];
        } catch (\Exception $e) {
            return ['success' => false, 'data' => [], 'error' => 'Failed to parse JSON'];
        }
    }

    /**
     * Verificar si el servicio está configurado
     */
    public function isConfigured(): bool
    {
        if ($this->provider === 'deepseek') {
            return !empty($this->deepseekKey);
        }
        if ($this->provider === 'claude') {
            return !empty($this->claudeKey);
        }
        return !empty($this->openaiKey);
    }

    /**
     * Obtener el proveedor actual
     */
    public function getProvider(): string
    {
        return $this->provider;
    }
}
