<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('insurer_connections', function (Blueprint $table) {
            // Estado del job de conexión asíncrona
            $table->string('connect_job_status', 32)->nullable()->index(); // idle|queued|processing|requires_mfa|success|failed
            $table->string('connect_job_id', 64)->nullable()->index();
            $table->string('connect_job_mode', 32)->nullable(); // connect|connect_auto|connect_browser|reconnect
            $table->text('connect_job_message')->nullable();
            $table->text('connect_job_error')->nullable();
            $table->string('connect_job_challenge_id', 128)->nullable();
            $table->timestamp('connect_job_started_at')->nullable();
            $table->timestamp('connect_job_finished_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('insurer_connections', function (Blueprint $table) {
            $table->dropColumn([
                'connect_job_status',
                'connect_job_id',
                'connect_job_mode',
                'connect_job_message',
                'connect_job_error',
                'connect_job_challenge_id',
                'connect_job_started_at',
                'connect_job_finished_at',
            ]);
        });
    }
};
