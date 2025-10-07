<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Drop unique index on policy_number if exists
        $idx = DB::select("SELECT INDEX_NAME FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name='polizas' AND INDEX_NAME='polizas_policy_number_unique' LIMIT 1");
        if (!empty($idx)) {
            DB::statement('ALTER TABLE polizas DROP INDEX polizas_policy_number_unique');
        }

        // Create unique composite index if not exists
        $hasComposite = DB::select("SELECT INDEX_NAME FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name='polizas' AND INDEX_NAME='polizas_broker_policy_unique' LIMIT 1");
        if (empty($hasComposite)) {
            DB::statement('ALTER TABLE polizas ADD UNIQUE KEY polizas_broker_policy_unique (broker_id, policy_number)');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop composite index if exists
        $hasComposite = DB::select("SELECT INDEX_NAME FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name='polizas' AND INDEX_NAME='polizas_broker_policy_unique' LIMIT 1");
        if (!empty($hasComposite)) {
            DB::statement('ALTER TABLE polizas DROP INDEX polizas_broker_policy_unique');
        }
        // Restore unique on policy_number if not exists
        $idx = DB::select("SELECT INDEX_NAME FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name='polizas' AND INDEX_NAME='polizas_policy_number_unique' LIMIT 1");
        if (empty($idx)) {
            DB::statement('ALTER TABLE polizas ADD UNIQUE KEY polizas_policy_number_unique (policy_number)');
        }
    }
};


