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
        if (Schema::hasTable('voice_campaign_trigger_logs')) {
            return;
        }
        Schema::create('voice_campaign_trigger_logs', function (Blueprint $table) {
            $table->id();

            // Contexto de broker y campaña
            $table->unsignedBigInteger('broker_id');
            $table->unsignedBigInteger('voice_campaign_id');
            $table->unsignedBigInteger('trigger_id');

            // Entidad que originó el disparo (flexible para distintos orígenes y pruebas)
            $table->string('entity_type', 50)->nullable();
            $table->string('entity_id', 64)->nullable();

            // Hash de deduplicación (tipo+entidad+campaign+trigger+ventana)
            $table->string('dedup_hash', 191)->index();

            // Momento de disparo evaluado
            $table->timestamp('fired_at')->nullable()->index();

            // Resultado de la evaluación
            $table->enum('result', [
                'success',
                'skip_dedup',
                'skip_window',
                'skip_filters',
                'skip_quota',
                'error'
            ])->default('success')->index();

            // Información adicional
            $table->text('reason')->nullable();
            $table->unsignedBigInteger('voice_campaign_call_id')->nullable();

            // Snapshot de payload/entidad al momento del disparo
            $table->json('payload')->nullable();

            $table->timestamps();

            // Relaciones (FK suaves donde aplica)
            $table->foreign('voice_campaign_id')->references('id')->on('voice_campaigns')->onDelete('cascade');
            $table->foreign('voice_campaign_call_id')->references('id')->on('voice_campaign_calls')->onDelete('set null');
            $table->foreign('trigger_id')->references('id')->on('voice_campaign_triggers')->onDelete('cascade');

            // Índices (optimizan consultas de dedup y cuota diaria) - nombres cortos para MySQL (<=64 chars)
            $table->index(['broker_id', 'voice_campaign_id'], 'vctl_bvc_idx');
            $table->index(['trigger_id', 'entity_type', 'entity_id'], 'vctl_tid_ent_idx');
            $table->index(['broker_id', 'result', 'created_at'], 'vctl_brc_idx');
            $table->index(['trigger_id', 'fired_at'], 'vctl_tid_fired_idx');
            $table->index(['trigger_id', 'result', 'fired_at'], 'vctl_tid_res_fired_idx');
            $table->index(['dedup_hash', 'fired_at'], 'vctl_dedup_fired_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('voice_campaign_trigger_logs');
    }
};