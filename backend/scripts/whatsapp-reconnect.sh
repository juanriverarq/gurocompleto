#!/bin/bash
# =============================================================
# Script de Reconexión Automática de WhatsApp
# =============================================================
# Ejecutar después de reiniciar el microservicio de WhatsApp
# para restaurar todas las instancias sin perder datos.
#
# Uso:
#   ./scripts/whatsapp-reconnect.sh
#   ./scripts/whatsapp-reconnect.sh --only-connected
#   ./scripts/whatsapp-reconnect.sh --wait 10
# =============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"

cd "$BACKEND_DIR" || exit 1

echo "═══════════════════════════════════════════════════════════"
echo "🔄 RECONEXIÓN AUTOMÁTICA DE WHATSAPP"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Parsear argumentos
WAIT_TIME=5
ONLY_CONNECTED=""
FORCE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --wait)
            WAIT_TIME="$2"
            shift 2
            ;;
        --only-connected)
            ONLY_CONNECTED="--only-connected"
            shift
            ;;
        --force)
            FORCE="--force"
            shift
            ;;
        *)
            shift
            ;;
    esac
done

echo "📋 Configuración:"
echo "   - Tiempo de espera: ${WAIT_TIME}s"
echo "   - Solo conectadas: ${ONLY_CONNECTED:-No}"
echo "   - Forzar recreación: ${FORCE:-No}"
echo ""

# Ejecutar comando de sincronización
php artisan whatsapp:sync-instances \
    --wait-for-microservice="$WAIT_TIME" \
    $ONLY_CONNECTED \
    $FORCE

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Reconexión completada exitosamente"
else
    echo "⚠️  Reconexión completada con errores (código: $EXIT_CODE)"
fi

exit $EXIT_CODE
