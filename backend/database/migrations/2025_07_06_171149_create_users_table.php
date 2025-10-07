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
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            
            // Información básica del usuario
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password')->nullable(); // Nullable para usuarios de Firebase
            
            // Campos para Firebase
            $table->string('firebase_uid')->nullable()->unique();
            $table->string('provider')->default('email'); // 'email', 'google', 'firebase'
            $table->string('avatar')->nullable();
            $table->string('phone')->nullable();
            
            // Estructura SaaS
            $table->enum('user_type', ['MASTER', 'ADMIN', 'EMPLEADO', 'USUARIO'])->default('MASTER');
            $table->unsignedBigInteger('broker_id')->nullable(); // Relación con broker
            $table->string('role')->default('usuario'); // admin, empleado, asesor, etc.
            $table->json('permissions')->nullable(); // Permisos específicos
            $table->json('settings')->nullable(); // Configuraciones del usuario
            
            // Estado y control
            $table->enum('status', ['active', 'inactive', 'suspended'])->default('active');
            $table->timestamp('last_login_at')->nullable();
            $table->boolean('two_factor_enabled')->default(false);
            
            $table->rememberToken();
            $table->timestamps();
            
            // Índices
            $table->index(['broker_id']);
            $table->index(['user_type']);
            $table->index(['status']);
            $table->index(['email']);
            $table->index(['firebase_uid']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
