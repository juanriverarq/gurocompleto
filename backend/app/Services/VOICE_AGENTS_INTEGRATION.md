# Integración de Nuevos Agentes de Voz - Backend

## 📋 Resumen

Se han creado **3 servicios auxiliares** para extender las capacidades del sistema de campañas de voz sin modificar el controlador principal que ya funciona correctamente.

## 🎯 Servicios Creados

### 1. VoiceAgentPrompts.php
**Propósito:** Generar prompts conversacionales específicos para cada tipo de campaña

**Métodos principales:**
- `detectCampaignType(array $contact): string` - Detecta el tipo de campaña por los datos del contacto
- `generateDynamicVariables(string $campaignType, array $contact): array` - Genera variables dinámicas
- `generatePromptAndFirstMessage(...)` - Genera prompt y primer mensaje personalizado

**Tipos soportados:**
- `payment_reminder` - Recordatorio de pago
- `customer_welcome` - Bienvenida al cliente
- `satisfaction_survey` - Encuesta de satisfacción

### 2. VoiceAgentWhatsAppService.php
**Propósito:** Manejar envío de mensajes de WhatsApp post-llamada según tipo de campaña

**Métodos principales:**
- `sendPostCallMessage(...)` - Envía mensaje según tipo de campaña
- `sendPaymentLink(...)` - Envía enlace de pago (payment_reminder)
- `sendWelcomeMessage(...)` - Envía mensaje de bienvenida (customer_welcome)
- `sendSurveyThankYou(...)` - Envía agradecimiento (satisfaction_survey)

### 3. VoiceAgentDataExtractor.php
**Propósito:** Extraer datos específicos de transcripciones según tipo de campaña

**Métodos principales:**
- `extractFieldByType(...)` - Extrae campos específicos usando patrones regex
- `getDefaultCollectFields(string $campaignType): array` - Obtiene configuración por defecto

**Campos nuevos soportados:**
- `satisfaction_rating` - Calificación 1-10
- `recommendation_score` - NPS 1-10
- `feedback` - Comentarios generales
- `improvement_suggestions` - Sugerencias de mejora
- `positive_aspects` - Aspectos positivos
- `preferred_contact_method` - Método de contacto preferido

## 🔧 Cómo Integrar con VoiceCampaignController

### Opción 1: Uso Directo en el Controlador (Recomendado)

Agregar al inicio del controlador:

```php
use App\Services\VoiceAgentPrompts;
use App\Services\VoiceAgentWhatsAppService;
use App\Services\VoiceAgentDataExtractor;
```

### Modificar método `makeElevenLabsCall`:

```php
// Detectar tipo de campaña
$campaignType = $campaignType ?? VoiceAgentPrompts::detectCampaignType($contact);

// Generar variables dinámicas
$dynamicVars = VoiceAgentPrompts::generateDynamicVariables($campaignType, $contact);

// Generar prompt y primer mensaje
[$finalPrompt, $personalizedFirstMessage] = VoiceAgentPrompts::generatePromptAndFirstMessage(
    $campaignType,
    $agentDisplayName,
    $safeCompany,
    $customerName,
    $policyNumber,
    $message,
    $collectInstruction,
    $dynamicVars
);
```

### Modificar método `handlePostCallWhatsApp`:

```php
// Detectar tipo de campaña
$campaignType = is_array($campaign->settings) ? ($campaign->settings['campaign_type'] ?? null) : null;
if (!$campaignType) {
    $firstContact = is_array($campaign->contacts) && !empty($campaign->contacts) ? $campaign->contacts[0] : [];
    $campaignType = VoiceAgentPrompts::detectCampaignType($firstContact);
}

// Enviar mensaje según tipo
$success = VoiceAgentWhatsAppService::sendPostCallMessage(
    $campaignType,
    (int) $call->broker_id,
    $waPhone,
    $customerName,
    $reference,
    $instanceId,
    $template,
    [
        'amount_cop' => $amountCop,
        'conversation_id' => $call->elevenlabs_conversation_id,
        'collected_data' => $meta['collected_data'] ?? []
    ]
);
```

### Modificar método `extractFieldByType`:

```php
// Primero intentar con patrones estándar (código existente)
// ...código actual...

// Si no se encuentra, intentar con patrones de nuevos agentes
if (!$result) {
    $result = VoiceAgentDataExtractor::extractFieldByType($text, $fieldType, $customPattern, $confidence);
}

return $result;
```

## 📊 Configuración de Campañas desde Frontend

### Ejemplo: Crear Campaña de Bienvenida

```typescript
import { createCustomerWelcomeCampaign } from './voiceCampaignHelper';
import voiceCampaignService from './voiceCampaignService';

const campaign = createCustomerWelcomeCampaign({
  campaignName: 'Bienvenida Enero 2024',
  contacts: [{
    name: 'María García',
    phone: '+573009876543',
    email: 'maria@example.com',
    policy_number: 'POL-2024-002',
    insurance_type: 'Seguro de Vida',
    start_date: '2024-01-15'
  }],
  agentId: 'agent-customer-welcome',
  agentName: 'Ana',
  companyName: 'GURO Seguros'
});

// El helper automáticamente agrega:
// - campaign_type: 'customer_welcome' en settings
// - post_call_tools con configuración de WhatsApp y email
// - collect fields específicos para bienvenida

const result = await voiceCampaignService.createImmediateVoiceCampaign(campaign);
```

## 🔄 Flujo de Ejecución

### 1. Creación de Campaña
```
Frontend → createCustomerWelcomeCampaign() → 
  Agrega campaign_type en settings → 
  POST /api/saas/voice-campaigns/immediate
```

### 2. Ejecución de Llamada
```
VoiceCampaignController::executeVoiceCampaign() →
  makeElevenLabsCall() →
    VoiceAgentPrompts::detectCampaignType() →
    VoiceAgentPrompts::generateDynamicVariables() →
    VoiceAgentPrompts::generatePromptAndFirstMessage() →
  ElevenLabs API Call
```

### 3. Webhook Post-Llamada
```
ElevenLabs Webhook →
  VoiceCampaignController::receiveElevenLabsWebhook() →
    extractCollectedData() →
      VoiceAgentDataExtractor::extractFieldByType() →
    handlePostCallWhatsApp() →
      VoiceAgentWhatsAppService::sendPostCallMessage()
```

## ✅ Ventajas de esta Arquitectura

1. **No modifica código existente** - El controlador principal sigue funcionando
2. **Extensible** - Fácil agregar nuevos tipos de agentes
3. **Mantenible** - Lógica separada por responsabilidad
4. **Testeable** - Servicios independientes fáciles de probar
5. **Reutilizable** - Los servicios pueden usarse en otros contextos

## 🚀 Próximos Pasos

### 1. Integrar Servicios en el Controlador

Modificar `VoiceCampaignController.php` para usar los nuevos servicios:

```php
// Al inicio del archivo
use App\Services\VoiceAgentPrompts;
use App\Services\VoiceAgentWhatsAppService;
use App\Services\VoiceAgentDataExtractor;
```

### 2. Actualizar método makeElevenLabsCall

Reemplazar la generación de prompt hardcodeada con:

```php
$campaignType = $campaignType ?? VoiceAgentPrompts::detectCampaignType($contact);
$dynamicVars = VoiceAgentPrompts::generateDynamicVariables($campaignType, $contact);
[$finalPrompt, $personalizedFirstMessage] = VoiceAgentPrompts::generatePromptAndFirstMessage(
    $campaignType, $agentDisplayName, $safeCompany, $customerName, 
    $policyNumber, $message, $collectInstruction, $dynamicVars
);
```

### 3. Actualizar método handlePostCallWhatsApp

Reemplazar lógica de envío con:

```php
$campaignType = VoiceAgentPrompts::detectCampaignType($firstContact);
$success = VoiceAgentWhatsAppService::sendPostCallMessage(
    $campaignType, $call->broker_id, $waPhone, $customerName,
    $reference, $instanceId, $template, $metadata
);
```

### 4. Actualizar método extractFieldByType

Agregar al final del switch:

```php
default:
    return VoiceAgentDataExtractor::extractFieldByType($text, $fieldType, $customPattern, $confidence);
```

## 📝 Variables de Entorno Requeridas

Agregar al `.env`:

```env
# Configuración de Agentes de Voz
APP_LINK=https://app.guro.com
SUPPORT_PHONE=+57 300 123 4567
DEFAULT_COMPANY_NAME=GURO Seguros
```

## 🧪 Testing

```bash
# Verificar sintaxis PHP
php -l backend/app/Services/VoiceAgentPrompts.php
php -l backend/app/Services/VoiceAgentWhatsAppService.php
php -l backend/app/Services/VoiceAgentDataExtractor.php

# Ejecutar tests (si existen)
php artisan test --filter VoiceAgent
```

## 📚 Documentación Relacionada

- Frontend: `frontend/src/services/VOICE_AGENTS_README.md`
- Guía de uso: `frontend/src/services/VOICE_CAMPAIGNS_GUIDE.md`
- Ejemplos: `frontend/src/services/voiceCampaignExamples.ts`

## 🎉 Estado

✅ **Servicios creados y listos para integrar**
✅ **Frontend configurado con templates y helpers**
✅ **Documentación completa**

⏳ **Pendiente:** Integrar servicios en VoiceCampaignController.php

---

**Nota:** Los servicios están diseñados para ser drop-in replacements que no rompen la funcionalidad existente. Se pueden integrar gradualmente.