# Guía de Actualización de Baileys

## Actualización Rápida

```bash
cd whatsapp
npm update @whiskeysockets/baileys
npm start
```

## Si hay Breaking Changes

Solo necesitas modificar **UN archivo**: `/src/adapters/baileysAdapter.js`

### Pasos:

1. **Revisar el changelog de Baileys**: https://github.com/WhiskeySockets/Baileys/releases

2. **Actualizar imports** si cambiaron nombres de funciones:
```javascript
// En baileysAdapter.js, línea ~14
const {
    default: makeWASocket,  // Si cambia el nombre, actualizar aquí
    DisconnectReason,
    useMultiFileAuthState,
    // ... agregar nuevas funciones aquí
} = require('@whiskeysockets/baileys');
```

3. **Actualizar códigos de desconexión** si cambiaron:
```javascript
// En baileysAdapter.js, línea ~32
const DISCONNECT_REASONS = {
    BAD_SESSION: DisconnectReason?.badSession || 500,
    // ... actualizar valores si cambiaron
};
```

4. **Actualizar configuración del socket** si hay nuevas opciones:
```javascript
// En baileysAdapter.js, línea ~47
const DEFAULT_SOCKET_CONFIG = {
    // ... agregar nuevas opciones aquí
};
```

## Estructura del Adapter

```
/whatsapp
├── src/
│   ├── adapters/
│   │   └── baileysAdapter.js    ← ÚNICO archivo a modificar
│   ├── services/
│   │   └── whatsappInstance.js  ← Usa el adapter, NO modificar
│   └── ...
```

## Funciones del Adapter

| Función | Descripción |
|---------|-------------|
| `createSocket(options)` | Crea socket de WhatsApp |
| `getAuthState(authDir)` | Obtiene estado de autenticación |
| `getLatestVersion()` | Obtiene versión de WhatsApp Web |
| `downloadMedia(message)` | Descarga media de mensaje |
| `shouldAutoReconnect(code)` | Verifica si debe reconectar |
| `isUserLogout(code)` | Verifica si usuario cerró sesión |
| `isBadSession(code)` | Verifica si sesión corrupta |
| `extractPhoneFromJid(jid)` | Extrae teléfono de JID |
| `formatJid(phone)` | Formatea teléfono a JID |
| `extractMessageText(msg)` | Extrae texto de mensaje |

## Acceso a Baileys Original

Si necesitas funciones originales de Baileys:

```javascript
const BaileysAdapter = require('./adapters/baileysAdapter');

// Acceso a funciones originales
const { makeWASocket, proto } = BaileysAdapter.raw;
```

## Versión Actual

- **Baileys**: ^6.7.9
- **Última actualización**: Enero 2026
