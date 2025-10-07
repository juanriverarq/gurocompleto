#!/bin/bash

# Script para iniciar automáticamente el microservicio de WhatsApp
# Uso: ./start_microservice.sh

cd "$(dirname "$0")"

# Verificar si ya está corriendo
if pgrep -f "nodemon src/index.js" > /dev/null; then
    echo "🟢 Microservicio WhatsApp ya está corriendo"
    ps aux | grep -i nodemon | grep -v grep
    exit 0
fi

echo "🚀 Iniciando microservicio de WhatsApp..."

# Instalar dependencias si no existen
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
fi

# Iniciar en background
echo "🔄 Iniciando servidor..."
npm run dev > microservice.log 2>&1 &

# Esperar a que inicie
echo "⏳ Esperando que el servidor inicie..."
sleep 5

# Verificar que está corriendo
if pgrep -f "nodemon src/index.js" > /dev/null; then
    echo "✅ Microservicio iniciado exitosamente"
    echo "📋 URL: http://localhost:3000/api/v1"
    echo "📄 Logs: tail -f microservice.log"
    
    # Probar conectividad
    if curl -s "http://localhost:3000/api/v1/instances" > /dev/null; then
        echo "🟢 API respondiendo correctamente"
    else
        echo "⚠️  API no responde, revisar logs"
    fi
else
    echo "❌ Error al iniciar el microservicio"
    echo "📄 Revisar logs: cat microservice.log"
    exit 1
fi