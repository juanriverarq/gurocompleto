#!/usr/bin/env bash
# Despliegue backend Laravel a cPanel usando TAR + SCP (robusto ante banners/locale)
# Útil cuando rsync falla por "unexpected end of file" debido a salida del shell remoto.
#
# Uso:
#   chmod +x deploy/backend_scp.sh
#   CONNECT_USER=root REMOTE_SUDO_USER=guro SSH_IDENTITY_FILE=$HOME/.ssh/guro_deploy ./deploy/backend_scp.sh
#
# Requisitos:
# - Acceso SSH como root por llave (recomendado) o como usuario con permisos equivalentes
# - PHP 8.3 y Composer en el servidor (rutas típicas de cPanel autodetectadas)
# - Subdominio api.guro.co apuntando a /home/guro/backend/current/public

set -euo pipefail

# ===== Config remota =====
REMOTE_HOST="${REMOTE_HOST:-178.18.246.209}"
REMOTE_USER="${REMOTE_USER:-guro}"                 # Usuario propietario del proyecto (cPanel)
REMOTE_PORT="${REMOTE_PORT:-22}"

# Usuario de conexión SSH (root por defecto para crear rutas y chown)
CONNECT_USER="${CONNECT_USER:-root}"
# Usuario al que se le asignará el ownership y bajo el cual correr Composer/Artisan
REMOTE_SUDO_USER="${REMOTE_SUDO_USER:-${REMOTE_USER}}"

# Rutas remotas
REMOTE_BASE="${REMOTE_BASE:-/home/${REMOTE_USER}/backend/current}"
REMOTE_TMP_DIR="${REMOTE_TMP_DIR:-/root/tmp}"
REMOTE_TARBALL="${REMOTE_TARBALL:-${REMOTE_TMP_DIR}/backend_deploy.tar.gz}"

# DocumentRoot recomendado para api.guro.co:
SUBDOMAIN_DOCROOT="${REMOTE_BASE}/public"

# ===== Rutas de binarios en cPanel (autodetección) =====
# Usar listas en texto simple para inyectarlas al shell remoto
PHP_CANDIDATES="/opt/cpanel/ea-php83/root/usr/bin/php /usr/bin/php php"
COMPOSER_CANDIDATES="/opt/cpanel/composer/bin/composer /usr/local/bin/composer /usr/bin/composer composer"

# ===== SSH / SCP opts =====
SSH_IDENTITY_FILE="${SSH_IDENTITY_FILE:-$HOME/.ssh/guro_deploy}"

# SSH options (ssh usa -p)
SSH_OPTS=(-o StrictHostKeyChecking=no -o LogLevel=ERROR -o PreferredAuthentications=publickey -o PubkeyAuthentication=yes -T -p "${REMOTE_PORT}")
# SCP options (scp usa -P; no acepta -T)
SCP_OPTS=(-o StrictHostKeyChecking=no -o LogLevel=ERROR -o PreferredAuthentications=publickey -o PubkeyAuthentication=yes -P "${REMOTE_PORT}")

if [ -f "${SSH_IDENTITY_FILE}" ]; then
  SSH_OPTS=(-i "${SSH_IDENTITY_FILE}" "${SSH_OPTS[@]}")
  SCP_OPTS=(-i "${SSH_IDENTITY_FILE}" "${SCP_OPTS[@]}")
fi

SSH_CMD=(ssh "${SSH_OPTS[@]}")
SCP_CMD=(scp "${SCP_OPTS[@]}")

# ===== Empaquetado local (excluyendo carpetas pesadas/temp) =====
echo "==> Empaquetando backend localmente (excluyendo vendor/node_modules/.git/tests)..."
# Evitar xattrs de macOS en el tar
export COPYFILE_DISABLE=1
LOCAL_TARBALL="$(pwd)/backend_deploy.tar.gz"
# Crear tar desde el contenido de ./backend (no incluir carpeta contenedora)
tar -C ./backend -czf "${LOCAL_TARBALL}" \
  --exclude='vendor' \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='storage/framework/sessions' \
  --exclude='storage/framework/cache' \
  --exclude='storage/logs' \
  --exclude='tests' \
  .

echo "==> Preparando rutas remotas y detectando binarios..."
# Crear carpetas remotas y detectar binarios
"${SSH_CMD[@]}" "${CONNECT_USER}@${REMOTE_HOST}" bash -lc "
  set -e
  mkdir -p '${REMOTE_TMP_DIR}'
  mkdir -p '${REMOTE_BASE}'

  # Candidatos inyectados desde local
  PHP_CANDIDATES='${PHP_CANDIDATES}'
  COMPOSER_CANDIDATES='${COMPOSER_CANDIDATES}'

  # Detectar PHP (usar CLI SAPI)
  PHP_BIN=''
  for p in \${PHP_CANDIDATES}; do
    if command -v \"\$p\" >/dev/null 2>&1; then PHP_BIN=\"\$(command -v \"\$p\")\"; break; fi
    [ -x \"\$p\" ] && PHP_BIN=\"\$p\" && break
  done
  if [ -z \"\$PHP_BIN\" ]; then
    echo 'ERROR: No se encontró PHP en el servidor. Instala PHP 8.3 o ajusta PHP_CANDIDATES.' >&2
    exit 1
  fi
  echo \"PHP_BIN=\$PHP_BIN\" > /tmp/.guro_bins

  # Detectar Composer (ejecutaremos siempre como: \"\$PHP_BIN\" \"\$COMPOSER_BIN\")
  COMPOSER_BIN=''
  for c in \${COMPOSER_CANDIDATES}; do
    if command -v \"\$c\" >/dev/null 2>&1; then COMPOSER_BIN=\"\$(command -v \"\$c\")\"; break; fi
    [ -x \"\$c\" ] && COMPOSER_BIN=\"\$c\" && break
  done
  if [ -z \"\$COMPOSER_BIN\" ]; then
    echo 'ERROR: No se encontró Composer en el servidor. Instala composer o ajusta COMPOSER_CANDIDATES.' >&2
    exit 1
  fi
  echo \"COMPOSER_BIN=\$COMPOSER_BIN\" >> /tmp/.guro_bins

  # Mostrar rutas detectadas
  cat /tmp/.guro_bins
"

echo "==> Subiendo paquete (SCP) a ${CONNECT_USER}@${REMOTE_HOST}:${REMOTE_TARBALL}"
"${SCP_CMD[@]}" "${LOCAL_TARBALL}" "${CONNECT_USER}@${REMOTE_HOST}:${REMOTE_TARBALL}"

echo "==> Desempaquetando en ${REMOTE_BASE} y ejecutando instalación"
"${SSH_CMD[@]}" "${CONNECT_USER}@${REMOTE_HOST}" bash -lc "
  set -e
  # Cargar binarios detectados
  . /tmp/.guro_bins

  mkdir -p '${REMOTE_BASE}'
  # Extraer tarball (sobre-escribe archivos existentes)
  tar --no-same-owner -xzf '${REMOTE_TARBALL}' -C '${REMOTE_BASE}'

  # Ownership del proyecto al usuario de cPanel
  chown -R '${REMOTE_SUDO_USER}':'${REMOTE_SUDO_USER}' '${REMOTE_BASE}'

  cd '${REMOTE_BASE}'

  # Copiar .env.production a .env si no existe .env
  if [ ! -f '.env' ] && [ -f '.env.production' ]; then
    cp '.env.production' '.env'
    echo '   Copiado .env.production -> .env'
  fi

  # Composer install como usuario de cPanel (forzar ejecución vía PHP CLI para evitar SAPI no-CLI)
  export COMPOSER_NO_INTERACTION=1
  export COMPOSER_ALLOW_SUPERUSER=1
  if ! sudo -u '${REMOTE_SUDO_USER}' -H \"\$PHP_BIN\" \"\$COMPOSER_BIN\" install --no-dev --prefer-dist --optimize-autoloader; then
    echo '⚠️  Composer wrapper falló; descargando composer.phar y reintentando...'
    mkdir -p '${REMOTE_TMP_DIR}'
    cd '${REMOTE_TMP_DIR}'
    curl -sS https://getcomposer.org/installer -o composer-setup.php
    \"\$PHP_BIN\" composer-setup.php --install-dir='${REMOTE_TMP_DIR}' --filename=composer.phar
    rm -f composer-setup.php
    cd '${REMOTE_BASE}'
    sudo -u '${REMOTE_SUDO_USER}' -H \"\$PHP_BIN\" '${REMOTE_TMP_DIR}/composer.phar' install --no-dev --prefer-dist --optimize-autoloader
  fi

  # Artisan tasks (como usuario de cPanel)
  sudo -u '${REMOTE_SUDO_USER}' -H \"\$PHP_BIN\" artisan key:generate --force || true
  sudo -u '${REMOTE_SUDO_USER}' -H \"\$PHP_BIN\" artisan storage:link || true
  if [ \"\${SKIP_MIGRATIONS:-true}\" != \"true\" ]; then
    sudo -u '${REMOTE_SUDO_USER}' -H \"\$PHP_BIN\" artisan migrate --force
  else
    echo '   SKIP_MIGRATIONS=true -> saltando artisan migrate --force'
  fi
  # Limpiar y reconstruir caches
  sudo -u '${REMOTE_SUDO_USER}' -H \"\$PHP_BIN\" artisan config:clear || true
  sudo -u '${REMOTE_SUDO_USER}' -H \"\$PHP_BIN\" artisan route:clear || true
  sudo -u '${REMOTE_SUDO_USER}' -H \"\$PHP_BIN\" artisan view:clear || true
  sudo -u '${REMOTE_SUDO_USER}' -H \"\$PHP_BIN\" artisan config:cache
  sudo -u '${REMOTE_SUDO_USER}' -H \"\$PHP_BIN\" artisan route:cache
  sudo -u '${REMOTE_SUDO_USER}' -H \"\$PHP_BIN\" artisan view:cache

  # Permisos
  chmod -R 775 storage bootstrap/cache || true
  chown -R '${REMOTE_SUDO_USER}':'${REMOTE_SUDO_USER}' '${REMOTE_BASE}'

  # Reiniciar colas (si aplica) y recargar servicios si tenemos root
  sudo -u '${REMOTE_SUDO_USER}' -H "$PHP_BIN" artisan queue:restart || true
  if [ "$(id -u)" = "0" ]; then
    systemctl reload httpd >/dev/null 2>&1 || true
    systemctl reload ea-php83-php-fpm >/dev/null 2>&1 || true
  fi

  # Limpiar temporales
  rm -f '${REMOTE_TARBALL}' /tmp/.guro_bins || true
"

echo ""
echo "✅ Backend desplegado (TAR+SCP)."

echo "==> Smoke tests (HTTPS remoto)"
echo "-- HEAD http://localhost:8081/ok.php --"
curl -sS -I http://localhost:8081/ok.php || curl -sS -I http://localhost:8081/ok.php --insecure
echo "-- CORS preflight OPTIONS /api/auth/sync-firebase-user --"
curl -sS -i -X OPTIONS "http://localhost:8081/api/auth/sync-firebase-user" \
  -H "Origin: https://guro.co" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,authorization" | sed -n "1,20p"
echo "-- GET con Origin /api/test-simple --"
curl -sS -i "http://localhost:8081/api/test-simple" -H "Origin: https://guro.co" | sed -n "1,20p"

cat <<EOF

Acciones en cPanel:
1) Subdominios → DocumentRoot de api.guro.co debe apuntar a:
   ${SUBDOMAIN_DOCROOT}
2) SSL/TLS → Verifica Let's Encrypt / AutoSSL para api.guro.co

EOF

# Limpiar tar local
rm -f "${LOCAL_TARBALL}" || true