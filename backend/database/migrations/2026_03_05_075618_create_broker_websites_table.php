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
        Schema::create('broker_websites', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id')->unique();
            $table->string('template_id', 50)->nullable();
            $table->string('template_route', 255)->nullable();
            $table->longText('html_content')->nullable();
            $table->json('settings')->nullable();
            $table->enum('status', ['draft', 'published'])->default('draft');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('broker_websites');
    }
};
