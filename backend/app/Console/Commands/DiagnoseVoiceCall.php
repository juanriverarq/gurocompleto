<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\VoiceCampaignCall;
use Illuminate\Support\Facades\Cache;

class DiagnoseVoiceCall extends Command
{
    protected $signature = 'voice:diagnose {conversation_id?}';
    protected $description = 'Diagnostica una llamada de voz y muestra todos los datos';

    public function handle()
    {
        $conversationId = $this->argument('conversation_id');
        
        if (!$conversationId) {
            // Mostrar las últimas 5 llamadas
            $this->info('📞 Últimas 5 llamadas:');
            $calls = VoiceCampaignCall::orderBy('id', 'desc')->limit(5)->get();
            
            foreach ($calls as $call) {
                $this->line(sprintf(
                    'ID: %d | %s | %s | Conv: %s | Status: %s',
                    $call->id,
                    $call->recipient_name,
                    $call->recipient_phone,
                    $call->elevenlabs_conversation_id ?: 'N/A',
                    $call->status
                ));
            }
            
            $this->newLine();
            $this->info('Para ver detalles de una llamada específica:');
            $this->comment('php artisan voice:diagnose <conversation_id>');
            return 0;
        }
        
        // Buscar la llamada
        $this->info("🔍 Buscando llamada con conversation_id: {$conversationId}");
        
        $call = VoiceCampaignCall::where('elevenlabs_conversation_id', $conversationId)->first();
        
        if (!$call) {
            $call = VoiceCampaignCall::where('elevenlabs_call_id', $conversationId)->first();
        }
        
        if (!$call) {
            $this->error('❌ Llamada no encontrada en la base de datos');
            
            // Verificar si hay datos en caché
            $cachedData = Cache::get('tool_data:' . $conversationId);
            if ($cachedData) {
                $this->warn('💾 Datos encontrados en caché (esperando webhook):');
                $this->line(json_encode($cachedData, JSON_PRETTY_PRINT));
            } else {
                $this->warn('💾 No hay datos en caché tampoco');
            }
            
            return 1;
        }
        
        // Mostrar información de la llamada
        $this->info('✅ Llamada encontrada:');
        $this->newLine();
        
        $this->table(
            ['Campo', 'Valor'],
            [
                ['ID', $call->id],
                ['Campaña ID', $call->voice_campaign_id],
                ['Nombre', $call->recipient_name],
                ['Teléfono', $call->recipient_phone],
                ['Estado', $call->status],
                ['Duración', $call->duration_seconds . ' segundos'],
                ['Conversation ID', $call->elevenlabs_conversation_id],
                ['Call ID', $call->elevenlabs_call_id],
                ['Creado', $call->created_at],
            ]
        );
        
        $this->newLine();
        
        // Mostrar metadata
        if ($call->call_metadata) {
            $this->info('📊 Call Metadata:');
            $this->line(json_encode($call->call_metadata, JSON_PRETTY_PRINT));
            
            $this->newLine();
            
            // Datos recolectados
            if (isset($call->call_metadata['collected_data'])) {
                $this->info('✅ Datos Recolectados:');
                foreach ($call->call_metadata['collected_data'] as $field => $data) {
                    $this->line(sprintf(
                        '  %s: %s (confidence: %s, source: %s)',
                        $field,
                        $data['value'] ?? 'N/A',
                        $data['confidence'] ?? 'N/A',
                        $data['source'] ?? 'N/A'
                    ));
                }
            } else {
                $this->warn('⚠️  No hay datos recolectados en call_metadata');
            }
            
            $this->newLine();
            
            // Tool usage
            if (isset($call->call_metadata['tool_used'])) {
                $this->info('🔧 Tool usado: ' . ($call->call_metadata['tool_used'] ? 'SÍ' : 'NO'));
                if (isset($call->call_metadata['tool_called_at'])) {
                    $this->line('   Llamado en: ' . $call->call_metadata['tool_called_at']);
                }
            }
        } else {
            $this->warn('⚠️  call_metadata está NULL');
        }
        
        // Verificar caché
        $this->newLine();
        $cachedData = Cache::get('tool_data:' . $conversationId);
        if ($cachedData) {
            $this->warn('💾 Datos en caché (no aplicados aún):');
            $this->line(json_encode($cachedData, JSON_PRETTY_PRINT));
        }
        
        return 0;
    }
}