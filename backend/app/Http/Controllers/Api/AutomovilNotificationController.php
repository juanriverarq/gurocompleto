<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AutomovilNotificationConfig;
use App\Models\AutomovilNotificationLog;
use App\Models\WhatsAppInstance;
use App\Models\Automovil;
use App\Models\Cliente;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use App\Services\WhatsAppCloudApiService;
use App\Traits\RequiresAuth;

class AutomovilNotificationController extends Controller
{
    use RequiresAuth;

    /**
     * Obtener configuración de notificaciones de autos
     */
    public function getConfig(Request $request): JsonResponse
    {
        try {
            $brokerId = $request->get('authenticated_broker_id')
                ?? $request->get('broker_id')
                ?? $this->getBrokerId($request);

            if (!$brokerId) {
                return response()->json(['success' => false, 'message' => 'Broker no identificado'], 400);
            }

            $config = AutomovilNotificationConfig::forBroker((int)$brokerId)
                ->with('whatsappInstance')
                ->first();

            if (!$config) {
                $config = $this->createDefaultConfig((int)$brokerId, $request->user()?->id);
            }

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
            Log::error('Error obteniendo config de notificaciones de autos', [
                'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Error al obtener configuración',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Actualizar configuración
     */
    public function updateConfig(Request $request): JsonResponse
    {
        try {
            $brokerId = $request->get('authenticated_broker_id')
                ?? $request->get('broker_id')
                ?? $this->getBrokerId($request);

            if (!$brokerId) {
                return response()->json(['success' => false, 'message' => 'Broker no identificado'], 400);
            }
            $brokerId = (int)$brokerId;

            $validator = Validator::make($request->all(), [
                'whatsapp_instance_id' => [
                    'nullable',
                    'integer',
                    Rule::exists('whatsapp_instances', 'id')->where(function ($query) use ($brokerId) {
                        $query->where('broker_id', $brokerId);
                    }),
                ],
                'is_active' => 'boolean',
                'name' => 'string|max:255',
                'description' => 'nullable|string',
                'notify_soat' => 'boolean',
                'notify_rtm' => 'boolean',
                'soat_days_before' => 'integer|min:0|max:365',
                'rtm_days_before' => 'integer|min:0|max:365',
                'soat_days_before_multiple' => 'nullable|array',
                'soat_days_before_multiple.*' => 'integer|min:0|max:365',
                'rtm_days_before_multiple' => 'nullable|array',
                'rtm_days_before_multiple.*' => 'integer|min:0|max:365',
                'soat_template' => 'nullable|string',
                'rtm_template' => 'nullable|string',
                'send_time' => 'nullable|date_format:H:i:s,H:i',
                'send_days' => 'nullable|array',
                'send_days.*' => 'integer|min:0|max:6',
                'excluded_client_ids' => 'nullable|array',
                'excluded_automovil_ids' => 'nullable|array',
                'excluded_vehicle_classes' => 'nullable|array',
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

            if ($request->filled('whatsapp_instance_id')) {
                $instance = WhatsAppInstance::find($request->whatsapp_instance_id);
                if (!$instance || $instance->broker_id !== $brokerId) {
                    return response()->json([
                        'success' => false,
                        'message' => 'La instancia de WhatsApp no pertenece a tu broker'
                    ], 403);
                }
            }

            $config = AutomovilNotificationConfig::forBroker($brokerId)->first();

            if (!$config) {
                $config = $this->createDefaultConfig($brokerId, $request->user()?->id);
            }

            // Ensure whatsapp_instance_id is valid before updating
            $updateData = $request->only([
                    'whatsapp_instance_id',
                    'is_active',
                    'name',
                    'description',
                    'notify_soat',
                    'notify_rtm',
                    'soat_days_before',
                    'rtm_days_before',
                    'soat_days_before_multiple',
                    'rtm_days_before_multiple',
                    'soat_template',
                    'rtm_template',
                    'send_time',
                    'send_days',
                    'excluded_client_ids',
                    'excluded_automovil_ids',
                    'excluded_vehicle_classes',
                    'send_to_client_phone',
                    'send_to_client_mobile',
                    'send_to_assigned_user',
                    'max_notifications_per_day',
                    'skip_weekends',
                    'skip_holidays',
                ]);

            // Final validation of whatsapp_instance_id before update
            if (isset($updateData['whatsapp_instance_id']) && $updateData['whatsapp_instance_id'] !== null) {
                $instance = WhatsAppInstance::where('id', $updateData['whatsapp_instance_id'])
                    ->where('broker_id', $brokerId)
                    ->first();
                
                if (!$instance) {
                    $updateData['whatsapp_instance_id'] = null;
                }
            }

            $updateData['updated_by'] = $request->user()?->id;
            $config->update($updateData);

            $config->calculateNextExecution();
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
            Log::error('Error actualizando config de notificaciones de autos', [
                'error' => $e->getMessage(), 'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar configuración',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Obtener historial de envíos
     */
    public function getLogs(Request $request): JsonResponse
    {
        try {
            $brokerId = $request->get('authenticated_broker_id')
                ?? $request->get('broker_id')
                ?? $this->getBrokerId($request);

            if (!$brokerId) {
                return response()->json(['success' => true, 'data' => [], 'total' => 0]);
            }
            $brokerId = (int)$brokerId;

            $query = AutomovilNotificationLog::forBroker($brokerId)
                ->with(['automovil', 'client', 'whatsappInstance'])
                ->orderBy('created_at', 'desc');

            if ($request->has('status')) {
                $query->where('status', $request->status);
            }
            if ($request->has('notification_type')) {
                $query->where('notification_type', $request->notification_type);
            }
            if ($request->has('automovil_id')) {
                $query->where('automovil_id', $request->automovil_id);
            }
            if ($request->has('date_from')) {
                $query->where('created_at', '>=', $request->date_from);
            }
            if ($request->has('date_to')) {
                $query->where('created_at', '<=', $request->date_to);
            }

            $limit = $request->get('limit', 20);
            $offset = $request->get('offset', 0);

            $total = (clone $query)->count();
            $logs = $query->skip($offset)->take($limit)->get();

            $transformedLogs = $logs->map(function ($log) {
                $auto = $log->automovil;
                $client = $log->client ?? $auto?->client;

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
                    'placa' => $auto?->placa ?? '-',
                    'automovil_id' => $log->automovil_id,
                    'vehiculo' => $auto ? trim(($auto->marca ?? '') . ' ' . ($auto->linea ?? '') . ' ' . ($auto->anio ?? '')) : '-',
                    'event_date' => match($log->notification_type) {
                        'soat' => $auto?->fecha_vencimiento_soat,
                        'rtm' => $auto?->fecha_vencimiento_rtm,
                        default => null
                    },
                    'client_id' => $log->client_id,
                    'client_name' => $client
                        ? ($client->full_name ?? trim(($client->first_name ?? '') . ' ' . ($client->last_name ?? '')) ?:
                           $client->razon_social ?? '-')
                        : '-',
                    'automovil_data' => $log->automovil_data,
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
            Log::error('Error obteniendo historial de notificaciones de autos', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false, 'message' => 'Error al obtener historial', 'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Estadísticas
     */
    public function getStats(Request $request): JsonResponse
    {
        try {
            $brokerId = $request->get('authenticated_broker_id')
                ?? $request->get('broker_id')
                ?? $this->getBrokerId($request);

            if (!$brokerId) {
                return response()->json(['success' => true, 'data' => ['total_sent' => 0, 'total_failed' => 0, 'success_rate' => 0, 'by_type' => [], 'recent_activity' => []]]);
            }
            $brokerId = (int)$brokerId;

            $config = AutomovilNotificationConfig::forBroker($brokerId)->first();
            if (!$config) {
                return response()->json(['success' => true, 'data' => ['total_sent' => 0, 'total_failed' => 0, 'success_rate' => 0, 'by_type' => [], 'recent_activity' => []]]);
            }

            $byType = AutomovilNotificationLog::forBroker($brokerId)
                ->selectRaw('notification_type, COUNT(*) as total, SUM(CASE WHEN status = "sent" THEN 1 ELSE 0 END) as sent, SUM(CASE WHEN status = "failed" THEN 1 ELSE 0 END) as failed')
                ->groupBy('notification_type')
                ->get();

            $recentActivity = AutomovilNotificationLog::forBroker($brokerId)
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
            Log::error('Error obteniendo stats de autos', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Próximos envíos programados
     */
    public function getScheduledNotifications(Request $request): JsonResponse
    {
        try {
            $brokerId = $request->get('authenticated_broker_id')
                ?? $request->get('broker_id')
                ?? $this->getBrokerId($request);

            if (!$brokerId) {
                return response()->json(['success' => true, 'data' => [], 'total' => 0]);
            }
            $brokerId = (int)$brokerId;

            $config = AutomovilNotificationConfig::forBroker($brokerId)->first();
            if (!$config) {
                return response()->json(['success' => true, 'data' => [], 'total' => 0]);
            }

            $limit = $request->get('limit', 50);
            $scheduled = $config->getScheduledNotifications($limit);

            return response()->json([
                'success' => true,
                'data' => $scheduled,
                'total' => count($scheduled),
                'next_execution' => $config->next_execution_at,
                'next_execution_formatted' => $config->next_execution_at?->format('d/m/Y H:i'),
                'next_execution_human' => $config->next_execution_at?->diffForHumans(),
                'send_time' => substr($config->send_time ?? '09:00:00', 0, 5),
                'send_days' => $config->send_days ?? [1, 2, 3, 4, 5],
                'send_days_labels' => $this->getDaysLabels($config->send_days ?? [1, 2, 3, 4, 5]),
            ]);
        } catch (\Exception $e) {
            Log::error('Error obteniendo scheduled de autos', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Omitir notificación manualmente
     */
    public function skipNotification(Request $request): JsonResponse
    {
        try {
            $brokerId = $request->get('authenticated_broker_id')
                ?? $request->get('broker_id')
                ?? $this->getBrokerId($request);

            if (!$brokerId) {
                return response()->json(['success' => false, 'message' => 'Broker no identificado'], 400);
            }
            $brokerId = (int)$brokerId;

            $validator = Validator::make($request->all(), [
                'automovil_id' => 'required|integer|exists:automoviles,id',
                'notification_type' => 'required|in:soat,rtm',
                'reason' => 'nullable|string|max:255',
            ]);

            if ($validator->fails()) {
                return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
            }

            $config = AutomovilNotificationConfig::forBroker($brokerId)->first();
            if (!$config) {
                return response()->json(['success' => false, 'message' => 'No hay configuración'], 404);
            }

            $auto = Automovil::forBroker($brokerId)->find($request->automovil_id);
            if (!$auto) {
                return response()->json(['success' => false, 'message' => 'Automóvil no encontrado'], 404);
            }

            $log = AutomovilNotificationLog::create([
                'broker_id' => $brokerId,
                'automovil_notification_config_id' => $config->id,
                'automovil_id' => $auto->id,
                'client_id' => $auto->client_id,
                'whatsapp_instance_id' => $config->whatsapp_instance_id,
                'notification_type' => $request->notification_type,
                'recipient_phone' => '-',
                'message_sent' => 'Omitido manualmente',
                'status' => 'skipped',
                'error_message' => $request->reason ?? 'Omitido por el usuario',
                'automovil_data' => [
                    'placa' => $auto->placa,
                    'marca' => $auto->marca,
                    'linea' => $auto->linea,
                    'anio' => $auto->anio,
                ],
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Notificación omitida',
                'data' => [
                    'log_id' => $log->id,
                    'automovil_id' => $auto->id,
                    'notification_type' => $request->notification_type,
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Error omitiendo notificación de auto', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Obtener plantillas de WhatsApp (compartido con pólizas - mismas plantillas de la instancia)
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

            $config = AutomovilNotificationConfig::forBroker($brokerId)->first();
            if (!$config || !$config->whatsapp_instance_id) {
                return response()->json(['success' => true, 'data' => []]);
            }

            $instance = WhatsAppInstance::find($config->whatsapp_instance_id);
            if (!$instance) {
                return response()->json(['success' => true, 'data' => []]);
            }

            $cloudApi = app(WhatsAppCloudApiService::class);
            $result = $cloudApi->getMessageTemplates($instance, 'APPROVED', 100);

            if (!($result['success'] ?? false)) {
                return response()->json([
                    'success' => false,
                    'message' => $result['error'] ?? 'Error al obtener plantillas',
                    'data' => [],
                ]);
            }

            $templates = collect($result['data'] ?? [])->map(function ($t) {
                $bodyComponent = collect($t['components'] ?? [])->firstWhere('type', 'BODY');
                $bodyText = $bodyComponent['text'] ?? '';
                $paramCount = preg_match_all('/\{\{\d+\}\}/', $bodyText);

                return [
                    'name'        => $t['name'] ?? '',
                    'status'      => $t['status'] ?? '',
                    'category'    => $t['category'] ?? '',
                    'language'    => $t['language'] ?? '',
                    'body_text'   => $bodyText,
                    'param_count' => $paramCount,
                ];
            })->values();

            return response()->json([
                'success' => true,
                'data'    => $templates,
            ]);
        } catch (\Exception $e) {
            Log::error('Error obteniendo templates de autos', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => 'Error', 'data' => []], 500);
        }
    }

    private function getDaysLabels(array $days): array
    {
        $labels = [0 => 'Domingo', 1 => 'Lunes', 2 => 'Martes', 3 => 'Miércoles', 4 => 'Jueves', 5 => 'Viernes', 6 => 'Sábado'];
        return array_map(fn($d) => $labels[$d] ?? $d, $days);
    }

    private function createDefaultConfig(int $brokerId, ?int $userId): AutomovilNotificationConfig
    {
        // Always start with null for whatsapp_instance_id to avoid foreign key issues
        // Users can set a valid instance later through the update method
        return AutomovilNotificationConfig::create([
            'broker_id' => $brokerId,
            'whatsapp_instance_id' => null,
            'is_active' => false,
            'name' => 'Notificaciones de Automóviles',
            'description' => 'SOAT y Revisión Técnico-Mecánica',
            'notify_soat' => true,
            'notify_rtm' => true,
            'soat_days_before' => 30,
            'rtm_days_before' => 30,
            'send_time' => '09:00:00',
            'send_days' => [1, 2, 3, 4, 5],
            'send_to_client_phone' => true,
            'send_to_client_mobile' => true,
            'max_notifications_per_day' => 50,
            'skip_weekends' => true,
            'created_by' => $userId,
        ]);
    }
}
