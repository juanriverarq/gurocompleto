<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Corrige el FK de `automovil_notification_configs.whatsapp_instance_id`
 * que apuntaba a la tabla huérfana `whats_app_instances` en vez de la
 * real `whatsapp_instances`. Causaba 500 al guardar la config con error
 * "Integrity constraint violation: 1452 ... whats_app_instances".
 */
return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('automovil_notification_configs')) {
            return;
        }

        $existing = DB::selectOne(
            "SELECT REFERENCED_TABLE_NAME
             FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'automovil_notification_configs'
               AND COLUMN_NAME = 'whatsapp_instance_id'
               AND REFERENCED_TABLE_NAME IS NOT NULL
             LIMIT 1"
        );

        if (!$existing) {
            // No FK existente — crearlo apuntando a la tabla correcta.
            Schema::table('automovil_notification_configs', function ($table) {
                $table->foreign('whatsapp_instance_id')
                    ->references('id')->on('whatsapp_instances')
                    ->nullOnDelete();
            });
            return;
        }

        if ($existing->REFERENCED_TABLE_NAME === 'whatsapp_instances') {
            return; // ya está bien
        }

        // Drop el FK incorrecto y recrear apuntando a whatsapp_instances.
        Schema::table('automovil_notification_configs', function ($table) {
            $table->dropForeign('automovil_notification_configs_whatsapp_instance_id_foreign');
        });
        Schema::table('automovil_notification_configs', function ($table) {
            $table->foreign('whatsapp_instance_id')
                ->references('id')->on('whatsapp_instances')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        // No revertir — el estado anterior estaba roto.
    }
};
