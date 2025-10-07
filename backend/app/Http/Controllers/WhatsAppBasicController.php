<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Log;

class WhatsAppBasicController extends Controller
{
    private string $servicePath;

    public function __construct()
    {
        $this->servicePath = base_path('whatsapp-basic.js');
    }

    /**
     * Inicializar conexión WhatsApp
     */
    public function initialize(): JsonResponse
    {
        try {
            // Verificar si el archivo del servicio existe
            if (!file_exists($this->servicePath)) {
                return response()->json([
                    'success' => false,
                    'error' => 'Servicio WhatsApp no encontrado'
                ], 404);
            }

            // Ejecutar el servicio de WhatsApp en background
            $command = "cd " . base_path() . " && node whatsapp-basic.js > /dev/null 2>&1 &";
            
            Log::info('Iniciando servicio WhatsApp básico');
            exec($command);

            return response()->json([
                'success' => true,
                'message' => 'Servicio WhatsApp iniciado',
                'status' => 'initializing'
            ]);

        } catch (\Exception $e) {
            Log::error('Error iniciando WhatsApp: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'error' => 'Error interno del servidor',
                'details' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener estado del servicio
     */
    public function status(): JsonResponse
    {
        try {
            // Verificar si hay procesos de Node.js corriendo whatsapp-basic.js
            $processes = shell_exec("ps aux | grep 'whatsapp-basic.js' | grep -v grep");
            $isRunning = !empty(trim($processes));

            return response()->json([
                'success' => true,
                'isRunning' => $isRunning,
                'status' => $isRunning ? 'running' : 'stopped',
                'message' => $isRunning ? 'Servicio activo' : 'Servicio detenido'
            ]);

        } catch (\Exception $e) {
            Log::error('Error verificando estado WhatsApp: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'error' => 'Error verificando estado'
            ], 500);
        }
    }

    /**
     * Detener servicio WhatsApp
     */
    public function stop(): JsonResponse
    {
        try {
            // Terminar procesos de WhatsApp
            exec("pkill -f 'whatsapp-basic.js'");
            
            Log::info('Servicio WhatsApp detenido');

            return response()->json([
                'success' => true,
                'message' => 'Servicio WhatsApp detenido'
            ]);

        } catch (\Exception $e) {
            Log::error('Error deteniendo WhatsApp: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'error' => 'Error deteniendo servicio'
            ], 500);
        }
    }

    /**
     * Reiniciar servicio WhatsApp
     */
    public function restart(): JsonResponse
    {
        try {
            // Detener servicio actual
            exec("pkill -f 'whatsapp-basic.js'");
            
            // Esperar un momento
            sleep(2);
            
            // Reiniciar servicio
            $command = "cd " . base_path() . " && node whatsapp-basic.js > /dev/null 2>&1 &";
            exec($command);
            
            Log::info('Servicio WhatsApp reiniciado');

            return response()->json([
                'success' => true,
                'message' => 'Servicio WhatsApp reiniciado'
            ]);

        } catch (\Exception $e) {
            Log::error('Error reiniciando WhatsApp: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'error' => 'Error reiniciando servicio'
            ], 500);
        }
    }

    /**
     * Obtener información básica del sistema
     */
    public function info(): JsonResponse
    {
        try {
            $nodeVersion = trim(shell_exec('node --version 2>/dev/null') ?? 'No disponible');
            $npmVersion = trim(shell_exec('npm --version 2>/dev/null') ?? 'No disponible');
            
            return response()->json([
                'success' => true,
                'system' => [
                    'node_version' => $nodeVersion,
                    'npm_version' => $npmVersion,
                    'service_path' => $this->servicePath,
                    'service_exists' => file_exists($this->servicePath)
                ],
                'features' => [
                    'auto_response' => true,
                    'qr_generation' => true,
                    'basic_commands' => ['hola mundo', 'menu', 'ayuda', 'estado']
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Error obteniendo información'
            ], 500);
        }
    }

    /**
     * Limpiar datos de autenticación (forzar nuevo QR)
     */
    public function clearAuth(): JsonResponse
    {
        try {
            // Detener servicio
            exec("pkill -f 'whatsapp-basic.js'");
            
            // Eliminar carpeta de autenticación
            $authPath = base_path('whatsapp_auth');
            if (is_dir($authPath)) {
                exec("rm -rf " . escapeshellarg($authPath));
                Log::info('Datos de autenticación WhatsApp eliminados');
            }

            return response()->json([
                'success' => true,
                'message' => 'Datos de autenticación eliminados. Reinicia el servicio para generar nuevo QR.'
            ]);

        } catch (\Exception $e) {
            Log::error('Error limpiando autenticación WhatsApp: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'error' => 'Error limpiando autenticación'
            ], 500);
        }
    }

    /**
     * Obtener logs recientes
     */
    public function logs(): JsonResponse
    {
        try {
            // Leer logs de Laravel relacionados con WhatsApp
            $logFile = storage_path('logs/laravel.log');
            $logs = [];
            
            if (file_exists($logFile)) {
                $content = file_get_contents($logFile);
                $lines = explode("\n", $content);
                
                // Filtrar líneas que contengan "WhatsApp"
                $whatsappLogs = array_filter($lines, function($line) {
                    return stripos($line, 'whatsapp') !== false;
                });
                
                // Tomar las últimas 20 líneas
                $logs = array_slice(array_values($whatsappLogs), -20);
            }

            return response()->json([
                'success' => true,
                'logs' => $logs,
                'count' => count($logs)
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Error obteniendo logs'
            ], 500);
        }
    }

    /**
     * Obtener QR Code en tiempo real
     */
    public function getQR(): JsonResponse
    {
        try {
            // Buscar archivos temporales donde se podría guardar el QR
            $tempQrFile = base_path('temp_qr.json');
            
            if (file_exists($tempQrFile)) {
                $qrData = json_decode(file_get_contents($tempQrFile), true);
                
                if ($qrData && isset($qrData['qrCodeBase64'])) {
                    return response()->json([
                        'success' => true,
                        'hasQR' => true,
                        'qrCodeBase64' => $qrData['qrCodeBase64'],
                        'status' => $qrData['status'] ?? 'connecting',
                        'isReady' => $qrData['isReady'] ?? false
                    ]);
                }
            }

            // Si no hay archivo temporal, devolver estado sin QR
            return response()->json([
                'success' => true,
                'hasQR' => false,
                'qrCodeBase64' => null,
                'status' => 'disconnected',
                'isReady' => false
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo QR: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'error' => 'Error obteniendo QR Code'
            ], 500);
        }
    }

    /**
     * Enviar mensaje masivo (para campañas)
     */
    public function sendBulkMessages(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'messages' => 'required|array',
                'messages.*.phone' => 'required|string',
                'messages.*.message' => 'required|string',
                'messages.*.name' => 'nullable|string',
                'campaign_id' => 'nullable|integer',
                'execution_id' => 'nullable|integer'
            ]);

            $messages = $validated['messages'];
            $campaignId = $validated['campaign_id'] ?? null;
            $executionId = $validated['execution_id'] ?? null;

            Log::info('Iniciando envío masivo de WhatsApp', [
                'campaign_id' => $campaignId,
                'execution_id' => $executionId,
                'total_messages' => count($messages)
            ]);

            // Crear archivo de trabajo para el envío masivo
            $workFile = base_path('temp_bulk_' . uniqid() . '.json');
            $workData = [
                'messages' => $messages,
                'campaign_id' => $campaignId,
                'execution_id' => $executionId,
                'status' => 'pending',
                'created_at' => now()->toISOString()
            ];

            file_put_contents($workFile, json_encode($workData, JSON_PRETTY_PRINT));

            // Ejecutar script de envío masivo en background
            $command = "cd " . base_path() . " && node bulk-sender.js " . escapeshellarg($workFile) . " > /dev/null 2>&1 &";
            exec($command);

            Log::info('Proceso de envío masivo iniciado en background');

            return response()->json([
                'success' => true,
                'message' => 'Envío masivo iniciado en background',
                'total_messages' => count($messages),
                'work_file' => basename($workFile)
            ]);

        } catch (\Exception $e) {
            Log::error('Error en envío masivo WhatsApp: ' . $e->getMessage());
            
            return response()->json([
                'success' => false,
                'error' => 'Error en envío masivo',
                'details' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Verificar estado de envío masivo
     */
    public function getBulkStatus(Request $request): JsonResponse
    {
        try {
            $workFile = $request->query('work_file');
            
            if (!$workFile) {
                return response()->json([
                    'success' => false,
                    'error' => 'Archivo de trabajo requerido'
                ], 400);
            }

            $fullPath = base_path($workFile);
            
            if (!file_exists($fullPath)) {
                return response()->json([
                    'success' => false,
                    'error' => 'Archivo de trabajo no encontrado'
                ], 404);
            }

            $data = json_decode(file_get_contents($fullPath), true);
            
            return response()->json([
                'success' => true,
                'status' => $data['status'] ?? 'unknown',
                'progress' => $data['progress'] ?? [],
                'completed_at' => $data['completed_at'] ?? null,
                'stats' => $data['stats'] ?? []
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Error verificando estado'
            ], 500);
        }
    }
} 