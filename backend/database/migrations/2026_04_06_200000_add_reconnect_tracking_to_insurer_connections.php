<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('insurer_connections', function (Blueprint $table) {
            $table->unsignedInteger('reconnect_count')->default(0)->after('last_error');
            $table->timestamp('last_reconnect_at')->nullable()->after('reconnect_count');
            $table->boolean('credentials_valid')->default(true)->after('last_reconnect_at');
        });
    }

    public function down(): void
    {
        Schema::table('insurer_connections', function (Blueprint $table) {
            $table->dropColumn(['reconnect_count', 'last_reconnect_at', 'credentials_valid']);
        });
    }
};
