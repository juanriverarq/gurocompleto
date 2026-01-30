<?php

namespace App\Services;

use App\Models\WhatsAppConversation;
use App\Models\WhatsAppDepartment;
use App\Models\Broker;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppClassificationService
{
    /**
     * Clasificar mensaje usando IA (OpenAI)
     */
    public function classifyWithAI(string $message, int $brokerId): ?array
    {
        $departments = WhatsAppDepartment::where('broker_id', $brokerId)
            ->where('is_active', true)
            ->get(['id', 'name', 'description']);

        if ($departments->isEmpty()) {
            return null;
        }

        $departmentList = $departments->map(function ($d) {
            return "- {$d->name}: {$d->description}";
        })->join("\n");

        $prompt = <<<PROMPT
Eres un asistente de clasificación de mensajes para una empresa de seguros.
Analiza el siguiente mensaje del cliente y clasifícalo en uno de los departamentos disponibles.

Departamentos disponibles:
{$departmentList}

Mensaje del cliente: "{$message}"

Responde SOLO con un JSON válido con este formato:
{
    "department_name": "nombre exacto del departamento",
    "confidence": 0.95,
    "reason": "breve explicación de por qué se clasificó así"
}

Si no puedes clasificar el mensaje con confianza, responde:
{
    "department_name": null,
    "confidence": 0,
    "reason": "No se pudo determinar el departamento"
}
PROMPT;

        try {
            $apiKey = config('services.openai.api_key') ?? env('OPENAI_API_KEY');
            
            if (!$apiKey) {
                Log::warning('OpenAI API key no configurada');
                return null;
            }

            $response = Http::withToken($apiKey)
                ->timeout(10)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => 'gpt-3.5-turbo',
                    'messages' => [
                        ['role' => 'system', 'content' => 'Eres un clasificador de mensajes. Responde solo con JSON válido.'],
                        ['role' => 'user', 'content' => $prompt],
                    ],
                    'temperature' => 0.3,
                    'max_tokens' => 150,
                ]);

            if ($response->successful()) {
                $content = $response->json('choices.0.message.content');
                $result = json_decode($content, true);

                if ($result && isset($result['department_name']) && $result['department_name']) {
                    $department = $departments->firstWhere('name', $result['department_name']);
                    
                    if ($department) {
                        return [
                            'department_id' => $department->id,
                            'department_name' => $department->name,
                            'confidence' => $result['confidence'] ?? 0.5,
                            'reason' => $result['reason'] ?? 'Clasificado por IA',
                            'method' => 'ai',
                        ];
                    }
                }
            }

            return null;

        } catch (\Exception $e) {
            Log::error('Error clasificando con IA', ['error' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Clasificar por palabras clave
     */
    public function classifyByKeywords(string $message, int $brokerId): ?array
    {
        $message = strtolower($message);
        
        $departments = WhatsAppDepartment::where('broker_id', $brokerId)
            ->where('is_active', true)
            ->get();

        foreach ($departments as $department) {
            $rules = $department->auto_assign_rules ?? [];
            $keywords = $rules['keywords'] ?? [];

            foreach ($keywords as $keyword) {
                if (str_contains($message, strtolower($keyword))) {
                    return [
                        'department_id' => $department->id,
                        'department_name' => $department->name,
                        'confidence' => 0.8,
                        'reason' => "Palabra clave detectada: {$keyword}",
                        'method' => 'keyword',
                    ];
                }
            }
        }

        return null;
    }

    /**
     * Generar menú de opciones para el cliente
     */
    public function generateOptionsMenu(int $brokerId): array
    {
        $departments = WhatsAppDepartment::where('broker_id', $brokerId)
            ->where('is_active', true)
            ->orderBy('priority')
            ->get(['id', 'name', 'description', 'icon']);

        $menuText = "¡Hola! 👋 Para atenderte mejor, selecciona una opción:\n\n";
        $options = [];

        foreach ($departments as $index => $department) {
            $number = $index + 1;
            $icon = $department->icon ?? '📌';
            $menuText .= "{$number}. {$icon} {$department->name}\n";
            $options[$number] = [
                'department_id' => $department->id,
                'department_name' => $department->name,
            ];
        }

        $menuText .= "\nResponde con el número de tu opción.";

        return [
            'text' => $menuText,
            'options' => $options,
            'type' => 'menu',
        ];
    }

    /**
     * Procesar respuesta del menú de opciones
     */
    public function processMenuResponse(string $response, array $options): ?array
    {
        $response = trim($response);
        
        // Verificar si es un número
        if (is_numeric($response)) {
            $number = (int) $response;
            if (isset($options[$number])) {
                return [
                    'department_id' => $options[$number]['department_id'],
                    'department_name' => $options[$number]['department_name'],
                    'confidence' => 1.0,
                    'reason' => 'Seleccionado por el cliente',
                    'method' => 'menu_selection',
                ];
            }
        }

        return null;
    }

    /**
     * Clasificar automáticamente una conversación
     */
    public function classifyConversation(WhatsAppConversation $conversation, string $message, string $method = 'auto'): ?array
    {
        $brokerId = $conversation->broker_id;

        // Método automático: primero keywords, luego IA
        if ($method === 'auto' || $method === 'keyword') {
            $result = $this->classifyByKeywords($message, $brokerId);
            if ($result && $result['confidence'] >= 0.7) {
                return $result;
            }
        }

        if ($method === 'auto' || $method === 'ai') {
            $result = $this->classifyWithAI($message, $brokerId);
            if ($result && $result['confidence'] >= 0.7) {
                return $result;
            }
        }

        // Si no se pudo clasificar con confianza, sugerir menú
        return [
            'department_id' => null,
            'confidence' => 0,
            'reason' => 'No se pudo clasificar automáticamente',
            'method' => 'needs_menu',
            'menu' => $this->generateOptionsMenu($brokerId),
        ];
    }

    /**
     * Asignar conversación basado en clasificación
     */
    public function assignBasedOnClassification(WhatsAppConversation $conversation, array $classification): void
    {
        if (!$classification['department_id']) {
            return;
        }

        $department = WhatsAppDepartment::find($classification['department_id']);
        
        if ($department) {
            $reason = $classification['reason'] ?? 'Clasificación automática';
            $conversation->classifyAndAssign($department, $reason);

            Log::info('Conversación clasificada y asignada', [
                'conversation_id' => $conversation->id,
                'department' => $department->name,
                'method' => $classification['method'] ?? 'unknown',
                'confidence' => $classification['confidence'] ?? 0,
            ]);
        }
    }
}
