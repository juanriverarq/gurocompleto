<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cartera_aseguradoras', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('broker_id')->index();
            $table->string('insurer_code', 30)->index();
            $table->string('insurer_name', 60);

            // Policy / client identification
            $table->string('policy_number', 100)->nullable()->index();
            $table->string('client_name')->nullable();
            $table->string('client_document', 50)->nullable()->index();
            $table->string('client_doc_type', 10)->nullable();
            $table->string('ramo')->nullable();
            $table->string('product_name')->nullable();

            // Financial
            $table->decimal('prima_total', 18, 2)->default(0);
            $table->decimal('valor_pendiente', 18, 2)->default(0);
            $table->decimal('valor_pagado', 18, 2)->default(0);
            $table->decimal('bonificacion', 18, 2)->default(0);
            $table->string('moneda', 10)->default('COP');

            // Mora
            $table->integer('dias_mora')->default(0);
            $table->enum('rango_mora', ['al_dia', 'mora_30', 'mora_60', 'mora_90', 'mora_90_plus'])->default('al_dia')->index();

            // Dates
            $table->date('fecha_inicio_vigencia')->nullable();
            $table->date('fecha_expedicion')->nullable();
            $table->date('fecha_vencimiento')->nullable();

            // Recibo / cuota detail
            $table->string('numero_recibo', 100)->nullable();
            $table->string('numero_pagare', 100)->nullable();
            $table->integer('cuotas_pagadas')->nullable();
            $table->integer('cuotas_mora')->nullable();
            $table->integer('total_cuotas')->nullable();

            // Source tracking
            $table->string('source_endpoint', 100)->nullable();
            $table->string('sync_hash', 32)->nullable();
            $table->timestamp('synced_at')->nullable();

            $table->json('raw_data')->nullable();
            $table->timestamps();

            $table->index(['broker_id', 'insurer_code']);
            $table->index(['broker_id', 'rango_mora']);
            $table->index(['broker_id', 'dias_mora']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cartera_aseguradoras');
    }
};
