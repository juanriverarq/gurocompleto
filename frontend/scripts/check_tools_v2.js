// Verificar tools en ElevenLabs con diferentes endpoints
const ELEVENLABS_API_KEY = 'sk_06bf990afaf79a11677ac77a93d58d3abbdc6e254f776c7e';
const TOOL_ID = 'tool_4401k1zvaxcafema4539zjyhwf0h';

async function tryDifferentEndpoints() {
    const endpoints = [
        'https://api.elevenlabs.io/v1/tools',
        'https://api.elevenlabs.io/v1/convai/conversation-tools',
        'https://api.elevenlabs.io/v1/convai/tools',
        'https://api.elevenlabs.io/v1/agents/tools'
    ];
    
    for (const endpoint of endpoints) {
        console.log(`\n🔍 Probando endpoint: ${endpoint}`);
        
        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'xi-api-key': ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log(`📊 Status: ${response.status}`);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Respuesta exitosa:');
                console.log(JSON.stringify(data, null, 2));
                
                // Si encontramos tools, buscar nuestro tool específico
                const tools = data.tools || data.conversation_tools || data;
                if (Array.isArray(tools)) {
                    console.log(`\n🔍 Buscando tool ${TOOL_ID} en ${tools.length} tools...`);
                    const targetTool = tools.find(tool => tool.id === TOOL_ID);
                    if (targetTool) {
                        console.log('🎯 Tool encontrado:');
                        console.log(JSON.stringify(targetTool, null, 2));
                    } else {
                        console.log('❌ Tool específico no encontrado');
                    }
                }
                break; // Si encontramos un endpoint que funciona, no probar más
            } else {
                const errorText = await response.text();
                console.log(`❌ Error: ${errorText}`);
            }
            
        } catch (error) {
            console.log(`💥 Error: ${error.message}`);
        }
    }
}

async function checkAgents() {
    console.log('\n🤖 Verificando agentes disponibles:');
    
    try {
        const response = await fetch('https://api.elevenlabs.io/v1/convai/agents', {
            method: 'GET',
            headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Agentes encontrados:');
            console.log(JSON.stringify(data, null, 2));
            
            // Buscar el agente que estamos usando
            if (data.agents) {
                const targetAgent = data.agents.find(agent => 
                    agent.agent_id === 'agent_01k02pehqgfywb54fz2z8ts74h'
                );
                
                if (targetAgent) {
                    console.log('\n🎯 Agente objetivo encontrado:');
                    console.log(JSON.stringify(targetAgent, null, 2));
                    
                    // Verificar si tiene tools configurados
                    if (targetAgent.tools && targetAgent.tools.length > 0) {
                        console.log('\n🔧 Tools del agente:');
                        targetAgent.tools.forEach((tool, index) => {
                            console.log(`${index + 1}. ${tool.tool_id || tool.id}: ${tool.name || 'Sin nombre'}`);
                        });
                    }
                } else {
                    console.log('❌ Agente objetivo no encontrado');
                }
            }
        } else {
            console.log(`❌ Error: ${response.status}`);
        }
    } catch (error) {
        console.log(`💥 Error: ${error.message}`);
    }
}

async function main() {
    await tryDifferentEndpoints();
    await checkAgents();
}

main();
