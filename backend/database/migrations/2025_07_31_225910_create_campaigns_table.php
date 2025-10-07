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
        Schema::create('campaigns', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->enum('campaign_type', ['immediate', 'scheduled', 'policy_reminder', 'expired_policy', 'about_to_expire']);
            $table->text('message_template');
            $table->json('contacts')->nullable(); // Para campañas inmediatas
            $table->datetime('scheduled_date')->nullable(); // Para campañas programadas
            $table->json('trigger_conditions')->nullable(); // Para campañas basadas en pólizas
            $table->json('schedule_config')->nullable(); // Configuración de programación
            $table->json('target_filters')->nullable(); // Filtros para campañas de pólizas
            $table->enum('status', ['draft', 'active', 'scheduled', 'sending', 'paused', 'completed', 'cancelled'])->default('draft');
            $table->boolean('is_active')->default(true);
            $table->integer('total_targets')->default(0);
            $table->integer('sent_count')->default(0);
            $table->integer('delivered_count')->default(0);
            $table->integer('failed_count')->default(0);
            $table->timestamp('last_execution')->nullable();
            $table->timestamp('next_execution')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            
            $table->index(['campaign_type', 'status']);
            $table->index(['is_active']);
            $table->index(['scheduled_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('campaigns');
    }
};
