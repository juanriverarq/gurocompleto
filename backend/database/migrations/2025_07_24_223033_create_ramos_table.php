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
        Schema::create('ramos', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->string('subramo')->nullable();
            $table->boolean('calcular_iva_pri_a_pre')->default(false);
            $table->boolean('vista_mapa_oportunidad')->default(false);
            $table->foreignId('broker_id')->constrained('brokers')->onDelete('cascade');
            $table->timestamps();
            
            // Índices para optimizar consultas
            $table->index(['broker_id', 'nombre']);
            $table->index(['broker_id', 'subramo']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ramos');
    }
};
