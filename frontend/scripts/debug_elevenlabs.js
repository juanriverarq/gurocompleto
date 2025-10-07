#!/usr/bin/env node

const API_KEY = 'sk_06bf990afaf79a11677ac77a93d58d3abbdc6e254f776c7e';
const BASE_URL = 'https://api.elevenlabs.io/v1';

// Función para hacer requests con manejo de errores detallado
async function makeRequest(url, options = {}) {
  console.log(`\n🔥 REQUEST: ${options.method || 'GET'} ${url}`);
  if (options.body) {
    console.log(`📤 BODY:`, JSON.stringify(JSON.parse(options.body), null, 2));
  }
  
  try {
    const response = await fetch(url, {
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    console.log(`📡 RESPONSE STATUS: ${response.status} ${response.statusText}`);
    
    const responseText = await response.text();
    console.log(`📥 RESPONSE BODY:`, responseText);
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${responseText}`);
    }
    
    return responseData;
  } catch (error) {
    console.error(`❌ ERROR:`, error.message);
    throw error;
  }
}

// 1. Obtener lista de agentes y mostrar configuración detallada
async function inspectAgents() {
  console.log('\n🔍 PASO 1: INSPECCIONANDO AGENTES DISPONIBLES');
  console.log('='.repeat(60));
  
  try {
    const agents = await makeRequest(`${BASE_URL}/convai/agents`);
    
    if (!agents.agents || agents.agents.length === 0) {
      console.log('❌ No hay agentes disponibles');
      return null;
    }
    
    console.log(`✅ Encontrados ${agents.agents.length} agente(s)`);
    
    // Mostrar información detallada de cada agente
    agents.agents.forEach((agent, index) => {
      console.log(`\n--- AGENTE ${index + 1} ---`);
      console.log(`ID: ${agent.agent_id}`);
      console.log(`Nombre: ${agent.name || 'Sin nombre'}`);
      console.log(`Estado: ${agent.status || 'Desconocido'}`);
      
      // Inspeccionar configuración del agente
      if (agent.conversation_config?.agent) {
        const agentConfig = agent.conversation_config.agent;
        console.log(`First Message: "${agentConfig.first_message || 'No definido'}"`);
        console.log(`Language: ${agentConfig.language || 'No definido'}`);
        
        // Buscar variables dinámicas en el first_message
        const firstMessage = agentConfig.first_message || '';
        const dynamicVars = firstMessage.match(/\{\{([^}]+)\}\}/g) || [];
        console.log(`Variables dinámicas encontradas: ${dynamicVars.join(', ') || 'Ninguna'}`);
        
        if (agentConfig.prompt?.prompt) {
          console.log(`System Prompt (primeros 100 chars): ${agentConfig.prompt.prompt.substring(0, 100)}...`);
        }
      }
      
      // Inspeccionar configuración de TTS
      if (agent.conversation_config?.tts) {
        const tts = agent.conversation_config.tts;
        console.log(`Voice ID: ${tts.voice_id || 'No definido'}`);
        console.log(`Model: ${tts.model || 'No definido'}`);
      }
      
      console.log(`Fecha creación: ${agent.created_at_unix_secs ? new Date(agent.created_at_unix_secs * 1000).toISOString() : 'No disponible'}`);
    });
    
    return agents.agents[0]; // Retornar el primer agente para pruebas
  } catch (error) {
    console.error('Error obteniendo agentes:', error.message);
    return null;
  }
}

// 2. Probar llamada con diferentes configuraciones de variables dinámicas
async function testCallWithVariations(agentId) {
  console.log('\n🧪 PASO 2: PROBANDO LLAMADAS CON DIFERENTES CONFIGURACIONES');
  console.log('='.repeat(60));
  
  const testPhone = '+573001234567';
  
  // Configuraciones de prueba
  const testCases = [
    {
      name: 'Test 1: Solo customer_name (snake_case)',
      dynamic_variables: {
        customer_name: 'Juan Pérez'
      }
    },
    {
      name: 'Test 2: Variables múltiples (snake_case)',
      dynamic_variables: {
        customer_name: 'Juan Pérez',
        company_name: 'Mi Empresa',
        policy_number: 'POL-123456'
      }
    },
    {
      name: 'Test 3: Variables en camelCase',
      dynamic_variables: {
        customerName: 'Juan Pérez',
        companyName: 'Mi Empresa'
      }
    },
    {
      name: 'Test 4: Variables mixtas',
      dynamic_variables: {
        customer_name: 'Juan Pérez',
        customerName: 'Juan Pérez Duplicado',
        company_name: 'Mi Empresa'
      }
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n--- ${testCase.name} ---`);
    
    try {
      const callData = {
        agent_id: agentId,
        agent_phone_number_id: "phnum_01k0avytwkfgesvwxb5bdbp7qy",
        to_number: testPhone,
        dynamic_variables: testCase.dynamic_variables
      };
      
      // Intentar hacer la llamada
      const result = await makeRequest(
        `${BASE_URL}/convai/twilio/outbound-call`,
        {
          method: 'POST',
          body: JSON.stringify(callData)
        }
      );
      
      console.log(`✅ ${testCase.name}: ÉXITO`);
      console.log(`Call ID: ${result.conversation_id || result.callSid || 'No disponible'}`);
      
    } catch (error) {
      console.log(`❌ ${testCase.name}: FALLÓ`);
      console.log(`Error: ${error.message}`);
      
      // Analizar el error específico
      if (error.message.includes('Missing required dynamic variables')) {
        const match = error.message.match(/Missing required dynamic variables in first message: ({[^}]+})/);
        if (match) {
          console.log(`Variables faltantes detectadas: ${match[1]}`);
        }
      }
    }
    
    // Esperar entre pruebas
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// 3. Función principal
async function main() {
  console.log('🚀 DEBUGGING DETALLADO DE ELEVENLABS');
  console.log('='.repeat(60));
  console.log(`API Key: ${API_KEY.substring(0, 15)}...`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  
  try {
    // Paso 1: Inspeccionar agentes
    const firstAgent = await inspectAgents();
    
    if (!firstAgent) {
      console.log('\n❌ No se pueden realizar pruebas sin agentes disponibles');
      return;
    }
    
    // Paso 2: Probar llamadas
    await testCallWithVariations(firstAgent.agent_id);
    
    console.log('\n✅ DEBUGGING COMPLETADO');
    console.log('Revisa los logs anteriores para identificar el problema específico');
    
  } catch (error) {
    console.error('\n💥 ERROR GENERAL:', error.message);
  }
}

// Verificar si estamos en Node.js antes de ejecutar
if (typeof require !== 'undefined' && require.main === module) {
  main().catch(console.error);
}

// Exportar para uso en navegador si es necesario
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { main, inspectAgents, testCallWithVariations };
}
