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
        Schema::create('siniestros', function (Blueprint $table) {
            $table->id();
            
            // Relaciones
            $table->foreignId('broker_id')->constrained()->onDelete('cascade');
            $table->foreignId('poliza_id')->constrained()->onDelete('cascade');
            $table->foreignId('cliente_id')->constrained()->onDelete('cascade');
            $table->foreignId('assigned_adjuster_id')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->foreignId('updated_by')->nullable()->constrained('users')->onDelete('set null');
            
            // Información básica del siniestro
            $table->string('numero_siniestro')->unique();
            $table->string('numero_poliza');
            $table->string('numero_referencia_aseguradora')->nullable();
            
            // Tipo de siniestro
            $table->enum('tipo_seguro', [
                'auto', 'hogar', 'vida', 'salud', 'empresarial', 
                'responsabilidad_civil', 'transporte', 'construccion', 
                'agropecuario', 'fianza'
            ]);
            $table->enum('tipo_siniestro', [
                'colision', 'robo_total', 'robo_parcial', 'incendio', 
                'vandalismo', 'fenomenos_naturales', 'accidente_laboral',
                'responsabilidad_civil', 'daños_terceros', 'muerte',
                'incapacidad', 'enfermedad', 'hospitalizacion', 'cirugia',
                'daños_agua', 'explosion', 'terremoto', 'inundacion',
                'granizo', 'vientos_fuertes', 'otro'
            ]);
            
            // Fechas importantes
            $table->date('fecha_ocurrencia');
            $table->datetime('fecha_reporte');
            $table->datetime('fecha_asignacion')->nullable();
            $table->datetime('fecha_inspeccion')->nullable();
            $table->datetime('fecha_aprobacion')->nullable();
            $table->datetime('fecha_rechazo')->nullable();
            $table->datetime('fecha_pago')->nullable();
            $table->datetime('fecha_cierre')->nullable();
            
            // Estados del siniestro
            $table->enum('estado', [
                'reportado', 'asignado', 'en_revision', 'investigacion', 
                'peritaje', 'documentos_pendientes', 'aprobado', 
                'aprobado_parcial', 'rechazado', 'pagado', 'cerrado'
            ])->default('reportado');
            $table->datetime('fecha_ultimo_estado')->useCurrent();
            
            // Prioridad
            $table->enum('prioridad', ['baja', 'media', 'alta', 'critica'])->default('media');
            
            // Montos
            $table->decimal('monto_reclamado', 15, 2);
            $table->decimal('monto_aprobado', 15, 2)->nullable();
            $table->decimal('monto_pagado', 15, 2)->nullable();
            $table->decimal('monto_reserva', 15, 2)->nullable();
            $table->decimal('monto_deducible', 15, 2)->nullable();
            $table->decimal('monto_coaseguro', 15, 2)->nullable();
            
            // Información del evento
            $table->text('descripcion_evento');
            $table->text('causa_siniestro')->nullable();
            $table->string('lugar_ocurrencia');
            $table->string('ciudad_ocurrencia');
            $table->string('departamento_ocurrencia');
            $table->string('pais_ocurrencia')->default('Colombia');
            
            // Información de terceros (si aplica)
            $table->boolean('involucra_terceros')->default(false);
            $table->text('datos_terceros')->nullable();
            $table->boolean('hay_heridos')->default(false);
            $table->text('informacion_heridos')->nullable();
            $table->boolean('hay_danos_materiales')->default(false);
            $table->text('danos_materiales')->nullable();
            
            // Aseguradora
            $table->string('aseguradora');
            $table->string('numero_poliza_aseguradora')->nullable();
            $table->string('contacto_aseguradora')->nullable();
            $table->string('email_aseguradora')->nullable();
            $table->string('telefono_aseguradora')->nullable();
            
            // Ajustador/Perito
            $table->string('nombre_ajustador')->nullable();
            $table->string('empresa_ajustadora')->nullable();
            $table->string('contacto_ajustador')->nullable();
            $table->string('email_ajustador')->nullable();
            $table->string('telefono_ajustador')->nullable();
            
            // Testigos
            $table->json('testigos')->nullable();
            
            // Documentos
            $table->json('documentos_recibidos')->nullable();
            $table->json('documentos_pendientes')->nullable();
            $table->integer('total_documentos')->default(0);
            
            // Seguimiento
            $table->json('historial_estados')->nullable();
            $table->json('comunicaciones')->nullable();
            $table->json('observaciones')->nullable();
            
            // Evaluación del siniestro
            $table->text('evaluacion_inicial')->nullable();
            $table->text('informe_investigacion')->nullable();
            $table->text('informe_peritaje')->nullable();
            $table->text('dictamen_final')->nullable();
            
            // Razón de rechazo (si aplica)
            $table->text('motivo_rechazo')->nullable();
            $table->enum('tipo_rechazo', [
                'documentos_insuficientes', 'fuera_cobertura', 'fraude',
                'exclusion_poliza', 'prescripcion', 'causa_no_cubierta',
                'falta_pago_prima', 'otro'
            ])->nullable();
            
            // Información de pago
            $table->string('metodo_pago')->nullable();
            $table->string('numero_cheque')->nullable();
            $table->string('numero_transferencia')->nullable();
            $table->string('cuenta_destino')->nullable();
            $table->string('beneficiario_pago')->nullable();
            
            // Métricas y KPIs
            $table->integer('dias_tramite')->default(0);
            $table->integer('dias_investigacion')->default(0);
            $table->integer('dias_aprobacion')->default(0);
            $table->integer('dias_pago')->default(0);
            $table->decimal('porcentaje_aprobacion', 5, 2)->nullable();
            
            // Indicadores de calidad
            $table->integer('calificacion_servicio')->nullable(); // 1-5
            $table->text('comentarios_cliente')->nullable();
            $table->boolean('cliente_satisfecho')->nullable();
            
            // Recuperación (si aplica)
            $table->boolean('tiene_recuperacion')->default(false);
            $table->decimal('monto_recuperado', 15, 2)->nullable();
            $table->text('detalles_recuperacion')->nullable();
            
            // Re-apertura
            $table->boolean('reabierto')->default(false);
            $table->text('motivo_reapertura')->nullable();
            $table->datetime('fecha_reapertura')->nullable();
            
            // Datos adicionales
            $table->json('datos_vehiculo')->nullable(); // Para seguros de auto
            $table->json('datos_inmueble')->nullable(); // Para seguros de hogar
            $table->json('datos_medicos')->nullable(); // Para seguros de salud/vida
            $table->json('datos_empresa')->nullable(); // Para seguros empresariales
            $table->json('custom_fields')->nullable();
            
            // Archivos adjuntos
            $table->json('archivos_adjuntos')->nullable();
            
            // Auditoría
            $table->boolean('auditado')->default(false);
            $table->text('observaciones_auditoria')->nullable();
            $table->datetime('fecha_auditoria')->nullable();
            $table->foreignId('auditado_por')->nullable()->constrained('users')->onDelete('set null');
            
            // Timestamps
            $table->timestamps();
            $table->softDeletes();
            
            // Índices para optimización
            $table->index(['broker_id', 'estado']);
            $table->index(['poliza_id', 'estado']);
            $table->index(['cliente_id', 'estado']);
            $table->index(['fecha_ocurrencia', 'estado']);
            $table->index(['fecha_reporte', 'estado']);
            $table->index(['tipo_seguro', 'estado']);
            $table->index(['tipo_siniestro', 'estado']);
            $table->index(['aseguradora', 'estado']);
            $table->index(['assigned_adjuster_id', 'estado']);
            $table->index(['prioridad', 'estado']);
            $table->index(['monto_reclamado', 'estado']);
            $table->index(['numero_siniestro']);
            $table->index(['numero_poliza']);
            $table->index(['created_at', 'estado']);
            $table->index(['updated_at', 'estado']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('siniestros');
    }
};
