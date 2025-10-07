<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('automoviles', function (Blueprint $table) {
            if (!Schema::hasColumn('automoviles', 'referencia1')) $table->string('referencia1', 150)->nullable()->after('clase');
            if (!Schema::hasColumn('automoviles', 'referencia2')) $table->string('referencia2', 150)->nullable()->after('referencia1');
            if (!Schema::hasColumn('automoviles', 'referencia3')) $table->string('referencia3', 150)->nullable()->after('referencia2');
        });
    }

    public function down(): void
    {
        Schema::table('automoviles', function (Blueprint $table) {
            if (Schema::hasColumn('automoviles', 'referencia3')) $table->dropColumn('referencia3');
            if (Schema::hasColumn('automoviles', 'referencia2')) $table->dropColumn('referencia2');
            if (Schema::hasColumn('automoviles', 'referencia1')) $table->dropColumn('referencia1');
        });
    }
};


