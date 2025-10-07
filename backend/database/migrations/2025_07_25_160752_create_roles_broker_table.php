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
        Schema::create('roles_broker', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->string('slug')->unique();
            $table->text('descripcion')->nullable();
            $table->json('permisos')->nullable(); // JSON con permisos específicos
            $table->string('color', 7)->default('#6B7280'); // Color hex para UI
            $table->boolean('activo')->default(true);
            $table->integer('nivel_acceso')->default(1); // 1=básico, 2=medio, 3=alto, 4=admin
            $table->boolean('es_admin')->default(false); // Si es rol de administrador del broker
            
            // Multi-tenancy
            $table->unsignedBigInteger('broker_id');
            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            
            // Indices
            $table->index(['broker_id', 'activo']);
            $table->index(['broker_id', 'nivel_acceso']);
            $table->unique(['broker_id', 'slug']);
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('roles_broker');
    }
};
