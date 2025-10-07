<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('automoviles', function (Blueprint $table) {
            $table->string('tipo_servicio', 100)->nullable()->after('color');
            $table->string('clase', 100)->nullable()->after('tipo_servicio');
            $table->string('linea', 100)->nullable()->after('clase');
            $table->string('tipo_carroceria', 100)->nullable()->after('linea');
            $table->string('numero_motor', 64)->nullable()->after('tipo_carroceria');
            $table->string('numero_chasis', 64)->nullable()->after('numero_motor');
            $table->string('numero_serie', 64)->nullable()->after('numero_chasis');
            $table->unsignedInteger('cilindraje')->nullable()->after('numero_serie');
            $table->string('combustible', 50)->nullable()->after('cilindraje');
            $table->unsignedInteger('capacidad_pasajeros')->nullable()->after('combustible');
            $table->unsignedInteger('capacidad_carga_kg')->nullable()->after('capacidad_pasajeros');
            $table->string('tipo_transmision', 50)->nullable()->after('capacidad_carga_kg');
            $table->string('traccion', 50)->nullable()->after('tipo_transmision');
            $table->string('pais_origen', 100)->nullable()->after('traccion');
        });
    }

    public function down(): void
    {
        Schema::table('automoviles', function (Blueprint $table) {
            $table->dropColumn([
                'tipo_servicio','clase','linea','tipo_carroceria','numero_motor','numero_chasis','numero_serie','cilindraje','combustible','capacidad_pasajeros','capacidad_carga_kg','tipo_transmision','traccion','pais_origen'
            ]);
        });
    }
};


