<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tabla para persistir recibos sincronizados con sus comisiones desde
 * portales de aseguradoras (ej. /sura/comisiones). Cada fila representa
 * un recibo recaudado o pendiente con la comisión del asesor.
 *
 * No confundir con `comisiones_aseguradoras` (config de % comisión
 * por ramo/aseguradora interna, usada en cotizadores).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recibos_comisiones_aseguradoras', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id')->index();
            $table->string('insurer_code', 30)->index();
            $table->string('insurer_name', 60);

            // Periodo contable del recibo
            $table->char('anio', 4)->index();
            $table->char('mes', 2)->index();

            // Identificación
            $table->string('ramo_codigo', 10)->nullable()->index();
            $table->string('producto', 150)->nullable();
            $table->string('policy_number', 100)->nullable()->index();
            $table->string('numero_recibo', 100)->nullable()->index();
            $table->string('client_name')->nullable();
            $table->string('client_document', 50)->nullable()->index();
            $table->string('client_doc_type', 10)->nullable();
            $table->string('oficina', 20)->nullable();

            // Fechas
            $table->date('fecha_recaudo')->nullable()->index();
            $table->date('fecha_pago_asesor')->nullable();

            // Montos
            $table->decimal('prima_neta', 18, 2)->default(0);
            $table->decimal('valor_pagado_tomador', 18, 2)->default(0);
            $table->decimal('porcentaje_comision', 6, 2)->default(0);
            $table->decimal('valor_comision', 18, 2)->default(0);

            // Clasificación
            $table->enum('estado', ['legalizada', 'pendiente', 'anticipo', 'cancelada'])
                ->default('legalizada')->index();
            $table->string('concepto', 100)->nullable();
            $table->string('subramo', 20)->nullable();

            // Trazabilidad
            $table->string('source_endpoint', 120)->nullable();
            $table->string('sync_hash', 32)->nullable();
            $table->timestamp('synced_at')->nullable();

            $table->json('raw_data')->nullable();
            $table->timestamps();

            $table->index(['broker_id', 'insurer_code']);
            $table->index(['broker_id', 'insurer_code', 'anio', 'mes']);
            $table->index(['broker_id', 'anio', 'mes']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recibos_comisiones_aseguradoras');
    }
};
