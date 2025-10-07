# 📞 Troubleshooting de Llamadas Telefónicas Reales

## 🔍 Problema Identificado

**Error:** "No user message received for 60 seconds - the websocket connection was closed, or a network error occurred."

**Causa:** La llamada se inicia en ElevenLabs pero no llega al teléfono real del usuario.

## ✅ Soluciones Implementadas

### 1. **Enfoque Híbrido Mejorado**
El sistema ahora utiliza múltiples métodos en orden de prioridad:

1. **Batch Calling API** (método oficial para llamadas telefónicas)
2. **API REST de conversaciones** (con configuración telefónica)
3. **WebSocket** (método alternativo)
4. **Simulación** (fallback final)

### 2. **Diagnóstico Completo**
- Nueva función `checkPhoneCallCapabilities()`
- Verificación de soporte de llamadas telefónicas
- Validación de configuración de Twilio
- Detección de números telefónicos disponibles

## 🛠️ Configuración Requerida en ElevenLabs

### Paso 1: Cuenta Business
- ✅ Necesitas una cuenta **Business** de ElevenLabs ($1,320/año)
- ❌ Las cuentas gratuitas/Creator NO soportan llamadas telefónicas

### Paso 2: Configurar Twilio
1. Ve a tu dashboard de ElevenLabs
2. Navega a **Conversational AI** → **Phone Numbers**
3. Conecta tu cuenta de Twilio:
   - Account SID
   - Auth Token
   - Número de teléfono

### Paso 3: Configurar Agente
1. Ve a **Conversational AI** → **Agents**
2. Edita tu agente
3. Habilita **Phone Call Support**
4. Asigna un número telefónico

## 🧪 Cómo Probar

### 1. Ejecutar Diagnóstico
```bash
# En la aplicación
1. Ve a "Gestión de Agentes"
2. Haz clic en "Diagnosticar Twilio"
3. Revisa el resultado detallado
```

### 2. Verificar Configuración
El diagnóstico te mostrará:
- ✅/❌ **Soporte de llamadas telefónicas**
- ✅/❌ **Configuración de Twilio**
- 📞 **Números telefónicos disponibles**
- 🤖 **Agentes configurados para llamadas**

### 3. Probar Llamada Real
```bash
1. Si todo está configurado ✅
2. Ingresa un número de teléfono real
3. Haz clic en "Probar Llamada"
4. El sistema intentará múltiples métodos automáticamente
```

## 🔧 Endpoints Utilizados

### 1. Batch Calling API (Principal)
```
POST /v1/convai/batch-calls
```
- Método oficial para llamadas telefónicas
- Soporte para llamadas salientes
- Integración con Twilio automática

### 2. Conversaciones API (Alternativo)
```
POST /v1/convai/conversations
```
- Con `phone_call_config` específico
- Configuración de agente personalizada

### 3. WebSocket (Fallback)
```
WSS /v1/convai/conversation
```
- Para conversaciones en tiempo real
- Requiere configuración manual de Twilio

## 📋 Checklist de Verificación

- [ ] **Cuenta Business** de ElevenLabs activa
- [ ] **Twilio configurado** en ElevenLabs
- [ ] **Número telefónico** asignado al agente
- [ ] **Agente** con configuración de llamadas habilitada
- [ ] **API Key** válida y con permisos
- [ ] **Diagnóstico** ejecutado exitosamente

## 🚨 Errores Comunes

### 1. Error 400: "default-voice"
**Causa:** Agente sin voice ID válido  
**Solución:** El sistema ahora busca automáticamente voces disponibles

### 2. Error 404: Endpoint no encontrado
**Causa:** Endpoint incorrecto para llamadas  
**Solución:** Implementados múltiples endpoints oficiales

### 3. Error 403: Sin permisos
**Causa:** Cuenta sin capacidades de llamadas  
**Solución:** Upgrader a cuenta Business

### 4. WebSocket se cierra inmediatamente
**Causa:** No hay configuración de Twilio  
**Solución:** Configurar Twilio en ElevenLabs

## 📞 Resultado Esperado

### ✅ Llamada Exitosa
```bash
📞 Número: +573227697874
🤖 Agente: agent_01k02pehqgfywb54fz2z8ts74h
✅ Llamada telefónica iniciada exitosamente via Batch Calling
📱 El teléfono debería sonar en ~5-10 segundos
```

### ❌ Llamada Fallida
```bash
❌ Error: Sin configuración de Twilio
🔧 Acción: Configurar Twilio en ElevenLabs
📞 Fallback: Usar simulación hasta configurar
```

## 🔗 Enlaces Útiles

- [ElevenLabs Conversational AI](https://elevenlabs.io/conversational-ai)
- [Documentación de Twilio Integration](https://elevenlabs.io/docs/conversational-ai/phone-numbers/twilio-integration)
- [API Reference - Batch Calling](https://elevenlabs.io/docs/api-reference/conversational-ai/batch-calling)
- [Troubleshooting Guide](https://elevenlabs.io/docs/conversational-ai/troubleshooting)

---

**Última actualización:** Enero 2025  
**Estado:** ✅ Implementado y funcionando 