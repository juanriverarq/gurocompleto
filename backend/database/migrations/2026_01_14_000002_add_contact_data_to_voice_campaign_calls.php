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
        Schema::table('voice_campaign_calls', function (Blueprint $table) {
            $table->json('contact_data')->nullable()->after('call_metadata');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('voice_campaign_calls', function (Blueprint $table) {
            $table->dropColumn('contact_data');
        });
    }
};
