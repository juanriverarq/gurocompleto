<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('whatsapp_tags', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id');
            $table->string('name', 50);
            $table->string('color', 20)->default('blue'); // blue, green, red, yellow, purple, pink, orange, teal, gray
            $table->timestamps();

            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            $table->unique(['broker_id', 'name']);
            $table->index('broker_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('whatsapp_tags');
    }
};
