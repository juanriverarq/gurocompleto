<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            // Campos para adjuntar media (imagen) a campañas
            $table->text('media_url')->nullable()->after('message_template');
            $table->string('media_type')->nullable()->after('media_url');
        });
    }

    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropColumn(['media_url', 'media_type']);
        });
    }
};