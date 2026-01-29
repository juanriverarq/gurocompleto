# Mejoras del Sistema WhatsApp + Chatbot

## Resumen de Implementación

Este documento describe las mejoras implementadas en el sistema de WhatsApp y Chatbot.

**Fecha de actualización:** Enero 2026

---

## 🔴 Alta Prioridad - Implementadas

### 0. WebSockets en Tiempo Real

**Archivos modificados:**
- `frontend/src/hooks/useWhatsAppSocket.ts` - Eventos del Inbox
- `frontend/src/views/apps/whatsapp/WhatsAppInboxPro.tsx` - Integración WebSocket
- `backend/app/Http/Controllers/Api/WhatsAppWebhookController.php` - Emisión de eventos

**Funcionamiento:**
- Cuando llega un mensaje, el backend emite un evento `inbox_message` via Socket.IO
- El frontend escucha estos eventos y actualiza la UI en tiempo real
- Polling adaptativo: 30s cuando WebSocket está conectado, 5s cuando no

**Eventos soportados:**
- `inbox_message` - Nuevo mensaje en una conversación
- `conversation_update` - Cambios en estado, asignación, etc.
- `typing_indicator` - Indicador de escritura
- `new_conversation` - Nueva conversación creada

**Beneficios:**
- Notificaciones instantáneas sin esperar polling
- Menor carga en el servidor (menos requests HTTP)
- Mejor experiencia de usuario

### 1. Soporte para Multimedia

**Archivos modificados:**
- `app/Services/WhatsAppBridgeService.php`

**Nuevos métodos disponibles:**

```php
// Enviar imagen
$bridge->sendImage($instanceId, $phone, $imageUrl, $caption);

// Enviar documento
$bridge->sendDocument($instanceId, $phone, $documentUrl, $filename, $caption);

// Enviar audio/nota de voz
$bridge->sendAudio($instanceId, $phone, $audioUrl, $ptt = false);

// Enviar video
$bridge->sendVideo($instanceId, $phone, $videoUrl, $caption);

// Enviar lista interactiva
$bridge->sendListMessage($instanceId, $phone, $title, $body, $buttonText, $sections);

// Enviar botones
$bridge->sendButtonMessage($instanceId, $phone, $body, $buttons, $header, $footer);
```

### 2. Nodo de IA en el Chatbot

**Archivos creados:**
- `app/Services/AIResponseService.php`

**Configuración (.env):**
```env
AI_PROVIDER=deepseek        # 'deepseek', 'openai' o 'claude'
AI_MODEL=deepseek-chat      # Modelo a usar
# DeepSeek ya está configurado con DEEPSEEK_API_KEY existente
OPENAI_API_KEY=             # Opcional, para usar OpenAI
ANTHROPIC_API_KEY=          # Opcional, para usar Claude
```

**Proveedores soportados:**
- **DeepSeek** (por defecto) - Más económico, ya integrado en el proyecto
- **OpenAI** - GPT-4, GPT-4o-mini, etc.
- **Claude** - Claude 3 Opus, Sonnet, Haiku

**Uso en flujos de chatbot:**

Crear un nodo con `node_type: 'ai_response'` y configuración:

```json
{
  "node_type": "ai_response",
  "config": {
    "system_prompt": "Eres un asistente de seguros...",
    "company_name": "Mi Empresa",
    "custom_instructions": "Siempre saluda cordialmente",
    "model": "gpt-4o-mini",
    "max_tokens": 300,
    "temperature": 0.7
  }
}
```

**Métodos adicionales del AIResponseService:**

```php
// Clasificar intención del mensaje
$aiService->classifyIntent($message, ['consulta', 'queja', 'cotizacion']);

// Extraer datos estructurados
$aiService->extractData($message, ['nombre', 'telefono', 'email']);
```

### 3. Persistencia de Sesiones en Base de Datos

**Configuración (.env):**
```env
CHATBOT_USE_DB_SESSIONS=true  # true = BD, false = Cache
```

**Beneficios:**
- Sesiones sobreviven reinicios del servidor
- Historial de conversación persistente
- Mejor debugging y análisis

**Tabla utilizada:** `chatbot_sessions`

### 4. Nuevos Tipos de Nodos en el Chatbot

**Archivos modificados:**
- `app/Services/ChatbotProcessorService.php`

| Tipo de Nodo | Descripción |
|--------------|-------------|
| `ai_response` | Genera respuesta con IA (OpenAI/Claude) |
| `media` / `image` / `document` / `audio` / `video` | Envía contenido multimedia |
| `interactive` / `buttons` / `list` | Mensajes interactivos de WhatsApp |
| `condition` | Evalúa condiciones y decide siguiente nodo |
| `set_variable` | Establece variables en la sesión |
| `delay` | Espera N segundos antes de continuar |
| `webhook` | Llama a un webhook externo |

**Ejemplo de nodo condicional:**
```json
{
  "node_type": "condition",
  "config": {
    "conditions": [
      {
        "variable": "selected_option",
        "operator": "equals",
        "value": "cotización",
        "next_node_id": 5
      },
      {
        "variable": "selected_option",
        "operator": "equals", 
        "value": "siniestro",
        "next_node_id": 6
      }
    ],
    "default_next_node_id": 7
  }
}
```

**Operadores disponibles:** `equals`, `not_equals`, `contains`, `greater_than`, `less_than`, `is_set`, `is_empty`

---

## 🟡 Media Prioridad - Frontend

### 5. Visualización de Multimedia en Inbox

**Archivos creados:**
- `frontend/src/components/whatsapp/MessageContent.tsx`

**Archivos modificados:**
- `frontend/src/views/apps/whatsapp/WhatsAppInboxPro.tsx`

**Tipos de mensaje soportados:**
- `text` - Texto plano
- `image` - Imágenes con preview y modal
- `video` - Videos con reproductor
- `audio` - Audio con reproductor
- `document` - Documentos con descarga
- `location` - Ubicación con link a Google Maps
- `contact` - Tarjeta de contacto
- `sticker` - Stickers
- `interactive` - Mensajes interactivos
- `template` - Plantillas de WhatsApp Business

### 6. Menú de Adjuntar Archivos

El inbox ahora tiene un menú desplegable para adjuntar:
- Imágenes
- Documentos
- Audio
- Video

> **Nota:** El envío de archivos requiere implementación del endpoint de upload en el backend.

---

## 🔧 Configuración Requerida

### Variables de Entorno

Agregar al archivo `.env`:

```env
# AI Configuration (Chatbot)
AI_PROVIDER=openai
AI_MODEL=gpt-4o-mini
OPENAI_API_KEY=tu_api_key_aqui
ANTHROPIC_API_KEY=                    # Opcional, para usar Claude

# Chatbot Session Configuration
CHATBOT_USE_DB_SESSIONS=true
```

### Migraciones

Asegurarse de que la tabla `chatbot_sessions` existe:

```bash
php artisan migrate
```

---

## 📋 Pendientes (Próximas Mejoras)

### Funcionalidades de Media Prioridad
- [ ] CRUD completo de Quick Replies en frontend
- [ ] Etiquetas/Tags para conversaciones
- [ ] Visualización de notas internas
- [ ] Historial de actividad
- [ ] Búsqueda avanzada
- [ ] Notificaciones de escritorio/sonido

### Funcionalidades de Baja Prioridad
- [ ] Métricas y reportes
- [ ] Horarios de atención
- [ ] Colas de espera
- [ ] Plantillas de WhatsApp Business
- [ ] Exportar conversaciones
- [ ] Integración con CRM

---

## 🧪 Testing

### Probar nodo de IA (DeepSeek)

```php
// En tinker
$ai = app(\App\Services\AIResponseService::class);

// Verificar que está configurado
dd($ai->isConfigured(), $ai->getProvider()); // true, 'deepseek'

// Generar respuesta
$result = $ai->generateResponse('Hola, necesito información sobre seguros de auto');
dd($result);
// Respuesta esperada: ['success' => true, 'response' => '...', 'model' => 'deepseek-chat']
```

### Probar envío multimedia

```php
$bridge = app(\App\Services\WhatsAppBridgeService::class);
$result = $bridge->sendImage('instance_id', '573001234567', 'https://example.com/image.jpg', 'Mira esta imagen');
dd($result);
```

### Probar WebSocket (desde el frontend)

```javascript
// En la consola del navegador
// Los eventos se logean automáticamente con prefijo [WhatsAppSocket]
// Buscar: 📨 [WhatsAppSocket] inbox_message
```
