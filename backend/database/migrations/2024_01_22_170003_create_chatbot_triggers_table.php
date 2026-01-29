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
        Schema::create('chatbot_triggers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('chatbot_id')->constrained('chatbots')->onDelete('cascade');
            $table->foreignId('flow_id')->nullable()->constrained('chatbot_flows')->onDelete('set null');
            $table->enum('trigger_type', [
                'keyword',
                'contains',
                'regex',
                'starts_with',
                'first_message',
                'button_reply',
                'list_reply',
                'media',
                'location',
                'schedule'
            ]);
            $table->string('trigger_value', 500)->nullable();
            $table->boolean('is_case_sensitive')->default(false);
            $table->integer('priority')->default(0);
            $table->boolean('is_active')->default(true);
            $table->json('conditions')->nullable();
            $table->timestamps();
            
            $table->index(['chatbot_id', 'is_active']);
            $table->index(['trigger_type', 'priority']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('chatbot_triggers');
    }
};
