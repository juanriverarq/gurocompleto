#!/bin/bash

# Script para iniciar el servidor Laravel con acceso desde la red local
# Esto permitirá que la app móvil se conecte al backend

echo "🚀 Iniciando servidor Laravel para desarrollo móvil..."
echo "📱 La app móvil podrá conectarse desde: http://192.168.1.40:8001/api"
echo "💻 El frontend web seguirá disponible en: http://127.0.0.1:8001"
echo ""
echo "⚠️  IMPORTANTE: Este servidor está configurado para desarrollo"
echo "   No uses esta configuración en producción"
echo ""

# Detener servidor anterior si existe
pkill -f "php artisan serve"
sleep 2

# Iniciar servidor en todas las interfaces
php artisan serve --host=0.0.0.0 --port=8001

