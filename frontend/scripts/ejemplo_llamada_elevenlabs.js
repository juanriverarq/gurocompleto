// EJEMPLO COMPLETO: Cómo ejecutar una llamada con variables dinámicas
// Este es el formato EXACTO que debe usarse para llamadas telefónicas

const ejemploLlamadaCompleta = {
  // 1. DATOS DE LA LLAMADA (lo que ya tienes bien)
  agent_id: "tu_agent_id_aqui",
  agent_phone_number_id: "phnum_01k0avytwkfgesvwxb5bdbp7qy",
  to_number: "+573105209453",
  
  // 2. VARIABLES DINÁMICAS (campo crítico)
  dynamic_variables: {
    // OBLIGATORIAS - deben coincidir EXACTAMENTE con los placeholders del agente
    customer_name: "Juan Pérez",        // {{customer_name}} en el first_message
    companyName: "Seguros ABC",         // {{companyName}} en el system prompt
    
    // OPCIONALES - solo si están en el agente
    policy_number: "POL-2024-001",      // {{policy_number}}
    policy_expiration_date: "15 de febrero de 2024",  // {{policy_expiration_date}}
    debt_amount: 250000,                // {{debt_amount}}
    payment_due_date: "31 de enero",    // {{payment_due_date}}
    city: "Bogotá"                      // {{city}}
  }
};

// 3. CONFIGURACIÓN DEL AGENTE EN ELEVENLABS (debe tener estos placeholders)
const ejemploConfiguracionAgente = {
  // System Prompt en ElevenLabs debe incluir:
  system_prompt: `Eres Sofia, un agente especializado en seguros de la empresa {{companyName}}.
Tu trabajo es contactar clientes para recordatorios de pagos y renovaciones.
Debes ser profesional, amable y persuasiva.`,

  // First Message en ElevenLabs debe incluir:
  first_message: `Hola {{customer_name}}, soy Sofia de {{companyName}}.
Te contacto porque tu póliza {{policy_number}} está próxima a vencer el {{policy_expiration_date}}.
¿Tienes unos minutos para hablar sobre la renovación?`,

  // Conversation Config (opcional)
  conversation_config: {
    // NO incluir first_message aquí si ya está configurado en el agente
    // Dejar que ElevenLabs use el configurado en el dashboard
  }
};

// 4. PASOS PARA VERIFICAR QUE FUNCIONE:

console.log("=== PASOS PARA DEBUGGING ===");

console.log("1. Verificar que tu agente en ElevenLabs tiene estos placeholders:");
console.log("   - {{customer_name}} en first_message");
console.log("   - {{companyName}} en system_prompt");
console.log("   - Cualquier otra variable que uses");

console.log("2. Verificar que las variables dinámicas coincidan EXACTAMENTE:");
console.log("   Variables enviadas:", Object.keys(ejemploLlamadaCompleta.dynamic_variables));
console.log("   Deben coincidir con los {{placeholders}} del agente");

console.log("3. NO enviar 'first_message' en el request - dejar que use el del agente");

console.log("4. Verificar logs en la llamada:");
console.log("   - ✅ customer_name debe estar presente y no vacío");
console.log("   - ✅ Número telefónico normalizado correctamente");
console.log("   - ✅ Request enviado sin errores");

// 5. EJEMPLO DE REQUEST FINAL (lo que envía tu código)
const requestFinalEjemplo = {
  method: 'POST',
  url: 'https://api.elevenlabs.io/v1/convai/twilio/outbound-call',
  headers: {
    'Content-Type': 'application/json',
    'xi-api-key': 'tu_api_key_aqui'
  },
  body: JSON.stringify({
    agent_id: "tu_agent_id",
    agent_phone_number_id: "phnum_01k0avytwkfgesvwxb5bdbp7qy",
    to_number: "+573105209453",
    dynamic_variables: {
      customer_name: "Juan Pérez",  // CRÍTICO: debe existir y no estar vacío
      companyName: "Seguros ABC",
      policy_number: "POL-2024-001",
      debt_amount: 250000
    }
    // NO incluir 'first_message' aquí
  })
};

console.log("REQUEST FINAL:", JSON.stringify(requestFinalEjemplo.body, null, 2));
