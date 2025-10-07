# 📱 Plan de Implementación: Múltiples Instancias WhatsApp

## 🎯 Objetivo
Migrar el sistema actual de una instancia global a un sistema que soporte múltiples números WhatsApp simultáneos.

## 📊 Estado Actual
- ✅ Baileys v6.7.5 instalado (`@whiskeysockets/baileys`)
- ✅ Rutas API preparadas para multi-instancia (líneas 103-265 en index.js)
- ✅ `useMultiFileAuthState` ya implementado
- ❌ Solo maneja una instancia global

## 🔄 Cambios Requeridos

### 1. **WhatsAppInstanceManager** (Nuevo)
```javascript
// src/services/whatsappInstanceManager.js
class WhatsAppInstanceManager {
    constructor(io, database) {
        this.instances = new Map(); // instanceId -> WhatsAppInstance
        this.io = io;
        this.database = database;
    }

    async createInstance(instanceId, settings = {}) {
        if (this.instances.has(instanceId)) {
            throw new Error(`Instancia ${instanceId} ya existe`);
        }

        const instance = new WhatsAppInstance(instanceId, this.io, this.database, settings);
        this.instances.set(instanceId, instance);
        
        // Conectar automáticamente
        await instance.connect();
        return instance;
    }

    getInstance(instanceId) {
        return this.instances.get(instanceId);
    }

    getAllInstances() {
        return Array.from(this.instances.values());
    }

    async deleteInstance(instanceId) {
        const instance = this.instances.get(instanceId);
        if (instance) {
            await instance.disconnect();
            await instance.clearAuthState();
            this.instances.delete(instanceId);
        }
    }
}
```

### 2. **WhatsAppInstance** (Modificar WhatsAppService)
```javascript
// src/services/whatsappInstance.js (basado en whatsappService.js actual)
class WhatsAppInstance {
    constructor(instanceId, io, database, settings = {}) {
        this.instanceId = instanceId;
        this.io = io;
        this.database = database;
        this.settings = settings;
        
        // Directorio de auth específico por instancia
        this.authDir = path.join(__dirname, `../../auth_info/${instanceId}`);
        
        // Estado de la instancia
        this.sock = null;
        this.qrCode = null;
        this.connected = false;
        this.connecting = false;
        
        this.createAuthDir();
    }

    // Métodos similares a WhatsAppService pero contextualizados por instancia
    async connect() { /* ... */ }
    async sendMessage(phone, message, options = {}) { /* ... */ }
    // ... resto de métodos
}
```

### 3. **Actualizar index.js**

#### Reemplazar instancia global:
```javascript
// Antes (línea 47):
this.whatsappService = new WhatsAppService(this.io, this.database);

// Después:
this.whatsappManager = new WhatsAppInstanceManager(this.io, this.database);
```

#### Actualizar rutas de instancias (líneas 107-265):
```javascript
// Crear nueva instancia
this.app.post(`${apiPrefix}/instances`, async (req, res) => {
    try {
        const { instanceId, webhook, settings } = req.body;
        
        if (!instanceId) {
            return res.status(400).json({ 
                success: false, 
                message: 'instanceId es requerido' 
            });
        }
        
        const instance = await this.whatsappManager.createInstance(instanceId, {
            webhook,
            ...settings
        });
        
        res.json({
            success: true,
            message: 'Instancia creada exitosamente',
            instanceId,
            status: 'connecting'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Obtener QR de instancia específica
this.app.get(`${apiPrefix}/instances/:instanceId/qr`, (req, res) => {
    try {
        const { instanceId } = req.params;
        const instance = this.whatsappManager.getInstance(instanceId);
        
        if (!instance) {
            return res.status(404).json({
                success: false,
                message: 'Instancia no encontrada'
            });
        }
        
        const qrCode = instance.getQRCode();
        
        if (qrCode) {
            res.json({ 
                success: true, 
                qr: qrCode,
                instanceId,
                expires_at: new Date(Date.now() + 45000).toISOString()
            });
        } else if (instance.isConnected()) {
            res.json({ 
                success: false, 
                message: 'Instancia ya está conectada'
            });
        } else {
            res.json({ 
                success: false, 
                message: 'QR no disponible'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener QR'
        });
    }
});
```

### 4. **Estructura de Directorios**
```
auth_info/
├── instance_1/
│   ├── creds.json
│   ├── pre-key-*.json
│   └── session-*.json
├── instance_2/
│   ├── creds.json
│   ├── pre-key-*.json
│   └── session-*.json
└── ...
```

### 5. **Base de Datos**
Agregar campo `instance_id` a las tablas:
```sql
ALTER TABLE messages ADD COLUMN instance_id VARCHAR(255);
ALTER TABLE contacts ADD COLUMN instance_id VARCHAR(255);
```

### 6. **WebSocket Events**
Modificar eventos para incluir instanceId:
```javascript
// En lugar de:
this.io.emit('qr_code', qrCode);

// Usar:
this.io.emit(`qr_code_${this.instanceId}`, qrCode);
this.io.emit('instance_update', {
    instanceId: this.instanceId,
    event: 'qr_code',
    data: qrCode
});
```

## 🚀 Pasos de Implementación

### Fase 1: Refactorización Base
1. ✅ Crear `WhatsAppInstanceManager`
2. ✅ Crear `WhatsAppInstance` (basado en `WhatsAppService`)
3. ✅ Actualizar `index.js` para usar el manager

### Fase 2: API Multi-Instancia
1. ✅ Actualizar todas las rutas para usar instancias específicas
2. ✅ Implementar manejo de errores por instancia
3. ✅ Actualizar eventos WebSocket

### Fase 3: Persistencia
1. ✅ Modificar schema de base de datos
2. ✅ Actualizar métodos de guardado para incluir `instance_id`
3. ✅ Cargar instancias existentes al iniciar

### Fase 4: Testing y Optimización
1. ✅ Pruebas con múltiples instancias
2. ✅ Optimización de memoria
3. ✅ Manejo de desconexiones masivas

## ⚡ Consideraciones de Rendimiento

### Memoria:
- Cada instancia consume ~50-100MB
- Limitar instancias simultáneas (máx. 20-50)
- Implementar garbage collection de instancias inactivas

### CPU:
- Usar Workers/Clusters para distribución
- Limitar reconexiones automáticas
- Queue de mensajes por instancia

### Storage:
- Rotación de logs por instancia
- Limpieza automática de auth_info obsoletos
- Backup de credenciales críticas

## 🔧 Configuración Recomendada

```javascript
// .env
MAX_INSTANCES=50
INSTANCE_TIMEOUT=300000  // 5 minutos
AUTO_RECONNECT=true
QUEUE_SIZE_PER_INSTANCE=1000
```

## 📈 Escalabilidad

### Para 100+ instancias:
1. **Docker/Kubernetes**: Múltiples pods con balanceador
2. **Redis**: Cache de estados y cola de mensajes
3. **Database Sharding**: Separar por rangos de instanceId
4. **WebSockets**: Usar Redis Adapter para múltiples procesos

## 🛡️ Seguridad
- Validación de instanceId (formato, caracteres permitidos)
- Rate limiting por instancia
- Aislamiento de directorios auth
- Logs auditables por instancia

## 📋 Compatibilidad con Laravel
- Mantener exactamente las mismas rutas API
- Respuestas JSON idénticas
- Códigos de estado HTTP consistentes
- Headers CORS adecuados
