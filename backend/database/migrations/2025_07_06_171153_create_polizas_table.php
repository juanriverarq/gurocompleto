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
        Schema::create('polizas', function (Blueprint $table) {
            $table->id();
            
            // Aislamiento por broker
            $table->unsignedBigInteger('broker_id'); // Aislamiento multi-tenant
            
            // Información básica de la póliza
            $table->string('policy_number')->unique(); // Número de póliza
            $table->string('internal_number')->nullable(); // Número interno del broker
            $table->enum('type', ['vida', 'autos', 'hogar', 'empresarial', 'salud', 'accidentes', 'responsabilidad_civil', 'otros'])->default('vida');
            $table->string('product_name'); // Nombre del producto
            $table->string('insurance_company'); // Compañía aseguradora
            $table->text('description')->nullable();
            
            // Información del cliente
            $table->unsignedBigInteger('client_id'); // Cliente asociado
            $table->string('client_name'); // Nombre del cliente (desnormalizado para reportes)
            $table->string('client_document'); // Documento del cliente (desnormalizado)
            
            // Fechas importantes
            $table->date('issue_date'); // Fecha de emisión
            $table->date('start_date'); // Fecha de inicio de vigencia
            $table->date('end_date'); // Fecha de fin de vigencia
            $table->date('payment_due_date')->nullable(); // Fecha de vencimiento del pago
            $table->date('renewal_date')->nullable(); // Fecha de renovación
            
            // Información financiera
            $table->decimal('premium_amount', 15, 2); // Prima
            $table->decimal('insured_amount', 15, 2); // Valor asegurado
            $table->decimal('deductible', 15, 2)->nullable(); // Deducible
            $table->decimal('commission_percentage', 5, 2)->nullable(); // Porcentaje de comisión
            $table->decimal('commission_amount', 15, 2)->nullable(); // Monto de comisión
            $table->enum('payment_frequency', ['monthly', 'quarterly', 'biannual', 'annual'])->default('annual');
            $table->enum('payment_method', ['cash', 'transfer', 'check', 'card', 'financing'])->nullable();
            
            // Estados
            $table->enum('status', ['active', 'inactive', 'expired', 'cancelled', 'suspended', 'pending'])->default('pending');
            $table->enum('payment_status', ['paid', 'pending', 'overdue', 'cancelled'])->default('pending');
            $table->text('status_notes')->nullable();
            
            // Información del beneficiario
            $table->string('beneficiary_name')->nullable();
            $table->string('beneficiary_document')->nullable();
            $table->string('beneficiary_relationship')->nullable();
            $table->string('beneficiary_phone')->nullable();
            
            // Gestión y seguimiento
            $table->unsignedBigInteger('assigned_user_id')->nullable(); // Usuario asignado
            $table->unsignedBigInteger('created_by')->nullable(); // Usuario que creó la póliza
            $table->text('notes')->nullable();
            $table->json('custom_fields')->nullable(); // Campos personalizados
            $table->json('documents')->nullable(); // Documentos asociados
            
            // Renovación automática
            $table->boolean('auto_renewal')->default(false);
            $table->integer('renewal_days_notice')->default(30);
            $table->timestamp('last_renewal_notice_sent')->nullable();
            
            // Auditoria
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->unsignedBigInteger('cancelled_by')->nullable();
            $table->text('cancellation_reason')->nullable();
            
            $table->timestamps();
            
            // Índices
            $table->index(['broker_id']);
            $table->index(['client_id']);
            $table->index(['assigned_user_id']);
            $table->index(['status']);
            $table->index(['payment_status']);
            $table->index(['type']);
            $table->index(['insurance_company']);
            $table->index(['start_date']);
            $table->index(['end_date']);
            $table->index(['renewal_date']);
            $table->index(['payment_due_date']);
            $table->index(['policy_number']);
            $table->index(['client_document']);
            $table->index(['created_by']);
            $table->index(['updated_by']);
            
            // Índice único por broker para números internos
            $table->unique(['broker_id', 'internal_number']);
            
            // Foreign keys
            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            $table->foreign('client_id')->references('id')->on('clientes')->onDelete('cascade');
            $table->foreign('assigned_user_id')->references('id')->on('users')->onDelete('set null');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('updated_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('cancelled_by')->references('id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('polizas');
    }
};
