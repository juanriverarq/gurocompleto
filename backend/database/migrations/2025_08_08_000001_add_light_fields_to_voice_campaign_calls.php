<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('voice_campaign_calls', function (Blueprint $table) {
            // Datos ligeros persistidos
            $table->text('transcript_excerpt')->nullable()->after('call_transcript');
            $table->boolean('has_audio')->default(false)->after('transcript_excerpt');
            $table->boolean('is_enriched')->default(false)->after('has_audio');

            // Costos persistidos
            $table->decimal('elevenlabs_cost_usd', 12, 6)->nullable()->after('call_metadata');
            $table->decimal('elevenlabs_credits', 12, 6)->nullable()->after('elevenlabs_cost_usd');
            $table->integer('twilio_minutes')->nullable()->after('elevenlabs_credits');
            $table->decimal('twilio_cost_usd', 12, 6)->nullable()->after('twilio_minutes');
            $table->decimal('total_cost_usd', 12, 6)->nullable()->after('twilio_cost_usd');
            $table->decimal('total_cost_with_markup_usd', 12, 6)->nullable()->after('total_cost_usd');

            // Índices útiles
            $table->index(['broker_id', 'status', 'created_at'], 'idx_calls_broker_status_created');
            $table->index(['voice_campaign_id', 'created_at'], 'idx_calls_campaign_created');
            $table->index('elevenlabs_agent_id', 'idx_calls_agent');
        });
    }

    public function down(): void
    {
        Schema::table('voice_campaign_calls', function (Blueprint $table) {
            $table->dropColumn([
                'transcript_excerpt', 'has_audio', 'is_enriched',
                'elevenlabs_cost_usd', 'elevenlabs_credits', 'twilio_minutes', 'twilio_cost_usd',
                'total_cost_usd', 'total_cost_with_markup_usd'
            ]);
            $table->dropIndex('idx_calls_broker_status_created');
            $table->dropIndex('idx_calls_campaign_created');
            $table->dropIndex('idx_calls_agent');
        });
    }
};


