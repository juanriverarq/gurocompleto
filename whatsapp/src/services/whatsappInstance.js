const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    downloadMediaMessage,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
const PhoneUtils = require('../utils/phoneUtils');

class WhatsAppInstance {
    constructor(instanceId, io, database, settings = {}) {
        this.instanceId = instanceId;
        this.io = io;
        this.database = database;
        this.settings = settings;
        
        // Estado de la instancia - INICIALIZAR SIEMPRE COMO DESCONECTADO
        this.sock = null;
        this.qrCode = null;
        this.connected = false;
        this.connecting = false;
        this.lastActivity = new Date();
        
        // Directorio de auth específico por instancia
        this.authDir = path.join(__dirname, `../../auth_info/${instanceId}`);
        
        // Crear directorio de autenticación si no existe
        this.createAuthDir();
        
        // Configuración específica de la instancia
        this.config = {
            browser: settings.browser || ['GuroMensajes', 'Chrome', '1.0.0'],
            webhook: settings.webhook || null,
            // Desactivado por defecto: solo se reintenta si settings.autoReconnect === true
            autoReconnect: settings.autoReconnect === true,
            maxReconnectAttempts: settings.maxReconnectAttempts || 5,
            ...settings
        };
        
        console.log(`📱 Instancia ${instanceId} inicializada - Estado inicial: connected=${this.connected}, connecting=${this.connecting}`);
    }

    createAuthDir() {
        if (!fs.existsSync(this.authDir)) {
            fs.mkdirSync(this.authDir, { recursive: true });
            console.log(`📁 Directorio creado: ${this.authDir}`);
        }
    }

    async connect() {
        if (this.connecting) {
            console.log(`🔄 [${this.instanceId}] Ya hay una conexión en progreso...`);
            return;
        }

        try {
            this.connecting = true;
            console.log(`🔄 [${this.instanceId}] Iniciando conexión a WhatsApp...`);
            
            // Limpiar socket anterior si existe
            if (this.sock) {
                try {
                    this.sock.ev.removeAllListeners();
                    this.sock.end();
                } catch (e) {
                    console.log(`🗑️ [${this.instanceId}] Limpiando socket anterior...`);
                }
                this.sock = null;
            }
            
            // Usar el nuevo sistema de autenticación multi-archivo
            const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
            
            console.log(`📁 [${this.instanceId}] Estado de autenticación cargado:`, {
                hasKeys: !!state.keys,
                hasCreds: !!state.creds
            });
            
            // Forzar versión de WhatsApp Web para evitar bloqueos por incompatibilidad
            const { version, isLatest } = await fetchLatestBaileysVersion();
            try {
                console.log(`🧩 [${this.instanceId}] Usando WhatsApp Web v${version?.join?.('.')}, latest=${isLatest}`);
            } catch (e) {}

            // Logger compatible con Baileys (pino-like)
            const logger = {
                level: 'silent',
                fatal: () => {},
                error: () => {},
                warn: () => {},
                info: () => {},
                debug: () => {},
                trace: () => {},
                child: () => logger
            };

            this.sock = makeWASocket({
                auth: state,
                version,
                printQRInTerminal: false,
                browser: this.config.browser,
                generateHighQualityLinkPreview: true,
                // mantener offline al conectar para reducir fricción inicial durante pairing
                markOnlineOnConnect: false,
                // Configuraciones adicionales para evitar error 515
                syncFullHistory: false,
                defaultQueryTimeoutMs: 60000,
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                // Configuración de reconexión mejorada
                retryRequestDelayMs: 250,
                maxMsgRetryCount: 5,
                // Logger compatible con Baileys
                logger
            });

            // Eventos de conexión
            this.sock.ev.on('connection.update', async (update) => {
                await this.handleConnectionUpdate(update);
            });

            // Guardar credenciales cuando cambien
            this.sock.ev.on('creds.update', async (creds) => {
                try {
                    await saveCreds();
                    console.log(`💾 [${this.instanceId}] Credenciales guardadas`);
                } catch (error) {
                    console.error(`❌ [${this.instanceId}] Error guardando credenciales:`, error);
                }
            });
            
            // Manejar mensajes entrantes
            this.sock.ev.on('messages.upsert', async (m) => {
                try {
                    await this.handleIncomingMessages(m);
                } catch (msgError) {
                    console.error(`❌ [${this.instanceId}] Error procesando mensajes:`, msgError);
                }
            });
            
        } catch (error) {
            this.connecting = false;
            console.error(`❌ [${this.instanceId}] Error conectando a WhatsApp:`, error);
            
            // Reintentar conexión si está habilitado
            if (this.config.autoReconnect) {
                setTimeout(() => {
                    console.log(`🔁 [${this.instanceId}] Reintentando conexión...`);
                    this.connect();
                }, 15000);
            }
        }
    }

    async handleConnectionUpdate(update) {
        const { connection, lastDisconnect, qr, isNewLogin } = update;

        console.log(`🔄 [${this.instanceId}] Estado de conexión:`, {
            connection,
            isNewLogin,
            hasQR: !!qr,
            lastDisconnectReason: lastDisconnect?.error?.message,
            statusCode: lastDisconnect?.error?.output?.statusCode
        });

        if (qr) {
            console.log(`🔑 [${this.instanceId}] QR Code generado - MARCANDO COMO NO CONECTADO`);
            console.log(`🔍 [${this.instanceId}] Detalles del QR:`, {
                qrLength: qr?.length,
                qrPreview: qr?.substring(0, 50) + '...'
            });

            // IMPORTANTE: Al generar QR, la instancia NO está conectada
            this.connected = false;
            this.connecting = true;

            try {
                this.qrCode = await qrcode.toDataURL(qr);

                console.log(`✅ [${this.instanceId}] QR convertido a DataURL exitosamente`);

                // Emitir eventos específicos por instancia
                this.io.emit(`qr_code_${this.instanceId}`, this.qrCode);
                this.io.emit('instance_update', {
                    instanceId: this.instanceId,
                    event: 'qr_code',
                    data: this.qrCode
                });

                console.log(`📡 [${this.instanceId}] QR Code enviado via WebSocket - Estado: connecting=true, connected=false`);
            } catch (qrError) {
                console.error(`❌ [${this.instanceId}] Error generando QR:`, qrError);
                console.error(`❌ [${this.instanceId}] Detalles del error QR:`, {
                    message: qrError.message,
                    stack: qrError.stack,
                    qrData: qr?.substring(0, 100)
                });
            }
        }
        
        if (connection === 'close') {
            this.connecting = false;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            
            console.log(`❌ [${this.instanceId}] Conexión cerrada:`, {
                reason: lastDisconnect?.error?.message,
                statusCode,
                shouldReconnect
            });
            
            this.connected = false;
            this.qrCode = null;
            
            // Emitir eventos de desconexión
            this.io.emit(`connection_status_${this.instanceId}`, { connected: false });
            this.io.emit('instance_update', {
                instanceId: this.instanceId,
                event: 'disconnected',
                data: { statusCode, reason: lastDisconnect?.error?.message }
            });
            
            // Manejar diferentes tipos de desconexión
            if (this.config.autoReconnect) {
                switch (statusCode) {
                    case DisconnectReason.badSession:
                        console.log(`🗑️ [${this.instanceId}] Sesión corrupta, eliminando archivos de auth...`);
                        await this.clearAuthState();
                        setTimeout(() => this.connect(), 2000);
                        break;
                        
                    case DisconnectReason.connectionClosed:
                    case DisconnectReason.connectionLost:
                    case DisconnectReason.restartRequired:
                        console.log(`🔁 [${this.instanceId}] Reconectando en 5 segundos...`);
                        setTimeout(() => this.connect(), 5000);
                        break;
                        
                    case 515: // Error específico "Stream Errored"
                        console.log(`⚠️ [${this.instanceId}] Error 515 detectado - Reconectando inmediatamente...`);
                        setTimeout(() => this.connect(), 2000);
                        break;
                        
                    case DisconnectReason.loggedOut:
                        console.log(`🚪 [${this.instanceId}] Usuario deslogueado, limpiando sesión...`);
                        await this.clearAuthState();
                        this.io.emit(`qr_code_${this.instanceId}`, null);
                        // Intentar reconectar para generar nuevo QR
                        setTimeout(() => this.connect(), 2000);
                        break;
                        
                    default:
                        if (shouldReconnect) {
                            console.log(`🔁 [${this.instanceId}] Reconectando en 10 segundos...`);
                            setTimeout(() => this.connect(), 10000);
                        }
                }
            } else {
                // Incluso sin autoReconnect, manejar error 515 automáticamente
                if (statusCode === 515) {
                    console.log(`⚠️ [${this.instanceId}] Error 515 detectado - Reconectando automáticamente (override autoReconnect)...`);
                    setTimeout(() => this.connect(), 2000);
                }
            }
        } else if (connection === 'connecting') {
            console.log(`🔄 [${this.instanceId}] Conectando...`);
        } else if (connection === 'open') {
            this.connecting = false;
            console.log(`✅ [${this.instanceId}] Conectado a WhatsApp exitosamente`);
            this.connected = true;
            this.qrCode = null;
            this.lastActivity = new Date();
            
            // Emitir eventos de conexión exitosa
            this.io.emit(`connection_status_${this.instanceId}`, { connected: true });
            this.io.emit(`qr_code_${this.instanceId}`, null);
            this.io.emit('instance_update', {
                instanceId: this.instanceId,
                event: 'connected',
                data: { timestamp: this.lastActivity }
            });
            
            // Sincronizar contactos
            try {
                await this.syncContacts();
            } catch (syncError) {
                console.error(`❌ [${this.instanceId}] Error sincronizando contactos:`, syncError);
            }
        }
    }

    async handleIncomingMessages(messageUpdate) {
        const { messages } = messageUpdate;
        
        for (const message of messages) {
            if (!message.key.fromMe && message.message) {
                const phone = message.key.remoteJid.replace('@s.whatsapp.net', '');
                const messageText = message.message.conversation || 
                                 message.message.extendedTextMessage?.text || '';
                
                // Actualizar última actividad
                this.lastActivity = new Date();
                
                // Guardar mensaje en la base de datos con instance_id
                await this.database.saveMessage({
                    id: message.key.id,
                    phone,
                    message: messageText,
                    type: 'received',
                    timestamp: new Date(message.messageTimestamp * 1000),
                    instance_id: this.instanceId
                });
                
                // Verificar si el contacto existe, si no, crearlo
                let contact = await this.database.getContact(phone, this.instanceId);
                if (!contact) {
                    await this.database.saveContact({
                        phone,
                        name: phone,
                        tags: ['nuevo'],
                        instance_id: this.instanceId
                    });
                }
                
                // Emitir evento de nuevo mensaje específico por instancia
                this.io.emit(`new_message_${this.instanceId}`, {
                    instanceId: this.instanceId,
                    phone,
                    message: messageText,
                    timestamp: new Date(message.messageTimestamp * 1000)
                });
                
                // También emitir evento general
                this.io.emit('new_message', {
                    instanceId: this.instanceId,
                    phone,
                    message: messageText,
                    timestamp: new Date(message.messageTimestamp * 1000)
                });
                
                console.log(`📥 [${this.instanceId}] Mensaje recibido de ${phone}: ${messageText}`);
            }
        }
    }

    async syncContacts() {
        try {
            console.log(`🔄 [${this.instanceId}] Sincronizando contactos...`);
            // Implementar lógica de sincronización específica para esta instancia
        } catch (error) {
            console.error(`❌ [${this.instanceId}] Error sincronizando contactos:`, error);
        }
    }

    async sendMessage(phone, message, options = {}) {
        try {
            if (!this.connected) {
                throw new Error(`WhatsApp instancia ${this.instanceId} no está conectada`);
            }
            
            // Actualizar última actividad
            this.lastActivity = new Date();
            
            // Validar y formatear número de teléfono
            const phoneInfo = PhoneUtils.getPhoneInfo(phone);
            
            if (!phoneInfo.isValid) {
                throw new Error(`Número de teléfono inválido: ${phone}`);
            }
            
            // Usar número formateado con código de país
            const formattedPhone = phoneInfo.formatted;
            const jid = PhoneUtils.toWhatsAppJID(formattedPhone);
            
            console.log(`📞 [${this.instanceId}] Enviando mensaje:`, {
                original: phoneInfo.original,
                formatted: phoneInfo.formatted,
                jid: jid,
                hasCountryCode: phoneInfo.hasCountryCode
            });
            
            let sentMessage;
            
            if (options.media) {
                // Enviar mensaje con media
                sentMessage = await this.sock.sendMessage(jid, {
                    [options.media.type]: { url: options.media.url },
                    caption: message
                });
            } else {
                // Enviar mensaje de texto
                sentMessage = await this.sock.sendMessage(jid, { text: message });
            }
            
            // Guardar mensaje enviado en la base de datos con instance_id
            await this.database.saveMessage({
                id: sentMessage.key.id,
                phone: formattedPhone,
                message,
                type: 'sent',
                timestamp: new Date(),
                instance_id: this.instanceId
            });
            
            console.log(`✅ [${this.instanceId}] Mensaje enviado exitosamente a ${formattedPhone}: ${message}`);
            return {
                ...sentMessage,
                phoneInfo: phoneInfo,
                instanceId: this.instanceId
            };
            
        } catch (error) {
            console.error(`❌ [${this.instanceId}] Error enviando mensaje:`, error);
            throw error;
        }
    }

    async sendBulkMessages(contacts, message, options = {}) {
        if (!this.sock) {
            throw new Error(`WhatsApp instancia ${this.instanceId} no está conectada`);
        }

        // Configuración para comportamiento humano
        const humanBehavior = {
            minDelay: options.minDelay || 8000,
            maxDelay: options.maxDelay || 25000,
            maxPerSession: options.maxPerSession || 50,
            sessionBreak: options.sessionBreak || 300000,
            messageVariations: options.messageVariations || false,
            typingSimulation: options.typingSimulation !== false,
            ...options.humanBehavior
        };

        const results = [];
        const errors = [];
        let messagesSent = 0;
        let sessionCount = 1;

        console.log(`🤖 [${this.instanceId}] Iniciando envío masivo HUMANIZADO:`);
        console.log(`   📊 Total de contactos: ${contacts.length}`);
        console.log(`   ⏱️  Retraso: ${humanBehavior.minDelay/1000}s - ${humanBehavior.maxDelay/1000}s`);
        console.log(`   📱 Máximo por sesión: ${humanBehavior.maxPerSession}`);

        for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            
            try {
                // Verificar si necesitamos hacer una pausa de sesión
                if (messagesSent > 0 && messagesSent % humanBehavior.maxPerSession === 0) {
                    console.log(`🛑 [${this.instanceId}] Pausa de sesión ${sessionCount} completada (${messagesSent} mensajes enviados)`);
                    console.log(`😴 [${this.instanceId}] Descansando ${humanBehavior.sessionBreak/1000/60} minutos antes de continuar...`);
                    await this.delay(humanBehavior.sessionBreak);
                    sessionCount++;
                    console.log(`🚀 [${this.instanceId}] Iniciando sesión ${sessionCount}...`);
                }

                // Preparar el mensaje (con variaciones si está habilitado) - soporta mensaje por contacto
                let finalMessage;
                if (typeof contact.message === 'string' && contact.message.trim().length > 0) {
                    // Priorizar mensaje personalizado por contacto si viene
                    finalMessage = contact.message;
                } else {
                    // Fallback al mensaje global (puede ser undefined/null)
                    finalMessage = (typeof message === 'string') ? message : '';
                    if (humanBehavior.messageVariations && finalMessage) {
                        finalMessage = this.addMessageVariation(finalMessage, i);
                    }
                }

                // Simular comportamiento de escritura humana (solo si hay texto)
                if (humanBehavior.typingSimulation && typeof finalMessage === 'string' && finalMessage.trim().length > 0) {
                    await this.simulateTyping(contact.phone, finalMessage);
                }

                // Enviar el mensaje
                console.log(`📤 [${this.instanceId}] [${i + 1}/${contacts.length}] Enviando a ${contact.phone}...`);
                // Permitir override de media por contacto si viene definido (contact.media)
                const mediaOptions = (contact.media && typeof contact.media === 'object')
                    ? { ...options, media: contact.media }
                    : options;
                const result = await this.sendMessage(contact.phone, finalMessage, mediaOptions);
                
                results.push({
                    phone: contact.phone,
                    success: true,
                    messageId: result.key.id,
                    timestamp: new Date().toISOString(),
                    session: sessionCount,
                    instanceId: this.instanceId
                });

                messagesSent++;
                console.log(`✅ [${this.instanceId}] Mensaje enviado exitosamente a ${contact.phone}`);

                // Calcular y aplicar retraso aleatorio (excepto en el último mensaje)
                if (i < contacts.length - 1) {
                    const delay = this.calculateHumanDelay(
                        humanBehavior.minDelay, 
                        humanBehavior.maxDelay,
                        finalMessage.length
                    );
                    console.log(`⏳ [${this.instanceId}] Esperando ${delay/1000}s antes del próximo mensaje...`);
                    await this.delay(delay);
                }

            } catch (error) {
                console.error(`❌ [${this.instanceId}] Error enviando mensaje a ${contact.phone}:`, error.message);
                errors.push({
                    phone: contact.phone,
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    session: sessionCount,
                    instanceId: this.instanceId
                });

                // Pausa extra en caso de error para evitar rate limiting
                if (i < contacts.length - 1) {
                    const errorDelay = Math.random() * 10000 + 5000;
                    console.log(`⚠️  [${this.instanceId}] Pausa adicional de ${errorDelay/1000}s por error...`);
                    await this.delay(errorDelay);
                }
            }
        }

        const summary = {
            instanceId: this.instanceId,
            total: contacts.length,
            successful: results.length,
            failed: errors.length,
            sessions: sessionCount,
            totalTime: new Date().toISOString(),
            results,
            errors
        };

        console.log(`📊 [${this.instanceId}] RESUMEN DEL ENVÍO MASIVO:`);
        console.log(`   ✅ Exitosos: ${summary.successful}/${summary.total}`);
        console.log(`   ❌ Fallidos: ${summary.failed}/${summary.total}`);
        console.log(`   🎯 Tasa de éxito: ${((summary.successful/summary.total)*100).toFixed(1)}%`);

        return summary;
    }

    // Métodos auxiliares (copiados de WhatsAppService)
    calculateHumanDelay(minDelay, maxDelay, messageLength) {
        const baseDelay = Math.random() * (maxDelay - minDelay) + minDelay;
        const lengthFactor = Math.min(messageLength / 100, 1.5);
        const humanFactor = Math.random() * 0.4 + 0.8;
        return Math.floor(baseDelay * lengthFactor * humanFactor);
    }

    addMessageVariation(originalMessage, index) {
        const greetings = ['¡Hola!', 'Hola', '¡Saludos!', 'Buenos días', 'Buenas tardes', '¡Hey!', 'Hola, ¿qué tal?'];
        const endings = ['', '😊', '👋', '🙂', '✨', '💫', '🌟'];
        const connectors = ['', ' ', '\n', '\n\n'];
        
        if (Math.random() < 0.3) {
            const greeting = greetings[Math.floor(Math.random() * greetings.length)];
            const ending = endings[Math.floor(Math.random() * endings.length)];
            const connector = connectors[Math.floor(Math.random() * connectors.length)];
            
            if (originalMessage.toLowerCase().startsWith('hola') || 
                originalMessage.toLowerCase().startsWith('¡hola')) {
                return originalMessage.replace(/^¡?hola[^\w]*/i, greeting + ' ') + ending;
            } else {
                return greeting + connector + originalMessage + ending;
            }
        }
        
        return originalMessage;
    }

    async simulateTyping(phone, message) {
        try {
            const phoneInfo = PhoneUtils.getPhoneInfo(phone);
            if (!phoneInfo.isValid) {
                console.log(`⚠️  [${this.instanceId}] No se pudo simular escritura: número inválido`);
                return;
            }
            
            const jid = PhoneUtils.toWhatsAppJID(phoneInfo.formatted);
            
            const words = message.split(' ').length;
            const typingTime = Math.max(words * 200, 1000);
            const randomTypingTime = typingTime + (Math.random() * 2000);
            
            await this.sock.sendPresenceUpdate('composing', jid);
            console.log(`⌨️  [${this.instanceId}] Simulando escritura por ${(randomTypingTime/1000).toFixed(1)}s...`);
            
            await this.delay(randomTypingTime);
            
            await this.sock.sendPresenceUpdate('paused', jid);
            await this.delay(Math.random() * 1000 + 500);
            
        } catch (error) {
            console.log(`⚠️  [${this.instanceId}] No se pudo simular escritura:`, error.message);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getContacts() {
        try {
            if (!this.connected) {
                return [];
            }
            
            const chats = Object.values(this.sock.chats || {});
            return chats.filter(chat => chat.id.endsWith('@s.whatsapp.net'));
            
        } catch (error) {
            console.error(`❌ [${this.instanceId}] Error obteniendo contactos:`, error);
            return [];
        }
    }

    async clearAuthState() {
        try {
            console.log(`🗑️ [${this.instanceId}] Limpiando estado de autenticación...`);
            if (fs.existsSync(this.authDir)) {
                const files = fs.readdirSync(this.authDir);
                for (const file of files) {
                    const filePath = path.join(this.authDir, file);
                    try {
                        fs.unlinkSync(filePath);
                        console.log(`🗑️ [${this.instanceId}] Archivo eliminado: ${file}`);
                    } catch (err) {
                        console.error(`❌ [${this.instanceId}] Error eliminando ${file}:`, err);
                    }
                }
            }
            this.qrCode = null;
            this.connected = false;
        } catch (error) {
            console.error(`❌ [${this.instanceId}] Error limpiando estado de auth:`, error);
        }
    }

    async disconnect() {
        try {
            console.log(`🚫 [${this.instanceId}] Desconectando WhatsApp...`);
            this.connected = false;
            this.connecting = false;
            
            if (this.sock) {
                try {
                    // Verificar el estado de la conexión antes de hacer logout
                    if (this.sock.ws && this.sock.ws.readyState === this.sock.ws.OPEN) {
                        this.sock.ev.removeAllListeners();
                        await this.sock.logout();
                    } else {
                        console.log(`⚠️ [${this.instanceId}] WebSocket no está abierto, cerrando directamente`);
                        this.sock.ev.removeAllListeners();
                        if (this.sock.ws) {
                            this.sock.ws.terminate();
                        }
                    }
                } catch (error) {
                    console.error(`❌ [${this.instanceId}] Error durante logout:`, error.message);
                    // No re-throw el error para evitar crashes
                }
                this.sock = null;
            }
            
            this.qrCode = null;
            
            // Emitir eventos de desconexión
            this.io.emit(`connection_status_${this.instanceId}`, { connected: false });
            this.io.emit(`qr_code_${this.instanceId}`, null);
            this.io.emit('instance_update', {
                instanceId: this.instanceId,
                event: 'disconnected',
                data: { manual: true }
            });
            
            console.log(`✅ [${this.instanceId}] WhatsApp desconectado exitosamente`);
        } catch (error) {
            console.error(`❌ [${this.instanceId}] Error desconectando:`, error);
        }
    }

    async forceReconnect() {
        console.log(`🔁 [${this.instanceId}] Forzando reconexión...`);
        await this.disconnect();
        setTimeout(() => {
            this.connect();
        }, 2000);
    }

    async resetConnection() {
        console.log(`🔄 [${this.instanceId}] Reiniciando conexión completamente...`);
        await this.disconnect();
        await this.clearAuthState();
        setTimeout(() => {
            this.connect();
        }, 2000);
    }

    // Getters
    isConnected() {
        return this.connected;
    }

    isConnecting() {
        return this.connecting;
    }

    getQRCode() {
        return this.qrCode;
    }

    getConnectionInfo() {
        return {
            instanceId: this.instanceId,
            connected: this.connected,
            connecting: this.connecting,
            hasQR: !!this.qrCode,
            hasSocket: !!this.sock,
            lastActivity: this.lastActivity,
            config: this.config
        };
    }

    getInstanceId() {
        return this.instanceId;
    }

    getLastActivity() {
        return this.lastActivity;
    }

    // Método para verificar si la instancia está activa (para garbage collection)
    isActive() {
        const inactiveTime = Date.now() - this.lastActivity.getTime();
        const maxInactiveTime = 30 * 60 * 1000; // 30 minutos
        return inactiveTime < maxInactiveTime;
    }
}

module.exports = WhatsAppInstance;
