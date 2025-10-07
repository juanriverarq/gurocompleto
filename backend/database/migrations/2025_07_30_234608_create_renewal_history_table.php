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
        Schema::create('renewal_history', function (Blueprint $table) {
            $table->id();
            
            // Referencias
            $table->unsignedBigInteger('poliza_id');
            $table->unsignedBigInteger('broker_id');
            $table->unsignedBigInteger('user_id')->nullable(); // Usuario que realizó la acción
            
            // Tipo de acción en el historial
            $table->enum('action_type', [
                'contact', 'observation', 'status_change', 'renewal_processed', 
                'reminder_sent', 'document_uploaded', 'meeting_scheduled',
                'quote_requested', 'quote_received', 'negotiation'
            ]);
            
            // Detalles del contacto (si aplica)
            $table->enum('contact_type', [
                'phone_call', 'email', 'whatsapp', 'in_person', 'sms', 'video_call'
            ])->nullable();
            
            $table->enum('contact_result', [
                'successful', 'no_answer', 'busy', 'unreachable', 'callback_requested',
                'interested', 'not_interested', 'needs_info', 'quote_requested', 'complaint'
            ])->nullable();
            
            // Detalles de la acción
            $table->string('title', 200); // Título/resumen de la acción
            $table->text('description')->nullable(); // Descripción detallada
            $table->json('metadata')->nullable(); // Datos adicionales (JSON)
            
            // Seguimiento
            $table->datetime('next_contact_date')->nullable();
            $table->enum('priority', ['low', 'medium', 'high', 'critical'])->default('medium');
            $table->enum('status', ['active', 'completed', 'cancelled'])->default('active');
            
            // Archivos adjuntos (opcional)
            $table->string('attachment_path')->nullable();
            $table->string('attachment_name')->nullable();
            
            $table->timestamps();
            
            // Índices
            $table->foreign('poliza_id')->references('id')->on('polizas')->onDelete('cascade');
            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
            
            $table->index(['poliza_id', 'created_at']);
            $table->index(['broker_id', 'action_type']);
            $table->index(['next_contact_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('renewal_history');
    }
};
