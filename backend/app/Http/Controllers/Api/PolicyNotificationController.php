<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PolicyNotificationConfig;
use App\Models\PolicyNotificationLog;
use App\Models\WhatsAppInstance;
use App\Models\Poliza;
use App\Models\Cliente;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use App\Traits\RequiresAuth;

class PolicyNotificationController extends Controller
{
    use RequiresAuth;

    /**
     * Obtener configuración de notificaciones
     */
    public function getConfig(Request $request): JsonResponse
    {
        try {
            // Obtener broker_id del middleware GlobalBrokerAuth
            $brokerId = $request->get('authenticated_broker_id')
                ?? $request->get('broker_id')
                ?? $this->getBrokerId($request);

            if (!$brokerId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Broker no identificado'
                ], 400);
            }

            $config = PolicyNotificationConfig::forBroker((int)$brokerId)
                ->with('whatsappInstance')
                ->first();

            if (!$config) {
                // Crear configuración por defecto si no existe
                $config = $this->createDefaultConfig($brokerId, $request->user()?->id);
            }

            // Agregar estado de WhatsApp
            $whatsappStatus = $config->getWhatsAppStatus();

            return response()->json([
                'success' => true,
                'data' => array_merge($config->toArray(), [
                    'whatsapp_status' => $whatsappStatus,
                    'stats' => $config->getStats(),
                ])
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo configuración de notificaciones', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al obtener configuración',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Actualizar configuración de notificaciones
     */
    public function updateConfig(Request $request): JsonResponse
    {
        try {
            $brokerId = $request->get('authenticated_broker_id')
                ?? $request->get('broker_id')
                ?? $this->getBrokerId($request);

            if (!$brokerId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Broker no identificado'
                ], 400);
            }
            $brokerId = (int)$brokerId;

            $validator = Validator::make($request->all(), [
                'whatsapp_instance_id' => 'nullable|exists:whats_app_instances,id',
                'is_active' => 'boolean',
                'name' => 'string|max:255',
                'description' => 'nullable|string',
                'notify_expiration' => 'boolean',
                'notify_renewal' => 'boolean',
                'notify_payment_due' => 'boolean',
                'expiration_days_before' => 'integer|min:1|max:365',
                'renewal_days_before' => 'integer|min:1|max:365',
                'payment_days_before' => 'integer|min:1|max:90',
                'expiration_days_before_multiple' => 'nullable|array',
                'expiration_days_before_multiple.*' => 'integer|min:1|max:365',
                'renewal_days_before_multiple' => 'nullable|array',
                'renewal_days_before_multiple.*' => 'integer|min:1|max:365',
                'payment_days_before_multiple' => 'nullable|array',
                'payment_days_before_multiple.*' => 'integer|min:1|max:90',
                'expiration_template' => 'nullable|string',
                'renewal_template' => 'nullable|string',
                'payment_template' => 'nullable|string',
                'send_time' => 'nullable|date_format:H:i:s,H:i',
                'send_days' => 'nullable|array',
                'send_days.*' => 'integer|min:0|max:6',
                'excluded_client_ids' => 'nullable|array',
                'excluded_policy_types' => 'nullable|array',
                'excluded_policy_statuses' => 'nullable|array',
                'send_to_client_phone' => 'boolean',
                'send_to_client_mobile' => 'boolean',
                'send_to_assigned_user' => 'boolean',
                'max_notifications_per_day' => 'integer|min:1|max:1000',
                'skip_weekends' => 'boolean',
                'skip_holidays' => 'boolean',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Datos inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Verificar que la instancia pertenezca al broker
            if ($request->filled('whatsapp_instance_id')) {
                $instance = WhatsAppInstance::find($request->whatsapp_instance_id);
                if (!$instance || $instance->broker_id !== $brokerId) {
                    return response()->json([
                        'success' => false,
                        'message' => 'La instancia de WhatsApp no pertenece a tu broker'
                    ], 403);
                }
            }

            $config = PolicyNotificationConfig::forBroker($brokerId)->first();

            if (!$config) {
                $config = $this->createDefaultConfig($brokerId, $request->user()?->id);
            }

            $config->update(array_merge(
                $request->only([
                    'whatsapp_instance_id',
                    'is_active',
                    'name',
                    'description',
                    'notify_expiration',
                    'notify_renewal',
                    'notify_payment_due',
                    'expiration_days_before',
                    'renewal_days_before',
                    'payment_days_before',
                    'expiration_days_before_multiple',
                    'renewal_days_before_multiple',
                    'payment_days_before_multiple',
                    'expiration_template',
                    'renewal_template',
                    'payment_template',
                    'send_time',
                    'send_days',
                    'excluded_client_ids',
                    'excluded_policy_types',
                    'excluded_policy_statuses',
                    'send_to_client_phone',
                    'send_to_client_mobile',
                    'send_to_assigned_user',
                    'max_notifications_per_day',
                    'skip_weekends',
                    'skip_holidays',
                ]),
                ['updated_by' => $request->user()?->id]
            ));

            // Calcular próxima ejecución
            $config->calculateNextExecution();

            return response()->json([
                'success' => true,
                'message' => 'Configuración actualizada exitosamente',
                'data' => array_merge($config->fresh()->toArray(), [
                    'whatsapp_status' => $config->getWhatsAppStatus(),
                ])
            ]);

        } catch (\Exception $e) {
            Log::error('Error actualizando configuración de notificaciones', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar configuración',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener historial de notificaciones
     */
    public function getLogs(Request $request): JsonResponse
    {
        try {
            $brokerId = $request->get('authenticated_broker_id')
                ?? $request->get('broker_id')
                ?? $this->getBrokerId($request);

            if (!$brokerId) {
                return response()->json([
                    'success' => true,
                    'data' => [],
                    'total' => 0
                ]);
            }
            $brokerId = (int)$brokerId;

            $query = PolicyNotificationLog::forBroker($brokerId)
                ->with(['poliza', 'client', 'whatsappInstance'])
                ->orderBy('created_at', 'desc');

            // Filtros
            if ($request->has('status')) {
                $query->where('status', $request->status);
            }

            if ($request->has('notification_type')) {
                $query->where('notification_type', $request->notification_type);
            }

            if ($request->has('poliza_id')) {
                $query->where('poliza_id', $request->poliza_id);
            }

            if ($request->has('date_from')) {
                $query->where('created_at', '>=', $request->date_from);
            }

            if ($request->has('date_to')) {
                $query->where('created_at', '<=', $request->date_to);
            }

            // Paginación
            $limit = $request->get('limit', 20);
            $offset = $request->get('offset', 0);

            $logs = $query->skip($offset)->take($limit)->get();
            $total = $query->count();

            return response()->json([
                'success' => true,
                'data' => $logs,
                'total' => $total,
                'limit' => $limit,
                'offset' => $offset
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo historial de notificaciones', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al obtener historial',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener estadísticas de notificaciones
     */
    public function getStats(Request $request): JsonResponse
    {
        try {
            $brokerId = $request->get('authenticated_broker_id')
                ?? $request->get('broker_id')
                ?? $this->getBrokerId($request);

            if (!$brokerId) {
                return response()->json([
                    'success' => true,
                    'data' => [
                        'total_sent' => 0,
                        'total_failed' => 0,
                        'success_rate' => 0,
                        'by_type' => [],
                        'recent_activity' => []
                    ]
                ]);
            }
            $brokerId = (int)$brokerId;

            $config = PolicyNotificationConfig::forBroker($brokerId)->first();

            if (!$config) {
                return response()->json([
                    'success' => true,
                    'data' => [
                        'total_sent' => 0,
                        'total_failed' => 0,
                        'success_rate' => 0,
                        'by_type' => [],
                        'recent_activity' => []
                    ]
                ]);
            }

            // Estadísticas por tipo
            $byType = PolicyNotificationLog::forBroker($brokerId)
                ->selectRaw('
                    notification_type,
                    COUNT(*) as total,
                    SUM(CASE WHEN status = "sent" THEN 1 ELSE 0 END) as sent,
                    SUM(CASE WHEN status = "failed" THEN 1 ELSE 0 END) as failed
                ')
                ->groupBy('notification_type')
                ->get();

            // Actividad reciente (últimos 7 días)
            $recentActivity = PolicyNotificationLog::forBroker($brokerId)
                ->where('created_at', '>=', now()->subDays(7))
                ->selectRaw('DATE(created_at) as date, COUNT(*) as count, status')
                ->groupBy('date', 'status')
                ->orderBy('date', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'data' => [
                    'total_sent' => $config->total_sent,
                    'total_failed' => $config->total_failed,
                    'success_rate' => $config->getStats()['success_rate'],
                    'by_type' => $byType,
                    'recent_activity' => $recentActivity,
                    'whatsapp_status' => $config->getWhatsAppStatus(),
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo estadísticas de notificaciones', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al obtener estadísticas',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Probar envío de notificación
     */
    public function testNotification(Request $request): JsonResponse
    {
        try {
            $brokerId = $request->get('authenticated_broker_id')
                ?? $request->get('broker_id')
                ?? $this->getBrokerId($request);

            if (!$brokerId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Broker no identificado'
                ], 400);
            }
            $brokerId = (int)$brokerId;

            $validator = Validator::make($request->all(), [
                'poliza_id' => 'required|exists:polizas,id',
                'notification_type' => 'required|in:expiration,renewal,payment_due',
                'phone' => 'required|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Datos inválidos',
                    'errors' => $validator->errors()
                ], 422);
            }

            $config = PolicyNotificationConfig::forBroker($brokerId)->first();

            if (!$config) {
                return response()->json([
                    'success' => false,
                    'message' => 'No hay configuración de notificaciones'
                ], 404);
            }

            if (!$config->whatsappInstance) {
                return response()->json([
                    'success' => false,
                    'message' => 'No hay instancia de WhatsApp configurada'
                ], 400);
            }

            $poliza = Poliza::find($request->poliza_id);

            if ($poliza->broker_id !== $brokerId) {
                return response()->json([
                    'success' => false,
                    'message' => 'La póliza no pertenece a tu broker'
                ], 403);
            }

            // Generar mensaje
            $template = $config->getTemplate($request->notification_type);
            $message = $config->processTemplate($template, $poliza);

            // Enviar por WhatsApp
            $result = $this->sendWhatsAppMessage(
                $config->whatsappInstance,
                $request->phone,
                $message
            );

            if ($result['success']) {
                return response()->json([
                    'success' => true,
                    'message' => 'Notificación de prueba enviada exitosamente',
                    'data' => [
                        'message_sent' => $message,
                        'whatsapp_message_id' => $result['message_id']
                    ]
                ]);
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Error al enviar notificación de prueba',
                    'error' => $result['error']
                ], 500);
            }

        } catch (\Exception $e) {
            Log::error('Error enviando notificación de prueba', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al enviar notificación de prueba',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener pólizas pendientes de notificación
     */
    public function getPendingPolicies(Request $request): JsonResponse
    {
        try {
            $brokerId = $request->get('authenticated_broker_id')
                ?? $request->get('broker_id')
                ?? $this->getBrokerId($request);

            if (!$brokerId) {
                return response()->json([
                    'success' => true,
                    'data' => [
                        'expiration' => [],
                        'renewal' => [],
                        'payment_due' => []
                    ]
                ]);
            }
            $brokerId = (int)$brokerId;

            $config = PolicyNotificationConfig::forBroker($brokerId)->first();

            if (!$config || !$config->is_active) {
                return response()->json([
                    'success' => true,
                    'data' => [
                        'expiration' => [],
                        'renewal' => [],
                        'payment_due' => []
                    ]
                ]);
            }

            $pending = [
                'expiration' => [],
                'renewal' => [],
                'payment_due' => []
            ];

            // Pólizas próximas a vencer
            if ($config->notify_expiration) {
                $pending['expiration'] = Poliza::forBroker($brokerId)
                    ->where('status', 'active')
                    ->whereNotNull('end_date')
                    ->whereBetween('end_date', [
                        now(),
                        now()->addDays($config->expiration_days_before)
                    ])
                    ->with('client')
                    ->limit(10)
                    ->get();
            }

            // Pólizas próximas a renovar
            if ($config->notify_renewal) {
                $pending['renewal'] = Poliza::forBroker($brokerId)
                    ->where('status', 'active')
                    ->whereNotNull('renewal_date')
                    ->whereBetween('renewal_date', [
                        now(),
                        now()->addDays($config->renewal_days_before)
                    ])
                    ->with('client')
                    ->limit(10)
                    ->get();
            }

            // Pólizas con pago próximo
            if ($config->notify_payment_due) {
                $pending['payment_due'] = Poliza::forBroker($brokerId)
                    ->where('status', 'active')
                    ->whereIn('payment_status', ['pending', 'overdue'])
                    ->whereNotNull('payment_due_date')
                    ->whereBetween('payment_due_date', [
                        now(),
                        now()->addDays($config->payment_days_before)
                    ])
                    ->with('client')
                    ->limit(10)
                    ->get();
            }

            return response()->json([
                'success' => true,
                'data' => $pending
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo pólizas pendientes', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al obtener pólizas pendientes',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Crear configuración por defecto
     */
    private function createDefaultConfig(int $brokerId, ?int $userId): PolicyNotificationConfig
    {
        // Buscar una instancia de WhatsApp conectada
        $instance = WhatsAppInstance::where('broker_id', $brokerId)
            ->connected()
            ->first();

        return PolicyNotificationConfig::create([
            'broker_id' => $brokerId,
            'whatsapp_instance_id' => $instance?->id,
            'is_active' => false, // Desactivado por defecto hasta que se configure
            'name' => 'Notificaciones de Pólizas',
            'description' => 'Configuración automática de notificaciones',
            'notify_expiration' => true,
            'notify_renewal' => true,
            'notify_payment_due' => true,
            'expiration_days_before' => 30,
            'renewal_days_before' => 45,
            'payment_days_before' => 7,
            'send_time' => '09:00:00',
            'send_days' => [1, 2, 3, 4, 5], // Lunes a Viernes
            'send_to_client_phone' => true,
            'send_to_client_mobile' => true,
            'max_notifications_per_day' => 50,
            'skip_weekends' => true,
            'created_by' => $userId,
        ]);
    }

    /**
     * Enviar mensaje por WhatsApp
     */
    private function sendWhatsAppMessage(WhatsAppInstance $instance, string $phone, string $message): array
    {
        try {
            $waBase = rtrim(env('WHATSAPP_SERVICE_URL', 'http://localhost:3000/api/v1'), '/');
            $url = $waBase . '/instances/' . $instance->instance_id . '/send-message';

            $response = Http::timeout(10)->post($url, [
                'phone' => $phone,
                'message' => $message,
            ]);

            if ($response->successful() && $response->json('success')) {
                $messageId = $response->json('messageId');
                
                // Cobrar 50 pesos por WhatsApp enviado
                $costPerWhatsApp = 50;
                $wallet = Wallet::firstOrCreate(
                    ['broker_id' => $instance->broker_id],
                    [
                        'balance_cop' => 0,
                        'balance_usd' => 0,
                        'pending_balance' => 0,
                        'total_earnings' => 0,
                        'is_active' => true
                    ]
                );

                if ($wallet->balance_cop >= $costPerWhatsApp) {
                    $wallet->balance_cop -= $costPerWhatsApp;
                    $wallet->save();

                    WalletTransaction::create([
                        'wallet_id' => $wallet->id,
                        'broker_id' => $instance->broker_id,
                        'user_id' => null,
                        'type' => 'debit',
                        'amount_cop' => $costPerWhatsApp,
                        'amount_usd' => 0,
                        'currency' => 'COP',
                        'description' => "WhatsApp enviado - Mensaje manual",
                        'reference_type' => 'whatsapp_message',
                        'reference_id' => null,
                        'balance_cop_after' => $wallet->balance_cop,
                        'metadata' => [
                            'phone' => $phone,
                            'message_preview' => substr($message, 0, 100),
                            'cost_per_whatsapp' => $costPerWhatsApp
                        ]
                    ]);
                }

                return [
                    'success' => true,
                    'message_id' => $messageId
                ];
            }

            return [
                'success' => false,
                'error' => $response->json('error') ?? 'Error desconocido'
            ];

        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
}