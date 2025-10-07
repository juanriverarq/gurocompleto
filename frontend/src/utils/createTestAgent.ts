import { createConversationalAgent } from '../services/elevenLabsService';

/**
 * Crea un nuevo agente de prueba con variables dinámicas configuradas correctamente
 */
export const createTestAgentWithDynamicVariables = async (apiKey?: string) => {
  try {
    const agentConfig = {
      name: 'Sofia Seguros - Variables Dinámicas',
      type: 'sofia_insurance' as const,
      description: 'Agente especializado en seguros con soporte completo para variables dinámicas',
      voice_id: '86V9x9hrQds83qf7zaGn', // Voz colombiana
      system_prompt: `Eres Sofia, un agente especializado en seguros de la empresa {{companyName}}.
Tu trabajo es contactar clientes para recordatorios de pagos y renovaciones.
El nombre del cliente es {{customerName}}.
Información adicional del cliente:
- Número de póliza: {{policyNumber}}
- Monto adeudado: {{debtAmount}} pesos
- Fecha de vencimiento: {{paymentDueDate}}

Debes ser profesional, amable y persuasiva. Siempre menciona el nombre del cliente de manera natural.`,

      greeting: `Hola {{customerName}}, soy Sofia de {{companyName}}.
Te contacto porque tu póliza {{policyNumber}} tiene un pago pendiente por valor de {{debtAmount}} pesos.
¿Tienes unos minutos para conversar sobre las opciones de pago?`,

      goodbye: `Gracias por tu tiempo {{customerName}}. Te enviaremos la información por mensaje.
Que tengas un excelente día.`,

      voice_settings: {
        stability: 0.7,
        similarity_boost: 0.8,
        style: 0.2,
        use_speaker_boost: true
      }
    };

    console.log('🔧 Creando nuevo agente con variables dinámicas...');
    const newAgent = await createConversationalAgent(agentConfig, apiKey);
    
    console.log('✅ Agente creado exitosamente:', {
      id: newAgent.id,
      name: newAgent.name,
      description: newAgent.description
    });

    return {
      success: true,
      agent: newAgent,
      message: `Agente creado exitosamente con ID: ${newAgent.id}`,
      instructions: `
INSTRUCCIONES:
1. Usa este nuevo agent_id en tus campañas: ${newAgent.id}
2. El agente está configurado para usar estas variables:
   - {{customerName}}
   - {{companyName}} 
   - {{policyNumber}}
   - {{debtAmount}}
   - {{paymentDueDate}}
3. Prueba con una llamada para verificar que funciona correctamente.
      `
    };

  } catch (error) {
    console.error('❌ Error creando agente:', error);
    return {
      success: false,
      agent: null,
      message: `Error creando agente: ${error.message}`,
      instructions: 'Verifica tu API key y conexión a ElevenLabs'
    };
  }
};

/**
 * Componente React para crear el agente de prueba
 */
export const CreateTestAgentButton: React.FC = () => {
  const handleCreateAgent = async () => {
    try {
      const result = await createTestAgentWithDynamicVariables();
      
      if (result.success) {
        alert(`✅ ¡Éxito!\n\n${result.message}\n\n${result.instructions}`);
      } else {
        alert(`❌ Error:\n\n${result.message}\n\n${result.instructions}`);
      }
    } catch (error) {
      alert(`❌ Error inesperado: ${error.message}`);
    }
  };

  return (
    <button
      onClick={handleCreateAgent}
      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition-colors"
    >
      🔧 Crear Agente con Variables Dinámicas
    </button>
  );
};
