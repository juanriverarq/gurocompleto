# Configuración de Variables de Entorno

Este documento explica cómo están configuradas las variables de entorno para los diferentes entornos de la aplicación.

## Archivos de Configuración

### `.env` - Desarrollo Local (Principal)

Este es el archivo principal para desarrollo local. Contiene todas las configuraciones necesarias para trabajar en tu máquina local.

**URLs configuradas:**

- Backend API: `http://localhost:8081/api`
- WhatsApp Service: `http://localhost:3000/api/v1`

### `.env.local` - Desarrollo Local (Personalizado)

Este archivo sobrescribe las variables de `.env` y es específico para cada desarrollador. No se sube al repositorio (está en `.gitignore`).

**URLs configuradas:**

- Backend API: `http://127.0.0.1:8001/api`
- WhatsApp Service: `http://localhost:3000/api/v1`

### `.env.production` - Producción

Este archivo se usa cuando se construye la aplicación para producción (`npm run build`).

**URLs configuradas:**

- Backend API: `http://localhost:8081/api`
- WhatsApp Service: `https://whatsapp.guro.co/api/v1`

### `.env.example` - Plantilla

Archivo de ejemplo que muestra todas las variables disponibles. Úsalo como referencia para crear tu propio `.env`.

## Variables de Entorno Disponibles

### APIs y Servicios

```bash
# Backend API de Laravel
VITE_API_URL=http://localhost:8081/api

# Microservicio de WhatsApp
VITE_WHATSAPP_SERVICE_URL=http://localhost:3000/api/v1
```

### Autenticación de Desarrollo

```bash
# Bypass de autenticación para desarrollo
VITE_DEV_AUTH_BYPASS=true

# ID del broker por defecto en desarrollo
VITE_DEV_BROKER_ID=2
```

### Firebase

```bash
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-domain
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

### DeepSeek AI

```bash
VITE_DEEPSEEK_API_KEY=your-deepseek-key
```

### Configuración de la Aplicación

```bash
VITE_APP_NAME=Guro
VITE_APP_VERSION=1.0.0
VITE_APP_ENV=development
NODE_ENV=development
```

## Cómo Usar

### Para Desarrollo Local

1. **Primera vez:**

   ```bash
   cp .env.example .env
   ```

2. **Edita `.env`** con tus configuraciones locales

3. **Inicia el servidor:**
   ```bash
   npm run dev
   ```

### Para Producción

1. **Asegúrate de que `.env.production` esté configurado correctamente**

2. **Construye la aplicación:**

   ```bash
   npm run build
   ```

3. **Las variables de `.env.production` se usarán automáticamente**

## Prioridad de Archivos

Vite carga los archivos en este orden (el último sobrescribe al anterior):

1. `.env` - Cargado en todos los casos
2. `.env.local` - Cargado en todos los casos, ignorado por git
3. `.env.[mode]` - Solo cargado en el modo especificado (development/production)
4. `.env.[mode].local` - Solo cargado en el modo especificado, ignorado por git

## Servicios Requeridos

### Desarrollo Local

Para que la aplicación funcione correctamente en desarrollo, necesitas tener corriendo:

1. **Backend Laravel** en `http://localhost:8081`

   ```bash
   cd backend
   php artisan serve --port=8001
   ```

2. **Microservicio de WhatsApp** en `http://localhost:3000`

   ```bash
   cd whatsapp
   npm start
   ```

3. **Frontend Vite** en `http://localhost:5173`
   ```bash
   cd frontend
   npm run dev
   ```

### Producción

En producción, los servicios deben estar disponibles en:

1. **Backend API**: `http://localhost:8081`
2. **WhatsApp Service**: `https://whatsapp.guro.co`
3. **Frontend**: `https://guro.co`

## Solución de Problemas

### Error: "Cannot connect to API"

- Verifica que el backend esté corriendo en el puerto correcto
- Revisa que `VITE_API_URL` apunte a la URL correcta
- Comprueba que no haya problemas de CORS

### Error: "WhatsApp service unavailable"

- Verifica que el microservicio de WhatsApp esté corriendo
- Revisa que `VITE_WHATSAPP_SERVICE_URL` sea correcta
- Comprueba los logs del microservicio

### Los cambios en .env no se reflejan

- Reinicia el servidor de desarrollo (`Ctrl+C` y `npm run dev`)
- Vite solo lee las variables al iniciar

## Seguridad

⚠️ **IMPORTANTE:**

- Nunca subas archivos `.env` con credenciales reales al repositorio
- Los archivos `.env.local` y `.env.*.local` están en `.gitignore`
- Usa variables de entorno del servidor para producción
- Rota las API keys periódicamente

## Notas Adicionales

- Todas las variables deben empezar con `VITE_` para ser accesibles en el código
- Las variables se acceden con `import.meta.env.VITE_VARIABLE_NAME`
- Los cambios en variables de entorno requieren reiniciar el servidor
