<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('sales_performances', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id');
            $table->unsignedBigInteger('user_id');
            $table->string('period'); // YYYY-MM
            $table->integer('month'); // 1-12
            $table->integer('year'); // YYYY
            $table->decimal('sales_current_month', 15, 2)->default(0);
            $table->decimal('sales_previous_month', 15, 2)->default(0);
            $table->decimal('monthly_goal', 15, 2)->default(0);
            $table->decimal('fulfillment_percentage', 5, 2)->default(0);
            $table->decimal('commissions', 15, 2)->default(0);
            $table->integer('new_clients')->default(0);
            $table->integer('calls')->default(0);
            $table->integer('meetings')->default(0);
            $table->integer('proposals')->default(0);
            $table->decimal('conversion_rate', 5, 2)->default(0);
            $table->decimal('average_ticket', 15, 2)->default(0);
            $table->integer('ranking')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['broker_id', 'period']);
            $table->index(['user_id', 'period']);
            $table->index(['broker_id', 'month', 'year']);
            $table->unique(['broker_id', 'user_id', 'period']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_performances');
    }
};