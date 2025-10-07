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
        Schema::create('voice_campaigns', function (Blueprint $table) {
            $table->id();
            
            // Relación con broker
            $table->unsignedBigInteger('broker_id');
            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            
            // Información básica de la campaña
            $table->string('name');
            $table->text('description')->nullable();
            $table->enum('campaign_type', [
                'immediate', 'scheduled', 'policy_reminder', 
                'expired_policy', 'about_to_expire', 'follow_up', 'survey'
            ])->default('immediate');
            
            // Template del mensaje de voz
            $table->longText('voice_message_template');
            
            // Contactos objetivo (JSON)
            $table->json('contacts')->nullable();
            
            // Estado y control
            $table->enum('status', [
                'draft', 'scheduled', 'active', 'running', 
                'paused', 'completed', 'failed', 'cancelled'
            ])->default('draft');
            $table->boolean('is_active')->default(false);
            
            // Programación
            $table->timestamp('scheduled_date')->nullable();
            $table->timestamp('next_execution')->nullable();
            $table->timestamp('last_execution')->nullable();
            
            // Contadores
            $table->integer('total_targets')->default(0);
            $table->integer('calls_made')->default(0);
            $table->integer('calls_successful')->default(0);
            $table->integer('calls_failed')->default(0);
            $table->integer('total_duration_seconds')->default(0);
            $table->integer('average_duration_seconds')->default(0);
            
            // Configuración de triggers y filtros (JSON)
            $table->json('trigger_conditions')->nullable();
            $table->json('schedule_config')->nullable();
            $table->json('target_filters')->nullable();
            
            // Configuración específica de ElevenLabs
            $table->string('elevenlabs_agent_id')->nullable();
            $table->string('elevenlabs_phone_number_id')->nullable();
            $table->json('voice_settings')->nullable();
            
            // Auditoría
            $table->unsignedBigInteger('created_by')->nullable();
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            
            $table->timestamps();
            $table->softDeletes();
            
            // Índices
            $table->index(['broker_id', 'status']);
            $table->index(['broker_id', 'campaign_type']);
            $table->index(['broker_id', 'is_active']);
            $table->index('scheduled_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('voice_campaigns');
    }
};
