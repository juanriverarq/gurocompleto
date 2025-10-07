// Asignar el tool webhook al agente
const ELEVENLABS_API_KEY = 'sk_06bf990afaf79a11677ac77a93d58d3abbdc6e254f776c7e';
const AGENT_ID = 'agent_01k02pehqgfywb54fz2z8ts74h';
const TOOL_ID = 'tool_4401k1zvaxcafema4539zjyhwf0h';

async function assignToolToAgent() {
    console.log(`🔧 Asignando tool ${TOOL_ID} al agente ${AGENT_ID}...`);
    
    try {
        // Primero obtener la configuración actual del agente
        const getResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
            method: 'GET',
            headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        
        if (!getResponse.ok) {
            throw new Error(`Error obteniendo agente: ${getResponse.status}`);
        }
        
        const agent = await getResponse.json();
        console.log('✅ Configuración actual obtenida');
        
        // Modificar la configuración para agregar el tool
        const updatedAgent = { ...agent };
        
        // Asegurar que el prompt existe
        if (!updatedAgent.conversation_config.agent.prompt.tool_ids) {
            updatedAgent.conversation_config.agent.prompt.tool_ids = [];
        }
        
        // Agregar el tool_id si no existe
        if (!updatedAgent.conversation_config.agent.prompt.tool_ids.includes(TOOL_ID)) {
            updatedAgent.conversation_config.agent.prompt.tool_ids.push(TOOL_ID);
        }
        
        // Actualizar la configuración del agente
        const updateResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
            method: 'PUT',
            headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                conversation_config: updatedAgent.conversation_config,
                platform_settings: updatedAgent.platform_settings
            })
        });
        
        if (updateResponse.ok) {
            console.log('✅ Tool asignado exitosamente al agente!');
            
            // Verificar la asignación
            const verifyResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
                method: 'GET',
                headers: {
                    'xi-api-key': ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json'
                }
            });
            
            if (verifyResponse.ok) {
                const verifiedAgent = await verifyResponse.json();
                const toolIds = verifiedAgent.conversation_config.agent.prompt.tool_ids || [];
                console.log('📋 Tools asignados al agente:');
                console.log(toolIds);
                
                if (toolIds.includes(TOOL_ID)) {
                    console.log('🎯 ¡Confirmado! El tool webhook está ahora asignado');
                } else {
                    console.log('❌ El tool no aparece en la lista de tools asignados');
                }
            }
            
        } else {
            const errorText = await updateResponse.text();
            console.log(`❌ Error actualizando agente: ${updateResponse.status}`);
            console.log(errorText);
        }
        
    } catch (error) {
        console.log(`💥 Error: ${error.message}`);
    }
}

assignToolToAgent();
