<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::statement("ALTER TABLE whatsapp_conversation_messages MODIFY COLUMN message_type ENUM('text','image','audio','video','document','location','contact','sticker','interactive','template','button','reaction','order','system','unknown') NOT NULL DEFAULT 'text'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE whatsapp_conversation_messages MODIFY COLUMN message_type ENUM('text','image','audio','video','document','location','contact','sticker','interactive','template') NOT NULL DEFAULT 'text'");
    }
};
