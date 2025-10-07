#!/bin/bash

# Configuración para despliegue SSH en cPanel (Guro - Producción)
# Este archivo NO es el que lee por defecto deploy-ssh.sh.
# Para usarlo, realiza:
#   cp ./scripts/deploy-config.cpanel.sh ./scripts/deploy-config.sh
# y luego ejecuta:
#   bash ./scripts/deploy-ssh.sh

# Servidor
SERVER_IP="178.18.246.209"
SERVER_PORT="22"
REMOTE_USER="guro"   # Usuario de cPanel

# Directorio remoto donde servir el sitio (DocumentRoot de guro.co)
# cPanel por defecto: /home/USUARIO/public_html
REMOTE_PATH="/home/guro/public_html"

# Directorio local del build Vite
LOCAL_DIST_PATH="./dist"

# Opciones
CREATE_BACKUP=true       # Crea copia del directorio remoto antes de reemplazar
VERIFY_DEPLOYMENT=true   # Verifica index.html/assets en el servidor al terminar
BUILD_FIRST=true         # Ejecuta npm ci && npm run build si no existe dist
ATOMIC_DEPLOY=true       # Sube a carpeta temporal y hace swap atómico

# URL pública para verificación (opcional)
SITE_URL="https://guro.co"

# Servidor web (en cPanel usualmente Apache)
WEB_SERVER="apache"
WEB_SERVER_CONFIG=""     # No lo usaremos en cPanel
NGINX_RELOAD=false       # No aplica en cPanel estándar

# Permisos (no hacer chown en cPanel; usar el mismo usuario cPanel)
SET_PERMISSIONS=true
WEB_USER="guro"
WEB_GROUP="guro"