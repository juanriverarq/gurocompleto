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
        Schema::table('sales_funnel', function (Blueprint $table) {
            if (!Schema::hasColumn('sales_funnel', 'business_state')) {
                $table->enum('business_state', [
                    'nuevo',
                    'contactado',
                    'interesado',
                    'negociando',
                    'cerrado'
                ])->default('nuevo')->after('stage');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales_funnel', function (Blueprint $table) {
            $table->dropColumn('business_state');
        });
    }
};
