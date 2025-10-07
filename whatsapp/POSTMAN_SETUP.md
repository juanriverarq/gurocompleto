# 🚀 Configuración y Uso de Postman - Paso a Paso

## 1. Importar la Colección

### Opción A: Importar archivo JSON
1. Abre Postman
2. Haz clic en **Import** (esquina superior izquierda)
3. Selecciona **File** y elige `GuromensajesService.postman_collection.json`
4. Haz clic en **Import**

### Opción B: Crear manualmente
1. Crea una nueva colección llamada "GuromensajesService API"
2. Agrega las carpetas: WhatsApp, Contacts, Messages, Automations, Auth
3. Copia los requests de la documentación

## 2. Configurar Variables de Entorno

1. Haz clic en el ícono del ojo (👁️) en la esquina superior derecha
2. Selecciona **Add Environment**
3. Nombra el entorno: "GuromensajesService Local"
4. Agrega estas variables:

| Variable | Initial Value | Current Value |
|----------|---------------|---------------|
| `base_url` | `http://localhost:3000/api/v1` | `http://localhost:3000/api/v1` |
| `automation_id` | (vacío por ahora) | (vacío por ahora) |

5. Haz clic en **Save**
6. Selecciona el entorno creado en el dropdown

## 3. Iniciar el Servidor

Antes de probar los endpoints, asegúrate de que el servidor esté ejecutándose:

```bash
cd C:\Users\Ismael\Desktop\guromensajes
npm start
```

## 4. Pruebas Básicas - Orden Recomendado

### 4.1 Verificar Estado del Servicio

**Request:** `GET /whatsapp/stats`

**Resultado esperado:**
```json
{
    "success": true,
    "stats": {
        "total_contacts": 0,
        "total_messages": 0,
        "active_automations": 0,
        "messages_last_week": 0,
        "whatsapp_connected": true,
        "uptime": 123.45
    }
}
```

### 4.2 Verificar Conexión de WhatsApp

**Request:** `GET /whatsapp/status`

**Resultado esperado:**
```json
{
    "success": true,
    "connected": true,
    "qrCode": null
}
```

Si `connected: false`, usar `GET /whatsapp/qr` para obtener el código QR.

### 4.3 Crear un Contacto de Prueba

**Request:** `POST /contacts`

**Body:**
```json
{
    "phone": "1234567890",
    "name": "Contacto de Prueba",
    "email": "prueba@test.com",
    "tags": ["test", "demo"],
    "custom_fields": {
        "nota": "Contacto creado desde Postman"
    }
}
```

**Resultado esperado:**
```json
{
    "success": true,
    "contactId": "uuid-generado"
}
```

### 4.4 Listar Contactos

**Request:** `GET /contacts`

**Resultado esperado:**
```json
{
    "success": true,
    "contacts": [
        {
            "id": "uuid-generado",
            "phone": "1234567890",
            "name": "Contacto de Prueba",
            "email": "prueba@test.com",
            "tags": ["test", "demo"],
            "custom_fields": {
                "nota": "Contacto creado desde Postman"
            },
            "created_at": "2025-01-31T20:00:00.000Z",
            "updated_at": "2025-01-31T20:00:00.000Z"
        }
    ]
}
```

### 4.5 Enviar Mensaje de Prueba

⚠️ **IMPORTANTE:** Solo funciona si WhatsApp está conectado y el número existe.

**Request:** `POST /messages/send`

**Body:**
```json
{
    "phone": "1234567890",
    "message": "¡Hola! Este es un mensaje de prueba desde Postman 📱"
}
```

**Resultado esperado:**
```json
{
    "success": true,
    "message": "Mensaje enviado exitosamente",
    "messageId": "mensaje-id-generado"
}
```

### 4.6 Crear Automatización de Prueba

**Request:** `POST /automations`

**Body:**
```json
{
    "name": "Respuesta Automática - Prueba",
    "trigger_type": "keyword",
    "trigger_value": "test",
    "message_template": "¡Hola! Recibí tu mensaje: '{{triggerMessage}}'. Esta es una respuesta automática 🤖",
    "active": true,
    "conditions": {},
    "actions": [
        {
            "type": "add_tag",
            "value": "respondido-automaticamente"
        }
    ]
}
```

**Resultado esperado:**
```json
{
    "success": true,
    "automationId": "uuid-automation-generado",
    "message": "Automatización creada exitosamente"
}
```

📝 **IMPORTANTE:** Copia el `automationId` y actualiza la variable `automation_id` en tu entorno de Postman.

### 4.7 Listar Automatizaciones

**Request:** `GET /automations`

**Resultado esperado:**
```json
{
    "success": true,
    "automations": [
        {
            "id": "uuid-automation-generado",
            "name": "Respuesta Automática - Prueba",
            "trigger_type": "keyword",
            "trigger_value": "test",
            "message_template": "¡Hola! Recibí tu mensaje: '{{triggerMessage}}'. Esta es una respuesta automática 🤖",
            "active": true,
            "conditions": {},
            "actions": [
                {
                    "type": "add_tag",
                    "value": "respondido-automaticamente"
                }
            ],
            "created_at": "2025-01-31T20:00:00.000Z",
            "updated_at": "2025-01-31T20:00:00.000Z"
        }
    ]
}
```

## 5. Flujos de Prueba Avanzados

### 5.1 Flujo de Envío Masivo

1. **Crear múltiples contactos:**
   - Usar `POST /contacts` con diferentes teléfonos
   - Ejemplo: "1111111111", "2222222222", "3333333333"

2. **Enviar mensaje masivo:**
   ```json
   {
       "contacts": [
           { "phone": "1111111111" },
           { "phone": "2222222222" },
           { "phone": "3333333333" }
       ],
       "message": "¡Mensaje masivo de prueba! 📢",
       "options": {}
   }
   ```

3. **Verificar resultados:**
   - Usar `GET /messages` para ver los mensajes enviados
   - Revisar el campo `results` en la respuesta

### 5.2 Flujo de Automatización Programada

1. **Crear automatización con cron:**
   ```json
   {
       "name": "Recordatorio cada 2 minutos",
       "trigger_type": "schedule",
       "trigger_value": "*/2 * * * *",
       "message_template": "Recordatorio automático - {{date}} a las {{time}} ⏰",
       "active": true,
       "conditions": {},
       "actions": []
   }
   ```

2. **Esperar 2 minutos y verificar:**
   - Usar `GET /messages` para ver si se ejecutó
   - Revisar logs del servidor

### 5.3 Flujo de Webhook

1. **Crear automatización webhook:**
   ```json
   {
       "name": "Notificación de Venta",
       "trigger_type": "webhook",
       "trigger_value": "ventas_webhook_123",
       "message_template": "🎉 Nueva venta: {{producto}} - Cliente: {{cliente}} - Total: ${{total}}",
       "active": true,
       "conditions": {},
       "actions": []
   }
   ```

2. **Disparar webhook:**
   - Usar `POST /automations/webhook/{{automation_id}}`
   - Body:
   ```json
   {
       "producto": "Plan Premium",
       "cliente": "Juan Pérez",
       "total": "299.99"
   }
   ```

## 6. Troubleshooting - Errores Comunes

### Error 500 - Internal Server Error
- **Causa:** El servidor no está ejecutándose
- **Solución:** Ejecutar `npm start` en la terminal

### Error 404 - Not Found
- **Causa:** URL incorrecta o servidor no iniciado
- **Solución:** Verificar que la `base_url` sea correcta

### WhatsApp no conectado
- **Síntoma:** `"connected": false` en `/whatsapp/status`
- **Solución:** 
  1. Usar `GET /whatsapp/qr` para obtener QR
  2. Escanear con WhatsApp
  3. Esperar a que cambie a `"connected": true`

### Mensaje no se envía
- **Causas posibles:**
  - WhatsApp no conectado
  - Número de teléfono inválido
  - Número no tiene WhatsApp
- **Solución:** Verificar estado de conexión y usar números reales

### Automatización no se ejecuta
- **Causas posibles:**
  - `"active": false`
  - Condiciones no cumplidas
  - Error en expresión cron
- **Solución:** 
  1. Verificar que esté activa
  2. Usar `POST /automations/:id/execute` para prueba manual

## 7. Variables Útiles para Testing

Agrega estas variables adicionales a tu entorno:

| Variable | Value | Uso |
|----------|-------|-----|
| `test_phone` | `1234567890` | Número de prueba |
| `test_message` | `Mensaje de prueba desde Postman` | Mensaje estándar |
| `test_automation_keyword` | `test` | Palabra clave de prueba |

## 8. Scripts de Postman (Avanzado)

### Pre-request Script para generar timestamp:
```javascript
pm.environment.set("current_timestamp", new Date().toISOString());
```

### Test Script para guardar IDs automáticamente:
```javascript
// Guardar automationId de la respuesta
if (pm.response.json().automationId) {
    pm.environment.set("automation_id", pm.response.json().automationId);
}

// Verificar que la respuesta sea exitosa
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has success field", function () {
    pm.expect(pm.response.json()).to.have.property('success');
});
```

## 9. Colección de Ejemplos Rápidos

### Crear contacto rápido:
```bash
curl -X POST http://localhost:3000/api/v1/contacts \
  -H "Content-Type: application/json" \
  -d '{"phone":"1234567890","name":"Test User"}'
```

### Enviar mensaje rápido:
```bash
curl -X POST http://localhost:3000/api/v1/messages/send \
  -H "Content-Type: application/json" \
  -d '{"phone":"1234567890","message":"Hola desde curl!"}'
```

### Ver estadísticas:
```bash
curl http://localhost:3000/api/v1/whatsapp/stats
```

---

¿Necesitas ayuda con algún endpoint específico o tienes algún error? ¡Solo pregunta! 🚀
