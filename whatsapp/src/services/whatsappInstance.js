/**
 * WhatsApp Instance
 * =================
 * Usa el BaileysAdapter para abstraer la librería Baileys.
 * Para actualizar Baileys, solo modifica /adapters/baileysAdapter.js
 */
const BaileysAdapter = require('../adapters/baileysAdapter');
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
            
            // Usar el adapter para autenticación
            const { state, saveCreds } = await BaileysAdapter.getAuthState(this.authDir);
            
            console.log(`📁 [${this.instanceId}] Estado de autenticación cargado:`, {
                hasKeys: !!state.keys,
                hasCreds: !!state.creds
            });
            
            // Obtener versión de WhatsApp Web via adapter
            const { version, isLatest } = await BaileysAdapter.getLatestVersion();
            console.log(`🧩 [${this.instanceId}] Usando WhatsApp Web v${version?.join?.('.')}, latest=${isLatest}`);

            // Crear socket usando el adapter
            this.sock = BaileysAdapter.createSocket({
                auth: state,
                version,
                browser: this.config.browser,
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
            
            console.log(`❌ [${this.instanceId}] Conexión cerrada:`, {
                reason: lastDisconnect?.error?.message,
                statusCode,
                shouldAutoReconnect: BaileysAdapter.shouldAutoReconnect(statusCode)
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
            
            // Manejar diferentes tipos de desconexión usando el adapter
            if (BaileysAdapter.isBadSession(statusCode)) {
                console.log(`🗑️ [${this.instanceId}] Sesión corrupta, eliminando archivos de auth...`);
                await this.clearAuthState();
                this.notifyLaravelStatusChange('disconnected');
                this.io.emit(`qr_code_${this.instanceId}`, null);
                console.log(`⏹️ [${this.instanceId}] Instancia marcada como desconectada. El usuario debe escanear QR nuevamente.`);
            } else if (BaileysAdapter.isUserLogout(statusCode)) {
                console.log(`🚪 [${this.instanceId}] Usuario deslogueado desde WhatsApp, limpiando sesión...`);
                await this.clearAuthState();
                this.notifyLaravelStatusChange('disconnected');
                this.io.emit(`qr_code_${this.instanceId}`, null);
                console.log(`⏹️ [${this.instanceId}] Instancia marcada como desconectada. El usuario debe escanear QR nuevamente.`);
            } else if (BaileysAdapter.shouldAutoReconnect(statusCode)) {
                // Error técnico que requiere reconexión automática (515, connectionLost, etc.)
                console.log(`⚠️ [${this.instanceId}] Error técnico ${statusCode} - Reconectando automáticamente en 2 segundos...`);
                setTimeout(() => this.connect(), 2000);
            } else {
                // Otros errores - marcar como desconectado
                console.log(`❌ [${this.instanceId}] Error desconocido (${statusCode}) - Marcando como desconectado`);
                this.notifyLaravelStatusChange('disconnected');
                this.io.emit(`qr_code_${this.instanceId}`, null);
            }
        } else if (connection === 'connecting') {
            console.log(`🔄 [${this.instanceId}] Conectando...`);
        } else if (connection === 'open') {
            this.connecting = false;
            console.log(`✅ [${this.instanceId}] Conectado a WhatsApp exitosamente`);
            this.connected = true;
            this.qrCode = null;
            this.lastActivity = new Date();
            
            // Emitir eventos de conexión exitosa via WebSocket
            this.io.emit(`connection_status_${this.instanceId}`, { connected: true });
            this.io.emit(`qr_code_${this.instanceId}`, null);
            this.io.emit('instance_update', {
                instanceId: this.instanceId,
                event: 'connected',
                data: { timestamp: this.lastActivity }
            });
            
            // ========== SINCRONIZACIÓN AUTOMÁTICA CON LARAVEL ==========
            // Notificar a Laravel que la instancia se conectó para actualizar el estado en BD
            this.notifyLaravelStatusChange('connected');
            
            // Sincronizar contactos
            try {
                await this.syncContacts();
            } catch (syncError) {
                console.error(`❌ [${this.instanceId}] Error sincronizando contactos:`, syncError);
            }
        }
    }

    async handleIncomingMessages(messageUpdate) {
        const { messages, type } = messageUpdate;
        
        for (const message of messages) {
            // Ignorar mensajes de status/broadcast
            if (message.key.remoteJid === 'status@broadcast') continue;
            if (!message.message) continue;
            
            const isFromMe = message.key.fromMe;
            const phone = message.key.remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
            const messageText = message.message.conversation || 
                             message.message.extendedTextMessage?.text || 
                             message.message.imageMessage?.caption ||
                             message.message.videoMessage?.caption ||
                             message.message.documentMessage?.caption ||
                             '';
            
            // Detectar tipo de mensaje
            let messageType = 'text';
            let mediaData = null;
            
            if (message.message.imageMessage) {
                messageType = 'image';
                mediaData = { mimetype: message.message.imageMessage.mimetype };
            } else if (message.message.videoMessage) {
                messageType = 'video';
                mediaData = { mimetype: message.message.videoMessage.mimetype };
            } else if (message.message.audioMessage) {
                messageType = 'audio';
                mediaData = { mimetype: message.message.audioMessage.mimetype, ptt: message.message.audioMessage.ptt };
            } else if (message.message.documentMessage) {
                messageType = 'document';
                mediaData = { 
                    mimetype: message.message.documentMessage.mimetype,
                    filename: message.message.documentMessage.fileName 
                };
            } else if (message.message.stickerMessage) {
                messageType = 'sticker';
            } else if (message.message.locationMessage) {
                messageType = 'location';
                mediaData = {
                    latitude: message.message.locationMessage.degreesLatitude,
                    longitude: message.message.locationMessage.degreesLongitude
                };
            } else if (message.message.contactMessage) {
                messageType = 'contact';
            }
            
            // Actualizar última actividad
            this.lastActivity = new Date();
            
            // Guardar mensaje en la base de datos local (ignorar errores de duplicados)
            try {
                await this.database.saveMessage({
                    id: message.key.id,
                    phone,
                    message: messageText,
                    type: isFromMe ? 'sent' : 'received',
                    messageType: messageType,
                    media: mediaData,
                    timestamp: new Date(message.messageTimestamp * 1000),
                    instance_id: this.instanceId
                });
            } catch (dbError) {
                // Ignorar errores de duplicados - el mensaje ya existe
                if (!dbError.message?.includes('UNIQUE constraint')) {
                    console.error(`⚠️ [${this.instanceId}] Error guardando mensaje local:`, dbError.message);
                }
            }
            
            // Solo para mensajes entrantes: verificar/crear contacto
            if (!isFromMe) {
                try {
                    let contact = await this.database.getContact(phone, this.instanceId);
                    if (!contact) {
                        await this.database.saveContact({
                            phone,
                            name: message.pushName || phone,
                            tags: ['nuevo'],
                            instance_id: this.instanceId
                        });
                    }
                } catch (contactError) {
                    // Ignorar errores de contacto
                }
            }
            
            // Emitir evento de nuevo mensaje específico por instancia
            this.io.emit(`new_message_${this.instanceId}`, {
                instanceId: this.instanceId,
                phone,
                message: messageText,
                messageType: messageType,
                media: mediaData,
                fromMe: isFromMe,
                timestamp: new Date(message.messageTimestamp * 1000)
            });
            
            // También emitir evento general
            this.io.emit('new_message', {
                instanceId: this.instanceId,
                phone,
                message: messageText,
                messageType: messageType,
                media: mediaData,
                fromMe: isFromMe,
                timestamp: new Date(message.messageTimestamp * 1000)
            });
            
            // Emitir evento inbox_message para el frontend del Inbox
            // Nota: Este evento no tiene conversationId, el frontend buscará por teléfono
            this.io.emit('inbox_message', {
                instanceId: this.instanceId,
                phone,
                message: {
                    message_id: message.key.id,
                    direction: isFromMe ? 'outgoing' : 'incoming',
                    sender_type: isFromMe ? 'agent' : 'client',
                    message_type: messageType,
                    content: messageText,
                    media: mediaData,
                    created_at: new Date(message.messageTimestamp * 1000).toISOString()
                }
            });
            
            const direction = isFromMe ? '📤 enviado a' : '📥 recibido de';
            console.log(`${direction} [${this.instanceId}] ${phone}: ${messageText.substring(0, 50)}${messageText.length > 50 ? '...' : ''}`);
            
            if (isFromMe) {
                // Mensajes SALIENTES (enviados desde móvil) - sincronizar con Laravel
                this.syncMessageToLaravel(message, phone, messageText, messageType, mediaData, true);
            } else {
                // Mensajes ENTRANTES - procesar con chatbot
                this.sendMessageWebhook(message, phone, messageText, messageType, mediaData);
            }
        }
    }

    /**
     * Sincronizar mensaje enviado desde el móvil con Laravel
     */
    async syncMessageToLaravel(message, phone, messageText, messageType, mediaData, fromMe) {
        try {
            const laravelUrl = process.env.LARAVEL_API_URL || 'http://127.0.0.1:8001/api';
            const webhookUrl = `${laravelUrl}/webhooks/whatsapp-sync-message`;
            
            const payload = {
                instance_id: this.instanceId,
                phone: phone,
                message: messageText,
                message_id: message.key.id,
                type: messageType,
                media: mediaData,
                from_me: fromMe,
                timestamp: new Date(message.messageTimestamp * 1000).toISOString()
            };
            
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Secret': process.env.WEBHOOK_SECRET || 'guro-whatsapp-webhook-secret'
                },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.synced) {
                    console.log(`📡 [${this.instanceId}] Mensaje sincronizado con Laravel para ${phone}`);
                }
            }
        } catch (error) {
            console.error(`⚠️ [${this.instanceId}] Error sincronizando mensaje:`, error.message);
        }
    }

    /**
     * Enviar webhook a Laravel cuando llega un mensaje
     */
    async sendMessageWebhook(message, phone, messageText, messageType = 'text', mediaData = null) {
        try {
            const laravelUrl = process.env.LARAVEL_API_URL || 'http://127.0.0.1:8001/api';
            const webhookUrl = `${laravelUrl}/webhooks/whatsapp-message`;
            
            console.log(`🔄 [${this.instanceId}] Enviando webhook a: ${webhookUrl}`);
            
            const payload = {
                instance_id: this.instanceId,
                phone: phone,
                message: messageText,
                message_id: message.key.id,
                type: messageType,
                media: mediaData,
                push_name: message.pushName || null,
                timestamp: new Date(message.messageTimestamp * 1000).toISOString()
            };
            
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Secret': process.env.WEBHOOK_SECRET || 'guro-whatsapp-webhook-secret'
                },
                body: JSON.stringify(payload)
            });
            
            const responseText = await response.text();
            console.log(`📡 [${this.instanceId}] Webhook response (${response.status}): ${responseText.substring(0, 200)}`);
            
            if (response.ok) {
                console.log(`✅ [${this.instanceId}] Webhook enviado exitosamente a Laravel para ${phone}`);
            } else {
                console.error(`❌ [${this.instanceId}] Webhook falló (${response.status}): ${responseText}`);
            }
        } catch (error) {
            console.error(`⚠️ [${this.instanceId}] Error enviando webhook:`, error.message);
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

    // ========== SINCRONIZACIÓN CON LARAVEL ==========
    /**
     * Notifica a Laravel sobre cambios de estado de la instancia
     * Esto permite que Laravel mantenga su BD sincronizada con el estado real
     */
    async notifyLaravelStatusChange(newStatus) {
        try {
            const laravelUrl = process.env.LARAVEL_API_URL || 'http://127.0.0.1:8001/api';
            const webhookUrl = `${laravelUrl}/webhooks/whatsapp-status`;
            
            console.log(`📡 [${this.instanceId}] Notificando a Laravel cambio de estado: ${newStatus}`);
            
            const payload = {
                instance_id: this.instanceId,
                status: newStatus,
                connected: this.connected,
                timestamp: new Date().toISOString(),
                phone_number: this.phoneNumber || null,
                last_activity: this.lastActivity?.toISOString()
            };
            
            // Usar fetch nativo de Node.js 18+ o axios si está disponible
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Secret': process.env.WEBHOOK_SECRET || 'guro-whatsapp-webhook-secret'
                },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                console.log(`✅ [${this.instanceId}] Laravel notificado exitosamente del cambio a: ${newStatus}`);
            } else {
                console.warn(`⚠️ [${this.instanceId}] Laravel respondió con error:`, response.status);
            }
        } catch (error) {
            // No fallar si Laravel no está disponible - solo loguear
            console.warn(`⚠️ [${this.instanceId}] No se pudo notificar a Laravel (puede no estar disponible):`, error.message);
        }
    }
}

module.exports = WhatsAppInstance;
