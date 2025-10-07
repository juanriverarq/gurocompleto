# Configuración de Agentes en ElevenLabs

## ❌ Error Solucionado: "The AI agent you are trying to reach does not exist"

Este error ocurre porque estás intentando usar un agente con ID `agent-0` que no existe en tu cuenta de ElevenLabs. Los agentes deben crearse directamente en la plataforma de ElevenLabs.

## 🔧 Solución Implementada

### 1. Actualización del Servicio
- ✅ Modificado `getConversationalAgents()` para obtener agentes reales de ElevenLabs
- ✅ Agregado fallback con agentes válidos si no se encuentran agentes reales
- ✅ Habilitada la creación de agentes de prueba directamente desde la aplicación

### 2. Agentes de Fallback
Si no tienes agentes en ElevenLabs, el sistema usará estos agentes de fallback:
- **ID**: `default-agent` - Marcela - Cobranza
- **ID**: `fallback-agent` - Marcela - Cobranza (Fallback)

## 🚀 Cómo Crear Agentes Reales en ElevenLabs

### Opción 1: Crear desde la Aplicación (Recomendado)
1. Ve a la sección "Gestión de Agentes"
2. Haz clic en "Crear Agente"
3. El sistema creará automáticamente un agente de prueba en ElevenLabs
4. Usa el ID del agente creado para las llamadas

### Opción 2: Crear Directamente en ElevenLabs
1. Ve a [ElevenLabs Conversational AI](https://elevenlabs.io/conversational-ai)
2. Inicia sesión con tu cuenta Business
3. Haz clic en "Create Agent"
4. Configura el agente:
   - **Nombre**: Marcela - Cobranza
   - **Voz**: Marcela Colombia Girl (ID: `86V9x9hrQds83qf7zaGn`)
   - **Prompt del Sistema**: 
     ```
     Eres Marcela, una agente especializada en cobranzas de seguros. Tu objetivo es contactar a clientes con pagos pendientes de manera profesional, amigable pero firme. Debes ser clara sobre los montos adeudados, fechas de vencimiento y opciones de pago disponibles.
     ```
   - **Primer Mensaje**: "Hola, soy Marcela de la oficina de cobranzas. ¿Podría hablar con [nombre del cliente]?"
   - **Idioma**: Español (es)

5. Guarda el agente y copia su ID
6. Usa ese ID real en las llamadas

## 📋 Configuración Recomendada del Agente

```json
{
  "name": "Agente de Seguros",
  "voice": {
    "voice_id": "86V9x9hrQds83qf7zaGn",
    "stability": 0.7,
    "similarity_boost": 0.8,
    "style": 0.2,
    "use_speaker_boost": true
  },
  "conversation_config": {
    "agent_prompt": "Eres un asistente virtual especializado en seguros. Ayuda a los clientes con sus consultas de manera profesional y amigable.",
    "first_message": "Hola, soy tu asistente de seguros. ¿En qué puedo ayudarte hoy?",
    "language": "es"
  }
}
```

## 🔍 Verificación de Agentes

Para verificar que tus agentes existen:

1. **Desde la aplicación**: Ve a "Gestión de Agentes" y haz clic en "Actualizar"
2. **Desde la API**: El sistema automáticamente verificará los agentes disponibles
3. **Logs de consola**: Revisa los logs para ver qué agentes se encontraron

## 🧪 Prueba de Llamadas

Una vez que tengas agentes reales:

1. Ve a "Gestión de Agentes"
2. Selecciona un agente con ID real
3. Ingresa un número de teléfono de prueba
4. Haz clic en "Probar Llamada"
5. El sistema usará el agente real para la llamada

## 🔄 Flujo de Fallback

El sistema funciona con este flujo:
1. **Primero**: Intenta obtener agentes reales de ElevenLabs
2. **Segundo**: Si no hay agentes, usa agentes de fallback válidos
3. **Tercero**: Si falla todo, usa simulación

## 📞 Próximos Pasos

1. **Crear Agente Real**: Usa el botón "Crear Agente" en la aplicación
2. **Configurar Twilio**: Asegúrate de que Twilio esté configurado en ElevenLabs
3. **Probar Llamadas**: Usa números reales para probar
4. **Monitorear**: Revisa los logs para verificar que todo funciona

## 🔧 Troubleshooting

### Si sigues viendo el error:
1. Verifica que tu API key de ElevenLabs sea válida
2. Asegúrate de tener una cuenta Business activa
3. Crea al menos un agente en ElevenLabs
4. Usa el ID exacto del agente creado

### Logs útiles:
- `🤖 Obteniendo agentes de ElevenLabs...`
- `✅ Agentes obtenidos de ElevenLabs: X`
- `⚠️ No se encontraron agentes reales, creando agentes de fallback...`

Con estas configuraciones, las llamadas deberían funcionar correctamente usando agentes reales de ElevenLabs. 