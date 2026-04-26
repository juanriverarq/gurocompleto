<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('commercial_task_priority_configs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id');

            // Prioridad (clave única por broker)
            $table->string('priority_key'); // baja, media, alta, critica
            $table->string('label');
            $table->string('icon')->default('solar:flag-bold-duotone');
            $table->string('color')->default('#6B7280'); // Tailwind color o hex
            $table->string('bg_color')->default('bg-gray-100');
            $table->string('text_color')->default('text-gray-800');

            // Frecuencia de notificación (minutos antes de due_date / scheduled_for)
            // Ej: 1440 = 24h, 60 = 1h, 0 = al momento
            $table->integer('first_notification_minutes')->default(1440); // 24h antes por defecto
            $table->integer('repeat_every_minutes')->default(0); // 0 = no repetir
            $table->integer('max_notifications')->default(3); // máximo recordatorios
            $table->boolean('enabled')->default(true);

            $table->timestamps();

            $table->unique(['broker_id', 'priority_key']);
            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commercial_task_priority_configs');
    }
};
