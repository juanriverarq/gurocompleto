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
        Schema::table('vendedores', function (Blueprint $table) {
            if (!Schema::hasColumn('vendedores', 'porcentaje_retencion_iva')) {
                $table->decimal('porcentaje_retencion_iva', 5, 2)->default(0)->after('porcentaje_iva');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('vendedores', function (Blueprint $table) {
            $table->dropColumn('porcentaje_retencion_iva');
        });
    }
};
