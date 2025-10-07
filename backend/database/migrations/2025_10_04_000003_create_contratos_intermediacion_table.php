<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contratos_intermediacion', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id')->index();
            $table->string('numero_contrato')->index();
            $table->string('aseguradora');
            $table->enum('tipo_contrato', ['intermediacion','comision','exclusividad','marco'])->default('intermediacion');
            $table->date('fecha_inicio');
            $table->date('fecha_vencimiento');
            $table->enum('estado', ['activo','vencido','por_vencer','cancelado','borrador'])->default('borrador')->index();
            $table->decimal('comision_base', 5, 2)->default(0);
            $table->decimal('comision_adicional', 5, 2)->nullable();
            $table->json('productos_autorizados')->nullable();
            $table->string('territorio')->nullable();
            $table->string('responsable')->nullable();
            $table->string('archivo_url')->nullable();
            $table->date('fecha_firma')->nullable();
            $table->boolean('firmado_digitalmente')->default(false);
            $table->boolean('renovacion_automatica')->default(false);
            $table->unsignedBigInteger('valor_estimado_anual')->default(0);
            $table->json('clausulas_especiales')->nullable();
            $table->text('observaciones')->nullable();
            $table->timestamps();
            $table->index(['broker_id','aseguradora']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contratos_intermediacion');
    }
};


