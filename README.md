# GURO - Sistema de Gestión de Seguros

Sistema integral de gestión para corredores de seguros con capacidades avanzadas de IA, automatización y análisis.

## 🚀 Características Principales

### 📊 Gestión de Seguros
- **Pólizas**: Gestión completa de pólizas individuales y colectivas
- **Siniestros**: Seguimiento y gestión de reclamaciones
- **Clientes**: Base de datos centralizada de clientes
- **Renovaciones**: Sistema automatizado de renovaciones
- **Anexos**: Gestión de modificaciones a pólizas

### 🤖 Inteligencia Artificial
- **Asistente IA**: Asistente virtual con DeepSeek
- **Lectura Automática**: Procesamiento de PDFs con OCR
- **Análisis Predictivo**: Modelos de predicción y análisis
- **Recomendaciones**: Sistema de recomendación de productos
- **Ventas Cruzadas**: Identificación de oportunidades

### 📞 Call Center con IA
- **Agentes de Voz**: Integración con ElevenLabs
- **Campañas de Voz**: Gestión de campañas automatizadas
- **Historial de Llamadas**: Seguimiento completo
- **Análisis de Conversaciones**: Métricas y análisis

### 💬 WhatsApp Business
- **Multi-instancia**: Gestión de múltiples números
- **Campañas**: Envío masivo de mensajes
- **Automatizaciones**: Respuestas automáticas
- **Plantillas**: Gestión de plantillas de mensajes

### 📧 Email Marketing
- **Campañas de Email**: Integración con SendGrid
- **Plantillas**: Editor de plantillas personalizables
- **Segmentación**: Segmentación avanzada de clientes
- **Análisis**: Métricas de apertura y conversión

### 💼 Gestión Comercial
- **Pipeline de Ventas**: Embudo de ventas visual
- **Equipos de Ventas**: Gestión de equipos comerciales
- **Metas y Objetivos**: Seguimiento de KPIs
- **Rendimiento**: Análisis de desempeño

### 💰 Comisiones y Cartera
- **Comisiones por Póliza**: Cálculo automático
- **Anticipos y Ajustes**: Gestión de anticipos
- **Estados de Cuenta**: Reportes financieros
- **Reportes**: Análisis de cartera

### 👥 Recursos Humanos
- **Empleados**: Gestión de personal
- **Roles y Permisos**: Sistema RBAC avanzado
- **Reclutamiento**: Gestión de vacantes
- **Desempeño**: Evaluaciones y clima laboral

### 🔐 Seguridad
- **Autenticación Multi-tenant**: Sistema SaaS
- **2FA**: Autenticación de dos factores
- **Auditoría**: Logs de acceso y cambios
- **Permisos Granulares**: Control de acceso detallado

## 🏗️ Arquitectura

### Backend (Laravel 12)
```
backend/
├── app/
│   ├── Console/Commands/      # Comandos artisan
│   ├── Http/
│   │   ├── Controllers/       # Controladores API
│   │   └── Middleware/        # Middleware de seguridad
│   ├── Models/                # Modelos Eloquent
│   └── Services/              # Servicios de negocio
├── config/                    # Configuraciones
├── database/
│   ├── migrations/            # Migraciones
│   └── seeders/               # Seeders
└── routes/                    # Rutas API
```

### Frontend (React + TypeScript + Vite)
```
frontend/
├── src/
│   ├── components/            # Componentes reutilizables
│   ├── views/                 # Vistas principales
│   │   ├── apps/              # Módulos de aplicación
│   │   ├── saas/              # Vistas SaaS
│   │   └── voice-ai/          # Call Center IA
│   ├── services/              # Servicios API
│   ├── hooks/                 # Custom hooks
│   ├── layouts/               # Layouts
│   └── config/                # Configuraciones
└── public/                    # Archivos estáticos
```

### WhatsApp Service (Node.js)
```
whatsapp/
├── src/
│   ├── routes/                # Rutas API
│   └── services/              # Servicios WhatsApp
└── public/                    # Archivos públicos
```

## 🛠️ Tecnologías

### Backend
- **Framework**: Laravel 12
- **Base de Datos**: MySQL/PostgreSQL
- **Multi-tenancy**: Stancl/Tenancy
- **Autenticación**: Laravel Sanctum + Firebase
- **Storage**: Google Cloud Storage
- **Queue**: Laravel Queue

### Frontend
- **Framework**: React 19
- **Lenguaje**: TypeScript
- **Build Tool**: Vite
- **UI Library**: Material-UI + Flowbite + Shadcn/ui
- **Estado**: Redux + Context API
- **Routing**: React Router v7
- **Forms**: Formik + Yup
- **Charts**: ApexCharts + Recharts

### Servicios Externos
- **IA**: DeepSeek, OpenAI
- **Voz**: ElevenLabs
- **WhatsApp**: WhatsApp Business API
- **Email**: SendGrid
- **Storage**: Google Cloud Storage
- **Auth**: Firebase Authentication
- **Pagos**: Wompi

## 📦 Instalación

### Requisitos Previos
- PHP 8.2+
- Composer
- Node.js 18+
- MySQL 8.0+ o PostgreSQL 13+
- Redis (opcional, para colas)

### Backend

```bash
cd backend

# Instalar dependencias
composer install

# Copiar archivo de entorno
cp .env.example .env

# Generar key de aplicación
php artisan key:generate

# Configurar base de datos en .env
# DB_CONNECTION=mysql
# DB_HOST=127.0.0.1
# DB_PORT=3306
# DB_DATABASE=guro
# DB_USERNAME=root
# DB_PASSWORD=

# Ejecutar migraciones
php artisan migrate

# Ejecutar seeders (opcional)
php artisan db:seed

# Iniciar servidor
php artisan serve
```

### Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Copiar archivo de entorno
cp .env.example .env

# Configurar variables de entorno
# VITE_API_URL=http://localhost:8000
# VITE_FIREBASE_API_KEY=your_key
# etc...

# Iniciar servidor de desarrollo
npm run dev

# Build para producción
npm run build
```

### WhatsApp Service

```bash
cd whatsapp

# Instalar dependencias
npm install

# Copiar archivo de entorno
cp .env.example .env

# Configurar variables
# PORT=3001
# DB_HOST=localhost
# etc...

# Iniciar servicio
npm start
```

## 🔧 Configuración

### Firebase
1. Crear proyecto en Firebase Console
2. Habilitar Authentication
3. Descargar `firebase-admin.json`
4. Colocar en `backend/firebase-admin.json`
5. Configurar variables en `.env`

### Google Cloud Storage
1. Crear proyecto en Google Cloud
2. Habilitar Cloud Storage API
3. Crear bucket
4. Descargar credenciales JSON
5. Configurar en `.env`

### ElevenLabs
1. Crear cuenta en ElevenLabs
2. Obtener API Key
3. Configurar en `.env`:
```
ELEVENLABS_API_KEY=your_key
```

### SendGrid
1. Crear cuenta en SendGrid
2. Obtener API Key
3. Configurar en `.env`:
```
SENDGRID_API_KEY=your_key
```

## 🚀 Despliegue

### Backend (Laravel)

```bash
# Optimizar aplicación
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Ejecutar migraciones en producción
php artisan migrate --force

# Configurar permisos
chmod -R 775 storage bootstrap/cache
```

### Frontend (React)

```bash
# Build de producción
npm run build

# Los archivos estarán en dist/
# Subir a servidor web (Apache/Nginx)
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/guro/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📚 Documentación Adicional

- [Arquitectura de Campañas de Email](architecture/EMAIL_CAMPAIGNS_ARCHITECTURE.md)
- [Integración SendGrid](architecture/EMAIL_CAMPAIGNS_SENDGRID.md)
- [Procesamiento Avanzado de PDFs](PDF_PROCESSOR_ADVANCED_ARCHITECTURE.md)
- [Sistema de Comisiones](comisiones_architecture.md)
- [Roles y Permisos](backend/SECURITY_ROLES_PERMISSIONS.md)

## 🔐 Seguridad

- Autenticación multi-factor (2FA)
- Encriptación de datos sensibles
- Auditoría completa de accesos
- Rate limiting en APIs
- Validación de permisos granular
- Protección CSRF
- Sanitización de inputs

## 🧪 Testing

```bash
# Backend
cd backend
php artisan test

# Frontend
cd frontend
npm run test

# E2E con Cypress
npm run cypress:run
```

## 📊 Monitoreo

- Logs de aplicación en `backend/storage/logs/`
- Logs de auditoría en base de datos
- Métricas de rendimiento
- Alertas de errores

## 🤝 Contribución

1. Fork el proyecto
2. Crear rama feature (`git checkout -b feature/AmazingFeature`)
3. Commit cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir Pull Request

## 📝 Licencia

Este proyecto es privado y propietario.

## 👥 Equipo

- **Desarrollo**: Equipo GURO
- **Arquitectura**: Sistema Multi-tenant SaaS
- **Soporte**: support@guro.com

## 📞 Contacto

- **Website**: https://guro.com
- **Email**: info@guro.com
- **Soporte**: support@guro.com

## 🎯 Roadmap

- [ ] App móvil nativa (iOS/Android)
- [ ] Integración con más aseguradoras
- [ ] Dashboard de analytics avanzado
- [ ] API pública para integraciones
- [ ] Marketplace de plugins
- [ ] Soporte multi-idioma completo

---

**Versión**: 2.0.0  
**Última actualización**: Octubre 2025