<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('sales_goals', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('team_id')->nullable();
            $table->string('period'); // YYYY-MM
            $table->enum('type', ['Primas', 'Pólizas', 'Comisiones', 'Clientes'])->default('Primas');
            $table->decimal('target_value', 15, 2);
            $table->decimal('current_value', 15, 2)->default(0);
            $table->string('status')->default('En Progreso');
            $table->date('starts_at')->nullable();
            $table->date('ends_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['broker_id', 'period']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_goals');
    }
};


