<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pagos_polizas', function (Blueprint $table) {
            $table->unsignedBigInteger('recibo_caja_id')->nullable()->after('recaudo_import_id');
            $table->string('source', 30)->default('guro')->after('recibo_caja_id');
            $table->index('recibo_caja_id');
            $table->index('source');
        });

        Schema::table('cobros_comisiones', function (Blueprint $table) {
            $table->unsignedBigInteger('recibo_caja_id')->nullable()->after('pago_poliza_id');
            $table->string('source', 30)->default('guro')->after('recibo_caja_id');
            $table->index('recibo_caja_id');
            $table->index('source');
        });
    }

    public function down(): void
    {
        Schema::table('pagos_polizas', function (Blueprint $table) {
            $table->dropIndex(['recibo_caja_id']);
            $table->dropIndex(['source']);
            $table->dropColumn(['recibo_caja_id', 'source']);
        });

        Schema::table('cobros_comisiones', function (Blueprint $table) {
            $table->dropIndex(['recibo_caja_id']);
            $table->dropIndex(['source']);
            $table->dropColumn(['recibo_caja_id', 'source']);
        });
    }
};
