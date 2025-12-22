<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comisiones_manuales_polizas', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id');
            $table->unsignedBigInteger('poliza_id')->nullable();
            $table->unsignedBigInteger('vendedor_id')->nullable();
            $table->unsignedBigInteger('aseguradora_id')->nullable();
            
            $table->string('numero_poliza', 100)->nullable();
            $table->string('anexo', 50)->nullable();
            $table->string('tipo_movimiento', 50)->default('CREACIÓN');
            $table->string('asegurado_nombre', 255)->nullable();
            $table->string('ramo', 100)->nullable();
            
            $table->decimal('saldo', 15, 2)->default(0);
            $table->decimal('abono_prima', 15, 2)->default(0);
            $table->decimal('porcentaje_comision', 8, 2)->default(0);
            $table->decimal('porcentaje_agencia', 8, 2)->default(0);
            $table->decimal('valor_comision', 15, 2)->default(0);
            $table->decimal('porcentaje_rtf', 8, 2)->default(0);
            $table->decimal('rtf_calculada', 15, 2)->default(0);
            $table->decimal('iva_19', 15, 2)->default(0);
            $table->decimal('reteiva', 15, 2)->default(0);
            $table->decimal('ica', 15, 2)->default(0);
            $table->decimal('cree', 15, 2)->default(0);
            $table->decimal('neto_comision', 15, 2)->default(0);
            
            $table->string('tipo_documento', 50)->nullable();
            $table->string('estado', 20)->default('pendiente'); // pendiente, liquidada, pagada, anulada
            $table->unsignedBigInteger('liquidacion_id')->nullable();
            $table->text('observaciones')->nullable();
            $table->unsignedBigInteger('creado_por')->nullable();
            
            $table->timestamps();
            
            // Índices
            $table->index('broker_id');
            $table->index('poliza_id');
            $table->index('vendedor_id');
            $table->index('estado');
            $table->index(['broker_id', 'estado']);
            $table->index(['broker_id', 'vendedor_id', 'estado']);
            
            // Foreign keys
            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            $table->foreign('poliza_id')->references('id')->on('polizas')->onDelete('set null');
            $table->foreign('vendedor_id')->references('id')->on('vendedores')->onDelete('set null');
            $table->foreign('aseguradora_id')->references('id')->on('aseguradoras')->onDelete('set null');
            $table->foreign('liquidacion_id')->references('id')->on('liquidaciones_vendedores_cabecera')->onDelete('set null');
            $table->foreign('creado_por')->references('id')->on('users')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comisiones_manuales_polizas');
    }
};
