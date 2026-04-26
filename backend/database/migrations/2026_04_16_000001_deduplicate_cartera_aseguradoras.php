<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Deduplicate cartera_aseguradoras rows created by repeated syncs.
 *
 * Previous sync logic did a fragile lookup that failed to find existing rows
 * when numero_recibo / numero_pagare were NULL, resulting in duplicate inserts.
 * This migration keeps only the most-recently-synced row per
 * (broker_id, insurer_code, client_document, policy_number, numero_recibo, numero_pagare).
 */
return new class extends Migration
{
    public function up(): void
    {
        // For each group of duplicates, keep the row with the highest id (latest insert).
        DB::statement("
            DELETE ca1
            FROM cartera_aseguradoras ca1
            INNER JOIN cartera_aseguradoras ca2
                ON  ca1.broker_id      = ca2.broker_id
                AND ca1.insurer_code   = ca2.insurer_code
                AND ca1.client_document = ca2.client_document
                AND COALESCE(ca1.policy_number, '')  = COALESCE(ca2.policy_number, '')
                AND COALESCE(ca1.numero_recibo, '')  = COALESCE(ca2.numero_recibo, '')
                AND COALESCE(ca1.numero_pagare, '')  = COALESCE(ca2.numero_pagare, '')
                AND ca1.id < ca2.id
        ");
    }

    public function down(): void
    {
        // Deduplication is not reversible.
    }
};
