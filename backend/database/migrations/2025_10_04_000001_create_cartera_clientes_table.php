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
        Schema::create('cartera_clientes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id')->index();
            $table->string('nombre');
            $table->string('tipo_documento', 10)->nullable();
            $table->string('documento', 50)->nullable();
            $table->string('email')->nullable();
            $table->string('telefono', 50)->nullable();
            $table->string('asesor')->nullable();
            $table->unsignedInteger('polizas_activas')->default(0);
            $table->unsignedBigInteger('prima_total')->default(0); // en pesos
            $table->unsignedBigInteger('comisiones_generadas')->default(0); // en pesos
            $table->date('ultima_renovacion')->nullable();
            $table->date('proximo_vencimiento')->nullable();
            $table->enum('estado', ['Activo', 'Inactivo', 'Prospecto'])->default('Activo');
            $table->enum('segmento', ['Premium', 'Estándar', 'Básico'])->default('Estándar');
            $table->unsignedInteger('antiguedad')->default(0); // meses
            $table->timestamps();

            // Índices de búsqueda frecuentes
            $table->index(['broker_id', 'estado']);
            $table->index(['broker_id', 'segmento']);
            $table->index(['broker_id', 'documento']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cartera_clientes');
    }
};


