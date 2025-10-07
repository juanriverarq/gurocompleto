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
        Schema::dropIfExists('comercial_task');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::create('comercial_task', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->string('descripcion');
            $table->string('prioridad');
            $table->string('estado');
            $table->string('fecha_vencimiento');
            $table->string('cliente');
            $table->string('asignado_a');
            $table->timestamps();
        });
    }
};
