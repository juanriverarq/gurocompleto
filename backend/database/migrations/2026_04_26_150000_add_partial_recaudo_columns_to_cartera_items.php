<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * FIX CRÍTICO: agrega las columnas que applyPaymentStateToItem espera y
 * que faltaban en cartera_items. Sin estas columnas, todo UPDATE de
 * sincronización fallaba silenciosamente con "Unknown column", dejando
 * los cartera_items sin actualizar pese a que los pagos sí se creaban.
 *
 * - recaudo_parcial_oficina: indica que solo una porción del cuota fue
 *   cobrada en oficina (parent del split).
 * - split_from_id: si esta cuota fue creada por un split de otra cuota
 *   parcialmente recaudada, apunta a la cuota original.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cartera_items', function (Blueprint $table) {
            if (!Schema::hasColumn('cartera_items', 'recaudo_parcial_oficina')) {
                $table->boolean('recaudo_parcial_oficina')
                    ->default(false)
                    ->after('recaudado_en_oficina');
            }
            if (!Schema::hasColumn('cartera_items', 'split_from_id')) {
                $table->unsignedBigInteger('split_from_id')
                    ->nullable()
                    ->after('id');
                $table->index('split_from_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('cartera_items', function (Blueprint $table) {
            if (Schema::hasColumn('cartera_items', 'split_from_id')) {
                $table->dropIndex(['split_from_id']);
                $table->dropColumn('split_from_id');
            }
            if (Schema::hasColumn('cartera_items', 'recaudo_parcial_oficina')) {
                $table->dropColumn('recaudo_parcial_oficina');
            }
        });
    }
};
