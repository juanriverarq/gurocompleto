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
        // Tabla para registros de extracción PDF
        Schema::create('pdf_extraction_records', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id');
            $table->unsignedBigInteger('user_id')->nullable();
            
            // Información del archivo
            $table->string('file_name');
            $table->bigInteger('file_size');
            $table->string('file_hash', 64)->nullable(); // SHA-256 del archivo
            $table->integer('page_count')->default(1);
            $table->boolean('has_selectable_text')->default(false);
            
            // Información de la extracción
            $table->string('detected_insurer')->nullable();
            $table->enum('document_type', ['policy', 'certificate', 'endorsement', 'addendum', 'unknown'])->default('unknown');
            $table->enum('document_quality', ['high', 'medium', 'low'])->default('medium');
            $table->string('extraction_method');
            $table->integer('processing_time_ms');
            
            // Datos extraídos (JSON)
            $table->json('extracted_data');
            $table->json('corrected_data')->nullable();
            
            // Métricas de confianza
            $table->decimal('confidence_overall', 5, 2);
            $table->decimal('confidence_extraction', 5, 2);
            $table->decimal('confidence_validation', 5, 2);
            $table->decimal('confidence_consistency', 5, 2);
            $table->decimal('confidence_historical', 5, 2);
            
            // Feedback del usuario
            $table->tinyInteger('user_rating')->nullable(); // 1-5
            $table->text('user_comments')->nullable();
            $table->json('user_feedback')->nullable();
            
            // Estado del registro
            $table->boolean('has_corrections')->default(false);
            $table->boolean('is_validated')->default(false);
            $table->timestamp('corrected_at')->nullable();
            
            $table->timestamps();
            
            // Índices
            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
            
            $table->index(['broker_id', 'detected_insurer']);
            $table->index(['broker_id', 'extraction_method']);
            $table->index(['broker_id', 'document_type']);
            $table->index(['broker_id', 'created_at']);
            $table->index(['confidence_overall']);
            $table->index(['has_corrections']);
            $table->index(['file_hash']);
        });

        // Tabla para patrones dinámicos aprendidos
        Schema::create('pdf_dynamic_patterns', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id');
            
            // Identificación del patrón
            $table->string('field_name'); // numeroPoliza, fechaInicio, etc.
            $table->string('insurer_name');
            $table->string('document_type')->default('policy');
            
            // Patrón
            $table->text('pattern_regex');
            $table->text('pattern_description')->nullable();
            $table->json('pattern_examples')->nullable();
            
            // Métricas del patrón
            $table->decimal('confidence', 5, 2)->default(50.00);
            $table->decimal('success_rate', 5, 2)->default(0.00);
            $table->integer('usage_count')->default(0);
            $table->integer('success_count')->default(0);
            
            // Metadatos
            $table->json('metadata')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_used_at')->nullable();
            
            $table->timestamps();
            
            // Índices y constraints
            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            
            $table->unique(['broker_id', 'field_name', 'insurer_name', 'document_type'], 'pdf_patterns_unique');
            $table->index(['broker_id', 'insurer_name']);
            $table->index(['field_name', 'success_rate']);
            $table->index(['is_active', 'confidence']);
        });

        // Tabla para métricas de rendimiento
        Schema::create('pdf_performance_metrics', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id');
            
            // Período de la métrica
            $table->date('metric_date');
            $table->enum('metric_period', ['daily', 'weekly', 'monthly'])->default('daily');
            
            // Métricas generales
            $table->integer('total_extractions')->default(0);
            $table->integer('successful_extractions')->default(0);
            $table->decimal('success_rate', 5, 2)->default(0.00);
            $table->decimal('average_confidence', 5, 2)->default(0.00);
            $table->integer('average_processing_time_ms')->default(0);
            
            // Métricas por método
            $table->json('method_performance')->nullable(); // { "ai": { "count": 10, "avg_confidence": 85 }, ... }
            
            // Métricas por aseguradora
            $table->json('insurer_performance')->nullable();
            
            // Errores más frecuentes
            $table->json('top_errors')->nullable(); // { "field": "count" }
            
            // Tendencias
            $table->decimal('improvement_trend', 5, 2)->default(0.00); // % de mejora vs período anterior
            
            $table->timestamps();
            
            // Índices y constraints
            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            
            $table->unique(['broker_id', 'metric_date', 'metric_period'], 'pdf_metrics_unique');
            $table->index(['broker_id', 'metric_period']);
            $table->index(['metric_date', 'success_rate']);
        });

        // Tabla para configuración de procesamiento por broker
        Schema::create('pdf_processing_configs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id');
            
            // Configuración de APIs
            $table->json('api_config')->nullable(); // Configuración de APIs habilitadas
            
            // Configuración de procesamiento
            $table->enum('processing_mode', ['advanced-hybrid', 'hybrid', 'ai-only', 'ocr-only', 'patterns-only'])->default('hybrid');
            $table->integer('max_file_size_mb')->default(20);
            $table->boolean('enable_learning')->default(true);
            $table->boolean('enable_cross_validation')->default(true);
            $table->boolean('enable_parallel_processing')->default(true);
            
            // Umbrales de confianza personalizados
            $table->json('confidence_thresholds')->nullable();
            
            // Configuración de validación
            $table->json('validation_config')->nullable();
            
            // Configuración de fallbacks
            $table->json('fallback_config')->nullable();
            
            $table->timestamps();
            
            // Índices y constraints
            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            $table->unique('broker_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pdf_processing_configs');
        Schema::dropIfExists('pdf_performance_metrics');
        Schema::dropIfExists('pdf_dynamic_patterns');
        Schema::dropIfExists('pdf_extraction_records');
    }
};