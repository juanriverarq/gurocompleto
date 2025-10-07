# GuromensajesService - Guía de Postman 📮

Esta guía te muestra cómo usar todos los endpoints del microservicio desde Postman con ejemplos completos.

## Configuración Base

**Base URL:** `http://localhost:3000/api/v1`

## 1. WhatsApp Endpoints

### 1.1 Obtener Estado de Conexión
```
GET /whatsapp/status
```

**Headers:** Ninguno necesario

**Response:**
```json
{
    "success": true,
    "connected": true,
    "qrCode": null
}
```

### 1.2 Obtener Código QR
```
GET /whatsapp/qr
```

**Headers:** Ninguno necesario

**Response:**
```json
{
    "success": true,
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

### 1.3 Desconectar WhatsApp
```
POST /whatsapp/disconnect
```

**Headers:** 
```
Content-Type: application/json
```

**Body:** Vacío `{}`

### 1.4 Reconectar WhatsApp
```
POST /whatsapp/reconnect
```

**Headers:** 
```
Content-Type: application/json
```

**Body:** Vacío `{}`

### 1.5 Obtener Estadísticas
```
GET /whatsapp/stats
```

**Headers:** Ninguno necesario

**Response:**
```json
{
    "success": true,
    "stats": {
        "total_contacts": 5,
        "total_messages": 25,
        "active_automations": 3,
        "messages_last_week": 15,
        "whatsapp_connected": true,
        "uptime": 3600.5
    }
}
```

## 2. Contactos Endpoints

### 2.1 Listar Contactos
```
GET /contacts
```

**Query Parameters (opcionales):**
- `phone`: Filtrar por teléfono (ej: `1234567890`)
- `name`: Filtrar por nombre (ej: `Juan`)
- `tag`: Filtrar por etiqueta (ej: `cliente`)
- `limit`: Límite de resultados (ej: `10`)

**Ejemplos:**
```
GET /contacts
GET /contacts?limit=10
GET /contacts?phone=1234567890
GET /contacts?name=Juan&limit=5
GET /contacts?tag=cliente
```

**Response:**
```json
{
    "success": true,
    "contacts": [
        {
            "id": "uuid-1234",
            "phone": "1234567890",
            "name": "Juan Pérez",
            "email": "juan@example.com",
            "tags": ["cliente", "vip"],
            "custom_fields": {
                "empresa": "ABC Corp",
                "cargo": "Gerente"
            },
            "created_at": "2025-01-31T20:00:00.000Z",
            "updated_at": "2025-01-31T20:00:00.000Z"
        }
    ]
}
```

### 2.2 Obtener Contacto Específico
```
GET /contacts/:phone
```

**Ejemplo:**
```
GET /contacts/1234567890
```

### 2.3 Crear/Actualizar Contacto
```
POST /contacts
```

**Headers:**
```
Content-Type: application/json
```

**Body (Ejemplo Completo):**
```json
{
    "phone": "1234567890",
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "tags": ["cliente", "vip", "activo"],
    "custom_fields": {
        "empresa": "ABC Corporation",
        "cargo": "Gerente de Ventas",
        "ciudad": "Bogotá",
        "fecha_nacimiento": "1985-05-15",
        "preferencias": {
            "horario_contacto": "mañana",
            "canal_preferido": "whatsapp"
        }
    }
}
```

**Body (Ejemplo Mínimo):**
```json
{
    "phone": "1234567890",
    "name": "Juan Pérez"
}
```

### 2.4 Eliminar Contacto
```
DELETE /contacts/:phone
```

**Ejemplo:**
```
DELETE /contacts/1234567890
```

## 3. Mensajes Endpoints

### 3.1 Listar Mensajes
```
GET /messages
```

**Query Parameters (opcionales):**
- `phone`: Filtrar por teléfono
- `type`: `sent` o `received`
- `from_date`: Fecha desde (ISO format)
- `to_date`: Fecha hasta (ISO format)
- `limit`: Límite de resultados

**Ejemplos:**
```
GET /messages
GET /messages?phone=1234567890
GET /messages?type=sent&limit=20
GET /messages?from_date=2025-01-01T00:00:00Z&to_date=2025-01-31T23:59:59Z
```

### 3.2 Obtener Conversación
```
GET /messages/conversation/:phone
```

**Query Parameters (opcionales):**
- `limit`: Límite de mensajes (default: 50)

**Ejemplo:**
```
GET /messages/conversation/1234567890?limit=100
```

### 3.3 Enviar Mensaje Individual
```
POST /messages/send
```

**Headers:**
```
Content-Type: application/json
```

**Body (Mensaje Simple):**
```json
{
    "phone": "1234567890",
    "message": "¡Hola! Este es un mensaje de prueba desde Postman."
}
```

**Body (Mensaje con Media):**
```json
{
    "phone": "1234567890",
    "message": "Aquí tienes la imagen que solicitaste",
    "options": {
        "media": {
            "type": "image",
            "url": "https://example.com/imagen.jpg"
        }
    }
}
```

### 3.4 Envío Masivo
```
POST /messages/send-bulk
```

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
    "contacts": [
        { "phone": "1234567890" },
        { "phone": "0987654321" },
        { "phone": "5555555555" }
    ],
    "message": "¡Hola a todos! Este es un mensaje masivo de prueba.",
    "options": {}
}
```

**Response:**
```json
{
    "success": true,
    "message": "Mensajes enviados: 2 exitosos, 1 fallidos",
    "results": [
        {
            "phone": "1234567890",
            "success": true,
            "messageId": "msg_123"
        },
        {
            "phone": "0987654321",
            "success": false,
            "error": "Número no válido"
        }
    ]
}
```

## 4. Automatizaciones Endpoints

### 4.1 Listar Automatizaciones
```
GET /automations
```

**Query Parameters (opcionales):**
- `active`: `true` o `false`

**Ejemplos:**
```
GET /automations
GET /automations?active=true
```

### 4.2 Obtener Automatización Específica
```
GET /automations/:id
```

**Ejemplo:**
```
GET /automations/uuid-automation-123
```

### 4.3 Crear Automatización por Palabra Clave
```
POST /automations
```

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
    "name": "Respuesta Automática - Hola",
    "trigger_type": "keyword",
    "trigger_value": "hola",
    "message_template": "¡Hola {{triggerMessage}}! Gracias por contactarnos. Te responderemos pronto en horario de {{time}}.",
    "active": true,
    "conditions": {
        "min_time_since_last_message": 60,
        "contact_has_tag": "cliente"
    },
    "actions": [
        {
            "type": "add_tag",
            "value": "contacto-automatico"
        },
        {
            "type": "wait",
            "value": 5
        }
    ]
}
```

### 4.4 Crear Automatización Programada (Cron)
```
POST /automations
```

**Body:**
```json
{
    "name": "Saludo Matutino Diario",
    "trigger_type": "schedule",
    "trigger_value": "0 8 * * 1-5",
    "message_template": "¡Buenos días! Hoy es {{date}} y esperamos que tengas un excelente día.",
    "active": true,
    "conditions": {},
    "actions": [
        {
            "type": "add_tag",
            "value": "saludo-automatico"
        }
    ]
}
```

**Expresiones Cron Comunes:**
- `0 8 * * 1-5` - Todos los días laborales a las 8:00 AM
- `0 12 * * *` - Todos los días a las 12:00 PM
- `0 18 * * 6,0` - Fines de semana a las 6:00 PM
- `0 */2 * * *` - Cada 2 horas

### 4.5 Crear Automatización Webhook
```
POST /automations
```

**Body:**
```json
{
    "name": "Notificación desde Sistema Externo",
    "trigger_type": "webhook",
    "trigger_value": "webhook_ventas_123",
    "message_template": "Nueva venta registrada: {{producto}} por {{cliente}}. Total: ${{total}}",
    "active": true,
    "conditions": {},
    "actions": [
        {
            "type": "add_tag",
            "value": "venta-notificada"
        }
    ]
}
```

### 4.6 Crear Automatización para Nuevos Contactos
```
POST /automations
```

**Body:**
```json
{
    "name": "Bienvenida Nuevos Contactos",
    "trigger_type": "new_contact",
    "trigger_value": "",
    "message_template": "¡Bienvenido! Gracias por contactarnos. Soy un asistente automático y pronto un humano te atenderá.",
    "active": true,
    "conditions": {},
    "actions": [
        {
            "type": "add_tag",
            "value": "nuevo-contacto"
        },
        {
            "type": "wait",
            "value": 300
        }
    ]
}
```

### 4.7 Actualizar Automatización
```
PUT /automations/:id
```

**Headers:**
```
Content-Type: application/json
```

**Body:** Mismo formato que POST, pero con modificaciones

### 4.8 Activar/Desactivar Automatización
```
PATCH /automations/:id/toggle
```

**Headers:**
```
Content-Type: application/json
```

**Body:** Vacío `{}`

### 4.9 Ejecutar Automatización Manualmente
```
POST /automations/:id/execute
```

**Headers:**
```
Content-Type: application/json
```

**Body (Opcional - contexto personalizado):**
```json
{
    "context": {
        "phone": "1234567890",
        "cliente": "Juan Pérez",
        "producto": "Servicio Premium",
        "total": "299.99"
    }
}
```

### 4.10 Webhook Externo
```
POST /automations/webhook/:id
```

**Headers:**
```
Content-Type: application/json
```

**Body (datos del sistema externo):**
```json
{
    "cliente": "María García",
    "producto": "Plan Basic",
    "total": "99.99",
    "fecha": "2025-01-31",
    "vendedor": "Carlos López"
}
```

### 4.11 Eliminar Automatización
```
DELETE /automations/:id
```

## 5. Autenticación (Básica)

### 5.1 Login
```
POST /auth/login
```

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
    "username": "admin",
    "password": "123456"
}
```

### 5.2 Verificar Token
```
GET /auth/verify
```

**Headers:**
```
Authorization: Bearer dummy-token
```

## 6. Variables de Plantillas Disponibles

En `message_template` puedes usar estas variables:

### Variables de Contexto:
- `{{phone}}` - Teléfono del contacto
- `{{triggerMessage}}` - Mensaje que activó la automatización
- `{{cliente}}` - Nombre del cliente (si se proporciona)
- `{{producto}}` - Producto (si se proporciona)
- `{{total}}` - Total (si se proporciona)

### Variables del Sistema:
- `{{date}}` - Fecha actual
- `{{time}}` - Hora actual

## 7. Tipos de Acciones Disponibles

```json
{
    "actions": [
        {
            "type": "add_tag",
            "value": "etiqueta-nueva"
        },
        {
            "type": "remove_tag",
            "value": "etiqueta-remover"
        },
        {
            "type": "wait",
            "value": 60
        },
        {
            "type": "webhook",
            "value": "https://mi-sistema.com/webhook"
        }
    ]
}
```

## 8. Colección de Postman

Para facilitar las pruebas, aquí tienes los pasos para crear una colección en Postman:

1. **Crear Nueva Colección:** "GuromensajesService API"
2. **Configurar Variable de Entorno:**
   - Variable: `base_url`
   - Valor: `http://localhost:3000/api/v1`

3. **Requests a Agregar:**
   - WhatsApp Status (GET)
   - WhatsApp QR (GET)
   - List Contacts (GET)
   - Create Contact (POST)
   - Send Message (POST)
   - Send Bulk Messages (POST)
   - List Automations (GET)
   - Create Keyword Automation (POST)
   - Create Schedule Automation (POST)
   - Execute Automation (POST)

¿Te gustaría que exporte una colección completa de Postman en formato JSON?
