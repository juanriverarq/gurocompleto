<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clientes', function (Blueprint $table) {
            if (!Schema::hasColumn('clientes', 'client_type')) {
                $table->enum('client_type', ['persona', 'empresa'])->default('persona')->after('broker_id');
            }
            if (!Schema::hasColumn('clientes', 'company_legal_name')) {
                $table->string('company_legal_name')->nullable()->after('company');
            }
            if (!Schema::hasColumn('clientes', 'legal_representative_name')) {
                $table->string('legal_representative_name')->nullable()->after('company_legal_name');
            }
        });
    }

    public function down(): void
    {
        Schema::table('clientes', function (Blueprint $table) {
            if (Schema::hasColumn('clientes', 'legal_representative_name')) {
                $table->dropColumn('legal_representative_name');
            }
            if (Schema::hasColumn('clientes', 'company_legal_name')) {
                $table->dropColumn('company_legal_name');
            }
            if (Schema::hasColumn('clientes', 'client_type')) {
                $table->dropColumn('client_type');
            }
        });
    }
};


