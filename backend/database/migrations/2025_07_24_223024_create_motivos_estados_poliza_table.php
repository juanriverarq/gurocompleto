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
        Schema::create('motivos_estados_poliza', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->boolean('cancelacion')->default(false);
            $table->boolean('no_renovacion')->default(false);
            $table->boolean('creacion_anexo')->default(false);
            $table->foreignId('broker_id')->constrained('brokers')->onDelete('cascade');
            $table->timestamps();
            
            // Índices para optimizar consultas
            $table->index(['broker_id', 'nombre']);
            $table->index(['broker_id', 'cancelacion']);
            $table->index(['broker_id', 'no_renovacion']);
            $table->index(['broker_id', 'creacion_anexo']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('motivos_estados_poliza');
    }
};
