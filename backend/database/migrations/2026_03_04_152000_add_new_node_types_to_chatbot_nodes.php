<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE chatbot_nodes MODIFY COLUMN node_type ENUM('start','message','question','input','condition','action','ai_response','transfer','delay','end','options','policy_lookup','add_tag','remove_tag','webhook','media','interactive','set_variable') NOT NULL");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE chatbot_nodes MODIFY COLUMN node_type ENUM('start','message','question','input','condition','action','ai_response','transfer','delay','end','options') NOT NULL");
    }
};
