# GuromensajesService 🚀

Microservicio de administración de mensajes WhatsApp usando Baileys, similar a ManyChat.

## Características

- ✅ Conexión con WhatsApp Business API usando Baileys
- ✅ Gestión completa de contactos
- ✅ Envío de mensajes individuales y masivos
- ✅ Sistema de automatizaciones avanzado
- ✅ API REST completa
- ✅ Dashboard web en tiempo real
- ✅ Base de datos SQLite
- ✅ WebSocket para eventos en tiempo real

## Instalación

```bash
# Clonar el repositorio
git clone <tu-repo>
cd guromensajes

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env

# Iniciar en modo desarrollo
npm run dev

# Iniciar en producción
npm start
```

## Configuración

Edita el archivo `.env` con tus configuraciones:

```env
PORT=3000
NODE_ENV=development
DB_PATH=./data/guromensajes.db
JWT_SECRET=tu_jwt_secret_aqui
```

## API Endpoints

Base URL: `http://localhost:3000/api/v1`

### WhatsApp

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/whatsapp/status` | Estado de conexión |
| GET | `/whatsapp/qr` | Obtener código QR |
| POST | `/whatsapp/disconnect` | Desconectar WhatsApp |
| POST | `/whatsapp/reconnect` | Reconectar WhatsApp |
| GET | `/whatsapp/stats` | Estadísticas del servicio |

### Contactos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/contacts` | Listar contactos |
| GET | `/contacts/:phone` | Obtener contacto específico |
| POST | `/contacts` | Crear/actualizar contacto |
| DELETE | `/contacts/:phone` | Eliminar contacto |

### Mensajes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/messages` | Listar mensajes |
| GET | `/messages/conversation/:phone` | Obtener conversación |
| POST | `/messages/send` | Enviar mensaje |
| POST | `/messages/send-bulk` | Envío masivo |

### Automatizaciones

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/automations` | Listar automatizaciones |
| GET | `/automations/:id` | Obtener automatización |
| POST | `/automations` | Crear automatización |
| PUT | `/automations/:id` | Actualizar automatización |
| DELETE | `/automations/:id` | Eliminar automatización |
| PATCH | `/automations/:id/toggle` | Activar/desactivar |
| POST | `/automations/:id/execute` | Ejecutar manualmente |
| POST | `/automations/webhook/:id` | Webhook externo |

## Ejemplos de Uso

### Enviar Mensaje

```javascript
const response = await fetch('http://localhost:3000/api/v1/messages/send', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        phone: '1234567890',
        message: 'Hola desde el microservicio!'
    })
});
```

### Crear Contacto

```javascript
const response = await fetch('http://localhost:3000/api/v1/contacts', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        phone: '1234567890',
        name: 'Juan Pérez',
        email: 'juan@example.com',
        tags: ['cliente', 'vip'],
        custom_fields: {
            empresa: 'ABC Corp',
            cargo: 'Gerente'
        }
    })
});
```

### Crear Automatización

```javascript
const response = await fetch('http://localhost:3000/api/v1/automations', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        name: 'Respuesta Automática',
        trigger_type: 'keyword',
        trigger_value: 'hola',
        message_template: '¡Hola! Gracias por contactarnos. Te responderemos pronto.',
        active: true,
        conditions: {
            min_time_since_last_message: 60
        },
        actions: [
            {
                type: 'add_tag',
                value: 'contacto-automatico'
            }
        ]
    })
});
```

### Envío Masivo

```javascript
const response = await fetch('http://localhost:3000/api/v1/messages/send-bulk', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        contacts: [
            { phone: '1234567890' },
            { phone: '0987654321' }
        ],
        message: 'Mensaje masivo para todos los contactos'
    })
});
```

## Tipos de Automatizaciones

### Por Palabra Clave
```json
{
    "trigger_type": "keyword",
    "trigger_value": "hola"
}
```

### Programada (Cron)
```json
{
    "trigger_type": "schedule",
    "trigger_value": "0 9 * * *"
}
```

### Webhook
```json
{
    "trigger_type": "webhook",
    "trigger_value": "webhook_id"
}
```

### Nuevo Contacto
```json
{
    "trigger_type": "new_contact"
}
```

## WebSocket Events

El servicio emite eventos en tiempo real via WebSocket:

- `connection_status` - Estado de conexión de WhatsApp
- `qr_code` - Código QR para conectar
- `new_message` - Nuevo mensaje recibido

```javascript
const socket = io('http://localhost:3000');

socket.on('connection_status', (data) => {
    console.log('WhatsApp conectado:', data.connected);
});

socket.on('new_message', (data) => {
    console.log('Nuevo mensaje de:', data.phone, data.message);
});
```

## Dashboard Web

Accede al dashboard en: `http://localhost:3000`

El dashboard muestra:
- Estado de conexión de WhatsApp
- Código QR para conectar
- Estadísticas en tiempo real
- Lista de endpoints disponibles

## Estructura del Proyecto

```
guromensajes/
├── src/
│   ├── services/
│   │   ├── whatsappService.js
│   │   ├── databaseService.js
│   │   └── automationService.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── contacts.js
│   │   ├── messages.js
│   │   ├── automations.js
│   │   └── whatsapp.js
│   └── index.js
├── public/
│   └── index.html
├── data/
│   └── guromensajes.db
├── auth_info/
├── uploads/
├── .env
├── package.json
└── README.md
```

## Integración con tu Aplicación Web

Para consumir este microservicio desde tu aplicación Node.js:

```javascript
const axios = require('axios');

class GuromensajesClient {
    constructor(baseURL = 'http://localhost:3000/api/v1') {
        this.api = axios.create({ baseURL });
    }

    async sendMessage(phone, message) {
        const response = await this.api.post('/messages/send', {
            phone,
            message
        });
        return response.data;
    }

    async getContacts() {
        const response = await this.api.get('/contacts');
        return response.data.contacts;
    }

    async createAutomation(automation) {
        const response = await this.api.post('/automations', automation);
        return response.data;
    }
}

// Uso
const client = new GuromensajesClient();
await client.sendMessage('1234567890', 'Hola desde mi app!');
```

## Licencia

ISC

## Soporte

Para soporte y consultas, contacta al desarrollador.
