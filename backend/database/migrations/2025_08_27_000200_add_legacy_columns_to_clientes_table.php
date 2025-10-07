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
        Schema::table('clientes', function (Blueprint $table) {
            $table->string('legacy_type', 20)->nullable()->after('updated_by');
            $table->unsignedBigInteger('legacy_id')->nullable()->after('legacy_type');

            $table->index(['legacy_type']);
            $table->index(['legacy_id']);
            $table->unique(['broker_id', 'legacy_type', 'legacy_id'], 'clientes_broker_legacy_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('clientes', function (Blueprint $table) {
            $table->dropUnique('clientes_broker_legacy_unique');
            $table->dropIndex(['legacy_type']);
            $table->dropIndex(['legacy_id']);
            $table->dropColumn(['legacy_type', 'legacy_id']);
        });
    }
};


