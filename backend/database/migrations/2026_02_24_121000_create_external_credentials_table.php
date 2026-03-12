<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('external_credentials', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id');
            $table->string('provider', 50)->index(); // 'sura', 'bolivar', etc.
            $table->string('username');
            $table->text('password_encrypted'); // encrypted with Laravel Crypt
            $table->text('session_data')->nullable(); // JSON: cookies, tokens, etc.
            $table->timestamp('session_expires_at')->nullable();
            $table->timestamp('last_sync_at')->nullable();
            $table->string('status', 20)->default('active'); // active, expired, error
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            $table->unique(['broker_id', 'provider', 'username']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('external_credentials');
    }
};
