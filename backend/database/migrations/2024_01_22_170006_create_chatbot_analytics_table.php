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
        Schema::create('chatbot_analytics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('chatbot_id')->constrained('chatbots')->onDelete('cascade');
            $table->date('date');
            $table->integer('total_sessions')->default(0);
            $table->integer('completed_sessions')->default(0);
            $table->integer('transferred_sessions')->default(0);
            $table->integer('avg_session_duration_seconds')->default(0);
            $table->json('flow_stats')->nullable();
            $table->json('trigger_stats')->nullable();
            $table->json('satisfaction_ratings')->nullable();
            $table->timestamps();
            
            $table->unique(['chatbot_id', 'date']);
            $table->index('date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('chatbot_analytics');
    }
};
