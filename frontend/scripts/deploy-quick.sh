#!/bin/bash

# Script de despliegue rápido por SSH
# Uso: ./deploy-quick.sh [usuario] [directorio_remoto]

set -e

# Colores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuración
SERVER_IP="167.88.38.33"
SERVER_PORT="22"
REMOTE_USER="${1:-root}"
REMOTE_PATH="${2:-/var/www/html}"
LOCAL_DIST="./dist"

echo -e "${GREEN}🚀 Despliegue rápido al servidor${NC}"
echo "Servidor: $SERVER_IP:$SERVER_PORT"
echo "Usuario: $REMOTE_USER"
echo "Directorio: $REMOTE_PATH"
echo ""

# Verificar que existe la carpeta dist
if [ ! -d "$LOCAL_DIST" ]; then
    echo -e "${RED}❌ Error: No se encontró la carpeta $LOCAL_DIST${NC}"
    echo "Ejecuta 'npm run build' primero"
    exit 1
fi

# Crear directorio remoto si no existe
echo -e "${GREEN}📁 Preparando directorio remoto...${NC}"
ssh -p $SERVER_PORT $REMOTE_USER@$SERVER_IP "mkdir -p $REMOTE_PATH"

# Subir archivos
echo -e "${GREEN}📤 Subiendo archivos...${NC}"
if command -v rsync &> /dev/null; then
    rsync -avz --delete -e "ssh -p $SERVER_PORT" $LOCAL_DIST/ $REMOTE_USER@$SERVER_IP:$REMOTE_PATH/
else
    scp -P $SERVER_PORT -r $LOCAL_DIST/* $REMOTE_USER@$SERVER_IP:$REMOTE_PATH/
fi

# Configurar permisos
echo -e "${GREEN}🔐 Configurando permisos...${NC}"
ssh -p $SERVER_PORT $REMOTE_USER@$SERVER_IP "chmod -R 755 $REMOTE_PATH"

echo -e "${GREEN}✅ Despliegue completado!${NC}"
echo -e "${YELLOW}🌐 URL: https://$SERVER_IP:8443${NC}" 