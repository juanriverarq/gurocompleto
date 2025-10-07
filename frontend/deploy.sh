#!/bin/bash

# Script de despliegue para frontend React + Vite
# Autor: Sistema de Despliegue Automatizado

set -e

echo "🚀 Iniciando proceso de despliegue..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Verificar Node.js
if ! command -v node &> /dev/null; then
    show_error "Node.js no está instalado. Por favor, instala Node.js antes de continuar."
    exit 1
fi

# Verificar npm
if ! command -v npm &> /dev/null; then
    show_error "npm no está instalado. Por favor, instala npm antes de continuar."
    exit 1
fi

# Función para despliegue en Vercel
deploy_vercel() {
    show_message "Desplegando en Vercel..."
    
    if ! command -v vercel &> /dev/null; then
        show_warning "Vercel CLI no está instalado. Instalando..."
        npm install -g vercel
    fi
    
    show_message "Configurando proyecto en Vercel..."
    vercel --prod
    
    show_message "✅ Despliegue en Vercel completado!"
}

# Función para despliegue en Netlify
deploy_netlify() {
    show_message "Desplegando en Netlify..."
    
    if ! command -v netlify &> /dev/null; then
        show_warning "Netlify CLI no está instalado. Instalando..."
        npm install -g netlify-cli
    fi
    
    show_message "Construyendo aplicación..."
    npm run build
    
    show_message "Desplegando en Netlify..."
    netlify deploy --prod --dir=dist
    
    show_message "✅ Despliegue en Netlify completado!"
}

# Función para construcción local
build_local() {
    show_message "Construyendo aplicación localmente..."
    
    # Limpiar dependencias anteriores
    show_message "Limpiando node_modules..."
    rm -rf node_modules
    
    # Instalar dependencias
    show_message "Instalando dependencias..."
    npm ci
    
    # Construir aplicación
    show_message "Construyendo aplicación..."
    npm run build
    
    show_message "✅ Construcción local completada!"
    show_message "📁 Archivos generados en: ./dist"
}

# Función para construcción Docker
build_docker() {
    show_message "Construyendo imagen Docker..."
    
    if ! command -v docker &> /dev/null; then
        show_error "Docker no está instalado. Por favor, instala Docker antes de continuar."
        exit 1
    fi
    
    # Nombre de la imagen
    IMAGE_NAME="guro-frontend"
    
    show_message "Construyendo imagen Docker: $IMAGE_NAME"
    docker build -t $IMAGE_NAME .
    
    show_message "✅ Imagen Docker construida: $IMAGE_NAME"
    show_message "Para ejecutar: docker run -p 3000:80 $IMAGE_NAME"
}

# Función para mostrar ayuda
show_help() {
    echo -e "${BLUE}📋 Opciones de despliegue disponibles:${NC}"
    echo ""
    echo "  1. vercel    - Despliega en Vercel (recomendado)"
    echo "  2. netlify   - Despliega en Netlify"
    echo "  3. build     - Construye localmente"
    echo "  4. docker    - Construye imagen Docker"
    echo "  5. help      - Muestra esta ayuda"
    echo ""
    echo -e "${YELLOW}Uso: $0 [opción]${NC}"
    echo ""
    echo -e "${GREEN}Ejemplo: $0 vercel${NC}"
}

# Función principal
main() {
    show_message "🎯 Sistema de Despliegue Frontend - Guro"
    echo ""
    
    case "${1:-help}" in
        "vercel")
            deploy_vercel
            ;;
        "netlify")
            deploy_netlify
            ;;
        "build")
            build_local
            ;;
        "docker")
            build_docker
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# Ejecutar función principal
main "$@"
