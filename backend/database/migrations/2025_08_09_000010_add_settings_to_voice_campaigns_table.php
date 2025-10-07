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
            if (!Schema::hasColumn('voice_campaigns', 'settings')) {
                $table->json('settings')->nullable()->after('voice_settings');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('voice_campaigns', function (Blueprint $table) {
            if (Schema::hasColumn('voice_campaigns', 'settings')) {
                $table->dropColumn('settings');
            }
        });
    }
};


