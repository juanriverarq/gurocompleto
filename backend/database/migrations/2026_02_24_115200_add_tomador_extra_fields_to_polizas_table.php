<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('polizas', function (Blueprint $table) {
            // Tomador extra fields (for collective policies)
            $table->string('policy_holder_doc_type', 10)->nullable()->after('policy_holder_document');
            $table->string('policy_holder_phone', 30)->nullable()->after('policy_holder_doc_type');
            $table->string('policy_holder_email')->nullable()->after('policy_holder_phone');
            $table->string('policy_holder_address')->nullable()->after('policy_holder_email');
            $table->string('policy_holder_city')->nullable()->after('policy_holder_address');
        });
    }

    public function down(): void
    {
        Schema::table('polizas', function (Blueprint $table) {
            $table->dropColumn([
                'policy_holder_doc_type',
                'policy_holder_phone',
                'policy_holder_email',
                'policy_holder_address',
                'policy_holder_city',
            ]);
        });
    }
};
