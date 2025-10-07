# 📱 Instrucciones para Ejecutar Campañas WhatsApp

## ⚠️ PROBLEMA ACTUAL

Tus campañas tienen `"whatsapp_instance_id": null`, lo que significa que **NO tienen una instancia de WhatsApp asignada**.

### Campañas Afectadas
- Campaña #73: `"whatsapp_instance_id": null` ❌
- Campaña #72: `"whatsapp_instance_id": null` ❌  
- Campaña #65: `"whatsapp_instance_id": null` ❌

## ✅ SOLUCIÓN RÁPIDA

### Opción A: Asignar Instancia Manualmente (RECOMENDADO)

```bash
cd backend

# Ver instancias disponibles
php artisan tinker --execute="App\Models\WhatsAppInstance::where('broker_id', 21)->where('is_active', true)->get(['id', 'instance_id', 'status'])"

# Asignar instancia a campaña #73
php artisan tinker --execute="App\Models\Campaign::where('id', 73)->update(['whatsapp_instance_id' => 26]); echo 'Campaña actualizada';"

# Asignar instancia a campaña #72
php artisan tinker --execute="App\Models\Campaign::where('id', 72)->update(['whatsapp_instance_id' => 26]); echo 'Campaña actualizada';"
```

### Opción B: Desde la UI (Cuando Edites la Campaña)

1. Ve a "Gestión de Campañas"
2. Edita la campaña
3. Selecciona una instancia de WhatsApp del dropdown
4. Guarda los cambios
5. Ejecuta la campaña

## 🔧 Por Qué No Funcionó

El código tiene lógica de fallback para seleccionar automáticamente una instancia cuando `whatsapp_instance_id` es `null`:

```php
// Línea 1266-1303 en CampaignController.php
if (!$instanceId && $campaign) {
    $autoInstance = WhatsAppInstance::query()
        ->where('broker_id', $campaign->broker_id)
        ->whereNotNull('instance_id')
        ->where('is_active', true)
        ->orderByDesc('updated_at')
        ->first();
    
    if ($autoInstance) {
        // Usar esta instancia
        $this->ensureInstanceExistsInMicroservice($autoInstance);
    } else {
        // ERROR: No hay instancias
        return ['success' => false, 'error' => 'No hay instancias...'];
    }
}
```

**Problema**: El código encuentra la instancia en BD, pero:
1. La sincroniza con el microservicio ✅
2. Pero luego verifica si está `connected` en el microservicio
3. Si no está conectada, retorna error ❌

## 🚀 Solución Definitiva

Voy a modificar el código para que:
1. Busque instancia automática
2. La sincronice con microservicio
3. **Espere a que se conecte** (si tiene credenciales)
4. Si se conecta, envíe los mensajes
5. Si no se conecta, retorne error claro

## 📋 Pasos Inmediatos

### 1. Sincronizar Instancias

```bash
cd backend
php sync_whatsapp_instances.php
```

### 2. Asignar Instancia a Campañas

```bash
# Asignar instancia 26 (instance_21_rjcT8nft) a todas las campañas sin instancia
php artisan tinker --execute="App\Models\Campaign::whereNull('whatsapp_instance_id')->where('broker_id', 21)->update(['whatsapp_instance_id' => 26]); echo 'Campañas actualizadas';"
```

### 3. Verificar Instancia Conectada

```bash
curl http://localhost:3000/api/v1/instances/instance_21_rjcT8nft/status
```

Debe mostrar: `"connected": true`

### 4. Ejecutar Campaña

Desde la UI o:

```bash
curl -X POST https://api.guro.co/api/saas/campaigns/73/execute-now \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json"
```

## 📊 Verificar Resultados

Después de ejecutar, verifica:

```bash
# Ver mensajes de la campaña
cd backend
php artisan tinker --execute="App\Models\CampaignMessage::where('campaign_id', 73)->get(['id', 'recipient_phone', 'status', 'sent_at'])"
```

Deberías ver:
- `status: 'sent'` ✅
- `sent_at: '2025-10-04 ...'` ✅

## 🔍 Debugging

Si sigue sin funcionar, revisa los logs:

```bash
# Logs del backend
tail -f backend/storage/logs/laravel.log | grep "CAMPAIGN\|BULK"

# Logs del microservicio  
# (Ver Terminal 3)
```

Busca:
- `🚀 [WHATSAPP BULK SEND]` - Inicio de envío
- `🚀 [BULK ENDPOINT]` - Solicitud recibida en microservicio
- `✅ Mensaje enviado exitosamente` - Confirmación de envío

---

**Próximo paso**: Ejecuta los comandos de la Opción A y luego intenta ejecutar la campaña nuevamente.