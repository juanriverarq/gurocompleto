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
        Schema::table('campaigns', function (Blueprint $table) {
            $table->unsignedBigInteger('whatsapp_instance_id')->nullable()->after('created_by');
            $table->foreign('whatsapp_instance_id')->references('id')->on('whatsapp_instances')->onDelete('set null');
            $table->index(['whatsapp_instance_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropForeign(['whatsapp_instance_id']);
            $table->dropIndex(['whatsapp_instance_id']);
            $table->dropColumn('whatsapp_instance_id');
        });
    }
};
