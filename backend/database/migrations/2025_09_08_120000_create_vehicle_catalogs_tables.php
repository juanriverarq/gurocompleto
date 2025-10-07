<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('veh_brands', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id');
            $table->string('name', 150);
            $table->timestamps();
            $table->unique(['broker_id','name']);
            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
        });

        Schema::create('veh_models', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id');
            $table->unsignedBigInteger('brand_id');
            $table->string('name', 150);
            $table->timestamps();
            $table->unique(['broker_id','brand_id','name']);
            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            $table->foreign('brand_id')->references('id')->on('veh_brands')->onDelete('cascade');
        });

        Schema::create('veh_lines', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id');
            $table->unsignedBigInteger('model_id');
            $table->string('name', 150);
            $table->timestamps();
            $table->unique(['broker_id','model_id','name']);
            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            $table->foreign('model_id')->references('id')->on('veh_models')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('veh_lines');
        Schema::dropIfExists('veh_models');
        Schema::dropIfExists('veh_brands');
    }
};


