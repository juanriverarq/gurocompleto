<?php

namespace App\Console\Commands;

use App\Models\CommercialTask;
use App\Models\CommercialTaskPriorityConfig;
use Carbon\Carbon;
use Illuminate\Console\Command;

class SendCommercialTaskNotifications extends Command
{
    protected $signature = 'commercial-tasks:send-notifications';
    protected $description = 'Envía notificaciones de seguimiento según configuración de prioridad y fecha límite';

    public function handle(): int
    {
        $now = Carbon::now();

        // Obtener todas las tareas activas (no completadas ni canceladas)
        $tasks = CommercialTask::whereNotIn('status', ['completada', 'cancelada'])
            ->where(function ($q) {
                $q->whereNotNull('due_date')
                  ->orWhereNotNull('scheduled_for');
            })
            ->get();

        $sent = 0;
        $skipped = 0;

        foreach ($tasks as $task) {
            $config = CommercialTaskPriorityConfig::where('broker_id', $task->broker_id)
                ->where('priority_key', $task->priority)
                ->where('enabled', true)
                ->first();

            if (!$config) {
                // Crear defaults si no existen
                CommercialTaskPriorityConfig::getOrCreateDefaults($task->broker_id);
                $config = CommercialTaskPriorityConfig::where('broker_id', $task->broker_id)
                    ->where('priority_key', $task->priority)
                    ->first();
            }

            // Fecha de referencia: scheduled_for o due_date
            $referenceDate = $task->scheduled_for ?? $task->due_date;
            if (!$referenceDate) continue;

            // ¿Ya pasó la fecha límite?
            if ($referenceDate->isPast()) {
                // Si ya venció y la tarea no está en 'vencida', marcar como vencida
                if ($task->status !== 'vencida') {
                    $task->update(['status' => 'vencida']);
                    $task->addActivity('Tarea marcada como vencida por sistema', [
                        'due_date' => $referenceDate->toISOString()
                    ]);
                }
                $skipped++;
                continue;
            }

            // Tiempo restante en minutos
            $minutesRemaining = $now->diffInMinutes($referenceDate, false);

            // Primera notificación
            $firstNotificationAt = $referenceDate->copy()->subMinutes($config->first_notification_minutes);

            // ¿Es momento de enviar primera notificación?
            if ($task->notifications_sent === 0 && $now->gte($firstNotificationAt)) {
                $this->sendNotification($task, 'first');
                $sent++;
                continue;
            }

            // Notificaciones repetidas
            if ($config->repeat_every_minutes > 0 && $task->notifications_sent < $config->max_notifications) {
                $lastNotification = $task->last_notification_at;

                if (!$lastNotification || $now->diffInMinutes($lastNotification) >= $config->repeat_every_minutes) {
                    // Solo notificar si queda suficiente tiempo (no spammear si ya está muy cerca)
                    // Equilibrio: si quedan menos de 30 min, solo enviar una última vez
                    if ($minutesRemaining > 30 || $task->notifications_sent < $config->max_notifications - 1) {
                        $this->sendNotification($task, 'repeat');
                        $sent++;
                    } else {
                        $skipped++;
                    }
                } else {
                    $skipped++;
                }
            } else {
                $skipped++;
            }
        }

        $this->info("Notificaciones enviadas: {$sent}, Saltadas: {$skipped}, Total tareas: {$tasks->count()}");
        return 0;
    }

    private function sendNotification(CommercialTask $task, string $type): void
    {
        $referenceDate = $task->scheduled_for ?? $task->due_date;
        $minutesRemaining = round(Carbon::now()->diffInMinutes($referenceDate, false));
        $hoursRemaining = round($minutesRemaining / 60, 1);

        $message = $type === 'first'
            ? "⏰ Recordatorio: '{$task->title}' vence en {$hoursRemaining}h"
            : "🔔 Seguimiento urgente: '{$task->title}' vence en {$hoursRemaining}h";

        // Log de actividad
        $task->addActivity($type === 'first' ? 'Primera notificación enviada' : 'Notificación repetida enviada', [
            'message' => $message,
            'minutes_remaining' => $minutesRemaining,
            'notification_number' => $task->notifications_sent + 1,
        ]);

        // Incrementar contador
        $task->update([
            'notifications_sent' => $task->notifications_sent + 1,
            'last_notification_at' => Carbon::now(),
        ]);

        // Aquí se puede integrar con sistema de notificaciones push/email/WhatsApp
        \Log::info("[CommercialTaskNotification] {$type} para tarea {$task->id}: {$message}");
    }
}
