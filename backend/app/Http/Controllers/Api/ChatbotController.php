<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ChatbotQueryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

/**
 * Controlador para manejar las consultas del chatbot con IA
 */
class ChatbotController extends Controller
{
    protected ChatbotQueryService $queryService;

    public function __construct(ChatbotQueryService $queryService)
    {
        $this->queryService = $queryService;
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
}