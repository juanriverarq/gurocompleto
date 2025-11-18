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
        Schema::create('calendar_events', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id');
            $table->unsignedBigInteger('created_by');
            $table->string('title');
            $table->text('description')->nullable();
            $table->dateTime('start_date');
            $table->dateTime('end_date');
            $table->boolean('all_day')->default(false);
            $table->string('color')->default('primary'); // primary, success, warning, error, default, red, green, azure
            $table->string('event_type')->default('manual'); // manual, sistema
            $table->timestamps();
            $table->softDeletes();

            // Índices
            $table->index('broker_id');
            $table->index('created_by');
            $table->index('start_date');
            $table->index('event_type');

            // Foreign keys
            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('calendar_events');
    }
};
