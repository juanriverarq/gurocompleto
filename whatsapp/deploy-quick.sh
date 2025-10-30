#!/bin/bash
# Script de deploy rápido para el servicio WhatsApp
# Uso: ./deploy-quick.sh

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Iniciando deploy del servicio WhatsApp...${NC}"

# Configuración (ajusta según tu servidor)
REMOTE_HOST="${REMOTE_HOST:-178.18.246.209}"
REMOTE_USER="${REMOTE_USER:-guro}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/guro_deploy}"
SERVICE_NAME="gurowhatsapp.service"
REMOTE_PATH="/home/${REMOTE_USER}/whatsapp/current"

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Ejecuta este script desde el directorio whatsapp/${NC}"
    exit 1
fi

# Paso 1: Empaquetar código
echo -e "${YELLOW}📦 Empaquetando código...${NC}"
tar -czf ../whatsapp-deploy.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='auth_info' \
    --exclude='data' \
    --exclude='*.log' \
    --exclude='.env' \
    .

# Paso 2: Subir al servidor
echo -e "${YELLOW}⬆️  Subiendo al servidor...${NC}"
scp -i "${SSH_KEY}" ../whatsapp-deploy.tar.gz "${REMOTE_USER}@${REMOTE_HOST}:/tmp/"

# Paso 3: Desplegar en el servidor
echo -e "${YELLOW}🔧 Desplegando en el servidor...${NC}"
ssh -i "${SSH_KEY}" "${REMOTE_USER}@${REMOTE_HOST}" << 'ENDSSH'
set -e

# Detener servicio
echo "Deteniendo servicio..."
sudo systemctl stop gurowhatsapp.service || true

# Backup del código anterior
if [ -d "/home/guro/whatsapp/current" ]; then
    echo "Creando backup..."
    sudo cp -r /home/guro/whatsapp/current "/home/guro/whatsapp/backup-$(date +%Y%m%d-%H%M%S)" || true
fi

# Extraer nuevo código
echo "Extrayendo código..."
cd /home/guro/whatsapp/current
sudo tar -xzf /tmp/whatsapp-deploy.tar.gz

# Instalar dependencias
echo "Instalando dependencias..."
npm ci --production || npm install --omit=dev

# Ajustar permisos
echo "Ajustando permisos..."
sudo chown -R guro:guro /home/guro/whatsapp/current
chmod 755 /home/guro/whatsapp/current

# Crear directorios necesarios
mkdir -p auth_info data uploads logs
chmod 700 auth_info

# Iniciar servicio
echo "Iniciando servicio..."
sudo systemctl start gurowhatsapp.service

# Esperar un momento
sleep 3

# Verificar estado
echo "Verificando estado..."
sudo systemctl status gurowhatsapp.service --no-pager || true

# Limpiar
rm -f /tmp/whatsapp-deploy.tar.gz

echo "✅ Deploy completado"
ENDSSH

# Paso 4: Verificar
echo -e "${YELLOW}🔍 Verificando deploy...${NC}"
sleep 2

# Health check
if curl -s -f "https://whatsapp.guro.co/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Servicio respondiendo correctamente${NC}"
else
    echo -e "${YELLOW}⚠️  Servicio puede estar iniciando... verifica manualmente${NC}"
fi

# Limpiar archivo local
rm -f ../whatsapp-deploy.tar.gz

echo ""
echo -e "${GREEN}🎉 Deploy completado exitosamente!${NC}"
echo ""
echo "URLs del servicio:"
echo "  Dashboard: https://whatsapp.guro.co/"
echo "  API:       https://whatsapp.guro.co/api/v1"
echo "  Health:    https://whatsapp.guro.co/health"
echo ""
echo "Comandos útiles:"
echo "  Ver logs:     ssh -i ${SSH_KEY} ${REMOTE_USER}@${REMOTE_HOST} 'sudo journalctl -u ${SERVICE_NAME} -f'"
echo "  Ver estado:   ssh -i ${SSH_KEY} ${REMOTE_USER}@${REMOTE_HOST} 'sudo systemctl status ${SERVICE_NAME}'"
echo "  Reiniciar:    ssh -i ${SSH_KEY} ${REMOTE_USER}@${REMOTE_HOST} 'sudo systemctl restart ${SERVICE_NAME}'"
echo ""