<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('vendedores', function (Blueprint $table) {
            $table->id();
            $table->string('nombres');
            $table->string('tipo_documento');
            $table->string('numero_documento');
            $table->string('telefono')->nullable();
            $table->string('celular')->nullable();
            $table->string('email')->nullable();
            $table->string('cuenta_bancaria')->nullable();
            $table->enum('tipo_persona', ['natural', 'juridica'])->default('natural');
            $table->boolean('es_agencia')->default(false);
            $table->decimal('porcentaje_comision', 5, 2)->default(0);
            $table->enum('calcular_comision_sobre', ['agencia', 'prima_neta'])->default('prima_neta');
            $table->decimal('porcentaje_retencion', 5, 2)->default(0);
            $table->decimal('porcentaje_retencion_ica', 5, 2)->default(0);
            $table->decimal('porcentaje_iva', 5, 2)->default(0);
            $table->boolean('comisiones_diferentes_por_ano')->default(false);
            $table->foreignId('broker_id')->constrained('brokers')->onDelete('cascade');
            $table->timestamps();
            
            // Índices para optimizar consultas
            $table->index(['broker_id', 'nombres']);
            $table->index(['broker_id', 'numero_documento']);
            $table->index(['broker_id', 'email']);
            $table->index(['broker_id', 'tipo_persona']);
            $table->index(['broker_id', 'es_agencia']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('vendedores');
    }
};
