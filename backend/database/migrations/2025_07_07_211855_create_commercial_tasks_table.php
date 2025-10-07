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
        Schema::create('commercial_tasks', function (Blueprint $table) {
            $table->id();
            
            // Relaciones principales
            $table->unsignedBigInteger('broker_id');
            $table->unsignedBigInteger('client_id')->nullable(); // Relación con cliente
            $table->unsignedBigInteger('poliza_id')->nullable(); // Relación con póliza si aplica
            $table->unsignedBigInteger('assigned_to')->nullable(); // Usuario asignado
            $table->unsignedBigInteger('created_by'); // Usuario que creó la tarea
            
            // Información básica de la tarea
            $table->string('title');
            $table->text('description')->nullable();
            $table->enum('type', [
                'seguimiento_cliente',
                'documentacion', 
                'inspeccion',
                'renovacion',
                'siniestro',
                'cotizacion',
                'llamada',
                'reunion',
                'email',
                'visita'
            ]);
            
            // Estado y prioridad
            $table->enum('status', [
                'pendiente',
                'en_progreso', 
                'completada',
                'vencida',
                'cancelada',
                'pausada'
            ])->default('pendiente');
            
            $table->enum('priority', [
                'baja',
                'media',
                'alta',
                'critica'
            ])->default('media');
            
            // Fechas importantes
            $table->datetime('due_date')->nullable(); // Fecha de vencimiento
            $table->datetime('started_at')->nullable(); // Cuándo se inició
            $table->datetime('completed_at')->nullable(); // Cuándo se completó
            $table->datetime('scheduled_for')->nullable(); // Fecha programada (para reuniones, llamadas)
            
            // Progreso y seguimiento
            $table->integer('progress_percentage')->default(0); // 0-100
            $table->text('notes')->nullable(); // Observaciones generales
            $table->json('activity_log')->nullable(); // Log de actividades realizadas
            
            // Información de contacto (si es tarea de comunicación)
            $table->string('contact_method')->nullable(); // phone, email, in_person, etc.
            $table->string('contact_phone')->nullable();
            $table->string('contact_email')->nullable();
            $table->text('contact_notes')->nullable();
            
            // Resultados y seguimiento
            $table->enum('result', [
                'exitoso',
                'sin_respuesta',
                'rechazado',
                'interesado',
                'reagendar',
                'completado',
                'cancelado'
            ])->nullable();
            
            $table->datetime('next_follow_up')->nullable(); // Próximo seguimiento
            $table->text('follow_up_notes')->nullable();
            
            // Recordatorios
            $table->boolean('has_reminder')->default(false);
            $table->datetime('reminder_at')->nullable();
            $table->boolean('reminder_sent')->default(false);
            
            // Archivos adjuntos y referencias
            $table->json('attachments')->nullable(); // URLs de archivos adjuntos
            $table->string('external_reference')->nullable(); // Referencia externa
            
            // Métricas de tiempo
            $table->integer('estimated_duration_minutes')->nullable(); // Duración estimada
            $table->integer('actual_duration_minutes')->nullable(); // Duración real
            
            // Auditoria
            $table->timestamps();
            $table->softDeletes();
            
            // Índices para optimizar consultas
            $table->index(['broker_id', 'status']);
            $table->index(['broker_id', 'assigned_to']);
            $table->index(['broker_id', 'client_id']);
            $table->index(['broker_id', 'type']);
            $table->index(['broker_id', 'priority']);
            $table->index(['broker_id', 'due_date']);
            $table->index(['broker_id', 'next_follow_up']);
            $table->index(['created_by']);
            $table->index(['poliza_id']);
            $table->index(['scheduled_for']);
            $table->index(['reminder_at']);
            
            // Foreign keys
            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            $table->foreign('client_id')->references('id')->on('clientes')->onDelete('cascade');
            $table->foreign('poliza_id')->references('id')->on('polizas')->onDelete('set null');
            $table->foreign('assigned_to')->references('id')->on('users')->onDelete('set null');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('commercial_tasks');
    }
};
