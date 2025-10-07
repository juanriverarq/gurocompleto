<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('polizas', function (Blueprint $table) {
            // Partes (Tomador / Asegurado)
            $table->string('policy_holder_name')->nullable()->after('client_document');
            $table->string('policy_holder_document')->nullable()->after('policy_holder_name');
            $table->string('insured_name')->nullable()->after('policy_holder_document');
            $table->string('insured_document')->nullable()->after('insured_name');
            $table->json('beneficiaries')->nullable()->after('beneficiary_phone');

            // Montos tributarios / totales
            $table->decimal('vat_percentage', 5, 2)->nullable()->after('commission_amount');
            $table->decimal('vat_amount', 15, 2)->nullable()->after('vat_percentage');
            $table->decimal('total_amount', 15, 2)->nullable()->after('vat_amount');

            // Vendedor visible
            $table->string('seller_name')->nullable()->after('assigned_user_id');

            // Datos de pago
            $table->string('bank_name')->nullable()->after('payment_method');
            $table->unsignedInteger('installments_count')->nullable()->after('bank_name');
            $table->string('card_last4', 8)->nullable()->after('installments_count');
        });
    }

    public function down(): void
    {
        Schema::table('polizas', function (Blueprint $table) {
            $table->dropColumn([
                'policy_holder_name',
                'policy_holder_document',
                'insured_name',
                'insured_document',
                'beneficiaries',
                'vat_percentage',
                'vat_amount',
                'total_amount',
                'seller_name',
                'bank_name',
                'installments_count',
                'card_last4',
            ]);
        });
    }
};


