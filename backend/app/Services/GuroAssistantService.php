<?php

namespace App\Services;

use App\Models\Poliza;
use App\Models\Cliente;
use App\Models\Siniestro;
use App\Models\SalesFunnel;
use App\Models\Vendedor;
use App\Models\Automovil;
use App\Models\VoiceCampaignCall;
use App\Models\Campaign;
use App\Models\PagoPoliza;
use App\Models\CobroComision;
use App\Models\LiquidacionVendedor;
use App\Models\CommercialTask;
use App\Models\Aseguradora;
use App\Models\Ramo;
use App\Services\DatabaseSchemaContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Carbon\Carbon;

/**
 * Servicio de Asistente IA Guro
 * Procesa consultas en lenguaje natural y las convierte en queries a la BD
 */
class GuroAssistantService
{
    private string $deepseekApiKey;
    private string $deepseekBaseUrl = 'https://api.deepseek.com/v1';
    
    // Definición de funciones disponibles para el asistente
    private array $availableFunctions = [
        'get_polizas_stats' => [
            'description' => 'Obtener estadísticas de pólizas: total, activas, por vencer, por ramo, etc.',
            'parameters' => ['ramo', 'status', 'dias_vencimiento', 'aseguradora']
        ],
        'get_clientes_stats' => [
            'description' => 'Obtener estadísticas de clientes: total, activos, prospectos, etc.',
            'parameters' => ['status', 'ciudad']
        ],
        'search_cliente' => [
            'description' => 'Buscar un cliente específico por nombre, documento o email',
            'parameters' => ['nombre', 'documento', 'email']
        ],
        'get_cliente_polizas' => [
            'description' => 'Obtener todas las pólizas de un cliente específico',
            'parameters' => ['cliente_id', 'cliente_nombre', 'cliente_documento']
        ],
        'get_siniestros_stats' => [
            'description' => 'Obtener estadísticas de siniestros: total, pendientes, aprobados, montos, etc.',
            'parameters' => ['estado', 'tipo']
        ],
        'get_negocios_stats' => [
            'description' => 'Obtener estadísticas del embudo de ventas/negocios: leads, oportunidades, cerrados, etc.',
            'parameters' => ['etapa', 'vendedor']
        ],
        'get_cartera_stats' => [
            'description' => 'Obtener estadísticas de cartera: primas cobradas, pendientes, comisiones, etc.',
            'parameters' => ['periodo', 'estado']
        ],
        'get_vehiculos_stats' => [
            'description' => 'Obtener estadísticas de vehículos asegurados: marcas, modelos, valores, etc.',
            'parameters' => ['marca', 'año']
        ],
        'get_vendedores_stats' => [
            'description' => 'Obtener estadísticas de vendedores: ventas, comisiones, rendimiento, etc.',
            'parameters' => ['vendedor_id', 'periodo']
        ],
        'get_llamadas_stats' => [
            'description' => 'Obtener estadísticas de llamadas de voz: realizadas, exitosas, duración, etc.',
            'parameters' => ['campaña', 'estado', 'periodo']
        ],
        'get_renovaciones' => [
            'description' => 'Obtener pólizas próximas a renovar o vencer',
            'parameters' => ['dias', 'ramo']
        ],
        'get_dashboard_resumen' => [
            'description' => 'Obtener resumen general del dashboard con métricas principales',
            'parameters' => []
        ],
        'search_poliza' => [
            'description' => 'Buscar una póliza específica por número',
            'parameters' => ['numero_poliza']
        ],
        'get_top_clientes' => [
            'description' => 'Obtener los mejores clientes por valor de primas',
            'parameters' => ['limite', 'periodo']
        ],
        'get_tareas_pendientes' => [
            'description' => 'Obtener tareas comerciales pendientes',
            'parameters' => ['tipo', 'prioridad']
        ],
    ];

    // Modo de operación
    private bool $useHybridMode = true; // Usar IA para generar SQL cuando las reglas no matchean

    public function __construct()
    {
        $this->deepseekApiKey = config('services.deepseek.api_key', env('DEEPSEEK_API_KEY', ''));
    }

    /**
     * Procesar consulta en modo híbrido (reglas + IA para SQL)
     */
    public function processHybridQuery(string $query, int $brokerId, array $context = []): array
    {
        $startTime = microtime(true);
        
        Log::info('🤖 [GURO HYBRID] Nueva consulta', [
            'query' => $query,
            'broker_id' => $brokerId,
            'context' => $context
        ]);

        try {
            // 0. Detectar si es un mensaje conversacional (saludo, pregunta personal, etc.)
            $queryLower = mb_strtolower($query);
            $conversationalResponse = $this->handleConversationalMessage($queryLower, $context);
            if ($conversationalResponse) {
                return [
                    'success' => true,
                    'response' => $conversationalResponse,
                    'data' => null,
                    'intent' => ['function' => 'conversational'],
                    'mode' => 'conversational',
                    'execution_time_ms' => round((microtime(true) - $startTime) * 1000)
                ];
            }
            
            // 1. Intentar con reglas rápidas primero
            $intent = $this->quickIntentMatch($queryLower);
            
            // Si hay área forzada, usar esa
            if (!empty($context['force_area']) && !empty($context['area'])) {
                $area = $context['area'];
                if (isset($this->areaToFunction[$area])) {
                    $params = $this->extractParamsForArea($queryLower, $area);
                    $intent = [
                        'function' => $params['_override_function'] ?? $this->areaToFunction[$area],
                        'parameters' => $params,
                        'confidence' => 1.0
                    ];
                    unset($intent['parameters']['_override_function']);
                }
            }
            
            // 2. Si las reglas matchean con alta confianza, usar funciones predefinidas
            if ($intent['function'] !== 'unknown' && $intent['confidence'] >= 0.8) {
                Log::info('🤖 [GURO HYBRID] Usando reglas predefinidas', ['intent' => $intent]);
                $result = $this->executeFunction($intent, $brokerId, $context);
                $response = $this->generateNaturalResponse($query, $intent, $result);
                
                // Preparar datos de exportación si hay listas
                $exportData = $this->prepareRulesExportData($result, $intent['function']);
                
                return [
                    'success' => true,
                    'response' => $response,
                    'data' => $result,
                    'export' => $exportData,
                    'intent' => $intent,
                    'mode' => 'rules',
                    'execution_time_ms' => round((microtime(true) - $startTime) * 1000)
                ];
            }
            
            // 3. Si no hay match o confianza baja, usar IA para generar SQL
            if (!empty($this->deepseekApiKey)) {
                Log::info('🤖 [GURO HYBRID] Usando IA para generar SQL');
                return $this->executeAIGeneratedQuery($query, $brokerId, $startTime, $context);
            }
            
            // 4. Fallback a dashboard si no hay API key
            $result = $this->getDashboardResumen($brokerId);
            return [
                'success' => true,
                'response' => $this->formatDashboardResponse($result),
                'data' => $result,
                'intent' => ['function' => 'fallback'],
                'mode' => 'fallback',
                'execution_time_ms' => round((microtime(true) - $startTime) * 1000)
            ];

        } catch (\Exception $e) {
            Log::error('🤖 [GURO HYBRID] Error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return [
                'success' => false,
                'response' => 'Lo siento, tuve un problema procesando tu consulta. ¿Puedes reformularla?',
                'error' => config('app.debug') ? $e->getMessage() : null
            ];
        }
    }

    /**
     * Ejecutar query generado por IA
     */
    private function executeAIGeneratedQuery(string $userQuery, int $brokerId, float $startTime, array $context = []): array
    {
        try {
            // 1. Generar SQL con DeepSeek (incluyendo historial de conversación)
            $sqlResult = $this->generateSQLWithAI($userQuery, $context);
            
            if (isset($sqlResult['error'])) {
                return [
                    'success' => false,
                    'response' => $this->generateFriendlyErrorResponse($userQuery, 'no_query'),
                    'mode' => 'ai_error'
                ];
            }
            
            $sql = $sqlResult['sql'] ?? null;
            $description = $sqlResult['description'] ?? 'Consulta personalizada';
            
            if (!$sql) {
                return [
                    'success' => false,
                    'response' => $this->generateFriendlyErrorResponse($userQuery, 'unclear'),
                    'mode' => 'ai_no_sql'
                ];
            }
            
            // 2. Validar y sanitizar el SQL
            $validationResult = $this->validateAndSanitizeSQL($sql);
            if (!$validationResult['valid']) {
                Log::warning('🤖 [GURO HYBRID] SQL inválido generado', ['sql' => $sql, 'reason' => $validationResult['reason']]);
                return [
                    'success' => false,
                    'response' => $this->generateFriendlyErrorResponse($userQuery, 'invalid'),
                    'mode' => 'ai_invalid_sql'
                ];
            }
            
            $safeSql = $validationResult['sql'];
            
            // 3. Ejecutar el query con el broker_id
            Log::info('🤖 [GURO HYBRID] Ejecutando SQL', ['sql' => $safeSql, 'broker_id' => $brokerId]);
            
            $results = DB::select($safeSql, [$brokerId]);
            
            // 4. Formatear respuesta
            $formattedResponse = $this->formatAIQueryResponse($userQuery, $description, $results, $safeSql);
            
            // 5. Preparar datos para exportación (traducidos a español)
            $exportData = $this->prepareExportData($results);
            
            return [
                'success' => true,
                'response' => $formattedResponse,
                'data' => [
                    'results' => $results,
                    'count' => count($results),
                    'sql_description' => $description
                ],
                'export' => [
                    'available' => count($results) > 0,
                    'data' => $exportData,
                    'filename' => 'reporte_' . date('Y-m-d_His') . '.xlsx'
                ],
                'intent' => ['function' => 'ai_generated_sql'],
                'mode' => 'ai_sql',
                'execution_time_ms' => round((microtime(true) - $startTime) * 1000)
            ];
            
        } catch (\Exception $e) {
            Log::error('🤖 [GURO HYBRID] Error ejecutando SQL de IA', [
                'error' => $e->getMessage()
            ]);
            
            return [
                'success' => false,
                'response' => $this->generateFriendlyErrorResponse($userQuery, 'execution', $e->getMessage()),
                'error' => config('app.debug') ? $e->getMessage() : null,
                'mode' => 'ai_execution_error'
            ];
        }
    }

    /**
     * Generar SQL usando DeepSeek
     */
    private function generateSQLWithAI(string $userQuery, array $context = []): array
    {
        try {
            $systemPrompt = DatabaseSchemaContext::getSQLGeneratorPrompt();
            
            // Construir mensajes incluyendo historial de conversación
            $messages = [
                ['role' => 'system', 'content' => $systemPrompt]
            ];
            
            // Agregar historial de conversación si existe
            if (!empty($context['history']) && is_array($context['history'])) {
                foreach ($context['history'] as $msg) {
                    if (!empty($msg['content'])) {
                        $role = $msg['role'] === 'user' ? 'user' : 'assistant';
                        $content = $msg['content'];
                        
                        // Si es del asistente y tiene datos, agregar resumen
                        if ($role === 'assistant' && !empty($msg['data'])) {
                            $content .= "\n[Datos de la consulta anterior: " . $msg['data'] . "]";
                        }
                        
                        $messages[] = ['role' => $role, 'content' => $content];
                    }
                }
            }
            
            // Agregar la consulta actual con instrucciones de contexto
            $userPrompt = $this->buildContextAwarePrompt($userQuery, $context);
            $messages[] = ['role' => 'user', 'content' => $userPrompt];
            
            $response = Http::timeout(15)
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $this->deepseekApiKey,
                    'Content-Type' => 'application/json'
                ])
                ->post($this->deepseekBaseUrl . '/chat/completions', [
                    'model' => 'deepseek-chat',
                    'messages' => $messages,
                    'temperature' => 0.1,
                    'max_tokens' => 500
                ]);

            if (!$response->successful()) {
                Log::error('🤖 [GURO HYBRID] Error API DeepSeek', ['status' => $response->status()]);
                return ['error' => 'Error conectando con el servicio de IA'];
            }

            $content = $response->json('choices.0.message.content');
            Log::info('🤖 [GURO HYBRID] Respuesta IA', ['content' => $content]);
            
            // Intentar parsear JSON
            $content = trim($content);
            
            // Limpiar posibles marcadores de código
            if (preg_match('/```json\s*(.*?)\s*```/s', $content, $matches)) {
                $content = $matches[1];
            } elseif (preg_match('/```\s*(.*?)\s*```/s', $content, $matches)) {
                $content = $matches[1];
            }
            
            $parsed = json_decode($content, true);
            
            if (json_last_error() === JSON_ERROR_NONE && $parsed) {
                return $parsed;
            }
            
            // Si no es JSON válido, intentar extraer el SQL directamente
            if (preg_match('/SELECT\s+.+/is', $content, $matches)) {
                return [
                    'sql' => trim($matches[0]),
                    'description' => 'Consulta generada por IA'
                ];
            }
            
            return ['error' => 'No se pudo interpretar la respuesta de la IA'];
            
        } catch (\Exception $e) {
            Log::error('🤖 [GURO HYBRID] Error generando SQL', ['error' => $e->getMessage()]);
            return ['error' => 'Error generando la consulta'];
        }
    }

    /**
     * Construir prompt con contexto de conversación
     */
    private function buildContextAwarePrompt(string $userQuery, array $context): string
    {
        $queryLower = mb_strtolower($userQuery);
        
        // Detectar si es una solicitud de seguimiento
        $followUpPatterns = [
            'más columnas', 'más campos', 'más información', 'más datos', 'más detalles',
            'información completa', 'todos los campos', 'toda la información', 'todo sobre',
            'también', 'además', 'incluye', 'agrega', 'añade',
            'el mismo', 'la misma', 'esos', 'esas', 'estos', 'estas',
            'del anterior', 'de la anterior', 'de eso', 'de esos',
            'puedes traer', 'puedes mostrar', 'muéstrame más'
        ];
        
        $isFollowUp = false;
        foreach ($followUpPatterns as $pattern) {
            if (str_contains($queryLower, $pattern)) {
                $isFollowUp = true;
                break;
            }
        }
        
        // Detectar solicitud de información completa
        $wantsComplete = str_contains($queryLower, 'completa') || 
                         str_contains($queryLower, 'completo') ||
                         str_contains($queryLower, 'todos los') ||
                         str_contains($queryLower, 'toda la') ||
                         str_contains($queryLower, 'todo sobre');
        
        $prompt = "Genera un query SQL para: {$userQuery}";
        
        if ($isFollowUp && !empty($context['history'])) {
            $prompt .= "\n\nNOTA: Esta es una consulta de SEGUIMIENTO. El usuario está pidiendo información adicional o relacionada con la conversación anterior. ";
            $prompt .= "Usa el contexto de los mensajes anteriores para entender qué datos necesita.";
        }
        
        if ($wantsComplete) {
            $prompt .= "\n\nIMPORTANTE: El usuario quiere TODA la información disponible. ";
            $prompt .= "Incluye TODOS los campos relevantes de las tablas consultadas, no solo los básicos. ";
            $prompt .= "Para automóviles: placa, marca, linea, modelo, año, color, clase, cilindraje, motor, chasis, VIN, cliente, póliza, valor asegurado. ";
            $prompt .= "Para clientes: nombre, documento, email, teléfono, celular, dirección, ciudad. ";
            $prompt .= "Para pólizas: número, cliente, aseguradora, tipo, prima, valor asegurado, fechas, estado, vendedor.";
        }
        
        return $prompt;
    }

    /**
     * Validar y sanitizar SQL generado
     * SEGURIDAD CRÍTICA: Garantiza que SOLO se consulten datos del broker autenticado
     */
    private function validateAndSanitizeSQL(string $sql): array
    {
        $sql = trim($sql);
        
        // 1. Solo permitir SELECT
        if (!preg_match('/^\s*SELECT\s/i', $sql)) {
            return ['valid' => false, 'reason' => 'Solo se permiten consultas SELECT'];
        }
        
        // 2. Prohibir operaciones peligrosas
        $forbidden = [
            '/\bDELETE\b/i',
            '/\bUPDATE\b/i',
            '/\bINSERT\b/i',
            '/\bDROP\b/i',
            '/\bALTER\b/i',
            '/\bTRUNCATE\b/i',
            '/\bCREATE\b/i',
            '/\bEXEC\b/i',
            '/\bEXECUTE\b/i',
            '/\bUNION\s+SELECT/i', // Prevenir SQL injection
            '/;\s*SELECT/i', // Múltiples queries
            '/--/', // Comentarios SQL
            '/\/\*/', // Comentarios multilínea
            '/\bINTO\s+OUTFILE\b/i', // Prevenir escritura de archivos
            '/\bLOAD_FILE\b/i', // Prevenir lectura de archivos
            '/\bINFORMATION_SCHEMA\b/i', // Prevenir acceso a metadatos
            '/\bSLEEP\s*\(/i', // Prevenir ataques de tiempo
            '/\bBENCHMARK\s*\(/i', // Prevenir ataques de tiempo
        ];
        
        foreach ($forbidden as $pattern) {
            if (preg_match($pattern, $sql)) {
                Log::warning('🔒 [SEGURIDAD] SQL bloqueado por patrón prohibido', ['sql' => $sql, 'pattern' => $pattern]);
                return ['valid' => false, 'reason' => 'Operación no permitida detectada'];
            }
        }
        
        // 3. SEGURIDAD CRÍTICA: Rechazar si ya tiene un broker_id hardcodeado (posible intento de bypass)
        if (preg_match('/broker_id\s*=\s*\d+/i', $sql)) {
            Log::warning('🔒 [SEGURIDAD] Intento de bypass de broker_id detectado', ['sql' => $sql]);
            return ['valid' => false, 'reason' => 'No se permite especificar broker_id manualmente'];
        }
        
        // 4. Detectar la tabla principal para usar alias correcto en JOINs
        $mainTableAlias = '';
        if (preg_match('/FROM\s+(\w+)\s+(\w+)/i', $sql, $matches)) {
            // Tiene alias (ej: FROM polizas p)
            $mainTableAlias = $matches[2] . '.';
        } elseif (preg_match('/FROM\s+(\w+)/i', $sql, $matches)) {
            // Sin alias, usar nombre de tabla
            $mainTableAlias = $matches[1] . '.';
        }
        
        // 5. OBLIGATORIO: Agregar filtro de broker_id con placeholder
        // Primero, eliminar cualquier placeholder existente para broker_id
        $sql = preg_replace('/\b\w*\.?broker_id\s*=\s*\?(\s+AND)?/i', '', $sql);
        
        // Limpiar posibles espacios dobles o "AND AND"
        $sql = preg_replace('/\s+AND\s+AND\s+/i', ' AND ', $sql);
        $sql = preg_replace('/WHERE\s+AND\s+/i', 'WHERE ', $sql);
        
        // Agregar el filtro de broker_id con el alias correcto
        $brokerFilter = "{$mainTableAlias}broker_id = ?";
        
        if (preg_match('/WHERE/i', $sql)) {
            $sql = preg_replace('/WHERE\s+/i', "WHERE {$brokerFilter} AND ", $sql, 1);
        } else {
            // Si no tiene WHERE, agregarlo antes de GROUP BY, ORDER BY o LIMIT
            if (preg_match('/(GROUP BY|ORDER BY|LIMIT)/i', $sql)) {
                $sql = preg_replace('/(GROUP BY|ORDER BY|LIMIT)/i', "WHERE {$brokerFilter} $1", $sql, 1);
            } else {
                $sql .= " WHERE {$brokerFilter}";
            }
        }
        
        // 6. Limpiar sintaxis corrupta (espacios dobles en alias como "a. a.campo")
        $sql = preg_replace('/(\w+)\.\s+\1\./i', '$1.', $sql);
        
        // 7. Verificar que el placeholder se agregó correctamente
        if (substr_count($sql, '?') !== 1) {
            Log::warning('🔒 [SEGURIDAD] Error en placeholder de broker_id', ['sql' => $sql]);
            return ['valid' => false, 'reason' => 'Error de seguridad en la consulta'];
        }
        
        // 6. Agregar LIMIT si no existe (máximo 500 registros para exportación)
        if (!preg_match('/LIMIT\s+\d+/i', $sql)) {
            $sql = rtrim($sql, ';') . ' LIMIT 500';
        } else {
            // Asegurar que el LIMIT no sea mayor a 500
            $sql = preg_replace_callback('/LIMIT\s+(\d+)/i', function($matches) {
                $limit = min((int)$matches[1], 5000);
                return "LIMIT {$limit}";
            }, $sql);
        }
        
        // 7. Limpiar punto y coma final
        $sql = rtrim($sql, ';');
        
        Log::info('🔒 [SEGURIDAD] SQL validado y sanitizado', ['sql' => $sql]);
        
        return ['valid' => true, 'sql' => $sql];
    }

    /**
     * Formatear respuesta de query generado por IA
     */
    private function formatAIQueryResponse(string $userQuery, string $description, array $results, string $sql): string
    {
        $count = count($results);
        
        if ($count === 0) {
            return "📊 **{$description}**\n\nNo encontré resultados para tu consulta.";
        }
        
        $response = "📊 **{$description}**\n\n";
        
        // Si es un solo resultado con agregaciones (COUNT, SUM, etc.)
        if ($count === 1 && count((array)$results[0]) <= 5) {
            $row = (array)$results[0];
            foreach ($row as $key => $value) {
                $label = $this->humanizeColumnName($key);
                $formattedValue = $this->formatValue($value, $key);
                $response .= "• **{$label}:** {$formattedValue}\n";
            }
            return $response;
        }
        
        // Si son múltiples resultados, mostrar como tabla/lista
        $response .= "**Encontrados:** {$count} registros\n\n";
        
        $maxShow = min($count, 10);
        for ($i = 0; $i < $maxShow; $i++) {
            $row = (array)$results[$i];
            $response .= "**" . ($i + 1) . ".** ";
            
            $parts = [];
            foreach ($row as $key => $value) {
                if ($value !== null && $value !== '') {
                    $label = $this->humanizeColumnName($key);
                    $formattedValue = $this->formatValue($value, $key);
                    $parts[] = "{$label}: {$formattedValue}";
                }
            }
            $response .= implode(' | ', array_slice($parts, 0, 4)) . "\n";
        }
        
        if ($count > $maxShow) {
            $response .= "\n_... y " . ($count - $maxShow) . " más_";
        }
        
        // Agregar opción de exportar si hay resultados
        if ($count > 0) {
            $response .= "\n\n📥 **Exportar:** Usa el botón de exportar para descargar estos datos en Excel.";
        }
        
        return $response;
    }

    /**
     * Humanizar nombre de columna
     */
    private function humanizeColumnName(string $column): string
    {
        $mappings = [
            // Generales
            'id' => 'ID',
            'total' => 'Total',
            'cantidad' => 'Cantidad',
            'count' => 'Cantidad',
            'suma' => 'Suma',
            'sum' => 'Suma',
            'promedio' => 'Promedio',
            'avg' => 'Promedio',
            'created_at' => 'Fecha Creación',
            'updated_at' => 'Fecha Actualización',
            'deleted_at' => 'Fecha Eliminación',
            
            // Pólizas
            'policy_number' => 'Nº Póliza',
            'premium_amount' => 'Prima',
            'prima_total' => 'Prima Total',
            'commission_amount' => 'Comisión',
            'commission_percentage' => '% Comisión',
            'sum_insured' => 'Suma Asegurada',
            'insurance_company' => 'Aseguradora',
            'product_name' => 'Producto',
            'type' => 'Tipo',
            'start_date' => 'Fecha Inicio',
            'end_date' => 'Fecha Vencimiento',
            'issue_date' => 'Fecha Emisión',
            'payment_frequency' => 'Frecuencia Pago',
            'payment_status' => 'Estado Pago',
            'status' => 'Estado',
            'estado' => 'Estado',
            
            // Clientes
            'client_id' => 'ID Cliente',
            'client_name' => 'Cliente',
            'client_document' => 'Documento Cliente',
            'first_name' => 'Nombre',
            'last_name' => 'Apellido',
            'nombre' => 'Nombre',
            'document_number' => 'Documento',
            'document_type' => 'Tipo Documento',
            'email' => 'Correo',
            'phone' => 'Teléfono',
            'mobile_phone' => 'Celular',
            'address' => 'Dirección',
            'city' => 'Ciudad',
            'birth_date' => 'Fecha Nacimiento',
            'gender' => 'Género',
            
            // Siniestros
            'numero_siniestro' => 'Nº Siniestro',
            'tipo_siniestro' => 'Tipo Siniestro',
            'fecha_ocurrencia' => 'Fecha Ocurrencia',
            'fecha_reporte' => 'Fecha Reporte',
            'monto_reclamado' => 'Monto Reclamado',
            'monto_aprobado' => 'Monto Aprobado',
            'monto_pagado' => 'Monto Pagado',
            
            // Vendedores
            'seller_id' => 'ID Vendedor',
            'seller_name' => 'Vendedor',
            'nombres' => 'Nombre',
            'porcentaje_comision' => '% Comisión',
            
            // Vehículos
            'placa' => 'Placa',
            'marca' => 'Marca',
            'modelo' => 'Modelo',
            'ano' => 'Año',
            'color' => 'Color',
            'numero_motor' => 'Nº Motor',
            'numero_chasis' => 'Nº Chasis',
            'valor_comercial' => 'Valor Comercial',
            
            // Cartera
            'comisiones' => 'Comisiones',
            'primas' => 'Primas',
            'polizas' => 'Pólizas',
            'cobrado' => 'Cobrado',
            'pendiente' => 'Pendiente',
            
            // Negocios
            'stage' => 'Etapa',
            'lead_source' => 'Fuente',
            'potential_value' => 'Valor Potencial',
            'expected_close_date' => 'Fecha Cierre Esperada',
        ];
        
        $lower = strtolower($column);
        if (isset($mappings[$lower])) {
            return $mappings[$lower];
        }
        
        // Convertir snake_case a Title Case
        return ucwords(str_replace('_', ' ', $column));
    }

    /**
     * Formatear valor según tipo
     */
    private function formatValue($value, string $column): string
    {
        if ($value === null) return '-';
        
        // Detectar si es un monto
        $moneyColumns = ['prima', 'premium', 'amount', 'monto', 'valor', 'comision', 'total', 'sum', 'cobrado', 'pagado'];
        foreach ($moneyColumns as $keyword) {
            if (stripos($column, $keyword) !== false && is_numeric($value)) {
                return '$' . number_format((float)$value, 0, ',', '.');
            }
        }
        
        // Detectar si es fecha
        if (preg_match('/^\d{4}-\d{2}-\d{2}/', (string)$value)) {
            try {
                return Carbon::parse($value)->format('d/m/Y');
            } catch (\Exception $e) {
                return (string)$value;
            }
        }
        
        return (string)$value;
    }

    /**
     * Preparar datos para exportación a Excel (con columnas en español)
     */
    private function prepareExportData(array $results): array
    {
        if (empty($results)) {
            return ['headers' => [], 'rows' => []];
        }

        // Obtener headers traducidos
        $firstRow = (array)$results[0];
        $headers = [];
        $columnKeys = array_keys($firstRow);
        
        foreach ($columnKeys as $key) {
            $headers[] = $this->humanizeColumnName($key);
        }

        // Preparar filas con valores formateados
        $rows = [];
        foreach ($results as $result) {
            $row = [];
            $resultArray = (array)$result;
            foreach ($columnKeys as $key) {
                $value = $resultArray[$key] ?? null;
                $row[] = $this->formatExportValue($value, $key);
            }
            $rows[] = $row;
        }

        return [
            'headers' => $headers,
            'rows' => $rows,
            'total_rows' => count($rows)
        ];
    }

    /**
     * Preparar datos de exportación para respuestas de reglas
     */
    private function prepareRulesExportData(array $result, string $function): array
    {
        $exportableData = [];
        
        // Detectar arrays exportables en el resultado
        $listKeys = ['clientes', 'polizas', 'renovaciones', 'siniestros', 'vendedores', 'negocios', 'vehiculos', 'llamadas', 'top_clientes'];
        
        foreach ($listKeys as $key) {
            if (!empty($result[$key]) && is_array($result[$key])) {
                $exportableData = $result[$key];
                break;
            }
        }
        
        if (empty($exportableData)) {
            return ['available' => false, 'data' => null, 'filename' => ''];
        }
        
        // Preparar headers y rows
        $firstRow = $exportableData[0];
        $headers = [];
        $columnKeys = array_keys($firstRow);
        
        foreach ($columnKeys as $key) {
            $headers[] = $this->humanizeColumnName($key);
        }
        
        $rows = [];
        foreach ($exportableData as $item) {
            $row = [];
            foreach ($columnKeys as $key) {
                $value = $item[$key] ?? null;
                $row[] = $this->formatExportValue($value, $key);
            }
            $rows[] = $row;
        }
        
        return [
            'available' => count($rows) > 0,
            'data' => [
                'headers' => $headers,
                'rows' => $rows,
                'total_rows' => count($rows)
            ],
            'filename' => 'reporte_' . $function . '_' . date('Y-m-d_His') . '.csv'
        ];
    }

    /**
     * Formatear valor para exportación (sin símbolos de moneda para Excel)
     */
    private function formatExportValue($value, string $column): mixed
    {
        if ($value === null) return '';
        
        // Detectar si es fecha y formatear
        if (preg_match('/^\d{4}-\d{2}-\d{2}/', (string)$value)) {
            try {
                return Carbon::parse($value)->format('d/m/Y');
            } catch (\Exception $e) {
                return (string)$value;
            }
        }
        
        return $value;
    }

    /**
     * Generar respuesta amigable para errores
     */
    private function generateFriendlyErrorResponse(string $userQuery, string $errorType, ?string $technicalError = null): string
    {
        $suggestions = [
            "• \"¿Cuántas pólizas activas tengo?\"",
            "• \"Clientes con pólizas de autos\"",
            "• \"Pólizas que vencen este mes\"",
            "• \"Información del vehículo placa ABC123\"",
            "• \"Top 10 clientes por prima\"",
        ];
        
        $randomSuggestions = array_slice($suggestions, 0, 3);
        $suggestionsText = implode("\n", $randomSuggestions);
        
        switch ($errorType) {
            case 'no_query':
                // Cuando la consulta no es sobre datos
                return "🤔 **No pude procesar tu solicitud**\n\n" .
                       "Tu mensaje \"{$userQuery}\" parece ser una pregunta conversacional o una solicitud que no puedo resolver con los datos disponibles.\n\n" .
                       "**¿Qué puedo hacer por ti?**\n" .
                       "Puedo ayudarte a consultar información de tu negocio como:\n" .
                       "• Pólizas, clientes, vehículos, siniestros\n" .
                       "• Estadísticas y reportes\n" .
                       "• Búsquedas específicas por nombre, placa, número de póliza\n\n" .
                       "**Prueba con algo como:**\n{$suggestionsText}";
                       
            case 'unclear':
                // Cuando no entendió la consulta
                return "🤔 **Necesito más contexto**\n\n" .
                       "No logré entender exactamente qué información necesitas de \"{$userQuery}\".\n\n" .
                       "**Para ayudarte mejor, intenta ser más específico:**\n" .
                       "• Menciona qué tipo de dato buscas (pólizas, clientes, vehículos...)\n" .
                       "• Incluye filtros si los necesitas (por fecha, por cliente, por estado...)\n" .
                       "• Indica qué campos te interesan ver\n\n" .
                       "**Ejemplos que funcionan bien:**\n{$suggestionsText}";
                       
            case 'invalid':
                // Cuando el SQL generado no es válido
                return "⚠️ **No puedo realizar esa consulta**\n\n" .
                       "Por razones de seguridad, algunas consultas no están permitidas.\n\n" .
                       "**Intenta reformular tu pregunta:**\n" .
                       "• Usa términos más simples\n" .
                       "• Divide consultas complejas en varias más pequeñas\n" .
                       "• Especifica exactamente qué datos necesitas\n\n" .
                       "**Ejemplos que puedo procesar:**\n{$suggestionsText}";
                       
            case 'execution':
                // Cuando hubo un error ejecutando la consulta
                $hint = $this->getErrorHint($technicalError);
                return "😅 **Tuve un problema procesando tu consulta**\n\n" .
                       "Entendí lo que necesitas, pero encontré un inconveniente técnico al buscar la información.\n\n" .
                       ($hint ? "**Posible causa:** {$hint}\n\n" : "") .
                       "**¿Qué puedes hacer?**\n" .
                       "• Verifica que los nombres o datos que mencionas existan\n" .
                       "• Intenta con una búsqueda más simple primero\n" .
                       "• Reformula la pregunta de otra manera\n\n" .
                       "**Prueba algo como:**\n{$suggestionsText}";
                       
            default:
                return "🤔 **No pude completar tu solicitud**\n\n" .
                       "Algo salió mal al procesar \"{$userQuery}\".\n\n" .
                       "**Intenta con otra consulta:**\n{$suggestionsText}";
        }
    }
    
    /**
     * Obtener pista del error técnico para el usuario
     */
    private function getErrorHint(?string $error): ?string
    {
        if (!$error) return null;
        
        if (str_contains($error, 'Column not found')) {
            return "Uno de los campos solicitados no existe en la base de datos.";
        }
        if (str_contains($error, 'Table') && str_contains($error, "doesn't exist")) {
            return "La tabla consultada no existe.";
        }
        if (str_contains($error, 'ambiguous')) {
            return "Hay un conflicto en los nombres de campos entre tablas.";
        }
        if (str_contains($error, 'syntax')) {
            return "Hubo un problema con la estructura de la consulta.";
        }
        
        return null;
    }

    /**
     * Manejar mensajes conversacionales usando DeepSeek
     */
    private function handleConversationalMessage(string $query, array $context): ?string
    {
        // Detectar si es un mensaje conversacional (no relacionado con datos)
        $isConversational = $this->isConversationalQuery($query);
        
        if (!$isConversational) {
            return null; // No es conversacional, continuar con consultas de datos
        }
        
        // Usar DeepSeek para respuestas conversacionales naturales
        if (!empty($this->deepseekApiKey)) {
            return $this->generateConversationalResponse($query, $context);
        }
        
        // Fallback si no hay API key
        return "¡Hola! Soy Sara 👋 Tu asistente de Guro. ¿En qué puedo ayudarte con tu negocio de seguros?";
    }
    
    /**
     * Detectar si es una consulta conversacional (no de datos)
     */
    private function isConversationalQuery(string $query): bool
    {
        // Palabras clave que indican consulta de DATOS (no conversacional)
        $dataKeywords = [
            'poliza', 'póliza', 'cliente', 'vehiculo', 'vehículo', 'auto', 'carro',
            'cuantos', 'cuántos', 'cuantas', 'cuántas', 'listado', 'lista', 'mostrar',
            'buscar', 'busca', 'encuentra', 'dame', 'traeme', 'tráeme', 'necesito',
            'siniestro', 'comision', 'comisión', 'cartera', 'vencimiento', 'renovacion',
            'vendedor', 'aseguradora', 'prima', 'placa', 'documento', 'cedula', 'cédula',
            'activas', 'vencidas', 'pendientes', 'total', 'reporte', 'exportar',
            'mes', 'año', 'semana', 'hoy', 'ayer', 'fecha'
        ];
        
        foreach ($dataKeywords as $keyword) {
            if (str_contains($query, $keyword)) {
                return false; // Es una consulta de datos
            }
        }
        
        return true; // Es conversacional
    }
    
    /**
     * Generar respuesta conversacional con DeepSeek
     */
    private function generateConversationalResponse(string $query, array $context): string
    {
        try {
            $systemPrompt = "Eres Sara, una asistente virtual amigable y profesional de Guro, un software de gestión para corredores de seguros en Colombia.

PERSONALIDAD:
- Amable, cálida y profesional
- Usa emojis ocasionalmente pero sin exceso
- Respuestas concisas (2-4 oraciones máximo)
- Habla en español colombiano natural

TU ROL:
- Ayudas a consultar datos del negocio: pólizas, clientes, vehículos, comisiones, etc.
- NO tienes acceso a internet ni información externa
- NO puedes hacer cálculos complejos ni predicciones
- Si preguntan algo fuera de tu alcance, sugiere amablemente qué SÍ puedes hacer

CONTEXTO:
- El usuario es un corredor de seguros usando el sistema Guro
- Puedes ayudarle a consultar información de su base de datos

Responde de forma natural y conversacional. Si el usuario saluda, responde el saludo. Si pregunta cómo estás, responde brevemente y pregunta en qué puedes ayudar.";

            $response = Http::timeout(15)
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $this->deepseekApiKey,
                    'Content-Type' => 'application/json',
                ])
                ->post('https://api.deepseek.com/v1/chat/completions', [
                    'model' => 'deepseek-chat',
                    'messages' => [
                        ['role' => 'system', 'content' => $systemPrompt],
                        ['role' => 'user', 'content' => $query]
                    ],
                    'temperature' => 0.7,
                    'max_tokens' => 200,
                ]);

            if ($response->successful()) {
                $content = $response->json('choices.0.message.content');
                if ($content) {
                    return trim($content);
                }
            }
            
            Log::warning('🤖 [SARA] Error en respuesta conversacional', [
                'status' => $response->status(),
                'body' => $response->body()
            ]);
            
        } catch (\Exception $e) {
            Log::error('🤖 [SARA] Error generando respuesta conversacional', [
                'error' => $e->getMessage()
            ]);
        }
        
        // Fallback
        return "¡Hola! 👋 Soy Sara, tu asistente de Guro. ¿En qué puedo ayudarte hoy?";
    }

    // Mapeo de áreas a funciones
    private array $areaToFunction = [
        'polizas' => 'get_polizas_stats',
        'clientes' => 'get_clientes_stats',
        'siniestros' => 'get_siniestros_stats',
        'cartera' => 'get_cartera_stats',
        'negocios' => 'get_negocios_stats',
        'vendedores' => 'get_vendedores_stats',
        'vehiculos' => 'get_vehiculos_stats',
        'llamadas' => 'get_llamadas_stats',
    ];

    /**
     * Procesar consulta del usuario
     */
    public function processQuery(string $query, int $brokerId, array $context = []): array
    {
        $startTime = microtime(true);
        
        Log::info('🤖 [GURO ASSISTANT] Nueva consulta', [
            'query' => $query,
            'broker_id' => $brokerId,
            'context' => $context
        ]);

        try {
            // 1. Analizar intención - usar área forzada si existe
            $intent = $this->analyzeIntent($query, $context);
            
            // 2. Ejecutar función correspondiente
            $result = $this->executeFunction($intent, $brokerId, $context);
            
            // 3. Generar respuesta natural
            $response = $this->generateNaturalResponse($query, $intent, $result);
            
            $executionTime = round((microtime(true) - $startTime) * 1000);
            
            Log::info('🤖 [GURO ASSISTANT] Consulta procesada', [
                'intent' => $intent,
                'execution_time_ms' => $executionTime
            ]);

            return [
                'success' => true,
                'response' => $response,
                'data' => $result,
                'intent' => $intent,
                'execution_time_ms' => $executionTime
            ];

        } catch (\Exception $e) {
            Log::error('🤖 [GURO ASSISTANT] Error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return [
                'success' => false,
                'response' => 'Lo siento, tuve un problema procesando tu consulta. ¿Puedes reformularla?',
                'error' => config('app.debug') ? $e->getMessage() : null
            ];
        }
    }

    /**
     * Analizar intención usando IA o reglas
     */
    private function analyzeIntent(string $query, array $context = []): array
    {
        $queryLower = mb_strtolower($query);
        
        // Si hay un área forzada en el contexto, usar esa función directamente
        if (!empty($context['force_area']) && !empty($context['area'])) {
            $area = $context['area'];
            if (isset($this->areaToFunction[$area])) {
                Log::info('🤖 [GURO ASSISTANT] Usando área forzada', ['area' => $area]);
                
                // Extraer parámetros de la consulta según el área
                $params = $this->extractParamsForArea($queryLower, $area);
                
                return [
                    'function' => $this->areaToFunction[$area],
                    'parameters' => $params,
                    'confidence' => 1.0,
                    'forced_area' => $area
                ];
            }
        }
        
        // Sistema de reglas rápido (sin llamar a API para consultas comunes)
        $intent = $this->quickIntentMatch($queryLower);
        
        if ($intent['function'] !== 'unknown') {
            return $intent;
        }

        // Si no hay match rápido y tenemos API key, usar IA
        if (!empty($this->deepseekApiKey)) {
            return $this->analyzeIntentWithAI($query);
        }

        // Fallback a respuesta general
        return [
            'function' => 'get_dashboard_resumen',
            'parameters' => [],
            'confidence' => 0.5
        ];
    }
    
    /**
     * Extraer parámetros relevantes según el área seleccionada
     */
    private function extractParamsForArea(string $query, string $area): array
    {
        $params = [];
        
        switch ($area) {
            case 'polizas':
                // Detectar filtros de pólizas
                if (preg_match('/activas?/i', $query)) $params['status'] = 'active';
                if (preg_match('/vencidas?/i', $query)) $params['status'] = 'expired';
                if (preg_match('/canceladas?/i', $query)) $params['status'] = 'cancelled';
                if (preg_match('/auto|vehículo|carro/i', $query)) $params['ramo'] = 'auto';
                if (preg_match('/vida/i', $query)) $params['ramo'] = 'vida';
                if (preg_match('/hogar/i', $query)) $params['ramo'] = 'hogar';
                if (preg_match('/salud/i', $query)) $params['ramo'] = 'salud';
                // Si pregunta por vencimiento, cambiar a renovaciones
                if (preg_match('/vencer|vencen|renovar|próximas?/i', $query)) {
                    $dias = 30;
                    if (preg_match('/(\d+)\s*días?/i', $query, $matches)) {
                        $dias = (int)$matches[1];
                    }
                    return ['dias' => $dias, '_override_function' => 'get_renovaciones'];
                }
                break;
                
            case 'clientes':
                if (preg_match('/activos?/i', $query)) $params['status'] = 'active';
                if (preg_match('/prospectos?/i', $query)) $params['status'] = 'prospect';
                // Buscar nombre específico
                if (preg_match('/(?:de|llamado|nombre)\s+([a-záéíóúñ\s]+)/i', $query, $matches)) {
                    $params['nombre'] = trim($matches[1]);
                    $params['_override_function'] = 'search_cliente';
                }
                break;
                
            case 'siniestros':
                if (preg_match('/pendientes?/i', $query)) $params['estado'] = 'pendiente';
                if (preg_match('/aprobados?/i', $query)) $params['estado'] = 'aprobado';
                if (preg_match('/rechazados?/i', $query)) $params['estado'] = 'rechazado';
                break;
                
            case 'cartera':
                if (preg_match('/cobradas?/i', $query)) $params['estado'] = 'cobrado';
                if (preg_match('/pendientes?/i', $query)) $params['estado'] = 'pendiente';
                break;
                
            case 'vendedores':
                // Buscar nombre de vendedor
                if (preg_match('/(?:vendedor|agente)\s+([a-záéíóúñ\s]+)/i', $query, $matches)) {
                    $params['vendedor_nombre'] = trim($matches[1]);
                }
                break;
        }
        
        return $params;
    }

    /**
     * Match rápido de intención basado en reglas
     */
    private function quickIntentMatch(string $query): array
    {
        // ============================================
        // BÚSQUEDAS ESPECÍFICAS (mayor prioridad)
        // ============================================
        
        // Pólizas de un cliente específico (ej: "pólizas de juan carlos pajon")
        if (preg_match('/pólizas?\s+(?:de|del|para)\s+([a-záéíóúñ\s]{3,})/iu', $query, $matches)) {
            $nombre = trim($matches[1]);
            // Excluir palabras clave que no son nombres
            if (!preg_match('/^(auto|vida|hogar|salud|medellin|bogota|cali|cliente)$/i', $nombre)) {
                return ['function' => 'search_polizas_cliente', 'parameters' => ['cliente_nombre' => $nombre], 'confidence' => 0.9];
            }
        }
        
        // Pólizas por ciudad (ej: "pólizas de medellin", "clientes de bogota")
        if (preg_match('/(?:pólizas?|clientes?)\s+(?:de|en)\s+(medell[ií]n|bogot[aá]|cali|barranquilla|cartagena|bucaramanga|pereira|manizales|santa\s*marta|c[uú]cuta)/iu', $query, $matches)) {
            $ciudad = trim($matches[1]);
            if (preg_match('/pólizas?/i', $query)) {
                return ['function' => 'search_polizas_ciudad', 'parameters' => ['ciudad' => $ciudad], 'confidence' => 0.9];
            } else {
                return ['function' => 'search_clientes_ciudad', 'parameters' => ['ciudad' => $ciudad], 'confidence' => 0.9];
            }
        }
        
        // Cliente con más pólizas (ej: "cliente con más pólizas", "quien tiene más pólizas") - DEBE IR ANTES de search_cliente
        if (preg_match('/cliente[s]?\s+con\s+m[aá]s\s+p[oó]lizas?|qui[eé]n\s+tiene\s+m[aá]s\s+p[oó]lizas?|mayor\s+n[uú]mero\s+de\s+p[oó]lizas?|top\s+cliente|cu[aá]l\s+es\s+el\s+cliente\s+con\s+m[aá]s/iu', $query)) {
            return ['function' => 'get_cliente_mas_polizas', 'parameters' => [], 'confidence' => 0.95];
        }
        
        // Clientes con pólizas de un ramo específico (ej: "clientes con pólizas de autos") - DEBE IR ANTES de search_cliente
        if (preg_match('/clientes?\s+(?:con|que\s+tienen?)\s+p[oó]lizas?\s+(?:de\s+)?(autos?|vida|hogar|salud|empresarial)/iu', $query, $matches)) {
            $ramo = strtolower(trim($matches[1]));
            if ($ramo === 'auto') $ramo = 'autos';
            return ['function' => 'get_clientes_por_ramo', 'parameters' => ['ramo' => $ramo], 'confidence' => 0.95];
        }
        
        // Nombres de clientes con pólizas de X (ej: "nombre de los clientes con pólizas de autos")
        if (preg_match('/nombres?\s+(?:de\s+(?:los\s+)?)?clientes?\s+(?:con\s+)?p[oó]lizas?\s+(?:de\s+)?(autos?|vida|hogar|salud)/iu', $query, $matches)) {
            $ramo = strtolower(trim($matches[1]));
            if ($ramo === 'auto') $ramo = 'autos';
            return ['function' => 'get_clientes_por_ramo', 'parameters' => ['ramo' => $ramo], 'confidence' => 0.95];
        }
        
        // Pólizas por aseguradora (ej: "pólizas de sura", "pólizas de allianz")
        if (preg_match('/pólizas?\s+(?:de|con)\s+(sura|allianz|liberty|mapfre|seguros\s+bolivar|bolivar|axa|colpatria|mundial|previsora|solidaria|equidad)/iu', $query, $matches)) {
            return ['function' => 'search_polizas_aseguradora', 'parameters' => ['aseguradora' => trim($matches[1])], 'confidence' => 0.9];
        }
        
        // Buscar cliente por nombre (ej: "buscar juan perez", "cliente juan carlos") - DESPUÉS de reglas específicas
        if (preg_match('/(?:buscar|encontrar|información\s+de)\s+(?:cliente\s+)?([a-záéíóúñ\s]{3,})/iu', $query, $matches)) {
            $nombre = trim($matches[1]);
            // Excluir palabras clave que no son nombres
            if (!preg_match('/^(póliza|poliza|siniestro|cartera|cliente|con\s+m[aá]s)s?$/i', $nombre)) {
                return ['function' => 'search_cliente', 'parameters' => ['nombre' => $nombre], 'confidence' => 0.85];
            }
        }
        
        // Nombres de clientes (ej: "lista de clientes")
        if (preg_match('/lista\s+(?:de\s+)?clientes?/i', $query)) {
            return ['function' => 'get_lista_clientes', 'parameters' => [], 'confidence' => 0.85];
        }
        
        // ============================================
        // ESTADÍSTICAS GENERALES
        // ============================================
        
        // Patrones para pólizas
        if (preg_match('/cuántas?\s+pólizas?|total\s+de\s+pólizas?|número\s+de\s+pólizas?|tengo\s+.*pólizas?/iu', $query)) {
            $params = [];
            if (preg_match('/auto|vehículo|carro/i', $query)) $params['ramo'] = 'auto';
            if (preg_match('/vida/i', $query)) $params['ramo'] = 'vida';
            if (preg_match('/salud/i', $query)) $params['ramo'] = 'salud';
            if (preg_match('/hogar/i', $query)) $params['ramo'] = 'hogar';
            if (preg_match('/activas?/i', $query)) $params['status'] = 'active';
            if (preg_match('/vencidas?/i', $query)) $params['status'] = 'expired';
            if (preg_match('/canceladas?/i', $query)) $params['status'] = 'cancelled';
            
            return ['function' => 'get_polizas_stats', 'parameters' => $params, 'confidence' => 0.9];
        }

        // Patrones para vencimientos/renovaciones
        if (preg_match('/vencer|vencen|renovar|renovación|próximas?\s+a/iu', $query)) {
            $dias = 30;
            if (preg_match('/(\d+)\s*días?/i', $query, $matches)) {
                $dias = (int)$matches[1];
            }
            return ['function' => 'get_renovaciones', 'parameters' => ['dias' => $dias], 'confidence' => 0.9];
        }

        // Patrones para clientes
        if (preg_match('/cuántos?\s+clientes?|total\s+de\s+clientes?|clientes?\s+tengo/iu', $query)) {
            $params = [];
            if (preg_match('/activos?/i', $query)) $params['status'] = 'active';
            if (preg_match('/nuevos?/i', $query)) $params['nuevos'] = true;
            return ['function' => 'get_clientes_stats', 'parameters' => $params, 'confidence' => 0.9];
        }

        // Patrones para siniestros
        if (preg_match('/siniestros?|reclamos?/i', $query)) {
            $params = [];
            if (preg_match('/pendientes?/i', $query)) $params['estado'] = 'pendiente';
            if (preg_match('/aprobados?/i', $query)) $params['estado'] = 'aprobado';
            return ['function' => 'get_siniestros_stats', 'parameters' => $params, 'confidence' => 0.9];
        }

        // Patrones para negocios/embudo de ventas
        if (preg_match('/negocios?|embudo|ventas|leads?|oportunidades?/i', $query)) {
            return ['function' => 'get_negocios_stats', 'parameters' => [], 'confidence' => 0.85];
        }

        // Patrones para cartera
        if (preg_match('/cartera|cobros?|comisiones?|primas?\s+cobradas?|primas?\s+pendientes?/iu', $query)) {
            return ['function' => 'get_cartera_stats', 'parameters' => [], 'confidence' => 0.9];
        }

        // Patrones para vehículos
        if (preg_match('/vehículos?|autos?\s+asegurados?|carros?/iu', $query)) {
            return ['function' => 'get_vehiculos_stats', 'parameters' => [], 'confidence' => 0.85];
        }

        // Patrones para vendedores
        if (preg_match('/vendedores?|agentes?|asesores?|rendimiento/i', $query)) {
            return ['function' => 'get_vendedores_stats', 'parameters' => [], 'confidence' => 0.85];
        }

        // Patrones para llamadas
        if (preg_match('/llamadas?|llamadas?\s+de\s+voz|campañas?\s+de\s+voz/iu', $query)) {
            return ['function' => 'get_llamadas_stats', 'parameters' => [], 'confidence' => 0.85];
        }

        // Patrones para dashboard/resumen
        if (preg_match('/resumen|dashboard|estadísticas?\s+generales?|cómo\s+está|estado\s+del?\s+negocio/iu', $query)) {
            return ['function' => 'get_dashboard_resumen', 'parameters' => [], 'confidence' => 0.9];
        }

        // Buscar póliza específica
        if (preg_match('/póliza\s+(?:número\s+)?([a-z0-9\-]+)/iu', $query, $matches)) {
            return ['function' => 'search_poliza', 'parameters' => ['numero_poliza' => $matches[1]], 'confidence' => 0.9];
        }

        // Mejores clientes
        if (preg_match('/mejores?\s+clientes?|top\s+clientes?|clientes?\s+más\s+importantes?/iu', $query)) {
            return ['function' => 'get_top_clientes', 'parameters' => ['limite' => 10], 'confidence' => 0.85];
        }

        // Tareas pendientes
        if (preg_match('/tareas?\s+pendientes?|qué\s+tengo\s+que\s+hacer|pendientes?/iu', $query)) {
            return ['function' => 'get_tareas_pendientes', 'parameters' => [], 'confidence' => 0.85];
        }

        return ['function' => 'unknown', 'parameters' => [], 'confidence' => 0];
    }

    /**
     * Analizar intención con IA (DeepSeek)
     */
    private function analyzeIntentWithAI(string $query): array
    {
        $systemPrompt = "Eres un asistente que clasifica consultas de un sistema de seguros. 
Debes identificar qué función llamar basándote en la consulta del usuario.

Funciones disponibles:
- get_polizas_stats: estadísticas de pólizas
- get_clientes_stats: estadísticas de clientes
- search_cliente: buscar cliente específico
- get_cliente_polizas: pólizas de un cliente
- get_siniestros_stats: estadísticas de siniestros
- get_negocios_stats: embudo de ventas
- get_cartera_stats: cartera y cobros
- get_vehiculos_stats: vehículos asegurados
- get_vendedores_stats: rendimiento de vendedores
- get_llamadas_stats: campañas de voz
- get_renovaciones: pólizas por vencer
- get_dashboard_resumen: resumen general
- search_poliza: buscar póliza específica
- get_top_clientes: mejores clientes
- get_tareas_pendientes: tareas pendientes

Responde SOLO con JSON: {\"function\": \"nombre_funcion\", \"parameters\": {}}";

        try {
            $response = Http::timeout(10)
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $this->deepseekApiKey,
                    'Content-Type' => 'application/json'
                ])
                ->post($this->deepseekBaseUrl . '/chat/completions', [
                    'model' => 'deepseek-chat',
                    'messages' => [
                        ['role' => 'system', 'content' => $systemPrompt],
                        ['role' => 'user', 'content' => $query]
                    ],
                    'temperature' => 0.1,
                    'max_tokens' => 200
                ]);

            if ($response->successful()) {
                $content = $response->json('choices.0.message.content');
                $parsed = json_decode($content, true);
                
                if ($parsed && isset($parsed['function'])) {
                    return [
                        'function' => $parsed['function'],
                        'parameters' => $parsed['parameters'] ?? [],
                        'confidence' => 0.85
                    ];
                }
            }
        } catch (\Exception $e) {
            Log::warning('🤖 [GURO ASSISTANT] Error en IA, usando fallback', ['error' => $e->getMessage()]);
        }

        return ['function' => 'get_dashboard_resumen', 'parameters' => [], 'confidence' => 0.5];
    }

    /**
     * Ejecutar función correspondiente
     */
    private function executeFunction(array $intent, int $brokerId, array $context): array
    {
        $function = $intent['function'];
        $params = array_merge($intent['parameters'], $context);
        
        // Si hay un override de función en los parámetros, usarlo
        if (!empty($params['_override_function'])) {
            $function = $params['_override_function'];
            unset($params['_override_function']);
        }

        return match($function) {
            'get_polizas_stats' => $this->getPolizasStats($brokerId, $params),
            'get_clientes_stats' => $this->getClientesStats($brokerId, $params),
            'search_cliente' => $this->searchCliente($brokerId, $params),
            'get_cliente_polizas' => $this->getClientePolizas($brokerId, $params),
            'get_siniestros_stats' => $this->getSiniestrosStats($brokerId, $params),
            'get_negocios_stats' => $this->getNegociosStats($brokerId, $params),
            'get_cartera_stats' => $this->getCarteraStats($brokerId, $params),
            'get_vehiculos_stats' => $this->getVehiculosStats($brokerId, $params),
            'get_vendedores_stats' => $this->getVendedoresStats($brokerId, $params),
            'get_llamadas_stats' => $this->getLlamadasStats($brokerId, $params),
            'get_renovaciones' => $this->getRenovaciones($brokerId, $params),
            'get_dashboard_resumen' => $this->getDashboardResumen($brokerId),
            'search_poliza' => $this->searchPoliza($brokerId, $params),
            'get_top_clientes' => $this->getTopClientes($brokerId, $params),
            'get_tareas_pendientes' => $this->getTareasPendientes($brokerId, $params),
            // Nuevas funciones de búsqueda específica
            'search_polizas_cliente' => $this->searchPolizasCliente($brokerId, $params),
            'search_polizas_ciudad' => $this->searchPolizasCiudad($brokerId, $params),
            'search_clientes_ciudad' => $this->searchClientesCiudad($brokerId, $params),
            'search_polizas_aseguradora' => $this->searchPolizasAseguradora($brokerId, $params),
            'get_cliente_mas_polizas' => $this->getClienteMasPolizas($brokerId, $params),
            'get_clientes_por_ramo' => $this->getClientesPorRamo($brokerId, $params),
            'get_lista_clientes' => $this->getListaClientes($brokerId, $params),
            default => $this->getDashboardResumen($brokerId)
        };
    }

    /**
     * Generar respuesta en lenguaje natural
     */
    private function generateNaturalResponse(string $query, array $intent, array $data): string
    {
        $function = $intent['function'];

        // Respuestas predefinidas optimizadas (sin llamar a IA)
        return match($function) {
            'get_polizas_stats' => $this->formatPolizasResponse($data),
            'get_clientes_stats' => $this->formatClientesResponse($data),
            'search_cliente' => $this->formatSearchClienteResponse($data),
            'get_cliente_polizas' => $this->formatClientePolizasResponse($data),
            'get_siniestros_stats' => $this->formatSiniestrosResponse($data),
            'get_negocios_stats' => $this->formatNegociosResponse($data),
            'get_cartera_stats' => $this->formatCarteraResponse($data),
            'get_vehiculos_stats' => $this->formatVehiculosResponse($data),
            'get_vendedores_stats' => $this->formatVendedoresResponse($data),
            'get_llamadas_stats' => $this->formatLlamadasResponse($data),
            'get_renovaciones' => $this->formatRenovacionesResponse($data),
            'get_dashboard_resumen' => $this->formatDashboardResponse($data),
            // Nuevas funciones de búsqueda
            'search_polizas_cliente' => $this->formatPolizasClienteResponse($data),
            'search_polizas_ciudad' => $this->formatPolizasCiudadResponse($data),
            'search_clientes_ciudad' => $this->formatClientesCiudadResponse($data),
            'search_polizas_aseguradora' => $this->formatPolizasAseguradoraResponse($data),
            'get_cliente_mas_polizas' => $this->formatClienteMasPolizasResponse($data),
            'get_clientes_por_ramo' => $this->formatClientesPorRamoResponse($data),
            'get_lista_clientes' => $this->formatListaClientesResponse($data),
            'search_poliza' => $this->formatSearchPolizaResponse($data),
            'get_top_clientes' => $this->formatTopClientesResponse($data),
            'get_tareas_pendientes' => $this->formatTareasResponse($data),
            default => 'Aquí tienes la información solicitada.'
        };
    }

    // ==================== FUNCIONES DE CONSULTA ====================

    private function getPolizasStats(int $brokerId, array $params): array
    {
        $query = Poliza::where('broker_id', $brokerId);

        if (isset($params['ramo'])) {
            $query->where('type', 'like', '%' . $params['ramo'] . '%');
        }
        if (isset($params['status'])) {
            $query->where('status', $params['status']);
        }
        if (isset($params['aseguradora'])) {
            $query->where('insurance_company', 'like', '%' . $params['aseguradora'] . '%');
        }

        $total = (clone $query)->count();
        $activas = (clone $query)->where('status', 'active')->count();
        $primaTotal = (clone $query)->where('status', 'active')->sum('premium_amount');
        
        $porRamo = Poliza::where('broker_id', $brokerId)
            ->select('type', DB::raw('COUNT(*) as total'), DB::raw('SUM(premium_amount) as prima'))
            ->groupBy('type')
            ->get();

        $porAseguradora = Poliza::where('broker_id', $brokerId)
            ->where('status', 'active')
            ->select('insurance_company', DB::raw('COUNT(*) as total'))
            ->groupBy('insurance_company')
            ->orderByDesc('total')
            ->limit(5)
            ->get();

        return [
            'total' => $total,
            'activas' => $activas,
            'canceladas' => Poliza::where('broker_id', $brokerId)->where('status', 'cancelled')->count(),
            'vencidas' => Poliza::where('broker_id', $brokerId)->where('status', 'expired')->count(),
            'prima_total' => $primaTotal,
            'por_ramo' => $porRamo,
            'por_aseguradora' => $porAseguradora
        ];
    }

    private function getClientesStats(int $brokerId, array $params): array
    {
        $query = Cliente::where('broker_id', $brokerId);

        if (isset($params['status'])) {
            $query->where('status', $params['status']);
        }
        if (isset($params['ciudad'])) {
            $query->where('city', 'like', '%' . $params['ciudad'] . '%');
        }

        $total = (clone $query)->count();
        $activos = Cliente::where('broker_id', $brokerId)->where('status', 'active')->count();
        $prospectos = Cliente::where('broker_id', $brokerId)->where('status', 'prospect')->count();

        $nuevosEsteMes = Cliente::where('broker_id', $brokerId)
            ->whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->count();

        return [
            'total' => $total,
            'activos' => $activos,
            'prospectos' => $prospectos,
            'inactivos' => $total - $activos - $prospectos,
            'nuevos_este_mes' => $nuevosEsteMes
        ];
    }

    private function searchCliente(int $brokerId, array $params): array
    {
        $query = Cliente::where('broker_id', $brokerId);

        if (isset($params['nombre'])) {
            $query->where(function($q) use ($params) {
                $q->where('first_name', 'like', '%' . $params['nombre'] . '%')
                  ->orWhere('last_name', 'like', '%' . $params['nombre'] . '%')
                  ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ['%' . $params['nombre'] . '%']);
            });
        }
        if (isset($params['documento'])) {
            $query->where('document_number', 'like', '%' . $params['documento'] . '%');
        }
        if (isset($params['email'])) {
            $query->where('email', 'like', '%' . $params['email'] . '%');
        }

        $clientes = $query->limit(10)->get(['id', 'first_name', 'last_name', 'document_number', 'email', 'phone', 'status']);

        return [
            'encontrados' => $clientes->count(),
            'clientes' => $clientes->map(fn($c) => [
                'id' => $c->id,
                'nombre' => $c->first_name . ' ' . $c->last_name,
                'documento' => $c->document_number,
                'email' => $c->email,
                'telefono' => $c->phone,
                'estado' => $c->status
            ])->toArray()
        ];
    }

    private function getClientePolizas(int $brokerId, array $params): array
    {
        $clienteId = $params['cliente_id'] ?? null;

        if (!$clienteId && isset($params['cliente_nombre'])) {
            $cliente = Cliente::where('broker_id', $brokerId)
                ->where(function($q) use ($params) {
                    $q->where('first_name', 'like', '%' . $params['cliente_nombre'] . '%')
                      ->orWhere('last_name', 'like', '%' . $params['cliente_nombre'] . '%');
                })
                ->first();
            $clienteId = $cliente?->id;
        }

        if (!$clienteId && isset($params['cliente_documento'])) {
            $cliente = Cliente::where('broker_id', $brokerId)
                ->where('document_number', $params['cliente_documento'])
                ->first();
            $clienteId = $cliente?->id;
        }

        if (!$clienteId) {
            return ['encontrado' => false, 'mensaje' => 'No se encontró el cliente'];
        }

        $cliente = Cliente::find($clienteId);
        $polizas = Poliza::where('broker_id', $brokerId)
            ->where('client_id', $clienteId)
            ->get(['id', 'policy_number', 'type', 'insurance_company', 'status', 'premium_amount', 'start_date', 'end_date']);

        return [
            'encontrado' => true,
            'cliente' => [
                'id' => $cliente->id,
                'nombre' => $cliente->first_name . ' ' . $cliente->last_name,
                'documento' => $cliente->document_number
            ],
            'total_polizas' => $polizas->count(),
            'polizas_activas' => $polizas->where('status', 'active')->count(),
            'prima_total' => $polizas->where('status', 'active')->sum('premium_amount'),
            'polizas' => $polizas->map(fn($p) => [
                'numero' => $p->policy_number,
                'tipo' => $p->type,
                'aseguradora' => $p->insurance_company,
                'estado' => $p->status,
                'prima' => $p->premium_amount,
                'vigencia' => $p->start_date?->format('d/m/Y') . ' - ' . $p->end_date?->format('d/m/Y')
            ])->toArray()
        ];
    }

    private function getSiniestrosStats(int $brokerId, array $params): array
    {
        $query = Siniestro::where('broker_id', $brokerId);

        if (isset($params['estado'])) {
            $query->where('estado', $params['estado']);
        }

        $total = Siniestro::where('broker_id', $brokerId)->count();
        
        $porEstado = Siniestro::where('broker_id', $brokerId)
            ->select('estado', DB::raw('COUNT(*) as total'))
            ->groupBy('estado')
            ->get()
            ->mapWithKeys(fn($item) => [$item->estado => $item->total]);

        $montoReclamado = Siniestro::where('broker_id', $brokerId)->sum('monto_reclamado');
        $montoPagado = Siniestro::where('broker_id', $brokerId)->sum('monto_pagado');

        return [
            'total' => $total,
            'por_estado' => $porEstado->toArray(),
            'pendientes' => $porEstado['reportado'] ?? 0 + ($porEstado['en_revision'] ?? 0),
            'monto_reclamado' => $montoReclamado,
            'monto_pagado' => $montoPagado
        ];
    }

    private function getNegociosStats(int $brokerId, array $params): array
    {
        $total = SalesFunnel::where('broker_id', $brokerId)->count();
        
        $porEtapa = SalesFunnel::where('broker_id', $brokerId)
            ->select('stage', DB::raw('COUNT(*) as total'), DB::raw('SUM(potential_value) as valor'))
            ->groupBy('stage')
            ->get();

        $valorPotencial = SalesFunnel::where('broker_id', $brokerId)
            ->whereNotIn('stage', ['closed_won', 'closed_lost'])
            ->sum('potential_value');

        $cerradosGanados = SalesFunnel::where('broker_id', $brokerId)
            ->where('stage', 'closed_won')
            ->count();

        return [
            'total' => $total,
            'por_etapa' => $porEtapa,
            'valor_potencial' => $valorPotencial,
            'cerrados_ganados' => $cerradosGanados,
            'tasa_conversion' => $total > 0 ? round(($cerradosGanados / $total) * 100, 1) : 0
        ];
    }

    private function getCarteraStats(int $brokerId, array $params): array
    {
        // Primas activas
        $primasActivas = Poliza::where('broker_id', $brokerId)
            ->where('status', 'active')
            ->sum('premium_amount');

        // Pagos recibidos
        $primasCobradas = 0;
        $comisionesCobradas = 0;
        
        if (class_exists(PagoPoliza::class)) {
            $primasCobradas = PagoPoliza::where('broker_id', $brokerId)
                ->where('estado', 'pagado')
                ->sum('monto_pagado');
        }

        if (class_exists(CobroComision::class)) {
            $comisionesCobradas = CobroComision::where('broker_id', $brokerId)
                ->where('estado', 'cobrado')
                ->sum('monto_cobrado');
        }

        $comisionesEsperadas = Poliza::where('broker_id', $brokerId)
            ->where('status', 'active')
            ->sum('commission_amount');

        return [
            'primas_activas' => $primasActivas,
            'primas_cobradas' => $primasCobradas,
            'primas_pendientes' => max(0, $primasActivas - $primasCobradas),
            'comisiones_esperadas' => $comisionesEsperadas,
            'comisiones_cobradas' => $comisionesCobradas,
            'comisiones_pendientes' => max(0, $comisionesEsperadas - $comisionesCobradas)
        ];
    }

    private function getVehiculosStats(int $brokerId, array $params): array
    {
        $total = Automovil::where('broker_id', $brokerId)->count();
        
        $porMarca = Automovil::where('broker_id', $brokerId)
            ->select('marca', DB::raw('COUNT(*) as total'))
            ->groupBy('marca')
            ->orderByDesc('total')
            ->limit(10)
            ->get();

        $valorTotal = Automovil::where('broker_id', $brokerId)->sum('valor_comercial');

        return [
            'total' => $total,
            'por_marca' => $porMarca,
            'valor_total_asegurado' => $valorTotal
        ];
    }

    private function getVendedoresStats(int $brokerId, array $params): array
    {
        $vendedores = Vendedor::where('broker_id', $brokerId)->get();
        
        $stats = [];
        foreach ($vendedores as $vendedor) {
            $polizas = Poliza::where('broker_id', $brokerId)
                ->where('seller_id', $vendedor->id)
                ->where('status', 'active');
            
            $stats[] = [
                'id' => $vendedor->id,
                'nombre' => $vendedor->nombres ?? 'Sin nombre',
                'polizas' => $polizas->count(),
                'prima_total' => $polizas->sum('premium_amount'),
                'comision' => $polizas->sum('commission_amount')
            ];
        }

        // Ordenar por prima total
        usort($stats, fn($a, $b) => $b['prima_total'] <=> $a['prima_total']);

        return [
            'total_vendedores' => count($stats),
            'vendedores' => array_slice($stats, 0, 10)
        ];
    }

    private function getLlamadasStats(int $brokerId, array $params): array
    {
        $total = VoiceCampaignCall::whereHas('execution.campaign', function($q) use ($brokerId) {
            $q->where('broker_id', $brokerId);
        })->count();

        $completadas = VoiceCampaignCall::whereHas('execution.campaign', function($q) use ($brokerId) {
            $q->where('broker_id', $brokerId);
        })->where('status', 'completed')->count();

        $duracionPromedio = VoiceCampaignCall::whereHas('execution.campaign', function($q) use ($brokerId) {
            $q->where('broker_id', $brokerId);
        })->avg('duration_seconds');

        return [
            'total' => $total,
            'completadas' => $completadas,
            'tasa_exito' => $total > 0 ? round(($completadas / $total) * 100, 1) : 0,
            'duracion_promedio_segundos' => round($duracionPromedio ?? 0)
        ];
    }

    private function getRenovaciones(int $brokerId, array $params): array
    {
        $dias = $params['dias'] ?? 30;

        $polizas = Poliza::where('broker_id', $brokerId)
            ->where('status', 'active')
            ->where('end_date', '>=', now())
            ->where('end_date', '<=', now()->addDays($dias))
            ->orderBy('end_date')
            ->limit(500)
            ->get(['id', 'policy_number', 'client_name', 'type', 'insurance_company', 'end_date', 'premium_amount']);

        return [
            'dias' => $dias,
            'total' => $polizas->count(),
            'prima_en_riesgo' => $polizas->sum('premium_amount'),
            'polizas' => $polizas->map(fn($p) => [
                'numero' => $p->policy_number,
                'cliente' => $p->client_name,
                'tipo' => $p->type,
                'aseguradora' => $p->insurance_company,
                'vencimiento' => $p->end_date->format('d/m/Y'),
                'dias_restantes' => now()->diffInDays($p->end_date),
                'prima' => $p->premium_amount
            ])->toArray()
        ];
    }

    private function getDashboardResumen(int $brokerId): array
    {
        return [
            'polizas' => [
                'total' => Poliza::where('broker_id', $brokerId)->count(),
                'activas' => Poliza::where('broker_id', $brokerId)->where('status', 'active')->count(),
                'por_vencer_30_dias' => Poliza::where('broker_id', $brokerId)
                    ->where('status', 'active')
                    ->where('end_date', '>=', now())
                    ->where('end_date', '<=', now()->addDays(30))
                    ->count()
            ],
            'clientes' => [
                'total' => Cliente::where('broker_id', $brokerId)->count(),
                'activos' => Cliente::where('broker_id', $brokerId)->where('status', 'active')->count()
            ],
            'siniestros' => [
                'total' => Siniestro::where('broker_id', $brokerId)->count(),
                'pendientes' => Siniestro::where('broker_id', $brokerId)
                    ->whereIn('estado', ['reportado', 'en_revision', 'asignado'])
                    ->count()
            ],
            'finanzas' => [
                'prima_total' => Poliza::where('broker_id', $brokerId)->where('status', 'active')->sum('premium_amount'),
                'comisiones' => Poliza::where('broker_id', $brokerId)->where('status', 'active')->sum('commission_amount')
            ],
            'negocios' => [
                'activos' => SalesFunnel::where('broker_id', $brokerId)
                    ->whereNotIn('stage', ['closed_won', 'closed_lost'])
                    ->count()
            ]
        ];
    }

    private function searchPoliza(int $brokerId, array $params): array
    {
        $numero = $params['numero_poliza'] ?? '';
        
        $poliza = Poliza::where('broker_id', $brokerId)
            ->where('policy_number', 'like', '%' . $numero . '%')
            ->with('client')
            ->first();

        if (!$poliza) {
            return ['encontrada' => false, 'mensaje' => 'No se encontró la póliza'];
        }

        return [
            'encontrada' => true,
            'poliza' => [
                'numero' => $poliza->policy_number,
                'cliente' => $poliza->client_name,
                'tipo' => $poliza->type,
                'aseguradora' => $poliza->insurance_company,
                'estado' => $poliza->status,
                'prima' => $poliza->premium_amount,
                'suma_asegurada' => $poliza->insured_amount,
                'vigencia' => $poliza->start_date?->format('d/m/Y') . ' - ' . $poliza->end_date?->format('d/m/Y'),
                'dias_restantes' => $poliza->end_date ? now()->diffInDays($poliza->end_date, false) : null
            ]
        ];
    }

    private function getTopClientes(int $brokerId, array $params): array
    {
        $limite = $params['limite'] ?? 10;

        $clientes = Cliente::where('broker_id', $brokerId)
            ->withCount(['policies' => fn($q) => $q->where('status', 'active')])
            ->withSum(['policies' => fn($q) => $q->where('status', 'active')], 'premium_amount')
            ->orderByDesc('policies_sum_premium_amount')
            ->limit($limite)
            ->get();

        return [
            'total' => $clientes->count(),
            'clientes' => $clientes->map(fn($c) => [
                'nombre' => $c->first_name . ' ' . $c->last_name,
                'polizas_activas' => $c->policies_count,
                'prima_total' => $c->policies_sum_premium_amount ?? 0
            ])->toArray()
        ];
    }

    private function getTareasPendientes(int $brokerId, array $params): array
    {
        $tareas = CommercialTask::where('broker_id', $brokerId)
            ->where('status', '!=', 'completed')
            ->orderBy('due_date')
            ->limit(10)
            ->get(['id', 'title', 'type', 'priority', 'due_date', 'status']);

        return [
            'total' => $tareas->count(),
            'tareas' => $tareas->map(fn($t) => [
                'titulo' => $t->title,
                'tipo' => $t->type,
                'prioridad' => $t->priority,
                'fecha_limite' => $t->due_date?->format('d/m/Y'),
                'estado' => $t->status
            ])->toArray()
        ];
    }

    // ==================== FORMATEO DE RESPUESTAS ====================

    private function formatPolizasResponse(array $data): string
    {
        $response = "📊 **Estadísticas de Pólizas**\n\n";
        $response .= "• **Total:** {$data['total']} pólizas\n";
        $response .= "• **Activas:** {$data['activas']}\n";
        $response .= "• **Canceladas:** {$data['canceladas']}\n";
        $response .= "• **Vencidas:** {$data['vencidas']}\n";
        $response .= "• **Prima Total:** $" . number_format($data['prima_total'], 0, ',', '.') . "\n";
        
        if (!empty($data['por_ramo'])) {
            $response .= "\n**Por Ramo:**\n";
            foreach ($data['por_ramo'] as $ramo) {
                $response .= "  - {$ramo['type']}: {$ramo['total']} pólizas\n";
            }
        }
        
        return $response;
    }

    private function formatClientesResponse(array $data): string
    {
        return "👥 **Estadísticas de Clientes**\n\n" .
            "• **Total:** {$data['total']} clientes\n" .
            "• **Activos:** {$data['activos']}\n" .
            "• **Prospectos:** {$data['prospectos']}\n" .
            "• **Nuevos este mes:** {$data['nuevos_este_mes']}";
    }

    private function formatSearchClienteResponse(array $data): string
    {
        if ($data['encontrados'] === 0) {
            return "❌ No encontré ningún cliente con esos criterios de búsqueda.";
        }
        
        $response = "🔍 **Clientes encontrados:** {$data['encontrados']}\n\n";
        foreach ($data['clientes'] as $cliente) {
            $response .= "• **{$cliente['nombre']}**\n";
            $response .= "  Documento: {$cliente['documento']}\n";
            $response .= "  Email: {$cliente['email']}\n";
            $response .= "  Estado: {$cliente['estado']}\n\n";
        }
        return $response;
    }

    private function formatClientePolizasResponse(array $data): string
    {
        if (!$data['encontrado']) {
            return "❌ {$data['mensaje']}";
        }
        
        $response = "📋 **Pólizas de {$data['cliente']['nombre']}**\n\n";
        $response .= "• Total de pólizas: {$data['total_polizas']}\n";
        $response .= "• Pólizas activas: {$data['polizas_activas']}\n";
        $response .= "• Prima total: $" . number_format($data['prima_total'], 0, ',', '.') . "\n\n";
        
        foreach ($data['polizas'] as $poliza) {
            $response .= "**{$poliza['numero']}** ({$poliza['tipo']})\n";
            $response .= "  Aseguradora: {$poliza['aseguradora']}\n";
            $response .= "  Estado: {$poliza['estado']}\n";
            $response .= "  Vigencia: {$poliza['vigencia']}\n\n";
        }
        
        return $response;
    }

    private function formatSiniestrosResponse(array $data): string
    {
        $response = "🚨 **Estadísticas de Siniestros**\n\n";
        $response .= "• **Total:** {$data['total']} siniestros\n";
        $response .= "• **Monto reclamado:** $" . number_format($data['monto_reclamado'], 0, ',', '.') . "\n";
        $response .= "• **Monto pagado:** $" . number_format($data['monto_pagado'], 0, ',', '.') . "\n\n";
        
        if (!empty($data['por_estado'])) {
            $response .= "**Por Estado:**\n";
            foreach ($data['por_estado'] as $estado => $total) {
                $response .= "  - {$estado}: {$total}\n";
            }
        }
        
        return $response;
    }

    private function formatNegociosResponse(array $data): string
    {
        $response = "💼 **Embudo de Ventas**\n\n";
        $response .= "• **Total negocios:** {$data['total']}\n";
        $response .= "• **Valor potencial:** $" . number_format($data['valor_potencial'], 0, ',', '.') . "\n";
        $response .= "• **Cerrados ganados:** {$data['cerrados_ganados']}\n";
        $response .= "• **Tasa de conversión:** {$data['tasa_conversion']}%\n\n";
        
        if (!empty($data['por_etapa'])) {
            $response .= "**Por Etapa:**\n";
            foreach ($data['por_etapa'] as $etapa) {
                $response .= "  - {$etapa['stage']}: {$etapa['total']}\n";
            }
        }
        
        return $response;
    }

    private function formatCarteraResponse(array $data): string
    {
        return "💰 **Estado de Cartera**\n\n" .
            "**Primas:**\n" .
            "• Activas: $" . number_format($data['primas_activas'], 0, ',', '.') . "\n" .
            "• Cobradas: $" . number_format($data['primas_cobradas'], 0, ',', '.') . "\n" .
            "• Pendientes: $" . number_format($data['primas_pendientes'], 0, ',', '.') . "\n\n" .
            "**Comisiones:**\n" .
            "• Esperadas: $" . number_format($data['comisiones_esperadas'], 0, ',', '.') . "\n" .
            "• Cobradas: $" . number_format($data['comisiones_cobradas'], 0, ',', '.') . "\n" .
            "• Pendientes: $" . number_format($data['comisiones_pendientes'], 0, ',', '.');
    }

    private function formatVehiculosResponse(array $data): string
    {
        $response = "🚗 **Vehículos Asegurados**\n\n";
        $response .= "• **Total:** {$data['total']} vehículos\n";
        $response .= "• **Valor total:** $" . number_format($data['valor_total_asegurado'], 0, ',', '.') . "\n\n";
        
        if (!empty($data['por_marca'])) {
            $response .= "**Por Marca:**\n";
            foreach ($data['por_marca'] as $marca) {
                $response .= "  - {$marca['marca']}: {$marca['total']}\n";
            }
        }
        
        return $response;
    }

    private function formatVendedoresResponse(array $data): string
    {
        $response = "👔 **Rendimiento de Vendedores**\n\n";
        $response .= "• **Total vendedores:** {$data['total_vendedores']}\n\n";
        
        $response .= "**Top Vendedores:**\n";
        foreach ($data['vendedores'] as $i => $vendedor) {
            $pos = $i + 1;
            $response .= "{$pos}. **{$vendedor['nombre']}**\n";
            $response .= "   Pólizas: {$vendedor['polizas']} | Prima: $" . number_format($vendedor['prima_total'], 0, ',', '.') . "\n";
        }
        
        return $response;
    }

    private function formatLlamadasResponse(array $data): string
    {
        return "📞 **Campañas de Voz**\n\n" .
            "• **Total llamadas:** {$data['total']}\n" .
            "• **Completadas:** {$data['completadas']}\n" .
            "• **Tasa de éxito:** {$data['tasa_exito']}%\n" .
            "• **Duración promedio:** {$data['duracion_promedio_segundos']} segundos";
    }

    private function formatRenovacionesResponse(array $data): string
    {
        $response = "🔄 **Pólizas por Vencer** (próximos {$data['dias']} días)\n\n";
        $response .= "• **Total:** {$data['total']} pólizas\n";
        $response .= "• **Prima en riesgo:** $" . number_format($data['prima_en_riesgo'], 0, ',', '.') . "\n\n";
        
        if (!empty($data['polizas'])) {
            foreach ($data['polizas'] as $poliza) {
                $response .= "**{$poliza['numero']}** - {$poliza['cliente']}\n";
                $response .= "  Vence: {$poliza['vencimiento']} ({$poliza['dias_restantes']} días)\n";
                $response .= "  Prima: $" . number_format($poliza['prima'], 0, ',', '.') . "\n\n";
            }
        }
        
        return $response;
    }

    private function formatDashboardResponse(array $data): string
    {
        return "📊 **Resumen General**\n\n" .
            "**Pólizas:**\n" .
            "• Total: {$data['polizas']['total']} | Activas: {$data['polizas']['activas']}\n" .
            "• Por vencer (30 días): {$data['polizas']['por_vencer_30_dias']}\n\n" .
            "**Clientes:**\n" .
            "• Total: {$data['clientes']['total']} | Activos: {$data['clientes']['activos']}\n\n" .
            "**Siniestros:**\n" .
            "• Total: {$data['siniestros']['total']} | Pendientes: {$data['siniestros']['pendientes']}\n\n" .
            "**Finanzas:**\n" .
            "• Prima total: $" . number_format($data['finanzas']['prima_total'], 0, ',', '.') . "\n" .
            "• Comisiones: $" . number_format($data['finanzas']['comisiones'], 0, ',', '.') . "\n\n" .
            "**Negocios activos:** {$data['negocios']['activos']}";
    }

    private function formatSearchPolizaResponse(array $data): string
    {
        if (!$data['encontrada']) {
            return "❌ {$data['mensaje']}";
        }
        
        $p = $data['poliza'];
        return "📋 **Póliza {$p['numero']}**\n\n" .
            "• **Cliente:** {$p['cliente']}\n" .
            "• **Tipo:** {$p['tipo']}\n" .
            "• **Aseguradora:** {$p['aseguradora']}\n" .
            "• **Estado:** {$p['estado']}\n" .
            "• **Prima:** $" . number_format($p['prima'], 0, ',', '.') . "\n" .
            "• **Suma asegurada:** $" . number_format($p['suma_asegurada'], 0, ',', '.') . "\n" .
            "• **Vigencia:** {$p['vigencia']}\n" .
            "• **Días restantes:** {$p['dias_restantes']}";
    }

    private function formatTopClientesResponse(array $data): string
    {
        $response = "🏆 **Top Clientes por Prima**\n\n";
        
        foreach ($data['clientes'] as $i => $cliente) {
            $pos = $i + 1;
            $response .= "{$pos}. **{$cliente['nombre']}**\n";
            $response .= "   Pólizas: {$cliente['polizas_activas']} | Prima: $" . number_format($cliente['prima_total'], 0, ',', '.') . "\n";
        }
        
        return $response;
    }

    private function formatTareasResponse(array $data): string
    {
        if ($data['total'] === 0) {
            return "✅ No tienes tareas pendientes. ¡Buen trabajo!";
        }
        
        $response = "📝 **Tareas Pendientes** ({$data['total']})\n\n";
        
        foreach ($data['tareas'] as $tarea) {
            $prioridad = match($tarea['prioridad']) {
                'high' => '🔴',
                'medium' => '🟡',
                default => '🟢'
            };
            $response .= "{$prioridad} **{$tarea['titulo']}**\n";
            $response .= "   Tipo: {$tarea['tipo']} | Fecha: {$tarea['fecha_limite']}\n\n";
        }
        
        return $response;
    }

    // ==================== NUEVAS FUNCIONES DE BÚSQUEDA ESPECÍFICA ====================

    /**
     * Buscar pólizas de un cliente por nombre
     */
    private function searchPolizasCliente(int $brokerId, array $params): array
    {
        $nombre = $params['cliente_nombre'] ?? '';
        
        if (empty($nombre)) {
            return ['encontradas' => 0, 'polizas' => [], 'cliente_nombre' => '', 'mensaje' => 'No se especificó nombre de cliente'];
        }

        // Buscar cliente primero
        $clientes = Cliente::where('broker_id', $brokerId)
            ->whereNull('deleted_at')
            ->where(function($q) use ($nombre) {
                $q->whereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%{$nombre}%"])
                  ->orWhere('first_name', 'LIKE', "%{$nombre}%")
                  ->orWhere('last_name', 'LIKE', "%{$nombre}%")
                  ->orWhere('document_number', 'LIKE', "%{$nombre}%");
            })
            ->limit(5)
            ->get();

        if ($clientes->isEmpty()) {
            return [
                'encontradas' => 0,
                'polizas' => [],
                'cliente_nombre' => $nombre,
                'mensaje' => "No encontré clientes con el nombre '{$nombre}'"
            ];
        }

        $clienteIds = $clientes->pluck('id')->toArray();
        
        $polizas = Poliza::where('broker_id', $brokerId)
            ->whereIn('client_id', $clienteIds)
            ->whereNull('deleted_at')
            ->orderBy('created_at', 'desc')
            ->limit(500)
            ->get();

        $polizasData = $polizas->map(function($p) {
            return [
                'numero' => $p->policy_number,
                'cliente' => $p->client_name,
                'tipo' => $p->type ?? $p->product_name,
                'aseguradora' => $p->insurance_company,
                'estado' => $p->status,
                'prima' => $p->premium_amount,
                'vigencia' => $p->start_date . ' - ' . $p->end_date
            ];
        })->toArray();

        return [
            'encontradas' => count($polizasData),
            'polizas' => $polizasData,
            'cliente_nombre' => $clientes->first()->first_name . ' ' . $clientes->first()->last_name,
            'clientes_encontrados' => $clientes->count()
        ];
    }

    /**
     * Buscar pólizas por ciudad
     */
    private function searchPolizasCiudad(int $brokerId, array $params): array
    {
        $ciudad = $params['ciudad'] ?? '';
        
        // Buscar clientes de esa ciudad
        $clienteIds = Cliente::where('broker_id', $brokerId)
            ->whereNull('deleted_at')
            ->where('city', 'LIKE', "%{$ciudad}%")
            ->pluck('id')
            ->toArray();

        $polizas = Poliza::where('broker_id', $brokerId)
            ->whereNull('deleted_at')
            ->where(function($q) use ($clienteIds, $ciudad) {
                $q->whereIn('client_id', $clienteIds)
                  ->orWhere('client_name', 'LIKE', "%{$ciudad}%");
            })
            ->get();

        $total = $polizas->count();
        $activas = $polizas->where('status', 'active')->count();
        $primaTotal = $polizas->sum('premium_amount');

        $porRamo = $polizas->groupBy('type')->map->count()->toArray();

        return [
            'ciudad' => $ciudad,
            'total' => $total,
            'activas' => $activas,
            'prima_total' => $primaTotal,
            'por_ramo' => $porRamo,
            'muestra' => $polizas->take(10)->map(function($p) {
                return [
                    'numero' => $p->policy_number,
                    'cliente' => $p->client_name,
                    'tipo' => $p->type,
                    'estado' => $p->status,
                    'prima' => $p->premium_amount
                ];
            })->toArray()
        ];
    }

    /**
     * Buscar clientes por ciudad
     */
    private function searchClientesCiudad(int $brokerId, array $params): array
    {
        $ciudad = $params['ciudad'] ?? '';
        
        $clientes = Cliente::where('broker_id', $brokerId)
            ->whereNull('deleted_at')
            ->where('city', 'LIKE', "%{$ciudad}%")
            ->get();

        $total = $clientes->count();
        $activos = $clientes->where('status', 'active')->count();

        return [
            'ciudad' => $ciudad,
            'total' => $total,
            'activos' => $activos,
            'muestra' => $clientes->take(10)->map(function($c) {
                return [
                    'nombre' => $c->first_name . ' ' . $c->last_name,
                    'documento' => $c->document_number,
                    'telefono' => $c->phone ?? $c->mobile_phone,
                    'email' => $c->email,
                    'estado' => $c->status
                ];
            })->toArray()
        ];
    }

    /**
     * Buscar pólizas por aseguradora
     */
    private function searchPolizasAseguradora(int $brokerId, array $params): array
    {
        $aseguradora = $params['aseguradora'] ?? '';
        
        $polizas = Poliza::where('broker_id', $brokerId)
            ->whereNull('deleted_at')
            ->where('insurance_company', 'LIKE', "%{$aseguradora}%")
            ->get();

        $total = $polizas->count();
        $activas = $polizas->where('status', 'active')->count();
        $primaTotal = $polizas->sum('premium_amount');
        $comisionTotal = $polizas->sum('commission_amount');

        $porEstado = $polizas->groupBy('status')->map->count()->toArray();

        return [
            'aseguradora' => $aseguradora,
            'total' => $total,
            'activas' => $activas,
            'prima_total' => $primaTotal,
            'comision_total' => $comisionTotal,
            'por_estado' => $porEstado,
            'muestra' => $polizas->take(10)->map(function($p) {
                return [
                    'numero' => $p->policy_number,
                    'cliente' => $p->client_name,
                    'tipo' => $p->type,
                    'estado' => $p->status,
                    'prima' => $p->premium_amount
                ];
            })->toArray()
        ];
    }

    // ==================== FORMATTERS PARA NUEVAS BÚSQUEDAS ====================

    private function formatPolizasClienteResponse(array $data): string
    {
        if ($data['encontradas'] === 0) {
            return "🔍 **Búsqueda de pólizas**\n\n" . ($data['mensaje'] ?? "No encontré pólizas para '{$data['cliente_nombre']}'");
        }

        $response = "📋 **Pólizas de {$data['cliente_nombre']}**\n\n";
        $response .= "**Total encontradas:** {$data['encontradas']}\n\n";

        foreach ($data['polizas'] as $i => $p) {
            $estado = match($p['estado']) {
                'active' => '🟢',
                'expired' => '🔴',
                'cancelled' => '⚫',
                default => '🟡'
            };
            $response .= "{$estado} **{$p['numero']}** - {$p['tipo']}\n";
            $response .= "   {$p['aseguradora']} | Prima: $" . number_format($p['prima'], 0, ',', '.') . "\n";
        }

        return $response;
    }

    private function formatPolizasCiudadResponse(array $data): string
    {
        $response = "🏙️ **Pólizas en {$data['ciudad']}**\n\n";
        $response .= "• **Total:** {$data['total']} pólizas\n";
        $response .= "• **Activas:** {$data['activas']}\n";
        $response .= "• **Prima total:** $" . number_format($data['prima_total'], 0, ',', '.') . "\n\n";

        if (!empty($data['por_ramo'])) {
            $response .= "**Por tipo:**\n";
            foreach ($data['por_ramo'] as $ramo => $cantidad) {
                $response .= "- {$ramo}: {$cantidad}\n";
            }
        }

        if (!empty($data['muestra'])) {
            $response .= "\n**Muestra:**\n";
            foreach (array_slice($data['muestra'], 0, 5) as $p) {
                $response .= "• {$p['numero']} - {$p['cliente']} ({$p['estado']})\n";
            }
        }

        return $response;
    }

    private function formatClientesCiudadResponse(array $data): string
    {
        $response = "👥 **Clientes en {$data['ciudad']}**\n\n";
        $response .= "• **Total:** {$data['total']} clientes\n";
        $response .= "• **Activos:** {$data['activos']}\n\n";

        if (!empty($data['muestra'])) {
            $response .= "**Muestra:**\n";
            foreach (array_slice($data['muestra'], 0, 5) as $c) {
                $response .= "• **{$c['nombre']}** - {$c['documento']}\n";
                if ($c['telefono']) $response .= "  Tel: {$c['telefono']}\n";
            }
        }

        return $response;
    }

    private function formatPolizasAseguradoraResponse(array $data): string
    {
        $response = "🏢 **Pólizas con {$data['aseguradora']}**\n\n";
        $response .= "• **Total:** {$data['total']} pólizas\n";
        $response .= "• **Activas:** {$data['activas']}\n";
        $response .= "• **Prima total:** $" . number_format($data['prima_total'], 0, ',', '.') . "\n";
        $response .= "• **Comisión total:** $" . number_format($data['comision_total'], 0, ',', '.') . "\n\n";

        if (!empty($data['por_estado'])) {
            $response .= "**Por estado:**\n";
            foreach ($data['por_estado'] as $estado => $cantidad) {
                $emoji = match($estado) {
                    'active' => '🟢',
                    'expired' => '🔴',
                    'cancelled' => '⚫',
                    default => '🟡'
                };
                $response .= "{$emoji} {$estado}: {$cantidad}\n";
            }
        }

        return $response;
    }

    // ==================== FUNCIONES ADICIONALES ====================

    /**
     * Obtener cliente con más pólizas
     */
    private function getClienteMasPolizas(int $brokerId, array $params): array
    {
        $topClientes = DB::table('clientes as c')
            ->select([
                'c.id',
                'c.first_name',
                'c.last_name',
                'c.document_number',
                'c.email',
                'c.phone',
                DB::raw('COUNT(p.id) as total_polizas'),
                DB::raw('SUM(CASE WHEN p.status = "active" THEN 1 ELSE 0 END) as polizas_activas'),
                DB::raw('COALESCE(SUM(p.premium_amount), 0) as prima_total')
            ])
            ->leftJoin('polizas as p', function($join) {
                $join->on('c.id', '=', 'p.client_id')
                     ->whereNull('p.deleted_at');
            })
            ->where('c.broker_id', $brokerId)
            ->whereNull('c.deleted_at')
            ->groupBy('c.id', 'c.first_name', 'c.last_name', 'c.document_number', 'c.email', 'c.phone')
            ->orderByDesc('total_polizas')
            ->limit(100)
            ->get();

        return [
            'clientes' => $topClientes->map(function($c) {
                return [
                    'nombre' => $c->first_name . ' ' . $c->last_name,
                    'documento' => $c->document_number,
                    'email' => $c->email,
                    'telefono' => $c->phone,
                    'total_polizas' => $c->total_polizas,
                    'polizas_activas' => $c->polizas_activas,
                    'prima_total' => $c->prima_total
                ];
            })->toArray(),
            'total_encontrados' => $topClientes->count()
        ];
    }

    /**
     * Obtener clientes con pólizas de un ramo específico
     */
    private function getClientesPorRamo(int $brokerId, array $params): array
    {
        $ramo = $params['ramo'] ?? 'autos';
        
        $clientes = DB::table('clientes as c')
            ->select([
                'c.id',
                'c.first_name',
                'c.last_name',
                'c.document_number',
                'c.phone',
                'c.email',
                DB::raw('COUNT(p.id) as total_polizas'),
                DB::raw('COALESCE(SUM(p.premium_amount), 0) as prima_total')
            ])
            ->join('polizas as p', function($join) use ($ramo) {
                $join->on('c.id', '=', 'p.client_id')
                     ->whereNull('p.deleted_at')
                     ->where('p.type', 'LIKE', "%{$ramo}%");
            })
            ->where('c.broker_id', $brokerId)
            ->whereNull('c.deleted_at')
            ->groupBy('c.id', 'c.first_name', 'c.last_name', 'c.document_number', 'c.phone', 'c.email')
            ->orderByDesc('total_polizas')
            ->limit(500)
            ->get();

        return [
            'ramo' => $ramo,
            'total' => $clientes->count(),
            'clientes' => $clientes->map(function($c) {
                return [
                    'nombre' => $c->first_name . ' ' . $c->last_name,
                    'documento' => $c->document_number,
                    'telefono' => $c->phone,
                    'email' => $c->email,
                    'polizas' => $c->total_polizas,
                    'prima_total' => $c->prima_total
                ];
            })->toArray()
        ];
    }

    /**
     * Obtener lista de clientes
     */
    private function getListaClientes(int $brokerId, array $params): array
    {
        $query = Cliente::where('broker_id', $brokerId)
            ->whereNull('deleted_at')
            ->orderBy('created_at', 'desc');

        if (!empty($params['status'])) {
            $query->where('status', $params['status']);
        }

        $clientes = $query->limit(500)->get();

        return [
            'total' => Cliente::where('broker_id', $brokerId)->whereNull('deleted_at')->count(),
            'mostrando' => $clientes->count(),
            'clientes' => $clientes->map(function($c) {
                return [
                    'nombre' => $c->first_name . ' ' . $c->last_name,
                    'documento' => $c->document_number,
                    'telefono' => $c->phone ?? $c->mobile_phone,
                    'email' => $c->email,
                    'estado' => $c->status,
                    'ciudad' => $c->city
                ];
            })->toArray()
        ];
    }

    // ==================== FORMATTERS ADICIONALES ====================

    private function formatClienteMasPolizasResponse(array $data): string
    {
        if (empty($data['clientes'])) {
            return "❌ No encontré clientes con pólizas.";
        }

        $response = "🏆 **Top Clientes por Número de Pólizas**\n\n";

        foreach ($data['clientes'] as $i => $c) {
            $pos = $i + 1;
            $medal = match($pos) {
                1 => '🥇',
                2 => '🥈',
                3 => '🥉',
                default => "{$pos}."
            };
            $response .= "{$medal} **{$c['nombre']}**\n";
            $response .= "   📋 {$c['total_polizas']} pólizas ({$c['polizas_activas']} activas)\n";
            $response .= "   💰 Prima: $" . number_format($c['prima_total'], 0, ',', '.') . "\n";
            if ($c['telefono']) $response .= "   📞 {$c['telefono']}\n";
            $response .= "\n";
        }

        return $response;
    }

    private function formatClientesPorRamoResponse(array $data): string
    {
        if ($data['total'] === 0) {
            return "❌ No encontré clientes con pólizas de {$data['ramo']}.";
        }

        $ramoLabel = ucfirst($data['ramo']);
        $response = "👥 **Clientes con Pólizas de {$ramoLabel}**\n\n";
        $response .= "**Total encontrados:** {$data['total']}\n\n";

        foreach ($data['clientes'] as $i => $c) {
            $response .= "**" . ($i + 1) . ". {$c['nombre']}**\n";
            $response .= "   📋 {$c['polizas']} póliza(s) | Prima: $" . number_format($c['prima_total'], 0, ',', '.') . "\n";
            if ($c['telefono']) $response .= "   📞 {$c['telefono']}\n";
        }

        return $response;
    }

    private function formatListaClientesResponse(array $data): string
    {
        $response = "👥 **Lista de Clientes**\n\n";
        $response .= "**Total:** {$data['total']} | **Mostrando:** {$data['mostrando']}\n\n";

        foreach ($data['clientes'] as $i => $c) {
            $estado = $c['estado'] === 'active' ? '🟢' : '⚪';
            $response .= "{$estado} **{$c['nombre']}** - {$c['documento']}\n";
            if ($c['ciudad']) $response .= "   📍 {$c['ciudad']}";
            if ($c['telefono']) $response .= " | 📞 {$c['telefono']}";
            $response .= "\n";
        }

        return $response;
    }
}
