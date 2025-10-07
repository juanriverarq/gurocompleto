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
        // Evitar error en entornos donde la tabla ya existe pero la migración no está registrada
        if (Schema::hasTable('campaign_templates')) {
            return;
        }

        Schema::create('campaign_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('content');
            $table->json('variables')->nullable(); // Variables disponibles en la plantilla
            $table->string('category')->default('general'); // reminder, promotion, welcome, etc.
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_default')->default(false); // Plantillas por defecto del sistema
            $table->unsignedBigInteger('broker_id'); // Plantillas específicas por broker
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();

            // Índices
            $table->index(['broker_id', 'is_active']);
            $table->index(['category', 'broker_id']);
            $table->index('is_default');

            // Foreign keys
            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('updated_by')->references('id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('campaign_templates');
    }
};
