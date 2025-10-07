import fetch from 'node-fetch';

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';
const API_KEY = 'sk_06bf990afaf79a11677ac77a93d58d3abbdc6e254f776c7e';

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  'xi-api-key': API_KEY
});

async function testCampaignFlow() {
  console.log('🚀 [TEST-CAMPAIGN] Simulando flujo exacto del widget de campañas...');
  
  try {
    // Plantillas exactas del widget de campañas con personalización completa
    const personalizedSystemPrompt = `Eres Marcela, agente especializada en seguros de Seguros Guro. 
Estás contactando a María González Pérez para seguimiento de su póliza POL-2024-001. 
Debes ser profesional, amable y ayudar con renovaciones o pagos pendientes. 
El cliente tiene una deuda de $380.000 con vencimiento 2024-08-20.`;
    
    const personalizedFirstMessage = `Hola María González Pérez, soy Marcela de Seguros Guro. Te llamo porque tenemos registrado un pago pendiente de tu póliza POL-2024-001 por valor de $380.000 pesos. ¿Podrías confirmarme si ya realizaste este pago?`;
    
    console.log('📋 [TEST-CAMPAIGN] Contenido personalizado:');
    console.log('\n🎯 PROMPT PERSONALIZADO:');
    console.log('========================');
    console.log(personalizedSystemPrompt);
    console.log('\n💬 FIRST MESSAGE PERSONALIZADO:');
    console.log('===============================');
    console.log(personalizedFirstMessage);
    
    // Datos de la llamada exactamente como el widget
    const requestBody = {
      agent_id: 'agent_01k02pehqgfywb54fz2z8ts74h',
      agent_phone_number_id: 'phnum_01k0avytwkfgesvwxb5bdbp7qy',
      to_number: '+573001234567',
      
      // Overrides personalizados
      conversation_config_override: {
        agent: {
          prompt: {
            prompt: personalizedSystemPrompt.trim()
          },
          first_message: personalizedFirstMessage.trim()
        }
      }
    };
    
    console.log('\n🚀 [TEST-CAMPAIGN] Enviando llamada...');
    console.log('Agent ID:', requestBody.agent_id);
    console.log('Phone Number:', requestBody.to_number);
    console.log('Prompt length:', requestBody.conversation_config_override.agent.prompt.prompt.length);
    console.log('First message length:', requestBody.conversation_config_override.agent.first_message.length);
    
    const endpoint = `${ELEVENLABS_API_BASE}/convai/twilio/outbound-call`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('❌ Error parsing JSON:', jsonError);
      throw new Error(`Error parsing response: ${jsonError}`);
    }
    
    console.log(`\n🔍 [TEST-CAMPAIGN] Respuesta:`, { status: response.status, data });
    
    if (response.ok && data && data.success !== false) {
      console.log('\n✅ [TEST-CAMPAIGN] ¡LLAMADA CREADA EXITOSAMENTE!');
      console.log('====================================');
      console.log('Conversation ID:', data.conversation_id);
      console.log('Call SID:', data.callSid);
      console.log('Message:', data.message);
      console.log('\n🎯 CONFIRMACIÓN DE OVERRIDES:');
      console.log('- Prompt personalizado enviado: SÍ (' + personalizedSystemPrompt.length + ' caracteres)');
      console.log('- First message personalizado enviado: SÍ (' + personalizedFirstMessage.length + ' caracteres)');
      console.log('- Nombre del cliente en contenido: María González Pérez ✅');
      console.log('- Número de póliza en contenido: POL-2024-001 ✅');
      console.log('- Monto de deuda en contenido: $380.000 ✅');
    } else {
      console.log('\n❌ [TEST-CAMPAIGN] Error en la respuesta:', data);
    }
    
  } catch (error) {
    console.error('❌ [TEST-CAMPAIGN] Error:', error.message);
  }
}

testCampaignFlow();
