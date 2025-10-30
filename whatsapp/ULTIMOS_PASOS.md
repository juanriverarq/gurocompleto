# ✅ Últimos Pasos - Configurar Proxy Apache

## 🎉 ¡El servicio ya está corriendo!

Tu servicio WhatsApp está activo y respondiendo en el puerto 3300:
```json
{"status":"ok","timestamp":"2025-10-15T05:52:43.496Z","whatsapp":{"totalInstances":0,"anyConnected":false},"uptime":13.228833483}
```

---

## 🔧 Ahora configura el Proxy Apache

Ejecuta estos comandos para que el servicio sea accesible desde `https://wpp.guro.co`:

```bash
# 1. Crear configuración de proxy para SSL
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

# 2. También para HTTP (opcional)
mkdir -p /etc/apache2/conf.d/userdata/std/2_4/guro/wpp.guro.co

cat > /etc/apache2/conf.d/userdata/std/2_4/guro/wpp.guro.co/proxy.conf <<'EOF'
ProxyPreserveHost On
ProxyRequests Off

ProxyPass        /  http://127.0.0.1:3300/
ProxyPassReverse /  http://127.0.0.1:3300/

# WebSocket support
RewriteEngine On
RewriteCond %{HTTP:Upgrade} =websocket [NC]
RewriteRule /(.*)           ws://127.0.0.1:3300/$1 [P,L]
RewriteCond %{HTTP:Upgrade} !=websocket [NC]
RewriteRule /(.*)           http://127.0.0.1:3300/$1 [P,L]
EOF

# 3. Reconstruir configuración de Apache
/scripts/rebuildhttpdconf

# 4. Reiniciar Apache
systemctl reload httpd
# O si no funciona:
systemctl restart httpd

# 5. Verificar que el proxy funcione
curl https://wpp.guro.co/health
```

---

## ✅ Verificación Final

```bash
# Ver estado del servicio
systemctl status gurowhatsapp.service

# Ver logs en tiempo real
journalctl -u gurowhatsapp.service -f

# Probar el endpoint público
curl https://wpp.guro.co/health
curl https://wpp.guro.co/api/v1/whatsapp/status
```

---

## 🎯 URLs del Servicio

Una vez configurado el proxy, tu servicio estará disponible en:

- **Dashboard:** https://wpp.guro.co/
- **API Base:** https://wpp.guro.co/api/v1
- **Health Check:** https://wpp.guro.co/health
- **Estado WhatsApp:** https://wpp.guro.co/api/v1/whatsapp/status
- **Código QR:** https://wpp.guro.co/api/v1/whatsapp/qr

---

## 📱 Conectar WhatsApp

1. Abre https://wpp.guro.co/ en tu navegador
2. Verás un código QR
3. Abre WhatsApp en tu teléfono → **Dispositivos vinculados**
4. Escanea el código QR
5. ¡Listo!

---

## 🔄 Comandos de Mantenimiento

```bash
# Reiniciar servicio
systemctl restart gurowhatsapp.service

# Ver logs
journalctl -u gurowhatsapp.service -n 100

# Ver logs en tiempo real
journalctl -u gurowhatsapp.service -f

# Detener servicio
systemctl stop gurowhatsapp.service

# Iniciar servicio
systemctl start gurowhatsapp.service