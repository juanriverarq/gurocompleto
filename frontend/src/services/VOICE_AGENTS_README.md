# Sistema de Agentes de Voz - Documentación Completa

## 📋 Resumen

Se han implementado exitosamente **3 agentes de voz especializados** para automatizar comunicaciones con clientes:

1. **Recordatorio de Pago de Seguro** ✅ (Ya funcionaba)
2. **Bienvenida al Cliente** ✅ (Nuevo)
3. **Encuesta de Satisfacción** ✅ (Nuevo)

## 🎯 Características Principales

### Agente 1: Recordatorio de Pago de Seguro
- **Propósito:** Recordar pagos pendientes y facilitar el proceso de pago
- **Personalidad:** Amable, directa y resolutiva
- **Acciones Post-Llamada:**
  - ✅ Envío automático de enlace de pago por WhatsApp
  - ✅ Recolección de datos de contacto actualizados
  - ✅ Registro de compromisos de pago

### Agente 2: Bienvenida al Cliente (NUEVO)
- **Propósito:** Dar la bienvenida a nuevos clientes y explicar beneficios
- **Personalidad:** Cálida, entusiasta y servicial
- **Acciones Post-Llamada:**
  - ✅ Envío de información de bienvenida por WhatsApp
  - ✅ Envío de email con documentación completa
  - ✅ Registro de preferencias de contacto
  - ✅ Orientación sobre canales de atención

### Agente 3: Encuesta de Satisfacción (NUEVO)
- **Propósito:** Recopilar feedback y medir satisfacción del cliente
- **Personalidad:** Empática, profesional y orientada a escuchar
- **Acciones Post-Llamada:**
  - ✅ Envío de email de agradecimiento
  - ✅ Registro de feedback en sistema
  - ✅ Alerta automática si calificación < 7
  - ✅ Escalamiento de problemas detectados

## 📁 Archivos Creados

### 1. `voiceAgentsService.ts` (Actualizado)
Define los tipos de agentes disponibles y sus configuraciones base.

```typescript
export interface VoiceAgent {
  id: string;
  name: string;
  type: 'payment_reminder' | 'customer_welcome' | 'satisfaction_survey' | ...;
  description?: string;
  campaignType?: string;
  collectFields?: string[];
  postCallActions?: {...};
}
```

### 2. `voiceCampaignTemplates.ts` (Nuevo)
Contiene los templates completos para cada tipo de campaña:
- Prompts conversacionales optimizados
- Flujos de conversación estructurados
- Configuración de recolección de datos
- Templates de mensajes post-llamada

### 3. `voiceCampaignHelper.ts` (Nuevo)
Funciones helper para facilitar la creación de campañas:
- `createPaymentReminderCampaign()`
- `createCustomerWelcomeCampaign()`
- `createSatisfactionSurveyCampaign()`
- `validateCampaignContacts()`
- `getExampleCampaignConfig()`

### 4. `voiceCampaignExamples.ts` (Nuevo)
Ejemplos prácticos listos para ejecutar:
- `examplePaymentReminder()`
- `exampleCustomerWelcome()`
- `exampleSatisfactionSurvey()`
- `exampleGetStats()`
- `exampleGetCallHistory()`

### 5. `VOICE_CAMPAIGNS_GUIDE.md` (Nuevo)
Guía completa de uso con ejemplos detallados.

## 🚀 Cómo Usar

### Opción 1: Usar Funciones Helper (Recomendado)

```typescript
import { createCustomerWelcomeCampaign } from './voiceCampaignHelper';
import voiceCampaignService from './voiceCampaignService';

// Preparar datos
const newCustomers = [
  {
    name: 'María García',
    phone: '+573009876543',
    email: 'maria@example.com',
    policy_number: 'POL-2024-002',
    insurance_type: 'Seguro de Vida',
    start_date: '2024-01-15'
  }
];

// Crear campaña
const campaign = createCustomerWelcomeCampaign({
  campaignName: 'Bienvenida Enero 2024',
  contacts: newCustomers,
  agentId: 'agent-customer-welcome',
  agentName: 'Ana',
  companyName: 'GURO Seguros'
});

// Ejecutar
const result = await voiceCampaignService.createImmediateVoiceCampaign(campaign);
```

### Opción 2: Usar Ejemplos Pre-configurados

```typescript
import voiceCampaignExamples from './voiceCampaignExamples';

// Ejecutar ejemplo de bienvenida
await voiceCampaignExamples.exampleCustomerWelcome();

// Ejecutar ejemplo de encuesta
await voiceCampaignExamples.exampleSatisfactionSurvey();

// Ver estadísticas
await voiceCampaignExamples.exampleGetStats();
```

## 📊 Datos Recolectados

### Recordatorio de Pago
- `phone`: Teléfono actualizado
- `email`: Email actualizado
- `debt_amount`: Confirmación del monto

### Bienvenida al Cliente
- `email`: Email del cliente
- `phone`: Teléfono de contacto
- `preferred_contact_method`: Método preferido (WhatsApp/email/llamada)

### Encuesta de Satisfacción
- `satisfaction_rating`: Calificación 1-10
- `recommendation_score`: NPS 1-10
- `feedback`: Comentarios generales
- `improvement_suggestions`: Sugerencias
- `positive_aspects`: Aspectos positivos

## 🎨 Personalización de Prompts

Cada agente tiene un prompt optimizado que incluye:

1. **Personality:** Define el carácter del agente
2. **Environment:** Contexto de la llamada
3. **Tone:** Estilo de comunicación
4. **Goal:** Objetivo principal de la llamada
5. **Guardrails:** Reglas de comportamiento

Ejemplo de estructura:

```
# Personality
Eres Ana, una asesora de bienvenida de GURO Seguros...

# Environment
Estás realizando una llamada de bienvenida a un nuevo cliente...

# Tone
Mantén un tono cálido y acogedor...

# Goal
Tu objetivo es dar la bienvenida al cliente...

# Guardrails
- Sé cálida y acogedora
- No abrumes con información técnica
- Escucha activamente
```

## 🔧 Configuración en ElevenLabs

Para cada agente, configura en ElevenLabs:

### Variables Dinámicas Requeridas

**Recordatorio de Pago:**
- customer_name
- policy_number
- debt_amount
- payment_due_date
- company_name

**Bienvenida al Cliente:**
- customer_name
- policy_number
- insurance_type
- start_date
- company_name
- app_link
- support_phone

**Encuesta de Satisfacción:**
- customer_name
- policy_number
- last_service_date
- interaction_type
- company_name

## ✅ Validación de Datos

Antes de crear una campaña, valida los datos:

```typescript
import { validateCampaignContacts } from './voiceCampaignHelper';

const validation = validateCampaignContacts('customer_welcome', contacts);

if (!validation.isValid) {
  console.error('Errores:', validation.errors);
  // Mostrar errores al usuario
} else {
  // Proceder a crear campaña
}
```

## 📈 Monitoreo y Análisis

```typescript
// Obtener estadísticas generales
const stats = await voiceCampaignService.getVoiceCampaignStats();

// Obtener historial de llamadas
const history = await voiceCampaignService.getCallHistory({
  campaign_id: 123,
  status: 'completed',
  limit: 50
});

// Obtener datos enriquecidos con transcripciones
const enriched = await voiceCampaignService.getHybridCallHistory({
  campaign_id: 123
});
```

## 🎯 Mejores Prácticas

1. **Horarios:** Ejecuta campañas entre 9:00 - 18:00
2. **Personalización:** Siempre incluye nombre y datos específicos
3. **Validación:** Valida datos antes de ejecutar
4. **Pruebas:** Usa `saveAsDraft: true` para revisar primero
5. **Seguimiento:** Revisa transcripciones para optimizar
6. **Feedback:** Analiza resultados para mejorar prompts

## 🔍 Troubleshooting

### Error: "Variables faltantes"
**Solución:** Asegúrate de incluir todos los campos requeridos en `custom_data`

### Error: "No se pudo enviar WhatsApp"
**Solución:** 
- Verifica que el servicio de WhatsApp esté activo
- Confirma que hay una instancia conectada
- Revisa el formato del número (+57...)

### Llamadas no se completan
**Solución:**
- Verifica configuración del agente en ElevenLabs
- Confirma que el agentId es correcto
- Revisa logs del backend

## 📞 Soporte

Para más información:
- Ver: `VOICE_CAMPAIGNS_GUIDE.md` para guía detallada
- Ver: `voiceCampaignExamples.ts` para ejemplos ejecutables
- Contactar: Equipo de desarrollo

## 🎉 Estado del Proyecto

✅ **Completado:**
- [x] Análisis de estructura del agente de Recordatorio de Pago
- [x] Diseño de prompt para Bienvenida al Cliente
- [x] Diseño de prompt para Encuesta de Satisfacción
- [x] Configuración de agentes en voiceAgentsService.ts
- [x] Templates de campaña para Bienvenida al Cliente
- [x] Templates de campaña para Encuesta de Satisfacción
- [x] Configuración de herramientas post-llamada
- [x] Documentación completa y ejemplos

🚀 **Listo para usar en producción**

## 📝 Notas Importantes

1. Los agentes están diseñados para español de Colombia
2. Todos los prompts siguen las mejores prácticas de ElevenLabs
3. La recolección de datos usa formato estructurado "campo: valor"
4. Las acciones post-llamada son configurables por campaña
5. El sistema es extensible para agregar más tipos de agentes

---

**Última actualización:** 2024-01-20
**Versión:** 1.0.0
**Autor:** Equipo de Desarrollo GURO