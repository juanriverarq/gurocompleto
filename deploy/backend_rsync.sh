#!/usr/bin/env bash
# Despliegue backend Laravel a cPanel por SSH usando rsync
# Requisitos:
#  - Acceso SSH habilitado al usuario cPanel
#  - PHP 8.3 disponible en CLI (php)
#  - Composer disponible en CLI (composer)
#  - Subdominio api.guro.co creado en cPanel y DocumentRoot configurable
#
# Uso:
#   chmod +x deploy/backend_rsync.sh
#   ./deploy/backend_rsync.sh
#
# Autenticación recomendada (llave SSH):
#   1) Generar llave en tu Mac (no sobreescribe otras llaves):
#        ssh-keygen -t ed25519 -C "guro-deploy" -f ~/.ssh/guro_deploy -N ""
#   2) Instalar la llave pública en el servidor (primera vez pide contraseña de 'guro'):
#        cat ~/.ssh/guro_deploy.pub | ssh -p 22 guro@178.18.246.209 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
#   3) Ejecutar el script (usará ~/.ssh/guro_deploy por defecto):
#        ./deploy/backend_rsync.sh
#
# Alternativa (no recomendada): establecer USE_SSHPASS=true y SSHPASS con la contraseña,
# pero requiere 'sshpass' instalado localmente.
#
# Ajusta variables si es necesario.

set -euo pipefail

# ===== Config remota (confirmadas) =====
REMOTE_HOST="178.18.246.209"
REMOTE_USER="guro"
REMOTE_PORT="22"

# Usuario de conexión por SSH (por defecto REMOTE_USER, pero puede ser root)
CONNECT_USER="${CONNECT_USER:-${REMOTE_USER}}"
# Usuario propietario en el servidor (para Composer/Artisan y permisos)
REMOTE_SUDO_USER="${REMOTE_SUDO_USER:-${REMOTE_USER}}"

# Ruta destino del proyecto backend en el servidor (recomendado):
REMOTE_BASE="/home/${REMOTE_USER}/backend/current"
# DocumentRoot requerido para api.guro.co:
SUBDOMAIN_DOCROOT="${REMOTE_BASE}/public"

# ===== Binaries =====
# Defaults tuned for cPanel; override via env if needed
PHP_BIN="${PHP_BIN:-/opt/cpanel/ea-php83/root/usr/bin/php}"
COMPOSER_BIN="${COMPOSER_BIN:-/opt/cpanel/composer/bin/composer}"

# (Auth/SSH block inicial eliminado para evitar duplicación; ver bloque unificado más abajo)

# ===== Auth / SSH options =====
USE_SSHPASS="${USE_SSHPASS:-false}"               # false por defecto (usar llave)
# Si USE_SSHPASS=true, proveer la contraseña vía env SSHPASS
SSH_IDENTITY_FILE="${SSH_IDENTITY_FILE:-$HOME/.ssh/guro_deploy}"

# SSH options comunes
SSH_OPTS="-o StrictHostKeyChecking=no -o LogLevel=ERROR -o PreferredAuthentications=publickey -o PubkeyAuthentication=yes -o SetEnv=LC_ALL=C,LANG=C -p ${REMOTE_PORT}"

# Si existe archivo de identidad, agregarlo; si no existe y no usamos sshpass, mostrar instrucción y abortar
if [ -f "${SSH_IDENTITY_FILE}" ]; then
  SSH_OPTS="-i ${SSH_IDENTITY_FILE} ${SSH_OPTS}"
else
  if [ "${USE_SSHPASS}" != "true" ]; then
    echo "ERROR: No se encontró la llave SSH en ${SSH_IDENTITY_FILE}."
    echo "Genera e instala la llave ejecutando en tu Mac:"
    echo "  ssh-keygen -t ed25519 -C \"guro-deploy\" -f ~/.ssh/guro_deploy -N \"\""
    echo "  cat ~/.ssh/guro_deploy.pub | ssh -p 22 ${REMOTE_USER}@${REMOTE_HOST} \"mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys\""
    echo "Luego vuelve a ejecutar: ./deploy/backend_rsync.sh"
    exit 1
  fi
fi

# Construir comando SSH (con o sin sshpass)
if [ "${USE_SSHPASS}" = "true" ] && command -v sshpass >/dev/null 2>&1; then
  SSH_CMD=(sshpass -p "${SSHPASS:?Missing SSHPASS}" ssh ${SSH_OPTS})
else
  SSH_CMD=(ssh ${SSH_OPTS})
fi

# ===== rsync opciones =====
RSYNC_FLAGS=(-az --delete --omit-dir-times --no-perms --no-owner --no-group)
RSYNC_EXCLUDES=(
  --exclude 'vendor'
  --exclude 'node_modules'
  --exclude '.git'
  --exclude '.github'
  --exclude '.env'
  --exclude '.env.local'
  --exclude 'storage/framework/sessions'
  --exclude 'storage/framework/cache'
  --exclude 'storage/logs'
  --exclude 'tests'
)

echo "==> Subiendo backend a ${CONNECT_USER}@${REMOTE_HOST}:${REMOTE_BASE}"
RSYNC_SSH="${SSH_CMD[*]}"
rsync "${RSYNC_FLAGS[@]}" "${RSYNC_EXCLUDES[@]}" \
  -e "${RSYNC_SSH}" \
  ./backend/ "${CONNECT_USER}@${REMOTE_HOST}:${REMOTE_BASE}/"

echo "==> Configurando .env y ejecutando Composer/Artisan en el servidor"
"${SSH_CMD[@]}" "${CONNECT_USER}@${REMOTE_HOST}" bash -lc "
  set -e
  echo '-> Preparando entorno en ${REMOTE_BASE}'
  mkdir -p '${REMOTE_BASE}'
  cd '${REMOTE_BASE}'

  # Ownership del proyecto al usuario de cPanel
  chown -R '${REMOTE_SUDO_USER}':'${REMOTE_SUDO_USER}' '${REMOTE_BASE}' || true

  # Copiar .env.production a .env si no existe .env
  if [ ! -f '.env' ] && [ -f '.env.production' ]; then
    cp '.env.production' '.env'
    echo '   Copiado .env.production -> .env'
  fi

  # Ownership del proyecto al usuario de cPanel
  chown -R '${REMOTE_SUDO_USER}':'${REMOTE_SUDO_USER}' '${REMOTE_BASE}' || true

  # Composer install (como ${REMOTE_SUDO_USER})
  if command -v ${COMPOSER_BIN} >/dev/null 2>&1; then
    # Ajustes robustos para composer en hosting compartido
    export COMPOSER_NO_INTERACTION=1
    export COMPOSER_ALLOW_SUPERUSER=1
    export COMPOSER_MEMORY_LIMIT=-1
    sudo -u '${REMOTE_SUDO_USER}' -H ${COMPOSER_BIN} install --no-dev --prefer-dist --optimize-autoloader
  else
    echo 'ERROR: composer no está disponible en $PATH. Instálalo o ajusta COMPOSER_BIN' >&2
    exit 1
  fi

  # Artisan tasks (como ${REMOTE_SUDO_USER}) - puede que APP_KEY ya exista
  sudo -u '${REMOTE_SUDO_USER}' -H ${PHP_BIN} artisan key:generate --force || true
  sudo -u '${REMOTE_SUDO_USER}' -H ${PHP_BIN} artisan storage:link || true

  # Migraciones (por defecto desactivadas; exporta SKIP_MIGRATIONS=false para ejecutarlas)
  if [ "${SKIP_MIGRATIONS:-true}" != "true" ]; then
    sudo -u '${REMOTE_SUDO_USER}' -H ${PHP_BIN} artisan migrate --force
  else
    echo '   SKIP_MIGRATIONS=true -> saltando artisan migrate --force'
  fi

  # Optimizaciones
  sudo -u '${REMOTE_SUDO_USER}' -H ${PHP_BIN} artisan config:cache
  sudo -u '${REMOTE_SUDO_USER}' -H ${PHP_BIN} artisan route:cache
  sudo -u '${REMOTE_SUDO_USER}' -H ${PHP_BIN} artisan view:cache

  # Permisos mínimos
  chmod -R 775 storage bootstrap/cache || true

  # Ownership final
  chown -R '${REMOTE_SUDO_USER}':'${REMOTE_SUDO_USER}' '${REMOTE_BASE}' || true
"

cat <<EOF

✅ Backend desplegado y optimizado.

Acciones en cPanel:
1) Subdominios → Editar DocumentRoot de api.guro.co para que apunte a:
   ${SUBDOMAIN_DOCROOT}
2) SSL/TLS → Verifica que Let's Encrypt / AutoSSL esté activo para api.guro.co
3) Si cambiaste la versión PHP en cPanel (MultiPHP Manager), asegúrate que la CLI use PHP 8.3
   - Si usas otro binario, ejecuta el script así:
     PHP_BIN=/opt/cpanel/ea-php83/root/usr/bin/php ./deploy/backend_rsync.sh

Pruebas rápidas:
- curl -I http://localhost:8081/api/health (si existe endpoint de salud)
- Revisa storage/logs/laravel.log si hay errores.

EOF