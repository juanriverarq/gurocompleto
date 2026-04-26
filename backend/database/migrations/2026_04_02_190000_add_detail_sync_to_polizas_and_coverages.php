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
        // Add detail sync tracking columns to polizas
        Schema::table('polizas', function (Blueprint $table) {
            // Detail sync status: pending, processing, completed, failed, partial, not_applicable
            $table->string('detail_sync_status', 20)->default('pending')->after('updated_at')
                ->index()
                ->comment('Estado de sincronizacion de detalles (coberturas, personas, etc.)');
            
            // When detail was last synced
            $table->timestamp('detail_sync_at')->nullable()->after('detail_sync_status')
                ->comment('Fecha de ultima sincronizacion de detalles');
            
            // Error message if detail sync failed
            $table->text('detail_sync_error')->nullable()->after('detail_sync_at')
                ->comment('Mensaje de error si fallo la sincronizacion de detalles');
            
            // Which insurer connection was used for detail sync
            $table->foreignId('detail_sync_insurer_connection_id')->nullable()->after('detail_sync_error')
                ->constrained('insurer_connections')->nullOnDelete()
                ->comment('Conexion de aseguradora usada para sincronizar detalles');
        });

        // Table for coberturas (the main new data from detail endpoints)
        Schema::create('poliza_coverages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('poliza_id')->constrained('polizas')->cascadeOnDelete();
            $table->foreignId('broker_id')->constrained('brokers')->cascadeOnDelete();
            
            // Coverage data normalized across insurers
            $table->string('coverage_type', 100)->nullable()->comment('Tipo de cobertura ej: Danos a Terceros');
            $table->string('coverage_name', 255)->comment('Nombre de la cobertura');
            $table->string('coverage_code', 50)->nullable()->comment('Codigo de cobertura si aplica');
            
            // Values
            $table->decimal('insured_value', 18, 2)->nullable()->comment('Valor asegurado');
            $table->string('deductible', 100)->nullable()->comment('Deducible (puede ser % o valor ej: "1 SMLV")');
            $table->decimal('deductible_value', 18, 2)->nullable()->comment('Deducible como valor numerico si aplica');
            $table->decimal('deductible_percentage', 5, 2)->nullable()->comment('Deducible como porcentaje si aplica');
            
            // Source tracking
            $table->string('source_insurer', 50)->nullable()->comment('Aseguradora origen de la cobertura');
            $table->json('raw_data')->nullable()->comment('Datos crudos de la API');
            
            $table->timestamps();
            
            // Index for fast lookup by poliza
            $table->index(['poliza_id', 'broker_id']);
            $table->index('coverage_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('poliza_coverages');
        
        Schema::table('polizas', function (Blueprint $table) {
            $table->dropForeign(['detail_sync_insurer_connection_id']);
            $table->dropColumn([
                'detail_sync_status',
                'detail_sync_at',
                'detail_sync_error',
                'detail_sync_insurer_connection_id',
            ]);
        });
    }
};
