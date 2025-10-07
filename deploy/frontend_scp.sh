#!/usr/bin/env bash
set -euo pipefail

# Frontend deploy to cPanel (Vite) via rsync over SSH
# Uso:
#   CONNECT_USER=root REMOTE_HOST=178.18.246.209 SSH_IDENTITY_FILE=$HOME/.ssh/guro_deploy ./deploy/frontend_scp.sh

REMOTE_HOST="${REMOTE_HOST:-178.18.246.209}"
REMOTE_USER="${REMOTE_USER:-guro}"
REMOTE_PORT="${REMOTE_PORT:-22}"
CONNECT_USER="${CONNECT_USER:-root}"
SSH_IDENTITY_FILE="${SSH_IDENTITY_FILE:-$HOME/.ssh/guro_deploy}"

DOCROOT="/home/${REMOTE_USER}/public_html"
DIST_DIR="$(pwd)/frontend/dist"

# Runtime/env config para frontend
FRONTEND_API_BASE_URL="${FRONTEND_API_BASE_URL:-http://localhost:8081/api}"
FORCE_HTTPS="${FORCE_HTTPS:-false}"     # true para activar redirección 301 a HTTPS
ENABLE_HSTS="${ENABLE_HSTS:-false}"     # true para activar HSTS (requiere HTTPS estable)
GIT_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo 'no-git')"
BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# SSH options
SSH_BASE_OPTS="-o StrictHostKeyChecking=no -o LogLevel=ERROR -o PreferredAuthentications=publickey -o PubkeyAuthentication=yes"
if [ -f "${SSH_IDENTITY_FILE}" ]; then
  SSH_BASE_OPTS="-i ${SSH_IDENTITY_FILE} ${SSH_BASE_OPTS}"
fi

SSH_CMD=(ssh ${SSH_BASE_OPTS} -p "${REMOTE_PORT}")
RSYNC_SSH="ssh ${SSH_BASE_OPTS} -p ${REMOTE_PORT}"

echo "==> Building frontend (Vite)"
pushd frontend >/dev/null
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi
npm run build
popd >/dev/null

if [ ! -d "${DIST_DIR}" ]; then
  echo "ERROR: Dist folder not found at ${DIST_DIR}" >&2
  exit 1
fi

echo "==> Escribiendo runtime env.js (window.__ENV__)"
cat > "${DIST_DIR}/env.js" <<ENVJS
window.__ENV__ = Object.assign({}, window.__ENV__ || {}, {
  API_BASE_URL: "${FRONTEND_API_BASE_URL}",
  CLIENTES_DELETE_ENABLED: false,
  VERSION: "${GIT_SHA}",
  BUILD_TIME: "${BUILD_TIME}"
});
ENVJS

echo "==> Asegurando inclusión de /env.js en index.html"
# Inserta el script de env.js si no existe ya (compatible con macOS/Linux)
perl -0777 -i -pe 'BEGIN{$/=undef} if (!m/src="\/env\.js"/i) { s#</head>#  <script src="/env.js"></script>\n</head>#i }' "${DIST_DIR}/index.html" || true

echo "==> Writing .htaccess for SPA fallback y headers"
cat > "${DIST_DIR}/.htaccess" <<"HTACCESS"
# Vite SPA fallback and security
Options -Indexes
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  # Allow existing files/directories
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]
  # Exclude assets directory (adjust if needed)
  RewriteCond %{REQUEST_URI} !^/assets/
  # Fallback to index.html
  RewriteRule . /index.html [L]
</IfModule>

# Security headers mínimos
<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set X-XSS-Protection "1; mode=block"
</IfModule>

# Caching para assets estáticos
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/javascript "access plus 30 days"
  ExpiresByType text/css "access plus 30 days"
  ExpiresByType image/svg+xml "access plus 30 days"
  ExpiresByType image/png "access plus 30 days"
  ExpiresByType image/jpeg "access plus 30 days"
  ExpiresByType font/woff2 "access plus 30 days"
</IfModule>
<IfModule mod_headers.c>
  <FilesMatch "\.(js|css|png|jpg|jpeg|svg|woff2?)$">
    Header set Cache-Control "public, max-age=2592000, immutable"
  </FilesMatch>
</IfModule>
HTACCESS

# Opcionales: Forzar HTTPS y HSTS (controlados por variables)
if [ "${FORCE_HTTPS}" = "true" ]; then
  cat >> "${DIST_DIR}/.htaccess" <<"HTACCESS"
# Force HTTPS
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteCond %{HTTPS} !=on
  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>
HTACCESS
fi

if [ "${ENABLE_HSTS}" = "true" ]; then
  cat >> "${DIST_DIR}/.htaccess" <<"HTACCESS"
# HSTS (habilitar solo si HTTPS está estable)
<IfModule mod_headers.c>
  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
</IfModule>
HTACCESS
fi

echo "==> Uploading dist to ${CONNECT_USER}@${REMOTE_HOST}:${DOCROOT}"
rsync -az --delete -e "${RSYNC_SSH}" "${DIST_DIR}/" "${CONNECT_USER}@${REMOTE_HOST}:${DOCROOT}/"

echo "==> Fixing ownership to ${REMOTE_USER}:${REMOTE_USER}"
"${SSH_CMD[@]}" "${CONNECT_USER}@${REMOTE_HOST}" bash -lc "chown -R '${REMOTE_USER}':'${REMOTE_USER}' '${DOCROOT}'"

echo "==> Smoke tests"
echo "-- HEAD https://guro.co/ --"
curl -sS -I https://guro.co/ || curl -sS -I https://guro.co/ --insecure
echo "-- HEAD https://guro.co/index.html --"
curl -sS -I https://guro.co/index.html || curl -sS -I https://guro.co/index.html --insecure
echo "-- GET https://guro.co/env.js --"
curl -sS https://guro.co/env.js | sed -n "1,3p" || curl -sS https://guro.co/env.js --insecure | sed -n "1,3p"

echo ""
echo "✅ Frontend deployed to ${DOCROOT}"
echo "    API_BASE: ${FRONTEND_API_BASE_URL}"
echo "    FORCE_HTTPS=${FORCE_HTTPS}  ENABLE_HSTS=${ENABLE_HSTS}"