<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('anexos', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id');
            $table->unsignedBigInteger('poliza_id');
            $table->string('anexo_number');
            $table->string('insurance_company');
            $table->string('branch');
            $table->string('risk');
            $table->date('start_date');
            $table->date('end_date');
            $table->boolean('renewable')->default(false);
            $table->decimal('prima_neta', 15, 2);
            $table->decimal('gastos_expedicion', 15, 2)->nullable();
            $table->decimal('iva', 15, 2)->default(0);
            $table->boolean('comision_pagada')->default(false);
            $table->text('observaciones')->nullable();
            $table->enum('status', ['ACTIVA','VENCIDA','CANCELADA','SUSPENDIDA','PENDIENTE'])->default('ACTIVA');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('poliza_id')->references('id')->on('polizas')->onDelete('cascade');
            $table->index(['broker_id','poliza_id']);
            $table->index(['anexo_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('anexos');
    }
};




