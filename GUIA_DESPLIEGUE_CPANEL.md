# 🚀 Guía de Despliegue a Producción via cPanel (ZIP)

## 📦 Archivos Preparados

Ya se han creado los siguientes archivos:
- ✅ `backend-prod.zip` - Backend Laravel (sin vendor ni node_modules)
- ⏳ `frontend/dist/` - Build del frontend (en proceso)
- ✅ `frontend/dist-config/env.js` - Configuración de runtime
- ✅ `frontend/dist-config/.htaccess` - Configuración Apache

---

## 🔧 PARTE 1: BACKEND (Laravel API)

### Paso 1: Editar Configuración de Producción

**ANTES de subir**, edita `backend/.env.production` con tus credenciales reales:

```env
# Base de datos
DB_DATABASE=guro_prod
DB_USERNAME=tu_usuario_mysql
DB_PASSWORD=tu_password_mysql

# Mail (SendGrid, Mailgun, etc)
MAIL_HOST=smtp.sendgrid.net
MAIL_USERNAME=apikey
MAIL_PASSWORD=tu_api_key_sendgrid

# Firebase (si usas autenticación Firebase)
# Copia las credenciales de tu proyecto Firebase

# JWT Secret (genera uno seguro)
EMPLOYEE_JWT_SECRET=genera_un_string_aleatorio_largo_y_seguro

# URLs
APP_URL=http://localhost:8081
FRONTEND_URL=https://guro.co
```

### Paso 2: Subir Backend a cPanel

1. **Accede a cPanel** → Administrador de archivos
2. **Navega a** `/home/guro/`
3. **Crea carpeta** `backend` si no existe
4. **Sube** `backend-prod.zip`
5. **Extrae** el archivo ZIP (clic derecho → Extract)
6. **Resultado:** `/home/guro/backend/backend/` (doble carpeta)
7. **Mueve todo** de `/home/guro/backend/backend/` a `/home/guro/backend/`
8. **Elimina** la carpeta vacía `backend/backend/`

### Paso 3: Configurar Backend en el Servidor

**Abre Terminal en cPanel** o conéctate por SSH:

```bash
cd /home/guro/backend

# Renombrar .env.production a .env
mv .env.production .env

# Instalar dependencias de Composer
/opt/cpanel/ea-php83/root/usr/bin/php /opt/cpanel/composer/bin/composer install --no-dev --optimize-autoloader

# Generar APP_KEY
/opt/cpanel/ea-php83/root/usr/bin/php artisan key:generate --force

# Crear enlace simbólico de storage
/opt/cpanel/ea-php83/root/usr/bin/php artisan storage:link

# Ejecutar migraciones (CUIDADO: esto modifica la BD)
/opt/cpanel/ea-php83/root/usr/bin/php artisan migrate --force

# Limpiar y cachear configuración
/opt/cpanel/ea-php83/root/usr/bin/php artisan config:clear
/opt/cpanel/ea-php83/root/usr/bin/php artisan route:clear
/opt/cpanel/ea-php83/root/usr/bin/php artisan view:clear
/opt/cpanel/ea-php83/root/usr/bin/php artisan config:cache
/opt/cpanel/ea-php83/root/usr/bin/php artisan route:cache

# Permisos correctos
chmod -R 775 storage bootstrap/cache
```

### Paso 4: Configurar Subdominio para API

1. **cPanel** → **Subdominios**
2. **Crear subdominio:** `app` (quedará como `app.guro.co`)
3. **Document Root:** `/home/guro/backend/public`
4. **Guardar**

### Paso 5: Verificar Backend

Visita: `http://app.guro.co/ok.php` o `http://localhost:8081/ok.php`

Deberías ver un mensaje de éxito.

---

## 🎨 PARTE 2: FRONTEND (React/Vite)

### Paso 1: Esperar Build

Espera a que termine el comando `npm run build` (puede tomar 2-5 minutos)

### Paso 2: Preparar archivos de configuración

```bash
# Copiar archivos de configuración al dist
cp frontend/dist-config/env.js frontend/dist/env.js
cp frontend/dist-config/.htaccess frontend/dist/.htaccess
```

### Paso 3: Editar env.js con la URL correcta

Edita `frontend/dist/env.js` y cambia la URL del API:

```javascript
window.__ENV__ = Object.assign({}, window.__ENV__ || {}, {
  API_BASE_URL: "http://localhost:8081/api",  // Cambiar a tu URL real
  CLIENTES_DELETE_ENABLED: false,
  VERSION: "prod",
  BUILD_TIME: new Date().toISOString()
});
```

### Paso 4: Agregar script de env.js al index.html

Edita `frontend/dist/index.html` y agrega ANTES de `</head>`:

```html
<script src="/env.js"></script>
```

### Paso 5: Crear ZIP del Frontend

```bash
cd frontend/dist
zip -r ../../frontend-prod.zip .
cd ../..
```

### Paso 6: Subir Frontend a cPanel

1. **cPanel** → **Administrador de archivos**
2. **Navega a** `/home/guro/public_html`
3. **RESPALDA** el contenido actual (si existe)
4. **Elimina** todo el contenido de `public_html`
5. **Sube** `frontend-prod.zip`
6. **Extrae** el archivo ZIP
7. **Verifica** que existan:
   - `index.html`
   - `env.js`
   - `.htaccess`
   - carpeta `assets/`

### Paso 7: Verificar Frontend

Visita: `https://guro.co`

Deberías ver tu aplicación funcionando.

---

## 🔒 PARTE 3: CONFIGURACIÓN SSL (HTTPS)

### Opción A: AutoSSL de cPanel (Recomendado)

1. **cPanel** → **SSL/TLS Status**
2. **Selecciona** `guro.co` y `app.guro.co`
3. **Clic en** "Run AutoSSL"
4. Espera 5-10 minutos

### Opción B: Let's Encrypt Manual

1. **cPanel** → **SSL/TLS**
2. **Manage SSL sites**
3. Instala certificado para ambos dominios

### Activar redirección HTTPS

Una vez tengas SSL, edita `/home/guro/public_html/.htaccess` y descomenta:

```apache
# Force HTTPS
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{HTTPS} !=on
  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>
```

---

## ✅ VERIFICACIÓN FINAL

### Backend API
```bash
# Prueba básica
curl http://localhost:8081/api/test-simple

# Prueba con CORS
curl -H "Origin: https://guro.co" http://localhost:8081/api/test-simple
```

### Frontend
1. Abre `https://guro.co` en el navegador
2. Abre DevTools → Console
3. Verifica que no haya errores de CORS
4. Intenta hacer login

---

## 🐛 TROUBLESHOOTING

### Error 500 en Backend
```bash
# Ver logs
tail -f /home/guro/backend/storage/logs/laravel.log

# Verificar permisos
chmod -R 775 /home/guro/backend/storage
chmod -R 775 /home/guro/backend/bootstrap/cache
```

### Error CORS
Verifica en `backend/.env`:
```env
FRONTEND_URL=https://guro.co
SANCTUM_STATEFUL_DOMAINS=guro.co,app.guro.co
```

### Frontend no carga assets
Verifica que `.htaccess` esté en `/home/guro/public_html/.htaccess`

### Base de datos no conecta
1. Verifica credenciales en `backend/.env`
2. Crea la base de datos en cPanel → MySQL Databases
3. Asigna usuario a la base de datos

---

## 📝 COMANDOS ÚTILES

### Actualizar Backend (después del primer deploy)
```bash
cd /home/guro/backend
/opt/cpanel/ea-php83/root/usr/bin/php /opt/cpanel/composer/bin/composer install --no-dev
/opt/cpanel/ea-php83/root/usr/bin/php artisan migrate --force
/opt/cpanel/ea-php83/root/usr/bin/php artisan config:cache
/opt/cpanel/ea-php83/root/usr/bin/php artisan route:cache
```

### Ver logs en tiempo real
```bash
tail -f /home/guro/backend/storage/logs/laravel.log
```

### Limpiar cache
```bash
cd /home/guro/backend
/opt/cpanel/ea-php83/root/usr/bin/php artisan cache:clear
/opt/cpanel/ea-php83/root/usr/bin/php artisan config:clear
/opt/cpanel/ea-php83/root/usr/bin/php artisan route:clear
/opt/cpanel/ea-php83/root/usr/bin/php artisan view:clear
```

---

## 🎯 CHECKLIST FINAL

- [ ] Backend subido y extraído en `/home/guro/backend/`
- [ ] `.env` configurado con credenciales reales
- [ ] `composer install` ejecutado
- [ ] `php artisan key:generate` ejecutado
- [ ] Migraciones ejecutadas
- [ ] Subdominio `app.guro.co` apunta a `/home/guro/backend/public`
- [ ] Frontend subido a `/home/guro/public_html/`
- [ ] `env.js` con URL correcta del API
- [ ] `.htaccess` configurado
- [ ] SSL/HTTPS configurado
- [ ] Pruebas de login funcionando
- [ ] Sin errores en consola del navegador

---

## 📞 SOPORTE

Si encuentras problemas:
1. Revisa los logs: `/home/guro/backend/storage/logs/laravel.log`
2. Verifica permisos de carpetas
3. Confirma que las URLs en `env.js` y `.env` sean correctas
4. Prueba en modo incógnito para evitar cache del navegador
