<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('user_id');
            $table->string('status', 32)->default('incomplete'); // active | canceled | incomplete | trialing
            $table->string('period', 16); // monthly | annual
            $table->unsignedInteger('users_count')->default(1);
            $table->unsignedInteger('storage_gb')->default(5);
            $table->json('modules')->nullable();
            $table->json('totals')->nullable();
            $table->unsignedBigInteger('intent_id')->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('current_period_end')->nullable();
            $table->timestamp('canceled_at')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->index(['user_id', 'status']);
            $table->index('period');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscriptions');
    }
};


