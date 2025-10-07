<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('sales_teams', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id');
            $table->string('name');
            $table->string('description')->nullable();
            $table->string('territory')->nullable();
            $table->string('specialty')->nullable();
            $table->unsignedBigInteger('leader_user_id')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
            $table->softDeletes();
            $table->index(['broker_id']);
        });

        Schema::create('sales_team_members', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('team_id');
            $table->unsignedBigInteger('user_id');
            $table->string('role')->nullable();
            $table->decimal('monthly_goal', 15, 2)->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
            $table->unique(['team_id', 'user_id']);
            $table->index(['team_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_team_members');
        Schema::dropIfExists('sales_teams');
    }
};


