<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('polizas', function (Blueprint $table) {
            if (!Schema::hasColumn('polizas', 'non_renewal_reason')) {
                $table->string('non_renewal_reason', 100)->nullable()->after('cancellation_reason');
            }
        });
    }

    public function down(): void
    {
        Schema::table('polizas', function (Blueprint $table) {
            if (Schema::hasColumn('polizas', 'non_renewal_reason')) {
                $table->dropColumn('non_renewal_reason');
            }
        });
    }
};
