#!/bin/bash

# Configuración para despliegue SSH
# Edita estas variables según tu configuración del servidor

# Configuración del servidor
SERVER_IP="167.88.38.33"
SERVER_PORT="22"
REMOTE_USER="root"  # Cambia por tu usuario SSH

# Directorio en el servidor donde se subirán los archivos
REMOTE_PATH="/var/www/html"  # Cambia según tu configuración del servidor web

# Directorio local con los archivos de distribución
LOCAL_DIST_PATH="./dist"

# Configuración adicional
CREATE_BACKUP=true        # true/false - Crear backup antes del despliegue
VERIFY_DEPLOYMENT=true    # true/false - Verificar archivos después del despliegue
BUILD_FIRST=true          # true/false - Construir automáticamente antes de desplegar
ATOMIC_DEPLOY=false       # true/false - Despliegue atómico (sube a carpeta temporal y luego reemplaza)

# URL pública del sitio (opcional, solo para mostrar info final)
SITE_URL=""               # Ej: https://app.midominio.com

# Configuración del servidor web (opcional)
WEB_SERVER="nginx"        # nginx, apache, o "custom"
WEB_SERVER_CONFIG="/etc/nginx/sites-available/default"  # Ruta al archivo de configuración
NGINX_RELOAD=false        # true/false - Ejecutar 'nginx -s reload' al finalizar (requiere permisos)

# Configuración de permisos
SET_PERMISSIONS=true      # true/false - Configurar permisos automáticamente
WEB_USER="www-data"       # Usuario del servidor web
WEB_GROUP="www-data"      # Grupo del servidor web