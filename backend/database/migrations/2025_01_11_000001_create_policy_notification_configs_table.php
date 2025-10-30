<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('policy_notification_configs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('broker_id')->constrained('brokers')->onDelete('cascade');
            $table->foreignId('whatsapp_instance_id')->nullable()->constrained('whats_app_instances')->onDelete('set null');
            
            // Configuración general
            $table->boolean('is_active')->default(true);
            $table->string('name')->default('Notificaciones de Pólizas');
            $table->text('description')->nullable();
            
            // Tipos de notificaciones
            $table->boolean('notify_expiration')->default(true);
            $table->boolean('notify_renewal')->default(true);
            $table->boolean('notify_payment_due')->default(true);
            
            // Días de anticipación
            $table->integer('expiration_days_before')->default(30); // Días antes del vencimiento
            $table->integer('renewal_days_before')->default(45); // Días antes de renovación
            $table->integer('payment_days_before')->default(7); // Días antes del pago
            
            // Plantillas de mensajes
            $table->text('expiration_template')->nullable();
            $table->text('renewal_template')->nullable();
            $table->text('payment_template')->nullable();
            
            // Horario de envío
            $table->time('send_time')->default('09:00:00'); // Hora del día para enviar
            $table->json('send_days')->nullable(); // Días de la semana [1,2,3,4,5] (Lun-Vie)
            
            // Exclusiones
            $table->json('excluded_client_ids')->nullable(); // IDs de clientes excluidos
            $table->json('excluded_policy_types')->nullable(); // Tipos de póliza excluidos
            $table->json('excluded_policy_statuses')->nullable(); // Estados de póliza excluidos
            
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
            
            // Índices
            $table->index(['broker_id', 'is_active']);
            $table->index('next_execution_at');
        });
        
        // Tabla para registro de notificaciones enviadas
        Schema::create('policy_notification_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('broker_id')->constrained('brokers')->onDelete('cascade');
            $table->foreignId('policy_notification_config_id')->constrained('policy_notification_configs')->onDelete('cascade');
            $table->foreignId('poliza_id')->constrained('polizas')->onDelete('cascade');
            $table->foreignId('client_id')->nullable()->constrained('clientes')->onDelete('set null');
            $table->foreignId('whatsapp_instance_id')->nullable()->constrained('whats_app_instances')->onDelete('set null');
            
            // Información de la notificación
            $table->enum('notification_type', ['expiration', 'renewal', 'payment_due'])->index();
            $table->string('recipient_phone');
            $table->text('message_sent');
            
            // Estado del envío
            $table->enum('status', ['pending', 'sent', 'failed', 'skipped'])->default('pending')->index();
            $table->string('whatsapp_message_id')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            
            // Datos de contexto
            $table->json('policy_data')->nullable(); // Snapshot de datos de la póliza
            $table->json('metadata')->nullable();
            
            $table->timestamps();
            
            // Índices
            $table->index(['broker_id', 'status']);
            $table->index(['poliza_id', 'notification_type']);
            $table->index('sent_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('policy_notification_logs');
        Schema::dropIfExists('policy_notification_configs');
    }
};