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
        // Verificar si la columna ya existe
        if (!Schema::hasColumn('campaign_executions', 'broker_id')) {
            Schema::table('campaign_executions', function (Blueprint $table) {
                $table->unsignedBigInteger('broker_id')->nullable()->after('id');
            });
        }
        
        // Asignar broker_id basado en las campaigns
        \DB::statement('
            UPDATE campaign_executions ce 
            JOIN campaigns c ON ce.campaign_id = c.id 
            SET ce.broker_id = c.broker_id 
            WHERE ce.broker_id IS NULL
        ');
        
        // Verificar si la foreign key ya existe
        $foreignKeys = \DB::select(
            "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS 
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'campaign_executions' 
             AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME = 'campaign_executions_broker_id_foreign'"
        );
        
        if (empty($foreignKeys)) {
            Schema::table('campaign_executions', function (Blueprint $table) {
                $table->unsignedBigInteger('broker_id')->nullable(false)->change();
                $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
                $table->index(['broker_id', 'campaign_id']);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('campaign_executions', function (Blueprint $table) {
            $table->dropForeign(['broker_id']);
            $table->dropIndex(['broker_id', 'campaign_id']);
            $table->dropColumn('broker_id');
        });
    }
};
