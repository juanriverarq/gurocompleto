# 🚀 Guía de Despliegue del Servicio WhatsApp a Producción

Esta guía te ayudará a desplegar el microservicio de WhatsApp (Baileys) en tu servidor de producción.

## 📋 Requisitos Previos

### En tu Servidor de Producción:
- ✅ Node.js 18 o superior
- ✅ npm o yarn
- ✅ Acceso SSH con permisos de root o sudo
- ✅ Apache o Nginx configurado
- ✅ Certificado SSL (recomendado)
- ✅ Puerto disponible (por defecto: 3300)

### En tu Máquina Local:
- ✅ Acceso SSH al servidor
- ✅ Llave SSH configurada (recomendado)

## 🎯 Método 1: Despliegue Automático con Script

### Paso 1: Configurar Variables de Entorno

```bash
# Exporta las variables necesarias
export REMOTE_HOST="178.18.246.209"           # IP de tu servidor
export REMOTE_PORT="22"                        # Puerto SSH
export CONNECT_USER="root"                     # Usuario con permisos root
export REMOTE_USER="guro"                      # Usuario propietario del servicio
export SSH_IDENTITY_FILE="$HOME/.ssh/guro_deploy"  # Ruta a tu llave SSH
export WHATSAPP_SUBDOMAIN="whatsapp.guro.co"  # Subdominio para el servicio
export WHATSAPP_PORT="3300"                    # Puerto donde correrá el servicio
```

### Paso 2: Ejecutar el Script de Deploy

```bash
# Dar permisos de ejecución
chmod +x deploy/whatsapp_scp.sh

# Ejecutar el deploy
./deploy/whatsapp_scp.sh
```

El script automáticamente:
- ✅ Empaqueta el código (excluyendo node_modules)
- ✅ Sube el paquete al servidor
- ✅ Instala dependencias
- ✅ Configura systemd service
- ✅ Configura Apache reverse proxy
- ✅ Reinicia servicios
- ✅ Ejecuta pruebas de salud

## 🔧 Método 2: Despliegue Manual Paso a Paso

### Paso 1: Preparar el Servidor

```bash
# Conectarse al servidor
ssh root@178.18.246.209

# Crear directorios necesarios
mkdir -p /home/guro/whatsapp/current
mkdir -p /home/guro/whatsapp/runtime
mkdir -p /home/guro/whatsapp/logs

# Verificar Node.js
node -v  # Debe ser >= 18
npm -v
```

### Paso 2: Subir el Código

```bash
# En tu máquina local, empaquetar el código
cd whatsapp
tar -czf ../whatsapp-deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='auth_info' \
  --exclude='data' \
  .

# Subir al servidor
scp -i ~/.ssh/guro_deploy whatsapp-deploy.tar.gz root@178.18.246.209:/tmp/

# En el servidor, extraer
ssh root@178.18.246.209
cd /home/guro/whatsapp/current
tar -xzf /tmp/whatsapp-deploy.tar.gz
chown -R guro:guro /home/guro/whatsapp
```

### Paso 3: Configurar Variables de Entorno

```bash
# En el servidor
cd /home/guro/whatsapp/current

# Crear archivo .env
cat > .env <<EOF
PORT=3300
NODE_ENV=production
API_PREFIX=/api/v1
DB_PATH=./data/guromensajes.db
JWT_SECRET=$(openssl rand -base64 32)
CORS_ORIGIN=https://guro.co,https://www.guro.co
EOF

chown guro:guro .env
chmod 600 .env
```

### Paso 4: Instalar Dependencias

```bash
# Como usuario guro
sudo -u guro npm ci --production
# o si no existe package-lock.json:
sudo -u guro npm install --omit=dev
```

### Paso 5: Configurar Systemd Service

```bash
# Crear archivo de servicio
cat > /etc/systemd/system/gurowhatsapp.service <<EOF
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
Environment=API_PREFIX=/api/v1
ExecStart=/usr/bin/node /home/guro/whatsapp/current/src/index.js
Restart=always
RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=20
StandardOutput=append:/home/guro/whatsapp/logs/output.log
StandardError=append:/home/guro/whatsapp/logs/error.log

# Seguridad
NoNewPrivileges=yes
PrivateTmp=yes

[Install]
WantedBy=multi-user.target
EOF

# Recargar systemd
systemctl daemon-reload

# Habilitar e iniciar el servicio
systemctl enable gurowhatsapp.service
systemctl start gurowhatsapp.service

# Verificar estado
systemctl status gurowhatsapp.service
```

### Paso 6: Configurar Reverse Proxy (Apache)

```bash
# Crear configuración de proxy
mkdir -p /etc/apache2/conf.d/userdata/ssl/2_4/guro/whatsapp.guro.co

cat > /etc/apache2/conf.d/userdata/ssl/2_4/guro/whatsapp.guro.co/proxy.conf <<EOF
# Reverse proxy para WhatsApp Service
ProxyPreserveHost On
ProxyRequests Off
SSLProxyEngine on
RequestHeader set X-Forwarded-Proto "https" env=HTTPS

ProxyPass        /  http://127.0.0.1:3300/
ProxyPassReverse /  http://127.0.0.1:3300/

# WebSocket support
RewriteEngine On
RewriteCond %{HTTP:Upgrade} =websocket [NC]
RewriteRule /(.*)           ws://127.0.0.1:3300/\$1 [P,L]
RewriteCond %{HTTP:Upgrade} !=websocket [NC]
RewriteRule /(.*)           http://127.0.0.1:3300/\$1 [P,L]
EOF

# Reconstruir configuración de Apache
/scripts/rebuildhttpdconf

# Reiniciar Apache
systemctl reload httpd
```

### Paso 6 Alternativo: Configurar Reverse Proxy (Nginx)

```bash
# Si usas Nginx en lugar de Apache
cat > /etc/nginx/conf.d/whatsapp.guro.co.conf <<EOF
upstream whatsapp_backend {
    server 127.0.0.1:3300;
}

server {
    listen 443 ssl http2;
    server_name whatsapp.guro.co;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;

    location / {
        proxy_pass http://whatsapp_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Reiniciar Nginx
systemctl reload nginx
```

## ✅ Verificación del Despliegue

### 1. Verificar el Servicio

```bash
# Estado del servicio
systemctl status gurowhatsapp.service

# Ver logs en tiempo real
journalctl -u gurowhatsapp.service -f

# Ver últimas 100 líneas de logs
journalctl -u gurowhatsapp.service -n 100
```

### 2. Probar Endpoints

```bash
# Health check
curl https://whatsapp.guro.co/health

# Estado de WhatsApp
curl https://whatsapp.guro.co/api/v1/whatsapp/status

# Listar instancias
curl https://whatsapp.guro.co/api/v1/instances
```

### 3. Verificar Conectividad

```bash
# Verificar que el puerto esté escuchando
netstat -tlnp | grep 3300

# Verificar proceso
ps aux | grep node | grep whatsapp
```

## 🔄 Actualizaciones Futuras

### Actualización Rápida

```bash
# 1. En tu máquina local
cd whatsapp
tar -czf ../whatsapp-update.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='auth_info' \
  --exclude='data' \
  .

# 2. Subir al servidor
scp whatsapp-update.tar.gz root@178.18.246.209:/tmp/

# 3. En el servidor
cd /home/guro/whatsapp/current
systemctl stop gurowhatsapp.service
tar -xzf /tmp/whatsapp-update.tar.gz
sudo -u guro npm ci --production
systemctl start gurowhatsapp.service
systemctl status gurowhatsapp.service
```

### Actualización con Script

```bash
# Simplemente ejecuta el script de nuevo
./deploy/whatsapp_scp.sh
```

## 🐛 Troubleshooting

### El servicio no inicia

```bash
# Ver logs detallados
journalctl -u gurowhatsapp.service -n 200 --no-pager

# Verificar permisos
ls -la /home/guro/whatsapp/current
ls -la /home/guro/whatsapp/current/.env

# Verificar Node.js
which node
node -v
```

### Error de conexión a WhatsApp

```bash
# Verificar que el directorio auth_info tenga permisos correctos
chown -R guro:guro /home/guro/whatsapp/current/auth_info
chmod 700 /home/guro/whatsapp/current/auth_info

# Reiniciar el servicio
systemctl restart gurowhatsapp.service
```

### Proxy no funciona

```bash
# Verificar configuración de Apache
apachectl configtest

# Ver logs de Apache
tail -f /var/log/apache2/error_log

# Verificar que el servicio esté escuchando
curl http://127.0.0.1:3300/health
```

### Puerto en uso

```bash
# Ver qué proceso está usando el puerto
lsof -i :3300

# Matar proceso si es necesario
kill -9 <PID>

# Reiniciar servicio
systemctl restart gurowhatsapp.service
```

## 🔒 Seguridad

### Firewall

```bash
# Permitir solo tráfico desde Apache/Nginx
firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="127.0.0.1" port protocol="tcp" port="3300" accept'
firewall-cmd --reload
```

### Limitar Acceso a la API

Edita el archivo `.env` y agrega:

```env
ALLOWED_IPS=127.0.0.1,tu.ip.publica
API_KEY=tu_api_key_secreta_aqui
```

## 📊 Monitoreo

### PM2 (Alternativa a systemd)

```bash
# Instalar PM2
npm install -g pm2

# Iniciar con PM2
pm2 start src/index.js --name gurowhatsapp

# Configurar inicio automático
pm2 startup
pm2 save

# Ver logs
pm2 logs gurowhatsapp

# Monitoreo
pm2 monit
```

## 📝 Comandos Útiles

```bash
# Reiniciar servicio
systemctl restart gurowhatsapp.service

# Detener servicio
systemctl stop gurowhatsapp.service

# Ver logs en tiempo real
journalctl -u gurowhatsapp.service -f

# Ver estado
systemctl status gurowhatsapp.service

# Recargar configuración
systemctl daemon-reload

# Ver configuración del servicio
systemctl cat gurowhatsapp.service
```

## 🎉 ¡Listo!

Tu servicio de WhatsApp ahora está desplegado en producción en:
- **Dashboard:** https://whatsapp.guro.co/
- **API Base:** https://whatsapp.guro.co/api/v1
- **Health Check:** https://whatsapp.guro.co/health

Para conectar WhatsApp, accede al dashboard y escanea el código QR con tu dispositivo.