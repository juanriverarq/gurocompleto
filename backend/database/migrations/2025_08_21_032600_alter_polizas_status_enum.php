<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Extender el enum de status para soportar estados adicionales usados por el frontend/backend
        DB::statement("ALTER TABLE `polizas` MODIFY COLUMN `status` ENUM(
            'active',
            'expired',
            'cancelled',
            'suspended',
            'pending',
            'quoted',
            'accrued',
            'issued',
            'not_renewed',
            'renewed'
        ) NOT NULL DEFAULT 'pending'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revertir al conjunto mínimo soportado previamente
        DB::statement("ALTER TABLE `polizas` MODIFY COLUMN `status` ENUM(
            'active',
            'expired',
            'cancelled'
        ) NOT NULL DEFAULT 'active'");
    }
};
