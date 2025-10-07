# Ejemplo de Personalización de Contenido para Campañas de Voz

## Nueva Implementación (Personalización en Frontend) 

### ✅ **ANTES**: Plantillas con Variables
```
SISTEMA PROMPT ORIGINAL:
Eres Sofia, agente especializada en seguros de {{company_name}}.
Estás contactando a {{customer_name}} para seguimiento de su póliza {{policy_number}}.
Debes ser profesional, amable y ayudar con renovaciones o pagos pendientes.
El cliente tiene una deuda de {{debt_amount}} con vencimiento {{payment_due_date}}.

FIRST MESSAGE ORIGINAL:
Hola {{customer_name}}, soy {{agent_name}} de {{company_name}}.
Te llamo porque tenemos registrado un pago pendiente de tu póliza {{policy_number}}
por valor de {{debt_amount}} pesos. ¿Podrías confirmarme si ya realizaste este pago?
```

### ✅ **DESPUÉS**: Contenido Ya Personalizado
```
SISTEMA PROMPT PERSONALIZADO:
Eres Sofia, agente especializada en seguros de Tu Empresa de Seguros.
Estás contactando a Juan Pérez para seguimiento de su póliza POL-12345-2024.
Debes ser profesional, amable y ayudar con renovaciones o pagos pendientes.
El cliente tiene una deuda de $255.000 con vencimiento 2024-08-15.

FIRST MESSAGE PERSONALIZADO:
Hola Juan Pérez, soy Sofia de Tu Empresa de Seguros.
Te llamo porque tenemos registrado un pago pendiente de tu póliza POL-12345-2024
por valor de $255.000 pesos. ¿Podrías confirmarme si ya realizaste este pago?
```

## Datos de Ejemplo del Cliente
```javascript
const clientData = {
  customer_name: "Juan Pérez",
  user_name: "Juan Pérez",
  client_name: "Juan Pérez",
  policy_number: "POL-12345-2024",
  policy_expiration_date: "2024-12-31",
  debt_amount: "$255.000",
  payment_due_date: "2024-08-15",
  company_name: "Tu Empresa de Seguros",
  agent_name: "Sofia",
  city: "Bogotá",
  phone: "+573001234567",
  email: "juan.perez@email.com",
  monthly_payment: "$85.000",
  coverage_amount: "$50.000.000"
}
```

## Variables Disponibles para Personalización
- `{{customer_name}}` - Nombre completo del cliente
- `{{user_name}}` - Alias para customer_name
- `{{client_name}}` - Alias para customer_name
- `{{policy_number}}` - Número de póliza
- `{{policy_expiration_date}}` - Fecha de vencimiento de póliza
- `{{debt_amount}}` - Monto de deuda (formateado con $)
- `{{payment_due_date}}` - Fecha de vencimiento de pago
- `{{company_name}}` - Nombre de la empresa
- `{{agent_name}}` - Nombre del agente (Sofia)
- `{{city}}` - Ciudad del cliente
- `{{phone}}` - Teléfono del cliente
- `{{email}}` - Email del cliente
- `{{monthly_payment}}` - Pago mensual (formateado con $)
- `{{coverage_amount}}` - Monto de cobertura (formateado con $)

## Comparación de Enfoques

### ❌ Enfoque Anterior (Variables Dinámicas)
```javascript
// EL PROBLEMA: ElevenLabs recibía variables sin procesar
const callData = {
  agent_id: "agent_123",
  phone_number: "+573001234567",
  customer_name: "Juan Pérez",
  
  // 🔥 PROBLEMA: Variables enviadas a ElevenLabs para procesamiento
  dynamic_variables: {
    user_name: "Juan Pérez",
    company_name: "Tu Empresa de Seguros",
    policy_number: "POL-12345-2024",
    debt_amount: 255000,
    // ... más variables
  }
}
```
**Resultado:** Error "Missing required dynamic variables"

### ✅ Nuevo Enfoque (Personalización en Frontend)
```javascript
// LA SOLUCIÓN: Frontend procesa las variables ANTES de enviar
const callData = {
  agent_id: "agent_123",
  phone_number: "+573001234567",
  customer_name: "Juan Pérez",
  
  // ✅ SOLUCIÓN: Contenido ya personalizado, sin variables
  system_prompt: "Eres Sofia, agente especializada en seguros de Tu Empresa de Seguros...",
  first_message: "Hola Juan Pérez, soy Sofia de Tu Empresa de Seguros...",
  
  // Variables dinámicas solo para compatibilidad
  dynamic_variables: { /* solo por compatibilidad */ }
}
```
**Resultado:** ✅ Llamada exitosa con contenido personalizado

## Función de Personalización

```javascript
const personalizeContent = (template, clientData) => {
  if (!template) return template;
  
  let personalizedContent = template;
  
  // Definir todos los reemplazos posibles
  const replacements = {
    '{{customer_name}}': clientData.customer_name || 'Cliente',
    '{{user_name}}': clientData.customer_name || 'Cliente',
    '{{policy_number}}': clientData.policy_number || 'su póliza',
    '{{debt_amount}}': clientData.debt_amount ? `$${Number(clientData.debt_amount).toLocaleString()}` : '$0',
    '{{company_name}}': clientData.company_name || 'Seguros ABC',
    '{{agent_name}}': 'Sofia',
    // ... más reemplazos
  };
  
  // Aplicar todos los reemplazos
  Object.entries(replacements).forEach(([placeholder, value]) => {
    const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
    personalizedContent = personalizedContent.replace(regex, value || '');
  });
  
  return personalizedContent;
};
```

## Ventajas del Nuevo Enfoque

1. **✅ Sin errores de variables**: ElevenLabs recibe contenido completo
2. **✅ Mayor control**: Frontend tiene control total sobre la personalización
3. **✅ Mejor debugging**: Puedes ver exactamente qué se envía
4. **✅ Flexibilidad**: Fácil agregar nuevas variables o formateo
5. **✅ Compatibilidad**: Mantiene dynamic_variables para retrocompatibilidad

## Logs de Ejemplo

```
🎯 [CAMPAIGN] Iniciando personalización de contenido para: Juan Pérez
✅ [CAMPAIGN] System prompt personalizado: Eres Sofia, agente especializada en seguros de Tu Empresa de Seguros. Estás contactando a Juan Pérez...
✅ [CAMPAIGN] First message personalizado: Hola Juan Pérez, soy Sofia de Tu Empresa de Seguros. Te llamo porque tenemos registrado...
📞 [CAMPAIGN] Datos de llamada preparados (NUEVA VERSIÓN CON PERSONALIZACIÓN):
   - Agent ID: agent_123
   - Phone: +573001234567
   - Customer: Juan Pérez
   - System Prompt Length: 245
   - First Message Length: 167
```

## Implementación

Los cambios se han aplicado en:

1. **`elevenLabsService.ts`**: 
   - Función `personalizeContent()` 
   - Modificación de `createPhoneCallViaTwilioOutbound()`

2. **`CampaignsManagementWidget.tsx`**:
   - Función auxiliar `personalizeContent()`
   - Modificación de `initiateCall()`

El sistema ahora procesa todas las variables en el frontend y envía contenido completamente personalizado a ElevenLabs, eliminando la necesidad de procesamiento de variables dinámicas en el servidor.
