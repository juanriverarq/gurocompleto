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
        Schema::create('voice_campaign_calls', function (Blueprint $table) {
            $table->id();
            
            // Relación con la campaña de voz
            $table->unsignedBigInteger('voice_campaign_id');
            $table->foreign('voice_campaign_id')->references('id')->on('voice_campaigns')->onDelete('cascade');
            
            // Relación con la ejecución de la campaña
            $table->unsignedBigInteger('voice_campaign_execution_id');
            $table->foreign('voice_campaign_execution_id')->references('id')->on('voice_campaign_executions')->onDelete('cascade');
            
            // Relación con el broker
            $table->unsignedBigInteger('broker_id');
            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            
            // Información del destinatario
            $table->string('recipient_phone');
            $table->string('recipient_name')->nullable();
            
            // Mensaje de voz personalizado
            $table->longText('voice_message_content');
            
            // Estado de la llamada
            $table->enum('status', [
                'pending', 'initiated', 'ringing', 'answered', 'in_progress',
                'completed', 'failed', 'no_answer', 'busy', 'cancelled'
            ])->default('pending');
            
            // Timestamps de la llamada
            $table->timestamp('call_initiated_at')->nullable();
            $table->timestamp('call_answered_at')->nullable();
            $table->timestamp('call_ended_at')->nullable();
            
            // Duración de la llamada
            $table->integer('duration_seconds')->default(0);
            
            // IDs de ElevenLabs
            $table->string('elevenlabs_conversation_id')->nullable();
            $table->string('elevenlabs_call_id')->nullable();
            $table->string('elevenlabs_agent_id')->nullable();
            $table->string('elevenlabs_phone_number_id')->nullable();
            
            // Resultado y transcript de la llamada
            $table->json('call_result')->nullable();
            $table->longText('call_transcript')->nullable();
            $table->string('call_recording_url')->nullable();
            
            // Error handling y reintentos
            $table->text('error_message')->nullable();
            $table->integer('retry_count')->default(0);
            
            // Metadatos adicionales
            $table->json('call_metadata')->nullable();
            
            $table->timestamps();
            
            // Índices
            $table->index(['voice_campaign_id', 'status']);
            $table->index(['voice_campaign_execution_id', 'status']);
            $table->index(['broker_id', 'recipient_phone']);
            $table->index('status');
            $table->index('call_initiated_at');
            $table->index(['recipient_phone', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('voice_campaign_calls');
    }
};
