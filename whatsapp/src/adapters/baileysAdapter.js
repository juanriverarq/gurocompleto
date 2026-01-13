/**
 * BAILEYS ADAPTER
 * ================
 * Capa de abstracción para la librería Baileys.
 * 
 * PARA ACTUALIZAR BAILEYS:
 * 1. npm update @whiskeysockets/baileys
 * 2. Si hay breaking changes, solo modifica este archivo
 * 3. El resto del código no necesita cambios
 * 
 * Este adapter expone una API estable que no cambia aunque Baileys cambie.
 */

const baileys = require('@whiskeysockets/baileys');

// Extraer funciones de Baileys con fallbacks para compatibilidad
const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    downloadMediaMessage,
    fetchLatestBaileysVersion,
    // Nuevas funciones que pueden agregarse en futuras versiones
    proto,
    getContentType,
    generateWAMessageFromContent,
    prepareWAMessageMedia,
} = baileys;

/**
 * Códigos de desconexión normalizados
 * Si Baileys cambia estos valores, solo hay que actualizarlos aquí
 */
const DISCONNECT_REASONS = {
    BAD_SESSION: DisconnectReason?.badSession || 500,
    CONNECTION_CLOSED: DisconnectReason?.connectionClosed || 428,
    CONNECTION_LOST: DisconnectReason?.connectionLost || 408,
    CONNECTION_REPLACED: DisconnectReason?.connectionReplaced || 440,
    LOGGED_OUT: DisconnectReason?.loggedOut || 401,
    RESTART_REQUIRED: DisconnectReason?.restartRequired || 515,
    TIMED_OUT: DisconnectReason?.timedOut || 408,
    // Error 515 específico de Stream Errored
    STREAM_ERRORED: 515,
};

/**
 * Configuración por defecto del socket
 * Ajustar aquí si Baileys cambia opciones
 */
const DEFAULT_SOCKET_CONFIG = {
    printQRInTerminal: false,
    generateHighQualityLinkPreview: true,
    markOnlineOnConnect: false,
    syncFullHistory: false,
    defaultQueryTimeoutMs: 60000,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    retryRequestDelayMs: 250,
    maxMsgRetryCount: 5,
};

/**
 * Logger silencioso compatible con Baileys (pino-like)
 */
const createSilentLogger = () => ({
    level: 'silent',
    fatal: () => {},
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
    trace: () => {},
    child: function() { return this; }
});

/**
 * Crear socket de WhatsApp con configuración normalizada
 * @param {Object} options - Opciones del socket
 * @returns {Object} Socket de WhatsApp
 */
function createSocket(options = {}) {
    const config = {
        ...DEFAULT_SOCKET_CONFIG,
        ...options,
        logger: options.logger || createSilentLogger(),
    };
    
    return makeWASocket(config);
}

/**
 * Obtener estado de autenticación multi-archivo
 * @param {string} authDir - Directorio de autenticación
 * @returns {Promise<{state: Object, saveCreds: Function}>}
 */
async function getAuthState(authDir) {
    return useMultiFileAuthState(authDir);
}

/**
 * Obtener última versión de Baileys/WhatsApp Web
 * @returns {Promise<{version: Array, isLatest: boolean}>}
 */
async function getLatestVersion() {
    try {
        return await fetchLatestBaileysVersion();
    } catch (error) {
        console.warn('⚠️ No se pudo obtener la última versión de WhatsApp Web, usando default');
        return { version: [2, 3000, 1015901307], isLatest: false };
    }
}

/**
 * Descargar media de un mensaje
 * @param {Object} message - Mensaje de WhatsApp
 * @param {string} type - Tipo de media
 * @returns {Promise<Buffer>}
 */
async function downloadMedia(message, type) {
    return downloadMediaMessage(message, type || 'buffer', {});
}

/**
 * Verificar si un código de desconexión requiere reconexión automática
 * @param {number} statusCode - Código de estado
 * @returns {boolean}
 */
function shouldAutoReconnect(statusCode) {
    // Errores técnicos que requieren reconexión
    const autoReconnectCodes = [
        DISCONNECT_REASONS.STREAM_ERRORED,
        DISCONNECT_REASONS.RESTART_REQUIRED,
        DISCONNECT_REASONS.CONNECTION_CLOSED,
        DISCONNECT_REASONS.CONNECTION_LOST,
        DISCONNECT_REASONS.TIMED_OUT,
    ];
    
    return autoReconnectCodes.includes(statusCode);
}

/**
 * Verificar si el usuario cerró sesión intencionalmente
 * @param {number} statusCode - Código de estado
 * @returns {boolean}
 */
function isUserLogout(statusCode) {
    return statusCode === DISCONNECT_REASONS.LOGGED_OUT;
}

/**
 * Verificar si la sesión está corrupta
 * @param {number} statusCode - Código de estado
 * @returns {boolean}
 */
function isBadSession(statusCode) {
    return statusCode === DISCONNECT_REASONS.BAD_SESSION;
}

/**
 * Extraer número de teléfono de un JID
 * @param {string} jid - JID de WhatsApp
 * @returns {string}
 */
function extractPhoneFromJid(jid) {
    if (!jid) return '';
    return jid.replace('@s.whatsapp.net', '').replace('@g.us', '').split(':')[0];
}

/**
 * Formatear JID para envío
 * @param {string} phone - Número de teléfono
 * @returns {string}
 */
function formatJid(phone) {
    const cleaned = phone.replace(/\D/g, '');
    return `${cleaned}@s.whatsapp.net`;
}

/**
 * Extraer texto de un mensaje
 * @param {Object} message - Mensaje de WhatsApp
 * @returns {string}
 */
function extractMessageText(message) {
    if (!message?.message) return '';
    
    const msg = message.message;
    
    return msg.conversation ||
           msg.extendedTextMessage?.text ||
           msg.imageMessage?.caption ||
           msg.videoMessage?.caption ||
           msg.documentMessage?.caption ||
           '';
}

/**
 * Verificar si un mensaje es entrante (no enviado por nosotros)
 * @param {Object} message - Mensaje de WhatsApp
 * @returns {boolean}
 */
function isIncomingMessage(message) {
    return !message?.key?.fromMe && message?.message;
}

/**
 * Obtener tipo de contenido del mensaje
 * @param {Object} message - Mensaje de WhatsApp
 * @returns {string}
 */
function getMessageType(message) {
    if (!message?.message) return 'unknown';
    
    if (getContentType) {
        return getContentType(message.message) || 'unknown';
    }
    
    // Fallback manual
    const msg = message.message;
    if (msg.conversation || msg.extendedTextMessage) return 'text';
    if (msg.imageMessage) return 'image';
    if (msg.videoMessage) return 'video';
    if (msg.audioMessage) return 'audio';
    if (msg.documentMessage) return 'document';
    if (msg.stickerMessage) return 'sticker';
    if (msg.contactMessage) return 'contact';
    if (msg.locationMessage) return 'location';
    
    return 'unknown';
}

// Exportar todo
module.exports = {
    // Funciones principales
    createSocket,
    getAuthState,
    getLatestVersion,
    downloadMedia,
    
    // Utilidades de desconexión
    DISCONNECT_REASONS,
    shouldAutoReconnect,
    isUserLogout,
    isBadSession,
    
    // Utilidades de mensajes
    extractPhoneFromJid,
    formatJid,
    extractMessageText,
    isIncomingMessage,
    getMessageType,
    
    // Utilidades
    createSilentLogger,
    DEFAULT_SOCKET_CONFIG,
    
    // Re-exportar funciones originales de Baileys para casos especiales
    raw: {
        makeWASocket,
        DisconnectReason,
        useMultiFileAuthState,
        downloadMediaMessage,
        fetchLatestBaileysVersion,
        proto,
        generateWAMessageFromContent,
        prepareWAMessageMedia,
    }
};
