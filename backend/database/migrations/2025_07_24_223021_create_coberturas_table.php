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
        Schema::create('coberturas', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->foreignId('broker_id')->constrained('brokers')->onDelete('cascade');
            $table->timestamps();
            
            // Índices para optimizar consultas
            $table->index(['broker_id', 'nombre']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('coberturas');
    }
};
