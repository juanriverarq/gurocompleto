# 🛠️ Configuración de Custom Tools en ElevenLabs para Recolección de Datos

## ⚠️ Problema Identificado

Si el agente de Recordatorio de Pago no está recolectando datos, es porque **ElevenLabs necesita que configures Custom Tools** en el agente para que pueda capturar y estructurar los datos durante la llamada.

## 🎯 Solución: Configurar Custom Tools en ElevenLabs

### Paso 1: Acceder a la Configuración del Agente

1. Ve a [ElevenLabs Dashboard](https://elevenlabs.io/app/conversational-ai)
2. Selecciona tu agente (ej: "Sofia - Recordatorio de Pago")
3. Ve a la sección **"Tools"** o **"Custom Tools"**

### Paso 2: Crear Tool para Recolección de Datos

#### Para Recordatorio de Pago

Crear un Custom Tool llamado `collect_payment_data`:

```json
{
  "name": "collect_payment_data",
  "description": "Recolecta datos del cliente durante la llamada de recordatorio de pago",
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
        "description": "Monto de la deuda confirmado por el cliente"
      },
      "payment_commitment_date": {
        "type": "string",
        "description": "Fecha en que el cliente se compromete a pagar"
      }
    },
    "required": ["email"]
  }
}
```

**Webhook URL:** `https://tu-backend.com/api/saas/voice-campaigns/tools/collect-data/{conversation_id}`

#### Para Bienvenida al Cliente

Crear un Custom Tool llamado `collect_welcome_data`:

```json
{
  "name": "collect_welcome_data",
  "description": "Recolecta preferencias del nuevo cliente",
  "parameters": {
    "type": "object",
    "properties": {
      "email": {
        "type": "string",
        "description": "Email del cliente"
      },
      "phone": {
        "type": "string",
        "description": "Número de teléfono preferido"
      },
      "preferred_contact_method": {
        "type": "string",
        "enum": ["whatsapp", "email", "phone"],
        "description": "Método de contacto preferido del cliente"
      },
      "has_questions": {
        "type": "boolean",
        "description": "Si el cliente tiene preguntas sobre su póliza"
      }
    },
    "required": ["email", "preferred_contact_method"]
  }
}
```

#### Para Encuesta de Satisfacción

Crear un Custom Tool llamado `collect_survey_data`:

```json
{
  "name": "collect_survey_data",
  "description": "Recolecta respuestas de la encuesta de satisfacción",
  "parameters": {
    "type": "object",
    "properties": {
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
        "description": "Probabilidad de recomendar (NPS) del 1 al 10"
      },
      "feedback": {
        "type": "string",
        "description": "Comentarios generales del cliente"
      },
      "improvement_suggestions": {
        "type": "string",
        "description": "Sugerencias de mejora del cliente"
      },
      "positive_aspects": {
        "type": "string",
        "description": "Aspectos positivos mencionados por el cliente"
      }
    },
    "required": ["satisfaction_rating", "recommendation_score"]
  }
}
```

### Paso 3: Actualizar el Prompt del Agente

En la configuración del agente en ElevenLabs, agregar instrucciones para usar el tool:

#### Para Recordatorio de Pago:
```
Al final de la llamada, DEBES usar la función collect_payment_data para guardar:
- El email del cliente
- Su número de teléfono (si es diferente al que llamaste)
- El monto de deuda que confirmó
- La fecha en que se compromete a pagar

Ejemplo de uso:
Cliente: "Mi email es juan@gmail.com"
Tú: "Perfecto, confirmo tu email: juan@gmail.com"
[Internamente llamas a collect_payment_data con {email: "juan@gmail.com"}]
```

#### Para Bienvenida:
```
Al final de la llamada, DEBES usar la función collect_welcome_data para guardar:
- El email del cliente
- Su teléfono preferido
- Su método de contacto preferido (whatsapp, email o phone)

Pregunta: "¿Prefieres que te contactemos por WhatsApp, email o llamada?"
```

#### Para Encuesta:
```
Durante la encuesta, DEBES usar la función collect_survey_data para guardar:
- La calificación de satisfacción (1-10)
- El score de recomendación NPS (1-10)
- Los comentarios del cliente
- Sugerencias de mejora (si las menciona)

Asegúrate de hacer TODAS las preguntas antes de finalizar.
```

## 🔧 Alternativa: Usar Client Tools (Más Simple)

Si Custom Tools es complejo, ElevenLabs también soporta **Client Tools** que son más simples:

### Configuración en el Agente:

```json
{
  "client_tools": [
    {
      "name": "save_customer_data",
      "description": "Guarda los datos del cliente",
      "url": "https://tu-backend.com/api/saas/voice-campaigns/tools/save-data/{conversation_id}",
      "method": "POST",
      "speak_on_send": true,
      "speak_on_receive": false
    }
  ]
}
```

### Instrucción en el Prompt:

```
Cuando el cliente te dé su email, teléfono o cualquier dato, usa la función save_customer_data 
enviando un JSON con los datos:

{
  "email": "cliente@example.com",
  "phone": "3001234567",
  "satisfaction_rating": 9
}
```

## 🎯 Implementación Recomendada (La Más Robusta)

### Opción A: Usar ElevenLabs Custom Tools (Recomendado)

**Ventajas:**
- ✅ Datos estructurados automáticamente
- ✅ Validación de tipos
- ✅ ElevenLabs maneja el parsing
- ✅ Más confiable

**Desventajas:**
- ⚠️ Requiere configuración en ElevenLabs
- ⚠️ Necesita endpoint webhook en backend

### Opción B: Extracción desde Transcript (Actual)

**Ventajas:**
- ✅ No requiere configuración adicional
- ✅ Ya está implementado
- ✅ Funciona con el código actual

**Desventajas:**
- ⚠️ Depende de patrones regex
- ⚠️ Puede fallar si el cliente no dice exactamente el formato
- ⚠️ Menos confiable

## 💡 Solución Híbrida (Mejor de Ambos Mundos)

Combinar ambos métodos:

1. **Configurar Custom Tools en ElevenLabs** para datos críticos
2. **Mantener extracción por regex** como fallback
3. **Priorizar datos del tool** sobre datos extraídos

### Implementación:

```php
// En receiveElevenLabsWebhook, después de línea 350

// 1. Primero intentar obtener datos del tool call
$toolData = data_get($payload, 'data.tool_calls') ?? [];
if (!empty($toolData)) {
    foreach ($toolData as $toolCall) {
        if ($toolCall['name'] === 'collect_payment_data') {
            $meta['collected_data'] = array_merge(
                $meta['collected_data'] ?? [],
                $toolCall['parameters'] ?? []
            );
        }
    }
}

// 2. Luego extraer desde transcript como fallback
$collected = $this->extractCollectedData($fullTranscriptText, $allowed);
if (!empty($collected)) {
    // Merge sin sobrescribir datos del tool
    $meta['collected_data'] = array_merge($collected, $meta['collected_data'] ?? []);
}
```

## 🚀 Próximos Pasos

### Inmediato (Para que funcione YA):

1. **Ir a ElevenLabs Dashboard**
2. **Configurar Custom Tools** para cada agente
3. **Actualizar el prompt** del agente con instrucciones de uso del tool
4. **Probar con una llamada de prueba**

### Opcional (Mejorar robustez):

1. Crear endpoint `/api/saas/voice-campaigns/tools/collect-data/{conversation_id}`
2. Implementar lógica híbrida (tool + regex)
3. Agregar validación de datos recibidos

## 📞 Ejemplo de Configuración Completa en ElevenLabs

### Agente: Sofia - Recordatorio de Pago

**System Prompt:**
```
Eres Sofia, asesora de GURO Seguros. Tu objetivo es recordar pagos pendientes.

Al final de la llamada, DEBES recolectar:
1. Email del cliente
2. Teléfono (si es diferente)
3. Monto de deuda confirmado

Usa la función collect_payment_data para guardar estos datos.

Formato de conversación:
- Saluda y presenta el motivo
- Explica el monto y fecha
- Pregunta cuándo puede pagar
- Recolecta datos usando collect_payment_data
- Confirma envío de enlace por WhatsApp
```

**Custom Tool:**
```json
{
  "name": "collect_payment_data",
  "description": "Guarda los datos del cliente",
  "parameters": {
    "type": "object",
    "properties": {
      "email": {"type": "string"},
      "phone": {"type": "string"},
      "debt_amount": {"type": "number"}
    }
  },
  "webhook_url": "https://api.guro.app/api/saas/voice-campaigns/tools/collect-data/{conversation_id}"
}
```

## ✅ Verificación

Para verificar que funciona:

1. Hacer una llamada de prueba
2. Revisar los logs del webhook
3. Consultar `call_metadata.collected_data` en la BD
4. Verificar que los datos aparezcan en el historial de llamadas

Si necesitas ayuda con la configuración específica en ElevenLabs, puedo crear los endpoints necesarios en el backend.