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
        Schema::create('sales_funnel', function (Blueprint $table) {
            $table->id();
            
            // Relaciones principales
            $table->unsignedBigInteger('broker_id');
            $table->unsignedBigInteger('assigned_agent_id')->nullable(); // Usuario/agente asignado
            $table->unsignedBigInteger('created_by'); // Usuario que creó el lead
            $table->unsignedBigInteger('client_id')->nullable(); // Se llena cuando se convierte en cliente
            
            // Información básica del prospecto
            $table->string('first_name');
            $table->string('last_name');
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('secondary_phone')->nullable();
            $table->string('document_type')->nullable(); // CC, NIT, CE, etc.
            $table->string('document_number')->nullable();
            
            // Información de empresa (si es empresarial)
            $table->string('company_name')->nullable();
            $table->string('company_size')->nullable(); // small, medium, large
            $table->string('industry')->nullable(); // Sector industrial
            $table->string('position')->nullable(); // Cargo en la empresa
            
            // Ubicación
            $table->string('city')->nullable();
            $table->string('department')->nullable();
            $table->text('address')->nullable();
            
            // Información del embudo
            $table->enum('stage', [
                'lead',           // Lead inicial
                'contacted',      // Contactado
                'qualified',      // Calificado 
                'presentation',   // Presentación realizada
                'proposal',       // Propuesta enviada
                'negotiation',    // En negociación
                'closed_won',     // Cerrado ganado
                'closed_lost'     // Cerrado perdido
            ])->default('lead');
            
            $table->enum('lead_source', [
                'website',        // Sitio web
                'social_media',   // Redes sociales
                'google_ads',     // Google Ads
                'facebook_ads',   // Facebook Ads
                'referral',       // Referido
                'cold_call',      // Llamada fría
                'email_campaign', // Campaña email
                'trade_show',     // Feria comercial
                'partner',        // Socio comercial
                'other'          // Otro
            ])->default('website');
            
            // Información del seguro de interés
            $table->enum('insurance_type', [
                'auto',           // Vehículos
                'home',           // Hogar
                'life',           // Vida
                'health',         // Salud
                'business',       // Empresarial
                'travel',         // Viajes
                'motorcycle',     // Motocicleta
                'bicycle',        // Bicicleta
                'pet',            // Mascotas
                'multiple'        // Múltiples seguros
            ]);
            
            // Métricas del embudo
            $table->decimal('potential_value', 15, 2)->default(0); // Valor potencial en COP
            $table->integer('close_probability')->default(0); // Probabilidad de cierre 0-100
            $table->date('expected_close_date')->nullable(); // Fecha esperada de cierre
            
            // Fechas importantes
            $table->datetime('first_contact_at')->nullable(); // Primer contacto
            $table->datetime('last_contact_at')->nullable(); // Último contacto
            $table->datetime('next_follow_up_at')->nullable(); // Próximo seguimiento
            $table->datetime('stage_changed_at')->nullable(); // Cuándo cambió de etapa
            $table->datetime('closed_at')->nullable(); // Cuándo se cerró
            
            // Información de contacto y preferencias
            $table->enum('preferred_contact_method', [
                'phone', 'email', 'whatsapp', 'in_person'
            ])->default('phone');
            $table->string('preferred_contact_time')->nullable(); // morning, afternoon, evening
            $table->json('contact_history')->nullable(); // Historial de contactos
            
            // Notas y observaciones
            $table->text('notes')->nullable(); // Notas generales
            $table->text('qualifying_notes')->nullable(); // Notas de calificación
            $table->text('presentation_notes')->nullable(); // Notas de presentación
            $table->text('negotiation_notes')->nullable(); // Notas de negociación
            $table->text('closing_notes')->nullable(); // Notas de cierre
            $table->text('lost_reason')->nullable(); // Razón de pérdida si aplica
            
            // Información adicional
            $table->json('insurance_details')->nullable(); // Detalles específicos del seguro
            $table->json('custom_fields')->nullable(); // Campos personalizables
            $table->json('activity_log')->nullable(); // Log de actividades
            
            // Scoring y calificación
            $table->integer('lead_score')->default(0); // Puntuación del lead (0-100)
            $table->enum('quality_rating', [
                'hot', 'warm', 'cold'
            ])->default('warm');
            
            // Métricas de tiempo
            $table->integer('days_in_current_stage')->default(0); // Días en etapa actual
            $table->integer('total_days_in_funnel')->default(0); // Días totales en embudo
            
            // Información de conversión
            $table->decimal('final_value', 15, 2)->nullable(); // Valor final si se cierra
            $table->string('policy_number')->nullable(); // Número de póliza si se convierte
            
            // Auditoria
            $table->timestamps();
            $table->softDeletes();
            
            // Índices para optimizar consultas
            $table->index(['broker_id', 'stage']);
            $table->index(['broker_id', 'assigned_agent_id']);
            $table->index(['broker_id', 'insurance_type']);
            $table->index(['broker_id', 'lead_source']);
            $table->index(['broker_id', 'stage', 'expected_close_date']);
            $table->index(['broker_id', 'next_follow_up_at']);
            $table->index(['email']);
            $table->index(['phone']);
            $table->index(['document_number']);
            $table->index(['created_by']);
            $table->index(['stage_changed_at']);
            $table->index(['closed_at']);
            
            // Foreign keys
            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            $table->foreign('assigned_agent_id')->references('id')->on('users')->onDelete('set null');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('client_id')->references('id')->on('clientes')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sales_funnel');
    }
};
