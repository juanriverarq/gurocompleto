<?php

namespace App\Console\Commands;

use App\Models\Chatbot;
use App\Models\WhatsAppConversation;
use App\Models\WhatsAppInstance;
use App\Services\WhatsAppBridgeService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

/**
 * Verifica conversaciones inactivas y envía recordatorios automáticos.
 *
 * 1. Recordatorio al cliente: si no responde en X minutos (máx 23h desde su último msg).
 * 2. Recordatorio al agente: si fue asignado y no ha contestado en X minutos.
 *
 * Respeta horario de atención del chatbot y envía máx 1 recordatorio por tipo.
 * El flag se resetea cuando llega un nuevo mensaje del cliente.
 */
class CheckChatbotInactivity extends Command
{
    protected $signature = 'chatbot:check-inactivity';
    protected $description = 'Envía recordatorios de inactividad a clientes y agentes según configuración del chatbot';

    public function handle(): int
    {
        $chatbots = Chatbot::where('is_active', true)
            ->where(function ($q) {
                $q->where('client_inactivity_enabled', true)
                  ->orWhere('agent_inactivity_enabled', true);
            })
            ->get();

        if ($chatbots->isEmpty()) {
            return self::SUCCESS;
        }

        $bridge = app(WhatsAppBridgeService::class);
        $totalSent = 0;

        foreach ($chatbots as $chatbot) {
            // Respetar horario de atención
            if ($chatbot->business_hours_enabled && !$chatbot->isWithinBusinessHours()) {
                continue;
            }

            // Obtener la instancia de WhatsApp asociada
            $instance = WhatsAppInstance::where('instance_id', $chatbot->instance_id)
                ->where('is_active', true)
                ->first();

            if (!$instance) {
                continue;
            }

            // 1. Recordatorios de inactividad del CLIENTE
            if ($chatbot->client_inactivity_enabled && $chatbot->client_inactivity_message) {
                $totalSent += $this->checkClientInactivity($chatbot, $instance, $bridge);
            }

            // 2. Recordatorios de inactividad del AGENTE
            if ($chatbot->agent_inactivity_enabled && $chatbot->agent_inactivity_message) {
                $totalSent += $this->checkAgentInactivity($chatbot, $instance, $bridge);
            }
        }

        if ($totalSent > 0) {
            $this->info("Recordatorios enviados: {$totalSent}");
            Log::info("⏰ [INACTIVITY] Recordatorios enviados: {$totalSent}");
        }

        return self::SUCCESS;
    }

    /**
     * Recordatorio al cliente: el bot envió un mensaje y el cliente no respondió.
     * Condiciones:
     * - Conversación activa (no cerrada/resuelta)
     * - Último mensaje es del bot (outgoing)
     * - Han pasado >= X minutos desde el último mensaje del bot
     * - No han pasado más de 23 horas desde el último mensaje del cliente (ventana WhatsApp)
     * - No se ha enviado ya un recordatorio para esta conversación
     */
    private function checkClientInactivity(Chatbot $chatbot, WhatsAppInstance $instance, WhatsAppBridgeService $bridge): int
    {
        $minutes = $chatbot->client_inactivity_minutes;
        $cutoff = now()->subMinutes($minutes);
        $maxWindow = now()->subHours(23); // Límite ventana WhatsApp Cloud API

        // Buscar conversaciones del broker de esta instancia donde:
        // - Están activas
        // - El último mensaje fue hace más de X minutos
        // - No se ha enviado recordatorio aún
        // - El último mensaje del cliente fue dentro de las 23h
        $conversations = WhatsAppConversation::where('broker_id', $instance->broker_id)
            ->where('whatsapp_instance_id', $instance->id)
            ->whereNotIn('status', ['closed', 'resolved'])
            ->where('last_message_at', '<=', $cutoff)
            ->where('last_message_at', '>=', $maxWindow)
            ->whereNull('client_reminder_sent_at')
            ->limit(50)
            ->get();

        $sent = 0;

        foreach ($conversations as $conversation) {
            // Verificar que el último mensaje sea del bot o agente (no del cliente)
            $lastMessage = $conversation->messages()
                ->orderBy('created_at', 'desc')
                ->first();

            if (!$lastMessage) {
                continue;
            }

            // Solo enviar recordatorio si el último mensaje fue outgoing (bot o agente esperando respuesta del cliente)
            if ($lastMessage->direction !== 'outgoing') {
                continue;
            }

            // Verificar que el primer mensaje del cliente fue dentro de 23h (ventana WhatsApp)
            $lastClientMessage = $conversation->messages()
                ->where('direction', 'incoming')
                ->orderBy('created_at', 'desc')
                ->first();

            if (!$lastClientMessage || $lastClientMessage->created_at->lt($maxWindow)) {
                continue; // Ventana de 23h expirada, no podemos enviar
            }

            try {
                $result = $bridge->sendMessage(
                    $chatbot->instance_id,
                    $conversation->phone,
                    $chatbot->client_inactivity_message
                );

                if ($result['success'] ?? false) {
                    $conversation->update(['client_reminder_sent_at' => now()]);
                    $conversation->addMessage([
                        'message_id' => $result['messageId'] ?? null,
                        'direction' => 'outgoing',
                        'sender_type' => 'bot',
                        'message_type' => 'text',
                        'content' => $chatbot->client_inactivity_message,
                        'status' => 'sent',
                    ]);
                    $sent++;

                    Log::info("⏰ [CLIENT REMINDER] Enviado", [
                        'conversation_id' => $conversation->id,
                        'phone' => $conversation->phone,
                        'chatbot_id' => $chatbot->id,
                    ]);
                }
            } catch (\Throwable $e) {
                Log::warning("⏰ [CLIENT REMINDER] Error enviando", [
                    'conversation_id' => $conversation->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $sent;
    }

    /**
     * Recordatorio al agente (enviado al cliente): si un agente fue asignado y no ha contestado.
     * Condiciones:
     * - Conversación asignada a un agente
     * - Han pasado >= X minutos desde la asignación sin respuesta del agente
     * - No se ha enviado ya un recordatorio
     * - Dentro de ventana de 23h
     */
    private function checkAgentInactivity(Chatbot $chatbot, WhatsAppInstance $instance, WhatsAppBridgeService $bridge): int
    {
        $minutes = $chatbot->agent_inactivity_minutes;
        $cutoff = now()->subMinutes($minutes);
        $maxWindow = now()->subHours(23);

        // Conversaciones asignadas donde el agente no ha respondido
        $conversations = WhatsAppConversation::where('broker_id', $instance->broker_id)
            ->where('whatsapp_instance_id', $instance->id)
            ->where('status', 'assigned')
            ->whereNotNull('assigned_to')
            ->whereNotNull('assigned_at')
            ->where('assigned_at', '<=', $cutoff)
            ->whereNull('agent_reminder_sent_at')
            ->where('last_message_at', '>=', $maxWindow)
            ->limit(50)
            ->get();

        $sent = 0;

        foreach ($conversations as $conversation) {
            // Verificar que el agente NO ha enviado ningún mensaje después de ser asignado
            $agentMessageAfterAssignment = $conversation->messages()
                ->where('direction', 'outgoing')
                ->where('sender_type', 'agent')
                ->where('created_at', '>=', $conversation->assigned_at)
                ->exists();

            if ($agentMessageAfterAssignment) {
                continue; // El agente ya respondió
            }

            // Verificar ventana de 23h del último mensaje del cliente
            $lastClientMessage = $conversation->messages()
                ->where('direction', 'incoming')
                ->orderBy('created_at', 'desc')
                ->first();

            if (!$lastClientMessage || $lastClientMessage->created_at->lt($maxWindow)) {
                continue;
            }

            try {
                $result = $bridge->sendMessage(
                    $chatbot->instance_id,
                    $conversation->phone,
                    $chatbot->agent_inactivity_message
                );

                if ($result['success'] ?? false) {
                    $conversation->update(['agent_reminder_sent_at' => now()]);
                    $conversation->addMessage([
                        'message_id' => $result['messageId'] ?? null,
                        'direction' => 'outgoing',
                        'sender_type' => 'bot',
                        'message_type' => 'text',
                        'content' => $chatbot->agent_inactivity_message,
                        'status' => 'sent',
                    ]);
                    $sent++;

                    Log::info("⏰ [AGENT REMINDER] Enviado", [
                        'conversation_id' => $conversation->id,
                        'phone' => $conversation->phone,
                        'agent_id' => $conversation->assigned_to,
                        'chatbot_id' => $chatbot->id,
                    ]);
                }
            } catch (\Throwable $e) {
                Log::warning("⏰ [AGENT REMINDER] Error enviando", [
                    'conversation_id' => $conversation->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $sent;
    }
}
