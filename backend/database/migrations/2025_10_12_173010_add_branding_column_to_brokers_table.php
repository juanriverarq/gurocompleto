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
        Schema::table('brokers', function (Blueprint $table) {
            if (!Schema::hasColumn('brokers', 'branding')) {
                $table->json('branding')->nullable()->after('theme_settings');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('brokers', function (Blueprint $table) {
            if (Schema::hasColumn('brokers', 'branding')) {
                $table->dropColumn('branding');
            }
        });
    }
};
