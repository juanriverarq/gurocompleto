<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_sessions', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('intent_id')->nullable();
            $table->string('reference', 64)->unique();
            $table->integer('amount_in_cents');
            $table->string('currency', 8)->default('COP');
            $table->string('status', 32)->default('pending'); // pending | approved | declined | voided
            $table->string('checkout_url')->nullable();
            $table->string('redirect_url')->nullable();
            $table->string('wompi_transaction_id')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->index(['user_id', 'status']);
            $table->index('intent_id');
            $table->index('wompi_transaction_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_sessions');
    }
};


