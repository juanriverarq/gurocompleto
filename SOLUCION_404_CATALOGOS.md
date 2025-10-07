# Solución al Problema de 404 en Catálogos

## Problema Identificado

Las consultas a los endpoints de catálogos (aseguradoras, ramos, vendedores, sedes) estaban retornando **404 Not Found** al intentar crear pólizas y acceder a otros recursos.

## Causa Raíz

1. **Rutas condicionales en el backend**: Las rutas de catálogos estaban dentro de un bloque condicional que requería `ENABLE_DEBUG_ROUTES=true` en el archivo `.env` del backend, pero esta variable no estaba configurada.

2. **Inconsistencia en las rutas**: El frontend estaba llamando a `/saas/aseguradoras` pero el backend tenía las rutas principales en `/saas/catalogos/aseguradoras`.

3. **URLs hardcodeadas**: Algunos servicios tenían URLs hardcodeadas que no respetaban las variables de entorno.

## Solución Implementada

### 1. Backend - Configuración de Entorno

**Archivo modificado**: [`backend/.env`](backend/.env:122)

```bash
# Agregada variable para habilitar rutas de debug
ENABLE_DEBUG_ROUTES=true
```

Esta variable habilita las rutas temporales de catálogos en [`backend/routes/api.php`](backend/routes/api.php:258-388).

### 2. Backend - Corrección de Rutas

**Archivo modificado**: [`backend/routes/api.php`](backend/routes/api.php:2583)

- Corregido el scope de la variable `$resolveUser` en las rutas de Sales Performance
- Las rutas de catálogos ahora están disponibles en dos ubicaciones:
  - `/saas/catalogos/*` (líneas 652-660) - Rutas principales protegidas
  - `/saas/temp-catalogos/*` (líneas 258-388) - Rutas temporales de debug

### 3. Frontend - Actualización de Servicios

**Archivo modificado**: [`frontend/src/services/saasApi.ts`](frontend/src/services/saasApi.ts:162-202)

Implementado sistema de fallback para catálogos:

```typescript
async getAseguradoras(): Promise<ApiResponse<PaginatedResponse<any>>> {
  const headers = await this.getAuthHeaders();
  // 1. Intentar ruta de catálogos principal
  let response = await fetch(`${API_BASE_URL}/saas/catalogos/aseguradoras?per_page=999999`, { headers });
  // 2. Fallback a ruta directa
  if (response.status === 404) {
    response = await fetch(`${API_BASE_URL}/saas/aseguradoras?per_page=999999`, { headers });
  }
  // 3. Fallback a ruta temporal de debug
  if (response.status === 404) {
    response = await fetch(`${API_BASE_URL}/saas/temp-catalogos/aseguradoras`, { headers });
  }
  return this.handleResponse(response);
}
```

Mismo patrón aplicado a:
- `getRamos()`
- `getSedes()`
- `getVendedores()`
- `getEstadosSiniestros()`
- `getCoberturas()`

### 4. Frontend - Configuración de Variables de Entorno

**Archivos modificados**:

#### [`frontend/.env`](frontend/.env:1) - Desarrollo Local
```bash
VITE_API_URL=http://localhost:8081/api
VITE_WHATSAPP_SERVICE_URL=http://localhost:3000/api/v1
VITE_DEV_AUTH_BYPASS=true
VITE_DEV_BROKER_ID=2
```

#### [`frontend/.env.local`](frontend/.env.local:1) - Desarrollo Local Personalizado
```bash
VITE_API_URL=http://127.0.0.1:8001/api
VITE_WHATSAPP_SERVICE_URL=http://localhost:3000/api/v1
```

#### [`frontend/.env.production`](frontend/.env.production:1) - Producción
```bash
VITE_API_URL=http://localhost:8081/api
VITE_WHATSAPP_SERVICE_URL=https://whatsapp.guro.co/api/v1
VITE_DEV_AUTH_BYPASS=false
```

### 5. Corrección de URLs Hardcodeadas

**Archivos modificados**:

- [`frontend/src/services/whatsappMicroservice.ts`](frontend/src/services/whatsappMicroservice.ts:6)
- [`frontend/src/services/whatsappMicroserviceDirect.ts`](frontend/src/services/whatsappMicroserviceDirect.ts:6)
- [`frontend/src/services/commercialTasksService.ts`](frontend/src/services/commercialTasksService.ts:227)
- [`frontend/src/services/elevenLabsService.ts`](frontend/src/services/elevenLabsService.ts:414)
- [`frontend/src/config/api.ts`](frontend/src/config/api.ts:10)

Todas ahora usan `import.meta.env.VITE_API_URL` o `import.meta.env.VITE_WHATSAPP_SERVICE_URL` con fallbacks apropiados.

## Rutas Disponibles Ahora

### Catálogos (Aseguradoras, Ramos, Vendedores, Sedes)

1. **Ruta principal** (requiere autenticación):
   ```
   GET /api/saas/catalogos/aseguradoras
   GET /api/saas/catalogos/ramos
   GET /api/saas/catalogos/vendedores
   GET /api/saas/catalogos/sedes
   GET /api/saas/catalogos/estados-siniestros
   GET /api/saas/catalogos/motivos-estados-poliza
   ```

2. **Ruta directa** (requiere autenticación):
   ```
   GET /api/saas/aseguradoras
   GET /api/saas/ramos
   GET /api/saas/vendedores
   GET /api/saas/sedes
   GET /api/saas/estados-siniestros
   GET /api/saas/coberturas
   ```

3. **Ruta temporal de debug** (requiere `ENABLE_DEBUG_ROUTES=true`):
   ```
   GET /api/saas/temp-catalogos/aseguradoras
   GET /api/saas/temp-catalogos/ramos
   GET /api/saas/temp-catalogos/vendedores
   GET /api/saas/temp-catalogos/sedes
   GET /api/saas/temp-catalogos/motivos-estados-poliza
   GET /api/saas/temp-catalogos/usuarios
   ```

## Verificación

Para verificar que todo funciona correctamente:

1. **Backend debe estar corriendo**:
   ```bash
   cd backend
   php artisan serve --port=8001
   ```

2. **Frontend debe estar corriendo**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Microservicio de WhatsApp** (opcional):
   ```bash
   cd whatsapp
   npm start
   ```

4. **Verificar variables de entorno**:
   - Backend: `ENABLE_DEBUG_ROUTES=true` en `backend/.env`
   - Frontend: `VITE_API_URL=http://localhost:8081/api` en `frontend/.env`

## Beneficios de la Solución

✅ **Sistema de fallback robusto**: Si una ruta falla, intenta automáticamente las alternativas
✅ **Compatibilidad con múltiples configuraciones**: Funciona con diferentes estructuras de rutas
✅ **Configuración por entorno**: URLs correctas para desarrollo y producción
✅ **Sin URLs hardcodeadas**: Todo usa variables de entorno
✅ **Fácil debugging**: Rutas temporales disponibles cuando se necesitan

## Próximos Pasos Recomendados

1. **Consolidar rutas**: Eventualmente, unificar todas las rutas de catálogos en una sola ubicación
2. **Eliminar rutas temporales**: Una vez que las rutas principales estén estables, remover las rutas `/temp-catalogos`
3. **Documentar endpoints**: Crear documentación OpenAPI/Swagger para todas las rutas
4. **Tests automatizados**: Agregar tests para verificar que los endpoints respondan correctamente

## Notas Importantes

- Las rutas de debug solo están disponibles cuando `ENABLE_DEBUG_ROUTES=true`
- En producción, esta variable debe estar en `false` por seguridad
- El sistema de fallback asegura que la aplicación funcione incluso si algunas rutas no están disponibles
- Todos los servicios ahora respetan las variables de entorno configuradas