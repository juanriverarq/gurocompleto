<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('payment_sessions')) {
            // Usamos SQL nativo para evitar dependencia de doctrine/dbal
            DB::statement('ALTER TABLE payment_sessions MODIFY COLUMN checkout_url TEXT NULL');
            DB::statement('ALTER TABLE payment_sessions MODIFY COLUMN redirect_url TEXT NULL');
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('payment_sessions')) {
            // Revertir a VARCHAR(255) si fuese necesario
            DB::statement('ALTER TABLE payment_sessions MODIFY COLUMN checkout_url VARCHAR(255) NULL');
            DB::statement('ALTER TABLE payment_sessions MODIFY COLUMN redirect_url VARCHAR(255) NULL');
        }
    }
};


