<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('enlaces_cotizacion', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id')->index();
            $table->string('nombre');
            $table->string('tipo', 50); // vida, autos, hogar, empresarial
            $table->string('descripcion')->nullable();
            $table->string('slug')->index();
            $table->string('enlace')->unique();
            $table->boolean('activo')->default(true);
            $table->unsignedInteger('visitas')->default(0);
            $table->unsignedInteger('cotizaciones')->default(0);
            $table->json('config')->nullable();
            $table->timestamps();
            $table->index(['broker_id','tipo','activo']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('enlaces_cotizacion');
    }
};


