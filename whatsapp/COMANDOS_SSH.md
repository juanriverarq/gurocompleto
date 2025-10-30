# 📝 Comandos SSH para Deploy Manual de WhatsApp

## Paso a Paso Después de Subir el ZIP

### 1. Conectarse al Servidor
```bash
ssh -i ~/.ssh/guro_deploy guro@178.18.246.209
```

### 2. Preparar Directorios
```bash
# Crear estructura de directorios
mkdir -p /home/guro/whatsapp/current
mkdir -p /home/guro/whatsapp/logs
mkdir -p /home/guro/whatsapp/backups

# Ir al directorio
cd /home/guro/whatsapp/current
```

### 3. Extraer el ZIP
```bash
# Si subiste el zip a /tmp/
unzip /tmp/whatsapp-deploy-complete.zip -d /home/guro/whatsapp/current

# O si lo subiste a tu home
unzip ~/whatsapp-deploy-complete.zip -d /home/guro/whatsapp/current
```

### 4. Crear Archivo .env
```bash
cd /home/guro/whatsapp/current

# Crear .env basado en el ejemplo
cat > .env <<'EOF'
PORT=3300
NODE_ENV=production
API_PREFIX=/api/v1
DB_PATH=./data/guromensajes.db
JWT_SECRET=CAMBIA_ESTE_SECRET_POR_UNO_SEGURO
CORS_ORIGIN=https://guro.co,https://www.guro.co,https://app.guro.co
WHATSAPP_SESSION_DIR=./auth_info
LOG_LEVEL=info
EOF

# Proteger el archivo .env
chmod 600 .env
```

### 5. Instalar Dependencias
```bash
# Instalar dependencias de producción
npm ci --production

# O si no existe package-lock.json:
npm install --omit=dev
```

### 6. Crear Directorios Necesarios
```bash
# Crear directorios que necesita la app
mkdir -p auth_info data uploads logs
chmod 700 auth_info
chmod 755 data uploads logs
```

### 7. Configurar Systemd Service (requiere sudo/root)
```bash
# Cambiar a root
sudo su -

# Crear archivo de servicio
cat > /etc/systemd/system/gurowhatsapp.service <<'EOF'
[Unit]
Description=Guro WhatsApp Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=guro
Group=guro
WorkingDirectory=/home/guro/whatsapp/current
Environment=PORT=3300
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /home/guro/whatsapp/current/src/index.js
Restart=always
RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=20
StandardOutput=append:/home/guro/whatsapp/logs/output.log
StandardError=append:/home/guro/whatsapp/logs/error.log
NoNewPrivileges=yes

[Install]
WantedBy=multi-user.target
EOF

# Recargar systemd
systemctl daemon-reload

# Habilitar el servicio
systemctl enable gurowhatsapp.service

# Iniciar el servicio
systemctl start gurowhatsapp.service

# Verificar estado
systemctl status gurowhatsapp.service
```

### 8. Configurar Apache Reverse Proxy (requiere root)
```bash
# Crear directorios para configuración
mkdir -p /etc/apache2/conf.d/userdata/ssl/2_4/guro/whatsapp.guro.co

# Crear configuración de proxy
cat > /etc/apache2/conf.d/userdata/ssl/2_4/guro/whatsapp.guro.co/proxy.conf <<'EOF'
ProxyPreserveHost On
ProxyRequests Off
SSLProxyEngine on
RequestHeader set X-Forwarded-Proto "https" env=HTTPS

ProxyPass        /  http://127.0.0.1:3300/
ProxyPassReverse /  http://127.0.0.1:3300/

# WebSocket support
RewriteEngine On
RewriteCond %{HTTP:Upgrade} =websocket [NC]
RewriteRule /(.*)           ws://127.0.0.1:3300/$1 [P,L]
RewriteCond %{HTTP:Upgrade} !=websocket [NC]
RewriteRule /(.*)           http://127.0.0.1:3300/$1 [P,L]
EOF

# Reconstruir configuración de Apache
/scripts/rebuildhttpdconf

# Reiniciar Apache
systemctl reload httpd
```

### 9. Verificar que Todo Funcione
```bash
# Salir de root
exit

# Verificar servicio
systemctl status gurowhatsapp.service

# Ver logs
journalctl -u gurowhatsapp.service -n 50

# Probar endpoint local
curl http://127.0.0.1:3300/health

# Probar endpoint público
curl https://whatsapp.guro.co/health
```

---

## 🔄 Comandos de Mantenimiento

### Ver Logs en Tiempo Real
```bash
sudo journalctl -u gurowhatsapp.service -f
```

### Reiniciar Servicio
```bash
sudo systemctl restart gurowhatsapp.service
```

### Detener Servicio
```bash
sudo systemctl stop gurowhatsapp.service
```

### Iniciar Servicio
```bash
sudo systemctl start gurowhatsapp.service
```

### Ver Estado del Servicio
```bash
sudo systemctl status gurowhatsapp.service
```

### Ver Últimos 100 Logs
```bash
sudo journalctl -u gurowhatsapp.service -n 100
```

---

## 🆘 Si Algo Sale Mal

### El servicio no inicia
```bash
# Ver logs detallados
sudo journalctl -u gurowhatsapp.service -n 200 --no-pager

# Verificar permisos
ls -la /home/guro/whatsapp/current
ls -la /home/guro/whatsapp/current/.env

# Verificar que Node esté instalado
which node
node -v
```

### Puerto en uso
```bash
# Ver qué está usando el puerto 3300
sudo lsof -i :3300

# Si necesitas matar el proceso
sudo kill -9 <PID>
```

### Reinstalar dependencias
```bash
cd /home/guro/whatsapp/current
rm -rf node_modules
npm install --omit=dev
```

---

## ✅ URLs del Servicio

Una vez desplegado, el servicio estará disponible en:

- **Dashboard:** https://whatsapp.guro.co/
- **API Base:** https://whatsapp.guro.co/api/v1
- **Health Check:** https://whatsapp.guro.co/health
- **Estado WhatsApp:** https://whatsapp.guro.co/api/v1/whatsapp/status
- **Código QR:** https://whatsapp.guro.co/api/v1/whatsapp/qr