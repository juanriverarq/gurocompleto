<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pagos_polizas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('broker_id')->constrained('brokers')->onDelete('cascade');
            $table->foreignId('poliza_id')->constrained('polizas')->onDelete('cascade');
            $table->foreignId('cliente_id')->constrained('clientes')->onDelete('cascade');
            
            // Montos
            $table->decimal('monto_total', 15, 2)->default(0);
            $table->decimal('monto_pagado', 15, 2)->default(0);
            $table->decimal('monto_pendiente', 15, 2)->default(0);
            
            // Tipo de recaudo
            $table->enum('tipo_recaudo', ['oficina', 'aseguradora'])->default('oficina');
            
            // Información del pago
            $table->string('metodo_pago')->nullable(); // efectivo, transferencia, cheque, tarjeta
            $table->date('fecha_pago');
            $table->string('referencia_pago')->nullable();
            $table->string('comprobante_url')->nullable();
            
            // Estado
            $table->enum('estado', ['pendiente', 'parcial', 'pagado'])->default('pendiente');
            
            // Observaciones
            $table->text('observaciones')->nullable();
            
            $table->timestamps();
            
            // Índices
            $table->index(['broker_id', 'poliza_id']);
            $table->index(['broker_id', 'cliente_id']);
            $table->index(['broker_id', 'estado']);
            $table->index(['broker_id', 'tipo_recaudo']);
            $table->index(['fecha_pago']);
            $table->index(['referencia_pago']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pagos_polizas');
    }
};