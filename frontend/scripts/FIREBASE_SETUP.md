# 🔥 Configuración de Firebase para Guro

## Paso 1: Crear Proyecto Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Haz clic en "Add project"
3. Nombre del proyecto: **Guro**
4. Habilita Google Analytics (opcional)
5. Crea el proyecto

## Paso 2: Configurar Authentication

1. En el panel izquierdo, ve a **Authentication**
2. Haz clic en **Get started**
3. Ve a la pestaña **Sign-in method**
4. Habilita los siguientes proveedores:
   - **Email/Password**: Habilitar
   - **Google**: Habilitar y configurar

### Configurar Google Sign-In

1. Haz clic en **Google**
2. Habilita el toggle
3. Configura el email de soporte del proyecto
4. Guarda la configuración

## Paso 3: Registrar tu App Web

1. En la página principal del proyecto, haz clic en el ícono **Web** (</>)
2. Nickname de la app: **Guro Web**
3. **NO** marques "Set up Firebase Hosting"
4. Haz clic en **Register app**
5. Copia la configuración que aparece

## Paso 4: Configurar Variables de Entorno

Crea un archivo `.env.local` en la carpeta `frontend/` con el siguiente contenido:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=tu_api_key_aqui
VITE_FIREBASE_AUTH_DOMAIN=guro-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=guro-project
VITE_FIREBASE_STORAGE_BUCKET=guro-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123456

# App Configuration
VITE_APP_NAME=Guro
VITE_APP_VERSION=1.0.0
```

## Paso 5: Actualizar Configuración Firebase

Edita el archivo `src/config/firebase.ts` y reemplaza los valores de ejemplo:

```typescript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};
```

## Paso 6: Configurar Dominios Autorizados

1. En Firebase Console, ve a **Authentication > Settings**
2. En la pestaña **Authorized domains**
3. Agrega los siguientes dominios:
   - `localhost` (ya debería estar)
   - `127.0.0.1` (si no está)
   - Tu dominio de producción cuando lo tengas

## Paso 7: Probar la Configuración

1. Reinicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

2. Ve a la página de login
3. Prueba el botón "Continuar con Google"
4. Debería abrir una ventana popup de Google

## Funcionalidades Implementadas

### ✅ Autenticación con Email/Password
- Registro de usuarios
- Login
- Recuperación de contraseña
- Verificación de email automática

### ✅ Autenticación con Google
- Login con Google
- Registro automático
- Obtención de datos del perfil

### ✅ Gestión de Sesiones
- Persistencia automática
- Logout
- Estado de autenticación en tiempo real

### ✅ Verificación de Email
- Envío automático al registrarse
- Reenvío de verificación
- Estado de verificación en tiempo real

## Ventajas de Firebase vs Backend Laravel

### 🔥 **Firebase**
- ✅ **Configuración instantánea** - Sin servidor que mantener
- ✅ **Verificación de email automática** - Sin configurar SMTP
- ✅ **Google Sign-In nativo** - Integración perfecta
- ✅ **Escalabilidad automática** - Maneja millones de usuarios
- ✅ **Seguridad robusta** - Reglas de seguridad integradas
- ✅ **Tiempo real** - Actualizaciones instantáneas
- ✅ **Gratis hasta 10,000 usuarios** - Perfecto para empezar

### 🐘 **Laravel Backend** 
- ❌ Requiere configurar SMTP para emails
- ❌ Necesita servidor y mantenimiento
- ❌ Configuración manual de OAuth
- ❌ Costos de servidor desde el día 1

## Próximos Pasos

1. **Configurar Firestore** - Base de datos en tiempo real
2. **Agregar Storage** - Para archivos y avatares
3. **Implementar Cloud Functions** - Lógica del servidor
4. **Configurar Analytics** - Métricas de usuarios
5. **Agregar más proveedores** - Facebook, Apple, etc.

## Soporte

Si tienes problemas:
1. Revisa la consola del navegador
2. Verifica que las variables de entorno estén correctas
3. Asegúrate de que Firebase esté configurado correctamente
4. Revisa que los dominios estén autorizados 