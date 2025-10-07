<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cobros_comisiones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('broker_id')->constrained('brokers')->onDelete('cascade');
            $table->foreignId('poliza_id')->constrained('polizas')->onDelete('cascade');
            $table->foreignId('aseguradora_id')->nullable()->constrained('aseguradoras')->onDelete('set null');
            $table->foreignId('pago_poliza_id')->nullable()->constrained('pagos_polizas')->onDelete('set null');
            
            // Montos
            $table->decimal('monto_comision', 15, 2)->default(0);
            $table->decimal('monto_cobrado', 15, 2)->default(0);
            $table->decimal('monto_pendiente', 15, 2)->default(0);
            
            // Información del cobro
            $table->date('fecha_cobro')->nullable();
            $table->string('referencia_cobro')->nullable();
            $table->string('comprobante_url')->nullable();
            
            // Estado
            $table->enum('estado', ['pendiente', 'parcial', 'cobrado'])->default('pendiente');
            
            // Observaciones
            $table->text('observaciones')->nullable();
            
            $table->timestamps();
            
            // Índices
            $table->index(['broker_id', 'poliza_id']);
            $table->index(['broker_id', 'aseguradora_id']);
            $table->index(['broker_id', 'estado']);
            $table->index(['fecha_cobro']);
            $table->index(['referencia_cobro']);
            $table->index(['pago_poliza_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cobros_comisiones');
    }
};