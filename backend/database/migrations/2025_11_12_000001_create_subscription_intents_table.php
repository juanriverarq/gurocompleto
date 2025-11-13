<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_intents', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedInteger('users_count')->default(1);
            $table->string('period', 16); // monthly | annual
            $table->unsignedInteger('storage_gb')->default(5);
            $table->json('modules')->nullable();
            $table->json('totals')->nullable();
            $table->string('status', 32)->default('pending'); // pending | completed | canceled
            $table->string('source', 64)->nullable(); // e.g. pricing_calculator
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->index(['user_id', 'status']);
            $table->index('period');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_intents');
    }
};


