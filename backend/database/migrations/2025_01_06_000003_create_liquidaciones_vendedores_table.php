<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('liquidaciones_vendedores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('broker_id')->constrained('brokers')->onDelete('cascade');
            $table->foreignId('vendedor_id')->constrained('vendedores')->onDelete('cascade');
            $table->foreignId('poliza_id')->constrained('polizas')->onDelete('cascade');
            $table->foreignId('cobro_comision_id')->nullable()->constrained('cobros_comisiones')->onDelete('set null');
            
            // Montos
            $table->decimal('monto_comision', 15, 2)->default(0);
            $table->decimal('monto_pagado', 15, 2)->default(0);
            $table->decimal('monto_pendiente', 15, 2)->default(0);
            
            // Información del pago
            $table->date('fecha_pago')->nullable();
            $table->string('metodo_pago')->nullable(); // efectivo, transferencia, cheque
            $table->string('referencia_pago')->nullable();
            $table->string('comprobante_url')->nullable();
            
            // Estado
            $table->enum('estado', ['pendiente', 'parcial', 'pagado'])->default('pendiente');
            
            // Observaciones
            $table->text('observaciones')->nullable();
            
            $table->timestamps();
            
            // Índices
            $table->index(['broker_id', 'vendedor_id']);
            $table->index(['broker_id', 'poliza_id']);
            $table->index(['broker_id', 'estado']);
            $table->index(['fecha_pago']);
            $table->index(['referencia_pago']);
            $table->index(['cobro_comision_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('liquidaciones_vendedores');
    }
};