<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sync_jobs', function (Blueprint $table) {
            $table->id();
            $table->string('batch_id', 36)->index();
            $table->unsignedBigInteger('broker_id')->index();
            $table->string('insurer_code', 30);
            $table->json('types');
            $table->enum('status', ['pending', 'processing', 'completed', 'failed'])->default('pending');
            $table->json('progress')->nullable();
            $table->text('error')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['batch_id', 'broker_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sync_jobs');
    }
};
