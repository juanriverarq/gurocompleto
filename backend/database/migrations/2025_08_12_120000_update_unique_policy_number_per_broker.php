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
        Schema::table('polizas', function (Blueprint $table) {
            // En algunas instalaciones el índice único global puede tener un nombre implícito
            // Intentamos eliminarlo de forma segura si existe
            try {
                $table->dropUnique(['policy_number']);
            } catch (\Throwable $e) {
                // Si el nombre es diferente, intentar por nombre común
                try {
                    $table->dropUnique('polizas_policy_number_unique');
                } catch (\Throwable $e2) {
                    // Ignorar si no existe
                }
            }

            // Crear índice único compuesto por broker y número de póliza
            $table->unique(['broker_id', 'policy_number'], 'polizas_broker_policy_number_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('polizas', function (Blueprint $table) {
            // Remover el índice único compuesto
            try {
                $table->dropUnique('polizas_broker_policy_number_unique');
            } catch (\Throwable $e) {
                // Ignorar si no existe
            }

            // Restaurar índice único global si se desea
            try {
                $table->unique('policy_number');
            } catch (\Throwable $e) {
                // Ignorar fallas
            }
        });
    }
};


