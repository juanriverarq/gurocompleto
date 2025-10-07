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
        Schema::create('brokers', function (Blueprint $table) {
            $table->id();
            
            // Información básica del broker
            $table->string('name'); // Nombre comercial
            $table->string('legal_name')->nullable(); // Razón social
            $table->string('document_type')->default('NIT'); // NIT, RUT, etc.
            $table->string('document_number')->unique(); // Número de documento
            $table->string('email')->unique();
            $table->string('phone')->nullable();
            $table->text('address')->nullable();
            $table->string('city')->nullable();
            $table->string('state')->nullable();
            $table->string('country')->default('Colombia');
            $table->string('postal_code')->nullable();
            
            // Información del negocio
            $table->string('industry')->nullable(); // Tipo de industria
            $table->text('description')->nullable(); // Descripción del negocio
            $table->string('website')->nullable();
            $table->json('business_hours')->nullable(); // Horarios de atención
            
            // Configuración SaaS
            $table->string('subdomain')->nullable()->unique(); // subdominio.app.com
            $table->enum('plan', ['basic', 'professional', 'enterprise'])->default('basic');
            $table->integer('max_users')->default(5); // Límite de usuarios
            $table->integer('max_clients')->default(100); // Límite de clientes
            $table->integer('max_policies')->default(1000); // Límite de pólizas
            $table->json('features')->nullable(); // Características habilitadas
            $table->json('settings')->nullable(); // Configuraciones del broker
            
            // Branding
            $table->string('logo')->nullable();
            $table->string('favicon')->nullable();
            $table->json('brand_colors')->nullable(); // Colores de marca
            $table->json('theme_settings')->nullable(); // Configuraciones del tema
            
            // Estados y control
            $table->enum('status', ['active', 'inactive', 'suspended', 'trial'])->default('trial');
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamp('subscription_ends_at')->nullable();
            $table->timestamp('last_activity_at')->nullable();
            
            // Relaciones
            $table->unsignedBigInteger('owner_id'); // Usuario propietario (MASTER)
            
            $table->timestamps();
            
            // Índices
            $table->index(['status']);
            $table->index(['owner_id']);
            $table->index(['plan']);
            $table->index(['document_number']);
            $table->index(['subdomain']);
            
            // Foreign keys
            $table->foreign('owner_id')->references('id')->on('users')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('brokers');
    }
};
