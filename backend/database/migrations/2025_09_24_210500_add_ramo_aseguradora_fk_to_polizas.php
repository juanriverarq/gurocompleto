<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('polizas', function (Blueprint $table) {
            $table->unsignedBigInteger('aseguradora_id')->nullable()->after('insurance_company');
            $table->unsignedBigInteger('ramo_id')->nullable()->after('product_name');

            $table->index(['broker_id','aseguradora_id'], 'polizas_broker_aseguradora_idx');
            $table->index(['broker_id','ramo_id'], 'polizas_broker_ramo_idx');
        });

        // Backfill IDs from current text columns
        // aseguradora_id
        DB::statement("
            UPDATE polizas p
            JOIN aseguradoras a
              ON a.nombre = p.insurance_company
             AND a.broker_id = p.broker_id
               SET p.aseguradora_id = a.id
            WHERE p.aseguradora_id IS NULL
        ");

        // ramo_id
        DB::statement("
            UPDATE polizas p
            JOIN ramos r
              ON r.nombre = p.product_name
             AND r.broker_id = p.broker_id
               SET p.ramo_id = r.id
            WHERE p.ramo_id IS NULL
        ");

        // Add foreign keys (nullable with cascade set to null)
        Schema::table('polizas', function (Blueprint $table) {
            $table->foreign('aseguradora_id', 'polizas_aseguradora_fk')
                  ->references('id')->on('aseguradoras')
                  ->nullOnDelete();
            $table->foreign('ramo_id', 'polizas_ramo_fk')
                  ->references('id')->on('ramos')
                  ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('polizas', function (Blueprint $table) {
            if (Schema::hasColumn('polizas', 'aseguradora_id')) {
                $table->dropForeign('polizas_aseguradora_fk');
            }
            if (Schema::hasColumn('polizas', 'ramo_id')) {
                $table->dropForeign('polizas_ramo_fk');
            }
            if (Schema::hasColumn('polizas', 'aseguradora_id')) {
                $table->dropIndex('polizas_broker_aseguradora_idx');
            }
            if (Schema::hasColumn('polizas', 'ramo_id')) {
                $table->dropIndex('polizas_broker_ramo_idx');
            }
        });

        Schema::table('polizas', function (Blueprint $table) {
            if (Schema::hasColumn('polizas', 'aseguradora_id')) {
                $table->dropColumn('aseguradora_id');
            }
            if (Schema::hasColumn('polizas', 'ramo_id')) {
                $table->dropColumn('ramo_id');
            }
        });
    }
};