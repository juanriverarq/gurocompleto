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
        Schema::create('chatbot_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('chatbot_id')->constrained('chatbots')->onDelete('cascade');
            $table->string('contact_phone', 20);
            $table->string('instance_id', 100);
            $table->foreignId('current_flow_id')->nullable()->constrained('chatbot_flows')->onDelete('set null');
            $table->unsignedBigInteger('current_node_id')->nullable();
            $table->json('variables')->nullable();
            $table->enum('status', ['active', 'waiting_input', 'transferred', 'completed', 'expired'])->default('active');
            $table->integer('fallback_count')->default(0);
            $table->json('conversation_history')->nullable();
            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('last_activity_at')->useCurrent();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
            
            $table->index(['contact_phone', 'instance_id']);
            $table->index('status');
            $table->index(['chatbot_id', 'status']);
            
            $table->foreign('current_node_id')
                  ->references('id')
                  ->on('chatbot_nodes')
                  ->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('chatbot_sessions');
    }
};
