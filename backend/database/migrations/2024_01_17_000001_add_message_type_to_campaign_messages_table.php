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
        Schema::table('campaign_messages', function (Blueprint $table) {
            // Solo agregar message_type si no existe
            if (!Schema::hasColumn('campaign_messages', 'message_type')) {
                $table->string('message_type')->default('whatsapp')->after('message_content')
                    ->comment('Tipo de mensaje: whatsapp, voice_call, sms, email');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('campaign_messages', function (Blueprint $table) {
            if (Schema::hasColumn('campaign_messages', 'message_type')) {
                $table->dropColumn('message_type');
            }
        });
    }
};
