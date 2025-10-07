<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('anexos', function (Blueprint $table) {
            $table->date('issue_date')->nullable()->after('branch');
            $table->date('reception_date')->nullable()->after('issue_date');
            $table->decimal('vat_percentage', 5, 2)->nullable()->after('prima_neta');
            $table->decimal('pri_a_pre', 15, 2)->nullable()->after('vat_percentage');
            $table->decimal('commission_percentage', 5, 2)->nullable()->after('pri_a_pre');
            $table->decimal('commission_amount', 15, 2)->nullable()->after('commission_percentage');
            $table->decimal('total_amount', 15, 2)->nullable()->after('commission_amount');
            $table->enum('payment_frequency', ['monthly','quarterly','biannual','annual'])->nullable()->after('total_amount');
            $table->enum('payment_method', ['cash','transfer','check','card','financing'])->nullable()->after('payment_frequency');
            $table->string('motivo')->nullable()->after('payment_method');
            $table->string('fawf')->nullable()->after('motivo');
            $table->text('accesorios')->nullable()->after('observaciones');
        });
    }

    public function down(): void
    {
        Schema::table('anexos', function (Blueprint $table) {
            $table->dropColumn([
                'issue_date', 'reception_date', 'vat_percentage', 'pri_a_pre', 'commission_percentage',
                'commission_amount', 'total_amount', 'payment_frequency', 'payment_method', 'motivo', 'fawf', 'accesorios'
            ]);
        });
    }
};




