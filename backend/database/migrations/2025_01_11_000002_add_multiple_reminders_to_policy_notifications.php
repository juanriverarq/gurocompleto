<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('policy_notification_configs', function (Blueprint $table) {
            // Cambiar de integer a JSON para soportar múltiples días
            $table->json('expiration_days_before_multiple')->nullable()->after('expiration_days_before');
            $table->json('renewal_days_before_multiple')->nullable()->after('renewal_days_before');
            $table->json('payment_days_before_multiple')->nullable()->after('payment_days_before');
        });

        // Migrar datos existentes: convertir el valor único a array
        DB::table('policy_notification_configs')->get()->each(function ($config) {
            DB::table('policy_notification_configs')
                ->where('id', $config->id)
                ->update([
                    'expiration_days_before_multiple' => json_encode([$config->expiration_days_before]),
                    'renewal_days_before_multiple' => json_encode([$config->renewal_days_before]),
                    'payment_days_before_multiple' => json_encode([$config->payment_days_before]),
                ]);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('policy_notification_configs', function (Blueprint $table) {
            $table->dropColumn('expiration_days_before_multiple');
            $table->dropColumn('renewal_days_before_multiple');
            $table->dropColumn('payment_days_before_multiple');
        });
    }
};