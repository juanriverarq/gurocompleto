<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('client_notification_configs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('broker_id')->constrained('brokers')->onDelete('cascade');
            $table->foreignId('whatsapp_instance_id')->nullable()->constrained('whatsapp_instances')->onDelete('set null');
            $table->boolean('is_active')->default(false);
            $table->string('name')->default('Notificaciones de Clientes');

            // Tipos de notificación
            $table->boolean('notify_birthday')->default(true);
            $table->boolean('notify_workers_day')->default(false);
            $table->boolean('notify_womens_day')->default(false);
            $table->boolean('notify_mens_day')->default(false);
            $table->boolean('notify_advisor_day')->default(false);

            // Plantillas de Meta (nombre de template seleccionado)
            $table->string('birthday_template')->nullable();
            $table->string('workers_day_template')->nullable();
            $table->string('womens_day_template')->nullable();
            $table->string('mens_day_template')->nullable();
            $table->string('advisor_day_template')->nullable();

            // Fechas fijas para días especiales (mes-día)
            $table->string('workers_day_date')->default('05-01'); // 1 de mayo
            $table->string('womens_day_date')->default('03-08');  // 8 de marzo
            $table->string('mens_day_date')->default('03-19');    // 19 de marzo
            $table->string('advisor_day_date')->default('09-15'); // 15 de septiembre

            // Configuración de envío
            $table->time('send_time')->default('09:00:00');
            $table->integer('max_notifications_per_day')->default(100);

            // Destinatarios
            $table->boolean('send_to_client_phone')->default(true);
            $table->boolean('send_to_client_mobile')->default(true);

            // Exclusiones
            $table->json('excluded_client_ids')->nullable();

            // Stats
            $table->integer('total_sent')->default(0);
            $table->integer('total_failed')->default(0);
            $table->timestamp('last_execution_at')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('updated_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();

            $table->unique('broker_id');
        });

        Schema::create('client_notification_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('broker_id')->constrained('brokers')->onDelete('cascade');
            $table->foreignId('client_notification_config_id')->nullable()->constrained('client_notification_configs')->onDelete('set null');
            $table->foreignId('client_id')->nullable()->constrained('clientes')->onDelete('set null');
            $table->foreignId('whatsapp_instance_id')->nullable()->constrained('whatsapp_instances')->onDelete('set null');
            $table->string('notification_type'); // birthday, workers_day, womens_day, mens_day, advisor_day
            $table->string('recipient_phone');
            $table->text('message_sent')->nullable();
            $table->string('template_name')->nullable();
            $table->string('status')->default('pending'); // pending, sent, failed, skipped
            $table->string('whatsapp_message_id')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index(['broker_id', 'notification_type', 'created_at'], 'cn_logs_broker_type_date_idx');
            $table->index(['client_id', 'notification_type', 'created_at'], 'cn_logs_client_type_date_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('client_notification_logs');
        Schema::dropIfExists('client_notification_configs');
    }
};
