<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pagos_polizas', function (Blueprint $table) {
            $table->unsignedBigInteger('cartera_item_id')->nullable()->after('poliza_id')->index();
        });

        Schema::table('cobros_comisiones', function (Blueprint $table) {
            $table->unsignedBigInteger('cartera_item_id')->nullable()->after('poliza_id')->index();
        });
    }

    public function down(): void
    {
        Schema::table('pagos_polizas', function (Blueprint $table) {
            $table->dropColumn('cartera_item_id');
        });

        Schema::table('cobros_comisiones', function (Blueprint $table) {
            $table->dropColumn('cartera_item_id');
        });
    }
};
