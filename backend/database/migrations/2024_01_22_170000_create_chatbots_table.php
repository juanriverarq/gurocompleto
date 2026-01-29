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
        Schema::create('chatbots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('broker_id')->constrained('brokers')->onDelete('cascade');
            $table->string('instance_id', 100)->nullable()->index();
            $table->string('name', 100);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            
            // Mensajes predeterminados
            $table->text('welcome_message')->nullable();
            $table->text('fallback_message')->nullable();
            $table->text('goodbye_message')->nullable();
            $table->text('out_of_hours_message')->nullable();
            
            // Configuración de IA
            $table->boolean('ai_enabled')->default(false);
            $table->enum('ai_provider', ['openai', 'claude', 'none'])->default('none');
            $table->string('ai_model', 50)->nullable();
            $table->text('ai_system_prompt')->nullable();
            $table->decimal('ai_temperature', 2, 1)->default(0.7);
            $table->integer('ai_max_tokens')->default(500);
            
            // Configuración de comportamiento
            $table->integer('typing_delay_ms')->default(1500);
            $table->integer('response_delay_ms')->default(500);
            $table->integer('session_timeout_minutes')->default(30);
            $table->integer('max_fallback_count')->default(3);
            
            // Horarios de atención
            $table->boolean('business_hours_enabled')->default(false);
            $table->json('business_hours')->nullable();
            $table->string('timezone', 50)->default('America/Bogota');
            
            $table->timestamps();
            
            $table->index(['broker_id', 'is_active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('chatbots');
    }
};
