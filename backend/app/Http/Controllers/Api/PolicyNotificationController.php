<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PolicyNotificationConfig;
use App\Models\PolicyNotificationLog;
use App\Models\WhatsAppInstance;
use App\Models\Poliza;
use App\Models\Cliente;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use App\Services\WhatsAppCloudApiService;
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

            // Agregar estado de WhatsApp y envíos programados
            $whatsappStatus = $config->getWhatsAppStatus();

            return response()->json([
                'success' => true,
                'data' => array_merge($config->toArray(), [
                    'whatsapp_status' => $whatsappStatus,
                    'stats' => $config->getStats(),
                    'scheduled_notifications' => $config->getScheduledNotifications(20),
                    'next_execution_formatted' => $config->next_execution_at 
                        ? $config->next_execution_at->format('d/m/Y H:i') 
                        : null,
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
                'whatsapp_instance_id' => 'nullable|exists:whatsapp_instances,id',
                'is_active' => 'boolean',
                'name' => 'string|max:255',
                'description' => 'nullable|string',
                'notify_expiration' => 'boolean',
                'notify_renewal' => 'boolean',
                'notify_payment_due' => 'boolean',
                'expiration_days_before' => 'integer|min:0|max:365',
                'renewal_days_before' => 'integer|min:0|max:365',
                'payment_days_before' => 'integer|min:0|max:90',
                'expiration_days_before_multiple' => 'nullable|array',
                'expiration_days_before_multiple.*' => 'integer|min:0|max:365',
                'renewal_days_before_multiple' => 'nullable|array',
                'renewal_days_before_multiple.*' => 'integer|min:0|max:365',
                'payment_days_before_multiple' => 'nullable|array',
                'payment_days_before_multiple.*' => 'integer|min:0|max:90',
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

            // Recalcular próxima ejecución basada en la nueva configuración
            $config->calculateNextExecution();
            
            // Recargar el modelo con los datos actualizados
            $config->refresh();

            return response()->json([
                'success' => true,
                'message' => 'Configuración actualizada exitosamente',
                'data' => array_merge($config->toArray(), [
                    'whatsapp_status' => $config->getWhatsAppStatus(),
                    'stats' => $config->getStats(),
                    'scheduled_notifications' => $config->getScheduledNotifications(20),
                    'next_execution_formatted' => $config->next_execution_at 
                        ? $config->next_execution_at->format('d/m/Y H:i') 
                        : null,
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

            $total = (clone $query)->count();
            $logs = $query->skip($offset)->take($limit)->get();

            // Transformar logs para incluir campos planos que el frontend necesita
            $transformedLogs = $logs->map(function ($log) {
                $poliza = $log->poliza;
                $client = $log->client ?? $poliza?->client;
                
                return [
                    'id' => $log->id,
                    'notification_type' => $log->notification_type,
                    'status' => $log->status,
                    'recipient_phone' => $log->recipient_phone,
                    'phone_number' => $log->recipient_phone,
                    'message_sent' => $log->message_sent,
                    'error_message' => $log->error_message,
                    'sent_at' => $log->sent_at,
                    'failed_at' => $log->failed_at,
                    'created_at' => $log->created_at,
                    // Campos de la póliza
                    'policy_number' => $poliza?->policy_number ?? $poliza?->numero_poliza ?? '-',
                    'policy_id' => $log->poliza_id,
                    'expiration_date' => $poliza?->end_date ?? $poliza?->fecha_fin,
                    'renewal_date' => $poliza?->renewal_date ?? $poliza?->fecha_renovacion,
                    'payment_due_date' => $poliza?->payment_due_date ?? $poliza?->fecha_pago,
                    'event_date' => match($log->notification_type) {
                        'expiration' => $poliza?->end_date ?? $poliza?->fecha_fin,
                        'renewal' => $poliza?->renewal_date ?? $poliza?->fecha_renovacion ?? $poliza?->end_date,
                        'payment_due' => $poliza?->payment_due_date ?? $poliza?->fecha_pago,
                        default => null
                    },
                    // Campos del cliente
                    'client_id' => $log->client_id,
                    'client_name' => $client 
                        ? ($client->full_name ?? $client->nombre_completo ?? 
                           trim(($client->first_name ?? $client->nombre ?? '') . ' ' . ($client->last_name ?? $client->apellido ?? '')) ?: 
                           $client->razon_social ?? $client->company_name ?? '-')
                        : '-',
                    // Metadatos adicionales
                    'policy_data' => $log->policy_data,
                    'metadata' => $log->metadata,
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $transformedLogs,
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

            // Generar mensaje (para log y fallback)
            $template = $config->getTemplate($request->notification_type);
            $message = $config->processTemplate($template, $poliza);

            // Enviar por WhatsApp usando plantilla de Meta
            $result = $this->sendWhatsAppNotification(
                $config->whatsappInstance,
                $request->phone,
                $message,
                $request->notification_type,
                $poliza
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

            // Obtener exclusiones
            $excludedClientIds = $config->excluded_client_ids ?? [];
            $excludedPolicyTypes = $config->excluded_policy_types ?? [];
            $excludedPolicyStatuses = $config->excluded_policy_statuses ?? [];

            // Helper para aplicar exclusiones a una query
            $applyExclusions = function ($query) use ($excludedClientIds, $excludedPolicyTypes, $excludedPolicyStatuses) {
                if (!empty($excludedClientIds)) {
                    $query->whereNotIn('client_id', $excludedClientIds);
                }
                if (!empty($excludedPolicyTypes)) {
                    $query->where(function($q) use ($excludedPolicyTypes) {
                        $q->whereNull('type')
                          ->orWhereNotIn('type', $excludedPolicyTypes);
                    });
                }
                if (!empty($excludedPolicyStatuses)) {
                    $query->whereNotIn('status', array_map('strtolower', $excludedPolicyStatuses));
                }
                return $query;
            };

            // Helper para transformar pólizas
            $transformPolicy = function ($poliza, $type, $eventDate) {
                $client = $poliza->client;
                $daysUntil = $eventDate ? now()->diffInDays($eventDate, false) : null;
                
                return [
                    'id' => $poliza->id,
                    'policy_number' => $poliza->policy_number ?? $poliza->numero_poliza ?? '-',
                    'client_id' => $poliza->client_id,
                    'client_name' => $client 
                        ? ($client->full_name ?? $client->nombre_completo ?? 
                           trim(($client->first_name ?? $client->nombre ?? '') . ' ' . ($client->last_name ?? $client->apellido ?? '')) ?: 
                           $client->razon_social ?? $client->company_name ?? '-')
                        : '-',
                    'notification_type' => $type,
                    'event_date' => $eventDate?->format('Y-m-d'),
                    'days_until' => max(0, (int)$daysUntil),
                    'status' => $poliza->status,
                ];
            };

            // Estados activos permitidos (múltiples variantes)
            $activeStatuses = ['active', 'issued', 'accrued', 'vigente', 'activa', 'emitida', 'devengada', 'pending', 'pendiente'];

            // Pólizas próximas a vencer
            if ($config->notify_expiration) {
                $query = Poliza::forBroker($brokerId)
                    ->where(function($q) use ($activeStatuses) {
                        $q->whereIn('status', $activeStatuses)
                          ->orWhereIn(\DB::raw('LOWER(status)'), $activeStatuses);
                    })
                    ->whereNotNull('end_date')
                    ->whereBetween('end_date', [
                        now(),
                        now()->addDays($config->expiration_days_before)
                    ])
                    ->with('client');
                
                $polizas = $applyExclusions($query)->limit(20)->get();
                $pending['expiration'] = $polizas->map(fn($p) => $transformPolicy($p, 'expiration', $p->end_date))->toArray();
            }

            // Pólizas próximas a renovar
            if ($config->notify_renewal) {
                $query = Poliza::forBroker($brokerId)
                    ->where(function($q) use ($activeStatuses) {
                        $q->whereIn('status', $activeStatuses)
                          ->orWhereIn(\DB::raw('LOWER(status)'), $activeStatuses);
                    })
                    ->where(function($q) {
                        $q->whereNotNull('renewal_date')
                          ->orWhereNotNull('end_date');
                    })
                    ->where(function($q) use ($config) {
                        $q->whereBetween('renewal_date', [now(), now()->addDays($config->renewal_days_before)])
                          ->orWhereBetween('end_date', [now(), now()->addDays($config->renewal_days_before)]);
                    })
                    ->with('client');
                
                $polizas = $applyExclusions($query)->limit(20)->get();
                $pending['renewal'] = $polizas->map(fn($p) => $transformPolicy($p, 'renewal', $p->renewal_date ?? $p->end_date))->toArray();
            }

            // Pólizas con pago próximo
            if ($config->notify_payment_due) {
                $query = Poliza::forBroker($brokerId)
                    ->where(function($q) use ($activeStatuses) {
                        $q->whereIn('status', $activeStatuses)
                          ->orWhereIn(\DB::raw('LOWER(status)'), $activeStatuses);
                    })
                    ->whereNotNull('payment_due_date')
                    ->whereBetween('payment_due_date', [
                        now(),
                        now()->addDays($config->payment_days_before)
                    ])
                    ->with('client');
                
                $polizas = $applyExclusions($query)->limit(20)->get();
                
                $pending['payment_due'] = $polizas->map(fn($p) => $transformPolicy($p, 'payment_due', $p->payment_due_date))->toArray();
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
     * Obtener notificaciones programadas con detalle
     */
    public function getScheduledNotifications(Request $request): JsonResponse
    {
        try {
            $brokerId = $request->get('authenticated_broker_id')
                ?? $request->get('broker_id')
                ?? $this->getBrokerId($request);

            if (!$brokerId) {
                return response()->json([
                    'success' => true,
                    'data' => [],
                    'next_execution' => null
                ]);
            }
            $brokerId = (int)$brokerId;

            $config = PolicyNotificationConfig::forBroker($brokerId)->first();

            if (!$config || !$config->is_active) {
                return response()->json([
                    'success' => true,
                    'data' => [],
                    'next_execution' => null,
                    'message' => 'Sistema de notificaciones inactivo'
                ]);
            }

            $limit = $request->get('limit', 50);
            $scheduled = $config->getScheduledNotifications($limit);

            // Información de diagnóstico
            $debug = [];
            if ($request->has('debug')) {
                $now = now();
                $expirationDays = $config->getDaysBeforeForType('expiration');
                $maxDays = !empty($expirationDays) ? max($expirationDays) : 30;
                
                // Contar pólizas activas del broker
                $totalPolizas = Poliza::forBroker($brokerId)
                    ->whereIn('status', ['active', 'issued', 'accrued'])
                    ->count();
                
                // Pólizas con fecha de vencimiento
                $polizasConFechaFin = Poliza::forBroker($brokerId)
                    ->whereIn('status', ['active', 'issued', 'accrued'])
                    ->whereNotNull('end_date')
                    ->count();
                
                // Pólizas que vencen en el rango
                $polizasEnRango = Poliza::forBroker($brokerId)
                    ->whereIn('status', ['active', 'issued', 'accrued'])
                    ->whereNotNull('end_date')
                    ->whereBetween('end_date', [$now, $now->copy()->addDays($maxDays + 1)])
                    ->count();
                
                // Muestra de pólizas activas con sus fechas
                $muestraPolizas = Poliza::forBroker($brokerId)
                    ->whereIn('status', ['active', 'issued', 'accrued'])
                    ->select('id', 'policy_number', 'status', 'end_date', 'client_id')
                    ->limit(10)
                    ->get()
                    ->map(fn($p) => [
                        'id' => $p->id,
                        'numero' => $p->policy_number,
                        'status' => $p->status,
                        'end_date' => $p->end_date?->format('Y-m-d'),
                        'client_id' => $p->client_id,
                    ]);
                
                $debug = [
                    'now' => $now->format('Y-m-d H:i:s'),
                    'max_days_expiration' => $maxDays,
                    'date_range' => [
                        'from' => $now->format('Y-m-d'),
                        'to' => $now->copy()->addDays($maxDays + 1)->format('Y-m-d'),
                    ],
                    'total_polizas_activas' => $totalPolizas,
                    'polizas_con_fecha_fin' => $polizasConFechaFin,
                    'polizas_en_rango' => $polizasEnRango,
                    'excluded_client_ids' => $config->excluded_client_ids ?? [],
                    'notify_expiration' => $config->notify_expiration,
                    'notify_renewal' => $config->notify_renewal,
                    'notify_payment_due' => $config->notify_payment_due,
                    'muestra_polizas' => $muestraPolizas,
                ];
            }

            return response()->json([
                'success' => true,
                'data' => $scheduled,
                'total' => count($scheduled),
                'next_execution' => $config->next_execution_at?->format('Y-m-d H:i:s'),
                'next_execution_formatted' => $config->next_execution_at?->format('d/m/Y H:i'),
                'next_execution_human' => $config->next_execution_at?->diffForHumans(),
                'send_time' => $config->send_time,
                'send_days' => $config->send_days,
                'send_days_labels' => $this->getDaysLabels($config->send_days ?? []),
                'debug' => $debug ?: null,
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo notificaciones programadas', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al obtener notificaciones programadas',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Omitir una notificación específica (crear log con status 'skipped')
     */
    public function skipNotification(Request $request): JsonResponse
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
                'reason' => 'nullable|string|max:255',
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

            $poliza = Poliza::find($request->poliza_id);

            if ($poliza->broker_id !== $brokerId) {
                return response()->json([
                    'success' => false,
                    'message' => 'La póliza no pertenece a tu broker'
                ], 403);
            }

            // Crear un log con status 'skipped' para que no se envíe hoy
            $log = PolicyNotificationLog::create([
                'broker_id' => $brokerId,
                'policy_notification_config_id' => $config->id,
                'poliza_id' => $poliza->id,
                'client_id' => $poliza->client_id,
                'whatsapp_instance_id' => $config->whatsapp_instance_id,
                'notification_type' => $request->notification_type,
                'recipient_phone' => '-',
                'message_sent' => 'Omitido manualmente',
                'status' => 'skipped',
                'error_message' => $request->reason ?? 'Omitido por el usuario',
                'metadata' => [
                    'skipped_by' => $request->user()?->id,
                    'skipped_at' => now()->toIso8601String(),
                    'reason' => $request->reason ?? 'Omitido manualmente',
                ],
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Notificación omitida exitosamente',
                'data' => [
                    'log_id' => $log->id,
                    'poliza_id' => $poliza->id,
                    'notification_type' => $request->notification_type,
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error omitiendo notificación', [
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al omitir notificación',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener plantillas de WhatsApp aprobadas
     */
    public function getWhatsAppTemplates(Request $request): JsonResponse
    {
        try {
            $brokerId = $request->get('authenticated_broker_id')
                ?? $request->get('broker_id')
                ?? $this->getBrokerId($request);

            if (!$brokerId) {
                return response()->json(['success' => true, 'data' => []]);
            }
            $brokerId = (int)$brokerId;

            $config = PolicyNotificationConfig::forBroker($brokerId)->first();

            if (!$config || !$config->whatsappInstance) {
                return response()->json([
                    'success' => true,
                    'data' => [],
                    'message' => 'No hay instancia de WhatsApp configurada'
                ]);
            }

            $cloudApi = app(WhatsAppCloudApiService::class);
            $result = $cloudApi->getMessageTemplates($config->whatsappInstance, 'APPROVED', 100);

            if (!($result['success'] ?? false)) {
                return response()->json([
                    'success' => false,
                    'message' => $result['error'] ?? 'Error al obtener plantillas',
                    'data' => []
                ]);
            }

            $templates = collect($result['data'] ?? [])->map(function ($t) {
                $bodyComponent = collect($t['components'] ?? [])->firstWhere('type', 'BODY');
                $bodyText = $bodyComponent['text'] ?? '';
                $paramCount = preg_match_all('/\{\{\d+\}\}/', $bodyText);

                return [
                    'name' => $t['name'],
                    'status' => $t['status'],
                    'category' => $t['category'],
                    'language' => $t['language'],
                    'body_text' => $bodyText,
                    'param_count' => $paramCount,
                ];
            })->values();

            return response()->json([
                'success' => true,
                'data' => $templates,
            ]);

        } catch (\Exception $e) {
            Log::error('Error obteniendo plantillas de WhatsApp', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener plantillas',
                'data' => []
            ], 500);
        }
    }

    /**
     * Obtener etiquetas de días de la semana
     */
    private function getDaysLabels(array $days): array
    {
        $labels = [
            0 => 'Domingo',
            1 => 'Lunes',
            2 => 'Martes',
            3 => 'Miércoles',
            4 => 'Jueves',
            5 => 'Viernes',
            6 => 'Sábado',
        ];

        return array_map(fn($d) => $labels[$d] ?? $d, $days);
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
    private function sendWhatsAppNotification(WhatsAppInstance $instance, string $phone, string $message, string $type, Poliza $poliza): array
    {
        try {
            $cloudApi = app(WhatsAppCloudApiService::class);

            // Leer plantilla desde config del broker (seleccionada por el usuario)
            $brokerId = $instance->broker_id;
            $notifConfig = PolicyNotificationConfig::forBroker($brokerId)->first();
            $configTemplateMap = [
                'expiration' => $notifConfig->expiration_template ?? null,
                'renewal' => $notifConfig->renewal_template ?? null,
                'payment_due' => $notifConfig->payment_template ?? null,
            ];
            $defaultTemplateMap = [
                'expiration' => 'poliza_vencimiento',
                'renewal' => 'poliza_renovacion',
                'payment_due' => 'poliza_pago_pendiente',
            ];

            $templateName = !empty($configTemplateMap[$type]) ? $configTemplateMap[$type] : ($defaultTemplateMap[$type] ?? null);

            if ($templateName) {
                $client = $poliza->client;
                $clientName = $client ? ($client->full_name ?? trim(($client->first_name ?? '') . ' ' . ($client->last_name ?? '')) ?: 'Cliente') : 'Cliente';
                $ramoName = $poliza->ramo ? ($poliza->ramo->nombre ?? '-') : ($poliza->product_name ?? '-');
                $riesgo = $poliza->description ?? '-';

                $templateParams = match($type) {
                    'expiration' => [
                        $clientName,
                        $poliza->policy_number ?? '-',
                        $poliza->insurance_company ?? '-',
                        $poliza->end_date ? $poliza->end_date->format('d/m/Y') : 'N/A',
                        $ramoName,
                        $riesgo,
                    ],
                    'renewal' => [
                        $clientName,
                        $poliza->policy_number ?? '-',
                        $poliza->insurance_company ?? '-',
                        ($poliza->renewal_date ?? $poliza->end_date)?->format('d/m/Y') ?? 'N/A',
                        $ramoName,
                        $riesgo,
                    ],
                    'payment_due' => [
                        $clientName,
                        $poliza->policy_number ?? '-',
                        $poliza->payment_due_date ? $poliza->payment_due_date->format('d/m/Y') : 'N/A',
                        '$' . number_format($poliza->premium_amount ?? 0, 0, ',', '.'),
                        $ramoName,
                        $riesgo,
                    ],
                    default => [],
                };

                $components = [];
                if (!empty($templateParams)) {
                    $parameters = array_map(fn($val) => ['type' => 'text', 'text' => (string) $val], $templateParams);
                    $components[] = [
                        'type' => 'body',
                        'parameters' => $parameters,
                    ];
                }

                $result = $cloudApi->sendTemplateMessage($instance, $phone, $templateName, 'es', $components);
            } else {
                $result = $cloudApi->sendTextMessage($instance, $phone, $message);
            }

            if ($result['success'] ?? false) {
                $messageId = $result['message_id'] ?? null;

                return [
                    'success' => true,
                    'message_id' => $messageId
                ];
            }

            return [
                'success' => false,
                'error' => $result['error'] ?? 'Error desconocido'
            ];

        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
}