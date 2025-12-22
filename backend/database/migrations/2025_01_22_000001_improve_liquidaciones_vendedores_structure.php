<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Verificar si necesitamos crear la estructura nueva
        if (!Schema::hasTable('liquidaciones_vendedores_cabecera')) {
            // Crear tabla principal de liquidaciones (cabecera)
            Schema::create('liquidaciones_vendedores_cabecera', function (Blueprint $table) {
            $table->id();
            $table->string('codigo')->unique(); // LIQ-2025-001
            $table->foreignId('broker_id')->constrained('brokers')->onDelete('cascade');
            $table->foreignId('vendedor_id')->constrained('vendedores')->onDelete('cascade');
            
            // Período de liquidación
            $table->date('periodo_inicio');
            $table->date('periodo_fin');
            $table->date('fecha_generacion');
            
            // Filtros aplicados (JSON para almacenar criterios)
            $table->json('filtros_aplicados')->nullable(); // {ramos: [], aseguradoras: [], etc}
            
            // Montos totales
            $table->decimal('prima_total', 15, 2)->default(0);
            $table->decimal('monto_bruto_total', 15, 2)->default(0);
            $table->decimal('monto_retencion_total', 15, 2)->default(0);
            $table->decimal('monto_retencion_ica_total', 15, 2)->default(0);
            $table->decimal('monto_iva_total', 15, 2)->default(0);
            $table->decimal('monto_neto_total', 15, 2)->default(0);
            $table->integer('cantidad_polizas')->default(0);
            
            // Información del pago
            $table->enum('estado', ['generada', 'aprobada', 'pagada', 'revertida'])->default('generada');
            $table->date('fecha_pago')->nullable();
            $table->string('metodo_pago')->nullable(); // efectivo, transferencia, cheque, nequi, daviplata
            $table->string('referencia_pago')->nullable();
            $table->string('comprobante_url')->nullable();
            
            // PDF generado
            $table->string('pdf_url')->nullable();
            
            // Observaciones
            $table->text('observaciones')->nullable();
            
            // Auditoría
            $table->foreignId('creado_por')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('aprobado_por')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('fecha_aprobacion')->nullable();
            
            // Reversión
            $table->foreignId('revertido_por')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('fecha_reversion')->nullable();
            $table->text('motivo_reversion')->nullable();
            
            $table->timestamps();
            
            // Índices
            $table->index(['broker_id', 'vendedor_id'], 'liq_vend_cab_broker_vendedor_idx');
            $table->index(['broker_id', 'estado'], 'liq_vend_cab_broker_estado_idx');
            $table->index(['periodo_inicio', 'periodo_fin'], 'liq_vend_cab_periodo_idx');
            $table->index(['fecha_generacion'], 'liq_vend_cab_fecha_gen_idx');
            $table->index(['codigo'], 'liq_vend_cab_codigo_idx');
            });
        }
        
        // Crear tabla de detalle (pólizas incluidas en cada liquidación)
        if (!Schema::hasTable('liquidaciones_vendedores_detalle_new')) {
            Schema::create('liquidaciones_vendedores_detalle_new', function (Blueprint $table) {
                $table->id();
                $table->foreignId('liquidacion_id')->constrained('liquidaciones_vendedores_cabecera')->onDelete('cascade');
            $table->foreignId('poliza_id')->constrained('polizas')->onDelete('cascade');
            
            // Información de la póliza al momento de liquidación
            $table->string('numero_poliza');
            $table->string('cliente_nombre');
            $table->string('aseguradora')->nullable();
            $table->string('ramo')->nullable();
            $table->date('fecha_poliza');
            
            // Montos calculados
            $table->decimal('prima_neta', 15, 2)->default(0);
            $table->decimal('porcentaje_comision', 5, 2)->default(0);
            $table->decimal('comision_bruta', 15, 2)->default(0);
            $table->decimal('porcentaje_retencion', 5, 2)->default(0);
            $table->decimal('monto_retencion', 15, 2)->default(0);
            $table->decimal('porcentaje_retencion_ica', 5, 2)->default(0);
            $table->decimal('monto_retencion_ica', 15, 2)->default(0);
            $table->decimal('porcentaje_iva', 5, 2)->default(0);
            $table->decimal('monto_iva', 15, 2)->default(0);
            $table->decimal('comision_neta', 15, 2)->default(0);
            
            $table->timestamps();
            
            // Índices
            $table->index(['liquidacion_id'], 'liq_vend_det_liquidacion_idx');
            $table->index(['poliza_id'], 'liq_vend_det_poliza_idx');
            $table->unique(['liquidacion_id', 'poliza_id'], 'liq_vend_det_unique'); // Una póliza no puede estar en la misma liquidación dos veces
            });
        }
        
        // Migrar datos existentes si los hay (opcional, dependiendo de si hay data)
        // Se puede hacer manualmente después
    }

    public function down(): void
    {
        Schema::dropIfExists('liquidaciones_vendedores_detalle_new');
        Schema::dropIfExists('liquidaciones_vendedores_cabecera');
    }
};
