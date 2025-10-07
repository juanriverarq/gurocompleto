/**
 * Script de prueba para verificar que los overrides de ElevenLabs funcionen correctamente
 * con la estructura conversation_initiation_client_data
 */

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';
const DEFAULT_API_KEY = 'sk_06bf990afaf79a11677ac77a93d58d3abbdc6e254f776c7e';

/**
 * Función para probar los overrides funcionando
 */
async function testElevenLabsOverrides() {
  console.log('🧪 [TEST] Iniciando prueba de overrides de ElevenLabs');
  
  // Datos de prueba personalizados
  const testData = {
    customer_name: 'Juan Rivera Test',
    policy_number: 'POL-OVERRIDE-TEST-2024',
    debt_amount: '$450,000',
    payment_due_date: '15 de septiembre',
    company_name: 'Seguros Guro Test'
  };

  // Prompt personalizado con datos específicos
  const personalizedPrompt = `Eres Marcela, agente especializada en cobranza de seguros de ${testData.company_name}.
Estás contactando específicamente a ${testData.customer_name} sobre su póliza ${testData.policy_number}.
El cliente tiene un pago pendiente de ${testData.debt_amount} con vencimiento el ${testData.payment_due_date}.
Debes ser profesional, directa pero empática para resolver esta situación de cobranza.
IMPORTANTE: Siempre menciona el nombre del cliente ${testData.customer_name} y la póliza ${testData.policy_number}.`;

  // Primer mensaje personalizado
  const personalizedFirstMessage = `Hola ${testData.customer_name}, soy Marcela de ${testData.company_name}. Te contacto porque tienes un pago pendiente de tu póliza ${testData.policy_number} por ${testData.debt_amount} con vencimiento el ${testData.payment_due_date}. ¿Podemos conversar sobre las opciones de pago?`;

  console.log('📋 [TEST] Datos de prueba preparados:');
  console.log('   - Cliente:', testData.customer_name);
  console.log('   - Póliza:', testData.policy_number);
  console.log('   - Monto:', testData.debt_amount);
  console.log('   - Vencimiento:', testData.payment_due_date);

  // Estructura correcta con conversation_initiation_client_data
  const requestBody = {
    agent_id: "agent_6301k1m98143epst5bf9qxch742q",
    agent_phone_number_id: "phnum_01k0avytwkfgesvwxb5bdbp7qy",
    to_number: "+573227697874",
    
    // ✅ ESTRUCTURA CORRECTA ENCONTRADA
    conversation_initiation_client_data: {
      conversation_config_override: {
        agent: {
          prompt: {
            prompt: personalizedPrompt
          },
          first_message: personalizedFirstMessage
        }
      }
    }
  };

  console.log('🚀 [TEST] Enviando llamada con overrides personalizados...');
  console.log('📝 [TEST] Primer mensaje de prueba:');
  console.log('   >', personalizedFirstMessage.substring(0, 100) + '...');

  try {
    const response = await fetch(`${ELEVENLABS_API_BASE}/convai/twilio/outbound-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': DEFAULT_API_KEY
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    
    if (response.ok && data.success !== false) {
      console.log('✅ [TEST] ¡Llamada iniciada exitosamente!');
      console.log('🆔 [TEST] Conversation ID:', data.conversation_id);
      console.log('📞 [TEST] Call SID:', data.callSid);
      console.log('');
      console.log('🎯 [TEST] La llamada debería usar:');
      console.log('   ✅ Nombre del cliente:', testData.customer_name);
      console.log('   ✅ Número de póliza:', testData.policy_number);
      console.log('   ✅ Monto de deuda:', testData.debt_amount);
      console.log('   ✅ Fecha de vencimiento:', testData.payment_due_date);
      console.log('');
      console.log('📱 [TEST] Contesta la llamada para verificar que menciona estos datos específicos');
      
      return {
        success: true,
        conversationId: data.conversation_id,
        callSid: data.callSid
      };
    } else {
      console.error('❌ [TEST] Error en la respuesta:', data);
      return { success: false, error: data };
    }
  } catch (error) {
    console.error('❌ [TEST] Error haciendo la llamada:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Función para verificar si los overrides están funcionando comparando con una llamada sin overrides
 */
async function testWithoutOverrides() {
  console.log('\n🔍 [COMPARISON] Haciendo llamada SIN overrides para comparar...');
  
  const basicRequestBody = {
    agent_id: "agent_6301k1m98143epst5bf9qxch742q",
    agent_phone_number_id: "phnum_01k0avytwkfgesvwxb5bdbp7qy",
    to_number: "+573227697874"
    // Sin conversation_initiation_client_data = usará configuración por defecto
  };

  try {
    const response = await fetch(`${ELEVENLABS_API_BASE}/convai/twilio/outbound-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': DEFAULT_API_KEY
      },
      body: JSON.stringify(basicRequestBody)
    });

    const data = await response.json();
    
    if (response.ok && data.success !== false) {
      console.log('✅ [COMPARISON] Llamada básica iniciada');
      console.log('🆔 [COMPARISON] Conversation ID:', data.conversation_id);
      console.log('');
      console.log('📱 [COMPARISON] Esta llamada usará el mensaje por defecto de Kio');
      console.log('   "Hola, soy Kio, tu asesor comercial. ¿Tienes unos minutos para conversar?"');
      
      return {
        success: true,
        conversationId: data.conversation_id,
        callSid: data.callSid
      };
    } else {
      console.error('❌ [COMPARISON] Error:', data);
      return { success: false, error: data };
    }
  } catch (error) {
    console.error('❌ [COMPARISON] Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Función principal de prueba
 */
async function runTests() {
  console.log('🎯 ================================================');
  console.log('🎯 PRUEBA DE OVERRIDES DE ELEVENLABS');
  console.log('🎯 ================================================\n');
  
  // Prueba 1: Con overrides personalizados
  console.log('📋 PRUEBA 1: Llamada CON overrides personalizados');
  console.log('================================================');
  const testWithOverrides = await testElevenLabsOverrides();
  
  if (testWithOverrides.success) {
    console.log('✅ Llamada con overrides enviada correctamente');
  } else {
    console.log('❌ Falló la llamada con overrides');
    return;
  }
  
  // Esperar un poco antes de la segunda llamada
  console.log('\n⏰ Esperando 10 segundos antes de la segunda prueba...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // Prueba 2: Sin overrides (configuración por defecto)
  console.log('\n📋 PRUEBA 2: Llamada SIN overrides (por defecto)');
  console.log('================================================');
  const testWithoutOverridesResult = await testWithoutOverrides();
  
  if (testWithoutOverridesResult.success) {
    console.log('✅ Llamada sin overrides enviada correctamente');
  } else {
    console.log('❌ Falló la llamada sin overrides');
  }
  
  // Resumen final
  console.log('\n🎯 ================================================');
  console.log('🎯 RESUMEN DE PRUEBAS');
  console.log('🎯 ================================================');
  console.log('');
  console.log('📞 LLAMADA 1 (CON OVERRIDES):');
  console.log('   Debería decir: "Hola Juan Rivera Test, soy Marcela de Seguros Guro Test..."');
  console.log('   Y mencionar: POL-OVERRIDE-TEST-2024, $450,000, 15 de septiembre');
  console.log('');
  console.log('📞 LLAMADA 2 (SIN OVERRIDES):'); 
  console.log('   Debería decir: "Hola, soy Kio, tu asesor comercial..."');
  console.log('');
  console.log('✅ Si escuchas diferentes mensajes = ¡OVERRIDES FUNCIONAN!');
  console.log('❌ Si ambas suenan igual = Los overrides no se están aplicando');
  console.log('');
  console.log('🎯 ================================================');
}

// Ejecutar las pruebas
runTests().catch(console.error);
