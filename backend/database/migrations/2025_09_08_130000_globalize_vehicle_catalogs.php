<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // veh_lines: preservar FK de model_id creando índice dedicado antes de eliminar unique compuesto
        Schema::table('veh_lines', function (Blueprint $table) {
            if (Schema::hasColumn('veh_lines', 'broker_id')) {
                // Primero soltar FK de broker_id
                try { $table->dropForeign(['broker_id']); } catch (\Throwable $e) {}
                // Luego soltar unique que incluye broker_id
                try { $table->dropUnique('veh_lines_broker_id_model_id_name_unique'); } catch (\Throwable $e) {}
                // Ahora eliminar la columna y crear índices/unique globales
                $table->dropColumn('broker_id');
                // Asegurar no crear índice duplicado
                // $table->index('model_id');
                $table->unique(['model_id','name']);
            }
        });

        // veh_models
        Schema::table('veh_models', function (Blueprint $table) {
            if (Schema::hasColumn('veh_models', 'broker_id')) {
                try { $table->dropForeign(['broker_id']); } catch (\Throwable $e) {}
                try { $table->dropUnique('veh_models_broker_id_brand_id_name_unique'); } catch (\Throwable $e) {}
                $table->dropColumn('broker_id');
                $table->index('brand_id');
                $table->unique(['brand_id','name']);
            }
        });

        // veh_brands
        Schema::table('veh_brands', function (Blueprint $table) {
            if (Schema::hasColumn('veh_brands', 'broker_id')) {
                try { $table->dropForeign(['broker_id']); } catch (\Throwable $e) {}
                try { $table->dropUnique('veh_brands_broker_id_name_unique'); } catch (\Throwable $e) {}
                $table->dropColumn('broker_id');
                $table->unique(['name']);
            }
        });
    }

    public function down(): void
    {
        // Restore broker_id scoped uniqueness (best effort; adds nullable broker_id)
        Schema::table('veh_brands', function (Blueprint $table) {
            if (!Schema::hasColumn('veh_brands', 'broker_id')) {
                $table->unsignedBigInteger('broker_id')->nullable()->after('id');
                $table->dropUnique(['name']);
                $table->unique(['broker_id','name']);
            }
        });
        Schema::table('veh_models', function (Blueprint $table) {
            if (!Schema::hasColumn('veh_models', 'broker_id')) {
                $table->unsignedBigInteger('broker_id')->nullable()->after('id');
                $table->dropUnique(['brand_id','name']);
                $table->unique(['broker_id','brand_id','name']);
            }
        });
        Schema::table('veh_lines', function (Blueprint $table) {
            if (!Schema::hasColumn('veh_lines', 'broker_id')) {
                $table->unsignedBigInteger('broker_id')->nullable()->after('id');
                $table->dropUnique(['model_id','name']);
                $table->unique(['broker_id','model_id','name']);
            }
        });
    }
};


