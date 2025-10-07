// ElevenLabs API Call Example - Reproducing "Missing required dynamic variables" Error
// Language: JavaScript/Node.js

const ELEVENLABS_API_KEY = 'sk_06bf990afaf79a11677ac77a93d58d3abbdc6e254f776c7e';
const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

// Function that reproduces the error
async function makeOutboundCall() {
  const endpoint = `${ELEVENLABS_API_BASE}/convai/twilio/outbound-call`;
  
  const requestBody = {
    agent_id: "agent_4KT1TAjbm5KHqIdE7MKr", // Your actual agent ID
    agent_phone_number_id: "phnum_01k0avytwkfgesvwxb5bdbp7qy", // Your phone number ID
    to_number: "+573001234567", // Colombian phone number (normalized)
    
    // Dynamic variables - this is where the issue occurs
    dynamic_variables: {
      customer_name: "Juan Pérez",           // This is explicitly provided
      companyName: "Seguros XYZ",
      policyNumber: "POL-12345",
      policyExpirationDate: "2024-12-31",
      monthlyPayment: "85000",
      debt_amount: "170000",
      payment_due_date: "2024-01-15",
      city: "Bogotá",
      phone_number: "+573001234567",
      campaign_name: "Cobranza Enero 2024",
      agent_name: "Sofia"
    },
    
    // Additional customer data for context
    customer_data: {
      name: "Juan Pérez",
      phone: "+573001234567",
      policy: "POL-12345",
      debt: 170000,
      campaign_id: "camp_123",
      test_call: true
    }
  };

  const headers = {
    'Content-Type': 'application/json',
    'xi-api-key': ELEVENLABS_API_KEY
  };

  console.log('📤 REQUEST TO ELEVENLABS:');
  console.log('Endpoint:', endpoint);
  console.log('Headers:', headers);
  console.log('Body:', JSON.stringify(requestBody, null, 2));
  console.log('---');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });

    console.log('📥 RESPONSE FROM ELEVENLABS:');
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Success Response:', data);
    } else {
      const errorText = await response.text();
      console.log('❌ Error Response:', errorText);
      
      // This is where we get the error:
      // "Missing required dynamic variables in first message: {'customer_name'}"
    }

  } catch (error) {
    console.error('🔥 Network/Parse Error:', error);
  }
}

// Agent Configuration (this is how our agent is configured in ElevenLabs dashboard)
const AGENT_CONFIGURATION_EXAMPLE = {
  "agent_id": "agent_4KT1TAjbm5KHqIdE7MKr",
  "name": "Sofia - Cobranza Seguros",
  "conversation_config": {
    "agent": {
      "prompt": {
        "prompt": "Eres Sofia, una agente especializada en cobranzas de seguros..."
      },
      "first_message": "Hola {{customer_name}}, soy Sofia de {{companyName}}. Te llamo porque tenemos registrado un pago pendiente de tu póliza {{policyNumber}} por valor de ${{debt_amount}} pesos. ¿Podrías confirmarme si ya realizaste este pago?",
      "language": "es"
    },
    "tts": {
      "voice_id": "86V9x9hrQds83qf7zaGn",
      "model": "eleven_turbo_v2_5",
      "stability": 0.7,
      "similarity_boost": 0.8,
      "style": 0.2,
      "use_speaker_boost": true
    }
  }
};

console.log('🤖 AGENT CONFIGURATION:');
console.log(JSON.stringify(AGENT_CONFIGURATION_EXAMPLE, null, 2));
console.log('---');

// Run the example
makeOutboundCall();

/* 
PROBLEM ANALYSIS:

1. We send `customer_name` in `dynamic_variables` ✅
2. Agent's first_message uses `{{customer_name}}` syntax ✅ 
3. We use the correct endpoint `/convai/twilio/outbound-call` ✅
4. Headers and authentication are correct ✅

BUT we still get: "Missing required dynamic variables in first message: {'customer_name'}"

QUESTIONS FOR ELEVENLABS SUPPORT:

1. Is the `dynamic_variables` object structure correct?
2. Should we send variables in a different format?
3. Does the agent configuration need additional setup for dynamic variables?
4. Is there a specific order or nesting required for the request body?
5. Are we missing any required fields in the API call?

This appears to be either:
- A bug in the API validation logic
- Missing documentation about the correct format
- Additional configuration required on the agent side

Please advise on the correct implementation.
*/
