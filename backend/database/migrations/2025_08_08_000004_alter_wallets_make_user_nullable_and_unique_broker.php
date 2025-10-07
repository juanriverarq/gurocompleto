<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wallets', function (Blueprint $table) {
            // Hacer user_id nullable para permitir wallets por broker sin usuario asignado
            $table->unsignedBigInteger('user_id')->nullable()->change();
            // Asegurar unicidad por broker para evitar duplicados (si no existe ya)
            if (!Schema::hasColumn('wallets', 'broker_id')) {
                $table->unsignedBigInteger('broker_id')->nullable()->after('user_id');
            }
        });
        // Agregar índice único fuera del closure para compatibilidad con algunas DBs
        try {
            Schema::table('wallets', function (Blueprint $table) {
                $table->unique(['broker_id'], 'wallets_broker_unique');
            });
        } catch (\Throwable $e) {
            // Si ya existe el índice, ignorar
        }
    }

    public function down(): void
    {
        Schema::table('wallets', function (Blueprint $table) {
            // Revertir a NOT NULL si fuera necesario (puede fallar si hay nulos)
            // $table->unsignedBigInteger('user_id')->nullable(false)->change();
            try { $table->dropUnique('wallets_broker_unique'); } catch (\Throwable $e) {}
        });
    }
};


