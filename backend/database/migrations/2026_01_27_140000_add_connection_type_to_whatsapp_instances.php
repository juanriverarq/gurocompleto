<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Agrega campo para seleccionar tipo de conexión:
     * - 'baileys': Conexión via microservicio con Baileys (escaneo QR)
     * - 'cloud_api': Conexión via WhatsApp Cloud API (oficial de Meta)
     */
    public function up(): void
    {
        if (!Schema::hasTable('whatsapp_instances')) {
            return; // La tabla no existe, nada que hacer
        }

        Schema::table('whatsapp_instances', function (Blueprint $table) {
            if (!Schema::hasColumn('whatsapp_instances', 'connection_type')) {
                $table->enum('connection_type', ['baileys', 'cloud_api'])->default('baileys')->after('instance_id');
            }
            if (!Schema::hasColumn('whatsapp_instances', 'cloud_api_phone_id')) {
                $table->string('cloud_api_phone_id')->nullable()->after('connection_type');
            }
            if (!Schema::hasColumn('whatsapp_instances', 'cloud_api_business_id')) {
                $table->string('cloud_api_business_id')->nullable()->after('cloud_api_phone_id');
            }
            if (!Schema::hasColumn('whatsapp_instances', 'cloud_api_token')) {
                $table->text('cloud_api_token')->nullable()->after('cloud_api_business_id');
            }
            if (!Schema::hasColumn('whatsapp_instances', 'cloud_api_verify_token')) {
                $table->string('cloud_api_verify_token')->nullable()->after('cloud_api_token');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('whatsapp_instances', function (Blueprint $table) {
            $table->dropColumn([
                'connection_type',
                'cloud_api_phone_id',
                'cloud_api_business_id',
                'cloud_api_token',
                'cloud_api_verify_token'
            ]);
        });
    }
};
