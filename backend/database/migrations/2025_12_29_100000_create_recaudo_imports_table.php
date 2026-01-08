<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('recaudo_imports', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('broker_id');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('filename')->nullable();
            $table->string('tipo_recaudo'); // oficina, aseguradora_directo
            $table->string('status')->default('running'); // running, completed, failed, reverted
            $table->unsignedInteger('total_rows')->default(0);
            $table->unsignedInteger('exitosos')->default(0);
            $table->unsignedInteger('fallidos')->default(0);
            $table->decimal('monto_total_importado', 15, 2)->default(0);
            $table->json('pago_ids')->nullable(); // Array de IDs de pagos creados para poder revertir
            $table->json('errores')->nullable(); // Detalle de errores
            $table->json('mapping')->nullable(); // Mapeo de columnas usado
            $table->text('notas')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamp('reverted_at')->nullable();
            $table->unsignedBigInteger('reverted_by')->nullable();
            $table->timestamps();
            
            $table->index(['broker_id', 'status']);
            $table->index(['broker_id', 'created_at']);
        });

        // Agregar campo import_id a pagos_polizas para rastrear de qué importación vino
        Schema::table('pagos_polizas', function (Blueprint $table) {
            $table->unsignedBigInteger('recaudo_import_id')->nullable()->after('observaciones');
            $table->index('recaudo_import_id');
        });
    }

    public function down(): void
    {
        Schema::table('pagos_polizas', function (Blueprint $table) {
            $table->dropIndex(['recaudo_import_id']);
            $table->dropColumn('recaudo_import_id');
        });
        
        Schema::dropIfExists('recaudo_imports');
    }
};
