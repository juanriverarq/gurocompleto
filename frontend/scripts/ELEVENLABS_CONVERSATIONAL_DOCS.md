# ElevenLabs Conversational AI - Documentación Completa

## 🎯 Introducción

ElevenLabs Conversational AI es una plataforma avanzada que permite crear agentes de voz conversacionales para llamadas telefónicas automatizadas. La plataforma integra reconocimiento de voz (ASR), procesamiento de lenguaje natural (LLM) y síntesis de voz (TTS) en tiempo real.

## 📚 Estructura de la API

### **Base URL**
```
https://api.elevenlabs.io/v1
```

### **Autenticación**
```typescript
Headers: {
  'xi-api-key': 'tu_api_key_aqui',
  'Content-Type': 'application/json'
}
```

---

## 🤖 Gestión de Agentes Conversacionales

### **1. Obtener Lista de Agentes**

**Endpoint:** `GET /convai/agents`

**Respuesta:**
```json
{
  "agents": [
    {
      "agent_id": "agent_2001k1mg3w2yeyd9jcprqbnexr3d",
      "name": "Kio - todo riesgo automoviles",
      "tags": [],
      "created_at_unix_secs": 1754108392,
      "access_info": {
        "is_creator": true,
        "creator_name": "juanriverarq@gmail.com",
        "creator_email": "juanriverarq@gmail.com",
        "role": "admin"
      },
      "last_call_time_unix_secs": 1754450912
    }
  ],
  "has_more": false,
  "next_cursor": null
}
```

### **2. Obtener Detalles de un Agente**

**Endpoint:** `GET /convai/agents/{agent_id}`

**Estructura del Agente:**
```json
{
  "agent_id": "agent_xxx",
  "name": "Nombre del Agente",
  "conversation_config": {
    "asr": {
      "quality": "high",
      "provider": "elevenlabs",
      "user_input_audio_format": "pcm_16000",
      "keywords": []
    },
    "turn": {
      "turn_timeout": 7.0,
      "silence_end_call_timeout": -1.0,
      "mode": "turn"
    },
    "tts": {
      "model_id": "eleven_turbo_v2_5",
      "voice_id": "86V9x9hrQds83qf7zaGn",
      "supported_voices": [],
      "agent_output_audio_format": "pcm_16000",
      "optimize_streaming_latency": 3,
      "stability": 0.5,
      "speed": 1.0,
      "similarity_boost": 0.8,
      "pronunciation_dictionary_locators": []
    },
    "conversation": {
      "text_only": false,
      "max_duration_seconds": 600,
      "client_events": ["audio", "interruption"]
    },
    "agent": {
      "first_message": "Mensaje de saludo",
      "language": "es",
      "dynamic_variables": {
        "dynamic_variable_placeholders": {}
      },
      "prompt": {
        "prompt": "Prompt del sistema completo",
        "llm": "gemini-2.0-flash",
        "temperature": 0.5,
        "max_tokens": -1,
        "tool_ids": [],
        "built_in_tools": {
          "end_call": null,
          "language_detection": null,
          "transfer_to_agent": null,
          "transfer_to_number": null,
          "skip_turn": null,
          "play_keypad_touch_tone": null,
          "voicemail_detection": null
        }
      }
    }
  },
  "metadata": {},
  "phone_numbers": [],
  "platform_settings": {},
  "tags": [],
  "workflow": {}
}
```

---

## 📞 Gestión de Conversaciones

### **1. Obtener Lista de Conversaciones**

**Endpoint:** `GET /convai/conversations`

**Parámetros de Query:**
- `agent_id`: ID del agente (opcional)
- `limit`: Número de conversaciones a retornar (max 100)
- `cursor`: Cursor para paginación

**Respuesta:**
```json
{
  "conversations": [
    {
      "agent_id": "agent_2001k1mg3w2yeyd9jcprqbnexr3d",
      "agent_name": "Kio - todo riesgo automoviles",
      "conversation_id": "conv_6401k1yprjrqehtrn99ta10kq87b",
      "start_time_unix_secs": 1754450912,
      "call_duration_secs": 6,
      "message_count": 0,
      "status": "failed",
      "call_successful": "unknown",
      "transcript_summary": null,
      "call_summary_title": null
    }
  ],
  "has_more": false,
  "next_cursor": null
}
```

### **2. Obtener Detalles de una Conversación**

**Endpoint:** `GET /convai/conversations/{conversation_id}`

**Respuesta incluye:**
- Transcript completo de la conversación
- Metadatos de la llamada
- Información de costos
- Estado final de la conversación

---

## 🔧 Configuración de Agentes

### **ASR (Automatic Speech Recognition)**
```json
{
  "asr": {
    "quality": "high",           // "high" | "low"
    "provider": "elevenlabs",    // "elevenlabs" | "deepgram"
    "user_input_audio_format": "pcm_16000",
    "keywords": []               // Palabras clave para mejorar reconocimiento
  }
}
```

### **TTS (Text-to-Speech)**
```json
{
  "tts": {
    "model_id": "eleven_turbo_v2_5",    // Modelo de TTS
    "voice_id": "86V9x9hrQds83qf7zaGn", // ID de la voz
    "stability": 0.5,                    // 0.0 - 1.0
    "speed": 1.0,                        // 0.25 - 2.0
    "similarity_boost": 0.8,             // 0.0 - 1.0
    "optimize_streaming_latency": 3,     // 0-4 (mayor = menos latencia)
    "agent_output_audio_format": "pcm_16000"
  }
}
```

### **Configuración de Turnos**
```json
{
  "turn": {
    "turn_timeout": 7.0,              // Tiempo máximo de silencio (segundos)
    "silence_end_call_timeout": -1.0, // -1 = sin límite
    "mode": "turn"                    // "turn" | "continuous"
  }
}
```

### **Configuración de Conversación**
```json
{
  "conversation": {
    "text_only": false,              // Solo texto (sin audio)
    "max_duration_seconds": 600,     // Duración máxima (10 minutos)
    "client_events": [               // Eventos enviados al cliente
      "audio",
      "interruption"
    ]
  }
}
```

---

## 🧠 Configuración del Agente (Prompt y LLM)

### **Estructura del Prompt**
```typescript
interface AgentPrompt {
  prompt: string;                    // Prompt del sistema
  llm: "gemini-2.0-flash" | "gpt-4o" | "claude-3-5-sonnet";
  temperature: number;               // 0.0 - 2.0
  max_tokens: number;               // -1 = sin límite
  tool_ids: string[];               // IDs de herramientas personalizadas
  built_in_tools: {                // Herramientas integradas
    end_call: null;                 // Finalizar llamada
    language_detection: null;       // Detección de idioma
    transfer_to_agent: null;        // Transferir a agente humano
    transfer_to_number: null;       // Transferir a número
    skip_turn: null;                // Saltar turno
    play_keypad_touch_tone: null;   // Reproducir tonos DTMF
    voicemail_detection: null;      // Detección de buzón de voz
  };
  knowledge_base: string[];         // Base de conocimiento
  rag: {                           // Retrieval Augmented Generation
    enabled: boolean;
    embedding_model: string;
    max_vector_distance: number;
    max_documents_length: number;
    max_retrieved_rag_chunks_count: number;
  };
}
```

### **Variables del Sistema Disponibles**
- `{{system__caller_id}}` - Número del llamante
- `{{system__called_number}}` - Número de destino
- `{{system__call_duration_secs}}` - Duración de la llamada
- `{{system__agent_id}}` - ID único del agente
- `{{system__time_utc}}` - Hora UTC actual (formato ISO)
- `{{system__conversation_id}}` - ID único de la conversación
- `{{system__call_sid}}` - ID de sesión de la llamada

---

## 📲 Iniciar Llamadas Telefónicas

### **Método 1: Via WebSocket**
```typescript
const wsUrl = `wss://api.elevenlabs.io/v1/convai/phone_call?agent_id=${agentId}&xi-api-key=${apiKey}`;
const ws = new WebSocket(wsUrl);

ws.onopen = () => {
  const initData = {
    type: 'phone_call_initiation',
    phone_number: '+57300123456',
    agent_id: 'agent_xxx',
    customer_name: 'Juan Pérez',
    max_duration: 300,
    webhook_url: 'https://mi-servidor.com/webhook',
    customer_data: {
      policy_number: 'POL123456',
      claim_id: 'CLM789'
    }
  };
  ws.send(JSON.stringify(initData));
};
```

### **Método 2: Via REST API**
```typescript
const response = await fetch('https://api.elevenlabs.io/v1/convai/conversations', {
  method: 'POST',
  headers: {
    'xi-api-key': apiKey,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    agent_id: 'agent_xxx',
    phone_call_config: {
      phone_number: '+57300123456',
      max_duration: 300,
      webhook_url: 'https://mi-servidor.com/webhook',
      customer_name: 'Juan Pérez',
      customer_data: {
        policy_number: 'POL123456'
      }
    },
    conversation_config_override: {
      agent: {
        prompt: {
          prompt: `Eres un asistente de seguros. El cliente se llama Juan Pérez.`
        },
        first_message: 'Hola Juan, soy Laura de la aseguradora.',
        language: 'es'
      }
    }
  })
});
```

---

## 💰 Sistema de Costos

### **Estructura de Costos**
1. **ASR (Speech-to-Text)**: ~$0.006 por minuto
2. **TTS (Text-to-Speech)**: Basado en caracteres generados
3. **LLM Processing**: Basado en tokens consumidos
4. **Llamadas telefónicas**: A través de Twilio (~$0.0287/min)

### **Cálculo de Costos en el Dashboard**
```typescript
// Costos ElevenLabs (en créditos)
const elevenLabsCredits = conversation.cost || 0;
const elevenLabsUSD = elevenLabsCredits * 0.000198;

// Costos Twilio
const twilioUSD = Math.ceil(durationSeconds / 60) * 0.0287;

// Costo total
const totalCost = elevenLabsUSD + twilioUSD;

// Ganancia (40% margen)
const profit = totalCost * 0.4;
const totalWithProfit = totalCost + profit;
```

---

## 🎙️ Voces Disponibles

### **Voces Recomendadas para Español**
```typescript
const spanishVoices = [
  {
    voice_id: '86V9x9hrQds83qf7zaGn',
    name: 'Marcela Colombia Girl',
    language: 'Spanish (Colombia)',
    gender: 'female',
    accent: 'Colombian'
  },
  {
    voice_id: 'flq6f7yk4E4fJM5XTYuZ',
    name: 'Michael',
    language: 'English',
    gender: 'male',
    use_case: 'professional'
  }
];
```

### **Configuración de Voz Óptima**
```json
{
  "stability": 0.7,        // Consistencia de la voz
  "similarity_boost": 0.8, // Similitud con la voz original
  "style": 0.2,           // Expresividad (0 = neutral, 1 = muy expresivo)
  "use_speaker_boost": true // Mejora para voces clonadas
}
```

---

## 🔄 Estados de Conversaciones

### **Estados Principales**
- `initiated` - Llamada iniciada
- `in-progress` - En curso
- `processing` - Procesando
- `done` - Completada exitosamente
- `failed` - Falló
- `no_answer` - Sin respuesta
- `busy` - Línea ocupada
- `voicemail` - Buzón de voz detectado

### **Resultados de Llamada**
- `call_successful`: `"yes"` | `"no"` | `"unknown"`
- `status`: Estado técnico de la conversación
- `transcript_summary`: Resumen automático generado
- `call_summary_title`: Título del resumen

---

## 🛠️ Herramientas Integradas

### **Herramientas del Sistema**
```typescript
interface BuiltInTools {
  end_call: null;                 // Finalizar llamada
  language_detection: null;       // Cambiar idioma automáticamente
  transfer_to_agent: null;        // Transferir a humano
  transfer_to_number: null;       // Transferir a otro número
  skip_turn: null;                // Saltar turno del agente
  play_keypad_touch_tone: null;   // Reproducir tonos DTMF
  voicemail_detection: null;      // Detectar buzón de voz
}
```

### **Uso de Herramientas en Prompt**
```
Si el cliente solicita hablar con un humano, usa la herramienta transfer_to_agent.
Si necesitas reproducir un tono telefónico, usa play_keypad_touch_tone.
Para finalizar la llamada educadamente, usa end_call.
```

---

## 📊 Webhooks y Notificaciones

### **Configuración de Webhook**
```json
{
  "webhook_url": "https://tu-servidor.com/webhook/elevenlabs",
  "webhook_version": "v1"
}
```

### **Eventos de Webhook**
```typescript
interface WebhookEvent {
  event_type: 'conversation_started' | 'conversation_ended' | 'message_received';
  conversation_id: string;
  agent_id: string;
  timestamp: string;
  data: {
    // Datos específicos del evento
  };
}
```

---

## 🚀 Mejores Prácticas

### **1. Configuración de Prompts**
```typescript
const prompt = `
# Personality
Eres un agente especializado en seguros de vehículos.
Tu nombre es Laura.
Eres amigable, profesional y empático.

# Environment  
Estás llamando al cliente por teléfono.
El cliente puede estar estresado por un accidente.

# Goal
1. Saluda y preséntate
2. Confirma identidad del cliente
3. Recopila información del siniestro
4. Explica próximos pasos
5. Despídete cordialmente

# Guardrails
- Nunca des consejos médicos
- Mantén confidencialidad
- No hagas promesas que no puedas cumplir
- Si no sabes algo, admítelo

# Variables Disponibles
Cliente: {{customer_name}}
Póliza: {{policy_number}}
Teléfono: {{system__caller_id}}
`;
```

### **2. Configuración de Voz Óptima**
```typescript
const voiceSettings = {
  stability: 0.7,        // Más estable para contexto profesional
  similarity_boost: 0.8, // Alta similitud
  style: 0.2,           // Poco expresivo para mantener profesionalismo
  speed: 0.9,           // Ligeramente más lento para claridad
  use_speaker_boost: true
};
```

### **3. Manejo de Errores**
```typescript
try {
  const conversation = await createPhoneCall(callData);
  
  // Monitorear estado
  const checkStatus = setInterval(async () => {
    const status = await getConversationStatus(conversation.id);
    if (status === 'done' || status === 'failed') {
      clearInterval(checkStatus);
      // Procesar resultado final
    }
  }, 5000);
  
} catch (error) {
  console.error('Error en llamada:', error);
  // Manejar error apropiadamente
}
```

### **4. Variables Dinámicas**
```typescript
const dynamicVariables = {
  customer_name: 'Juan Pérez',
  policy_number: 'POL-123456',
  policy_expiration_date: '2025-12-31',
  company_name: 'Aseguradora Solidaria',
  debt_amount: 150000,
  payment_due_date: '2025-02-15'
};
```

---

## 🔍 Monitoreo y Analytics

### **Métricas Importantes**
- **Duración promedio de llamadas**
- **Tasa de respuesta** (answered vs no_answer)
- **Tasa de éxito** (successful vs failed)
- **Costo por llamada exitosa**
- **Tiempo de respuesta del agente**

### **Análisis de Transcripts**
```typescript
// Analizar sentimiento del cliente
const sentiment = analyzeSentiment(conversation.transcript);

// Extraer información clave
const extractedInfo = {
  customerSatisfaction: detectSatisfaction(transcript),
  keyTopics: extractTopics(transcript),
  actionItems: extractActionItems(transcript)
};
```

---

## 🧪 Testing y Debug

### **1. Probar Agente**
```bash
curl -X POST "https://api.elevenlabs.io/v1/convai/conversations" \
  -H "xi-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent_xxx",
    "phone_call_config": {
      "phone_number": "+1234567890"
    }
  }'
```

### **2. Debug de Conversaciones**
```typescript
// Obtener logs detallados
const conversation = await getConversationDetails(conversationId);
console.log('Status:', conversation.status);
console.log('Duration:', conversation.call_duration_secs);
console.log('Messages:', conversation.message_count);
console.log('Cost:', conversation.cost);
```

### **3. Validar Configuración**
```typescript
const validateAgent = (agent) => {
  const checks = {
    hasValidVoice: !!agent.conversation_config.tts.voice_id,
    hasPrompt: !!agent.conversation_config.agent.prompt.prompt,
    hasFirstMessage: !!agent.conversation_config.agent.first_message,
    validDuration: agent.conversation_config.conversation.max_duration_seconds > 0
  };
  
  return Object.values(checks).every(check => check);
};
```

---

## 📈 Roadmap y Próximas Funcionalidades

### **Funcionalidades Actuales**
- ✅ Agentes conversacionales con LLM
- ✅ Llamadas telefónicas automatizadas
- ✅ Múltiples idiomas y voces
- ✅ Herramientas integradas
- ✅ Webhooks en tiempo real
- ✅ Transcripts y análisis

### **Próximas Mejoras**
- 🔄 Mejor integración con CRM
- 🔄 Análisis de sentimientos en tiempo real
- 🔄 Múltiples agentes en una llamada
- 🔄 Integración con bases de conocimiento
- 🔄 Mejores métricas de calidad

---

## 📞 Soporte Técnico

### **Recursos Oficiales**
- **Documentación:** https://docs.elevenlabs.io
- **API Reference:** https://api.elevenlabs.io/docs
- **Discord Community:** https://discord.gg/elevenlabs
- **Status Page:** https://status.elevenlabs.io

### **Límites de Rate**
- **Requests por minuto:** 120
- **Llamadas concurrentes:** Según plan
- **Duración máxima por llamada:** 30 minutos

### **Contacto**
- **Email:** support@elevenlabs.io
- **Chat:** Disponible en dashboard
- **Documentación técnica:** En el proyecto Guro

---

**Última actualización:** Enero 2025  
**Versión API:** v1  
**Compatibilidad:** React 19, TypeScript, Vite
