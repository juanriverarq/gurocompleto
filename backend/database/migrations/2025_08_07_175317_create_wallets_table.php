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
        Schema::create('wallets', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('broker_id')->nullable();
            $table->decimal('balance_cop', 15, 2)->default(0); // Saldo en pesos colombianos
            $table->decimal('balance_usd', 15, 2)->default(0); // Saldo en USD para futuro
            $table->decimal('pending_balance', 15, 2)->default(0); // Saldo pendiente
            $table->decimal('total_earnings', 15, 2)->default(0); // Total ganado histórico
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            // Índices para rendimiento
            $table->index('user_id');
            $table->index('broker_id');
            $table->index(['user_id', 'broker_id']);
            
            // Relaciones foráneas (comentadas hasta verificar estructura)
            // $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            // $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('wallets');
    }
};
