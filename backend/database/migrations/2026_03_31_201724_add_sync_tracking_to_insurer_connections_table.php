<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('insurer_connections', function (Blueprint $table) {
            $table->timestamp('last_sync_at')->nullable()->after('last_healthcheck_at');
            $table->unsignedInteger('last_sync_clientes_count')->default(0)->after('last_sync_at');
            $table->unsignedInteger('last_sync_polizas_count')->default(0)->after('last_sync_clientes_count');
        });
    }

    public function down(): void
    {
        Schema::table('insurer_connections', function (Blueprint $table) {
            $table->dropColumn(['last_sync_at', 'last_sync_clientes_count', 'last_sync_polizas_count']);
        });
    }
};
