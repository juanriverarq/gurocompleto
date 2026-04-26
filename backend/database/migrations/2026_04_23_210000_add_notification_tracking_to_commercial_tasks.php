<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commercial_tasks', function (Blueprint $table) {
            $table->integer('notifications_sent')->default(0)->after('reminder_sent');
            $table->datetime('last_notification_at')->nullable()->after('notifications_sent');
        });
    }

    public function down(): void
    {
        Schema::table('commercial_tasks', function (Blueprint $table) {
            $table->dropColumn(['notifications_sent', 'last_notification_at']);
        });
    }
};
