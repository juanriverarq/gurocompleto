<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recibos_caja', function (Blueprint $table) {
            $table->unsignedBigInteger('pago_poliza_id')->nullable()->after('cliente_id');
            $table->index('pago_poliza_id', 'idx_recibos_pago_poliza_id');
        });
    }

    public function down(): void
    {
        Schema::table('recibos_caja', function (Blueprint $table) {
            $table->dropIndex('idx_recibos_pago_poliza_id');
            $table->dropColumn('pago_poliza_id');
        });
    }
};
