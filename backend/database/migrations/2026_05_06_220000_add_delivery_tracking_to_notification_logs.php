<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agrega columnas para trackear el estado real de entrega de WhatsApp
 * (delivered/read/failed_delivery) reportado por los webhooks de Meta a las
 * tres tablas de logs de notificaciones programadas.
 *
 * Antes el handler solo actualizaba `campaign_messages` y `whatsapp_conversation_messages`,
 * por lo que las notificaciones programadas quedaban eternamente como "sent"
 * (que solo significa "Meta aceptó la API call", no que llegó al usuario).
 */
return new class extends Migration {
    public function up(): void
    {
        foreach (['policy_notification_logs', 'automovil_notification_logs', 'client_notification_logs'] as $table) {
            if (!Schema::hasTable($table)) continue;
            Schema::table($table, function (Blueprint $t) use ($table) {
                if (!Schema::hasColumn($table, 'delivered_at')) {
                    $t->timestamp('delivered_at')->nullable()->after('sent_at');
                }
                if (!Schema::hasColumn($table, 'read_at')) {
                    $t->timestamp('read_at')->nullable()->after('delivered_at');
                }
                if (!Schema::hasColumn($table, 'delivery_failed_at')) {
                    $t->timestamp('delivery_failed_at')->nullable()->after('read_at');
                }
                if (!Schema::hasColumn($table, 'delivery_error')) {
                    $t->text('delivery_error')->nullable()->after('delivery_failed_at');
                }
            });
        }
    }

    public function down(): void
    {
        foreach (['policy_notification_logs', 'automovil_notification_logs', 'client_notification_logs'] as $table) {
            if (!Schema::hasTable($table)) continue;
            Schema::table($table, function (Blueprint $t) use ($table) {
                foreach (['delivered_at', 'read_at', 'delivery_failed_at', 'delivery_error'] as $col) {
                    if (Schema::hasColumn($table, $col)) {
                        $t->dropColumn($col);
                    }
                }
            });
        }
    }
};
