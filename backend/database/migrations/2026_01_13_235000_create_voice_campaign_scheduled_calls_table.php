<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tabla para programar llamadas futuras basadas en objetivos de campaña.
     * 
     * Flujo:
     * 1. Usuario crea campaña con objetivo (ej: "Recordatorio de Pago")
     * 2. Sistema busca clientes que aplican y crea registros aquí
     * 3. Job diario revisa llamadas programadas para hoy y las ejecuta
     */
    public function up(): void
    {
        Schema::create('voice_campaign_scheduled_calls', function (Blueprint $table) {
            $table->id();
            $table->foreignId('voice_campaign_id')->constrained('voice_campaigns')->onDelete('cascade');
            $table->foreignId('broker_id')->constrained('brokers')->onDelete('cascade');
            $table->foreignId('client_id')->nullable()->constrained('clientes')->onDelete('set null');
            $table->foreignId('poliza_id')->nullable()->constrained('polizas')->onDelete('set null');
            
            // Programación
            $table->date('scheduled_date')->index();
            $table->time('scheduled_time')->nullable();
            $table->string('reason', 100)->nullable(); // 'payment_due_7_days', 'payment_overdue_1_day', etc.
            
            // Estado
            $table->enum('status', ['pending', 'queued', 'called', 'completed', 'skipped', 'failed', 'cancelled'])
                  ->default('pending');
            $table->text('status_reason')->nullable(); // Razón del skip/fail
            
            // Datos del contacto (snapshot para la llamada)
            $table->json('contact_data')->nullable();
            
            // Resultado
            $table->timestamp('queued_at')->nullable();
            $table->timestamp('called_at')->nullable();
            $table->foreignId('voice_campaign_call_id')->nullable()
                  ->constrained('voice_campaign_calls')->onDelete('set null');
            
            // Prioridad y reintentos
            $table->tinyInteger('priority')->default(5); // 1-10, menor = más prioritario
            $table->tinyInteger('retry_count')->default(0);
            $table->tinyInteger('max_retries')->default(3);
            
            $table->timestamps();
            
            // Índices para consultas frecuentes
            $table->index(['broker_id', 'scheduled_date', 'status'], 'vc_sched_broker_date_status');
            $table->index(['voice_campaign_id', 'status'], 'vc_sched_campaign_status');
            $table->index(['client_id', 'scheduled_date'], 'vc_sched_client_date');
            
            // Evitar duplicados: mismo cliente, misma campaña, misma fecha
            $table->unique(['voice_campaign_id', 'client_id', 'scheduled_date'], 'vc_sched_unique_camp_client_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('voice_campaign_scheduled_calls');
    }
};
