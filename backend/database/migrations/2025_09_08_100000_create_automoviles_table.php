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
        Schema::create('automoviles', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id');
            $table->string('placa', 20); // Normalizada en mayúsculas
            $table->string('marca', 100)->nullable();
            $table->string('modelo', 100)->nullable();
            $table->unsignedSmallInteger('anio')->nullable();
            $table->string('vin', 32)->nullable();
            $table->string('color', 50)->nullable();
            $table->unsignedBigInteger('client_id')->nullable();
            $table->unsignedBigInteger('poliza_id')->nullable();
            $table->json('custom_fields')->nullable();
            $table->timestamps();

            // Índices y restricciones
            $table->unique(['broker_id', 'placa']);
            $table->index(['broker_id']);
            $table->index(['client_id']);
            $table->index(['poliza_id']);

            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            $table->foreign('client_id')->references('id')->on('clientes')->onDelete('set null');
            $table->foreign('poliza_id')->references('id')->on('polizas')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('automoviles');
    }
};


