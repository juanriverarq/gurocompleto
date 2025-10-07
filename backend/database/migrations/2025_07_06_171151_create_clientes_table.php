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
        Schema::create('clientes', function (Blueprint $table) {
            $table->id();
            
            // Aislamiento por broker
            $table->unsignedBigInteger('broker_id'); // Aislamiento multi-tenant
            
            // Información personal
            $table->string('first_name');
            $table->string('last_name');
            $table->string('document_type')->default('CC'); // CC, NIT, CE, etc.
            $table->string('document_number');
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('mobile_phone')->nullable();
            $table->date('birth_date')->nullable();
            $table->enum('gender', ['M', 'F', 'O'])->nullable();
            $table->enum('marital_status', ['soltero', 'casado', 'divorciado', 'viudo', 'union_libre'])->nullable();
            
            // Información de contacto
            $table->text('address')->nullable();
            $table->string('city')->nullable();
            $table->string('state')->nullable();
            $table->string('country')->default('Colombia');
            $table->string('postal_code')->nullable();
            
            // Información laboral
            $table->string('occupation')->nullable();
            $table->string('company')->nullable();
            $table->decimal('monthly_income', 12, 2)->nullable();
            $table->text('work_address')->nullable();
            
            // Información de emergencia
            $table->string('emergency_contact_name')->nullable();
            $table->string('emergency_contact_phone')->nullable();
            $table->string('emergency_contact_relationship')->nullable();
            
            // Gestión y seguimiento
            $table->unsignedBigInteger('assigned_user_id')->nullable(); // Usuario asignado
            $table->enum('status', ['active', 'inactive', 'prospect', 'blocked'])->default('prospect');
            $table->enum('priority', ['low', 'medium', 'high'])->default('medium');
            $table->text('notes')->nullable();
            $table->json('tags')->nullable(); // Etiquetas para categorizar
            $table->json('custom_fields')->nullable(); // Campos personalizados
            
            // Información comercial
            $table->string('source')->nullable(); // Fuente de adquisición
            $table->decimal('total_policies_value', 15, 2)->default(0);
            $table->integer('total_policies_count')->default(0);
            $table->timestamp('last_contact_at')->nullable();
            $table->timestamp('next_follow_up_at')->nullable();
            
            // Auditoria
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            
            $table->timestamps();
            
            // Índices
            $table->index(['broker_id']);
            $table->index(['assigned_user_id']);
            $table->index(['status']);
            $table->index(['priority']);
            $table->index(['document_number']);
            $table->index(['email']);
            $table->index(['phone']);
            $table->index(['created_by']);
            $table->index(['updated_by']);
            
            // Índice único por broker para evitar duplicados
            $table->unique(['broker_id', 'document_number']);
            
            // Foreign keys
            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            $table->foreign('assigned_user_id')->references('id')->on('users')->onDelete('set null');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('updated_by')->references('id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('clientes');
    }
};
