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
        Schema::create('voice_campaign_executions', function (Blueprint $table) {
            $table->id();
            
            // Relación con la campaña de voz
            $table->unsignedBigInteger('voice_campaign_id');
            $table->foreign('voice_campaign_id')->references('id')->on('voice_campaigns')->onDelete('cascade');
            
            // Relación con el broker
            $table->unsignedBigInteger('broker_id');
            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            
            // Información de la ejecución
            $table->timestamp('execution_date');
            $table->enum('status', [
                'pending', 'running', 'completed', 'failed', 'cancelled', 'scheduled'
            ])->default('pending');
            
            // Timestamps de control
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            
            // Contadores de la ejecución
            $table->integer('targets_found')->default(0);
            $table->integer('calls_made')->default(0);
            $table->integer('calls_successful')->default(0);
            $table->integer('calls_failed')->default(0);
            $table->integer('total_duration_seconds')->default(0);
            $table->integer('average_duration_seconds')->default(0);
            
            // Error handling
            $table->text('error_message')->nullable();
            
            // Detalles de la ejecución (JSON)
            $table->json('execution_details')->nullable();
            
            // IDs de ElevenLabs usados en esta ejecución
            $table->string('elevenlabs_agent_id_used')->nullable();
            $table->string('elevenlabs_phone_number_id_used')->nullable();
            
            $table->timestamps();
            
            // Índices
            $table->index(['voice_campaign_id', 'status']);
            $table->index(['broker_id', 'execution_date']);
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('voice_campaign_executions');
    }
};
