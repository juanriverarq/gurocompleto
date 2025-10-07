# 🛡️ Arquitectura de Roles y Permisos - Documentación Técnica

## 📋 Resumen Ejecutivo

Esta documentación describe la arquitectura completa de roles y permisos implementada en el sistema SaaS de seguros, incluyendo las mejoras de seguridad realizadas para eliminar vulnerabilidades críticas.

## 🏗️ Arquitectura General

### Componentes Principales

1. **Modelos de Usuario**
   - `User`: Usuarios Firebase (MASTER/ADMIN)
   - `EmpleadoBroker`: Empleados con roles específicos
   - `RolBroker`: Sistema granular de roles y permisos
   - `Broker`: Aislamiento multi-tenant

2. **Middlewares de Seguridad**
   - `SecurityAuthMiddleware`: Autenticación y autorización unificada
   - `SecurityAuditMiddleware`: Auditoría completa de operaciones
   - `UnifiedAuthMiddleware`: Autenticación multi-sistema (legacy)

3. **Servicios**
   - `PermissionService`: Lógica centralizada de permisos con cache

## 👥 Jerarquía de Roles

```
MASTER (Propietario de Broker)
├── ADMIN (Administrador de Agencia)
├── SUPERVISOR (Supervisor)
├── ASESOR (Asesor Comercial)
└── VENDEDOR (Vendedor Básico)
```

### Permisos por Rol

#### MASTER
- **Acceso Total**: `*`
- Gestiona brokers, empleados y configuración global

#### ADMIN
- **Dashboard**: `ver_metricas_generales`, `ver_metricas_equipo`
- **Clientes**: `ver_todos`, `crear`, `editar`, `exportar`
- **Pólizas**: `ver_todas`, `crear`, `editar`
- **Empleados**: `ver`, `crear`, `editar`
- **Configuración**: `empresa`

#### SUPERVISOR
- **Dashboard**: `ver_metricas_equipo`
- **Clientes**: `ver_equipo`, `crear`, `editar`
- **Pólizas**: `ver_equipo`, `crear`
- **Comisiones**: `ver_equipo`

#### ASESOR
- **Clientes**: `crear`, `editar`, `ver_propios`
- **Pólizas**: `crear`, `editar`, `ver_propias`, `renovar`
- **Siniestros**: `crear`, `ver_propios`

#### VENDEDOR
- **Clientes**: `crear`
- **Pólizas**: `crear`

## 🔐 Middlewares de Seguridad

### SecurityAuthMiddleware

**Funciones principales:**
- ✅ Autenticación unificada (Firebase + Empleados)
- ✅ Verificación de permisos con cache
- ✅ Rate limiting inteligente
- ✅ Validación multi-tenant
- ✅ Verificación de estado de usuario
- ✅ Logging de seguridad

**Uso:**
```php
Route::middleware(['security.auth:clientes.crear'])->group(function () {
    Route::post('/clientes', [ClienteController::class, 'store']);
});
```

### SecurityAuditMiddleware

**Funciones principales:**
- 📊 Auditoría completa de operaciones sensibles
- ⏱️ Medición de tiempos de respuesta
- 🚨 Detección de operaciones críticas
- 📝 Logging estructurado con metadatos

**Operaciones auditadas:**
- Creación/edición de empleados
- Gestión de roles y permisos
- Operaciones financieras (wallet, comisiones)
- Cambios en pólizas y siniestros

## 🛠️ PermissionService

### Características

- **Cache inteligente**: 60 minutos TTL para optimización
- **Validación sintaxis**: Verificación de formato `modulo.accion`
- **Múltiples estrategias**: Verificación de uno, todos o ninguno
- **Debugging**: Logs detallados en desarrollo

### Métodos principales

```php
// Verificar permiso específico
$permissionService->hasPermission($user, 'clientes.crear');

// Verificar acceso a módulo
$permissionService->canAccessModule($user, 'clientes');

// Verificar múltiples permisos
$permissionService->hasAnyPermission($user, ['clientes.crear', 'clientes.editar']);

// Limpiar cache al cambiar permisos
$permissionService->clearUserCache($userId);
```

## 🔒 Validaciones de Seguridad

### Rate Limiting

| Endpoint | Límite | Motivo |
|----------|--------|---------|
| Empleados/Roles | 10/min | Operaciones críticas |
| Wallet/Comisiones | 20/min | Datos financieros |
| Otros | 60/min | Operaciones estándar |

### Multi-tenant

- ✅ Verificación automática de `broker_id`
- ✅ Aislamiento de datos por organización
- ✅ Logging de intentos de acceso cruzado
- ✅ Validación de propiedad de recursos

### Autenticación

- ✅ JWT Firebase para usuarios web
- ✅ JWT HS256 para empleados móviles
- ✅ Fallback a tokens base64 (legacy)
- ✅ Verificación de expiración automática

## 📊 Auditoría y Monitoreo

### Tabla `audit_logs`

```sql
CREATE TABLE audit_logs (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NULL,
    empleado_id BIGINT NULL,
    broker_id BIGINT NOT NULL,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id BIGINT NULL,
    method VARCHAR(10) NOT NULL,
    url TEXT NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT NULL,
    status_code INT NOT NULL,
    response_time_ms DECIMAL(8,2) NULL,
    request_data JSON NULL,
    old_values JSON NULL,
    new_values JSON NULL,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tipos de acciones auditadas

- `create_employee`, `update_employee`, `delete_employee`
- `create_policy`, `update_policy`, `delete_policy`
- `create_claim`, `update_claim`, `delete_claim`
- `wallet_transaction`, `commission_payment`

## 🚀 Mejoras Implementadas

### Sesión de Mejoras - Septiembre 2025

#### ✅ Funcionalidades de Gestión de Empleados
- **Cambio de contraseña**: Endpoint seguro para administradores
- **Contraseña temporal**: Generación automática para nuevos empleados
- **Reset de contraseña**: Funcionalidad de recuperación para admins
- **Interfaz mejorada**: Pestañas separadas para información y seguridad

#### ✅ Backend - Controladores Mejorados
- **EmpleadosBrokerController**: Métodos completos CRUD + gestión de passwords
- **EmpleadoAuthController**: Autenticación robusta con Firebase Custom Tokens
- **Rutas protegidas**: Todas las operaciones de empleados requieren permisos específicos

#### ✅ Frontend - UX Mejorada
- **EditarEmpleado.tsx**: Interfaz con pestañas (Información General / Seguridad)
- **useEmpleadosBroker**: Hook completo con funciones de gestión de contraseñas
- **Validaciones**: Formularios con confirmación de contraseña y validaciones

### Antes vs Después

| Aspecto | Antes | Después |
|---------|-------|---------|
| Middlewares | 4 diferentes | 1 unificado + auditoría |
| Rutas expuestas | 15+ vulnerables | 0 rutas peligrosas |
| Validación permisos | Hardcodeada | Servicio centralizado |
| Rate limiting | Inconsistente | Inteligente por endpoint |
| Auditoría | Limitada | Completa con metadatos |
| Cache | No implementado | Optimizado con TTL |
| Multi-tenant | Parcial | Validación completa |
| Gestión empleados | Básica | Completa con seguridad |
| Cambio passwords | No implementado | Seguro con validaciones |

## 📝 Guía de Uso

### Para Desarrolladores

#### 1. Agregar nuevo permiso

```php
// En RolBroker.php - PERMISOS_DISPONIBLES
'reportes' => [
    'label' => 'Reportes',
    'icon' => 'solar:chart-square-bold-duotone',
    'permisos' => ['ver', 'generar', 'exportar', 'programar']
]
```

#### 2. Proteger ruta

```php
// En routes/api.php
Route::middleware(['security.auth:reportes.generar'])->group(function () {
    Route::get('/reportes/generar', [ReportesController::class, 'generar']);
});
```

#### 3. Verificar permisos en controlador

```php
public function generarReporte(Request $request)
{
    // Verificación automática por middleware
    // El middleware ya validó permisos

    $user = $request->get('authenticated_user');
    $brokerId = $request->get('broker_id');

    // Lógica del controlador...
}
```

### Para Administradores

#### Gestión de Roles

1. **Crear rol**: POST `/api/saas/roles`
2. **Asignar permisos**: PUT `/api/saas/roles/{id}`
3. **Asignar a empleado**: PUT `/api/saas/empleados/{id}/rol`

#### Gestión de Empleados

1. **Crear empleado**: POST `/api/saas/empleados`
2. **Cambiar contraseña**: PUT `/api/saas/empleados/{id}/cambiar-password`
3. **Generar contraseña temporal**: POST `/api/saas/empleados/{id}/generar-password-temporal`
4. **Resetear contraseña**: POST `/api/saas/empleados/{id}/reset-password`
5. **Actualizar empleado**: PUT `/api/saas/empleados/{id}`

#### Monitoreo

1. **Ver logs de auditoría**: GET `/api/saas/audit/logs`
2. **Estadísticas de seguridad**: GET `/api/saas/audit/stats`
3. **Alertas de seguridad**: GET `/api/saas/audit/security-alerts`

## 🔧 Configuración

### Variables de entorno

```env
# Seguridad
ENABLE_DEBUG_ROUTES=false
EMPLOYEE_JWT_SECRET=your_secret_here

# Rate Limiting
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Auditoría
AUDIT_RETENTION_DAYS=90
AUDIT_SENSITIVE_ACTIONS=empleados,roles,wallet,comisiones
```

### Cache

```php
// Configuración en config/cache.php
'permission_cache_ttl' => env('PERMISSION_CACHE_TTL', 3600), // 1 hora
```

## 🚨 Alertas de Seguridad

### Críticas
- 🔴 Rutas sin middleware de seguridad
- 🔴 Permisos hardcodeados en controladores
- 🔴 Falta validación multi-tenant
- 🔴 **Token de autenticación expirado o inválido**

### Advertencias
- 🟡 Rate limiting desactivado
- 🟡 Cache de permisos expirado
- 🟡 Auditoría no configurada
- 🟡 **Sesión de usuario expirada**

### Información
- ℹ️ Nuevos permisos asignados
- ℹ️ Cambios en jerarquía de roles
- ℹ️ Operaciones de alto riesgo detectadas

## 🔧 Solución de Problemas de Autenticación

### Error 401 - Usuario no autenticado

**Síntomas:**
- Errores 401 en rutas `/api/saas/empleados`, `/api/saas/roles`
- Mensaje "sesión expirada"

**Causas posibles:**
1. Token JWT expirado
2. Token no enviado en headers
3. Problemas con Firebase Auth
4. Sesión de empleado inválida

**Diagnóstico:**

```bash
# Verificar estado de autenticación
GET /api/debug-auth-status

# Verificar middleware unificado
GET /api/test-unified-middleware
```

**Soluciones:**

1. **Renovar token desde Firebase:**
   ```javascript
   // Frontend - renovar token
   const token = await firebase.auth().currentUser.getIdToken(true);
   localStorage.setItem('authToken', token);
   ```

2. **Verificar headers de petición:**
   ```javascript
   headers: {
     'Authorization': `Bearer ${token}`,
     'Content-Type': 'application/json'
   }
   ```

3. **Para empleados - verificar login:**
   ```javascript
   // Usar endpoint de empleado-auth
   POST /api/empleado-auth/login
   ```

### Rutas de Debug Disponibles

- `GET /api/debug-auth-status` - Estado general de autenticación
- `GET /api/test-unified-middleware` - Verificación de middleware unificado
- `GET /api/debug/user-status` - Estado de usuario Firebase
- `GET /api/debug/unified-auth-check` - Verificación completa de auth

## 📈 Próximas Mejoras

### Fase 2 (1-2 meses)
- [ ] Implementar 2FA obligatorio para admins
- [ ] Crear dashboard de administración de permisos
- [ ] Migrar a OAuth 2.0 para APIs externas
- [ ] Implementar permisos temporales (time-based)

### Fase 3 (3-6 meses)
- [ ] Sistema de aprobación para cambios críticos
- [ ] Análisis de comportamiento con IA
- [ ] Integración con SIEM
- [ ] Zero-trust architecture

## 📞 Soporte

Para soporte técnico:
- **Email**: security@guro.app
- **Slack**: #seguridad-backend
- **Docs**: `/docs/seguridad/roles-permisos`

---

**Versión**: 2.1.0
**Fecha**: Septiembre 2025
**Autor**: Equipo de Seguridad GURO
**Última actualización**: Funcionalidades completas de gestión de empleados