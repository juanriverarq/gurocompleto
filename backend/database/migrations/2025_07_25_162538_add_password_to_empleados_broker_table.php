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
        Schema::table('empleados_broker', function (Blueprint $table) {
            // Campos de autenticación
            $table->string('password')->nullable()->after('usuario');
            $table->rememberToken()->after('password');
            $table->timestamp('email_verified_at')->nullable()->after('remember_token');
            
            // Campos adicionales para autenticación
            $table->boolean('first_login')->default(true)->after('requiere_cambio_password');
            $table->string('reset_password_token')->nullable()->after('first_login');
            $table->timestamp('reset_password_expires_at')->nullable()->after('reset_password_token');
            
            // Índices para mejorar performance de login
            $table->index(['email', 'broker_id']);
            $table->index(['usuario', 'broker_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('empleados_broker', function (Blueprint $table) {
            $table->dropIndex(['email', 'broker_id']);
            $table->dropIndex(['usuario', 'broker_id']);
            
            $table->dropColumn([
                'password',
                'remember_token',
                'email_verified_at',
                'first_login',
                'reset_password_token',
                'reset_password_expires_at'
            ]);
        });
    }
};
