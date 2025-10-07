<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Primero verificar si las columnas existen
        $existingColumns = Schema::getColumnListing('siniestros');
        
        Schema::table('siniestros', function (Blueprint $table) use ($existingColumns) {
            // Solo agregar campos si no existen
            if (!in_array('numero_siniestro_compania', $existingColumns)) {
                $table->string('numero_siniestro_compania')->after('numero_siniestro')->nullable();
            }
            
            if (!in_array('fecha_aviso', $existingColumns)) {
                $table->date('fecha_aviso')->after('fecha_ocurrencia')->nullable();
            }
            
            if (!in_array('fecha_notificacion_aseguradora', $existingColumns)) {
                $table->date('fecha_notificacion_aseguradora')->after('fecha_aviso')->nullable();
            }
            
            if (!in_array('proveedor_asignado', $existingColumns)) {
                $table->string('proveedor_asignado')->nullable()->after('fecha_notificacion_aseguradora');
            }
            
            if (!in_array('descripcion_hechos', $existingColumns)) {
                $table->text('descripcion_hechos')->after('proveedor_asignado')->nullable();
            }
            
            if (!in_array('valor_indemnizacion', $existingColumns)) {
                $table->decimal('valor_indemnizacion', 15, 2)->nullable()->after('monto_reclamado');
            }
            
            if (!in_array('deducible', $existingColumns)) {
                $table->decimal('deducible', 15, 2)->nullable()->after('valor_indemnizacion');
            }
            
            if (!in_array('resolucion', $existingColumns)) {
                $table->text('resolucion')->nullable()->after('deducible');
            }
            
            if (!in_array('monto_reclamo', $existingColumns)) {
                $table->decimal('monto_reclamo', 15, 2)->default(0)->after('resolucion');
            }
            
            if (!in_array('coaseguros', $existingColumns)) {
                $table->decimal('coaseguros', 15, 2)->nullable()->after('monto_reclamo');
            }
            
            if (!in_array('finalizado', $existingColumns)) {
                $table->boolean('finalizado')->default(false)->after('coaseguros');
            }
            
            if (!in_array('amparos_afectados', $existingColumns)) {
                $table->json('amparos_afectados')->nullable()->after('finalizado');
            }
        });
        
        // Actualizar el enum de estado si es necesario
        // Nota: Esto es más complejo con enums en MySQL, por ahora lo dejamos como está
        // y manejaremos los nuevos estados en el modelo
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('siniestros', function (Blueprint $table) {
            // Solo eliminar columnas si existen
            $existingColumns = Schema::getColumnListing('siniestros');
            
            $columnsToRemove = [
                'numero_siniestro_compania',
                'fecha_aviso',
                'fecha_notificacion_aseguradora',
                'proveedor_asignado',
                'descripcion_hechos',
                'valor_indemnizacion',
                'deducible',
                'resolucion',
                'monto_reclamo',
                'coaseguros',
                'finalizado',
                'amparos_afectados'
            ];
            
            foreach ($columnsToRemove as $column) {
                if (in_array($column, $existingColumns)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
