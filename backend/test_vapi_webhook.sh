#!/bin/bash

# =============================================================================
# Script para probar webhooks de VAPI con ngrok
# =============================================================================

echo "🔧 DIAGNÓSTICO DE WEBHOOK VAPI"
echo "================================"

# 1. Verificar que el servidor Laravel esté corriendo
echo ""
echo "1️⃣ Verificando servidor Laravel en puerto 8001..."
if lsof -i :8001 > /dev/null 2>&1; then
    echo "   ✅ Servidor Laravel corriendo en puerto 8001"
else
    echo "   ❌ Servidor Laravel NO está corriendo"
    echo "   Ejecuta: php artisan serve --port=8001"
    exit 1
fi

# 2. Verificar ngrok
echo ""
echo "2️⃣ Verificando ngrok..."
if command -v ngrok &> /dev/null; then
    echo "   ✅ ngrok está instalado"
else
    echo "   ❌ ngrok NO está instalado"
    echo "   Instala con: brew install ngrok"
    exit 1
fi

# 3. Instrucciones para iniciar ngrok
echo ""
echo "3️⃣ PASOS PARA CONFIGURAR NGROK:"
echo "   ================================"
echo ""
echo "   a) En una terminal nueva, ejecuta:"
echo "      ngrok http 8001"
echo ""
echo "   b) Copia la URL pública (ej: https://abc123.ngrok-free.app)"
echo ""
echo "   c) Configura el webhook en VAPI Dashboard:"
echo "      - Ve a: https://dashboard.vapi.ai"
echo "      - Settings > Phone Numbers > Tu número"
echo "      - Server URL: https://TU-URL-NGROK.ngrok-free.app/api/saas/voice-campaigns/webhooks/vapi"
echo ""
echo "   d) O configura en el asistente/agente:"
echo "      - Assistants > Tu agente > Server URL"
echo ""

# 4. Probar el endpoint localmente
echo "4️⃣ Probando endpoint webhook localmente..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:8001/api/saas/voice-campaigns/webhooks/vapi \
    -H "Content-Type: application/json" \
    -d '{"type":"test","message":{"type":"status-update","status":"test"}}')

if [ "$RESPONSE" == "200" ]; then
    echo "   ✅ Endpoint webhook responde correctamente (HTTP $RESPONSE)"
else
    echo "   ⚠️ Endpoint webhook respondió con HTTP $RESPONSE"
fi

# 5. Simular un webhook end-of-call-report
echo ""
echo "5️⃣ Simulando webhook end-of-call-report..."
echo "   (Esto requiere un call_id válido en la BD)"

# Obtener el último call_id de la BD
LAST_CALL=$(curl -s http://127.0.0.1:8001/api/test/voice-calls-debug 2>/dev/null | grep -o '"elevenlabs_conversation_id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$LAST_CALL" ]; then
    echo "   📞 Último call_id encontrado: $LAST_CALL"
    echo ""
    echo "   Para simular un webhook completo, ejecuta:"
    echo ""
    cat << EOF
   curl -X POST http://127.0.0.1:8001/api/saas/voice-campaigns/webhooks/vapi \\
     -H "Content-Type: application/json" \\
     -d '{
       "message": {
         "type": "end-of-call-report",
         "call": {
           "id": "$LAST_CALL",
           "status": "ended",
           "endedReason": "customer-ended-call",
           "duration": 120
         },
         "transcript": "Hola, esta es una prueba de transcripción.",
         "summary": "Llamada de prueba completada exitosamente.",
         "recordingUrl": "https://example.com/recording.mp3",
         "cost": 0.05
       }
     }'
EOF
else
    echo "   ⚠️ No se encontraron llamadas en la BD para simular"
fi

echo ""
echo "================================"
echo "📋 RESUMEN DE CONFIGURACIÓN VAPI"
echo "================================"
echo ""
echo "URL del webhook que debes configurar en VAPI:"
echo "  https://TU-URL-NGROK.ngrok-free.app/api/saas/voice-campaigns/webhooks/vapi"
echo ""
echo "Eventos que VAPI enviará:"
echo "  - status-update (cuando cambia el estado de la llamada)"
echo "  - end-of-call-report (cuando termina la llamada - contiene transcript, recording, cost)"
echo "  - transcript (actualizaciones de transcripción en tiempo real)"
echo ""
