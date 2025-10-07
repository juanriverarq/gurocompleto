# Solución: Endpoint de Instancias WhatsApp para Campañas

## Problema Identificado

El endpoint `/api/saas/campaigns/available-whatsapp-instances` está siendo capturado por la ruta `/{id}` que ejecuta el método `show()` del `CampaignController`, causando el error:

```json
{
    "success": false,
    "message": "Campaña no encontrada",
    "error": "No query results for model [App\\Models\\Campaign] available-whatsapp-instances"
}
```

## Causa Raíz

Laravel está interpretando "available-whatsapp-instances" como un parámetro `{id}` debido a:
1. **Cache de rutas en producción** que no refleja el orden correcto
2. **Falta de restricción numérica** en el parámetro `{id}` de campañas
3. **Orden de registro de rutas** donde las rutas específicas deben ir ANTES de las genéricas

## Solución Implementada

### 1. Patrones Globales de Rutas (Prevención)

Agregado en `backend/routes/api.php` y `backend/routes/api_secure.php`:

```php
// Enforce numeric-only route parameters to prevent static path collisions
Route::pattern('id', '[0-9]+');
Route::pattern('campaign', '[0-9]+');
```

### 2. Alias Estable (Solución Definitiva)

Creado nuevo endpoint que NO colisiona con `/campaigns/{id}`:

**Backend** (`backend/routes/api.php` línea ~1993 y `backend/routes/api_secure.php` línea ~340):
```php
// Alias estable para lista de instancias disponibles (evita colisión con /campaigns/{id})
Route::get('/whatsapp/available-instances', [\App\Http\Controllers\Api\CampaignController::class, 'getAvailableWhatsAppInstances']);
```

**Frontend** (`frontend/src/services/campaignService.ts` línea ~565):
```typescript
async getAvailableWhatsAppInstances(): Promise<...> {
  // 1) Intenta nuevo alias estable
  const aliasEndpoint = '/saas/whatsapp/available-instances';
  try {
    const aliasResp = await this.makeRequest(aliasEndpoint);
    // ... validación y retorno
  } catch (aliasErr) {
    // 2) Fallback al endpoint original
    const fallbackEndpoint = '/saas/campaigns/available-whatsapp-instances';
    // ... fallback
  }
}
```

### 3. Endpoint Original Mantenido (Compatibilidad)

El endpoint original se mantiene para compatibilidad con versiones anteriores del frontend:
```php
Route::get('/available-whatsapp-instances', [\App\Http\Controllers\Api\CampaignController::class, 'getAvailableWhatsAppInstances']);
```

## Instrucciones de Deploy

### En Producción (api.guro.co)

1. **Desplegar cambios de backend**:
   ```bash
   # Subir archivos modificados
   - backend/routes/api.php
   - backend/routes/api_secure.php
   - backend/app/Http/Controllers/Api/CampaignController.php
   ```

2. **Limpiar cache de rutas** (CRÍTICO):
   ```bash
   cd /ruta/a/backend/en/produccion
   php artisan route:clear
   php artisan cache:clear
   php artisan config:clear
   php artisan optimize:clear
   ```

3. **Verificar registro de rutas**:
   ```bash
   php artisan route:list | grep "saas/campaigns"
   php artisan route:list | grep "saas/whatsapp"
   ```

4. **Desplegar frontend**:
   ```bash
   # Subir archivo modificado
   - frontend/src/services/campaignService.ts
   
   # Rebuild si es necesario
   cd frontend
   npm run build
   ```

### Verificación Post-Deploy

1. **Probar alias nuevo** (debe responder 200):
   ```bash
   curl -X GET "https://api.guro.co/api/saas/whatsapp/available-instances" \
     -H "Authorization: Bearer TU_TOKEN_FIREBASE" \
     -H "Content-Type: application/json"
   ```

2. **Probar endpoint original** (debe responder 200):
   ```bash
   curl -X GET "https://api.guro.co/api/saas/campaigns/available-whatsapp-instances" \
     -H "Authorization: Bearer TU_TOKEN_FIREBASE" \
     -H "Content-Type: application/json"
   ```

3. **Verificar en UI**:
   - Ir a https://guro.co/apps/saas/configuracion-masiva
   - Abrir modal "Crear Campaña"
   - Verificar que el dropdown de "Instancia de WhatsApp" muestre las instancias con sus estados

## Endpoints Disponibles

### Nuevo (Recomendado)
```
GET /api/saas/whatsapp/available-instances
```
- ✅ No colisiona con rutas de campañas
- ✅ Semánticamente correcto (bajo /whatsapp)
- ✅ Filtrado automático por broker del usuario autenticado
- ✅ Consulta estado LIVE en microservicio

### Original (Compatibilidad)
```
GET /api/saas/campaigns/available-whatsapp-instances
```
- ⚠️ Puede colisionar si cache de rutas no está actualizado
- ✅ Mantenido para compatibilidad con frontend antiguo
- ✅ Mismo handler que el alias nuevo

## Respuesta Esperada

```json
{
  "success": true,
  "data": [
    {
      "id": 21,
      "instance_id": "instance_21_dKP0tITH",
      "phone_number": "+573001234567",
      "status": "connected",
      "name": "+573001234567",
      "display_name": "+573001234567",
      "connected": true
    }
  ],
  "total": 1
}
```

## Diagnóstico de Problemas

### Si el endpoint sigue devolviendo error 404 o "Campaña no encontrada"

1. **Verificar cache de rutas**:
   ```bash
   # En producción
   php artisan route:clear
   php artisan optimize:clear
   
   # Verificar que las rutas se registraron correctamente
   php artisan route:list | grep "available"
   ```

2. **Verificar orden de rutas en api.php**:
   - Las rutas específicas (`/available-whatsapp-instances`) DEBEN estar ANTES de `/{id}`
   - Verificar que `Route::pattern('id', '[0-9]+')` esté al inicio del archivo

3. **Verificar logs de Laravel**:
   ```bash
   tail -f storage/logs/laravel.log | grep "CAMPAIGN"
   ```

### Si el frontend no muestra instancias

1. **Abrir consola del navegador** (F12) y buscar:
   ```
   [WHATSAPP SERVICE] Calling endpoint
   [WHATSAPP SERVICE] Response received
   ```

2. **Verificar que el token Firebase sea válido**:
   - El token debe estar en el header `Authorization: Bearer ...`
   - Verificar que no haya expirado (tokens Firebase expiran cada hora)

3. **Verificar que existan instancias en BD**:
   ```sql
   SELECT id, instance_id, phone_number, status, is_active, broker_id 
   FROM whats_app_instances 
   WHERE broker_id = TU_BROKER_ID 
   AND is_active = 1;
   ```

## Archivos Modificados

1. `backend/routes/api.php` - Patrones globales y alias
2. `backend/routes/api_secure.php` - Patrones globales y alias
3. `frontend/src/services/campaignService.ts` - Lógica de fallback
4. `backend/app/Http/Controllers/Api/CampaignController.php` - Ya tenía el método correcto

## Próximos Pasos

1. ✅ Deploy de cambios en producción
2. ✅ Limpiar cache de rutas
3. ✅ Verificar endpoint con curl
4. ✅ Probar creación de campaña desde UI
5. ⏳ Verificar ejecución de campaña y sincronización con Baileys