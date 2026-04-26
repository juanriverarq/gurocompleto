<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('insurer_connections', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id');
            $table->string('insurer_code', 60);
            $table->string('status', 30)->default('disconnected'); // disconnected, connected, reconnect_required, error
            $table->string('microservice_session_id', 120)->nullable();
            $table->longText('credentials_encrypted')->nullable();
            $table->json('session_payload')->nullable();
            $table->timestamp('connected_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('last_healthcheck_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            $table->unique(['broker_id', 'insurer_code']);
            $table->index(['status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('insurer_connections');
    }
};

