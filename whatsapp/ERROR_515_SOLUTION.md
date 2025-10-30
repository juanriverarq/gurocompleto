# Solución para Error 515 - Stream Errored

## Problema
El error 515 "Stream Errored (restart required)" ocurre después de escanear el código QR exitosamente. Este es un problema común con Baileys relacionado con la configuración del socket y la gestión de la conexión.

## Cambios Realizados

### 1. Actualización de la Configuración del Socket (`whatsappInstance.js`)

Se agregaron las siguientes configuraciones al socket de Baileys:

```javascript
this.sock = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: false,
    browser: this.config.browser,
    generateHighQualityLinkPreview: true,
    markOnlineOnConnect: false,
    
    // ✅ NUEVAS CONFIGURACIONES PARA EVITAR ERROR 515
    syncFullHistory: false,              // No sincronizar historial completo
    defaultQueryTimeoutMs: 60000,        // Timeout de 60 segundos para queries
    connectTimeoutMs: 60000,             // Timeout de 60 segundos para conexión
    keepAliveIntervalMs: 30000,          // Keep-alive cada 30 segundos
    retryRequestDelayMs: 250,            // Delay de 250ms entre reintentos
    maxMsgRetryCount: 5,                 // Máximo 5 reintentos por mensaje
    logger: {
        level: 'silent',                 // Logging silencioso (cambiar a 'debug' si necesitas más info)
        child: () => ({ level: 'silent' })
    }
});
```

### 2. Manejo Específico del Error 515

Se agregó un caso específico para manejar el error 515 con reconexión automática:

```javascript
case 515: // Error específico "Stream Errored"
    console.log(`⚠️ [${this.instanceId}] Error 515 detectado - Reconectando inmediatamente...`);
    setTimeout(() => this.connect(), 2000);
    break;
```

Además, se agregó un override para reconectar automáticamente incluso si `autoReconnect` está desactivado:

```javascript
// Incluso sin autoReconnect, manejar error 515 automáticamente
if (statusCode === 515) {
    console.log(`⚠️ [${this.instanceId}] Error 515 detectado - Reconectando automáticamente (override autoReconnect)...`);
    setTimeout(() => this.connect(), 2000);
}
```

### 3. Actualización de Baileys

Se actualizó la versión de Baileys en `package.json`:

```json
"@whiskeysockets/baileys": "^6.7.9"
```

## Pasos para Aplicar la Solución

1. **Instalar las dependencias actualizadas:**
   ```bash
   cd whatsapp
   npm install
   ```

2. **Limpiar las sesiones anteriores (IMPORTANTE):**
   ```bash
   # Eliminar todas las carpetas de autenticación anteriores
   rm -rf auth_info/*
   ```

3. **Reiniciar el servicio de WhatsApp:**
   ```bash
   # Si está corriendo, detenerlo primero
   pkill -f "node src/index.js"
   
   # Iniciar el servicio
   npm start
   # O en modo desarrollo:
   npm run dev
   ```

4. **Probar la conexión:**
   - Crear una nueva instancia
   - Solicitar el código QR
   - Escanear el código QR
   - La conexión debería establecerse automáticamente después del escaneo
   - Si aparece el error 515, el sistema reconectará automáticamente en 2 segundos

## Comportamiento Esperado

1. **Primera conexión:**
   - Se genera el QR
   - Usuario escanea el QR
   - Puede aparecer error 515 brevemente
   - Sistema reconecta automáticamente
   - Conexión se establece exitosamente

2. **Reconexiones posteriores:**
   - El sistema usa las credenciales guardadas
   - No se requiere escanear QR nuevamente
   - Conexión directa sin errores

## Logs a Monitorear

```bash
# Logs exitosos:
✅ [instance_XX] QR Code generado
✅ [instance_XX] Conectado a WhatsApp exitosamente
💾 [instance_XX] Credenciales guardadas

# Si aparece error 515:
❌ [instance_XX] Conexión cerrada: { reason: 'Stream Errored (restart required)', statusCode: 515 }
⚠️ [instance_XX] Error 515 detectado - Reconectando inmediatamente...
🔄 [instance_XX] Iniciando conexión a WhatsApp...
✅ [instance_XX] Conectado a WhatsApp exitosamente
```

## Troubleshooting

### Si el error persiste:

1. **Verificar versión de Node.js:**
   ```bash
   node --version
   # Debe ser >= 16.0.0
   ```

2. **Limpiar completamente las sesiones:**
   ```bash
   cd whatsapp
   rm -rf auth_info
   rm -rf node_modules
   npm install
   ```

3. **Verificar que no haya múltiples instancias corriendo:**
   ```bash
   ps aux | grep "node src/index.js"
   # Si hay múltiples, matar todos:
   pkill -f "node src/index.js"
   ```

4. **Revisar los logs en tiempo real:**
   ```bash
   cd whatsapp
   npm run dev
   ```

5. **Probar con una instancia nueva:**
   - Eliminar la instancia problemática
   - Crear una nueva instancia con un ID diferente
   - Intentar conectar nuevamente

## Notas Importantes

- El error 515 es temporal y el sistema ahora lo maneja automáticamente
- Las credenciales se guardan después del primer emparejamiento exitoso
- No es necesario escanear el QR en cada reconexión
- Si el problema persiste después de 3 intentos, considera actualizar Baileys a la versión 7.x (requiere cambios mayores en el código)

## Referencias

- [Baileys GitHub](https://github.com/WhiskeySockets/Baileys)
- [Baileys Issues - Error 515](https://github.com/WhiskeySockets/Baileys/issues?q=is%3Aissue+515)