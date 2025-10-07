// Solución temporal: cambiar first_message para que no use variables dinámicas
const API_KEY = 'sk_06bf990afaf79a11677ac77a93d58d3abbdc6e254f776c7e';
const AGENT_ID = 'agent_01k02pehqgfywb54fz2z8ts74h';

async function fixAgentTemp() {
    console.log('🔧 Aplicando solución temporal al agente...');
    
    try {
        // Primero obtener la configuración actual
        const getResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
            headers: { 'xi-api-key': API_KEY }
        });
        
        if (!getResponse.ok) {
            throw new Error(`Error obteniendo agente: ${getResponse.status}`);
        }
        
        const agent = await getResponse.json();
        console.log('✅ Agente actual obtenido:', agent.name);
        
        // Actualizar solo el first_message
        const updateData = {
            ...agent,
            conversation_config: {
                ...agent.conversation_config,
                agent: {
                    ...agent.conversation_config.agent,
                    first_message: "Hola, soy Marcela de seguros. ¿Con quién tengo el gusto de hablar?"
                }
            }
        };
        
        console.log('📝 Cambiando first_message de:');
        console.log(`"${agent.conversation_config?.agent?.first_message}"`);
        console.log('A:');
        console.log(`"${updateData.conversation_config.agent.first_message}"`);
        
        // Actualizar el agente
        const updateResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${AGENT_ID}`, {
            method: 'PATCH',
            headers: {
                'xi-api-key': API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (updateResponse.ok) {
            console.log('✅ Agente actualizado correctamente!');
            console.log('🎉 Ahora las llamadas no deberían cortarse');
            console.log('💡 El agente preguntará el nombre en lugar de usar {{user_name}}');
        } else {
            const error = await updateResponse.json();
            console.log('❌ Error actualizando agente:');
            console.log(error);
        }
        
    } catch (error) {
        console.log('💥 Error:', error.message);
    }
}

fixAgentTemp();
