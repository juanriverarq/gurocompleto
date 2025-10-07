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
        Schema::create('empleados_broker', function (Blueprint $table) {
            $table->id();
            
            // Información personal
            $table->string('nombres');
            $table->string('apellidos');
            $table->string('tipo_documento')->default('cedula');
            $table->string('numero_documento')->unique();
            $table->string('email')->unique();
            $table->string('telefono')->nullable();
            $table->string('celular')->nullable();
            $table->date('fecha_nacimiento')->nullable();
            $table->string('direccion')->nullable();
            $table->string('ciudad')->nullable();
            
            // Información laboral
            $table->string('cargo')->nullable();
            $table->string('departamento')->nullable();
            $table->date('fecha_ingreso')->nullable();
            $table->date('fecha_salida')->nullable();
            $table->enum('estado', ['activo', 'inactivo', 'suspendido', 'retirado'])->default('activo');
            $table->enum('tipo_vinculacion', ['empleado', 'contratista', 'practicante', 'temporal'])->default('empleado');
            $table->decimal('salario', 12, 2)->nullable();
            
            // Acceso al sistema
            $table->string('usuario')->unique(); // Username para login
            $table->timestamp('password_changed_at')->nullable();
            $table->boolean('requiere_cambio_password')->default(true);
            $table->timestamp('ultimo_acceso')->nullable();
            $table->boolean('acceso_activo')->default(true);
            
            // Relaciones
            $table->unsignedBigInteger('rol_id')->nullable();
            $table->foreign('rol_id')->references('id')->on('roles_broker')->onDelete('set null');
            
            // Multi-tenancy
            $table->unsignedBigInteger('broker_id');
            $table->foreign('broker_id')->references('id')->on('brokers')->onDelete('cascade');
            
            // Información adicional
            $table->string('avatar')->nullable(); // URL de foto de perfil
            $table->json('permisos_adicionales')->nullable(); // Permisos específicos extras
            $table->text('observaciones')->nullable();
            
            // Auditoría
            $table->unsignedBigInteger('creado_por')->nullable();
            $table->unsignedBigInteger('actualizado_por')->nullable();
            
            // Indices
            $table->index(['broker_id', 'estado']);
            $table->index(['broker_id', 'acceso_activo']);
            $table->index(['broker_id', 'tipo_vinculacion']);
            $table->index(['broker_id', 'rol_id']);
            $table->unique(['broker_id', 'usuario']);
            $table->unique(['broker_id', 'numero_documento']);
            $table->unique(['broker_id', 'email']);
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('empleados_broker');
    }
};
