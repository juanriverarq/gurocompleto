<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('voice_campaign_calls', function (Blueprint $table) {
            // Costos en COP (persistidos)
            $table->decimal('elevenlabs_cost_cop', 14, 2)->nullable()->after('elevenlabs_cost_usd');
            $table->decimal('twilio_cost_cop', 14, 2)->nullable()->after('twilio_cost_usd');
            $table->decimal('total_cost_cop', 14, 2)->nullable()->after('total_cost_usd');
            $table->decimal('total_cost_with_markup_cop', 14, 2)->nullable()->after('total_cost_with_markup_usd');
        });
    }

    public function down(): void
    {
        Schema::table('voice_campaign_calls', function (Blueprint $table) {
            $table->dropColumn([
                'elevenlabs_cost_cop',
                'twilio_cost_cop',
                'total_cost_cop',
                'total_cost_with_markup_cop',
            ]);
        });
    }
};


