<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ChatbotQueryService;
use App\Services\GuroAssistantService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

/**
 * Controlador para manejar las consultas del chatbot con IA
 */
class ChatbotController extends Controller
{
    protected ChatbotQueryService $queryService;
    protected GuroAssistantService $assistantService;

    public function __construct(ChatbotQueryService $queryService, GuroAssistantService $assistantService)
    {
        $this->queryService = $queryService;
        $this->assistantService = $assistantService;
    }

    /**
     * Endpoint principal del asistente IA Guro
     */
    public function assistant(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'message' => 'required|string|max:1000',
            'conversation_id' => 'nullable|string',
            'context' => 'nullable|array'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $brokerId = $this->getBrokerId($request);

            if (!$brokerId) {
                return response()->json([
                    'success' => false,
                    'error' => 'No se pudo identificar el broker'
                ], 401);
            }

            $message = $request->input('message');
            $context = $request->input('context', []);
            $conversationId = $request->input('conversation_id', uniqid('conv_'));

            Log::info('🤖 [ASSISTANT API] Nueva consulta', [
                'broker_id' => $brokerId,
                'message' => $message,
                'conversation_id' => $conversationId
            ]);

            // Procesar con el modo híbrido (reglas + IA para SQL)
            $result = $this->assistantService->processHybridQuery($message, $brokerId, $context);

            return response()->json([
                'success' => $result['success'],
                'response' => $result['response'] ?? null,
                'data' => $result['data'] ?? null,
                'export' => $result['export'] ?? null,
                'intent' => $result['intent'] ?? null,
                'mode' => $result['mode'] ?? null,
                'conversation_id' => $conversationId,
                'execution_time_ms' => $result['execution_time_ms'] ?? null,
                'timestamp' => now()->toISOString()
            ]);

        } catch (\Exception $e) {
            Log::error('🤖 [ASSISTANT API] Error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error procesando la consulta',
                'message' => config('app.debug') ? $e->getMessage() : 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Procesar una consulta del chatbot
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function query(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'query' => 'required|string|max:500',
            'conversation_id' => 'nullable|string',
            'context' => 'nullable|array'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Obtener el broker_id del usuario autenticado
            $brokerId = $this->getBrokerId($request);

            if (!$brokerId) {
                return response()->json([
                    'success' => false,
                    'error' => 'No se pudo identificar el broker'
                ], 401);
            }

            $query = $request->input('query');
            $context = $request->input('context', []);
            $conversationId = $request->input('conversation_id');

            Log::info('🤖 [CHATBOT API] Nueva consulta recibida', [
                'broker_id' => $brokerId,
                'query' => $query,
                'conversation_id' => $conversationId
            ]);

            // Procesar la consulta
            $result = $this->queryService->processQuery($query, $brokerId, $context);

            return response()->json([
                'success' => true,
                'data' => $result,
                'conversation_id' => $conversationId,
                'timestamp' => now()->toISOString()
            ]);

        } catch (\Exception $e) {
            Log::error('🤖 [CHATBOT API] Error procesando consulta', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error procesando la consulta',
                'message' => config('app.debug') ? $e->getMessage() : 'Error interno del servidor'
            ], 500);
        }
    }

    /**
     * Endpoint específico para consultas de pólizas
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function queryPolizas(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            if (!$brokerId) {
                return response()->json([
                    'success' => false,
                    'error' => 'No se pudo identificar el broker'
                ], 401);
            }

            $filters = $request->only(['ramo', 'status', 'dias_vencimiento']);
            
            $query = "cuántas pólizas";
            if (isset($filters['ramo'])) {
                $query .= " de " . $filters['ramo'];
            }
            if (isset($filters['dias_vencimiento'])) {
                $query .= " próximas a vencer en " . $filters['dias_vencimiento'] . " días";
            }

            $result = $this->queryService->processQuery($query, $brokerId, $filters);

            return response()->json([
                'success' => true,
                'data' => $result
            ]);

        } catch (\Exception $e) {
            Log::error('🤖 [CHATBOT API] Error en queryPolizas', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error consultando pólizas'
            ], 500);
        }
    }

    /**
     * Endpoint específico para consultas de clientes
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function queryClientes(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            if (!$brokerId) {
                return response()->json([
                    'success' => false,
                    'error' => 'No se pudo identificar el broker'
                ], 401);
            }

            $clienteId = $request->input('cliente_id');
            $query = $clienteId 
                ? "pólizas del cliente" 
                : "cuántos clientes tengo";

            $context = $clienteId ? ['cliente_id' => $clienteId] : [];

            $result = $this->queryService->processQuery($query, $brokerId, $context);

            return response()->json([
                'success' => true,
                'data' => $result
            ]);

        } catch (\Exception $e) {
            Log::error('🤖 [CHATBOT API] Error en queryClientes', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error consultando clientes'
            ], 500);
        }
    }

    /**
     * Endpoint para estadísticas generales
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function getEstadisticas(Request $request)
    {
        try {
            $brokerId = $this->getBrokerId($request);

            if (!$brokerId) {
                return response()->json([
                    'success' => false,
                    'error' => 'No se pudo identificar el broker'
                ], 401);
            }

            $result = $this->queryService->processQuery(
                "estadísticas generales", 
                $brokerId, 
                []
            );

            return response()->json([
                'success' => true,
                'data' => $result
            ]);

        } catch (\Exception $e) {
            Log::error('🤖 [CHATBOT API] Error en getEstadisticas', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error obteniendo estadísticas'
            ], 500);
        }
    }

    /**
     * Obtener el broker_id del usuario autenticado
     * 
     * @param Request $request
     * @return int|null
     */
    private function getBrokerId(Request $request): ?int
    {
        // Intentar obtener de diferentes fuentes
        
        // 1. Del request (inyectado por middleware)
        if ($request->has('authenticated_broker_id')) {
            return (int) $request->get('authenticated_broker_id');
        }

        // 2. Del usuario autenticado
        $user = $request->user();
        if ($user && isset($user->broker_id)) {
            return (int) $user->broker_id;
        }

        // 3. Del empleado autenticado
        $empleado = $request->get('authenticated_empleado');
        if ($empleado && isset($empleado->broker_id)) {
            return (int) $empleado->broker_id;
        }

        // 4. Del broker autenticado (middleware global.broker.auth)
        $broker = $request->get('authenticated_broker');
        if ($broker && isset($broker->id)) {
            return (int) $broker->id;
        }

        return null;
    }

    /**
     * Enviar ticket de soporte por email
     */
    public function sendSupportTicket(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'asunto' => 'required|string|max:255',
            'mensaje' => 'required|string|max:5000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $brokerId = $this->getBrokerId($request);
            $user = $request->user();
            
            // Preparar datos del ticket
            $ticketData = [
                'nombre' => $request->input('nombre'),
                'email' => $request->input('email'),
                'asunto' => $request->input('asunto'),
                'mensaje' => $request->input('mensaje'),
                'broker_id' => $brokerId,
                'usuario' => $user ? ($user->name ?? $user->email) : 'No identificado',
                'fecha' => now()->format('d/m/Y H:i:s'),
                'ip' => $request->ip(),
            ];

            // Enviar email
            \Illuminate\Support\Facades\Mail::send([], [], function ($message) use ($ticketData) {
                $message->to('info@gurocontable.com')
                    ->subject('🎫 Ticket de Soporte: ' . $ticketData['asunto'])
                    ->html($this->buildSupportEmailHtml($ticketData));
            });

            Log::info('📧 [SOPORTE] Ticket enviado', $ticketData);

            return response()->json([
                'success' => true,
                'message' => 'Ticket enviado correctamente'
            ]);

        } catch (\Exception $e) {
            Log::error('📧 [SOPORTE] Error enviando ticket', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Error enviando el ticket'
            ], 500);
        }
    }

    /**
     * Construir HTML del email de soporte
     */
    private function buildSupportEmailHtml(array $data): string
    {
        return "
        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
            <div style='background: linear-gradient(135deg, #7c3aed, #ec4899); padding: 20px; border-radius: 10px 10px 0 0;'>
                <h1 style='color: white; margin: 0;'>🎫 Nuevo Ticket de Soporte</h1>
            </div>
            <div style='background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb;'>
                <table style='width: 100%; border-collapse: collapse;'>
                    <tr>
                        <td style='padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; width: 120px;'>Nombre:</td>
                        <td style='padding: 10px; border-bottom: 1px solid #e5e7eb;'>{$data['nombre']}</td>
                    </tr>
                    <tr>
                        <td style='padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;'>Email:</td>
                        <td style='padding: 10px; border-bottom: 1px solid #e5e7eb;'><a href='mailto:{$data['email']}'>{$data['email']}</a></td>
                    </tr>
                    <tr>
                        <td style='padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;'>Asunto:</td>
                        <td style='padding: 10px; border-bottom: 1px solid #e5e7eb;'>{$data['asunto']}</td>
                    </tr>
                    <tr>
                        <td style='padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;'>Broker ID:</td>
                        <td style='padding: 10px; border-bottom: 1px solid #e5e7eb;'>{$data['broker_id']}</td>
                    </tr>
                    <tr>
                        <td style='padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;'>Usuario:</td>
                        <td style='padding: 10px; border-bottom: 1px solid #e5e7eb;'>{$data['usuario']}</td>
                    </tr>
                    <tr>
                        <td style='padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold;'>Fecha:</td>
                        <td style='padding: 10px; border-bottom: 1px solid #e5e7eb;'>{$data['fecha']}</td>
                    </tr>
                </table>
                <div style='margin-top: 20px; padding: 15px; background: white; border-radius: 8px; border: 1px solid #e5e7eb;'>
                    <h3 style='margin-top: 0; color: #374151;'>📝 Mensaje:</h3>
                    <p style='color: #4b5563; line-height: 1.6;'>" . nl2br(htmlspecialchars($data['mensaje'])) . "</p>
                </div>
            </div>
            <div style='background: #1f2937; padding: 15px; border-radius: 0 0 10px 10px; text-align: center;'>
                <p style='color: #9ca3af; margin: 0; font-size: 12px;'>Este ticket fue enviado desde el asistente Sara de Guro</p>
            </div>
        </div>
        ";
    }
}