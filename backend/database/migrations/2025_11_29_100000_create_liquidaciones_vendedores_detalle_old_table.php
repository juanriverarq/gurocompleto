<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('liquidaciones_vendedores_detalle_old')) {
            Schema::create('liquidaciones_vendedores_detalle_old', function (Blueprint $table) {
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
                $table->index(['liquidacion_id'], 'liq_vend_det_old_liquidacion_idx');
                $table->index(['poliza_id'], 'liq_vend_det_old_poliza_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('liquidaciones_vendedores_detalle_old');
    }
};
