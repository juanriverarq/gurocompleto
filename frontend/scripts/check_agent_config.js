// Verificar configuración del agente específico
const ELEVENLABS_API_KEY = 'sk_06bf990afaf79a11677ac77a93d58d3abbdc6e254f776c7e';
const AGENT_ID = 'agent_01k02pehqgfywb54fz2z8ts74h';
const TOOL_ID = 'tool_4401k1zvaxcafema4539zjyhwf0h';

async function checkAgentConfiguration() {
    console.log(`🤖 Verificando configuración del agente: ${AGENT_ID}`);
    
    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
            method: 'GET',
            headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const agent = await response.json();
            console.log('✅ Configuración del agente:');
            console.log(JSON.stringify(agent, null, 2));
            
            // Verificar tools asignados
            console.log('\n🔧 Analizando herramientas del agente:');
            if (agent.tools && agent.tools.length > 0) {
                console.log(`📋 Herramientas configuradas (${agent.tools.length}):`);
                agent.tools.forEach((tool, index) => {
                    console.log(`${index + 1}. Tool ID: ${tool.tool_id || tool.id}`);
                    console.log(`   - Nombre: ${tool.name || 'No especificado'}`);
                    
                    // Verificar si es nuestro tool
                    if ((tool.tool_id || tool.id) === TOOL_ID) {
                        console.log('   🎯 ¡Este es nuestro tool de webhook!');
                    }
                });
                
                // Verificar si nuestro tool está asignado
                const hasOurTool = agent.tools.some(tool => 
                    (tool.tool_id || tool.id) === TOOL_ID
                );
                
                if (hasOurTool) {
                    console.log('\n✅ El tool de webhook SÍ está asignado al agente');
                } else {
                    console.log('\n❌ El tool de webhook NO está asignado al agente');
                    console.log('🔧 Necesitas asignar el tool al agente');
                }
            } else {
                console.log('❌ El agente no tiene herramientas configuradas');
            }
            
            // Verificar configuración de variables dinámicas
            console.log('\n🔄 Verificando configuración de variables dinámicas:');
            if (agent.conversation_config && agent.conversation_config.client_messages_configuration) {
                const clientConfig = agent.conversation_config.client_messages_configuration;
                console.log(`  - enable_conversation_initiation_client_data_from_webhook: ${clientConfig.enable_conversation_initiation_client_data_from_webhook || 'No configurado'}`);
            } else {
                console.log('❌ No se encontró configuración de mensajes de cliente');
            }
            
            // Verificar primer mensaje
            if (agent.conversation_config && agent.conversation_config.agent_system_message) {
                console.log('\n💬 Primer mensaje del sistema:');
                console.log(agent.conversation_config.agent_system_message);
                
                // Verificar si usa variables dinámicas
                if (agent.conversation_config.agent_system_message.includes('{{')) {
                    console.log('✅ El mensaje usa variables dinámicas');
                } else {
                    console.log('⚠️ El mensaje no parece usar variables dinámicas');
                }
            }
            
        } else {
            const errorText = await response.text();
            console.log(`❌ Error ${response.status}: ${errorText}`);
        }
    } catch (error) {
        console.log(`💥 Error: ${error.message}`);
    }
}

checkAgentConfiguration();
