<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('whatsapp_quick_replies', function (Blueprint $table) {
            $table->text('content')->nullable()->change();
            $table->longText('media_url')->nullable()->after('content');
            $table->string('media_type', 20)->nullable()->after('media_url'); // image, document, audio, video
        });
    }

    public function down(): void
    {
        Schema::table('whatsapp_quick_replies', function (Blueprint $table) {
            $table->dropColumn(['media_url', 'media_type']);
        });
    }
};
