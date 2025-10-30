# Guía de Uso: Campañas de Voz con Agentes IA

Esta guía explica cómo usar los nuevos agentes de voz para crear campañas automatizadas.

## Tipos de Campañas Disponibles

### 1. Recordatorio de Pago de Seguro
Agente especializado en recordar a clientes sobre pagos pendientes y facilitar el proceso de pago.

**Características:**
- Saludo personalizado con nombre del cliente
- Información clara sobre monto y fecha de vencimiento
- Envío automático de enlace de pago por WhatsApp
- Recolección de datos de contacto actualizados

### 2. Bienvenida al Cliente
Agente para dar la bienvenida a nuevos clientes y explicar los beneficios de su póliza.

**Características:**
- Tono cálido y acogedor
- Explicación de beneficios principales
- Verificación de datos de contacto
- Envío de información por WhatsApp y email
- Orientación sobre canales de atención

### 3. Encuesta de Satisfacción
Agente para recopilar feedback y medir la satisfacción del cliente.

**Características:**
- Tono empático y profesional
- Preguntas estructuradas (NPS, satisfacción, feedback)
- Escucha activa y profundización en respuestas
- Detección de problemas para escalamiento
- Envío de agradecimiento por email

## Ejemplos de Uso

### Ejemplo 1: Crear Campaña de Recordatorio de Pago

```typescript
import voiceCampaignService from './voiceCampaignService';
import { createPaymentReminderCampaign } from './voiceCampaignHelper';

// Preparar datos de contactos
const contacts = [
  {
    name: 'Juan Pérez',
    phone: '+573001234567',
    email: 'juan.perez@example.com',
    policy_number: 'POL-2024-001',
    debt_amount: 125000,
    payment_due_date: '2024-12-31'
  },
  {
    name: 'María García',
    phone: '+573009876543',
    email: 'maria.garcia@example.com',
    policy_number: 'POL-2024-002',
    debt_amount: 85000,
    payment_due_date: '2024-12-28'
  }
];

// Crear campaña usando el helper
const campaignRequest = createPaymentReminderCampaign({
  campaignName: 'Recordatorio Diciembre 2024',
  contacts: contacts,
  agentId: 'agent-payment-reminder',
  agentName: 'Sofia',
  companyName: 'GURO Seguros',
  saveAsDraft: false // true para guardar como borrador
});

// Ejecutar campaña
const result = await voiceCampaignService.createImmediateVoiceCampaign(campaignRequest);

if (result.success) {
  console.log('✅ Campaña creada y ejecutada:', result.campaign);
} else {
  console.error('❌ Error:', result.message);
}
```

### Ejemplo 2: Crear Campaña de Bienvenida

```typescript
import { createCustomerWelcomeCampaign } from './voiceCampaignHelper';

const newCustomers = [
  {
    name: 'Carlos Rodríguez',
    phone: '+573005551234',
    email: 'carlos.rodriguez@example.com',
    policy_number: 'POL-2024-003',
    insurance_type: 'Seguro de Vida',
    start_date: '2024-01-15'
  }
];

const welcomeCampaign = createCustomerWelcomeCampaign({
  campaignName: 'Bienvenida Nuevos Clientes - Enero 2024',
  contacts: newCustomers,
  agentId: 'agent-customer-welcome',
  agentName: 'Ana',
  companyName: 'GURO Seguros',
  appLink: 'https://app.guro.com',
  supportPhone: '+57 300 123 4567',
  saveAsDraft: false
});

const result = await voiceCampaignService.createImmediateVoiceCampaign(welcomeCampaign);
```

### Ejemplo 3: Crear Campaña de Encuesta de Satisfacción

```typescript
import { createSatisfactionSurveyCampaign } from './voiceCampaignHelper';

const recentCustomers = [
  {
    name: 'Laura Martínez',
    phone: '+573007778888',
    email: 'laura.martinez@example.com',
    policy_number: 'POL-2024-004',
    last_service_date: '2024-01-10',
    interaction_type: 'Renovación de póliza'
  }
];

const surveyCampaign = createSatisfactionSurveyCampaign({
  campaignName: 'Encuesta Post-Renovación - Enero 2024',
  contacts: recentCustomers,
  agentId: 'agent-satisfaction-survey',
  agentName: 'Patricia',
  companyName: 'GURO Seguros',
  saveAsDraft: false
});

const result = await voiceCampaignService.createImmediateVoiceCampaign(surveyCampaign);
```

### Ejemplo 4: Validar Datos Antes de Crear Campaña

```typescript
import { validateCampaignContacts } from './voiceCampaignHelper';

const contacts = [
  {
    name: 'Juan Pérez',
    phone: '+573001234567',
    policy_number: 'POL-2024-001',
    debt_amount: 125000,
    payment_due_date: '2024-12-31'
  }
];

// Validar antes de crear
const validation = validateCampaignContacts('payment_reminder', contacts);

if (!validation.isValid) {
  console.error('❌ Errores de validación:', validation.errors);
  // Mostrar errores al usuario
} else {
  // Proceder a crear la campaña
  const campaign = createPaymentReminderCampaign({...});
}
```

### Ejemplo 5: Crear Campaña Personalizada desde Template

```typescript
import { createCampaignFromTemplate } from './voiceCampaignHelper';

const customCampaign = createCampaignFromTemplate({
  campaignType: 'customer_welcome',
  campaignName: 'Bienvenida VIP',
  contacts: [
    {
      name: 'Cliente VIP',
      phone: '+573001234567',
      email: 'vip@example.com',
      custom_data: {
        policy_number: 'VIP-001',
        insurance_type: 'Seguro Premium',
        start_date: '2024-01-20',
        vip_level: 'Gold'
      }
    }
  ],
  agentId: 'agent-customer-welcome',
  agentName: 'Sofia Premium',
  companyName: 'GURO Seguros VIP',
  defaultVariables: {
    app_link: 'https://vip.guro.com',
    support_phone: '+57 300 999 9999'
  },
  saveAsDraft: false
});
```

## Configuración de Agentes en ElevenLabs

Para que los agentes funcionen correctamente, debes configurarlos en ElevenLabs con las siguientes características:

### Agente de Recordatorio de Pago
- **Nombre:** Sofia - Recordatorio de Pago
- **Voz:** Femenina, profesional, cálida
- **Idioma:** Español (Colombia)
- **Variables dinámicas:** customer_name, policy_number, debt_amount, payment_due_date, company_name

### Agente de Bienvenida
- **Nombre:** Ana - Bienvenida
- **Voz:** Femenina, entusiasta, amigable
- **Idioma:** Español (Colombia)
- **Variables dinámicas:** customer_name, policy_number, insurance_type, start_date, company_name

### Agente de Encuesta
- **Nombre:** Patricia - Encuestas
- **Voz:** Femenina, empática, profesional
- **Idioma:** Español (Colombia)
- **Variables dinámicas:** customer_name, policy_number, last_service_date, interaction_type, company_name

## Datos Recolectados por Cada Agente

### Recordatorio de Pago
- `phone`: Teléfono actualizado del cliente
- `email`: Email actualizado
- `debt_amount`: Confirmación del monto adeudado

### Bienvenida al Cliente
- `email`: Email del cliente
- `phone`: Teléfono de contacto
- `preferred_contact_method`: Método preferido (WhatsApp, email, llamada)

### Encuesta de Satisfacción
- `satisfaction_rating`: Calificación de 1-10
- `recommendation_score`: NPS (1-10)
- `feedback`: Comentarios generales
- `improvement_suggestions`: Sugerencias de mejora
- `positive_aspects`: Aspectos positivos mencionados

## Acciones Post-Llamada

### Recordatorio de Pago
- ✅ Envío automático de enlace de pago por WhatsApp
- ✅ Registro de datos recolectados
- ✅ Actualización de estado de póliza

### Bienvenida al Cliente
- ✅ Envío de información de bienvenida por WhatsApp
- ✅ Envío de email con documentación
- ✅ Registro de preferencias de contacto

### Encuesta de Satisfacción
- ✅ Envío de email de agradecimiento
- ✅ Registro de feedback en sistema
- ✅ Alerta si calificación < 7 (para seguimiento)

## Mejores Prácticas

1. **Horarios de Llamada:** Configura las campañas para ejecutarse en horario laboral (9:00 - 18:00)

2. **Personalización:** Siempre incluye el nombre del cliente y datos específicos de su póliza

3. **Validación:** Valida los datos de contacto antes de crear la campaña

4. **Pruebas:** Usa `saveAsDraft: true` para revisar la configuración antes de ejecutar

5. **Seguimiento:** Revisa el historial de llamadas para identificar mejoras

6. **Feedback:** Analiza las transcripciones para optimizar los prompts

## Monitoreo y Análisis

```typescript
// Obtener estadísticas de campañas
const stats = await voiceCampaignService.getVoiceCampaignStats();
console.log('Estadísticas:', stats);

// Obtener historial de llamadas
const history = await voiceCampaignService.getCallHistory({
  campaign_id: 123,
  status: 'completed',
  limit: 50
});
console.log('Historial:', history);

// Obtener datos enriquecidos (incluye transcripciones y análisis)
const enrichedHistory = await voiceCampaignService.getHybridCallHistory({
  campaign_id: 123,
  limit: 50
});
console.log('Datos enriquecidos:', enrichedHistory);
```

## Solución de Problemas

### Error: "No se pudo enviar WhatsApp"
- Verifica que el servicio de WhatsApp esté activo
- Confirma que hay una instancia conectada
- Revisa el formato del número de teléfono (+57...)

### Error: "Variables faltantes"
- Asegúrate de incluir todos los campos requeridos en custom_data
- Usa la función `validateCampaignContacts` antes de crear

### Llamadas no se completan
- Verifica la configuración del agente en ElevenLabs
- Confirma que el agentId es correcto
- Revisa los logs del backend para más detalles

## Soporte

Para más información o soporte, contacta al equipo de desarrollo.