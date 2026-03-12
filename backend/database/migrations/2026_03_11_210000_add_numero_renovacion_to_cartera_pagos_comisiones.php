<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add numero_renovacion to cartera_items (if not exists)
        if (!Schema::hasColumn('cartera_items', 'numero_renovacion')) {
            Schema::table('cartera_items', function (Blueprint $table) {
                $table->unsignedInteger('numero_renovacion')->default(0)->after('poliza_id')
                      ->comment('Renewal period: 0=original, 1=R1, 2=R2, etc.');
                $table->index(['poliza_id', 'numero_renovacion']);
            });
        }

        // Add numero_renovacion to pagos_polizas (if not exists)
        if (!Schema::hasColumn('pagos_polizas', 'numero_renovacion')) {
            Schema::table('pagos_polizas', function (Blueprint $table) {
                $table->unsignedInteger('numero_renovacion')->default(0)->after('poliza_id')
                      ->comment('Renewal period this payment belongs to');
            });
        }

        // Add numero_renovacion to cobros_comisiones (if not exists)
        if (!Schema::hasColumn('cobros_comisiones', 'numero_renovacion')) {
            Schema::table('cobros_comisiones', function (Blueprint $table) {
                $table->unsignedInteger('numero_renovacion')->default(0)->after('poliza_id')
                      ->comment('Renewal period this commission belongs to');
            });
        }

        // NOTA: No se hace backfill. Los registros existentes quedan con numero_renovacion=0
        // (default) porque pertenecen al período original. Solo los registros nuevos
        // creados después de una renovación recibirán numero_renovacion > 0 automáticamente
        // via el boot() de PagoPoliza/CobroComision o el INSERT en procesarRenovacion.
    }

    public function down(): void
    {
        if (Schema::hasColumn('cartera_items', 'numero_renovacion')) {
            Schema::table('cartera_items', function (Blueprint $table) {
                $table->dropIndex(['poliza_id', 'numero_renovacion']);
                $table->dropColumn('numero_renovacion');
            });
        }

        if (Schema::hasColumn('pagos_polizas', 'numero_renovacion')) {
            Schema::table('pagos_polizas', function (Blueprint $table) {
                $table->dropColumn('numero_renovacion');
            });
        }

        if (Schema::hasColumn('cobros_comisiones', 'numero_renovacion')) {
            Schema::table('cobros_comisiones', function (Blueprint $table) {
                $table->dropColumn('numero_renovacion');
            });
        }
    }
};
