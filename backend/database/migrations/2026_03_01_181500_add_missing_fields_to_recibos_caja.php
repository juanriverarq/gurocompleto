<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recibos_caja', function (Blueprint $table) {
            // Denormalized display fields (avoid JOINs for table rendering)
            $table->string('poliza_numero', 100)->nullable()->after('vendedor_id');
            $table->string('poliza_objeto_asegurado', 255)->nullable()->after('poliza_numero');
            $table->string('cliente_nombre', 255)->nullable()->after('poliza_objeto_asegurado');
            $table->string('cliente_documento', 50)->nullable()->after('cliente_nombre');
            $table->string('aseguradora_nombre', 255)->nullable()->after('cliente_documento');
            $table->string('ramo_nombre', 255)->nullable()->after('aseguradora_nombre');
            $table->string('sede_nombre', 100)->nullable()->after('ramo_nombre');
            $table->string('vendedor_nombre', 255)->nullable()->after('sede_nombre');
            $table->string('usuario_recauda', 100)->nullable()->after('vendedor_nombre');
            $table->string('pago_poliza_consecutivo', 20)->nullable()->after('numero_pago');

            // Recaudo-specific fields
            $table->boolean('recaudo_directo')->default(false)->after('tipo_recaudo');
            $table->string('medio_de_pago', 255)->nullable()->after('forma_pago');
            $table->date('fecha_recaudo')->nullable()->after('fecha_recibio_comision');
            $table->date('fecha_inicio_poliza')->nullable()->after('fecha_recaudo');

            // Primas
            $table->decimal('prima_neta_poliza', 18, 2)->nullable()->after('saldo_pendiente_aseguradora');
            $table->decimal('prima_total_poliza', 18, 2)->nullable()->after('prima_neta_poliza');

            // Comisión percentages
            $table->decimal('porcentaje_comision_poliza', 8, 2)->nullable()->after('comision_sede');
            $table->decimal('porcentaje_comision_vendedor', 8, 2)->nullable()->after('porcentaje_comision_poliza');
            $table->decimal('participacion_vendedor', 8, 2)->nullable()->after('porcentaje_comision_vendedor');

            // Retenciones e impuestos
            $table->decimal('iva_comision_agencia', 18, 2)->nullable()->after('iva_comision_vendedor');
            $table->decimal('retencion_comision_agencia', 18, 2)->nullable()->after('iva_comision_agencia');
            $table->decimal('reteica_comision_agencia', 18, 2)->nullable()->after('retencion_comision_agencia');
            $table->decimal('reteiva_comision_agencia', 18, 2)->nullable()->after('reteica_comision_agencia');
            $table->decimal('comision_retencion_vendedor', 18, 2)->nullable()->after('reteiva_comision_agencia');

            // Extra flags
            $table->boolean('recaudo_parcial_oficina')->default(false)->after('recibo_pago_directo');
            $table->integer('edad_cartera')->nullable()->after('recaudo_parcial_oficina');

            // SS pago_poliza tracking (for recaudos link)
            $table->unsignedBigInteger('softseguros_pago_poliza_id')->nullable()->after('softseguros_recaudo_id');

            // Anulados extra
            $table->string('usuario_anula_recibo', 100)->nullable()->after('usuario_anulo_recibo');
        });
    }

    public function down(): void
    {
        Schema::table('recibos_caja', function (Blueprint $table) {
            $table->dropColumn([
                'poliza_numero', 'poliza_objeto_asegurado',
                'cliente_nombre', 'cliente_documento',
                'aseguradora_nombre', 'ramo_nombre', 'sede_nombre',
                'vendedor_nombre', 'usuario_recauda', 'pago_poliza_consecutivo',
                'recaudo_directo', 'medio_de_pago', 'fecha_recaudo', 'fecha_inicio_poliza',
                'prima_neta_poliza', 'prima_total_poliza',
                'porcentaje_comision_poliza', 'porcentaje_comision_vendedor', 'participacion_vendedor',
                'iva_comision_agencia', 'retencion_comision_agencia',
                'reteica_comision_agencia', 'reteiva_comision_agencia', 'comision_retencion_vendedor',
                'recaudo_parcial_oficina', 'edad_cartera',
                'softseguros_pago_poliza_id', 'usuario_anula_recibo',
            ]);
        });
    }
};
