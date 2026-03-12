<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cartera_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id')->index();
            $table->unsignedBigInteger('poliza_id')->nullable()->index();
            $table->unsignedBigInteger('cliente_id')->nullable()->index();
            $table->bigInteger('softseguros_pago_id')->nullable()->index();

            // Display fields from Excel
            $table->string('poliza_numero', 100)->nullable()->index();
            $table->string('anexo_numero', 100)->nullable();
            $table->string('riesgo')->nullable();
            $table->string('aseguradora_nombre')->nullable();
            $table->string('ramo_principal')->nullable();
            $table->string('subramo')->nullable();
            $table->string('cliente_nombre')->nullable();
            $table->string('cliente_documento', 50)->nullable()->index();
            $table->string('vendedor_nombre')->nullable();
            $table->string('numero_remision')->nullable();
            $table->string('categorias_poliza')->nullable();
            $table->string('categorias_cliente')->nullable();
            $table->string('forma_pago', 100)->nullable();
            $table->string('numero_pago', 20)->nullable();
            $table->string('sede')->nullable();

            // Financial fields
            $table->decimal('prima_neta', 18, 2)->default(0);
            $table->decimal('valor_neto_a_pagar', 18, 2)->default(0);
            $table->decimal('prima_total_pago', 18, 2)->default(0);
            $table->decimal('prima_total', 18, 2)->default(0);
            $table->decimal('saldo_pendiente_oficina', 18, 2)->default(0);
            $table->decimal('saldo_pendiente_aseguradora', 18, 2)->default(0);
            $table->decimal('valor_recaudado_oficina', 18, 2)->default(0);
            $table->decimal('valor_pagado_aseguradora', 18, 2)->default(0);
            $table->decimal('comision_a_recibir', 18, 2)->default(0);
            $table->decimal('comision_recibida', 18, 2)->default(0);
            $table->decimal('comision_vendedor', 18, 2)->default(0);
            $table->decimal('comision_pagada_vendedor', 18, 2)->default(0);
            $table->decimal('porcentaje_comision', 8, 4)->nullable();
            $table->decimal('porcentaje_comision_anexo', 8, 4)->nullable();

            // Dates
            $table->date('fecha_limite_pago')->nullable();
            $table->date('fecha_compromiso_pago')->nullable();
            $table->date('fecha_recaudado_oficina')->nullable();
            $table->date('fecha_pago_aseguradora')->nullable();
            $table->date('fecha_comisionada')->nullable();
            $table->date('fecha_pagada_vendedor')->nullable();
            $table->date('fecha_inicio_vigencia')->nullable();
            $table->date('fecha_fin_vigencia')->nullable();
            $table->integer('dias_vencidos')->default(0);

            // State: which cartera tab this item belongs to
            $table->enum('estado_cartera', ['por_cobrar', 'por_pagar', 'comision_por_cobrar', 'comision_recibida'])->index();

            // Extra
            $table->string('medio_pago')->nullable();
            $table->string('codigo_contable')->nullable();
            $table->string('codigo_radicacion')->nullable();
            $table->string('moneda', 10)->nullable();
            $table->string('usuario_comisiono')->nullable();
            $table->text('observacion_bitacora')->nullable();
            $table->text('observaciones_pago')->nullable();
            $table->boolean('recaudado_aseg_pendiente_cliente')->default(false);

            $table->timestamps();

            $table->index(['broker_id', 'estado_cartera']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cartera_items');
    }
};
