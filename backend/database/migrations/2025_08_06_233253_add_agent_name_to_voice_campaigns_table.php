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
        Schema::table('voice_campaigns', function (Blueprint $table) {
            $table->string('agent_name')->nullable()->after('elevenlabs_voice_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('voice_campaigns', function (Blueprint $table) {
            $table->dropColumn('agent_name');
        });
    }
};
