<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chatbots', function (Blueprint $table) {
            $table->boolean('escape_enabled')->default(true)->after('agent_inactivity_message');
            $table->string('escape_keywords', 500)->default('asesor,ayuda,agente,humano,hablar con alguien,no puedo,no se,no sé,operador')->after('escape_enabled');
            $table->text('escape_message')->nullable()->after('escape_keywords');
        });
    }

    public function down(): void
    {
        Schema::table('chatbots', function (Blueprint $table) {
            $table->dropColumn(['escape_enabled', 'escape_keywords', 'escape_message']);
        });
    }
};
