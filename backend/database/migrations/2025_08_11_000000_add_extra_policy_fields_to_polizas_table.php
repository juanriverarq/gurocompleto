<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('polizas', function (Blueprint $table) {
            // Fechas / texto
            $table->date('reception_date')->nullable()->after('issue_date');
            $table->string('currency', 10)->nullable()->after('payment_method');
            $table->text('accessories')->nullable()->after('notes');
            $table->text('reason')->nullable()->after('status_notes');

            // Valores económicos y porcentajes
            $table->decimal('pri_a_pre', 15, 2)->nullable()->after('premium_amount');
            $table->decimal('participation', 8, 2)->nullable()->after('pri_a_pre');
            $table->decimal('co_brokerage', 15, 2)->nullable()->after('commission_amount');
            $table->decimal('agency_commission', 15, 2)->nullable()->after('co_brokerage');
            $table->decimal('withholding_percentage', 5, 2)->nullable()->after('commission_percentage');
            $table->decimal('reteiva_percentage', 5, 2)->nullable()->after('withholding_percentage');

            // Flags / notificaciones
            $table->boolean('virtual_assistant_notifications')->default(false)->after('auto_renewal');
            $table->boolean('renewal_alert')->default(false)->after('virtual_assistant_notifications');
            $table->boolean('send_email_upcoming_payments')->default(false)->after('renewal_alert');
            $table->boolean('send_email_policy_renewed')->default(false)->after('send_email_upcoming_payments');
            $table->boolean('send_email_policy_expired')->default(false)->after('send_email_policy_renewed');
            $table->boolean('send_email_payment_overdue')->default(false)->after('send_email_policy_expired');
            $table->boolean('beneficiary_in_remittance')->default(false)->after('beneficiary_phone');

            // Listas / json
            $table->json('categories')->nullable()->after('custom_fields');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('polizas', function (Blueprint $table) {
            $table->dropColumn([
                'reception_date',
                'currency',
                'accessories',
                'reason',
                'pri_a_pre',
                'participation',
                'co_brokerage',
                'agency_commission',
                'withholding_percentage',
                'reteiva_percentage',
                'virtual_assistant_notifications',
                'renewal_alert',
                'send_email_upcoming_payments',
                'send_email_policy_renewed',
                'send_email_policy_expired',
                'send_email_payment_overdue',
                'beneficiary_in_remittance',
                'categories',
            ]);
        });
    }
};


