<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Verificar si la tabla whatsapp_instances existe (requerida para FK)
        if (!Schema::hasTable('whatsapp_instances')) {
            return; // No crear tablas de conversaciones sin la tabla base
        }

        // Departamentos para clasificar conversaciones
        Schema::create('whatsapp_departments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('broker_id')->constrained()->onDelete('cascade');
            $table->string('name'); // Siniestros, Cotizaciones, Consultas, etc.
            $table->string('description')->nullable();
            $table->string('icon')->nullable(); // Icono para UI
            $table->string('color')->default('#3b82f6'); // Color para UI
            $table->boolean('is_active')->default(true);
            $table->integer('priority')->default(0); // Orden de aparición
            $table->json('auto_assign_rules')->nullable(); // Reglas de asignación automática
            $table->timestamps();
        });

        // Empleados asignados a departamentos
        Schema::create('whatsapp_department_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('department_id')->constrained('whatsapp_departments')->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->boolean('is_supervisor')->default(false);
            $table->boolean('can_receive_assignments')->default(true);
            $table->integer('max_concurrent_conversations')->default(10);
            $table->integer('current_conversations')->default(0);
            $table->timestamps();
            
            $table->unique(['department_id', 'user_id']);
        });

        // Conversaciones de WhatsApp (tickets)
        Schema::create('whatsapp_conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('broker_id')->constrained()->onDelete('cascade');
            $table->foreignId('whatsapp_instance_id')->constrained('whatsapp_instances')->onDelete('cascade');
            $table->foreignId('department_id')->nullable()->constrained('whatsapp_departments')->onDelete('set null');
            $table->foreignId('assigned_to')->nullable()->constrained('users')->onDelete('set null');
            $table->unsignedBigInteger('client_id')->nullable(); // Referencia manual a clientes
            
            $table->string('phone'); // Número del cliente
            $table->string('contact_name')->nullable(); // Nombre del contacto
            $table->string('contact_push_name')->nullable(); // Nombre de WhatsApp
            
            $table->enum('status', ['pending', 'assigned', 'in_progress', 'waiting_client', 'resolved', 'closed'])->default('pending');
            $table->enum('priority', ['low', 'medium', 'high', 'urgent'])->default('medium');
            $table->string('subject')->nullable(); // Asunto/Tema
            $table->text('classification_reason')->nullable(); // Por qué se clasificó así (IA)
            
            $table->timestamp('first_message_at')->nullable();
            $table->timestamp('last_message_at')->nullable();
            $table->timestamp('assigned_at')->nullable();
            $table->timestamp('first_response_at')->nullable(); // Para medir tiempo de respuesta
            $table->timestamp('resolved_at')->nullable();
            
            $table->integer('unread_count')->default(0);
            $table->integer('message_count')->default(0);
            
            $table->json('metadata')->nullable(); // Datos adicionales
            $table->json('tags')->nullable(); // Etiquetas
            
            $table->timestamps();
            
            $table->index(['broker_id', 'status']);
            $table->index(['assigned_to', 'status']);
            $table->index(['phone']);
        });

        // Mensajes de la conversación
        Schema::create('whatsapp_conversation_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('whatsapp_conversations')->onDelete('cascade');
            $table->string('message_id')->nullable(); // ID del mensaje en WhatsApp
            
            $table->enum('direction', ['incoming', 'outgoing']);
            $table->enum('sender_type', ['client', 'agent', 'bot', 'system']);
            $table->foreignId('sender_user_id')->nullable()->constrained('users')->onDelete('set null');
            
            $table->enum('message_type', ['text', 'image', 'audio', 'video', 'document', 'location', 'contact', 'sticker', 'interactive', 'template'])->default('text');
            $table->text('content')->nullable(); // Contenido del mensaje
            $table->json('media')->nullable(); // URL, mimetype, etc.
            $table->json('metadata')->nullable(); // Datos adicionales del mensaje
            
            $table->boolean('is_read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->enum('status', ['pending', 'sent', 'delivered', 'read', 'failed'])->default('pending');
            
            $table->timestamps();
            
            $table->index(['conversation_id', 'created_at']);
        });

        // Historial de asignaciones
        Schema::create('whatsapp_conversation_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('whatsapp_conversations')->onDelete('cascade');
            $table->foreignId('assigned_from')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('assigned_to')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('department_id')->nullable()->constrained('whatsapp_departments')->onDelete('set null');
            $table->enum('assignment_type', ['manual', 'automatic', 'transfer', 'escalation']);
            $table->text('reason')->nullable();
            $table->timestamps();
        });

        // Notas internas de la conversación
        Schema::create('whatsapp_conversation_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained('whatsapp_conversations')->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->text('content');
            $table->boolean('is_pinned')->default(false);
            $table->timestamps();
        });

        // Respuestas rápidas por departamento
        Schema::create('whatsapp_quick_replies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('broker_id')->constrained()->onDelete('cascade');
            $table->foreignId('department_id')->nullable()->constrained('whatsapp_departments')->onDelete('cascade');
            $table->string('shortcut'); // /saludo, /precio, etc.
            $table->string('title');
            $table->text('content');
            $table->boolean('is_active')->default(true);
            $table->integer('usage_count')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('whatsapp_quick_replies');
        Schema::dropIfExists('whatsapp_conversation_notes');
        Schema::dropIfExists('whatsapp_conversation_assignments');
        Schema::dropIfExists('whatsapp_conversation_messages');
        Schema::dropIfExists('whatsapp_conversations');
        Schema::dropIfExists('whatsapp_department_members');
        Schema::dropIfExists('whatsapp_departments');
    }
};
