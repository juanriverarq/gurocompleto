// Componente de prueba rápida para campañas
// Agrega este botón temporalmente a tu componente de campañas para probar

import React from 'react';
import { Button } from '../../../components/shadcn-ui/Default-Ui/button';
import { createPhoneCall } from '../../../services/elevenLabsService';

const CampaignTestButton = () => {
  const handleTestCall = async () => {
    console.log('🧪 [TEST] Iniciando llamada de prueba...');
    
    try {
      const testCallData = {
        agent_id: 'default-agent', // Usar el agente de fallback
        phone_number: '+57300123456', // Número de prueba (puedes cambiar)
        customer_name: 'Cliente Prueba',
        system_prompt: 'Eres un agente de prueba. Saluda al cliente y mantén una conversación breve.',
        first_message: 'Hola, soy un agente de prueba. ¿Cómo estás?',
        max_duration: 60, // 1 minuto para prueba
        campaign_id: 'test-campaign-001'
      };

      console.log('📞 [TEST] Datos de llamada:', testCallData);
      
      const result = await createPhoneCall(testCallData);
      
      console.log('✅ [TEST] Resultado:', result);
      
      alert(`Llamada de prueba iniciada!\n\nID: ${result.id}\nEstado: ${result.status}\nCliente: ${result.customerName}`);
      
    } catch (error) {
      console.error('❌ [TEST] Error:', error);
      alert(`Error en llamada de prueba: ${error.message}`);
    }
  };

  return (
    <Button 
      onClick={handleTestCall}
      className="bg-orange-600 hover:bg-orange-700 text-white"
    >
      🧪 Probar Llamada
    </Button>
  );
};

export default CampaignTestButton;

/* 
INSTRUCCIONES DE USO:

1. Agrega este componente temporalmente a tu CampaignsManagementWidget:

// En la sección de botones del header (línea 444 aprox), agrega:
<CampaignTestButton />

2. Importa el componente al inicio del archivo:
import CampaignTestButton from './CampaignTestButton';

3. Haz clic en "🧪 Probar Llamada" para verificar que el sistema funciona

4. Revisa la consola del navegador para ver los logs detallados

5. Una vez que confirmes que funciona, puedes remover este botón de prueba

NOTAS:
- La llamada será simulada si no tienes Twilio configurado
- Deberías ver logs claros en la consola del navegador
- Si todo funciona, las campañas deberían ejecutarse correctamente
*/
