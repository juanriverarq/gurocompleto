<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('anticipos_ajustes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id');
            $table->enum('tipo', ['anticipo', 'ajuste', 'descuento']);
            $table->unsignedBigInteger('vendedor_id');
            $table->string('concepto');
            $table->decimal('valor', 15, 2);
            $table->date('fecha');
            $table->enum('estado', ['pendiente', 'aprobado', 'rechazado'])->default('pendiente');
            $table->text('observaciones')->nullable();
            $table->unsignedBigInteger('poliza_id')->nullable();
            $table->unsignedBigInteger('aprobado_por')->nullable();
            $table->timestamp('fecha_aprobacion')->nullable();
            $table->timestamps();

            $table->index(['broker_id', 'vendedor_id']);
            $table->index(['broker_id', 'tipo']);
            $table->index(['broker_id', 'estado']);
            $table->index(['broker_id', 'fecha']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('anticipos_ajustes');
    }
};