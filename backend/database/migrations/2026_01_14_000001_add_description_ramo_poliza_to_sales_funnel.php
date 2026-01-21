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
            $table->text('description')->nullable()->after('notes');
            $table->unsignedBigInteger('ramo_id')->nullable()->after('insurance_type');
            $table->unsignedBigInteger('poliza_id')->nullable()->after('ramo_id');
            $table->string('external_reference')->nullable()->after('policy_number');
            
            $table->foreign('ramo_id')->references('id')->on('ramos')->onDelete('set null');
            $table->foreign('poliza_id')->references('id')->on('polizas')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales_funnel', function (Blueprint $table) {
            $table->dropForeign(['ramo_id']);
            $table->dropForeign(['poliza_id']);
            $table->dropColumn(['description', 'ramo_id', 'poliza_id', 'external_reference']);
        });
    }
};
