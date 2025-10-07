<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clientes', function (Blueprint $table) {
            if (!Schema::hasColumn('clientes', 'legal_representative_document_type')) {
                $table->string('legal_representative_document_type', 20)->nullable()->after('legal_representative_name');
            }
            if (!Schema::hasColumn('clientes', 'legal_representative_document_number')) {
                $table->string('legal_representative_document_number', 100)->nullable()->after('legal_representative_document_type');
                $table->index('legal_representative_document_number');
            }
        });
    }

    public function down(): void
    {
        Schema::table('clientes', function (Blueprint $table) {
            if (Schema::hasColumn('clientes', 'legal_representative_document_number')) {
                $table->dropIndex(['legal_representative_document_number']);
                $table->dropColumn('legal_representative_document_number');
            }
            if (Schema::hasColumn('clientes', 'legal_representative_document_type')) {
                $table->dropColumn('legal_representative_document_type');
            }
        });
    }
};


