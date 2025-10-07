const { 
    default: makeWASocket, 
    DisconnectReason, 
    useMultiFileAuthState,
    downloadMediaMessage
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
const PhoneUtils = require('../utils/phoneUtils');

class WhatsAppService {
    constructor(io, database) {
        this.io = io;
        this.database = database;
        this.sock = null;
        this.qrCode = null;
        this.connected = false;
        this.connecting = false;
        this.authDir = path.join(__dirname, '../../auth_info');
        
        // Crear directorio de autenticación si no existe
        if (!fs.existsSync(this.authDir)) {
            fs.mkdirSync(this.authDir, { recursive: true });
        }
    }

    async connect() {
        if (this.connecting) {
            console.log('🔄 Ya hay una conexión en progreso...');
            return;
        }

        try {
            this.connecting = true;
            console.log('🔄 Iniciando conexión a WhatsApp...');
            
            // Limpiar socket anterior si existe
            if (this.sock) {
                try {
                    this.sock.ev.removeAllListeners();
                    this.sock.end();
                } catch (e) {
                    console.log('🗑️ Limpiando socket anterior...');
                }
                this.sock = null;
            }
            
            // Usar el nuevo sistema de autenticación multi-archivo
            const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
            
            console.log('📁 Estado de autenticación cargado:', {
                hasKeys: !!state.keys,
                hasCreds: !!state.creds
            });
            
            this.sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                browser: ['GuroMensajes', 'Chrome', '1.0.0'],
                generateHighQualityLinkPreview: true,
                markOnlineOnConnect: true
            });

            // Eventos de conexión
            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr, isNewLogin } = update;
                
                console.log('🔄 Estado de conexión:', { connection, isNewLogin });
                
                if (qr) {
                    console.log('🔑 QR Code generado');
                    try {
                        this.qrCode = await qrcode.toDataURL(qr);
                        this.io.emit('qr_code', this.qrCode);
                        console.log('📡 QR Code enviado via WebSocket');
                    } catch (qrError) {
                        console.error('❌ Error generando QR:', qrError);
                    }
                }
                
                if (connection === 'close') {
                    this.connecting = false;
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                    
                    console.log('❌ Conexión cerrada:', {
                        reason: lastDisconnect?.error?.message,
                        statusCode,
                        shouldReconnect
                    });
                    
                    this.connected = false;
                    this.qrCode = null;
                    this.io.emit('connection_status', { connected: false });
                    
                    // Manejar diferentes tipos de desconexión
                    switch (statusCode) {
                        case DisconnectReason.badSession:
                            console.log('🗑️ Sesión corrupta, eliminando archivos de auth...');
                            await this.clearAuthState();
                            setTimeout(() => this.connect(), 2000);
                            break;
                            
                        case DisconnectReason.connectionClosed:
                        case DisconnectReason.connectionLost:
                        case DisconnectReason.restartRequired:
                            console.log('🔁 Reconectando en 5 segundos...');
                            setTimeout(() => this.connect(), 5000);
                            break;
                            
                        case DisconnectReason.loggedOut:
                            console.log('🚪 Usuario deslogueado, limpiando sesión...');
                            await this.clearAuthState();
                            this.io.emit('qr_code', null);
                            // Intentar reconectar para generar nuevo QR
                            setTimeout(() => this.connect(), 2000);
                            break;
                            
                        default:
                            if (shouldReconnect) {
                                console.log('🔁 Reconectando en 10 segundos...');
                                setTimeout(() => this.connect(), 10000);
                            }
                    }
                } else if (connection === 'connecting') {
                    console.log('🔄 Conectando...');
                } else if (connection === 'open') {
                    this.connecting = false;
                    console.log('✅ Conectado a WhatsApp exitosamente');
                    this.connected = true;
                    this.qrCode = null;
                    
                    this.io.emit('connection_status', { connected: true });
                    this.io.emit('qr_code', null);
                    
                    // Sincronizar contactos
                    try {
                        await this.syncContacts();
                    } catch (syncError) {
                        console.error('❌ Error sincronizando contactos:', syncError);
                    }
                }
            });

            // Guardar credenciales cuando cambien
            this.sock.ev.on('creds.update', async (creds) => {
                try {
                    await saveCreds();
                    console.log('💾 Credenciales guardadas');
                } catch (error) {
                    console.error('❌ Error guardando credenciales:', error);
                }
            });
            
            // Manejar mensajes entrantes
            this.sock.ev.on('messages.upsert', async (m) => {
                try {
                    await this.handleIncomingMessages(m);
                } catch (msgError) {
                    console.error('❌ Error procesando mensajes:', msgError);
                }
            });
            
        } catch (error) {
            this.connecting = false;
            console.error('❌ Error conectando a WhatsApp:', error);
            
            // Reintentar conexión
            setTimeout(() => {
                console.log('🔁 Reintentando conexión...');
                this.connect();
            }, 15000);
        }
    }

    async handleIncomingMessages(messageUpdate) {
        const { messages } = messageUpdate;
        
        for (const message of messages) {
            if (!message.key.fromMe && message.message) {
                const phone = message.key.remoteJid.replace('@s.whatsapp.net', '');
                const messageText = message.message.conversation || 
                                 message.message.extendedTextMessage?.text || '';
                
                // Guardar mensaje en la base de datos
                await this.database.saveMessage({
                    id: message.key.id,
                    phone,
                    message: messageText,
                    type: 'received',
                    timestamp: new Date(message.messageTimestamp * 1000)
                });
                
                // Verificar si el contacto existe, si no, crearlo
                let contact = await this.database.getContact(phone);
                if (!contact) {
                    await this.database.saveContact({
                        phone,
                        name: phone, // Usar el teléfono como nombre por defecto
                        tags: ['nuevo']
                    });
                }
                
                // Emitir evento de nuevo mensaje
                this.io.emit('new_message', {
                    phone,
                    message: messageText,
                    timestamp: new Date(message.messageTimestamp * 1000)
                });
                
                console.log('📥 Mensaje recibido de', phone, ':', messageText);
                
                // Procesar mensaje para automatizaciones (si el servicio está disponible)
                if (this.automationService) {
                    await this.automationService.processIncomingMessage(phone, messageText);
                }
            }
        }
    }

    async syncContacts() {
        try {
            console.log('🔄 Sincronizando contactos...');
            // Aquí puedes implementar la lógica para sincronizar contactos
            // Por ejemplo, obtener la lista de chats y guardarlos en la base de datos
        } catch (error) {
            console.error('❌ Error sincronizando contactos:', error);
        }
    }

    async sendMessage(phone, message, options = {}) {
        try {
            if (!this.connected) {
                throw new Error('WhatsApp no está conectado');
            }
            
            // Validar y formatear número de teléfono
            const phoneInfo = PhoneUtils.getPhoneInfo(phone);
            
            if (!phoneInfo.isValid) {
                throw new Error(`Número de teléfono inválido: ${phone}`);
            }
            
            // Usar número formateado con código de país
            const formattedPhone = phoneInfo.formatted;
            const jid = PhoneUtils.toWhatsAppJID(formattedPhone);
            
            console.log('📞 Enviando mensaje:', {
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
            
            // Guardar mensaje enviado en la base de datos usando el número formateado
            await this.database.saveMessage({
                id: sentMessage.key.id,
                phone: formattedPhone,
                message,
                type: 'sent',
                timestamp: new Date()
            });
            
            console.log('✅ Mensaje enviado exitosamente a', formattedPhone, ':', message);
            return {
                ...sentMessage,
                phoneInfo: phoneInfo
            };
            
        } catch (error) {
            console.error('❌ Error enviando mensaje:', error);
            throw error;
        }
    }

    // Método para envío masivo de mensajes con comportamiento humano
    async sendBulkMessages(contacts, message, options = {}) {
        if (!this.sock) {
            throw new Error('WhatsApp no está conectado');
        }

        // Configuración para comportamiento humano
        const humanBehavior = {
            minDelay: options.minDelay || 8000,      // Mínimo 8 segundos
            maxDelay: options.maxDelay || 25000,     // Máximo 25 segundos
            maxPerSession: options.maxPerSession || 50, // Máximo 50 mensajes por sesión
            sessionBreak: options.sessionBreak || 300000, // Pausa de 5 min entre sesiones
            messageVariations: options.messageVariations || false,
            typingSimulation: options.typingSimulation !== false, // Por defecto activado
            ...options.humanBehavior
        };

        const results = [];
        const errors = [];
        let messagesSent = 0;
        let sessionCount = 1;

        console.log(`🤖 Iniciando envío masivo HUMANIZADO:`);
        console.log(`   📊 Total de contactos: ${contacts.length}`);
        console.log(`   ⏱️  Retraso: ${humanBehavior.minDelay/1000}s - ${humanBehavior.maxDelay/1000}s`);
        console.log(`   📱 Máximo por sesión: ${humanBehavior.maxPerSession}`);
        console.log(`   🎭 Variaciones de mensaje: ${humanBehavior.messageVariations ? 'Sí' : 'No'}`);
        console.log(`   ⌨️  Simulación de escritura: ${humanBehavior.typingSimulation ? 'Sí' : 'No'}`);
        console.log('');

        for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            
            try {
                // Verificar si necesitamos hacer una pausa de sesión
                if (messagesSent > 0 && messagesSent % humanBehavior.maxPerSession === 0) {
                    console.log(`🛑 Pausa de sesión ${sessionCount} completada (${messagesSent} mensajes enviados)`);
                    console.log(`😴 Descansando ${humanBehavior.sessionBreak/1000/60} minutos antes de continuar...`);
                    await this.delay(humanBehavior.sessionBreak);
                    sessionCount++;
                    console.log(`🚀 Iniciando sesión ${sessionCount}...`);
                }

                // Preparar el mensaje (con variaciones si está habilitado)
                let finalMessage = message;
                if (humanBehavior.messageVariations) {
                    finalMessage = this.addMessageVariation(message, i);
                }

                // Simular comportamiento de escritura humana
                if (humanBehavior.typingSimulation) {
                    await this.simulateTyping(contact.phone, finalMessage);
                }

                // Enviar el mensaje
                console.log(`📤 [${i + 1}/${contacts.length}] Enviando a ${contact.phone}...`);
                const result = await this.sendMessage(contact.phone, finalMessage, options);
                
                results.push({
                    phone: contact.phone,
                    success: true,
                    messageId: result.key.id,
                    timestamp: new Date().toISOString(),
                    session: sessionCount
                });

                messagesSent++;
                console.log(`✅ Mensaje enviado exitosamente a ${contact.phone}`);

                // Calcular y aplicar retraso aleatorio (excepto en el último mensaje)
                if (i < contacts.length - 1) {
                    const delay = this.calculateHumanDelay(
                        humanBehavior.minDelay, 
                        humanBehavior.maxDelay,
                        finalMessage.length
                    );
                    console.log(`⏳ Esperando ${delay/1000}s antes del próximo mensaje...`);
                    await this.delay(delay);
                }

            } catch (error) {
                console.error(`❌ Error enviando mensaje a ${contact.phone}:`, error.message);
                errors.push({
                    phone: contact.phone,
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    session: sessionCount
                });

                // Pausa extra en caso de error para evitar rate limiting
                if (i < contacts.length - 1) {
                    const errorDelay = Math.random() * 10000 + 5000; // 5-15 segundos
                    console.log(`⚠️  Pausa adicional de ${errorDelay/1000}s por error...`);
                    await this.delay(errorDelay);
                }
            }
        }

        const summary = {
            total: contacts.length,
            successful: results.length,
            failed: errors.length,
            sessions: sessionCount,
            totalTime: new Date().toISOString(),
            results,
            errors
        };

        console.log('');
        console.log('📊 RESUMEN DEL ENVÍO MASIVO:');
        console.log(`   ✅ Exitosos: ${summary.successful}/${summary.total}`);
        console.log(`   ❌ Fallidos: ${summary.failed}/${summary.total}`);
        console.log(`   🎯 Tasa de éxito: ${((summary.successful/summary.total)*100).toFixed(1)}%`);
        console.log(`   📱 Sesiones utilizadas: ${summary.sessions}`);
        console.log('');

        return summary;
    }

    // Calcular retraso humano basado en longitud del mensaje y factores aleatorios
    calculateHumanDelay(minDelay, maxDelay, messageLength) {
        // Retraso base aleatorio
        const baseDelay = Math.random() * (maxDelay - minDelay) + minDelay;
        
        // Factor de longitud del mensaje (mensajes más largos = más tiempo de "escritura")
        const lengthFactor = Math.min(messageLength / 100, 1.5); // Max 1.5x por longitud
        
        // Factor de variabilidad humana (simulando diferentes velocidades de escritura)
        const humanFactor = Math.random() * 0.4 + 0.8; // Entre 0.8x y 1.2x
        
        return Math.floor(baseDelay * lengthFactor * humanFactor);
    }

    // Agregar variaciones al mensaje para parecer más humano
    addMessageVariation(originalMessage, index) {
        const greetings = ['¡Hola!', 'Hola', '¡Saludos!', 'Buenos días', 'Buenas tardes', '¡Hey!', 'Hola, ¿qué tal?'];
        const endings = ['', '😊', '👋', '🙂', '✨', '💫', '🌟'];
        const connectors = ['', ' ', '\n', '\n\n'];
        
        // Usar variaciones solo ocasionalmente para no ser muy obvio
        if (Math.random() < 0.3) { // 30% de probabilidad
            const greeting = greetings[Math.floor(Math.random() * greetings.length)];
            const ending = endings[Math.floor(Math.random() * endings.length)];
            const connector = connectors[Math.floor(Math.random() * connectors.length)];
            
            // Si el mensaje original ya tiene saludo, reemplazarlo
            if (originalMessage.toLowerCase().startsWith('hola') || 
                originalMessage.toLowerCase().startsWith('¡hola')) {
                return originalMessage.replace(/^¡?hola[^\w]*/i, greeting + ' ') + ending;
            } else {
                return greeting + connector + originalMessage + ending;
            }
        }
        
        return originalMessage;
    }

    // Simular que alguien está escribiendo (presencia de escritura)
    async simulateTyping(phone, message) {
        try {
            // Validar y formatear número de teléfono
            const phoneInfo = PhoneUtils.getPhoneInfo(phone);
            if (!phoneInfo.isValid) {
                console.log('⚠️  No se pudo simular escritura: número inválido');
                return;
            }
            
            const jid = PhoneUtils.toWhatsAppJID(phoneInfo.formatted);
            
            // Calcular tiempo de escritura basado en longitud del mensaje
            // Simulamos velocidad de escritura humana: ~60 palabras por minuto
            const words = message.split(' ').length;
            const typingTime = Math.max(words * 200, 1000); // Mínimo 1 segundo
            const randomTypingTime = typingTime + (Math.random() * 2000); // +0-2 segundos aleatorios
            
            // Enviar indicador de "escribiendo"
            await this.sock.sendPresenceUpdate('composing', jid);
            console.log(`⌨️  Simulando escritura por ${(randomTypingTime/1000).toFixed(1)}s...`);
            
            // Esperar tiempo de escritura simulado
            await this.delay(randomTypingTime);
            
            // Detener indicador de escritura
            await this.sock.sendPresenceUpdate('paused', jid);
            
            // Pequeña pausa adicional antes de enviar
            await this.delay(Math.random() * 1000 + 500);
            
        } catch (error) {
            console.log('⚠️  No se pudo simular escritura:', error.message);
        }
    }

    // Método de utilidad para pausas
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getContacts() {
        try {
            if (!this.connected) {
                return [];
            }
            
            // Obtener lista de chats
            const chats = Object.values(this.sock.chats || {});
            return chats.filter(chat => chat.id.endsWith('@s.whatsapp.net'));
            
        } catch (error) {
            console.error('❌ Error obteniendo contactos:', error);
            return [];
        }
    }

    async clearAuthState() {
        try {
            console.log('🗑️ Limpiando estado de autenticación...');
            if (fs.existsSync(this.authDir)) {
                const files = fs.readdirSync(this.authDir);
                for (const file of files) {
                    const filePath = path.join(this.authDir, file);
                    try {
                        fs.unlinkSync(filePath);
                        console.log(`🗑️ Archivo eliminado: ${file}`);
                    } catch (err) {
                        console.error(`❌ Error eliminando ${file}:`, err);
                    }
                }
            }
            this.qrCode = null;
            this.connected = false;
        } catch (error) {
            console.error('❌ Error limpiando estado de auth:', error);
        }
    }

    async disconnect() {
        try {
            console.log('🚫 Desconectando WhatsApp...');
            this.connected = false;
            this.connecting = false;
            
            if (this.sock) {
                try {
                    this.sock.ev.removeAllListeners();
                    await this.sock.logout();
                } catch (error) {
                    console.error('❌ Error durante logout:', error);
                }
                this.sock = null;
            }
            
            this.qrCode = null;
            this.io.emit('connection_status', { connected: false });
            this.io.emit('qr_code', null);
            
            console.log('✅ WhatsApp desconectado exitosamente');
        } catch (error) {
            console.error('❌ Error desconectando:', error);
        }
    }

    async forceReconnect() {
        console.log('🔁 Forzando reconexión...');
        await this.disconnect();
        setTimeout(() => {
            this.connect();
        }, 2000);
    }

    async resetConnection() {
        console.log('🔄 Reiniciando conexión completamente...');
        await this.disconnect();
        await this.clearAuthState();
        setTimeout(() => {
            this.connect();
        }, 2000);
    }

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
            connected: this.connected,
            connecting: this.connecting,
            hasQR: !!this.qrCode,
            hasSocket: !!this.sock
        };
    }
}

module.exports = WhatsAppService;

