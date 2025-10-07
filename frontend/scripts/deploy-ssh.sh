#!/bin/bash

# Script de despliegue SSH para frontend React + Vite
# Autor: Sistema de Despliegue Automatizado

set -e

echo "🚀 Iniciando despliegue SSH..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Cargar configuración (desde el directorio del script o CWD)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/deploy-config.sh" ]; then
    source "$SCRIPT_DIR/deploy-config.sh"
elif [ -f "./deploy-config.sh" ]; then
    source ./deploy-config.sh
else
    # Configuración por defecto si no existe el archivo de configuración
    SERVER_IP="167.88.38.33"
    SERVER_PORT="22"
    REMOTE_USER="root"
    REMOTE_PATH="/var/www/html"
    LOCAL_DIST_PATH="./dist"
    CREATE_BACKUP=true
    VERIFY_DEPLOYMENT=true
    SET_PERMISSIONS=true
    WEB_USER="www-data"
    WEB_GROUP="www-data"
fi

# Función para mostrar mensajes
show_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

show_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

show_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Función para limpiar en caso de error
cleanup() {
    show_error "Proceso interrumpido. Limpiando..."
    exit 1
}

# Configurar trap para limpieza
trap cleanup INT TERM ERR

# Verificar si estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    show_error "No se encontró package.json. Ejecuta este script desde el directorio del frontend."
    exit 1
fi

# Verificar si existe la carpeta dist (con opción de build automático)
if [ ! -d "$LOCAL_DIST_PATH" ]; then
    if [ "${BUILD_FIRST:-false}" = "true" ]; then
        show_warning "No se encontró $LOCAL_DIST_PATH. Ejecutando build local..."
        npm ci
        npm run build
    else
        show_error "No se encontró la carpeta $LOCAL_DIST_PATH. Ejecuta 'npm run build' primero o habilita BUILD_FIRST=true en deploy-config.sh."
        exit 1
    fi
fi

# Función para probar conexión SSH
test_ssh_connection() {
    show_message "Probando conexión SSH al servidor..."
    
    if ssh -p $SERVER_PORT -o ConnectTimeout=10 -o BatchMode=yes $REMOTE_USER@$SERVER_IP "echo 'Conexión SSH exitosa'" 2>/dev/null; then
        show_message "✅ Conexión SSH establecida correctamente"
        return 0
    else
        show_error "❌ No se pudo conectar al servidor SSH"
        show_warning "Verifica:"
        echo "  - Que el servidor esté accesible en $SERVER_IP:$SERVER_PORT"
        echo "  - Que tengas las claves SSH configuradas"
        echo "  - Que el usuario $REMOTE_USER tenga acceso"
        return 1
    fi
}

# Función para crear backup del servidor
create_backup() {
    if [ "$CREATE_BACKUP" = "true" ]; then
        show_message "Creando backup del directorio actual en el servidor..."
        
        BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S)"
        
        ssh -p $SERVER_PORT $REMOTE_USER@$SERVER_IP "
            if [ -d '$REMOTE_PATH' ]; then
                cp -r $REMOTE_PATH ${REMOTE_PATH}_${BACKUP_NAME}
                echo 'Backup creado: ${REMOTE_PATH}_${BACKUP_NAME}'
            else
                echo 'No existe directorio para hacer backup'
            fi
        "
        
        show_message "✅ Backup creado: ${REMOTE_PATH}_${BACKUP_NAME}"
    else
        show_message "⏭️  Backup omitido (configurado como false)"
    fi
}

# Función para limpiar directorio remoto
clean_remote_directory() {
    show_message "Limpiando directorio remoto..."
    
    ssh -p $SERVER_PORT $REMOTE_USER@$SERVER_IP "
        if [ -d '$REMOTE_PATH' ]; then
            rm -rf $REMOTE_PATH/*
            echo 'Directorio remoto limpiado'
        else
            mkdir -p $REMOTE_PATH
            echo 'Directorio remoto creado'
        fi
    "
    
    show_message "✅ Directorio remoto preparado"
}

# Función para subir archivos (soporta despliegue atómico)
upload_files() {
    show_message "Subiendo archivos al servidor..."
    
    if [ "${ATOMIC_DEPLOY:-false}" = "true" ]; then
        TMP_PATH="${REMOTE_PATH}.new"
        show_message "Despliegue atómico habilitado. Subiendo a '$TMP_PATH' y luego reemplazando..."
        # Preparar directorio temporal en el servidor
        ssh -p $SERVER_PORT $REMOTE_USER@$SERVER_IP "rm -rf '$TMP_PATH' && mkdir -p '$TMP_PATH'"
        
        if command -v rsync &> /dev/null; then
            show_message "Usando rsync para transferencia optimizada..."
            rsync -avz --delete -e "ssh -p $SERVER_PORT" \
                "$LOCAL_DIST_PATH/" \
                "$REMOTE_USER@$SERVER_IP:$TMP_PATH/"
        else
            show_message "Usando scp para transferencia..."
            scp -P $SERVER_PORT -r "$LOCAL_DIST_PATH/"* "$REMOTE_USER@$SERVER_IP:$TMP_PATH/"
        fi

        # Intercambiar directorios de forma atómica
        BACKUP_SUFFIX="$(date +%Y%m%d_%H%M%S)"
        BACKUP_PATH="${REMOTE_PATH}.${BACKUP_SUFFIX}.bak"
        ssh -p $SERVER_PORT $REMOTE_USER@$SERVER_IP "
            set -e
            if [ -d '$REMOTE_PATH' ]; then
                rm -rf '$BACKUP_PATH'
                mv '$REMOTE_PATH' '$BACKUP_PATH'
            fi
            mv '$TMP_PATH' '$REMOTE_PATH'
        "
        show_message "✅ Archivos subidos y reemplazo atómico completado"
    else
        # No atómico: subir directamente al directorio remoto (limpiado previamente)
        if command -v rsync &> /dev/null; then
            show_message "Usando rsync para transferencia optimizada..."
            rsync -avz --delete -e "ssh -p $SERVER_PORT" \
                "$LOCAL_DIST_PATH/" \
                "$REMOTE_USER@$SERVER_IP:$REMOTE_PATH/"
        else
            show_message "Usando scp para transferencia..."
            scp -P $SERVER_PORT -r "$LOCAL_DIST_PATH/"* "$REMOTE_USER@$SERVER_IP:$REMOTE_PATH/"
        fi
        show_message "✅ Archivos subidos correctamente"
    fi
}

# Función para configurar permisos
set_permissions() {
    if [ "$SET_PERMISSIONS" = "true" ]; then
        show_message "Configurando permisos en el servidor..."
        
        ssh -p $SERVER_PORT $REMOTE_USER@$SERVER_IP "
            chmod -R 755 $REMOTE_PATH
            chown -R $WEB_USER:$WEB_GROUP $REMOTE_PATH 2>/dev/null || echo 'No se pudo cambiar propietario'
        "
        
        show_message "✅ Permisos configurados"
    else
        show_message "⏭️  Configuración de permisos omitida (configurado como false)"
    fi
}

# Función para verificar despliegue
verify_deployment() {
    if [ "$VERIFY_DEPLOYMENT" = "true" ]; then
        show_message "Verificando despliegue..."
        
        # Verificar que los archivos principales existen en el servidor
        ssh -p $SERVER_PORT $REMOTE_USER@$SERVER_IP "
            if [ -f '$REMOTE_PATH/index.html' ]; then
                echo '✅ index.html encontrado'
            else
                echo '❌ index.html no encontrado'
                exit 1
            fi
            
            if [ -d '$REMOTE_PATH/assets' ]; then
                echo '✅ carpeta assets encontrada'
            else
                echo '❌ carpeta assets no encontrada'
                exit 1
            fi
        "

        # Verificar URL pública si está definida
        if [ -n "${SITE_URL:-}" ]; then
            show_message "Verificando URL pública: $SITE_URL"
            if curl -sSIL --max-redirs 2 "$SITE_URL" >/dev/null; then
                show_message "✅ Respuesta HTTP recibida desde $SITE_URL"
            else
                show_warning "⚠️ No fue posible obtener respuesta HTTP desde $SITE_URL. Revisa DNS/SSL/puerto."
            fi
        fi
        
        show_message "✅ Verificación completada"
    else
        show_message "⏭️  Verificación omitida (configurado como false)"
    fi
}

# Función para mostrar información del despliegue
show_deployment_info() {
    echo ""
    echo -e "${BLUE}🎉 Despliegue completado exitosamente!${NC}"
    echo ""
    echo -e "${GREEN}📋 Información del despliegue:${NC}"
    echo "  Servidor: $SERVER_IP:$SERVER_PORT"
    echo "  Usuario: $REMOTE_USER"
    echo "  Directorio: $REMOTE_PATH"
    if [ -n "${SITE_URL:-}" ]; then
        echo "  URL: $SITE_URL"
    else
        echo "  URL: http://$SERVER_IP"
    fi
    echo ""
    echo -e "${YELLOW}📝 Notas importantes:${NC}"
    echo "  - Asegúrate de que el servidor web esté configurado correctamente (nginx/apache)"
    echo "  - Si usas nginx, apunta el root a $REMOTE_PATH y habilita SPA fallback (try_files ... /index.html)"
    echo "  - Si usas SSL, valida certificados y puertos abiertos"
    echo ""
}

# Función principal
main() {
    show_message "🎯 Despliegue SSH Frontend - Guro"
    echo ""
    
    # Aviso si no hay build y no se habilitó BUILD_FIRST
    if [ ! -d "$LOCAL_DIST_PATH" ] && [ "${BUILD_FIRST:-false}" != "true" ]; then
        show_warning "No existe $LOCAL_DIST_PATH. Considera habilitar BUILD_FIRST=true en deploy-config.sh"
    fi

    # Verificar conexión SSH
    if ! test_ssh_connection; then
        exit 1
    fi
    
    # Crear backup del directorio actual en el servidor (si está habilitado)
    create_backup
    
    # Preparar destino y subir archivos
    if [ "${ATOMIC_DEPLOY:-false}" = "true" ]; then
        upload_files
    else
        clean_remote_directory
        upload_files
    fi
    
    # Configurar permisos
    set_permissions

    # Recargar nginx si está configurado
    if [ "${NGINX_RELOAD:-false}" = "true" ] && [ "$WEB_SERVER" = "nginx" ]; then
        show_message "Recargando Nginx..."
        ssh -p $SERVER_PORT $REMOTE_USER@$SERVER_IP "nginx -s reload 2>/dev/null || systemctl reload nginx 2>/dev/null || service nginx reload 2>/dev/null || echo 'No se pudo recargar Nginx automáticamente'"
    fi
    
    # Verificar despliegue
    verify_deployment
    
    # Mostrar información final
    show_deployment_info
}

# Ejecutar función principal
main "$@" 