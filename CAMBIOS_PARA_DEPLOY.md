# 🚀 Cambios para Desplegar a Producción

## 📋 Resumen

Se implementó sincronización automática entre Laravel y el microservicio WhatsApp. Los cambios están en tu entorno **local** y necesitan desplegarse a **producción** (api.guro.co).

---

## 📁 Archivos Modificados

### Backend Laravel

#### 1. [`backend/app/Http/Controllers/Api/WhatsAppInstanceController.php`](backend/app/Http/Controllers/Api/WhatsAppInstanceController.php:74)
**Líneas 74-145**: Sincronización automática al crear instancia
- Crea instancia en microservicio automáticamente
- Verifica estado de conexión
- Actualiza estado en BD

#### 2. [`backend/app/Http/Controllers/Api/CampaignController.php`](backend/app/Http/Controllers/Api/CampaignController.php:1)
**Múltiples cambios**:

**a) Líneas 303-336**: Auto-asignación al crear campaña inmediata
```php
// Busca instancia automáticamente si no se especificó
if (!$whatsappInstanceId) {
    $autoInstance = WhatsAppInstance::query()
        ->where('broker_id', $brokerId)
        ->where('is_active', true)
        ->first();
    
    if ($autoInstance) {
        $whatsappInstanceId = $autoInstance->id;
        $this->ensureInstanceExistsInMicroservice($autoInstance);
    }
}
```

**b) Líneas 480-513**: Auto-asignación al crear campaña programada
(Misma lógica que campaña inmediata)

**c) Líneas 1254**: Sincronización al ejecutar con instancia específica
```php
$this->ensureInstanceExistsInMicroservice($whatsappInstance);
```

**d) Líneas 1264-1307**: Auto-asignación y sincronización al ejecutar sin instancia
```php
if (!$instanceId && $campaign) {
    $autoInstance = WhatsAppInstance::query()
        ->where('broker_id', $campaign->broker_id)
        ->where('is_active', true)
        ->first();
    
    if ($autoInstance) {
        // Asignar automáticamente
        $campaign->update(['whatsapp_instance_id' => $autoInstance->id]);
        
        // Sincronizar
        $this->ensureInstanceExistsInMicroservice($autoInstance);
    }
}
```

**e) Líneas 1363-1406**: Logs mejorados en envío masivo

**f) Líneas 1657-1740**: Logs mejorados en executeNow()

**g) Líneas 2689-2775**: Nuevo método `ensureInstanceExistsInMicroservice()`
```php
private function ensureInstanceExistsInMicroservice(WhatsAppInstance $instance): bool
{
    // Verifica si existe en microservicio
    // Si no existe, la crea automáticamente
    // Espera 2 segundos para conexión
    // Actualiza estado en BD
}
```

### Microservicio WhatsApp

#### 3. [`whatsapp/src/index.js`](whatsapp/src/index.js:379)
**Líneas 379-445**: Logs mejorados en endpoint `/send-bulk`
- Logs detallados de solicitudes
- Logs de estado de instancia
- Logs de resultados de envío
- Usa método optimizado `sendBulkMessages()`

---

## 🔧 Cómo Desplegar

### Opción A: Usando Scripts de Deploy

```bash
# Backend
cd deploy
./backend_scp.sh

# Microservicio WhatsApp
./whatsapp_scp.sh
```

### Opción B: Manual

```bash
# 1. Subir archivos modificados al servidor
scp backend/app/Http/Controllers/Api/WhatsAppInstanceController.php usuario@api.guro.co:/ruta/backend/app/Http/Controllers/Api/
scp backend/app/Http/Controllers/Api/CampaignController.php usuario@api.guro.co:/ruta/backend/app/Http/Controllers/Api/

scp whatsapp/src/index.js usuario@api.guro.co:/ruta/whatsapp/src/

# 2. En el servidor, reiniciar servicios
ssh usuario@api.guro.co
cd /ruta/whatsapp
pm2 restart whatsapp-service

# Laravel no necesita reinicio (PHP interpreta en cada request)
```

### Opción C: Git Push

```bash
# 1. Commit cambios
git add backend/app/Http/Controllers/Api/WhatsAppInstanceController.php
git add backend/app/Http/Controllers/Api/CampaignController.php
git add whatsapp/src/index.js
git commit -m "feat: Sincronización automática WhatsApp - Laravel ↔ Microservicio"

# 2. Push a producción
git push origin main

# 3. En servidor, pull y reiniciar
ssh usuario@api.guro.co
cd /ruta/proyecto
git pull
cd whatsapp && pm2 restart whatsapp-service
```

---

## ✅ Verificación Post-Deploy

### 1. Verificar que los cambios se aplicaron

```bash
# En el servidor
ssh usuario@api.guro.co

# Verificar que el método existe
grep -n "ensureInstanceExistsInMicroservice" /ruta/backend/app/Http/Controllers/Api/CampaignController.php

# Debe mostrar la línea donde está el método
```

### 2. Probar creación de campaña

```bash
# Crear campaña SIN especificar whatsapp_instance_id
curl -X POST https://api.guro.co/api/saas/campaigns/immediate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Auto-Asignación",
    "message_template": "Hola {nombre}",
    "contacts": [{"phone": "3001234567", "name": "Test"}]
  }'
```

**Resultado esperado**:
```json
{
    "whatsapp_instance_id": 26  ← ✅ NO debe ser null
}
```

### 3. Verificar logs

```bash
# En servidor
tail -f /ruta/backend/storage/logs/laravel.log | grep "AUTO SYNC\|CREATE CAMPAIGN"
```

Deberías ver:
```
🔍 [CREATE CAMPAIGN] No se especificó instancia, buscando automáticamente...
✅ [CREATE CAMPAIGN] Instancia asignada automáticamente
```

---

## 🎯 Resultado Esperado Después del Deploy

### Crear Campaña
```
POST /api/saas/campaigns/immediate
{
    "name": "Mi Campaña",
    "message_template": "Hola {nombre}",
    "contacts": [...]
    // SIN whatsapp_instance_id
}

Respuesta:
{
    "whatsapp_instance_id": 26  ← ✅ Asignado automáticamente
}
```

### Ejecutar Campaña
```
POST /api/saas/campaigns/73/execute-now

Logs:
🔍 [CAMPAIGN SEND] Buscando instancia automática
✅ [CAMPAIGN SEND] Instancia encontrada
💾 [CAMPAIGN SEND] Asignando automáticamente
🔄 [AUTO SYNC] Verificando en microservicio
✅ [AUTO SYNC] Instancia sincronizada
🚀 [WHATSAPP BULK SEND] Enviando mensajes...
📊 [BULK ENDPOINT] Envío completado: { successful: 2, failed: 0 }

Respuesta:
{
    "results": {
        "sent": 2,      ← ✅ Mensajes enviados
        "failed": 0,
        "total": 2
    }
}
```

---

## 📝 Checklist de Deploy

- [ ] Hacer backup de archivos actuales en producción
- [ ] Subir archivos modificados
- [ ] Reiniciar microservicio WhatsApp
- [ ] Verificar logs de Laravel
- [ ] Crear campaña de prueba
- [ ] Verificar que `whatsapp_instance_id` NO es null
- [ ] Ejecutar campaña de prueba
- [ ] Verificar que mensajes se envían (`sent > 0`)

---

## ⚠️ Importante

**Los cambios están en LOCAL**, no en PRODUCCIÓN (api.guro.co).

Por eso sigues viendo `"whatsapp_instance_id": null` - estás probando en el servidor de producción que aún no tiene los cambios.

**Opciones**:
1. Desplegar cambios a producción
2. O probar en local: http://localhost:8001/api/saas/campaigns

---

**Fecha**: 2025-10-04  
**Estado**: ✅ Cambios listos para deploy  
**Acción requerida**: Desplegar a producción