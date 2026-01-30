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
        Schema::create('chatbot_nodes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('flow_id')->constrained('chatbot_flows')->onDelete('cascade');
            $table->enum('node_type', [
                'start',
                'message',
                'question',
                'input',
                'condition',
                'action',
                'ai_response',
                'transfer',
                'delay',
                'end'
            ]);
            $table->string('name', 100)->nullable();
            $table->integer('position_x')->default(0);
            $table->integer('position_y')->default(0);
            $table->json('config');
            $table->unsignedBigInteger('next_node_id')->nullable();
            $table->timestamps();
            
            $table->index('flow_id');
            $table->index('node_type');
        });

        // Agregar foreign key después de crear la tabla (auto-referencia)
        Schema::table('chatbot_nodes', function (Blueprint $table) {
            $table->foreign('next_node_id')
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
        Schema::table('chatbot_nodes', function (Blueprint $table) {
            $table->dropForeign(['next_node_id']);
        });
        Schema::dropIfExists('chatbot_nodes');
    }
};
