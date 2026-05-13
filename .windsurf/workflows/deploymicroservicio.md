---
description: Deploy del Microservicio Aseguradoras (FastAPI + Playwright) en servidor Colombia
---

# Deploy Microservicio Aseguradoras

Servicio Python (FastAPI + Playwright + Chrome real) que actúa como puente entre el backend Laravel de `app.guro.co` y los portales de aseguradoras colombianas (SURA, HDI, Bolívar, AXA Colpatria, Estado, Equidad, Allianz, etc.). Es consumido por el backend vía la variable `MICROSERVICIO_API_URL`.

**Por qué un servidor aparte:** El servidor principal `178.18.246.209` (cPanel) tiene IP geo-localizada en EE.UU., por lo que las aseguradoras colombianas bloquean los scrapers de Playwright por IP extranjera. Este servidor (`200.7.105.114`, Colombia) resuelve ese bloqueo.

## Servidor

- **URL pública:** `https://conexion.guro.co` (Cloudflare → origen)
- **IP origen:** `200.7.105.114` (Colombia)
- **SSH:** `ssh -p 39754 root@200.7.105.114` (password en 1Password / vault)
- **OS:** Ubuntu 22.04.5 LTS · Python 3.10.12 · 1.9 GB RAM · 17 GB disk
- **Ruta de instalación:** `/opt/guro-microservicio/`
- **Venv:** `/opt/guro-microservicio/.venv`
- **Puerto interno:** `127.0.0.1:8002` (FastAPI uvicorn vía PM2 — no expuesto a internet)
- **Proxy:** nginx escucha en :80 (redirige a :443) y :443 con cert self-signed (`/etc/nginx/ssl/conexion.guro.co.{crt,key}`). CF debe estar en SSL mode **Full** (no strict).
- **Proceso PM2:** `guro-microservicio` (1 worker — Playwright no soporta fork de workers)

## Ubicación local del código

`~/Documents/microservicio/` (NO está dentro del repo `GUROFINAL`). Stack:
- FastAPI 0.115 · uvicorn 0.30 · Playwright 1.48 · pydantic 2.9 · httpx 0.27 · lxml · openpyxl
- Chrome real (`/usr/bin/google-chrome`) — requerido por SURA (`channel='chrome'`)
- Routers: `/sura/*`, `/hdi/*`, `/bolivar/*`, `/axa/*`, `/estado/*`, `/equidad/*`, `/allianz/*` + `/cotizador/*` (Simón Bolívar, HDI quotation, etc.)

## Despliegue regular (actualizar código)

### MS 1. Subir cambios con rsync (preserva sessions/, captures/, .venv)
```bash
cd ~/Documents/microservicio && \
  SSHPASS='<password>' sshpass -e rsync -avz --delete -e "ssh -p 39754" \
    --exclude '__pycache__' --exclude '*.pyc' --exclude 'sessions/' --exclude 'captures/' \
    --exclude '*.har' --exclude 'playwright-sura-profile/' --exclude '.git/' --exclude '.venv/' \
    --exclude '.DS_Store' --exclude 'reverse_api/' \
    ./ root@200.7.105.114:/opt/guro-microservicio/
```

### MS 2. Instalar dependencias nuevas (solo si `requirements.txt` cambió)
```bash
ssh -p 39754 root@200.7.105.114 \
  "cd /opt/guro-microservicio && .venv/bin/pip install -r requirements.txt lxml 2>&1 | tail -3"
```

### MS 3. Reiniciar PM2
```bash
ssh -p 39754 root@200.7.105.114 \
  "pm2 restart guro-microservicio 2>&1 | tail -3 && sleep 3 && \
   curl -s -o /dev/null -w 'origin: HTTP %{http_code}\n' http://127.0.0.1:8002/openapi.json"
# Verificar también que CF llegue al origen:
curl -s -o /dev/null -w 'via CF: HTTP %{http_code} | %{time_total}s\n' https://conexion.guro.co/openapi.json
```

### MS 4. Ver logs
```bash
ssh -p 39754 root@200.7.105.114 "pm2 logs guro-microservicio --lines 50 --nostream"
```

## Setup inicial (servidor nuevo)

Solo si hay que migrar a un servidor nuevo o reinstalar desde cero.

### Setup 1. Dependencias del sistema
```bash
ssh -p 39754 root@200.7.105.114 "\
  export DEBIAN_FRONTEND=noninteractive && \
  apt-get update -qq && \
  apt-get install -y -qq build-essential python3-venv python3-pip python3-dev \
    nginx ufw curl wget gnupg ca-certificates rsync unzip git"
```

### Setup 2. Google Chrome (canal real, requerido por SURA)
```bash
ssh -p 39754 root@200.7.105.114 "\
  wget -q -O /tmp/google-chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq /tmp/google-chrome.deb && \
  rm -f /tmp/google-chrome.deb && google-chrome --version"
```

### Setup 3. Node 20 + PM2
```bash
ssh -p 39754 root@200.7.105.114 "\
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs && \
  npm install -g pm2 && pm2 --version"
```

### Setup 4. Rsync inicial del código (igual que MS 1)
Crear el directorio destino primero:
```bash
ssh -p 39754 root@200.7.105.114 "mkdir -p /opt/guro-microservicio /opt/guro-microservicio/sessions /opt/guro-microservicio/captures"
```
Luego correr el rsync de **MS 1**.

### Setup 5. Venv Python + dependencias + Playwright Chromium
```bash
ssh -p 39754 root@200.7.105.114 "\
  cd /opt/guro-microservicio && \
  python3 -m venv .venv && \
  .venv/bin/pip install --upgrade pip wheel && \
  .venv/bin/pip install -r requirements.txt lxml && \
  .venv/bin/playwright install chromium && \
  .venv/bin/playwright install-deps chromium"
```

### Setup 6. Arrancar el servicio con PM2 (escucha solo en localhost — nginx proxy hace público)
```bash
ssh -p 39754 root@200.7.105.114 "\
  cd /opt/guro-microservicio && \
  pm2 start .venv/bin/uvicorn --name guro-microservicio --interpreter none -- \
    app:app --host 127.0.0.1 --port 8002 --workers 1 && \
  pm2 save && \
  pm2 startup systemd"
```

### Setup 7. Cert self-signed + nginx reverse proxy (HTTPS al CDN)
```bash
ssh -p 39754 root@200.7.105.114 "\
  mkdir -p /etc/nginx/ssl && \
  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/conexion.guro.co.key \
    -out /etc/nginx/ssl/conexion.guro.co.crt \
    -subj '/CN=conexion.guro.co'"
```

Luego crear `/etc/nginx/sites-available/conexion.guro.co` con dos `server` blocks (HTTP→HTTPS redirect + HTTPS con proxy_pass a 127.0.0.1:8002, `real_ip_header CF-Connecting-IP` y los rangos oficiales de Cloudflare). Habilitar con:
```bash
ssh -p 39754 root@200.7.105.114 "\
  ln -sf /etc/nginx/sites-available/conexion.guro.co /etc/nginx/sites-enabled/ && \
  rm -f /etc/nginx/sites-enabled/default && \
  nginx -t && systemctl reload nginx"
```

### Setup 8. Firewall — solo SSH + 80/443 (CF llega por estos puertos)
```bash
ssh -p 39754 root@200.7.105.114 "\
  ufw --force reset && \
  ufw default deny incoming && \
  ufw default allow outgoing && \
  ufw allow 39754/tcp comment 'SSH' && \
  ufw allow 80/tcp comment 'HTTP (Cloudflare)' && \
  ufw allow 443/tcp comment 'HTTPS (Cloudflare)' && \
  ufw --force enable && \
  ufw status verbose"
```

### Setup 9. Cloudflare
- DNS: registro `A` para `conexion.guro.co` con valor `200.7.105.114`, **proxied (nube naranja)**.
- SSL/TLS mode: **Full** (no "Full strict" porque el cert es self-signed). Encrypts CF↔origin.

### Setup 10. Configurar `.env` del backend Laravel en `app.guro.co`
```bash
ssh -i ~/.ssh/guro_deploy root@178.18.246.209 \
  "grep -q '^MICROSERVICIO_API_URL=' /home/guro/public_html/app.guro.co/.env || \
   { echo ''; echo '# Microservicio Aseguradoras (servidor Colombia via CF)'; \
     echo 'MICROSERVICIO_API_URL=https://conexion.guro.co'; \
     echo 'MICROSERVICIO_TIMEOUT=120'; \
     echo 'MICROSERVICIO_CONNECT_TIMEOUT=15'; } \
   >> /home/guro/public_html/app.guro.co/.env && \
   cd /home/guro/public_html/app.guro.co && \
   /opt/cpanel/ea-php83/root/usr/bin/php artisan config:clear"
```

### Setup 11. Verificar end-to-end
```bash
# Vía CF (recomendado):
curl -s -o /dev/null -w 'HTTP %{http_code} | %{time_total}s\n' https://conexion.guro.co/openapi.json

# Desde app.guro.co (el consumidor real):
ssh -i ~/.ssh/guro_deploy root@178.18.246.209 \
  "curl -s -o /dev/null -w 'HTTP %{http_code} | %{time_total}s\n' https://conexion.guro.co/openapi.json"

# Origen directo (saltando CF — útil para debug, requiere -k por self-signed):
ssh -p 39754 root@200.7.105.114 \
  "curl -sk -H 'Host: conexion.guro.co' https://127.0.0.1/openapi.json -o /dev/null -w 'HTTP %{http_code}\n'"
```

## Notas importantes

- **Acceso público restringido a Cloudflare:** uvicorn escucha solo en `127.0.0.1:8002` (no expuesto a internet). nginx en :80/:443 maneja el tráfico y solo es alcanzable a través de los IPs de Cloudflare. No hay API key — la "auth" es que el origen IP esté oculto detrás de CF y el nginx solo confía en CF para `real_ip_header`.
- **Workers = 1:** Playwright instancia un único `browser` por proceso. Si se sube `--workers`, los workers se pelean por el mismo browser y todo revienta.
- **Chrome real, no chromium:** SURA exige `channel='chrome'` en Playwright. Tenemos AMBOS instalados:
  - Google Chrome estable en `/usr/bin/google-chrome` (canal real para SURA).
  - Chromium de Playwright en `/root/.cache/ms-playwright/chromium-*` (default para el resto).
- **`sessions/` y `captures/`** son datos persistentes en el servidor (cookies, HAR de debug). NUNCA borrar — sin sessions hay que re-loguear todas las aseguradoras.
- **PM2 boot:** ya configurado con `pm2 startup systemd` + `pm2 save`. Si el server reinicia, el servicio vuelve solo.
- **Logs PM2:** `/root/.pm2/logs/guro-microservicio-out.log` y `-error.log`. Rotación recomendada con `pm2 install pm2-logrotate` cuando crezcan.
- **Outbound IP visible para aseguradoras:** `200.7.105.114` (Colombia). Verificable con `curl https://api.ipify.org` desde el server.
- **Relación con `app.guro.co`:** el backend Laravel consume el servicio vía `env('MICROSERVICIO_API_URL')` definido en `config/services.php`. No se requiere cambio de código en Laravel para apuntar al nuevo IP — solo el `.env`.

## Troubleshooting

- **PM2 dice `errored`:** `pm2 logs guro-microservicio --lines 50 --nostream`. Lo más común: faltan deps del SO (correr `.venv/bin/playwright install-deps chromium`).
- **SURA falla con timeout / página en blanco:** revisar que Google Chrome stable esté instalado (`google-chrome --version`). Si Chrome no carga, el router de SURA cae a chromium y SURA detecta el bot.
- **CF devuelve HTTP 521:** CF intenta llegar al origen pero falla. Verificar: (1) nginx está activo (`systemctl status nginx`), (2) cert self-signed existe en `/etc/nginx/ssl/`, (3) CF SSL mode = **Full** (no Strict).
- **CF devuelve HTML del frontend de guro.co en lugar del JSON:** el DNS record en CF apunta al servidor viejo. Arreglar: A record `conexion` → `200.7.105.114` (proxied).
- **Debug local sin pasar por CF:** `ssh -L 8443:127.0.0.1:443 -p 39754 root@200.7.105.114`, luego `curl -k https://localhost:8443/openapi.json` desde local.
- **Restart total:** `pm2 restart guro-microservicio --update-env`.
