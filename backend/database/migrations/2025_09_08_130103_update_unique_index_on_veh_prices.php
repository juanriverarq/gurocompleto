<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // No-op: mantener índices actuales para evitar conflictos con constraints.
    }

    public function down(): void
    {
        Schema::table('veh_prices', function (Blueprint $table) {
            try { $table->dropUnique('veh_prices_composite_unique'); } catch (\Throwable $e) {}
            $table->unique(['brand_id','model_id','line_id']);
        });
    }
};


