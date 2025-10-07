<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('veh_prices', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('brand_id');
            $table->unsignedBigInteger('model_id');
            $table->unsignedBigInteger('line_id')->nullable();
            // amount en moneda base (por ejemplo COP). En el Excel vienen por mil: almacenamos ya multiplicado por 1000
            $table->unsignedBigInteger('amount');
            $table->string('clase', 100)->nullable();
            $table->string('referencia1', 150)->nullable();
            $table->string('referencia2', 150)->nullable();
            $table->string('referencia3', 150)->nullable();
            $table->timestamps();

            $table->unique(['brand_id','model_id','line_id']);
            $table->foreign('brand_id')->references('id')->on('veh_brands')->onDelete('cascade');
            $table->foreign('model_id')->references('id')->on('veh_models')->onDelete('cascade');
            $table->foreign('line_id')->references('id')->on('veh_lines')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('veh_prices');
    }
};


