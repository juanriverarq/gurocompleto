<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('automoviles', function (Blueprint $table) {
            // SOAT
            $table->string('numero_soat', 64)->nullable()->after('pais_origen');
            $table->date('fecha_inicio_soat')->nullable()->after('numero_soat');
            $table->date('fecha_vencimiento_soat')->nullable()->after('fecha_inicio_soat');
            $table->string('aseguradora_soat', 150)->nullable()->after('fecha_vencimiento_soat');
            $table->string('estado_soat', 50)->nullable()->after('aseguradora_soat');

            // RTM (Revisión Técnico-Mecánica)
            $table->string('numero_certificado_rtm', 64)->nullable()->after('estado_soat');
            $table->date('fecha_expedicion_rtm')->nullable()->after('numero_certificado_rtm');
            $table->date('fecha_vencimiento_rtm')->nullable()->after('fecha_expedicion_rtm');
            $table->string('nombre_cda_rtm', 200)->nullable()->after('fecha_vencimiento_rtm');
            $table->string('estado_rtm', 50)->nullable()->after('nombre_cda_rtm');

            // Estado legal / RUNT
            $table->string('estado_automotor', 100)->nullable()->after('estado_rtm');
            $table->string('gravamenes', 200)->nullable()->after('estado_automotor');
            $table->string('prendas', 200)->nullable()->after('gravamenes');
            $table->string('organismo_transito', 200)->nullable()->after('prendas');
            $table->date('fecha_registro_runt')->nullable()->after('organismo_transito');

            // Propietario según RUNT
            $table->string('propietario_nombre', 200)->nullable()->after('fecha_registro_runt');
            $table->string('propietario_documento', 50)->nullable()->after('propietario_nombre');

            // Meta RUNT
            $table->timestamp('runt_consulted_at')->nullable()->after('propietario_documento');
            $table->json('runt_raw_data')->nullable()->after('runt_consulted_at');
        });
    }

    public function down(): void
    {
        Schema::table('automoviles', function (Blueprint $table) {
            $table->dropColumn([
                'numero_soat', 'fecha_inicio_soat', 'fecha_vencimiento_soat', 'aseguradora_soat', 'estado_soat',
                'numero_certificado_rtm', 'fecha_expedicion_rtm', 'fecha_vencimiento_rtm', 'nombre_cda_rtm', 'estado_rtm',
                'estado_automotor', 'gravamenes', 'prendas', 'organismo_transito', 'fecha_registro_runt',
                'propietario_nombre', 'propietario_documento',
                'runt_consulted_at', 'runt_raw_data',
            ]);
        });
    }
};
