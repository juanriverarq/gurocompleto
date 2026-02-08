import React from 'react';
import { createPhoneCall } from '../services/elevenLabsService';

const TestAgentConfigButton: React.FC = () => {
  const testAgentConfig = async () => {
    try {
      console.log('🧪 [TEST] Iniciando prueba de configuración del agente...');
      
      // Test con variables mínimas OBLIGATORIAS
      const testCallData = {
        agent_id: "1CRjE0vEGfXMjhFu5KCDjm", // Tu agent_id actual
        phone_number: "+573105209453", // Número de prueba
        customer_name: "María Test", // CRÍTICO: debe estar
        dynamic_variables: {
          customerName: "María Test",   // ✅ CamelCase principal
          customer_name: "María Test",  // Mantener compatibilidad snake_case
          companyName: "Seguros Test",  // DEBE coincidir con {{companyName}}
          // Solo variables que están configuradas en el agente
        },
        campaign_id: "test_campaign"
      };
      
      console.log('📋 [TEST] Datos de prueba:', testCallData);
      
      // Intentar crear la llamada
      const result = await createPhoneCall(testCallData);
      
      console.log('✅ [TEST] ¡Éxito! Configuración correcta:', result);
      alert('✅ ¡Agente configurado correctamente! Variables dinámicas funcionando.');
      
    } catch (error) {
      console.error('❌ [TEST] Error en configuración del agente:', error);
      
      if (error.message.includes('Missing required dynamic variables')) {
        alert(`❌ ERROR DE CONFIGURACIÓN:
        
${error.message}

SOLUCIÓN:
1. Ve a ElevenLabs Dashboard
2. Edita tu agente
3. Agrega {{customer_name}} en el first_message
4. Agrega {{companyName}} en el system_prompt
5. Guarda los cambios`);
      } else {
        alert(`❌ Error: ${error.message}`);
      }
    }
  };

  return (
    <button
      onClick={testAgentConfig}
      className="bg-primary hover:bg-primary text-white px-4 py-2 rounded transition-colors"
    >
      🧪 Test Configuración Agente
    </button>
  );
};

export default TestAgentConfigButton;
