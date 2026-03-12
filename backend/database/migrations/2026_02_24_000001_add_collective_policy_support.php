<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Agregar campo policy_category a polizas (individual o colectiva)
        if (!Schema::hasColumn('polizas', 'policy_category')) {
            Schema::table('polizas', function (Blueprint $table) {
                $table->string('policy_category', 20)->default('individual')->after('type');
                $table->string('oficina_radicacion')->nullable()->after('policy_category');
                $table->string('ciudad_expedicion')->nullable()->after('oficina_radicacion');
                $table->index('policy_category');
            });
        }

        // Crear tabla de vinculados (riesgos asociados a pólizas colectivas)
        if (!Schema::hasTable('poliza_vinculados')) {
            Schema::create('poliza_vinculados', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('poliza_id');
                $table->unsignedBigInteger('broker_id');

                // Identificador del riesgo (placa, código, etc.)
                $table->string('identificador')->nullable();
                // Documento del asegurado vinculado
                $table->string('documento')->nullable();
                // Nombre del asegurado vinculado
                $table->string('nombre_asegurado');
                // Valores financieros
                $table->decimal('valor', 15, 2)->default(0);
                $table->decimal('valor_iva', 15, 2)->default(0);
                $table->decimal('valor_total', 15, 2)->default(0);
                // Estado del vinculado
                $table->string('estado', 20)->default('activo');
                // Campos opcionales
                $table->string('tipo_documento', 10)->nullable();
                $table->string('telefono', 20)->nullable();
                $table->string('email')->nullable();
                $table->string('direccion')->nullable();
                $table->string('ciudad')->nullable();
                $table->text('observaciones')->nullable();
                $table->json('metadata')->nullable();

                $table->timestamps();

                $table->foreign('poliza_id')->references('id')->on('polizas')->onDelete('cascade');
                $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
                $table->index(['poliza_id']);
                $table->index(['broker_id']);
                $table->index(['identificador']);
                $table->index(['documento']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('poliza_vinculados');

        if (Schema::hasColumn('polizas', 'policy_category')) {
            Schema::table('polizas', function (Blueprint $table) {
                $table->dropIndex(['policy_category']);
                $table->dropColumn(['policy_category', 'oficina_radicacion', 'ciudad_expedicion']);
            });
        }
    }
};
