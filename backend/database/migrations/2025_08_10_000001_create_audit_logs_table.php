<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id')->nullable()->index();
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->string('user_type')->nullable(); // firebase|empleado|admin
            $table->string('action'); // login, logout, create, update, delete, view, export, import
            $table->string('module'); // clientes, polizas, siniestros, etc
            $table->string('ip_address', 64)->nullable();
            $table->string('user_agent')->nullable();
            $table->string('path')->nullable();
            $table->string('method', 8)->nullable();
            $table->json('request_payload')->nullable();
            $table->unsignedSmallInteger('response_status')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->index(['module', 'action']);
            $table->index(['created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};


