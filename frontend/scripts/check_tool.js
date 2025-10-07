// Verificar tool específico en ElevenLabs
const ELEVENLABS_API_KEY = 'sk_06bf990afaf79a11677ac77a93d58d3abbdc6e254f776c7e';
const TOOL_ID = 'tool_4401k1zvaxcafema4539zjyhwf0h';

async function checkSpecificTool() {
    console.log(`🔍 Verificando tool: ${TOOL_ID}`);
    
    try {
        const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversation-tools/${TOOL_ID}`, {
            method: 'GET',
            headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const tool = await response.json();
            console.log('✅ Tool encontrado:');
            console.log(JSON.stringify(tool, null, 2));
            
            // Verificar detalles específicos del webhook
            if (tool.type === 'webhook') {
                console.log('\n📋 Detalles del webhook:');
                console.log(`  - URL: ${tool.config?.url || 'No configurada'}`);
                console.log(`  - Method: ${tool.config?.method || 'No especificado'}`);
                
                if (tool.config?.headers) {
                    console.log('  - Headers:');
                    Object.entries(tool.config.headers).forEach(([key, value]) => {
                        console.log(`    ${key}: ${value}`);
                    });
                }
            }
        } else {
            const errorText = await response.text();
            console.log(`❌ Error ${response.status}:`, errorText);
        }
        
    } catch (error) {
        console.log('💥 Error:', error.message);
    }
}

// También listar todos los tools para comparar
async function listAllTools() {
    console.log('\n📋 Listando todos los tools disponibles:');
    
    try {
        const response = await fetch('https://api.elevenlabs.io/v1/convai/conversation-tools', {
            method: 'GET',
            headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const tools = await response.json();
            console.log(`✅ Encontrados ${tools.conversation_tools.length} tools:`);
            
            tools.conversation_tools.forEach((tool, index) => {
                console.log(`\n${index + 1}. ${tool.name} (${tool.id})`);
                console.log(`   - Tipo: ${tool.type}`);
                console.log(`   - Descripción: ${tool.description}`);
                if (tool.type === 'webhook' && tool.config?.url) {
                    console.log(`   - URL: ${tool.config.url}`);
                }
            });
        } else {
            console.log('❌ Error listando tools:', response.status);
        }
    } catch (error) {
        console.log('💥 Error listando tools:', error.message);
    }
}

// Ejecutar ambas funciones
async function main() {
    await checkSpecificTool();
    await listAllTools();
}

main();
