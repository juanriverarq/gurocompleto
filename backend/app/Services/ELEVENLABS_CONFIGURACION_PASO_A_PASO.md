# 📝 Configuración Paso a Paso del Server Tool en ElevenLabs

## 🎯 Objetivo

Configurar UN Server Tool llamado `collect_customer_data` que funcione para TODOS los tipos de campañas (Recordatorio de Pago, Bienvenida, Encuesta).

## 📋 Pasos Detallados

### Paso 1: Acceder a tu Agente

1. Ve a [ElevenLabs Conversational AI](https://elevenlabs.io/app/conversational-ai)
2. Haz clic en tu agente (el que usas actualmente para las llamadas)
3. Verás el dashboard del agente

### Paso 2: Ir a la Sección de Tools

1. En el menú lateral o tabs del agente, busca la sección **"Tools"**
2. Haz clic en **"Add Tool"** o **"Create Tool"**

### Paso 3: Seleccionar Tipo de Tool

1. En **"Tool Type"**, selecciona **"Webhook"** (o "Server" si aparece así)
2. NO selecciones "Client" - eso es para aplicaciones web/móvil

### Paso 4: Configuración Básica del Tool

**Name:**
```
collect_customer_data
```

**Description:**
```
Recolecta datos del cliente durante la llamada. Usa este tool cuando el cliente proporcione información como email, teléfono, calificaciones o feedback. Puedes llamar este tool múltiples veces durante la conversación para ir guardando datos a medida que los obtienes. Solo envía los campos que realmente obtuviste del cliente, no inventes datos.
```

### Paso 5: Configurar el Webhook

**URL:**
```
https://tu-backend.com/api/saas/voice-campaigns/tools/collect-data/{conversation_id}
```

**Nota:** Reemplaza `tu-backend.com` con tu dominio real. El `{conversation_id}` es un placeholder que ElevenLabs reemplaza automáticamente.

**Method:**
```
POST
```

**Headers:**
```
Content-Type: application/json
```

**Response Timeout:**
```
20 segundos
```

### Paso 6: Configurar Parámetros del Request Body

Agrega los siguientes parámetros (todos opcionales):

#### 1. email
- **Type:** String
- **Identifier:** `email`
- **Required:** No
- **Description:** Email del cliente. Formato: usuario@dominio.com

#### 2. phone
- **Type:** String
- **Identifier:** `phone`
- **Required:** No
- **Description:** Número de teléfono del cliente. Formato: 3001234567 o +573001234567

#### 3. debt_amount
- **Type:** Number
- **Identifier:** `debt_amount`
- **Required:** No
- **Description:** Monto de deuda en pesos colombianos (solo para recordatorios de pago)

#### 4. payment_commitment_date
- **Type:** String
- **Identifier:** `payment_commitment_date`
- **Required:** No
- **Description:** Fecha en que el cliente se compromete a pagar. Formato: YYYY-MM-DD

#### 5. satisfaction_rating
- **Type:** Integer
- **Identifier:** `satisfaction_rating`
- **Required:** No
- **Minimum:** 1
- **Maximum:** 10
- **Description:** Calificación de satisfacción del 1 al 10 (solo para encuestas)

#### 6. recommendation_score
- **Type:** Integer
- **Identifier:** `recommendation_score`
- **Required:** No
- **Minimum:** 1
- **Maximum:** 10
- **Description:** Probabilidad de recomendar (NPS) del 1 al 10 (solo para encuestas)

#### 7. feedback
- **Type:** String
- **Identifier:** `feedback`
- **Required:** No
- **Description:** Comentarios generales o feedback del cliente

#### 8. improvement_suggestions
- **Type:** String
- **Identifier:** `improvement_suggestions`
- **Required:** No
- **Description:** Sugerencias de mejora mencionadas por el cliente

#### 9. positive_aspects
- **Type:** String
- **Identifier:** `positive_aspects`
- **Required:** No
- **Description:** Aspectos positivos que el cliente mencionó

#### 10. preferred_contact_method
- **Type:** String
- **Identifier:** `preferred_contact_method`
- **Required:** No
- **Enum:** whatsapp, email, phone
- **Description:** Método de contacto preferido del cliente

### Paso 7: Configuración Avanzada (Opcional)

**Disable Interruptions:** `false` (permite que el cliente interrumpa)

**Force Pre-Tool Speech:** `auto` (el agente decide si hablar antes de llamar al tool)

**Wait for Response:** `false` (no necesitamos que el agente espere la respuesta del webhook)

### Paso 8: Guardar el Tool

1. Haz clic en **"Save"** o **"Create Tool"**
2. El tool aparecerá en la lista de tools del agente

### Paso 9: Actualizar System Prompt (Opcional pero Recomendado)

En el **System Prompt** base de tu agente, agrega al final:

```
# Recolección de Datos

Cuando obtengas datos del cliente (email, teléfono, calificaciones, etc.), 
usa la función collect_customer_data para guardarlos inmediatamente.

Puedes llamar a collect_customer_data múltiples veces durante la conversación.
Solo envía los campos que realmente obtuviste, no inventes datos.

Los campos específicos a recolectar se indicarán en el prompt personalizado de cada llamada.
```

## 🧪 Probar el Tool

### Opción 1: Desde ElevenLabs Dashboard

1. En tu agente, busca la opción **"Test"** o **"Try it"**
2. Inicia una conversación de prueba
3. Di algo como: "Mi email es test@example.com"
4. El agente debería llamar al tool automáticamente

### Opción 2: Hacer una Llamada Real

```typescript
import { createSatisfactionSurveyCampaign } from './voiceCampaignHelper';

const campaign = createSatisfactionSurveyCampaign({
  campaignName: 'Prueba Tool',
  contacts: [{
    name: 'Test Cliente',
    phone: '+573001234567', // Tu número para probar
    policy_number: 'TEST-001',
    last_service_date: '2024-01-10',
    interaction_type: 'Prueba'
  }],
  agentId: 'agent-satisfaction-survey'
});

await voiceCampaignService.createImmediateVoiceCampaign(campaign);
```

### Verificar en los Logs

```bash
# En tu servidor
tail -f storage/logs/laravel.log | grep "VOICE TOOLS"

# Deberías ver:
# 🔧 [VOICE TOOLS] Recibiendo datos de Custom Tool
# ✅ [VOICE TOOLS] Datos guardados exitosamente
```

## 📄 Archivo JSON Listo para Importar

He creado el archivo [`ELEVENLABS_TOOL_JSON_CONFIG.json`](backend/app/Services/ELEVENLABS_TOOL_JSON_CONFIG.json:1) con la configuración completa.

Si ElevenLabs permite importar configuraciones JSON, puedes usar ese archivo directamente.

## 🔍 Verificar que Funciona

### 1. Revisar Logs del Backend

```bash
tail -f storage/logs/laravel.log | grep -E "VOICE TOOLS|ELEVENLABS"
```

### 2. Consultar la Base de Datos

```sql
SELECT 
  id,
  recipient_name,
  JSON_EXTRACT(call_metadata, '$.collected_data') as datos,
  JSON_EXTRACT(call_metadata, '$.tool_used') as tool_usado
FROM voice_campaign_calls
ORDER BY id DESC
LIMIT 5;
```

### 3. Consultar vía API

```typescript
const history = await voiceCampaignService.getCallHistory({ limit: 10 });

history.calls.forEach(call => {
  if (call.collected_data) {
    console.log('✅ Datos recolectados:', call.collected_data);
    console.log('   Tool usado:', call.call_metadata?.tool_used);
  }
});
```

## ⚠️ Troubleshooting

### El tool no se llama durante la llamada

**Solución:**
1. Verifica que el nombre del tool sea exactamente `collect_customer_data`
2. Asegúrate de que el prompt incluya instrucciones claras de cuándo usar el tool
3. Revisa que el modelo LLM sea GPT-4o mini o Claude 3.5 Sonnet (no Gemini)

### El webhook no recibe datos

**Solución:**
1. Verifica que la URL sea accesible públicamente (no localhost)
2. Confirma que el endpoint esté en las rutas: [`api.php:137`](backend/routes/api.php:137)
3. Revisa los logs de ElevenLabs para ver si hay errores

### Los datos no se guardan en la BD

**Solución:**
1. Revisa los logs: `tail -f storage/logs/laravel.log | grep "VOICE TOOLS"`
2. Verifica que el `conversation_id` coincida con el de la llamada
3. Confirma que el [`VoiceToolsController.php`](backend/app/Http/Controllers/Api/VoiceToolsController.php:1) esté funcionando

## ✅ Checklist Final

- [ ] Tool creado en ElevenLabs con nombre `collect_customer_data`
- [ ] Tipo: Webhook (Server Tool)
- [ ] URL configurada: `https://tu-backend.com/api/saas/voice-campaigns/tools/collect-data/{conversation_id}`
- [ ] Method: POST
- [ ] 10 parámetros agregados (todos opcionales)
- [ ] System Prompt actualizado con instrucciones del tool
- [ ] Prueba realizada con llamada real
- [ ] Logs verificados
- [ ] Datos aparecen en call_metadata.collected_data

## 🎉 Resultado Esperado

Después de configurar el tool, cuando hagas una llamada:

1. El agente pedirá los datos según el tipo de campaña
2. Llamará a `collect_customer_data` con los datos obtenidos
3. Los datos se guardarán en `call_metadata.collected_data`
4. Estarán disponibles vía API en `/api/saas/voice-campaigns/call-history`

**Ejemplo de datos guardados:**

```json
{
  "collected_data": {
    "satisfaction_rating": {
      "value": 9,
      "confidence": 1.0,
      "source": "elevenlabs_tool",
      "collected_at": "2024-01-20 10:30:15"
    },
    "recommendation_score": {
      "value": 10,
      "confidence": 1.0,
      "source": "elevenlabs_tool",
      "collected_at": "2024-01-20 10:30:25"
    },
    "feedback": {
      "value": "Excelente servicio, muy rápido",
      "confidence": 1.0,
      "source": "elevenlabs_tool",
      "collected_at": "2024-01-20 10:30:35"
    }
  },
  "tool_used": true,
  "tool_called_at": "2024-01-20 10:30:15"
}
```

---

**Tiempo estimado de configuración:** 10 minutos

**Archivos de referencia:**
- JSON config: [`ELEVENLABS_TOOL_JSON_CONFIG.json`](backend/app/Services/ELEVENLABS_TOOL_JSON_CONFIG.json:1)
- Guía técnica: [`ELEVENLABS_SERVER_TOOLS_SETUP.md`](backend/app/Services/ELEVENLABS_SERVER_TOOLS_SETUP.md:1)
- Controlador: [`VoiceToolsController.php`](backend/app/Http/Controllers/Api/VoiceToolsController.php:1)