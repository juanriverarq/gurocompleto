#!/usr/bin/env bash
# Despliegue del microservicio WhatsApp (Node.js/Express + Baileys) en cPanel/Contabo vía TAR+SCP + systemd + Apache reverse proxy
#
# Uso típico (con llave):
#   chmod +x deploy/whatsapp_scp.sh
#   CONNECT_USER=root REMOTE_SUDO_USER=guro SSH_IDENTITY_FILE=$HOME/.ssh/guro_deploy ./deploy/whatsapp_scp.sh
#
# Variables configurables (puedes exportarlas antes de ejecutar):
#   REMOTE_HOST=178.18.246.209
#   REMOTE_PORT=22
#   CONNECT_USER=root            # usuario con permisos de root (para systemd y proxy en Apache)
#   REMOTE_USER=guro             # propietario de archivos y usuario de ejecución del servicio
#   SSH_IDENTITY_FILE=~/.ssh/guro_deploy
#   WHATSAPP_SUBDOMAIN=whatsapp.guro.co
#   WHATSAPP_PORT=3300
#   API_PREFIX=/api/v1
#   NODE_ENV=production
#
# Este script:
#  - Empaqueta ./whatsapp (excluyendo node_modules, .git, tests)
#  - Sube y despliega en /home/<REMOTE_USER>/whatsapp/current
#  - Instala dependencias con npm ci
#  - Crea/actualiza servicio systemd gurowhatsapp.service (User=<REMOTE_USER>)
#  - Configura Apache vhost userdata (proxy) para https://<WHATSAPP_SUBDOMAIN> → http://127.0.0.1:<WHATSAPP_PORT>
#  - Reinicia Apache y arranca el servicio
#  - Realiza pruebas de salud

set -euo pipefail

# ===== Config remota =====
REMOTE_HOST="${REMOTE_HOST:-178.18.246.209}"
REMOTE_PORT="${REMOTE_PORT:-22}"
CONNECT_USER="${CONNECT_USER:-root}"          # necesitamos root para systemd y vhost userdata
REMOTE_USER="${REMOTE_USER:-guro}"            # owner del proyecto/servicio
REMOTE_SUDO_USER="${REMOTE_SUDO_USER:-${REMOTE_USER}}"

# App/config
APP_NAME="${APP_NAME:-gurowhatsapp}"
SERVICE_NAME="${SERVICE_NAME:-gurowhatsapp.service}"
WHATSAPP_SUBDOMAIN="${WHATSAPP_SUBDOMAIN:-whatsapp.guro.co}"
WHATSAPP_PORT="${WHATSAPP_PORT:-3300}"
API_PREFIX="${API_PREFIX:-/api/v1}"
NODE_ENV_VAL="${NODE_ENV:-production}"

# Paths remotos
APP_BASE="${APP_BASE:-/home/${REMOTE_USER}/whatsapp/current}"
RUNTIME_DIR="${RUNTIME_DIR:-/home/${REMOTE_USER}/whatsapp/runtime}"
REMOTE_TMP_DIR="${REMOTE_TMP_DIR:-/root/tmp}"
REMOTE_TARBALL="${REMOTE_TARBALL:-${REMOTE_TMP_DIR}/whatsapp_deploy.tar.gz}"
DOCROOT="/home/${REMOTE_USER}/public_html/${WHATSAPP_SUBDOMAIN}"

# ===== SSH / SCP opts =====
SSH_IDENTITY_FILE="${SSH_IDENTITY_FILE:-$HOME/.ssh/guro_deploy}"

# SSH options (ssh -p)
SSH_OPTS=(-o StrictHostKeyChecking=no -o LogLevel=ERROR -o PreferredAuthentications=publickey -o PubkeyAuthentication=yes -T -p "${REMOTE_PORT}")
# SCP options (scp -P)
SCP_OPTS=(-o StrictHostKeyChecking=no -o LogLevel=ERROR -o PreferredAuthentications=publickey -o PubkeyAuthentication=yes -P "${REMOTE_PORT}")

if [ -f "${SSH_IDENTITY_FILE}" ]; then
  SSH_OPTS=(-i "${SSH_IDENTITY_FILE}" "${SSH_OPTS[@]}")
  SCP_OPTS=(-i "${SSH_IDENTITY_FILE}" "${SCP_OPTS[@]}")
fi

SSH_CMD=(ssh "${SSH_OPTS[@]}")
SCP_CMD=(scp "${SCP_OPTS[@]}")

# ===== Empaquetado local =====
echo "==> Empaquetando whatsapp/ (excluyendo node_modules/.git/tests)"
export COPYFILE_DISABLE=1
LOCAL_TARBALL="$(pwd)/whatsapp_deploy.tar.gz"
tar -C ./whatsapp -czf "${LOCAL_TARBALL}" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='tests' \
  .

# ===== Preparación remota =====
echo "==> Preparando rutas remotas y validando binarios en ${CONNECT_USER}@${REMOTE_HOST}"
"${SSH_CMD[@]}" "${CONNECT_USER}@${REMOTE_HOST}" bash -lc "
  set -e
  mkdir -p '${REMOTE_TMP_DIR}' '${APP_BASE}' '${RUNTIME_DIR}'
  mkdir -p '${DOCROOT}' || true

  # Detectar Node y npm (preferir ea-nodejs20 de cPanel si existe)
  NODE_CANDIDATES='/opt/cpanel/ea-nodejs20/bin/node /opt/cpanel/ea-nodejs18/bin/node /usr/bin/node node'
  NPM_CANDIDATES='/opt/cpanel/ea-nodejs20/bin/npm /opt/cpanel/ea-nodejs18/bin/npm /usr/bin/npm npm'

  NODE_BIN=''
  for n in \${NODE_CANDIDATES}; do
    if command -v \"\$n\" >/dev/null 2>&1; then NODE_BIN=\"\$(command -v \"\$n\")\"; break; fi
    [ -x \"\$n\" ] && NODE_BIN=\"\$n\" && break
  done
  if [ -z \"\$NODE_BIN\" ]; then
    echo 'ERROR: Node.js no encontrado en el servidor. Instala ea-nodejs20 o añade NODE_BIN al PATH.' >&2
    exit 1
  fi

  NPM_BIN=''
  for n in \${NPM_CANDIDATES}; do
    if command -v \"\$n\" >/dev/null 2>&1; then NPM_BIN=\"\$(command -v \"\$n\")\"; break; fi
    [ -x \"\$n\" ] && NPM_BIN=\"\$n\" && break
  done
  if [ -z \"\$NPM_BIN\" ]; then
    echo 'ERROR: npm no encontrado. Verifica instalación de Node/npm.' >&2
    exit 1
  fi

  # Validar versión de Node >= 18
  NODE_MAJOR=\$(( \$(\${NODE_BIN} -v | sed -E 's/^v([0-9]+).*/\\1/') ))
  if [ \"\$NODE_MAJOR\" -lt 18 ]; then
    echo 'ERROR: Se requiere Node.js 18 o superior.' >&2
    exit 1
  fi

  echo \"NODE_BIN=\$NODE_BIN\" > /tmp/.wa_bins
  echo \"NPM_BIN=\$NPM_BIN\" >> /tmp/.wa_bins
"

# ===== Subir artefacto =====
echo "==> Subiendo paquete (SCP) a ${CONNECT_USER}@${REMOTE_HOST}:${REMOTE_TARBALL}"
"${SCP_CMD[@]}" "${LOCAL_TARBALL}" "${CONNECT_USER}@${REMOTE_HOST}:${REMOTE_TARBALL}"

# ===== Desplegar y configurar servicio + proxy =====
echo "==> Desplegando en ${APP_BASE} y configurando systemd + Apache proxy"
"${SSH_CMD[@]}" "${CONNECT_USER}@${REMOTE_HOST}" bash -lc "
  set -e

  . /tmp/.wa_bins
  echo \"Usando: NODE_BIN=\$NODE_BIN, NPM_BIN=\$NPM_BIN\"

  # Extraer código
  tar --no-same-owner -xzf '${REMOTE_TARBALL}' -C '${APP_BASE}'

  # Ownership y directorios de runtime
  chown -R '${REMOTE_USER}':'${REMOTE_USER}' '${APP_BASE}' '${RUNTIME_DIR}'
  mkdir -p '${APP_BASE}/uploads' '${APP_BASE}/public'
  chown -R '${REMOTE_USER}':'${REMOTE_USER}' '${APP_BASE}/uploads' '${APP_BASE}/public'

  cd '${APP_BASE}'
  # .env por defecto si no existe
  if [ ! -f '.env' ]; then
    cat > .env <<ENV
PORT=${WHATSAPP_PORT}
API_PREFIX=${API_PREFIX}
NODE_ENV=${NODE_ENV_VAL}
ENV
    chown '${REMOTE_USER}':'${REMOTE_USER}' .env
  fi

  # Instalar dependencias como usuario de cPanel
  export npm_config_loglevel=error
  sudo -u '${REMOTE_USER}' -H \"\$NPM_BIN\" ci || sudo -u '${REMOTE_USER}' -H \"\$NPM_BIN\" install --omit=dev

  # Crear/actualizar servicio systemd
  cat > /etc/systemd/system/${SERVICE_NAME} <<UNIT
[Unit]
Description=Guro WhatsApp Service (${APP_NAME})
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${REMOTE_USER}
Group=${REMOTE_USER}
WorkingDirectory=${APP_BASE}
Environment=PORT=${WHATSAPP_PORT}
Environment=NODE_ENV=${NODE_ENV_VAL}
Environment=API_PREFIX=${API_PREFIX}
ExecStart=\$NODE_BIN ${APP_BASE}/src/index.js
Restart=always
RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=20
# Limitar recursos básicos
NoNewPrivileges=yes

[Install]
WantedBy=multi-user.target
UNIT

  systemctl daemon-reload
  systemctl enable ${SERVICE_NAME} || true
  systemctl restart ${SERVICE_NAME}
  sleep 2
  systemctl --no-pager --full status ${SERVICE_NAME} | sed -n '1,60p' || true

  # Configurar Apache reverse proxy vía userdata
  for d in /etc/apache2/conf.d/userdata/std/2_4/${REMOTE_USER}/${WHATSAPP_SUBDOMAIN} \
           /etc/apache2/conf.d/userdata/ssl/2_4/${REMOTE_USER}/${WHATSAPP_SUBDOMAIN} \
           /usr/local/apache/conf/userdata/std/2_4/${REMOTE_USER}/${WHATSAPP_SUBDOMAIN} \
           /usr/local/apache/conf/userdata/ssl/2_4/${REMOTE_USER}/${WHATSAPP_SUBDOMAIN}
  do
    mkdir -p \"\$d\"
    cat > \"\$d/proxy.conf\" <<APROXY
# Reverse proxy a Node (${APP_NAME})
ProxyPreserveHost On
ProxyRequests Off
SSLProxyEngine on
RequestHeader set X-Forwarded-Proto \"https\" env=HTTPS
ProxyPass        /  http://127.0.0.1:${WHATSAPP_PORT}/
ProxyPassReverse /  http://127.0.0.1:${WHATSAPP_PORT}/
APROXY
  done

  # Evitar warnings de DocumentRoot inexistente
  mkdir -p '${DOCROOT}'
  echo '<html><body>Proxy activo hacia ${APP_NAME}.</body></html>' > '${DOCROOT}/index.html'
  chown -R '${REMOTE_USER}':'${REMOTE_USER}' '${DOCROOT}'

  # Reconstruir y reiniciar Apache
  /scripts/rebuildhttpdconf
  /scripts/restartsrv_httpd || systemctl reload httpd || apachectl graceful

  # Limpieza
  rm -f '${REMOTE_TARBALL}' /tmp/.wa_bins || true
"

# ===== Smoke tests =====
echo ""
echo "==> Smoke tests"
echo "-- Servicio systemd --"
"${SSH_CMD[@]}" "${CONNECT_USER}@${REMOTE_HOST}" bash -lc "systemctl is-active ${SERVICE_NAME} && systemctl is-enabled ${SERVICE_NAME}"

echo "-- curl https://${WHATSAPP_SUBDOMAIN}/health --"
curl -sS -i "https://${WHATSAPP_SUBDOMAIN}/health" | sed -n '1,200p' || curl -sS -i "https://${WHATSAPP_SUBDOMAIN}/health" --insecure | sed -n '1,200p'

echo "-- curl https://${WHATSAPP_SUBDOMAIN}${API_PREFIX}/instances --"
curl -sS -i "https://${WHATSAPP_SUBDOMAIN}${API_PREFIX}/instances" | sed -n '1,60p' || curl -sS -i "https://${WHATSAPP_SUBDOMAIN}${API_PREFIX}/instances" --insecure | sed -n '1,60p'

echo ""
echo "✅ WhatsApp microservicio desplegado."
echo "   URL dashboard: https://${WHATSAPP_SUBDOMAIN}/"
echo "   API base:      https://${WHATSAPP_SUBDOMAIN}${API_PREFIX}"
echo "   Puerto local:  ${WHATSAPP_PORT} (Apache proxy → Node)"
echo ""
echo "Siguientes acciones:"
echo " - En cPanel: asegúrate de que el subdominio ${WHATSAPP_SUBDOMAIN} tenga SSL/AutoSSL activo."
echo " - En caso de error de proxy: revisa /etc/apache2/logs/error_log y status del servicio: systemctl status ${SERVICE_NAME}"
echo " - Logs del servicio: journalctl -u ${SERVICE_NAME} -n 200 -f"