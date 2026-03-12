<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClientNotificationConfig;
use App\Models\WhatsAppInstance;
use App\Models\Cliente;
use App\Services\WhatsAppCloudApiService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use App\Traits\RequiresAuth;

class ClientNotificationController extends Controller
{
    use RequiresAuth;

    /**
     * Obtener configuración de notificaciones de clientes
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
            $brokerId = (int)$brokerId;

            $config = ClientNotificationConfig::forBroker($brokerId)->first();

            if (!$config) {
                $config = $this->createDefaultConfig($brokerId, $request->user()?->id);
            }

            // Enriquecer con estado de WhatsApp
            $whatsappStatus = null;
            if ($config->whatsapp_instance_id && $config->whatsappInstance) {
                $instance = $config->whatsappInstance;
                $whatsappStatus = [
                    'connected' => $instance->status === 'connected',
                    'status' => $instance->status,
                    'phone_number' => $instance->phone_number,
                ];
            }

            $configData = $config->toArray();
            $configData['whatsapp_status'] = $whatsappStatus;
            $configData['stats'] = [
                'total_sent' => $config->total_sent,
                'total_failed' => $config->total_failed,
                'last_execution' => $config->last_execution_at?->format('d/m/Y H:i'),
            ];
            $configData['special_dates_info'] = ClientNotificationConfig::SPECIAL_DATES;

            return response()->json([
                'success' => true,
                'data' => $configData,
            ]);
        } catch (\Exception $e) {
            Log::error('Error obteniendo config de notificaciones de clientes', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
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

            $config = ClientNotificationConfig::forBroker($brokerId)->first();
            if (!$config) {
                $config = $this->createDefaultConfig($brokerId, $request->user()?->id);
            }

            $fillable = [
                'whatsapp_instance_id', 'is_active', 'name',
                'notify_birthday', 'notify_workers_day', 'notify_womens_day', 'notify_mens_day', 'notify_advisor_day',
                'birthday_template', 'workers_day_template', 'womens_day_template', 'mens_day_template', 'advisor_day_template',
                'workers_day_date', 'womens_day_date', 'mens_day_date', 'advisor_day_date',
                'send_time', 'max_notifications_per_day',
                'send_to_client_phone', 'send_to_client_mobile',
                'excluded_client_ids',
            ];

            $updates = $request->only($fillable);
            $updates['updated_by'] = $request->user()?->id;
            $config->update($updates);
            $config->refresh();

            // Retornar con datos enriquecidos
            return $this->getConfig($request);
        } catch (\Exception $e) {
            Log::error('Error actualizando config de notificaciones de clientes', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'message' => $e->getMessage()], 500);
        }
    }

    /**
     * Obtener logs de envío
     */
    public function getLogs(Request $request): JsonResponse
    {
        try {
            $brokerId = $request->get('authenticated_broker_id')
                ?? $request->get('broker_id')
                ?? $this->getBrokerId($request);

            if (!$brokerId) {
                return response()->json(['success' => true, 'data' => []]);
            }
            $brokerId = (int)$brokerId;

            $logs = \DB::table('client_notification_logs')
                ->where('client_notification_logs.broker_id', $brokerId)
                ->leftJoin('clientes', 'client_notification_logs.client_id', '=', 'clientes.id')
                ->select(
                    'client_notification_logs.*',
                    \DB::raw("CONCAT(COALESCE(clientes.first_name, ''), ' ', COALESCE(clientes.last_name, '')) as client_name")
                )
                ->orderByDesc('client_notification_logs.created_at')
                ->limit($request->get('limit', 50))
                ->get();

            return response()->json(['success' => true, 'data' => $logs]);
        } catch (\Exception $e) {
            Log::error('Error obteniendo logs de notificaciones de clientes', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'data' => []], 500);
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

            $config = ClientNotificationConfig::forBroker($brokerId)->first();
            if (!$config || !$config->whatsappInstance) {
                return response()->json(['success' => true, 'data' => [], 'message' => 'No hay instancia configurada']);
            }

            $cloudApi = app(WhatsAppCloudApiService::class);
            $result = $cloudApi->getMessageTemplates($config->whatsappInstance, 'APPROVED', 100);

            if (!($result['success'] ?? false)) {
                return response()->json(['success' => false, 'data' => [], 'message' => $result['error'] ?? 'Error']);
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

            return response()->json(['success' => true, 'data' => $templates]);
        } catch (\Exception $e) {
            Log::error('Error obteniendo plantillas WA para clientes', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'data' => []], 500);
        }
    }

    /**
     * Obtener próximos envíos programados
     */
    public function getScheduledNotifications(Request $request): JsonResponse
    {
        try {
            $brokerId = $request->get('authenticated_broker_id')
                ?? $request->get('broker_id')
                ?? $this->getBrokerId($request);

            if (!$brokerId) {
                return response()->json(['success' => true, 'data' => []]);
            }
            $brokerId = (int) $brokerId;

            $config = ClientNotificationConfig::forBroker($brokerId)->first();
            if (!$config || !$config->is_active) {
                return response()->json(['success' => true, 'data' => [], 'message' => 'Notificaciones inactivas']);
            }

            $scheduled = [];
            $today = now()->setTimezone('America/Bogota');
            $sendTime = $config->send_time ? substr($config->send_time, 0, 5) : '09:00';

            // 1. Próximos cumpleaños (30 días)
            if ($config->notify_birthday) {
                $clients = Cliente::where('broker_id', $brokerId)
                    ->whereNotNull('birth_date')
                    ->where(function ($q) use ($config) {
                        if ($config->send_to_client_mobile) $q->orWhereNotNull('mobile_phone');
                        if ($config->send_to_client_phone) $q->orWhereNotNull('phone');
                    })
                    ->get();

                foreach ($clients as $client) {
                    $birthDate = \Carbon\Carbon::parse($client->birth_date);
                    // Build next birthday this year
                    $nextBirthday = $today->copy()->setMonth($birthDate->month)->setDay($birthDate->day)->startOfDay();
                    if ($nextBirthday->lt($today->copy()->startOfDay())) {
                        $nextBirthday->addYear();
                    }

                    $daysUntil = $today->copy()->startOfDay()->diffInDays($nextBirthday, false);
                    if ($daysUntil >= 0 && $daysUntil <= 30) {
                        // Check if already sent today
                        $alreadySent = $daysUntil === 0 && \DB::table('client_notification_logs')
                            ->where('broker_id', $brokerId)
                            ->where('client_id', $client->id)
                            ->where('notification_type', 'birthday')
                            ->where('status', 'sent')
                            ->whereDate('created_at', $today->toDateString())
                            ->exists();

                        $scheduled[] = [
                            'client_id' => $client->id,
                            'client_name' => trim(($client->first_name ?? '') . ' ' . ($client->last_name ?? '')),
                            'client_phone' => $client->mobile_phone ?: $client->phone,
                            'notification_type' => 'birthday',
                            'event_date' => $nextBirthday->format('d/m/Y'),
                            'days_until' => $daysUntil,
                            'scheduled_send_at' => $nextBirthday->format('Y-m-d') . ' ' . $sendTime,
                            'scheduled_send_at_human' => $daysUntil === 0
                                ? "Hoy a las {$sendTime}"
                                : ($daysUntil === 1 ? "Mañana a las {$sendTime}" : "En {$daysUntil} días ({$sendTime})"),
                            'template_name' => $config->birthday_template,
                            'status' => $alreadySent ? 'sent' : ($daysUntil === 0 ? 'today' : 'pending'),
                        ];
                    }
                }
            }

            // 2. Fechas especiales
            $specialTypes = [
                'workers_day' => ['notify' => $config->notify_workers_day, 'date' => $config->workers_day_date ?? '05-01', 'template' => $config->workers_day_template, 'gender' => null],
                'womens_day' => ['notify' => $config->notify_womens_day, 'date' => $config->womens_day_date ?? '03-08', 'template' => $config->womens_day_template, 'gender' => 'F'],
                'mens_day' => ['notify' => $config->notify_mens_day, 'date' => $config->mens_day_date ?? '03-19', 'template' => $config->mens_day_template, 'gender' => 'M'],
                'advisor_day' => ['notify' => $config->notify_advisor_day, 'date' => $config->advisor_day_date ?? '09-15', 'template' => $config->advisor_day_template, 'gender' => null],
            ];

            foreach ($specialTypes as $type => $info) {
                if (!$info['notify']) continue;

                $dateParts = explode('-', $info['date']);
                if (count($dateParts) !== 2) continue;

                $specialDate = $today->copy()->setMonth((int) $dateParts[0])->setDay((int) $dateParts[1])->startOfDay();
                if ($specialDate->lt($today->copy()->startOfDay())) {
                    $specialDate->addYear();
                }

                $daysUntil = $today->copy()->startOfDay()->diffInDays($specialDate, false);
                if ($daysUntil >= 0 && $daysUntil <= 60) {
                    // Count eligible clients
                    $query = Cliente::where('broker_id', $brokerId)
                        ->where(function ($q) use ($config) {
                            if ($config->send_to_client_mobile) $q->orWhereNotNull('mobile_phone');
                            if ($config->send_to_client_phone) $q->orWhereNotNull('phone');
                        });

                    if ($info['gender']) {
                        $query->where(function ($q) use ($info) {
                            $q->where('gender', $info['gender'])
                              ->orWhere('gender', strtolower($info['gender']))
                              ->orWhere('gender', $info['gender'] === 'F' ? 'Femenino' : 'Masculino')
                              ->orWhere('gender', $info['gender'] === 'F' ? 'femenino' : 'masculino');
                        });
                    }

                    $clientCount = $query->count();

                    $typeLabel = match ($type) {
                        'workers_day' => 'Día del Trabajador',
                        'womens_day' => 'Día de la Mujer',
                        'mens_day' => 'Día del Hombre',
                        'advisor_day' => 'Día del Asesor',
                        default => $type,
                    };

                    $scheduled[] = [
                        'client_id' => null,
                        'client_name' => "{$clientCount} clientes",
                        'client_phone' => null,
                        'notification_type' => $type,
                        'event_date' => $specialDate->format('d/m/Y'),
                        'days_until' => $daysUntil,
                        'scheduled_send_at' => $specialDate->format('Y-m-d') . ' ' . $sendTime,
                        'scheduled_send_at_human' => $daysUntil === 0
                            ? "Hoy a las {$sendTime}"
                            : ($daysUntil === 1 ? "Mañana a las {$sendTime}" : "En {$daysUntil} días ({$sendTime})"),
                        'template_name' => $info['template'],
                        'status' => $daysUntil === 0 ? 'today' : 'pending',
                        'is_special_date' => true,
                        'special_date_label' => $typeLabel,
                    ];
                }
            }

            // Sort by days_until
            usort($scheduled, fn($a, $b) => $a['days_until'] <=> $b['days_until']);

            return response()->json(['success' => true, 'data' => $scheduled]);
        } catch (\Exception $e) {
            Log::error('Error obteniendo próximos envíos de clientes', ['error' => $e->getMessage()]);
            return response()->json(['success' => false, 'data' => []], 500);
        }
    }

    /**
     * Crear configuración por defecto
     */
    private function createDefaultConfig(int $brokerId, ?int $userId): ClientNotificationConfig
    {
        $instance = WhatsAppInstance::where('broker_id', $brokerId)->connected()->first();

        return ClientNotificationConfig::create([
            'broker_id' => $brokerId,
            'whatsapp_instance_id' => $instance?->id,
            'is_active' => false,
            'name' => 'Notificaciones de Clientes',
            'notify_birthday' => true,
            'notify_workers_day' => false,
            'notify_womens_day' => false,
            'notify_mens_day' => false,
            'notify_advisor_day' => false,
            'send_time' => '09:00:00',
            'max_notifications_per_day' => 100,
            'send_to_client_phone' => true,
            'send_to_client_mobile' => true,
            'created_by' => $userId,
        ]);
    }
}
