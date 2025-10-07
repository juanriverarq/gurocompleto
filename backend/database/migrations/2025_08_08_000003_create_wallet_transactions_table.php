<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wallet_transactions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('wallet_id');
            $table->unsignedBigInteger('broker_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('type', 20); // debit | credit | hold | release
            $table->decimal('amount_cop', 14, 2)->default(0);
            $table->decimal('amount_usd', 14, 6)->default(0);
            $table->string('currency', 3)->default('COP');
            $table->string('description')->nullable();
            $table->string('reference_type')->nullable(); // e.g., voice_campaign_call
            $table->unsignedBigInteger('reference_id')->nullable();
            $table->json('metadata')->nullable();
            $table->decimal('balance_cop_after', 14, 2)->nullable();
            $table->timestamps();

            $table->index(['wallet_id', 'created_at']);
            $table->index(['broker_id', 'created_at']);
            $table->unique(['type', 'reference_type', 'reference_id'], 'uniq_tx_reference');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wallet_transactions');
    }
};


