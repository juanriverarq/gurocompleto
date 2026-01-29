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
        Schema::table('whatsapp_conversations', function (Blueprint $table) {
            // Campos de contacto capturados por chatbot
            $table->string('contact_first_name')->nullable()->after('contact_push_name');
            $table->string('contact_last_name')->nullable()->after('contact_first_name');
            $table->string('contact_document_id')->nullable()->after('contact_last_name'); // Cédula/DNI
            $table->string('contact_email')->nullable()->after('contact_document_id');
            $table->string('contact_phone_secondary')->nullable()->after('contact_email'); // Teléfono secundario
            $table->string('contact_company')->nullable()->after('contact_phone_secondary');
            $table->string('contact_city')->nullable()->after('contact_company');
            $table->text('contact_notes')->nullable()->after('contact_city');
            $table->json('contact_custom_fields')->nullable()->after('contact_notes'); // Campos personalizados
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('whatsapp_conversations', function (Blueprint $table) {
            $table->dropColumn([
                'contact_first_name',
                'contact_last_name',
                'contact_document_id',
                'contact_email',
                'contact_phone_secondary',
                'contact_company',
                'contact_city',
                'contact_notes',
                'contact_custom_fields',
            ]);
        });
    }
};
