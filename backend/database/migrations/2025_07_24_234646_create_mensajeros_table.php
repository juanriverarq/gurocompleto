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
        Schema::create('mensajeros', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->string('telefono')->nullable();
            $table->string('celular')->nullable();
            $table->string('email')->nullable();
            $table->text('direccion')->nullable();
            $table->string('ciudad')->nullable();
            $table->string('vehiculo')->nullable(); // Tipo de vehículo (moto, carro, bicicleta, etc.)
            $table->boolean('activo')->default(true);
            $table->decimal('tarifa_base', 10, 2)->nullable(); // Tarifa base por entrega
            $table->text('observaciones')->nullable();
            
            // Multi-tenancy
            $table->unsignedBigInteger('broker_id');
            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            
            // Indices
            $table->index(['broker_id', 'activo']);
            $table->index(['broker_id', 'nombre']);
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('mensajeros');
    }
};
