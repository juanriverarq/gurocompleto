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
        Schema::create('ventas_cruzadas_analisis', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id');
            $table->unsignedBigInteger('cliente_id');
            $table->unsignedBigInteger('poliza_id');
            
            // Datos del análisis
            $table->json('datos_entrada')->comment('Datos completos del cliente, póliza y vehículos usados para el análisis');
            $table->json('recomendaciones')->comment('Recomendaciones generadas por IA');
            $table->decimal('scoring_promedio', 5, 2)->default(0)->comment('Scoring promedio de todas las recomendaciones');
            
            // Metadatos del análisis
            $table->string('modelo_ia')->default('deepseek')->comment('Modelo de IA utilizado');
            $table->timestamp('fecha_analisis')->useCurrent();
            $table->boolean('vigente')->default(true)->comment('Si el análisis sigue siendo válido');
            $table->timestamp('valido_hasta')->nullable()->comment('Fecha hasta la cual el análisis es válido');
            
            // Tracking
            $table->integer('veces_consultado')->default(0)->comment('Cuántas veces se ha consultado este análisis');
            $table->timestamp('ultima_consulta')->nullable();
            
            $table->timestamps();
            
            // Índices
            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            $table->foreign('cliente_id')->references('id')->on('clientes')->onDelete('cascade');
            $table->foreign('poliza_id')->references('id')->on('polizas')->onDelete('cascade');
            
            $table->index(['broker_id', 'cliente_id']);
            $table->index(['broker_id', 'poliza_id']);
            $table->index(['vigente', 'valido_hasta']);
            $table->index('fecha_analisis');
            
            // Índice único para evitar duplicados (un análisis por póliza vigente)
            $table->unique(['poliza_id', 'vigente'], 'unique_poliza_vigente');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ventas_cruzadas_analisis');
    }
};