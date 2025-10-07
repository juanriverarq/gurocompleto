<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('polizas', function (Blueprint $table) {
            $table->string('cheque_number')->nullable()->after('card_last4');
            $table->string('agreement_term')->nullable()->after('cheque_number');
            $table->string('debit_account_number')->nullable()->after('agreement_term');
        });
    }

    public function down(): void
    {
        Schema::table('polizas', function (Blueprint $table) {
            $table->dropColumn(['cheque_number', 'agreement_term', 'debit_account_number']);
        });
    }
};


