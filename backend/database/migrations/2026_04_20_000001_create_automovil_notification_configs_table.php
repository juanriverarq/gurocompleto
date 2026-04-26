<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Agregar exclusión de ramos a la config de pólizas existente
        Schema::table('policy_notification_configs', function (Blueprint $table) {
            if (!Schema::hasColumn('policy_notification_configs', 'excluded_ramo_ids')) {
                $table->json('excluded_ramo_ids')->nullable()->after('excluded_policy_statuses');
            }
        });

        // 2. Config de notificaciones de automóviles (SOAT + RTM)
        if (!Schema::hasTable('automovil_notification_configs')) {
            Schema::create('automovil_notification_configs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('broker_id')->constrained('brokers')->onDelete('cascade');
                $table->foreignId('whatsapp_instance_id')->nullable()->constrained('whats_app_instances')->onDelete('set null');

                // General
                $table->boolean('is_active')->default(false);
                $table->string('name')->default('Notificaciones de Automóviles');
                $table->text('description')->nullable();

                // Tipos de notificaciones
                $table->boolean('notify_soat')->default(true);
                $table->boolean('notify_rtm')->default(true);

                // Días de anticipación (múltiples)
                $table->integer('soat_days_before')->default(30);
                $table->integer('rtm_days_before')->default(30);
                $table->json('soat_days_before_multiple')->nullable();
                $table->json('rtm_days_before_multiple')->nullable();

                // Plantillas
                $table->text('soat_template')->nullable();
                $table->text('rtm_template')->nullable();

                // Horario
                $table->time('send_time')->default('09:00:00');
                $table->json('send_days')->nullable();

                // Exclusiones
                $table->json('excluded_client_ids')->nullable();
                $table->json('excluded_automovil_ids')->nullable();
                $table->json('excluded_vehicle_classes')->nullable(); // AUTOMOVIL, MOTOCICLETA, CAMPERO...

                // Configuración avanzada
                $table->boolean('send_to_client_phone')->default(true);
                $table->boolean('send_to_client_mobile')->default(true);
                $table->boolean('send_to_assigned_user')->default(false);
                $table->integer('max_notifications_per_day')->default(50);
                $table->boolean('skip_weekends')->default(true);
                $table->boolean('skip_holidays')->default(false);

                // Estadísticas
                $table->integer('total_sent')->default(0);
                $table->integer('total_failed')->default(0);
                $table->timestamp('last_execution_at')->nullable();
                $table->timestamp('next_execution_at')->nullable();

                // Auditoría
                $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
                $table->foreignId('updated_by')->nullable()->constrained('users')->onDelete('set null');

                $table->timestamps();
                $table->softDeletes();

                $table->index(['broker_id', 'is_active']);
                $table->index('next_execution_at');
            });
        }

        // 3. Logs de notificaciones de automóviles
        if (!Schema::hasTable('automovil_notification_logs')) {
            Schema::create('automovil_notification_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('broker_id')->constrained('brokers')->onDelete('cascade');
                $table->unsignedBigInteger('automovil_notification_config_id');
                $table->foreign('automovil_notification_config_id', 'auto_notif_config_id_fk')
                      ->references('id')->on('automovil_notification_configs')->onDelete('cascade');
                $table->foreignId('automovil_id')->constrained('automoviles')->onDelete('cascade');
                $table->foreignId('client_id')->nullable()->constrained('clientes')->onDelete('set null');
                $table->foreignId('whatsapp_instance_id')->nullable()->constrained('whats_app_instances')->onDelete('set null');

                $table->enum('notification_type', ['soat', 'rtm'])->index();
                $table->string('recipient_phone');
                $table->text('message_sent');

                $table->enum('status', ['pending', 'sent', 'failed', 'skipped'])->default('pending')->index();
                $table->string('whatsapp_message_id')->nullable();
                $table->text('error_message')->nullable();
                $table->timestamp('sent_at')->nullable();
                $table->timestamp('failed_at')->nullable();

                $table->json('automovil_data')->nullable();
                $table->json('metadata')->nullable();

                $table->timestamps();

                $table->index(['broker_id', 'status']);
                $table->index(['automovil_id', 'notification_type']);
                $table->index('sent_at');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('automovil_notification_logs');
        Schema::dropIfExists('automovil_notification_configs');
        Schema::table('policy_notification_configs', function (Blueprint $table) {
            if (Schema::hasColumn('policy_notification_configs', 'excluded_ramo_ids')) {
                $table->dropColumn('excluded_ramo_ids');
            }
        });
    }
};
