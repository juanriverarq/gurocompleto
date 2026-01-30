<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Esta migración corrige el problema donde poliza_id no puede ser null
     * cuando se crean múltiples filas de detalle para la misma póliza
     * (por ejemplo, múltiples comisiones/anexos de una misma póliza).
     */
    public function up(): void
    {
        // Verificar si la tabla existe
        if (!Schema::hasTable('liquidaciones_vendedores_detalle_new')) {
            return; // La tabla no existe, nada que hacer
        }

        // Verificar si el índice existe antes de intentar eliminarlo
        $indexExists = collect(DB::select("SHOW INDEX FROM liquidaciones_vendedores_detalle_new WHERE Key_name = 'liq_vend_det_unique'"))->isNotEmpty();
        
        if ($indexExists) {
            Schema::table('liquidaciones_vendedores_detalle_new', function (Blueprint $table) {
                $table->dropUnique('liq_vend_det_unique');
            });
        }

        // Verificar si la foreign key existe
        $fkExists = collect(DB::select("
            SELECT CONSTRAINT_NAME 
            FROM information_schema.TABLE_CONSTRAINTS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'liquidaciones_vendedores_detalle_new' 
            AND CONSTRAINT_TYPE = 'FOREIGN KEY'
            AND CONSTRAINT_NAME LIKE '%poliza_id%'
        "))->isNotEmpty();

        if ($fkExists) {
            Schema::table('liquidaciones_vendedores_detalle_new', function (Blueprint $table) {
                $table->dropForeign(['poliza_id']);
            });
        }

        Schema::table('liquidaciones_vendedores_detalle_new', function (Blueprint $table) {
            // Modificar poliza_id para que sea nullable
            $table->unsignedBigInteger('poliza_id')->nullable()->change();
            
            // Recrear la foreign key permitiendo null
            $table->foreign('poliza_id')
                ->references('id')
                ->on('polizas')
                ->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('liquidaciones_vendedores_detalle_new', function (Blueprint $table) {
            // Eliminar la foreign key
            $table->dropForeign(['poliza_id']);
        });

        Schema::table('liquidaciones_vendedores_detalle_new', function (Blueprint $table) {
            // Restaurar poliza_id como NOT NULL
            $table->unsignedBigInteger('poliza_id')->nullable(false)->change();
            
            // Recrear la foreign key
            $table->foreign('poliza_id')
                ->references('id')
                ->on('polizas')
                ->onDelete('cascade');
            
            // Recrear la restricción unique
            $table->unique(['liquidacion_id', 'poliza_id'], 'liq_vend_det_unique');
        });
    }
};
