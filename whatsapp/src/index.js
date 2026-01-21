require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const WhatsAppInstanceManager = require('./services/whatsappInstanceManager');
const DatabaseService = require('./services/databaseService');
const AutomationService = require('./services/automationService');

// Importar rutas
const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contacts');
const messageRoutes = require('./routes/messages');
const automationRoutes = require('./routes/automations');
const whatsappRoutes = require('./routes/whatsapp');

class GuromensajesServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        this.port = process.env.PORT || 3000;
        
        this.initializeServices();
        this.initializeMiddleware();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }

    async initializeServices() {
        try {
            // Inicializar base de datos
            this.database = new DatabaseService();
            await this.database.initialize();
            console.log('✅ Base de datos inicializada');

            // Inicializar administrador de instancias de WhatsApp
            this.whatsappManager = new WhatsAppInstanceManager(this.io, this.database);
            
            // Inicializar servicio de automatizaciones
            this.automationService = new AutomationService(this.whatsappManager, this.database);
            await this.automationService.initialize();
            console.log('✅ Servicio de automatizaciones inicializado');

            // Compartir servicios globalmente para las rutas
            this.app.locals.whatsappManager = this.whatsappManager;
            this.app.locals.whatsappService = this.whatsappManager; // Alias para compatibilidad con rutas de mensajes
            this.app.locals.database = this.database;
            this.app.locals.automationService = this.automationService;
            this.app.locals.io = this.io;

        } catch (error) {
            console.error('❌ Error inicializando servicios:', error);
            process.exit(1);
        }
    }

    initializeMiddleware() {
        // Seguridad
        this.app.use(helmet());
        
        // CORS
        this.app.use(cors());
        
        // Logging
        if (process.env.NODE_ENV !== 'test') {
            this.app.use(morgan('combined'));
        }
        
        // Body parsing
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
        
        // Bloquear acceso público al dashboard - solo permitir API y health
        this.app.use((req, res, next) => {
            const allowedPaths = ['/api/', '/health', '/socket.io'];
            const isAllowed = allowedPaths.some(path => req.path.startsWith(path));
            
            if (!isAllowed && req.path === '/') {
                return res.status(403).json({
                    success: false,
                    message: 'Acceso no autorizado',
                    hint: 'Este servicio es solo para uso interno via API'
                });
            }
            
            // Bloquear archivos estáticos del dashboard
            if (!isAllowed && (req.path.endsWith('.html') || req.path.endsWith('.js') || req.path.endsWith('.css'))) {
                return res.status(403).json({
                    success: false,
                    message: 'Acceso no autorizado'
                });
            }
            
            next();
        });
        
        // Archivos estáticos - deshabilitados para producción
        // this.app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
        // this.app.use(express.static(path.join(__dirname, '../public')));
    }

    initializeRoutes() {
        const apiPrefix = process.env.API_PREFIX || '/api/v1';
        
        // Rutas de la API
        this.app.use(`${apiPrefix}/auth`, authRoutes);
        this.app.use(`${apiPrefix}/contacts`, contactRoutes);
        this.app.use(`${apiPrefix}/messages`, messageRoutes);
        this.app.use(`${apiPrefix}/automations`, automationRoutes);
        this.app.use(`${apiPrefix}/whatsapp`, whatsappRoutes);
        
        // ========== RUTAS ESPECÍFICAS PARA MULTI-INSTANCIA ==========
        // Estas rutas están directamente en /api/v1/ para coincidir con lo que espera Laravel
        
        // Listar todas las instancias
        this.app.get(`${apiPrefix}/instances`, (req, res) => {
            try {
                const instances = this.whatsappManager.getAllInstances();
                const instancesData = instances.map(instance => ({
                    instanceId: instance.instanceId,
                    connected: instance.connected,
                    connecting: instance.connecting,
                    hasQR: !!instance.qrCode,
                    lastActivity: instance.lastActivity || new Date().toISOString(),
                    status: instance.connected ? 'connected' : (instance.connecting ? 'connecting' : 'disconnected')
                }));
                
                res.json({
                    success: true,
                    instances: instancesData,
                    count: instancesData.length
                });
            } catch (error) {
                console.error('❌ Error listando instancias:', error);
                res.status(500).json({ 
                    success: false, 
                    message: 'Error listando instancias',
                    error: error.message 
                });
            }
        });

        // Crear nueva instancia
        this.app.post(`${apiPrefix}/instances`, async (req, res) => {
            try {
                const { instanceId, webhook, settings } = req.body;
                
                if (!instanceId) {
                    return res.status(400).json({ success: false, message: 'instanceId es requerido' });
                }
                
                console.log(`🆕 Nueva instancia solicitada: ${instanceId}`);
                
                // Crear nueva instancia real
                const instance = await this.whatsappManager.createInstance(instanceId, {
                    webhook,
                    ...settings
                });
                
                res.json({
                    success: true,
                    message: 'Instancia creada exitosamente',
                    instanceId,
                    status: 'connecting'
                });
            } catch (error) {
                console.error(`❌ Error creando instancia ${req.body.instanceId}:`, error);
                res.status(500).json({ 
                    success: false, 
                    message: error.message,
                    error: 'Failed to create instance'
                });
            }
        });
        
        // Obtener QR de instancia específica
        this.app.get(`${apiPrefix}/instances/:instanceId/qr`, async (req, res) => {
            try {
                const { instanceId } = req.params;
                console.log(`🔲 QR solicitado para instancia: ${instanceId}`);

                const instance = this.whatsappManager.getInstance(instanceId);

                if (!instance) {
                    console.log(`❌ Instancia ${instanceId} no encontrada`);
                    return res.status(404).json({
                        success: false,
                        message: 'Instancia no encontrada'
                    });
                }

                console.log(`📊 Estado de instancia ${instanceId}:`, {
                    connected: instance.isConnected(),
                    connecting: instance.isConnecting(),
                    hasQR: !!instance.getQRCode()
                });

                // Si ya está conectada, no necesita QR
                if (instance.isConnected()) {
                    console.log(`✅ Instancia ${instanceId} ya está conectada`);
                    return res.json({
                        success: false,
                        message: 'Instancia ya está conectada'
                    });
                }

                // Si no está conectando, iniciar la conexión
                if (!instance.isConnecting()) {
                    console.log(`🔌 [${instanceId}] Iniciando conexión para generar QR...`);
                    try {
                        await instance.connect();
                        console.log(`✅ [${instanceId}] Conexión iniciada exitosamente`);
                    } catch (err) {
                        console.error(`❌ [${instanceId}] Error iniciando conexión:`, err);
                        return res.status(500).json({
                            success: false,
                            message: 'Error iniciando conexión para QR',
                            error: err.message
                        });
                    }
                } else {
                    console.log(`⏳ [${instanceId}] Ya hay una conexión en progreso`);
                }

                // Intentar obtener el QR inmediatamente
                let qrCode = instance.getQRCode();
                console.log(`🔍 QR inmediato disponible: ${!!qrCode}`);

                // Si no hay QR, esperar hasta 15 segundos para que se genere
                if (!qrCode) {
                    console.log(`⏳ QR no disponible inmediatamente, esperando generación...`);
                    const maxAttempts = 30; // 30 intentos x 500ms = 15 segundos
                    let attempts = 0;

                    while (!qrCode && attempts < maxAttempts && !instance.isConnected()) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                        qrCode = instance.getQRCode();
                        attempts++;

                        if (attempts % 5 === 0) { // Log cada 2.5 segundos
                            console.log(`⏳ [${instanceId}] Esperando QR... intento ${attempts}/${maxAttempts}, conectado: ${instance.isConnected()}`);
                        }
                    }

                    if (qrCode) {
                        console.log(`✅ QR generado después de ${attempts * 500}ms`);
                    }
                }

                if (qrCode) {
                    console.log(`🎉 QR encontrado, enviando respuesta exitosa`);
                    res.json({
                        success: true,
                        qr: qrCode,
                        instanceId,
                        expires_at: new Date(Date.now() + 45000).toISOString()
                    });
                } else if (instance.isConnected()) {
                    // Se conectó mientras esperábamos
                    console.log(`🔄 Instancia se conectó automáticamente mientras esperábamos QR`);
                    res.json({
                        success: false,
                        message: 'Instancia se conectó automáticamente'
                    });
                } else {
                    console.log(`⚠️ QR no se generó después de esperar - Estado final:`, {
                        connected: instance.isConnected(),
                        connecting: instance.isConnecting(),
                        hasQR: !!instance.getQRCode()
                    });
                    res.json({
                        success: false,
                        message: 'QR no disponible. La instancia puede estar iniciándose. Intenta de nuevo en unos segundos.',
                        debug: {
                            connected: instance.isConnected(),
                            connecting: instance.isConnecting(),
                            hasQR: !!instance.getQRCode()
                        }
                    });
                }
            } catch (error) {
                console.error(`❌ Error obteniendo QR para ${req.params.instanceId}:`, error);
                console.error(`❌ Detalles del error:`, {
                    message: error.message,
                    stack: error.stack
                });
                res.status(500).json({
                    success: false,
                    message: 'Error al obtener QR',
                    error: error.message
                });
            }
        });
        
        // Obtener status de instancia específica
        this.app.get(`${apiPrefix}/instances/:instanceId/status`, (req, res) => {
            try {
                const { instanceId } = req.params;
                console.log(`📊 Status solicitado para instancia: ${instanceId}`);
                
                const instance = this.whatsappManager.getInstance(instanceId);
                
                if (!instance) {
                    return res.status(404).json({
                        success: false,
                        message: 'Instancia no encontrada'
                    });
                }
                
                const connectionInfo = instance.getConnectionInfo();
                
                // Obtener información adicional de la sesión si está conectada
                let phoneNumber = null;
                let sessionId = null;
                
                if (connectionInfo.connected && instance.sock?.user) {
                    const user = instance.sock.user;
                    phoneNumber = user.id?.split(':')[0] || user.id?.split('@')[0] || null;
                    sessionId = instanceId; // Usar instanceId como sessionId
                }
                
                res.json({
                    success: true,
                    instanceId,
                    sessionId: sessionId,
                    status: connectionInfo.connected ? 'connected' : (connectionInfo.connecting ? 'connecting' : 'disconnected'),
                    connected: connectionInfo.connected,
                    connecting: connectionInfo.connecting,
                    hasQR: connectionInfo.hasQR,
                    phoneNumber: phoneNumber,
                    lastActivity: connectionInfo.lastActivity,
                    lastUpdate: new Date().toISOString()
                });
            } catch (error) {
                console.error(`❌ Error obteniendo status para ${req.params.instanceId}:`, error);
                res.status(500).json({ 
                    success: false, 
                    message: 'Error al obtener status', 
                    error: error.message 
                });
            }
        });
        
        // Reiniciar instancia específica
        this.app.post(`${apiPrefix}/instances/:instanceId/restart`, async (req, res) => {
            try {
                const { instanceId } = req.params;
                console.log(`🔄 Reinicio solicitado para instancia: ${instanceId}`);
                
                const instance = this.whatsappManager.getInstance(instanceId);
                
                if (!instance) {
                    return res.status(404).json({
                        success: false,
                        message: 'Instancia no encontrada'
                    });
                }
                
                await instance.forceReconnect();
                
                res.json({
                    success: true,
                    message: 'Instancia reiniciada',
                    instanceId
                });
            } catch (error) {
                console.error(`❌ Error reiniciando instancia ${req.params.instanceId}:`, error);
                res.status(500).json({ 
                    success: false, 
                    message: 'Error al reiniciar instancia', 
                    error: error.message 
                });
            }
        });
        
        // Desconectar instancia específica
        this.app.post(`${apiPrefix}/instances/:instanceId/disconnect`, async (req, res) => {
            try {
                const { instanceId } = req.params;
                console.log(`🔌 Desconexión solicitada para instancia: ${instanceId}`);
                
                const instance = this.whatsappManager.getInstance(instanceId);
                
                if (!instance) {
                    return res.status(404).json({
                        success: false,
                        message: 'Instancia no encontrada'
                    });
                }
                
                await instance.disconnect();
                
                res.json({
                    success: true,
                    message: 'Instancia desconectada',
                    instanceId
                });
            } catch (error) {
                console.error(`❌ Error desconectando instancia ${req.params.instanceId}:`, error);
                res.status(500).json({ 
                    success: false, 
                    message: 'Error al desconectar instancia', 
                    error: error.message 
                });
            }
        });
        
        // Eliminar instancia específica (siempre devuelve JSON, evitando cuerpos vacíos)
        this.app.delete(`${apiPrefix}/instances/:instanceId`, async (req, res) => {
            try {
                const { instanceId } = req.params;
                console.log(`🗑️ Eliminación solicitada para instancia: ${instanceId}`);

                // Verificar existencia de instancia para retornar 404 consistente en JSON
                const instance = this.whatsappManager.getInstance(instanceId);
                if (!instance) {
                    res
                        .status(404)
                        .type('application/json')
                        .send(JSON.stringify({
                            success: false,
                            message: 'Instancia no encontrada'
                        }));
                    return;
                }

                // Ejecutar eliminación con tolerancia a errores internos
                try {
                    await this.whatsappManager.deleteInstance(instanceId);
                } catch (opErr) {
                    // No romper la respuesta si Baileys emite errores internos durante logout
                    console.error(`⚠️ Error durante eliminación de ${instanceId} (continuando):`, opErr);
                }

                const payload = {
                    success: true,
                    message: 'Instancia eliminada exitosamente',
                    instanceId
                };
                // Forzar Content-Type y cuerpo explícito para evitar "Unexpected end of JSON input"
                res.status(200).type('application/json').send(JSON.stringify(payload));
                return;
            } catch (error) {
                console.error(`❌ Error eliminando instancia ${req.params.instanceId}:`, error);
                const payload = {
                    success: false,
                    message: 'Error al eliminar instancia',
                    error: error.message
                };
                // Asegurar siempre respuesta JSON incluso en error
                res.status(500).type('application/json').send(JSON.stringify(payload));
            }
        });
        
        // Enviar mensaje con instancia específica
        this.app.post(`${apiPrefix}/instances/:instanceId/send-message`, async (req, res) => {
            try {
                const { instanceId } = req.params;
                const { phone, message, options = {} } = req.body;
                
                if (!phone || !message) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Teléfono y mensaje son requeridos' 
                    });
                }
                
                console.log(`📤 Enviando mensaje desde instancia ${instanceId} a ${phone}`);
                
                const instance = this.whatsappManager.getInstance(instanceId);
                
                if (!instance) {
                    return res.status(404).json({
                        success: false,
                        message: 'Instancia no encontrada'
                    });
                }
                
                if (!instance.isConnected()) {
                    return res.status(400).json({
                        success: false,
                        message: 'Instancia no está conectada'
                    });
                }
                
                const result = await instance.sendMessage(phone, message, options);
                
                res.json({ 
                    success: true, 
                    message: 'Mensaje enviado exitosamente',
                    messageId: result.key.id,
                    instanceId
                });
            } catch (error) {
                console.error(`❌ Error enviando mensaje desde instancia ${req.params.instanceId}:`, error);
                res.status(500).json({ 
                    success: false, 
                    message: 'Error al enviar mensaje', 
                    error: error.message 
                });
            }
        });
        
        // Enviar mensajes masivos con instancia específica
        this.app.post(`${apiPrefix}/instances/:instanceId/send-bulk`, async (req, res) => {
            try {
                const { instanceId } = req.params;
                const { contacts, message, options = {} } = req.body;

                console.log(`🚀 [BULK ENDPOINT] ========== SOLICITUD RECIBIDA ==========`);
                console.log(`🚀 [BULK ENDPOINT] Instance ID: ${instanceId}`);
                console.log(`🚀 [BULK ENDPOINT] Total contactos: ${contacts?.length || 0}`);
                console.log(`🚀 [BULK ENDPOINT] Mensaje preview: ${message?.substring(0, 50)}...`);
                console.log(`🚀 [BULK ENDPOINT] Options:`, options);

                if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
                    console.error(`❌ [BULK ENDPOINT] Validación falló: sin contactos`);
                    return res.status(400).json({
                        success: false,
                        message: 'Lista de contactos es requerida'
                    });
                }

                // Detectar mensajes por contacto y/o media (global o por contacto)
                const hasPerContactMessages = Array.isArray(contacts) && contacts.some(c => c && typeof c.message === 'string' && c.message.trim().length > 0);
                const hasGlobalMedia = !!(options && options.media && typeof options.media.url === 'string' && options.media.url.trim().length > 0);
                const hasPerContactMedia = Array.isArray(contacts) && contacts.some(c => c && c.media && typeof c.media.url === 'string' && c.media.url.trim().length > 0);
                
                // Log de muestra del primer contacto para diagnóstico
                const firstContact = Array.isArray(contacts) && contacts.length > 0 ? contacts[0] : null;
                try {
                    console.log('🔎 [BULK ENDPOINT] First contact sample:', firstContact ? {
                        phone: firstContact.phone,
                        hasMessage: typeof firstContact.message === 'string' && firstContact.message.trim().length > 0,
                        hasMedia: !!(firstContact.media && firstContact.media.url),
                        messagePreview: typeof firstContact.message === 'string' ? firstContact.message.substring(0, 50) + '...' : undefined
                    } : null);
                } catch (e) {}
                
                // Validación flexible:
                // - Aceptar si hay mensaje global
                // - O si hay mensajes por contacto
                // - O si hay media (global o por contacto), incluso sin caption
                if (!message && !hasPerContactMessages && !(hasGlobalMedia || hasPerContactMedia)) {
                    console.error(`❌ [BULK ENDPOINT] Validación falló: sin mensaje ni media (global o por contacto)`);
                    return res.status(400).json({
                        success: false,
                        message: 'Mensaje o media es requerido (global o por contacto)'
                    });
                }
                
                if (hasPerContactMessages) {
                    console.log(`🧩 [BULK ENDPOINT] Modo mensajes personalizados por contacto activado`);
                }
                if (hasGlobalMedia || hasPerContactMedia) {
                    console.log(`🖼️ [BULK ENDPOINT] Modo con media ${hasPerContactMedia ? 'por contacto' : 'global'} activado`);
                }

                console.log(`📤 [BULK ENDPOINT] Buscando instancia ${instanceId}...`);
                const instance = this.whatsappManager.getInstance(instanceId);

                if (!instance) {
                    console.error(`❌ [BULK ENDPOINT] Instancia ${instanceId} NO ENCONTRADA`);
                    console.log(`📋 [BULK ENDPOINT] Instancias disponibles:`,
                        this.whatsappManager.getAllInstances().map(i => i.instanceId));
                    return res.status(404).json({
                        success: false,
                        message: 'Instancia no encontrada'
                    });
                }

                console.log(`✅ [BULK ENDPOINT] Instancia ${instanceId} encontrada`);
                console.log(`🔍 [BULK ENDPOINT] Estado de instancia:`, {
                    connected: instance.isConnected(),
                    connecting: instance.isConnecting(),
                    hasQR: !!instance.getQRCode()
                });

                if (!instance.isConnected()) {
                    console.error(`❌ [BULK ENDPOINT] Instancia ${instanceId} NO ESTÁ CONECTADA`);
                    return res.status(400).json({
                        success: false,
                        message: 'Instancia no está conectada. Por favor, escanea el código QR primero.'
                    });
                }

                console.log(`🚀 [BULK ENDPOINT] Iniciando envío masivo usando sendBulkMessages()...`);

                // ✅ OPTIMIZADO: Usar el método sendBulkMessages que maneja comportamiento humano
                const bulkResults = await instance.sendBulkMessages(contacts, message, options);

                console.log(`📊 [BULK ENDPOINT] Envío masivo completado:`, {
                    total: bulkResults.total,
                    successful: bulkResults.successful,
                    failed: bulkResults.failed,
                    sessions: bulkResults.sessions,
                    successRate: `${((bulkResults.successful / bulkResults.total) * 100).toFixed(1)}%`
                });

                // Notificar a Laravel vía webhook si hay campaign_id y execution_id en options
                if (options.campaign_id && options.execution_id) {
                    const webhookUrl = options.webhook_url || process.env.LARAVEL_WEBHOOK_URL || 'http://127.0.0.1:8001/api/saas/whatsapp/webhook/bulk-send-complete';
                    
                    console.log(`📡 [BULK ENDPOINT] Notificando a Laravel vía webhook...`, {
                        url: webhookUrl,
                        campaign_id: options.campaign_id,
                        execution_id: options.execution_id
                    });

                    try {
                        const axios = require('axios');
                        await axios.post(webhookUrl, {
                            campaign_id: options.campaign_id,
                            execution_id: options.execution_id,
                            results: bulkResults.results || [],
                            stats: {
                                successful: bulkResults.successful,
                                failed: bulkResults.failed,
                                total: bulkResults.total
                            },
                            instanceId
                        }, {
                            timeout: 5000,
                            headers: { 'Content-Type': 'application/json' }
                        });

                        console.log(`✅ [BULK ENDPOINT] Webhook enviado exitosamente a Laravel`);
                    } catch (webhookError) {
                        console.error(`⚠️ [BULK ENDPOINT] Error enviando webhook a Laravel (no crítico):`, webhookError.message);
                    }
                }

                res.json({
                    success: true,
                    message: `Mensajes enviados desde instancia ${instanceId}: ${bulkResults.successful} exitosos, ${bulkResults.failed} fallidos`,
                    results: bulkResults.results || [],
                    stats: {
                        successful: bulkResults.successful,
                        failed: bulkResults.failed,
                        total: bulkResults.total
                    },
                    instanceId
                });
            } catch (error) {
                console.error(`❌ Error enviando mensajes masivos desde instancia ${req.params.instanceId}:`, error);
                res.status(500).json({
                    success: false,
                    message: 'Error al enviar mensajes masivos',
                    error: error.message
                });
            }
        });
        
        // Ruta de salud (sanear referencia al servicio)
        this.app.get('/health', (req, res) => {
            const manager = this.app.locals.whatsappManager;
            let status = { totalInstances: 0, anyConnected: false };
            try {
                const instances = manager?.getAllInstances?.() || [];
                status.totalInstances = instances.length;
                status.anyConnected = instances.some(i => i.isConnected && i.isConnected());
            } catch (e) {
                status = { totalInstances: 0, anyConnected: false };
            }
            res.json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                whatsapp: status,
                uptime: process.uptime()
            });
        });

        // Dashboard (página principal)
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });
    }

    initializeErrorHandling() {
        // Manejo de rutas no encontradas
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                message: 'Ruta no encontrada'
            });
        });

        // Manejo global de errores
        this.app.use((error, req, res, next) => {
            console.error('Error global:', error);
            res.status(error.status || 500).json({
                success: false,
                message: error.message || 'Error interno del servidor',
                ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
            });
        });
    }

    initializeSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log('🔌 Cliente conectado:', socket.id);
            
            socket.on('disconnect', () => {
                console.log('🔌 Cliente desconectado:', socket.id);
            });

            // Eventos personalizados del cliente
            socket.on('request_qr', () => {
                if (this.whatsappService.qrCode) {
                    socket.emit('qr_code', this.whatsappService.qrCode);
                }
            });
        });
    }

    async start() {
        try {
            this.initializeSocketHandlers();
            
            this.server.listen(this.port, () => {
                console.log('🚀 Servidor iniciado en puerto:', this.port);
                console.log('📱 Dashboard disponible en: http://localhost:' + this.port);
                console.log('🔗 API disponible en: http://localhost:' + this.port + (process.env.API_PREFIX || '/api/v1'));
            });

            // Graceful shutdown
            process.on('SIGTERM', () => this.shutdown());
            process.on('SIGINT', () => this.shutdown());

        } catch (error) {
            console.error('❌ Error iniciando servidor:', error);
            process.exit(1);
        }
    }

    async shutdown() {
        console.log('🛑 Cerrando servidor...');
        
        if (this.whatsappService) {
            await this.whatsappService.disconnect();
        }
        
        if (this.database) {
            await this.database.close();
        }
        
        this.server.close(() => {
            console.log('✅ Servidor cerrado correctamente');
            process.exit(0);
        });
    }
}

// Iniciar servidor
const server = new GuromensajesServer();
server.start();

module.exports = GuromensajesServer;
