<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WhatsAppInstance;
use App\Models\WhatsAppConversation;
use App\Services\WhatsAppCloudApiService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class WhatsAppTemplateController extends Controller
{
    private WhatsAppCloudApiService $cloudApi;

    public function __construct(WhatsAppCloudApiService $cloudApi)
    {
        $this->cloudApi = $cloudApi;
    }

    /**
     * Obtener la instancia activa del broker
     */
    private function getActiveInstance(Request $request): ?WhatsAppInstance
    {
        $user = $request->user();
        $broker = $user->getPrimaryBroker();

        if (!$broker) return null;

        // Si se especifica instance_id, usar esa
        $instanceId = $request->query('instance_id') ?? $request->input('instance_id');
        if ($instanceId) {
            return WhatsAppInstance::where('broker_id', $broker->id)
                ->where('id', $instanceId)
                ->whereIn('connection_type', ['cloud_api', 'ycloud'])
                ->first();
        }

        // Buscar la primera instancia cloud_api o ycloud activa
        return WhatsAppInstance::where('broker_id', $broker->id)
            ->whereIn('connection_type', ['cloud_api', 'ycloud'])
            ->where('is_active', true)
            ->first();
    }

    /**
     * Listar todas las plantillas de mensaje
     */
    public function index(Request $request): Response
    {
        $instance = $this->getActiveInstance($request);
        if (!$instance) {
            return response([
                'error' => 'No se encontró una instancia de WhatsApp Cloud API activa. Configura una conexión primero.',
            ], 404);
        }

        $status = $request->query('status'); // APPROVED, PENDING, REJECTED
        $result = $this->cloudApi->getMessageTemplates($instance, $status);

        if (!$result['success']) {
            return response(['error' => $result['error']], 400);
        }

        // Enrich templates with parsed info
        $templates = collect($result['data'])->map(function ($template) {
            $template['parsed'] = $this->parseTemplateComponents($template['components'] ?? []);
            return $template;
        });

        // Group by status for stats
        $statusCounts = $templates->groupBy('status')->map->count();

        return response([
            'templates' => $templates->values(),
            'stats' => [
                'total' => $templates->count(),
                'approved' => $statusCounts->get('APPROVED', 0),
                'pending' => $statusCounts->get('PENDING', 0),
                'rejected' => $statusCounts->get('REJECTED', 0),
            ],
            'instance_id' => $instance->id,
        ], 200);
    }

    /**
     * Crear una nueva plantilla (enviar a revisión de Meta)
     */
    public function store(Request $request): Response
    {
        $instance = $this->getActiveInstance($request);
        if (!$instance) {
            return response(['error' => 'No se encontró una instancia de WhatsApp Cloud API activa.'], 404);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:512|regex:/^[a-z0-9_]+$/',
            'category' => 'required|string|in:MARKETING,UTILITY,AUTHENTICATION',
            'language' => 'nullable|string|max:10',
            'header_type' => 'nullable|string|in:NONE,TEXT,IMAGE,VIDEO,DOCUMENT',
            'header_text' => 'nullable|string|max:60',
            'body' => 'required|string|max:1024',
            'footer' => 'nullable|string|max:60',
            'buttons' => 'nullable|array|max:3',
            'buttons.*.type' => 'required_with:buttons|string|in:QUICK_REPLY,URL,PHONE_NUMBER',
            'buttons.*.text' => 'required_with:buttons|string|max:25',
            'buttons.*.url' => 'nullable|string|url',
            'buttons.*.phone_number' => 'nullable|string',
            'example_body_params' => 'nullable|array',
            'example_header_params' => 'nullable|array',
        ]);

        // Build components array for Meta API
        $components = [];

        // Header component
        if (!empty($validated['header_type']) && $validated['header_type'] !== 'NONE') {
            $header = ['type' => 'HEADER'];
            if ($validated['header_type'] === 'TEXT') {
                $header['format'] = 'TEXT';
                $header['text'] = $validated['header_text'] ?? '';
                // Add example for header variables
                if (!empty($validated['example_header_params'])) {
                    $header['example'] = ['header_text' => $validated['example_header_params']];
                }
            } else {
                $header['format'] = $validated['header_type'];
            }
            $components[] = $header;
        }

        // Body component (required)
        $bodyComponent = [
            'type' => 'BODY',
            'text' => $validated['body'],
        ];
        // Add example values for body variables
        if (!empty($validated['example_body_params'])) {
            $bodyComponent['example'] = [
                'body_text' => [$validated['example_body_params']],
            ];
        }
        $components[] = $bodyComponent;

        // Footer component
        if (!empty($validated['footer'])) {
            $components[] = [
                'type' => 'FOOTER',
                'text' => $validated['footer'],
            ];
        }

        // Buttons component
        if (!empty($validated['buttons'])) {
            $buttons = [];
            foreach ($validated['buttons'] as $btn) {
                $buttonData = ['type' => $btn['type'], 'text' => $btn['text']];
                if ($btn['type'] === 'URL' && !empty($btn['url'])) {
                    $buttonData['url'] = $btn['url'];
                }
                if ($btn['type'] === 'PHONE_NUMBER' && !empty($btn['phone_number'])) {
                    $buttonData['phone_number'] = $btn['phone_number'];
                }
                $buttons[] = $buttonData;
            }
            $components[] = [
                'type' => 'BUTTONS',
                'buttons' => $buttons,
            ];
        }

        $result = $this->cloudApi->createMessageTemplate($instance, [
            'name' => $validated['name'],
            'language' => $validated['language'] ?? 'es',
            'category' => $validated['category'],
            'components' => $components,
            'allow_category_change' => true,
        ]);

        if (!$result['success']) {
            return response([
                'error' => $result['error'],
                'details' => $result['error_details'] ?? null,
            ], 400);
        }

        return response([
            'success' => true,
            'data' => $result['data'],
            'message' => 'Plantilla enviada a revisión de Meta. El proceso puede tomar desde minutos hasta 24 horas.',
        ], 201);
    }

    /**
     * Eliminar una plantilla
     */
    public function destroy(Request $request, string $templateName): Response
    {
        $instance = $this->getActiveInstance($request);
        if (!$instance) {
            return response(['error' => 'No se encontró una instancia de WhatsApp Cloud API activa.'], 404);
        }

        $result = $this->cloudApi->deleteMessageTemplate($instance, $templateName);

        if (!$result['success']) {
            return response(['error' => $result['error']], 400);
        }

        return response([
            'success' => true,
            'message' => 'Plantilla eliminada correctamente.',
        ], 200);
    }

    /**
     * Enviar una plantilla a un contacto específico
     */
    public function send(Request $request): Response
    {
        Log::info('📨 [TEMPLATE SEND] Request received', $request->all());

        $instance = $this->getActiveInstance($request);
        if (!$instance) {
            Log::error('📨 [TEMPLATE SEND] No active instance found');
            return response(['error' => 'No se encontró una instancia de WhatsApp Cloud API activa.'], 404);
        }

        Log::info('📨 [TEMPLATE SEND] Using instance', [
            'id' => $instance->id,
            'instance_id' => $instance->instance_id,
            'phone_id' => $instance->cloud_api_phone_id,
            'business_id' => $instance->cloud_api_business_id,
        ]);

        $validated = $request->validate([
            'phone' => 'required|string',
            'template_name' => 'required|string',
            'language' => 'nullable|string|max:10',
            'components' => 'nullable|array',
            'template_body' => 'nullable|string|max:2000',
        ]);

        Log::info('📨 [TEMPLATE SEND] Sending template', [
            'phone' => $validated['phone'],
            'template' => $validated['template_name'],
            'language' => $validated['language'] ?? 'es',
            'components' => $validated['components'] ?? [],
        ]);

        $result = $this->cloudApi->sendTemplateMessage(
            $instance,
            $validated['phone'],
            $validated['template_name'],
            $validated['language'] ?? 'es',
            $validated['components'] ?? []
        );

        Log::info('📨 [TEMPLATE SEND] Result', ['result' => $result]);

        if (!$result['success']) {
            return response([
                'error' => $result['error'],
                'details' => $result['error_details'] ?? null,
            ], 400);
        }

        // Guardar el mensaje de plantilla en la conversación
        $user = $request->user();
        $broker = $user->getPrimaryBroker();
        $savedMessage = null;

        if ($broker) {
            $conversation = WhatsAppConversation::where('broker_id', $broker->id)
                ->where('phone', $validated['phone'])
                ->first();

            if ($conversation) {
                // Usar el body del template enviado desde el frontend, o un fallback
                $templateBody = $validated['template_body'] ?? "[Plantilla: {$validated['template_name']}]";

                $savedMessage = $conversation->addMessage([
                    'message_id' => $result['message_id'],
                    'direction' => 'outgoing',
                    'sender_type' => 'agent',
                    'sender_user_id' => $user->id,
                    'message_type' => 'template',
                    'content' => $templateBody,
                    'status' => 'sent',
                    'metadata' => [
                        'template_name' => $validated['template_name'],
                        'template_language' => $validated['language'] ?? 'es',
                    ],
                ]);

                // Actualizar timestamp de la conversación
                $conversation->touch();

                Log::info('📨 [TEMPLATE SEND] Message saved to conversation', [
                    'conversation_id' => $conversation->id,
                    'message_id' => $savedMessage->id ?? null,
                ]);
            } else {
                Log::warning('📨 [TEMPLATE SEND] No conversation found for phone', ['phone' => $validated['phone']]);
            }
        }

        return response([
            'success' => true,
            'message_id' => $result['message_id'],
            'message' => 'Plantilla enviada correctamente.',
            'data' => $savedMessage,
        ], 200);
    }

    /**
     * Parse template components for frontend display
     */
    private function parseTemplateComponents(array $components): array
    {
        $parsed = [
            'header' => null,
            'body' => null,
            'footer' => null,
            'buttons' => [],
        ];

        foreach ($components as $component) {
            $type = strtolower($component['type'] ?? '');
            switch ($type) {
                case 'header':
                    $parsed['header'] = [
                        'format' => $component['format'] ?? 'TEXT',
                        'text' => $component['text'] ?? null,
                    ];
                    break;
                case 'body':
                    $parsed['body'] = $component['text'] ?? '';
                    break;
                case 'footer':
                    $parsed['footer'] = $component['text'] ?? '';
                    break;
                case 'buttons':
                    $parsed['buttons'] = $component['buttons'] ?? [];
                    break;
            }
        }

        return $parsed;
    }
}
