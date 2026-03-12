<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chatbots', function (Blueprint $table) {
            // Recordatorio de inactividad del cliente
            $table->boolean('client_inactivity_enabled')->default(false)->after('timezone');
            $table->integer('client_inactivity_minutes')->default(10)->after('client_inactivity_enabled');
            $table->text('client_inactivity_message')->nullable()->after('client_inactivity_minutes');

            // Recordatorio de inactividad del agente asignado
            $table->boolean('agent_inactivity_enabled')->default(false)->after('client_inactivity_message');
            $table->integer('agent_inactivity_minutes')->default(5)->after('agent_inactivity_enabled');
            $table->text('agent_inactivity_message')->nullable()->after('agent_inactivity_minutes');

            // Tracking: último envío de recordatorio por conversación (para no re-enviar)
            // Se maneja en whatsapp_conversations con campos adicionales
        });

        // Campos de tracking en conversaciones
        Schema::table('whatsapp_conversations', function (Blueprint $table) {
            $table->timestamp('client_reminder_sent_at')->nullable()->after('resolved_at');
            $table->timestamp('agent_reminder_sent_at')->nullable()->after('client_reminder_sent_at');
        });
    }

    public function down(): void
    {
        Schema::table('chatbots', function (Blueprint $table) {
            $table->dropColumn([
                'client_inactivity_enabled',
                'client_inactivity_minutes',
                'client_inactivity_message',
                'agent_inactivity_enabled',
                'agent_inactivity_minutes',
                'agent_inactivity_message',
            ]);
        });

        Schema::table('whatsapp_conversations', function (Blueprint $table) {
            $table->dropColumn(['client_reminder_sent_at', 'agent_reminder_sent_at']);
        });
    }
};
