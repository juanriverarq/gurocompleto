<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('automoviles', function (Blueprint $table) {
            $table->unsignedBigInteger('brand_id')->nullable()->after('pais_origen');
            $table->unsignedBigInteger('model_id')->nullable()->after('brand_id');
            $table->unsignedBigInteger('line_id')->nullable()->after('model_id');
            $table->index(['brand_id','model_id','line_id']);
            $table->foreign('brand_id')->references('id')->on('veh_brands')->onDelete('set null');
            $table->foreign('model_id')->references('id')->on('veh_models')->onDelete('set null');
            $table->foreign('line_id')->references('id')->on('veh_lines')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('automoviles', function (Blueprint $table) {
            $table->dropForeign(['brand_id']);
            $table->dropForeign(['model_id']);
            $table->dropForeign(['line_id']);
            $table->dropColumn(['brand_id','model_id','line_id']);
        });
    }
};


