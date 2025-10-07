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
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->string('titulo');
            $table->text('descripcion');
            $table->enum('tipo', ['Seguimiento Cliente', 'Documentación', 'Inspección', 'Renovación', 'Siniestro', 'Cotización']);
            $table->enum('prioridad', ['Baja', 'Media', 'Alta', 'Crítica']);
            $table->enum('estado', ['Pendiente', 'En Progreso', 'Completada', 'Vencida', 'Cancelada'])->default('Pendiente');
            $table->date('fecha_vencimiento');
            $table->string('asignado_a');
            $table->string('cliente');
            $table->string('numero_poliza')->nullable();
            $table->integer('progreso')->default(0);
            $table->text('observaciones')->nullable();
            $table->unsignedBigInteger('usuario_id');
            $table->timestamps();
            
            // Índices para mejorar el rendimiento
            $table->index(['estado', 'fecha_vencimiento']);
            $table->index(['usuario_id']);
            $table->index(['tipo']);
            $table->index(['prioridad']);
            
            // Relación con tabla de usuarios
            $table->foreign('usuario_id')->references('id')->on('users')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tasks');
    }
};
