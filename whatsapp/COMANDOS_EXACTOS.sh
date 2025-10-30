#!/bin/bash
# Comandos exactos para ejecutar en tu servidor después de subir el ZIP
# Ejecuta estos comandos uno por uno en SSH

# ============================================
# PASO 1: Encontrar Node.js y npm
# ============================================
echo "Buscando Node.js y npm en el servidor..."
which node
which npm
node -v
npm -v

# Si no los encuentra, busca en rutas comunes:
ls -la /usr/bin/node 2>/dev/null || echo "No está en /usr/bin/node"
ls -la /usr/local/bin/node 2>/dev/null || echo "No está en /usr/local/bin/node"
ls -la /opt/cpanel/ea-nodejs*/bin/node 2>/dev/null || echo "No está en /opt/cpanel"

# ============================================
# PASO 2: Ir al directorio del proyecto
# ============================================
cd /home/guro/public_html/wpp.guro.co

# ============================================
# PASO 3: Extraer el ZIP
# ============================================
# Si subiste el ZIP por cPanel File Manager, estará en tu home
unzip ~/whatsapp-deploy-complete.zip

# ============================================
# PASO 4: Crear directorios necesarios
# ============================================
mkdir -p auth_info data uploads logs
chmod 700 auth_info
chmod 755 data uploads logs

# ============================================
# PASO 5: Instalar dependencias
# ============================================
# Usa npm directamente (el que encontraste en el paso 1)
npm ci --production

# Si da error, intenta:
npm install --omit=dev

# ============================================
# PASO 6: Configurar systemd service
# ============================================
# Crear el servicio (necesitas ser root)
cat > /etc/systemd/system/gurowhatsapp.service <<'EOF'
[Unit]
Description=Guro WhatsApp Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=guro
Group=guro
WorkingDirectory=/home/guro/public_html/wpp.guro.co
Environment=PORT=3300
Environment=NODE_ENV=production
Environment=API_PREFIX=/api/v1
ExecStart=/usr/bin/node /home/guro/public_html/wpp.guro.co/src/index.js
Restart=always
RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=20
StandardOutput=append:/home/guro/public_html/wpp.guro.co/logs/output.log
StandardError=append:/home/guro/public_html/wpp.guro.co/logs/error.log
NoNewPrivileges=yes

[Install]
WantedBy=multi-user.target
EOF

# ============================================
# PASO 7: Habilitar e iniciar el servicio
# ============================================
systemctl daemon-reload
systemctl enable gurowhatsapp.service
systemctl start gurowhatsapp.service

# ============================================
# PASO 8: Verificar que funcione
# ============================================
systemctl status gurowhatsapp.service

# Esperar 3 segundos
sleep 3

# Probar localmente
curl http://127.0.0.1:3300/health

# Ver logs
journalctl -u gurowhatsapp.service -n 50

# ============================================
# PASO 9: Configurar Apache Reverse Proxy
# ============================================
# Crear configuración de proxy para SSL
mkdir -p /etc/apache2/conf.d/userdata/ssl/2_4/guro/wpp.guro.co

cat > /etc/apache2/conf.d/userdata/ssl/2_4/guro/wpp.guro.co/proxy.conf <<'EOF'
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

# Reconstruir Apache
/scripts/rebuildhttpdconf

# Reiniciar Apache
systemctl reload httpd

# ============================================
# PASO 10: Verificación final
# ============================================
echo ""
echo "✅ Verificando servicio..."
curl https://wpp.guro.co/health

echo ""
echo "🎉 Deploy completado!"
echo "Dashboard: https://wpp.guro.co/"
echo "API: https://wpp.guro.co/api/v1"