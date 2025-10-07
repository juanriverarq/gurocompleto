<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // email_campaigns
        if (!Schema::hasTable('email_campaigns')) {
            Schema::create('email_campaigns', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('broker_id')->index();
                $table->string('name');
                $table->text('description')->nullable();

                // Plantilla o contenido directo
                $table->unsignedBigInteger('template_id')->nullable()->index(); // campaign_templates.id (opcional)
                $table->string('subject')->nullable();
                $table->longText('content')->nullable();

                // Audiencia
                $table->string('audience_type')->default('csv'); // csv | segment (en Fase 1 usamos csv; segment_json opcional)
                $table->unsignedBigInteger('csv_upload_id')->nullable()->index(); // uploads_csv.id
                $table->json('segment_filters')->nullable(); // Filtros dinámicos sobre clientes (opcional para futuro)

                // Limitaciones de envío
                $table->integer('throttling_per_minute')->default(30);
                $table->string('window_start')->default('08:00');
                $table->string('window_end')->default('20:00');
                $table->string('timezone')->default('America/Bogota');

                // Estado
                $table->boolean('is_active')->default(false);
                $table->string('status')->default('draft'); // draft|scheduled|running|paused|completed|failed
                $table->json('stats_json')->nullable(); // métricas agregadas
                $table->timestamp('last_execution')->nullable();

                $table->unsignedBigInteger('created_by')->nullable()->index();
                $table->timestamps();

                // Índices compuestos útiles
                $table->index(['broker_id', 'status']);
                $table->index(['broker_id', 'is_active']);
            });
        }

        // email_campaign_recipients
        if (!Schema::hasTable('email_campaign_recipients')) {
            Schema::create('email_campaign_recipients', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('campaign_id')->index(); // email_campaigns.id
                $table->unsignedBigInteger('broker_id')->index();

                $table->unsignedBigInteger('cliente_id')->nullable()->index();
                $table->string('email');
                $table->string('name')->nullable();

                $table->json('variables_resolved')->nullable();

                $table->string('status')->default('pending'); // pending|sent|delivered|failed|opened|clicked
                $table->string('provider_message_id')->nullable();
                $table->text('last_error')->nullable();

                $table->timestamp('sent_at')->nullable();
                $table->timestamp('delivered_at')->nullable();
                $table->timestamp('opened_at')->nullable();
                $table->timestamp('clicked_at')->nullable();

                $table->timestamps();

                $table->index(['campaign_id', 'status']);
                $table->index(['campaign_id', 'email']);
            });
        }

        // uploads_csv (repositorio de cargas CSV de clientes para campañas)
        if (!Schema::hasTable('uploads_csv')) {
            Schema::create('uploads_csv', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('broker_id')->index();
                $table->unsignedBigInteger('created_by')->nullable()->index();

                $table->string('original_name');
                $table->string('filename'); // nombre en storage
                $table->string('storage_path'); // ruta absoluta/relative en storage
                $table->unsignedBigInteger('size_bytes')->default(0);

                $table->json('detected_columns')->nullable(); // columnas detectadas (p.ej., email_principal, numero_documento)
                $table->json('mapping')->nullable(); // mapeo opcional
                $table->integer('total_rows')->default(0);
                $table->integer('valid_rows')->default(0);
                $table->integer('invalid_rows')->default(0);
                $table->json('sample_rows')->nullable(); // muestra para UI (hasta N)
                $table->timestamps();

                $table->index(['broker_id', 'created_by']);
            });
        }

        // webhook_logs (registro de callbacks n8n u otros)
        if (!Schema::hasTable('webhook_logs')) {
            Schema::create('webhook_logs', function (Blueprint $table) {
                $table->id();
                $table->string('source')->default('n8n'); // n8n | provider | other
                $table->string('event_type')->nullable();
                $table->json('headers_masked')->nullable();
                $table->json('payload')->nullable();
                $table->integer('status_code')->nullable();
                $table->timestamp('processed_at')->nullable();
                $table->timestamps();

                $table->index(['source', 'event_type']);
            });
        }
    }

    public function down(): void
    {
        // Importante: respetar dependencias (recipients depende de campaigns)
        if (Schema::hasTable('email_campaign_recipients')) {
            Schema::dropIfExists('email_campaign_recipients');
        }
        if (Schema::hasTable('email_campaigns')) {
            Schema::dropIfExists('email_campaigns');
        }
        if (Schema::hasTable('uploads_csv')) {
            Schema::dropIfExists('uploads_csv');
        }
        if (Schema::hasTable('webhook_logs')) {
            Schema::dropIfExists('webhook_logs');
        }
    }
};