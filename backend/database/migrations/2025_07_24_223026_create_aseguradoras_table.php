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
        Schema::create('aseguradoras', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->string('cuit')->nullable();
            $table->string('email')->nullable();
            $table->text('direccion')->nullable();
            $table->string('telefono')->nullable();
            $table->string('cuenta_bancaria')->nullable();
            $table->string('link_pago')->nullable();
            $table->string('codigo_intermediario')->nullable();
            $table->decimal('retencion', 5, 2)->default(0); // Porcentaje de retención
            $table->decimal('iva', 5, 2)->default(0); // Porcentaje de IVA
            $table->decimal('retencion_iva', 5, 2)->default(0); // Porcentaje de retención IVA
            $table->foreignId('broker_id')->constrained('brokers')->onDelete('cascade');
            $table->timestamps();
            
            // Índices para optimizar consultas
            $table->index(['broker_id', 'nombre']);
            $table->index(['broker_id', 'cuit']);
            $table->index(['broker_id', 'email']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('aseguradoras');
    }
};
