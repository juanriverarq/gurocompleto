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
            $table->string('elevenlabs_voice_id')->nullable()->after('elevenlabs_phone_number_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('voice_campaigns', function (Blueprint $table) {
            $table->dropColumn('elevenlabs_voice_id');
        });
    }
};
