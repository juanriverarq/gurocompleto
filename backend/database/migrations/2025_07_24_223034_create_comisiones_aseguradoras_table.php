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
        Schema::create('comisiones_aseguradoras', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ramo_id')->constrained('ramos')->onDelete('cascade');
            $table->foreignId('aseguradora_id')->constrained('aseguradoras')->onDelete('cascade');
            $table->decimal('porcentaje_iva', 5, 2)->default(0);
            $table->decimal('porcentaje_comision', 5, 2)->default(0);
            $table->decimal('pri_a_pre_por_defecto', 5, 2)->default(0);
            $table->timestamps();
            
            // Índices para optimizar consultas y evitar duplicados
            $table->unique(['ramo_id', 'aseguradora_id']);
            $table->index(['ramo_id']);
            $table->index(['aseguradora_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('comisiones_aseguradoras');
    }
};
