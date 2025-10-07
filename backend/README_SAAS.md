# 🚀 **GURO SaaS Backend - Sistema Multi-Tenant**

## **📋 Descripción**

Backend completo del sistema SaaS GURO para brokers de seguros. Implementa una arquitectura multi-tenant donde cada broker es un tenant independiente con sus propios usuarios, clientes, configuraciones y permisos granulares.

## **🏗️ Arquitectura**

### **Multi-Tenancy**
- **Tenant por Broker**: Cada broker de seguros es un tenant independiente
- **Aislamiento de datos**: Los datos están completamente separados por `broker_id`
- **Configuraciones independientes**: Cada broker tiene su propio branding, límites y configuraciones
- **Planes escalables**: Basic, Professional, Enterprise con diferentes límites

### **Autenticación y Autorización**
- **Laravel Sanctum**: Para autenticación API
- **Permisos granulares**: Control por módulo y acción específica
- **Roles personalizables**: Cada broker puede crear roles customizados
- **Middleware SaaS**: Verificación automática de tenant y permisos

## **📊 Base de Datos**

### **Tablas Principales**

#### **broker_tenants**
```sql
- id (UUID): Identificador único del broker
- nombre: Razón social del broker
- nit: NIT único del broker
- email: Email principal
- branding (JSON): Logo, colores, favicon, slogan
- plan: basic|professional|enterprise
- configuraciones (JSON): Módulos activos, límites, integraciones
- facturacion (JSON): Estado de pago, método, vencimiento
```

#### **saas_usuarios**
```sql
- id (UUID): Identificador único del usuario
- broker_id (UUID): Referencia al tenant
- email: Email único del usuario
- rol: super_admin|admin|supervisor|asesor|vendedor|custom
- permisos (JSON): Permisos granulares por módulo
- asignaciones (JSON): Clientes, territorios, equipo
```

#### **saas_clientes**
```sql
- id (UUID): Identificador único del cliente
- broker_id (UUID): Referencia al tenant
- codigo_cliente: Código único por broker (P000001, E000001, C000001)
- tipo: PERSONA|EMPRESA|CONSORCIO
- persona/empresa/consorcio (JSON): Datos específicos por tipo
- asesor_asignado_id: Usuario responsable
```

#### **saas_roles_personalizados**
```sql
- id (UUID): Identificador único del rol
- broker_id (UUID): Referencia al tenant
- nombre: Nombre del rol personalizado
- permisos (JSON): Estructura completa de permisos
```

## **🔐 Sistema de Permisos**

### **Estructura de Permisos**
```json
{
  "dashboard": {
    "ver_metricas_generales": boolean,
    "ver_metricas_equipo": boolean,
    "ver_metricas_propias": boolean
  },
  "clientes": {
    "ver_todos": boolean,
    "ver_propios": boolean,
    "ver_equipo": boolean,
    "crear": boolean,
    "editar": boolean,
    "eliminar": boolean,
    "exportar": boolean,
    "importar": boolean
  },
  "polizas": {
    "ver_todas": boolean,
    "ver_propias": boolean,
    "ver_equipo": boolean,
    "crear": boolean,
    "editar": boolean,
    "eliminar": boolean,
    "renovar": boolean,
    "cancelar": boolean
  },
  // ... más módulos
}
```

### **Roles Predeterminados**

#### **Super Admin**
- Acceso completo a todo el sistema
- Gestión de configuraciones del broker
- Administración de usuarios y permisos

#### **Admin**
- Gestión de usuarios y clientes
- Acceso a reportes y métricas generales
- Configuración de la empresa

#### **Supervisor**
- Gestión de su equipo de asesores
- Métricas del equipo
- Clientes asignados al equipo

#### **Asesor**
- Gestión de clientes propios
- Creación y edición de pólizas
- Métricas personales

#### **Vendedor**
- Creación de clientes y pólizas
- Acceso limitado a reportes

## **🛠️ API Endpoints**

### **Autenticación SaaS**
```
POST /api/saas/auth/login
POST /api/saas/auth/logout
POST /api/saas/auth/refresh
GET  /api/saas/auth/me
```

### **Dashboard**
```
GET /api/saas/dashboard
- Métricas principales
- Gráficos interactivos
- Actividad reciente
- Alertas del sistema
- Accesos rápidos
```

### **Clientes**
```
GET    /api/saas/clientes              # Lista con filtros y paginación
POST   /api/saas/clientes              # Crear cliente [clientes.crear]
GET    /api/saas/clientes/{id}         # Ver cliente específico
PUT    /api/saas/clientes/{id}         # Actualizar cliente [clientes.editar]
DELETE /api/saas/clientes/{id}         # Eliminar cliente [clientes.eliminar]
POST   /api/saas/clientes/{id}/asignar-asesor  # Asignar asesor
GET    /api/saas/clientes/exportar/excel       # Exportar [clientes.exportar]
```

### **Usuarios**
```
GET    /api/saas/usuarios              # Lista de usuarios [usuarios.ver]
POST   /api/saas/usuarios              # Crear usuario [usuarios.crear]
PUT    /api/saas/usuarios/{id}/permisos # Actualizar permisos [usuarios.gestionar_roles]
```

### **Configuración**
```
GET /api/saas/configuracion             # Ver configuración
PUT /api/saas/configuracion/empresa     # Actualizar empresa [configuracion.empresa]
PUT /api/saas/configuracion/branding    # Actualizar branding [configuracion.empresa]
PUT /api/saas/configuracion/sistema     # Configuración sistema [configuracion.sistema]
```

## **🔧 Middleware**

### **SaasAuth**
```php
// Verificación básica de tenant activo
Route::middleware(['auth:sanctum', 'saas.auth'])

// Verificación con permisos específicos
Route::middleware(['saas.auth:clientes.crear'])
Route::middleware(['saas.auth:usuarios.gestionar_roles'])
```

## **📦 Modelos Principales**

### **BrokerTenant**
```php
// Relaciones
$broker->usuarios()
$broker->clientes()
$broker->rolesPersonalizados()

// Métodos de negocio
$broker->puedeCrearUsuario()
$broker->puedeCrearCliente()
$broker->tieneModuloActivo('clientes')
$broker->generarDominio()
```

### **SaasUsuario**
```php
// Verificación de permisos
$usuario->tienePermiso('clientes', 'crear')
$usuario->puedeAccederModulo('dashboard')
$usuario->esRol('admin')
$usuario->esSuperAdmin()

// Relaciones
$usuario->brokerTenant()
$usuario->clientesAsignados()
$usuario->clientesSupervisados()
```

### **SaasCliente**
```php
// Datos específicos por tipo
$cliente->persona          // Para tipo PERSONA
$cliente->empresa          // Para tipo EMPRESA  
$cliente->consorcio        // Para tipo CONSORCIO

// Métodos de utilidad
$cliente->nombre_completo
$cliente->documento_identificacion
$cliente->asignarAsesor($asesorId)
$cliente->agregarTag($tag)
```

## **🌱 Seeders**

### **Datos de Prueba**
El sistema incluye 3 brokers de ejemplo:

1. **Seguros Integrales S.A.S.** (Plan Enterprise)
   - Email: admin@segurosintegrales.com
   - Password: password123

2. **Corredores Unidos Ltda.** (Plan Professional)  
   - Email: contacto@corredoresunidos.com
   - Password: password123

3. **Asesoría en Seguros Pérez** (Plan Basic)
   - Email: info@segurosperez.com
   - Password: password123

### **Usuarios por Broker**
- 1 Super Admin
- 1 Admin (Gerente)
- 1 Supervisor
- 3 Asesores
- 1 Vendedor

### **Clientes de Ejemplo**
- Personas naturales
- Empresas
- Consorcios

## **🚀 Instalación y Configuración**

### **1. Ejecutar Migraciones**
```bash
cd backend
php artisan migrate:fresh --seed
```

### **2. Configurar Middleware**
El middleware `saas.auth` ya está registrado en `bootstrap/app.php`

### **3. Verificar Datos**
```bash
php artisan tinker
>>> App\Models\SaaS\BrokerTenant::count()  // Debe ser 3
>>> App\Models\SaaS\SaasUsuario::count()   // Debe ser 21
>>> App\Models\SaaS\SaasCliente::count()   // Debe ser 12
```

## **🔒 Seguridad**

### **Aislamiento de Datos**
- Todos los queries incluyen automáticamente `broker_id`
- Middleware verifica tenant activo en cada request
- Usuarios solo pueden acceder a datos de su broker

### **Verificación de Permisos**
- Permisos granulares por módulo y acción
- Verificación automática en rutas protegidas
- Roles personalizables por tenant

### **Validaciones**
- Límites por plan (usuarios, clientes, almacenamiento)
- Estados de tenant y usuario
- Verificación de facturación

## **📈 Métricas y Dashboard**

### **Métricas Principales**
- Total de clientes (con filtros por permisos)
- Clientes activos
- Total de pólizas (mock)
- Usuarios del sistema
- Comisiones generadas (mock)
- Prima total (mock)

### **Gráficos**
- Clientes por mes
- Clientes por tipo
- Clientes por asesor (si tiene permisos)

### **Actividad Reciente**
- Nuevos clientes registrados
- Nuevos usuarios (si tiene permisos)
- Ordenado por fecha

### **Alertas del Sistema**
- Límites del plan alcanzados (90%+)
- Problemas de facturación
- Estado del tenant

## **🔮 Extensibilidad**

### **Agregar Nuevos Módulos**
1. Crear migración para nueva tabla
2. Agregar permisos al array de permisos base
3. Crear controlador con middleware `saas.auth`
4. Implementar verificaciones de permisos

### **Personalizar Planes**
Modificar el método `getLimitesPorPlan()` en `BrokerTenant`

### **Nuevos Roles**
Los brokers pueden crear roles personalizados desde la interfaz

## **🧪 Testing**

### **Credenciales de Prueba**
```
Email: admin@segurosintegrales.com
Password: password123
Tenant: Seguros Integrales S.A.S. (Enterprise)

Email: contacto@corredoresunidos.com  
Password: password123
Tenant: Corredores Unidos Ltda. (Professional)

Email: info@segurosperez.com
Password: password123
Tenant: Asesoría en Seguros Pérez (Basic)
```

### **Endpoints de Prueba**
```bash
# Login
POST /api/saas/auth/login
{
  "email": "admin@segurosintegrales.com",
  "password": "password123"
}

# Dashboard
GET /api/saas/dashboard
Authorization: Bearer {token}

# Clientes  
GET /api/saas/clientes
Authorization: Bearer {token}
```

## **📝 Notas Importantes**

1. **UUIDs**: Todos los IDs son UUIDs para mayor seguridad
2. **JSON Fields**: Se usan campos JSON para flexibilidad en configuraciones
3. **Soft Deletes**: No implementado, se usa estado INACTIVO
4. **Códigos de Cliente**: Únicos por broker con prefijo por tipo
5. **Branding**: Cada broker puede personalizar colores, logo, favicon
6. **Escalabilidad**: Preparado para miles de brokers y millones de clientes

El sistema está **completamente funcional** y listo para integración con el frontend React. 