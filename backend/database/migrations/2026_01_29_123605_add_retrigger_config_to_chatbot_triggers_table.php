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
        Schema::table('chatbot_triggers', function (Blueprint $table) {
            // Configuración de re-disparo
            $table->string('retrigger_mode')->default('session_expired')->after('conditions');
            // Modos: 'always', 'session_expired', 'cooldown', 'once_per_day', 'once_ever', 'manual_reset'
            
            $table->integer('cooldown_minutes')->nullable()->after('retrigger_mode');
            // Tiempo mínimo entre disparos (para modo 'cooldown')
            
            $table->json('schedule')->nullable()->after('cooldown_minutes');
            // Horarios en que el trigger está activo (ej: {"days": [1,2,3,4,5], "start": "09:00", "end": "18:00"})
            
            $table->boolean('reset_on_transfer')->default(true)->after('schedule');
            // Si se resetea el estado cuando la conversación se transfiere a un agente
            
            $table->boolean('reset_on_resolve')->default(true)->after('reset_on_transfer');
            // Si se resetea el estado cuando la conversación se resuelve
            
            $table->json('config')->nullable()->after('reset_on_resolve');
            // Configuración adicional (keywords, etc.)
        });

        // Tabla para tracking de disparos por contacto
        Schema::create('chatbot_trigger_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('trigger_id')->constrained('chatbot_triggers')->onDelete('cascade');
            $table->foreignId('chatbot_id')->constrained('chatbots')->onDelete('cascade');
            $table->string('instance_id');
            $table->string('contact_phone');
            $table->integer('trigger_count')->default(1);
            $table->timestamp('first_triggered_at')->nullable();
            $table->timestamp('last_triggered_at')->nullable();
            $table->timestamp('next_available_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['trigger_id', 'instance_id', 'contact_phone'], 'trigger_contact_unique');
            $table->index(['instance_id', 'contact_phone']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('chatbot_trigger_logs');
        
        Schema::table('chatbot_triggers', function (Blueprint $table) {
            $table->dropColumn([
                'retrigger_mode',
                'cooldown_minutes',
                'schedule',
                'reset_on_transfer',
                'reset_on_resolve',
                'config'
            ]);
        });
    }
};
