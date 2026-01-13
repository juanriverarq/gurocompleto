<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscription_intents', function (Blueprint $table) {
            $table->json('coupon')->nullable()->after('source');
        });
    }

    public function down(): void
    {
        Schema::table('subscription_intents', function (Blueprint $table) {
            $table->dropColumn('coupon');
        });
    }
};
