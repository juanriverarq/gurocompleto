# 🛠️ Configuración de Server Tools en ElevenLabs (Para Twilio Outbound)

## ✅ Situación Actual

Están usando **Twilio Outbound Calls** (no el SDK de cliente), por lo tanto necesitan configurar **Server Tools** en ElevenLabs, no Client Tools.

## 🎯 Configuración Correcta: Server Tool

### Paso 1: Crear Server Tool en ElevenLabs Dashboard

1. Ve a [ElevenLabs Conversational AI](https://elevenlabs.io/app/conversational-ai)
2. Selecciona tu agente
3. En la sección **Tools**, click **Add Tool**
4. Selecciona **Tool Type: Server**

### Paso 2: Configurar el Server Tool

#### Configuración del Tool:

**Name:** `collect_customer_data`

**Description:**
```
Recolecta datos del cliente durante la llamada. Usa este tool cuando el cliente proporcione 
información como email, teléfono, calificaciones o feedback. Puedes llamar este tool múltiples 
veces durante la conversación para ir guardando datos a medida que los obtienes.
```

**Webhook URL:**
```
https://tu-backend.com/api/saas/voice-campaigns/tools/collect-data/{conversation_id}
```

**HTTP Method:** `POST`

**Headers:**
```json
{
  "Content-Type": "application/json"
}
```

#### Parámetros del Tool:

| Identifier | Data Type | Required | Description |
|------------|-----------|----------|-------------|
| `email` | String | No | Email del cliente |
| `phone` | String | No | Número de teléfono del cliente |
| `debt_amount` | Number | No | Monto de deuda (para recordatorios de pago) |
| `payment_commitment_date` | String | No | Fecha de compromiso de pago |
| `satisfaction_rating` | Integer | No | Calificación de satisfacción del 1 al 10 |
| `recommendation_score` | Integer | No | Score de recomendación NPS del 1 al 10 |
| `feedback` | String | No | Comentarios o feedback del cliente |
| `improvement_suggestions` | String | No | Sugerencias de mejora |
| `positive_aspects` | String | No | Aspectos positivos mencionados |
| `preferred_contact_method` | String | No | Método de contacto preferido (whatsapp, email, phone) |

**Todos los parámetros son opcionales** porque cada tipo de campaña usa campos diferentes.

### Paso 3: Configurar Validación de Parámetros (Opcional)

Para `satisfaction_rating` y `recommendation_score`:
- **Minimum:** 1
- **Maximum:** 10

Para `preferred_contact_method`:
- **Enum values:** whatsapp, email, phone

### Paso 4: Actualizar System Prompt del Agente

En el **System Prompt** base de tu agente en ElevenLabs, agrega:

```
# Recolección de Datos

Al final de cada llamada, usa la función collect_customer_data para guardar los datos 
que el cliente proporcionó durante la conversación.

IMPORTANTE:
- Solo llama al tool con los datos que REALMENTE obtuviste del cliente
- NO inventes datos ni uses valores por defecto
- Puedes llamar al tool múltiples veces si obtienes datos en diferentes momentos
- Los campos a recolectar se especificarán en el prompt personalizado de cada llamada

Ejemplo de uso:
Cliente: "Mi email es juan@gmail.com"
Tú: "Perfecto, confirmo tu email: juan@gmail.com"
[Llamas a collect_customer_data con {email: "juan@gmail.com"}]

Cliente: "Le doy un 9 de calificación"
Tú: "Excelente, 9 de 10"
[Llamas a collect_customer_data con {satisfaction_rating: 9}]
```

## 🔄 Cómo Funciona con Tu Sistema Actual

### 1. Backend Hace Override del Prompt (YA FUNCIONA)

El código actual en [`VoiceCampaignController.php:1052-1118`](backend/app/Http/Controllers/Api/VoiceCampaignController.php:1052) ya envía el prompt personalizado:

```php
'conversation_config_override' => [
    'agent' => [
        'prompt' => ['prompt' => $finalPrompt],  // ← Prompt con instrucciones específicas
        'first_message' => $personalizedFirstMessage
    ]
]
```

### 2. El Prompt Personalizado Incluye Instrucciones

Para **Recordatorio de Pago**, el prompt generado incluye:

```
# Tools
Durante la llamada, solicita y confirma los siguientes datos del cliente: 
email, phone, debt_amount.

Cuando obtengas cada dato, usa collect_customer_data para guardarlo inmediatamente.

Ejemplo:
Cliente: "Mi email es juan@gmail.com"
Tú: "Perfecto, email: juan@gmail.com"
[collect_customer_data({email: "juan@gmail.com"})]
```

Para **Encuesta de Satisfacción**:

```
# Tools
Durante la encuesta, usa collect_customer_data para guardar:
- satisfaction_rating: Calificación del 1 al 10
- recommendation_score: NPS del 1 al 10
- feedback: Comentarios del cliente

Llama al tool después de cada respuesta del cliente.
```

### 3. Durante la Llamada

```
Agente: "Del 1 al 10, ¿qué tan satisfecho estás?"
Cliente: "Le doy un 9"
Agente: [Llama a collect_customer_data({satisfaction_rating: 9})]
Agente: "Excelente, 9 de 10. ¿Nos recomendarías?"
Cliente: "Sí, un 10"
Agente: [Llama a collect_customer_data({recommendation_score: 10})]
```

### 4. ElevenLabs Llama a Tu Webhook

```http
POST https://tu-backend.com/api/saas/voice-campaigns/tools/collect-data/conv_abc123
Content-Type: application/json

{
  "satisfaction_rating": 9
}
```

Y luego otra llamada:

```http
POST https://tu-backend.com/api/saas/voice-campaigns/tools/collect-data/conv_abc123
Content-Type: application/json

{
  "recommendation_score": 10
}
```

### 5. Backend Acumula los Datos

El [`VoiceToolsController.php:22-115`](backend/app/Http/Controllers/Api/VoiceToolsController.php:22) hace merge de los datos:

```php
// Primera llamada al tool
$meta['collected_data'] = [
  'satisfaction_rating' => ['value' => 9, 'confidence' => 1.0, 'source' => 'elevenlabs_tool']
];

// Segunda llamada al tool (merge)
$meta['collected_data'] = array_merge($existingData, [
  'recommendation_score' => ['value' => 10, 'confidence' => 1.0, 'source' => 'elevenlabs_tool']
]);

// Resultado final:
// {
//   satisfaction_rating: {value: 9, confidence: 1.0},
//   recommendation_score: {value: 10, confidence: 1.0}
// }
```

## 📋 Configuración JSON Completa para ElevenLabs

Copia y pega esto en ElevenLabs Dashboard:

```json
{
  "name": "collect_customer_data",
  "type": "server",
  "description": "Recolecta datos del cliente durante la llamada. Usa este tool cuando el cliente proporcione información como email, teléfono, calificaciones o feedback. Puedes llamar este tool múltiples veces durante la conversación.",
  "webhook": {
    "url": "https://tu-backend.com/api/saas/voice-campaigns/tools/collect-data/{conversation_id}",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json"
    }
  },
  "parameters": {
    "type": "object",
    "properties": {
      "email": {
        "type": "string",
        "description": "Email del cliente. Formato: usuario@dominio.com"
      },
      "phone": {
        "type": "string",
        "description": "Número de teléfono del cliente. Formato: 3001234567 o +573001234567"
      },
      "debt_amount": {
        "type": "number",
        "description": "Monto de deuda en pesos colombianos (solo para recordatorios de pago)"
      },
      "payment_commitment_date": {
        "type": "string",
        "description": "Fecha en que el cliente se compromete a pagar. Formato: YYYY-MM-DD"
      },
      "satisfaction_rating": {
        "type": "integer",
        "minimum": 1,
        "maximum": 10,
        "description": "Calificación de satisfacción del 1 al 10 (solo para encuestas)"
      },
      "recommendation_score": {
        "type": "integer",
        "minimum": 1,
        "maximum": 10,
        "description": "Probabilidad de recomendar (NPS) del 1 al 10 (solo para encuestas)"
      },
      "feedback": {
        "type": "string",
        "description": "Comentarios generales o feedback del cliente"
      },
      "improvement_suggestions": {
        "type": "string",
        "description": "Sugerencias de mejora mencionadas por el cliente"
      },
      "positive_aspects": {
        "type": "string",
        "description": "Aspectos positivos que el cliente mencionó"
      },
      "preferred_contact_method": {
        "type": "string",
        "enum": ["whatsapp", "email", "phone"],
        "description": "Método de contacto preferido del cliente"
      }
    },
    "required": []
  }
}
```

## ✅ Endpoints Backend (YA CREADOS)

- ✅ `POST /api/saas/voice-campaigns/tools/collect-data/{conversationId}` - Recibe datos del tool
- ✅ `POST /api/saas/voice-campaigns/tools/schedule-payment/{conversationId}` - Programa envío de pago
- ✅ `POST /api/saas/voice-campaigns/tools/handle/{conversationId}` - Handler genérico

Ver: [`VoiceToolsController.php`](backend/app/Http/Controllers/Api/VoiceToolsController.php:1)
Ver: [`api.php:137-141`](backend/routes/api.php:137)

## 🎯 Ventajas de Este Enfoque

✅ **UN SOLO agente** en ElevenLabs
✅ **UN SOLO Server Tool** genérico
✅ **Prompts dinámicos** vía `conversation_config_override` (ya funciona)
✅ **Datos estructurados** con confianza 1.0
✅ **Múltiples llamadas al tool** durante una conversación
✅ **Compatible con tu arquitectura actual**

## 🔍 Verificación

Para verificar que el tool está configurado correctamente:

1. **Hacer una llamada de prueba**
2. **Revisar logs del backend:**
```bash
tail -f storage/logs/laravel.log | grep "VOICE TOOLS"
```

3. **Buscar en los logs:**
```
🔧 [VOICE TOOLS] Recibiendo datos de Custom Tool
✅ [VOICE TOOLS] Datos guardados exitosamente
```

4. **Consultar la BD:**
```sql
SELECT call_metadata FROM voice_campaign_calls 
WHERE elevenlabs_conversation_id = 'conv_abc123';
```

5. **Verificar en el API:**
```typescript
const history = await voiceCampaignService.getCallHistory();
console.log(history.calls[0].collected_data);
```

## 📝 Instrucciones para el Prompt (Ya Implementadas)

El sistema actual ya genera estas instrucciones automáticamente en el `$collectInstruction` (línea 957-975):

```php
$collectInstruction = "Durante la llamada, solicita y confirma los siguientes datos del cliente: " .
    implode(', ', $enabledFields) .
    ". Cuando el usuario proporcione un dato, usa collect_customer_data para guardarlo.";
```

Esto se incluye en el `$finalPrompt` que se envía vía `conversation_config_override`.

## 🚀 Resumen

**Lo que ya funciona:**
- ✅ Override de prompts por tipo de campaña
- ✅ Instrucciones dinámicas de recolección
- ✅ Endpoints backend para recibir datos
- ✅ Almacenamiento en BD
- ✅ API para consultar datos

**Lo único que falta:**
- ⏳ Configurar el Server Tool `collect_customer_data` en ElevenLabs Dashboard

**Tiempo estimado:** 5 minutos

Una vez configurado el Server Tool, el sistema completo funcionará para los 3 tipos de agentes usando tu arquitectura actual de UN SOLO agente con prompts dinámicos.