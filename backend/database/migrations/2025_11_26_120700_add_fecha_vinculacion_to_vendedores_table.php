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
            if (!Schema::hasColumn('vendedores', 'fecha_vinculacion')) {
                $table->date('fecha_vinculacion')->nullable()->after('comisiones_diferentes_por_ano');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('vendedores', function (Blueprint $table) {
            $table->dropColumn('fecha_vinculacion');
        });
    }
};
