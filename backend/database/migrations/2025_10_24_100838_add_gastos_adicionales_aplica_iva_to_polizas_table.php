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
        Schema::table('polizas', function (Blueprint $table) {
            // Agregar campo para indicar si los gastos adicionales aplican IVA
            // Por defecto false (no aplica IVA)
            $table->boolean('gastos_adicionales_aplica_iva')->default(false)->after('gastos_adicionales');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('polizas', function (Blueprint $table) {
            $table->dropColumn('gastos_adicionales_aplica_iva');
        });
    }
};
