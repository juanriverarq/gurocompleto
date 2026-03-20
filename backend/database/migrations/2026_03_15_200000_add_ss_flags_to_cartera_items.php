<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cartera_items', function (Blueprint $table) {
            // ── 3 FLAGS DE ESTADO (modelo SoftSeguros) ──
            // Estos 3 booleans determinan en qué tab aparece el item:
            // F/F/F → Por Cobrar | T/F/F → Por Pagar | T/T/F → Comisión por Cobrar | T/T/T → Completado
            $table->boolean('recaudado_en_oficina')->default(false)->after('estado_cartera');
            $table->boolean('recaudado_aseguradora')->default(false)->after('recaudado_en_oficina');
            $table->boolean('comisionada')->default(false)->after('recaudado_aseguradora');

            // ── FLAGS ESPECIALES ──
            $table->boolean('recibo_pago_directo')->default(false)->after('comisionada');
            $table->boolean('es_anticipo')->default(false)->after('recibo_pago_directo');
            $table->boolean('recibo_anulado')->default(false)->after('es_anticipo');

            // ── RETENCIONES (agencia) ──
            $table->decimal('retencion_comision_agencia', 18, 2)->default(0)->after('comision_pagada_vendedor');
            $table->decimal('reteiva_comision_agencia', 18, 2)->default(0)->after('retencion_comision_agencia');
            $table->decimal('reteica_comision_agencia', 18, 2)->default(0)->after('reteiva_comision_agencia');
            $table->decimal('iva_comision_agencia', 18, 2)->default(0)->after('reteica_comision_agencia');
            $table->decimal('comision_final_agencia', 18, 2)->default(0)->after('iva_comision_agencia');

            // ── RETENCIONES (vendedor) ──
            $table->decimal('retencion_comision_vendedor', 18, 2)->default(0)->after('comision_final_agencia');
            $table->decimal('iva_comision_vendedor', 18, 2)->default(0)->after('retencion_comision_vendedor');
            $table->decimal('reteica_comision_vendedor', 18, 2)->default(0)->after('iva_comision_vendedor');
            $table->decimal('reteiva_comision_vendedor', 18, 2)->default(0)->after('reteica_comision_vendedor');
            $table->decimal('total_retenciones_vendedor', 18, 2)->default(0)->after('reteiva_comision_vendedor');
            $table->decimal('total_comision_pagar_vendedor', 18, 2)->default(0)->after('total_retenciones_vendedor');
            $table->decimal('participacion_vendedor', 8, 2)->default(100)->after('total_comision_pagar_vendedor');

            // ── LIQUIDACIÓN VENDEDOR ──
            $table->boolean('pagada_vendedor')->default(false)->after('participacion_vendedor');

            // ── SOBRECOMISIÓN ──
            $table->decimal('sobrecomision_a_recibir', 18, 2)->default(0)->after('pagada_vendedor');
            $table->decimal('sobrecomision_recibida', 18, 2)->default(0)->after('sobrecomision_a_recibir');

            // ── TIPO DE RECAUDO ──
            $table->string('tipo_recaudo', 30)->nullable()->after('sobrecomision_recibida');

            // ── FECHA ANULACIÓN ──
            $table->datetime('fecha_anulado')->nullable()->after('fecha_pagada_vendedor');

            // ── CONSECUTIVO ──
            $table->integer('pago_poliza_consecutivo')->nullable()->after('numero_pago');

            // ── ÍNDICES ──
            $table->index('recaudado_en_oficina');
            $table->index('recaudado_aseguradora');
            $table->index('comisionada');
            $table->index('recibo_anulado');
            $table->index('es_anticipo');
            $table->index('recibo_pago_directo');
        });

        // ── MIGRAR DATOS EXISTENTES: setear flags según estado_cartera actual ──
        // por_cobrar → F/F/F
        // por_pagar → T/F/F
        // comision_por_cobrar → T/T/F
        // comision_recibida → T/T/T
        DB::statement("
            UPDATE cartera_items SET
                recaudado_en_oficina = CASE WHEN estado_cartera IN ('por_pagar','comision_por_cobrar','comision_recibida') THEN 1 ELSE 0 END,
                recaudado_aseguradora = CASE WHEN estado_cartera IN ('comision_por_cobrar','comision_recibida') THEN 1 ELSE 0 END,
                comisionada = CASE WHEN estado_cartera = 'comision_recibida' THEN 1 ELSE 0 END
        ");
    }

    public function down(): void
    {
        Schema::table('cartera_items', function (Blueprint $table) {
            $table->dropIndex(['recaudado_en_oficina']);
            $table->dropIndex(['recaudado_aseguradora']);
            $table->dropIndex(['comisionada']);
            $table->dropIndex(['recibo_anulado']);
            $table->dropIndex(['es_anticipo']);
            $table->dropIndex(['recibo_pago_directo']);

            $table->dropColumn([
                'recaudado_en_oficina', 'recaudado_aseguradora', 'comisionada',
                'recibo_pago_directo', 'es_anticipo', 'recibo_anulado',
                'retencion_comision_agencia', 'reteiva_comision_agencia', 'reteica_comision_agencia',
                'iva_comision_agencia', 'comision_final_agencia',
                'retencion_comision_vendedor', 'iva_comision_vendedor', 'reteica_comision_vendedor',
                'reteiva_comision_vendedor', 'total_retenciones_vendedor', 'total_comision_pagar_vendedor',
                'participacion_vendedor', 'pagada_vendedor',
                'sobrecomision_a_recibir', 'sobrecomision_recibida',
                'tipo_recaudo', 'fecha_anulado', 'pago_poliza_consecutivo',
            ]);
        });
    }
};
