# 🚀 Deploy WhatsApp en cPanel - Guía Paso a Paso

## 📍 Tu Configuración
- **Ruta del proyecto:** `/home/guro/public_html/wpp.guro.co`
- **Dominio:** `wpp.guro.co`
- **Puerto Node.js:** `3300`

---

## 📝 Comandos SSH Exactos

### 1. Conectarse por SSH
```bash
ssh -i ~/.ssh/guro_deploy guro@178.18.246.209
```

### 2. Ir al Directorio y Extraer
```bash
# Ir a la carpeta del proyecto
cd /home/guro/public_html/wpp.guro.co

# Extraer el ZIP (asumiendo que lo subiste por cPanel File Manager)
unzip ~/whatsapp-deploy-complete.zip

# O si está en otra ubicación:
# unzip /home/guro/whatsapp-deploy-complete.zip
```

### 3. Crear Archivo .env
```bash
# Crear el archivo de configuración
cat > .env <<'EOF'
PORT=3300
NODE_ENV=production
API_PREFIX=/api/v1
DB_PATH=./data/guromensajes.db
JWT_SECRET=TU_SECRET_SUPER_SEGURO_AQUI_CAMBIALO
CORS_ORIGIN=https://guro.co,https://www.guro.co,https://app.guro.co,https://wpp.guro.co
WHATSAPP_SESSION_DIR=./auth_info
LOG_LEVEL=info
LOG_FILE=./logs/whatsapp.log
EOF

# Proteger el archivo
chmod 600 .env
```

### 4. Instalar Dependencias
```bash
# Usar el Node.js de cPanel (normalmente en /opt/cpanel/ea-nodejs20)
/opt/cpanel/ea-nodejs20/bin/npm ci --production

# O si no existe package-lock.json:
/opt/cpanel/ea-nodejs20/bin/npm install --omit=dev
```

### 5. Crear Directorios Necesarios
```bash
# Crear carpetas que necesita la aplicación
mkdir -p auth_info data uploads logs
chmod 700 auth_info
chmod 755 data uploads logs
```

### 6. Configurar Node.js App en cPanel

**Opción A: Desde Terminal SSH (Recomendado)**
```bash
# Registrar la aplicación Node.js en cPanel
/usr/local/cpanel/scripts/ea-nodejs20 register \
  --domain wpp.guro.co \
  --app-root /home/guro/public_html/wpp.guro.co \
  --app-uri / \
  --startup-file src/index.js \
  --port 3300
```

**Opción B: Desde cPanel UI**
1. Ve a cPanel → **Setup Node.js App**
2. Click en **Create Application**
3. Configura:
   - **Node.js version:** 20.x (o la más reciente)
   - **Application mode:** Production
   - **Application root:** `public_html/wpp.guro.co`
   - **Application URL:** `wpp.guro.co`
   - **Application startup file:** `src/index.js`
   - **Port:** `3300`
4. Click en **Create**

### 7. Configurar Variables de Entorno en cPanel

En la interfaz de **Setup Node.js App**, agrega estas variables:

```
PORT=3300
NODE_ENV=production
API_PREFIX=/api/v1
```

### 8. Iniciar la Aplicación

**Desde cPanel UI:**
- Ve a **Setup Node.js App**
- Encuentra tu aplicación `wpp.guro.co`
- Click en **Start App** o **Restart App**

**Desde SSH:**
```bash
# Reiniciar la app
/usr/local/cpanel/scripts/ea-nodejs20 restart --domain wpp.guro.co
```

### 9. Verificar que Funcione

```bash
# Probar localmente
curl http://127.0.0.1:3300/health

# Probar públicamente
curl https://wpp.guro.co/health

# Ver logs
tail -f /home/guro/public_html/wpp.guro.co/logs/whatsapp.log
```

---

## 🔄 Comandos de Mantenimiento en cPanel

### Reiniciar Aplicación
```bash
/usr/local/cpanel/scripts/ea-nodejs20 restart --domain wpp.guro.co
```

### Detener Aplicación
```bash
/usr/local/cpanel/scripts/ea-nodejs20 stop --domain wpp.guro.co
```

### Iniciar Aplicación
```bash
/usr/local/cpanel/scripts/ea-nodejs20 start --domain wpp.guro.co
```

### Ver Estado
```bash
/usr/local/cpanel/scripts/ea-nodejs20 status --domain wpp.guro.co
```

### Ver Logs
```bash
# Logs de la aplicación
tail -f /home/guro/public_html/wpp.guro.co/logs/whatsapp.log

# Logs de Node.js de cPanel
tail -f /home/guro/logs/wpp.guro.co.log
```

---

## 🔧 Actualizar la Aplicación

### Cuando necesites actualizar:

```bash
# 1. Conectarse
ssh -i ~/.ssh/guro_deploy guro@178.18.246.209

# 2. Ir al directorio
cd /home/guro/public_html/wpp.guro.co

# 3. Hacer backup
cp -r ../wpp.guro.co ../wpp.guro.co.backup-$(date +%Y%m%d)

# 4. Detener app
/usr/local/cpanel/scripts/ea-nodejs20 stop --domain wpp.guro.co

# 5. Extraer nuevo código
unzip -o ~/whatsapp-deploy-complete.zip

# 6. Actualizar dependencias
/opt/cpanel/ea-nodejs20/bin/npm ci --production

# 7. Iniciar app
/usr/local/cpanel/scripts/ea-nodejs20 start --domain wpp.guro.co

# 8. Verificar
curl https://wpp.guro.co/health
```

---

## 🆘 Troubleshooting

### La app no inicia

```bash
# Ver logs de cPanel
tail -f /home/guro/logs/wpp.guro.co.log

# Ver logs de la app
tail -f /home/guro/public_html/wpp.guro.co/logs/whatsapp.log

# Verificar permisos
ls -la /home/guro/public_html/wpp.guro.co
```

### Puerto en uso

```bash
# Ver qué está usando el puerto
lsof -i :3300

# Reiniciar la app desde cPanel
/usr/local/cpanel/scripts/ea-nodejs20 restart --domain wpp.guro.co
```

### Reinstalar dependencias

```bash
cd /home/guro/public_html/wpp.guro.co
rm -rf node_modules package-lock.json
/opt/cpanel/ea-nodejs20/bin/npm install --omit=dev
/usr/local/cpanel/scripts/ea-nodejs20 restart --domain wpp.guro.co
```

---

## ✅ URLs del Servicio

Una vez desplegado:

- **Dashboard:** https://wpp.guro.co/
- **API Base:** https://wpp.guro.co/api/v1
- **Health Check:** https://wpp.guro.co/health
- **Estado WhatsApp:** https://wpp.guro.co/api/v1/whatsapp/status
- **Código QR:** https://wpp.guro.co/api/v1/whatsapp/qr

---

## 📱 Conectar WhatsApp

1. Abre https://wpp.guro.co/ en tu navegador
2. Verás un código QR
3. Abre WhatsApp en tu teléfono
4. Ve a **Dispositivos vinculados**
5. Escanea el código QR
6. ¡Listo! El servicio estará conectado

---

## 💡 Notas Importantes

- El archivo `.env` NO está incluido en el ZIP por seguridad
- Debes crear el `.env` manualmente con tus configuraciones
- Cambia el `JWT_SECRET` por uno seguro
- Los archivos de sesión de WhatsApp se guardan en `auth_info/`
- La base de datos SQLite se guarda en `data/guromensajes.db`