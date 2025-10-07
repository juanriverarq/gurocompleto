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
        Schema::create('whats_app_instances', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id')->index();
            $table->string('instance_id')->unique();
            $table->string('session_id')->nullable();
            $table->string('phone_number')->nullable();
            $table->enum('status', ['disconnected', 'connecting', 'connected', 'qr_pending', 'authenticated', 'error'])->default('disconnected');
            $table->text('qr_code')->nullable();
            $table->timestamp('qr_expires_at')->nullable();
            $table->json('session_data')->nullable();
            $table->json('connection_info')->nullable();
            $table->string('webhook_url')->nullable();
            $table->json('settings')->nullable();
            $table->timestamp('last_connected_at')->nullable();
            $table->timestamp('last_activity_at')->nullable();
            $table->text('error_message')->nullable();
            $table->integer('reconnect_attempts')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            // Foreign key constraint
            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            
            // Composite index for better performance
            $table->index(['broker_id', 'status']);
            $table->index(['broker_id', 'is_active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('whats_app_instances');
    }
};
