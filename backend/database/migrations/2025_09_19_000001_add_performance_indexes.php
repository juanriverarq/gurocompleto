<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Helper method to create index only if it doesn't exist
     */
    private function createIndexIfNotExists(string $table, string $indexName, string $columns): void
    {
        $sql = "SHOW INDEX FROM `{$table}` WHERE Key_name = '{$indexName}'";
        $exists = \DB::select($sql);

        if (empty($exists)) {
            \DB::statement("ALTER TABLE `{$table}` ADD INDEX `{$indexName}` ({$columns})");
        }
    }

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Ejecutar comandos SQL directos para crear índices de forma condicional
        $this->createIndexIfNotExists('clientes', 'clientes_broker_status_idx', 'broker_id, status');
        $this->createIndexIfNotExists('clientes', 'clientes_broker_created_idx', 'broker_id, created_at');
        $this->createIndexIfNotExists('clientes', 'clientes_broker_first_name_idx', 'broker_id, first_name');
        $this->createIndexIfNotExists('clientes', 'clientes_broker_last_name_idx', 'broker_id, last_name');
        $this->createIndexIfNotExists('clientes', 'clientes_broker_email_idx', 'broker_id, email');
        $this->createIndexIfNotExists('clientes', 'clientes_broker_phone_idx', 'broker_id, phone');
        $this->createIndexIfNotExists('clientes', 'clientes_broker_mobile_idx', 'broker_id, mobile_phone');
        $this->createIndexIfNotExists('clientes', 'clientes_broker_city_idx', 'broker_id, city');
        $this->createIndexIfNotExists('clientes', 'clientes_broker_birth_date_idx', 'broker_id, birth_date');
        $this->createIndexIfNotExists('clientes', 'clientes_broker_priority_idx', 'broker_id, priority');
        $this->createIndexIfNotExists('clientes', 'clientes_name_search_idx', 'broker_id, first_name, last_name');
        $this->createIndexIfNotExists('clientes', 'clientes_document_search_idx', 'broker_id, document_number');
        $this->createIndexIfNotExists('clientes', 'clientes_email_search_idx', 'broker_id, email');

        // Índices para pólizas
        $this->createIndexIfNotExists('polizas', 'polizas_broker_status_idx', 'broker_id, status');
        $this->createIndexIfNotExists('polizas', 'polizas_broker_type_idx', 'broker_id, type');
        $this->createIndexIfNotExists('polizas', 'polizas_broker_insurance_idx', 'broker_id, insurance_company');
        $this->createIndexIfNotExists('polizas', 'polizas_broker_client_idx', 'broker_id, client_id');
        $this->createIndexIfNotExists('polizas', 'polizas_broker_end_date_idx', 'broker_id, end_date');
        $this->createIndexIfNotExists('polizas', 'polizas_broker_start_date_idx', 'broker_id, start_date');
        $this->createIndexIfNotExists('polizas', 'polizas_broker_created_idx', 'broker_id, created_at');
        $this->createIndexIfNotExists('polizas', 'polizas_broker_premium_idx', 'broker_id, premium_amount');
        $this->createIndexIfNotExists('polizas', 'polizas_renewal_idx', 'broker_id, auto_renewal, end_date');
        $this->createIndexIfNotExists('polizas', 'polizas_search_idx', 'broker_id, policy_number, client_name');

        // Índices para siniestros
        $this->createIndexIfNotExists('siniestros', 'siniestros_broker_estado_idx', 'broker_id, estado');
        $this->createIndexIfNotExists('siniestros', 'siniestros_broker_tipo_seguro_idx', 'broker_id, tipo_seguro');
        $this->createIndexIfNotExists('siniestros', 'siniestros_broker_tipo_siniestro_idx', 'broker_id, tipo_siniestro');
        $this->createIndexIfNotExists('siniestros', 'siniestros_broker_fecha_ocurrencia_idx', 'broker_id, fecha_ocurrencia');
        $this->createIndexIfNotExists('siniestros', 'siniestros_broker_fecha_reporte_idx', 'broker_id, fecha_reporte');
        $this->createIndexIfNotExists('siniestros', 'siniestros_broker_prioridad_idx', 'broker_id, prioridad');
        $this->createIndexIfNotExists('siniestros', 'siniestros_broker_monto_idx', 'broker_id, monto_reclamado');
        $this->createIndexIfNotExists('siniestros', 'siniestros_broker_aseguradora_idx', 'broker_id, aseguradora');
        $this->createIndexIfNotExists('siniestros', 'siniestros_broker_created_idx', 'broker_id, created_at');
        $this->createIndexIfNotExists('siniestros', 'siniestros_broker_updated_idx', 'broker_id, updated_at');
        $this->createIndexIfNotExists('siniestros', 'siniestros_search_idx', 'broker_id, numero_siniestro, numero_poliza');

        // Índices para voice campaigns
        $this->createIndexIfNotExists('voice_campaigns', 'voice_campaigns_broker_status_idx', 'broker_id, status');
        $this->createIndexIfNotExists('voice_campaigns', 'voice_campaigns_broker_type_idx', 'broker_id, campaign_type');
        $this->createIndexIfNotExists('voice_campaigns', 'voice_campaigns_broker_created_idx', 'broker_id, created_at');
        $this->createIndexIfNotExists('voice_campaigns', 'voice_campaigns_broker_active_idx', 'broker_id, is_active');

        // Índices para voice campaign calls
        $this->createIndexIfNotExists('voice_campaign_calls', 'voice_calls_broker_status_idx', 'broker_id, status');
        $this->createIndexIfNotExists('voice_campaign_calls', 'voice_calls_broker_campaign_idx', 'broker_id, voice_campaign_id');
        $this->createIndexIfNotExists('voice_campaign_calls', 'voice_calls_broker_created_idx', 'broker_id, created_at');
        $this->createIndexIfNotExists('voice_campaign_calls', 'voice_calls_broker_phone_idx', 'broker_id, recipient_phone');
        $this->createIndexIfNotExists('voice_campaign_calls', 'voice_calls_broker_conversation_idx', 'broker_id, elevenlabs_conversation_id(50)');

        // Índices para renewal_history
        $this->createIndexIfNotExists('renewal_history', 'renewal_history_broker_poliza_idx', 'broker_id, poliza_id');
        $this->createIndexIfNotExists('renewal_history', 'renewal_history_broker_created_idx', 'broker_id, created_at');
        $this->createIndexIfNotExists('renewal_history', 'renewal_history_broker_action_idx', 'broker_id, action_type');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Helper method to drop index only if it exists
        $dropIndexIfExists = function(string $table, string $indexName): void {
            $sql = "SHOW INDEX FROM `{$table}` WHERE Key_name = '{$indexName}'";
            $exists = \DB::select($sql);

            if (!empty($exists)) {
                \DB::statement("ALTER TABLE `{$table}` DROP INDEX `{$indexName}`");
            }
        };

        // Eliminar índices de clientes
        $dropIndexIfExists('clientes', 'clientes_broker_status_idx');
        $dropIndexIfExists('clientes', 'clientes_broker_created_idx');
        $dropIndexIfExists('clientes', 'clientes_broker_first_name_idx');
        $dropIndexIfExists('clientes', 'clientes_broker_last_name_idx');
        $dropIndexIfExists('clientes', 'clientes_broker_email_idx');
        $dropIndexIfExists('clientes', 'clientes_broker_phone_idx');
        $dropIndexIfExists('clientes', 'clientes_broker_mobile_idx');
        $dropIndexIfExists('clientes', 'clientes_broker_city_idx');
        $dropIndexIfExists('clientes', 'clientes_broker_birth_date_idx');
        $dropIndexIfExists('clientes', 'clientes_broker_priority_idx');
        $dropIndexIfExists('clientes', 'clientes_name_search_idx');
        $dropIndexIfExists('clientes', 'clientes_document_search_idx');
        $dropIndexIfExists('clientes', 'clientes_email_search_idx');

        // Eliminar índices de pólizas
        $dropIndexIfExists('polizas', 'polizas_broker_status_idx');
        $dropIndexIfExists('polizas', 'polizas_broker_type_idx');
        $dropIndexIfExists('polizas', 'polizas_broker_insurance_idx');
        $dropIndexIfExists('polizas', 'polizas_broker_client_idx');
        $dropIndexIfExists('polizas', 'polizas_broker_end_date_idx');
        $dropIndexIfExists('polizas', 'polizas_broker_start_date_idx');
        $dropIndexIfExists('polizas', 'polizas_broker_created_idx');
        $dropIndexIfExists('polizas', 'polizas_broker_premium_idx');
        $dropIndexIfExists('polizas', 'polizas_renewal_idx');
        $dropIndexIfExists('polizas', 'polizas_search_idx');

        // Eliminar índices de siniestros
        $dropIndexIfExists('siniestros', 'siniestros_broker_estado_idx');
        $dropIndexIfExists('siniestros', 'siniestros_broker_tipo_seguro_idx');
        $dropIndexIfExists('siniestros', 'siniestros_broker_tipo_siniestro_idx');
        $dropIndexIfExists('siniestros', 'siniestros_broker_fecha_ocurrencia_idx');
        $dropIndexIfExists('siniestros', 'siniestros_broker_fecha_reporte_idx');
        $dropIndexIfExists('siniestros', 'siniestros_broker_prioridad_idx');
        $dropIndexIfExists('siniestros', 'siniestros_broker_monto_idx');
        $dropIndexIfExists('siniestros', 'siniestros_broker_aseguradora_idx');
        $dropIndexIfExists('siniestros', 'siniestros_broker_created_idx');
        $dropIndexIfExists('siniestros', 'siniestros_broker_updated_idx');
        $dropIndexIfExists('siniestros', 'siniestros_search_idx');

        // Eliminar índices de voice campaigns
        $dropIndexIfExists('voice_campaigns', 'voice_campaigns_broker_status_idx');
        $dropIndexIfExists('voice_campaigns', 'voice_campaigns_broker_type_idx');
        $dropIndexIfExists('voice_campaigns', 'voice_campaigns_broker_created_idx');
        $dropIndexIfExists('voice_campaigns', 'voice_campaigns_broker_active_idx');

        // Eliminar índices de voice campaign calls
        $dropIndexIfExists('voice_campaign_calls', 'voice_calls_broker_status_idx');
        $dropIndexIfExists('voice_campaign_calls', 'voice_calls_broker_campaign_idx');
        $dropIndexIfExists('voice_campaign_calls', 'voice_calls_broker_created_idx');
        $dropIndexIfExists('voice_campaign_calls', 'voice_calls_broker_phone_idx');
        $dropIndexIfExists('voice_campaign_calls', 'voice_calls_broker_conversation_idx');

        // Eliminar índices de renewal_history
        $dropIndexIfExists('renewal_history', 'renewal_history_broker_poliza_idx');
        $dropIndexIfExists('renewal_history', 'renewal_history_broker_created_idx');
        $dropIndexIfExists('renewal_history', 'renewal_history_broker_action_idx');
    }
};