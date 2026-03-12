<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recibos_caja', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id')->index();
            $table->unsignedBigInteger('poliza_id')->nullable()->index();
            $table->unsignedBigInteger('cliente_id')->nullable()->index();
            $table->unsignedBigInteger('anexo_poliza_id')->nullable()->index();
            $table->unsignedBigInteger('vendedor_id')->nullable();

            // Identificación
            $table->string('numero_recibo', 50)->nullable()->index();
            $table->string('numero_planilla', 50)->nullable();
            $table->string('numero_transaccion', 100)->nullable();
            $table->string('numero_pago', 20)->nullable(); // cuota/pago #
            $table->string('numero_factura', 50)->nullable();
            $table->string('codigo_radicacion', 100)->nullable();

            // Tipo y estado
            $table->enum('tipo', ['recibo', 'anticipo', 'ajuste'])->default('recibo');
            $table->enum('tipo_recaudo', ['oficina', 'aseguradora', 'directo'])->default('oficina');
            $table->string('forma_pago', 100)->nullable(); // EFECTIVO, NEQUI, TRANSFERENCIA, etc.
            $table->string('forma_pago_aseguradora', 100)->nullable();
            $table->string('moneda', 10)->default('COP');

            // Fechas
            $table->date('fecha_pago')->nullable(); // fecha planificada
            $table->date('fecha_realizara_pago')->nullable();
            $table->date('fecha_realizo_pago')->nullable(); // pago a aseguradora
            $table->date('fecha_realizo_pago_oficina')->nullable(); // pago en oficina
            $table->date('fecha_recibio_comision')->nullable();

            // Montos principales
            $table->decimal('valor_a_pagar', 18, 2)->nullable();
            $table->decimal('valor_pagado', 18, 2)->nullable();
            $table->decimal('valor_neto_a_pagar', 18, 2)->default(0);
            $table->decimal('valor_recaudado_en_oficina', 18, 2)->default(0);
            $table->decimal('saldo_pendiente', 18, 2)->nullable();
            $table->decimal('saldo_pendiente_oficina', 18, 2)->default(0);
            $table->decimal('saldo_pendiente_aseguradora', 18, 2)->default(0);

            // Comisiones
            $table->decimal('comision_a_recibir', 18, 2)->nullable();
            $table->decimal('comision_total_a_recibir', 18, 2)->nullable();
            $table->decimal('sobrecomision_a_recibir', 18, 2)->nullable();
            $table->decimal('comision_recibida', 18, 2)->nullable();
            $table->decimal('comision_vendedor', 18, 2)->nullable();
            $table->decimal('comision_final_agencia', 18, 2)->nullable();
            $table->decimal('comision_tecnico', 18, 2)->nullable();
            $table->decimal('comision_sede', 18, 2)->nullable();
            $table->decimal('iva_comision_vendedor', 18, 2)->nullable();

            // Estado de comisiones
            $table->boolean('pagada_vendedor')->default(false);
            $table->boolean('pagada_tecnico')->default(false);
            $table->boolean('pagada_sede')->default(false);
            $table->date('fecha_pagada_vendedor')->nullable();
            $table->date('fecha_pagada_tecnico')->nullable();
            $table->date('fecha_pagada_sede')->nullable();

            // Flags
            $table->boolean('recaudado_en_oficina')->default(false);
            $table->boolean('recaudado')->default(false);
            $table->boolean('comisionada')->default(false);
            $table->boolean('es_anticipo')->default(false);
            $table->boolean('recibo_pago_directo')->default(false);
            $table->boolean('activo')->default(true);

            // Anulación
            $table->boolean('recibo_anulado')->default(false);
            $table->timestamp('fecha_recibo_anulado')->nullable();
            $table->string('usuario_anulo_recibo', 100)->nullable();

            // Observaciones y metadata
            $table->text('observaciones')->nullable();
            $table->json('archivos')->nullable();
            $table->json('metadata')->nullable(); // para campos extras de SS

            // SoftSeguros tracking
            $table->unsignedBigInteger('softseguros_id')->nullable()->index();
            $table->unsignedBigInteger('softseguros_recaudo_id')->nullable()->index();
            $table->string('source', 30)->default('guro'); // guro, softseguros

            $table->timestamps();
            $table->softDeletes();

            $table->foreign('broker_id')->references('id')->on('brokers')->cascadeOnDelete();
            $table->foreign('poliza_id')->references('id')->on('polizas')->nullOnDelete();
            $table->foreign('cliente_id')->references('id')->on('clientes')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recibos_caja');
    }
};
