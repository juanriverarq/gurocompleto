// Asignar el tool webhook al agente usando PATCH
const ELEVENLABS_API_KEY = 'sk_06bf990afaf79a11677ac77a93d58d3abbdc6e254f776c7e';
const AGENT_ID = 'agent_01k02pehqgfywb54fz2z8ts74h';
const TOOL_ID = 'tool_4401k1zvaxcafema4539zjyhwf0h';

async function assignToolWithPatch() {
    console.log(`🔧 Asignando tool ${TOOL_ID} al agente ${AGENT_ID} usando PATCH...`);
    
    try {
        // Obtener configuración actual del agente
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
        
        // Preparar la actualización PATCH solo para tool_ids
        const currentToolIds = agent.conversation_config?.agent?.prompt?.tool_ids || [];
        console.log('📋 Tools actuales:', currentToolIds);
        
        if (!currentToolIds.includes(TOOL_ID)) {
            const newToolIds = [...currentToolIds, TOOL_ID];
            console.log('📋 Nuevos tools:', newToolIds);
            
            // Intentar PATCH con diferentes estructuras
            const patchData = {
                conversation_config: {
                    agent: {
                        prompt: {
                            tool_ids: newToolIds
                        }
                    }
                }
            };
            
            const patchResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
                method: 'PATCH',
                headers: {
                    'xi-api-key': ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(patchData)
            });
            
            if (patchResponse.ok) {
                console.log('✅ Tool asignado exitosamente usando PATCH!');
                const result = await patchResponse.json();
                console.log('📄 Respuesta:', JSON.stringify(result, null, 2));
            } else {
                const errorText = await patchResponse.text();
                console.log(`❌ Error con PATCH: ${patchResponse.status}`);
                console.log(errorText);
                
                // Probar con PUT completo
                console.log('\n🔄 Intentando PUT completo...');
                await tryFullUpdate(agent);
            }
        } else {
            console.log('✅ El tool ya está asignado al agente');
        }
        
    } catch (error) {
        console.log(`💥 Error: ${error.message}`);
    }
}

async function tryFullUpdate(agent) {
    try {
        // Agregar el tool_id a la configuración completa
        const updatedAgent = JSON.parse(JSON.stringify(agent));
        
        if (!updatedAgent.conversation_config.agent.prompt.tool_ids) {
            updatedAgent.conversation_config.agent.prompt.tool_ids = [];
        }
        
        if (!updatedAgent.conversation_config.agent.prompt.tool_ids.includes(TOOL_ID)) {
            updatedAgent.conversation_config.agent.prompt.tool_ids.push(TOOL_ID);
        }
        
        // También agregar a la lista de herramientas del prompt si existe
        if (!updatedAgent.conversation_config.agent.prompt.tools) {
            updatedAgent.conversation_config.agent.prompt.tools = [];
        }
        
        // Usar endpoint específico para actualizar tools
        const toolAssignResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}/tools`, {
            method: 'POST',
            headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tool_ids: [TOOL_ID]
            })
        });
        
        if (toolAssignResponse.ok) {
            console.log('✅ Tool asignado usando endpoint específico de tools!');
            const result = await toolAssignResponse.json();
            console.log('📄 Respuesta:', JSON.stringify(result, null, 2));
        } else {
            const errorText = await toolAssignResponse.text();
            console.log(`❌ Error con endpoint de tools: ${toolAssignResponse.status}`);
            console.log(errorText);
        }
        
    } catch (error) {
        console.log(`💥 Error en actualización completa: ${error.message}`);
    }
}

assignToolWithPatch();
