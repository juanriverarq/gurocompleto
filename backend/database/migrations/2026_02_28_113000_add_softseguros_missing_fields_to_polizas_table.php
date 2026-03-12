<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('polizas', function (Blueprint $table) {
            // ── Comisiones detalladas ──
            $table->decimal('iva_comision', 15, 2)->nullable()->after('commission_amount');
            $table->decimal('porcentaje_sobrecomision', 8, 2)->nullable()->after('iva_comision');
            $table->decimal('sobrecomision', 15, 2)->nullable()->after('porcentaje_sobrecomision');
            $table->decimal('porcentaje_comision_vendedor', 8, 2)->nullable()->after('sobrecomision');
            $table->decimal('comision_vendedor', 15, 2)->nullable()->after('porcentaje_comision_vendedor');
            $table->decimal('porcentaje_comision_tecnico', 8, 2)->nullable()->after('comision_vendedor');
            $table->decimal('comision_tecnico', 15, 2)->nullable()->after('porcentaje_comision_tecnico');
            $table->decimal('porcentaje_comision_sede', 8, 2)->nullable()->after('comision_tecnico');
            $table->decimal('comision_sede', 15, 2)->nullable()->after('porcentaje_comision_sede');
            $table->decimal('comision_recibida', 15, 2)->nullable()->after('comision_sede');
            $table->decimal('total_pagado', 15, 2)->nullable()->after('comision_recibida');

            // ── Financiación ──
            $table->decimal('porcentaje_financiacion', 8, 2)->nullable()->after('total_pagado');
            $table->decimal('valor_financiacion', 15, 2)->nullable()->after('porcentaje_financiacion');
            $table->decimal('total_poliza_financiada', 15, 2)->nullable()->after('valor_financiacion');
            $table->boolean('financiacion_incluye_comision')->default(false)->after('total_poliza_financiada');
            $table->boolean('financiacion_calcular_iva')->default(false)->after('financiacion_incluye_comision');

            // ── Cartera / Recaudo ──
            $table->string('estado_cartera')->nullable()->after('payment_status');
            $table->boolean('comisionada')->default(false)->after('estado_cartera');
            $table->boolean('recaudado')->default(false)->after('comisionada');
            $table->boolean('recaudado_en_oficina')->default(false)->after('recaudado');
            $table->date('fecha_recaudo')->nullable()->after('recaudado_en_oficina');

            // ── Tipo de póliza ──
            $table->string('tipo_poliza', 30)->nullable()->after('type');
            $table->boolean('colectiva')->default(false)->after('tipo_poliza');
            $table->boolean('masiva')->default(false)->after('colectiva');

            // ── SOAT / ARL ──
            $table->boolean('soat')->default(false)->after('masiva');
            $table->boolean('arl')->default(false)->after('soat');

            // ── Moneda / Tasa de cambio ──
            $table->string('tipo_moneda', 10)->nullable()->after('total_amount');
            $table->decimal('tasa_cambio', 15, 4)->nullable()->after('tipo_moneda');

            // ── Impuestos adicionales ──
            $table->decimal('porcentaje_impuesto_bomberos', 8, 2)->nullable()->after('gastos_adicionales_aplica_iva');
            $table->decimal('impuesto_bomberos', 15, 2)->nullable()->after('porcentaje_impuesto_bomberos');
            $table->decimal('aporte_sbs', 15, 2)->nullable()->after('impuesto_bomberos');
            $table->decimal('aporte_seguro_campesino', 15, 2)->nullable()->after('aporte_sbs');
            $table->decimal('prima_asistencia', 15, 2)->nullable()->after('aporte_seguro_campesino');
            $table->decimal('otros_cargos', 15, 2)->nullable()->after('prima_asistencia');

            // ── Periodicidad / Clasificación ──
            $table->string('periodicidad', 30)->nullable()->after('payment_frequency');
            $table->string('clasificacion_poliza', 30)->nullable()->after('periodicidad');
            $table->integer('numero_renovacion')->default(0)->after('auto_renewal');
            $table->boolean('is_renewal')->default(false)->after('numero_renovacion');

            // ── Coaseguro ──
            $table->decimal('coinsurance_participation', 8, 2)->nullable()->after('participation');

            // ── Notificaciones por póliza ──
            $table->json('notification_preferences')->nullable()->after('custom_fields');

            // ── Objeto asegurado ──
            $table->text('datos_objeto_asegurado')->nullable()->after('vehicle_plates');
            $table->text('accesorios')->nullable()->after('datos_objeto_asegurado');
            $table->string('lugar_expedicion')->nullable()->after('issue_date');

            // ── Forma de pago detallada ──
            $table->json('forma_pago_detalle')->nullable()->after('payment_method');

            // ── Relaciones extra ──
            $table->string('sede_nombre')->nullable()->after('notes');
            $table->unsignedBigInteger('softseguros_id')->nullable()->after('custom_fields');

            // ── Eliminación suave de SoftSeguros ──
            $table->text('motivo_eliminacion')->nullable()->after('cancellation_reason');
            $table->timestamp('fecha_eliminacion')->nullable()->after('motivo_eliminacion');
        });
    }

    public function down(): void
    {
        Schema::table('polizas', function (Blueprint $table) {
            $table->dropColumn([
                // Comisiones
                'iva_comision', 'porcentaje_sobrecomision', 'sobrecomision',
                'porcentaje_comision_vendedor', 'comision_vendedor',
                'porcentaje_comision_tecnico', 'comision_tecnico',
                'porcentaje_comision_sede', 'comision_sede',
                'comision_recibida', 'total_pagado',
                // Financiación
                'porcentaje_financiacion', 'valor_financiacion', 'total_poliza_financiada',
                'financiacion_incluye_comision', 'financiacion_calcular_iva',
                // Cartera
                'estado_cartera', 'comisionada', 'recaudado', 'recaudado_en_oficina', 'fecha_recaudo',
                // Tipo
                'tipo_poliza', 'colectiva', 'masiva',
                // SOAT/ARL
                'soat', 'arl',
                // Moneda
                'tipo_moneda', 'tasa_cambio',
                // Impuestos
                'porcentaje_impuesto_bomberos', 'impuesto_bomberos',
                'aporte_sbs', 'aporte_seguro_campesino', 'prima_asistencia', 'otros_cargos',
                // Periodicidad
                'periodicidad', 'clasificacion_poliza', 'numero_renovacion', 'is_renewal',
                // Coaseguro
                'coinsurance_participation',
                // Notificaciones
                'notification_preferences',
                // Objeto
                'datos_objeto_asegurado', 'accesorios', 'lugar_expedicion',
                // Forma pago
                'forma_pago_detalle',
                // Relaciones
                'sede_nombre', 'softseguros_id',
                // Eliminación
                'motivo_eliminacion', 'fecha_eliminacion',
            ]);
        });
    }
};
