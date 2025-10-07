<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('import_jobs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('broker_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('entity');
            $table->string('filename')->nullable();
            $table->string('status')->default('running'); // running|completed|failed
            $table->unsignedInteger('inserted')->default(0);
            $table->unsignedInteger('updated')->default(0);
            $table->unsignedInteger('failed')->default(0);
            $table->unsignedInteger('errors_count')->default(0);
            $table->json('mapping')->nullable();
            $table->json('errors')->nullable(); // opcional: primeros N errores
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
            $table->index(['broker_id', 'entity']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('import_jobs');
    }
};


