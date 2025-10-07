<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('polizas', function (Blueprint $table) {
            $drop = [
                'currency',
                'accessories',
                'categories',
                'virtual_assistant_notifications',
                'renewal_alert',
                'send_email_upcoming_payments',
                'send_email_policy_renewed',
                'send_email_policy_expired',
                'send_email_payment_overdue',
            ];
            foreach ($drop as $col) {
                if (Schema::hasColumn('polizas', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('polizas', function (Blueprint $table) {
            if (!Schema::hasColumn('polizas', 'currency')) {
                $table->string('currency', 10)->nullable()->after('payment_method');
            }
            if (!Schema::hasColumn('polizas', 'accessories')) {
                $table->text('accessories')->nullable()->after('notes');
            }
            if (!Schema::hasColumn('polizas', 'categories')) {
                $table->json('categories')->nullable()->after('custom_fields');
            }
            if (!Schema::hasColumn('polizas', 'virtual_assistant_notifications')) {
                $table->boolean('virtual_assistant_notifications')->default(false)->after('auto_renewal');
            }
            if (!Schema::hasColumn('polizas', 'renewal_alert')) {
                $table->boolean('renewal_alert')->default(false)->after('virtual_assistant_notifications');
            }
            if (!Schema::hasColumn('polizas', 'send_email_upcoming_payments')) {
                $table->boolean('send_email_upcoming_payments')->default(false)->after('renewal_alert');
            }
            if (!Schema::hasColumn('polizas', 'send_email_policy_renewed')) {
                $table->boolean('send_email_policy_renewed')->default(false)->after('send_email_upcoming_payments');
            }
            if (!Schema::hasColumn('polizas', 'send_email_policy_expired')) {
                $table->boolean('send_email_policy_expired')->default(false)->after('send_email_policy_renewed');
            }
            if (!Schema::hasColumn('polizas', 'send_email_payment_overdue')) {
                $table->boolean('send_email_payment_overdue')->default(false)->after('send_email_policy_expired');
            }
        });
    }
};


