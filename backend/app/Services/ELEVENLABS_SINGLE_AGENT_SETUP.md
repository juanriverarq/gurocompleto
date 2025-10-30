# 🎯 Configuración de Custom Tool para UN SOLO Agente en ElevenLabs

## ✅ Situación Actual

Están usando **UN SOLO agente en ElevenLabs** y haciendo **override del prompt** en cada llamada mediante `conversation_config_override`. Esto es perfecto y ya está funcionando.

## 🔧 Solución: UN Custom Tool Genérico

Solo necesitas configurar **UN Custom Tool** en tu agente de ElevenLabs que sirva para TODOS los tipos de campañas.

### Paso 1: Ir a ElevenLabs Dashboard

1. Ve a [ElevenLabs Conversational AI](https://elevenlabs.io/app/conversational-ai)
2. Selecciona tu agente (el que usas actualmente)
3. Ve a la sección **"Tools"** o **"Custom Tools"**

### Paso 2: Crear Custom Tool Genérico

Nombre: `collect_customer_data`

```json
{
  "name": "collect_customer_data",
  "description": "Recolecta cualquier dato del cliente durante la llamada (email, teléfono, calificaciones, feedback, etc.)",
  "parameters": {
    "type": "object",
    "properties": {
      "email": {
        "type": "string",
        "description": "Email del cliente"
      },
      "phone": {
        "type": "string",
        "description": "Número de teléfono del cliente"
      },
      "debt_amount": {
        "type": "number",
        "description": "Monto de deuda (para recordatorios de pago)"
      },
      "payment_commitment_date": {
        "type": "string",
        "description": "Fecha de compromiso de pago"
      },
      "satisfaction_rating": {
        "type": "integer",
        "minimum": 1,
        "maximum": 10,
        "description": "Calificación de satisfacción del 1 al 10"
      },
      "recommendation_score": {
        "type": "integer",
        "minimum": 1,
        "maximum": 10,
        "description": "Score de recomendación NPS del 1 al 10"
      },
      "feedback": {
        "type": "string",
        "description": "Comentarios o feedback del cliente"
      },
      "improvement_suggestions": {
        "type": "string",
        "description": "Sugerencias de mejora del cliente"
      },
      "positive_aspects": {
        "type": "string",
        "description": "Aspectos positivos mencionados"
      },
      "preferred_contact_method": {
        "type": "string",
        "enum": ["whatsapp", "email", "phone"],
        "description": "Método de contacto preferido"
      }
    },
    "required": []
  },
  "webhook_url": "https://tu-backend.com/api/saas/voice-campaigns/tools/collect-data/{conversation_id}"
}
```

**Nota:** Ningún campo es required porque cada tipo de campaña usa campos diferentes.

### Paso 3: Actualizar System Prompt Base del Agente

En el System Prompt base de tu agente en ElevenLabs, agrega:

```
IMPORTANTE: Al final de cada llamada, usa la función collect_customer_data para guardar 
los datos que el cliente proporcionó durante la conversación.

Los campos a recolectar dependerán del tipo de llamada y se especificarán en el prompt 
personalizado de cada conversación.

Usa collect_customer_data solo con los campos que realmente obtuviste del cliente.
No inventes datos ni uses valores por defecto.
```

## ✅ Cómo Funciona con el Sistema Actual

### 1. Frontend Crea la Campaña

```typescript
const campaign = createCustomerWelcomeCampaign({
  campaignName: 'Bienvenida Enero 2024',
  contacts: [{
    name: 'María García',
    phone: '+573009876543',
    insurance_type: 'Seguro de Vida',
    start_date: '2024-01-15'
  }],
  agentId: 'agent-customer-welcome'
});

// Esto configura automáticamente:
// settings.campaign_type = 'customer_welcome'
// settings.post_call_tools.collect = {
//   email: { enabled: true },
//   phone: { enabled: true },
//   preferred_contact_method: { enabled: true }
// }
```

### 2. Backend Hace Override del Prompt

El código actual en [`VoiceCampaignController.php`](backend/app/Http/Controllers/Api/VoiceCampaignController.php:1052-1118) ya hace esto:

```php
// Línea 1052-1066: conversation_config_override
'conversation_config_override' => [
    'agent' => [
        'prompt' => [
            'prompt' => $finalPrompt  // ← Prompt personalizado según tipo
        ],
        'first_message' => $personalizedFirstMessage,  // ← Saludo personalizado
        'language' => 'es'
    ]
]
```

### 3. El Prompt Personalizado Incluye Instrucciones

Para **Bienvenida al Cliente**, el prompt generado incluye:

```
# Tools
Durante la llamada, solicita y confirma los siguientes datos del cliente: 
email, phone, preferred_contact_method.

Cuando obtengas estos datos, usa la función collect_customer_data para guardarlos.

Ejemplo:
Cliente: "Mi email es maria@gmail.com"
Tú: "Perfecto, confirmo tu email: maria@gmail.com"
[Llamas a collect_customer_data({email: "maria@gmail.com"})]
```

Para **Encuesta de Satisfacción**, el prompt incluye:

```
# Tools
Durante la encuesta, usa la función collect_customer_data para guardar:
- satisfaction_rating: La calificación del 1 al 10
- recommendation_score: El NPS del 1 al 10
- feedback: Los comentarios del cliente

Ejemplo:
Cliente: "Le doy un 9"
Tú: "Excelente, 9 de 10"
[Llamas a collect_customer_data({satisfaction_rating: 9})]
```

## 🎯 Ventajas de Este Enfoque

✅ **UN SOLO agente en ElevenLabs** - No necesitas crear múltiples agentes
✅ **UN SOLO Custom Tool** - Funciona para todos los tipos de campañas
✅ **Prompts dinámicos** - Se personalizan en cada llamada vía override
✅ **Flexible** - Cada campaña usa solo los campos que necesita
✅ **Ya implementado** - El sistema de override ya funciona

## 📝 Configuración del Custom Tool en ElevenLabs

### Webhook URL:
```
https://tu-backend.com/api/saas/voice-campaigns/tools/collect-data/{conversation_id}
```

**Nota:** `{conversation_id}` es un placeholder que ElevenLabs reemplaza automáticamente.

### Ejemplo de Llamada del Tool:

Cuando el agente llama al tool durante una encuesta:

```
POST https://tu-backend.com/api/saas/voice-campaigns/tools/collect-data/conv_abc123
Content-Type: application/json

{
  "satisfaction_rating": 9,
  "recommendation_score": 10,
  "feedback": "Excelente servicio, muy rápido"
}
```

El backend (Ver [`VoiceToolsController.php:22`](backend/app/Http/Controllers/Api/VoiceToolsController.php:22)) recibe esto y lo guarda en `call_metadata.collected_data`.

## 🔄 Flujo Completo

```
1. Frontend crea campaña con tipo 'customer_welcome'
   ↓
2. Backend detecta el tipo y genera prompt específico
   ↓
3. Backend hace override del prompt vía conversation_config_override
   ↓
4. ElevenLabs usa el prompt personalizado en la llamada
   ↓
5. Durante la llamada, el agente usa collect_customer_data
   ↓
6. ElevenLabs llama al webhook con los datos
   ↓
7. Backend guarda en call_metadata.collected_data
   ↓
8. Datos disponibles en API /call-history
```

## ✅ Lo Que Ya Funciona

- ✅ Override de prompts (líneas 1052-1118)
- ✅ Detección de tipo de campaña
- ✅ Generación de prompts personalizados
- ✅ Variables dinámicas por tipo
- ✅ Endpoints para recibir datos del tool
- ✅ Almacenamiento en BD
- ✅ API para consultar datos

## 🎯 Lo Único que Falta

**Configurar el Custom Tool en ElevenLabs Dashboard** (5 minutos):

1. Nombre: `collect_customer_data`
2. Webhook: `https://tu-backend.com/api/saas/voice-campaigns/tools/collect-data/{conversation_id}`
3. Parámetros: Los 10 campos listados arriba (todos opcionales)

¡Y listo! El sistema completo funcionará para los 3 tipos de agentes usando UN SOLO agente en ElevenLabs.