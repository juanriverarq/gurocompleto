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
        Schema::create('voice_campaign_triggers', function (Blueprint $table) {
            $table->id();

            // Relación con campaña de voz
            $table->unsignedBigInteger('voice_campaign_id');
            $table->foreign('voice_campaign_id')->references('id')->on('voice_campaigns')->onDelete('cascade');

            // Tipo de disparador
            $table->enum('type', ['new_client','new_policy','policy_expiry','new_lead','new_siniestro']);
            $table->boolean('enabled')->default(false);

            // Configuración flexible (JSON)
            $table->json('window_config')->nullable();   // days[], start, end, tz
            $table->json('limits')->nullable();          // daily_quota, dedup_days
            $table->json('filters')->nullable();         // filtros por tipo
            $table->json('expiry_offsets')->nullable();  // before_days[], after_days[] (solo policy_expiry)
            $table->json('mapping')->nullable();         // phone_field, alt_phone_field, variables

            // Estado operacional
            $table->timestamp('last_fired_at')->nullable();
            $table->string('status', 50)->nullable();

            // Auditoría simple
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();

            $table->timestamps();

            // Índices
            $table->index(['voice_campaign_id', 'type']);
            $table->index(['enabled']);
            $table->index(['last_fired_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('voice_campaign_triggers');
    }
};