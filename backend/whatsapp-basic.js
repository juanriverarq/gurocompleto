/**
 * Bot básico para WhatsApp usando whatsapp-web.js
 * Servicio simple que se puede controlar vía API
 */

import qrcode from 'qrcode-terminal';
import QRCode from 'qrcode';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import fs from 'fs';

class WhatsAppBasicService {
    constructor() {
        this.client = null;
        this.isReady = false;
        this.qrCode = null;
        this.qrCodeBase64 = null;
        this.status = 'disconnected'; // disconnected, connecting, connected
        
        console.log('📱 WhatsApp Basic Service iniciado');
    }

    // Inicializar el cliente de WhatsApp
    initialize() {
        if (this.client) {
            console.log('⚠️ Cliente ya inicializado');
            return;
        }

        console.log('🔄 Inicializando cliente WhatsApp...');
        
        this.client = new Client({
            authStrategy: new LocalAuth({
                dataPath: './whatsapp_auth'
            }),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });

        // Evento: QR generado
        this.client.on('qr', async (qr) => {
            console.log('📱 QR Code generado');
            this.qrCode = qr;
            this.status = 'connecting';
            
            // Generar QR en base64 para el frontend
            try {
                this.qrCodeBase64 = await QRCode.toDataURL(qr, {
                    width: 300,
                    margin: 2,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    }
                });
                console.log('✅ QR Code base64 generado para frontend');
                
                // Guardar QR en archivo temporal para el controlador PHP
                const tempData = {
                    qrCodeBase64: this.qrCodeBase64,
                    status: this.status,
                    isReady: this.isReady,
                    timestamp: new Date().toISOString()
                };
                
                fs.writeFileSync('temp_qr.json', JSON.stringify(tempData, null, 2));
                console.log('✅ QR guardado en archivo temporal');
                
            } catch (error) {
                console.error('❌ Error generando QR base64:', error);
            }
            
            // Mostrar QR en terminal para debug
            qrcode.generate(qr, { small: true });
        });

        // Evento: Cliente listo
        this.client.on('ready', () => {
            console.log('✅ Conexión exitosa con WhatsApp!');
            this.isReady = true;
            this.status = 'connected';
            this.qrCode = null;
            this.qrCodeBase64 = null;
            
            // Limpiar archivo temporal del QR
            try {
                if (fs.existsSync('temp_qr.json')) {
                    fs.unlinkSync('temp_qr.json');
                    console.log('✅ Archivo temporal QR eliminado');
                }
            } catch (error) {
                console.error('❌ Error eliminando archivo temporal:', error);
            }
        });

        // Evento: Mensaje recibido
        this.client.on('message', async (message) => {
            console.log(`📨 Mensaje recibido: ${message.body} (de: ${message.from})`);
            
            // Bot simple que responde a "hola mundo"
            if (message.body.toLowerCase() === 'hola mundo') {
                try {
                    await this.client.sendMessage(
                        message.from, 
                        '¡Hola! 🤖 Soy un bot básico. Mi creador está ocupado construyendo cosas increíbles. ¿En qué puedo ayudarte?'
                    );
                    console.log('✅ Respuesta automática enviada');
                } catch (error) {
                    console.error('❌ Error enviando respuesta:', error);
                }
            }

            // Responder a "menu" o "ayuda"
            if (message.body.toLowerCase() === 'menu' || message.body.toLowerCase() === 'ayuda') {
                try {
                    const menuMessage = `🤖 *Bot de Ejemplo*\n\nComandos disponibles:\n• *hola mundo* - Saludo básico\n• *menu* - Mostrar este menú\n• *estado* - Ver estado del bot\n\n¡Prueba escribiendo algún comando!`;
                    await this.client.sendMessage(message.from, menuMessage);
                    console.log('✅ Menú enviado');
                } catch (error) {
                    console.error('❌ Error enviando menú:', error);
                }
            }

            // Responder a "estado"
            if (message.body.toLowerCase() === 'estado') {
                try {
                    await this.client.sendMessage(
                        message.from, 
                        `🟢 Bot activo y funcionando correctamente!\n\nEstado: Conectado ✅\nHora: ${new Date().toLocaleString()}`
                    );
                    console.log('✅ Estado enviado');
                } catch (error) {
                    console.error('❌ Error enviando estado:', error);
                }
            }
        });

        // Evento: Desconexión
        this.client.on('disconnected', (reason) => {
            console.log('❌ Cliente desconectado:', reason);
            this.isReady = false;
            this.status = 'disconnected';
            this.qrCode = null;
            this.qrCodeBase64 = null;
        });

        // Evento: Error
        this.client.on('auth_failure', (msg) => {
            console.error('❌ Error de autenticación:', msg);
            this.status = 'disconnected';
        });

        // Inicializar cliente
        this.client.initialize();
    }

    // Obtener estado actual
    getStatus() {
        return {
            isReady: this.isReady,
            status: this.status,
            qrCode: this.qrCode,
            qrCodeBase64: this.qrCodeBase64,
            hasClient: !!this.client
        };
    }

    // Enviar mensaje manualmente
    async sendMessage(to, message) {
        if (!this.isReady) {
            throw new Error('Cliente no está listo');
        }

        try {
            // Formatear número si es necesario
            const formattedNumber = to.includes('@c.us') ? to : `${to}@c.us`;
            
            const result = await this.client.sendMessage(formattedNumber, message);
            console.log(`✅ Mensaje enviado a ${to}: ${message}`);
            return result;
        } catch (error) {
            console.error(`❌ Error enviando mensaje a ${to}:`, error);
            throw error;
        }
    }

    // Desconectar cliente
    async disconnect() {
        if (this.client) {
            try {
                await this.client.destroy();
                console.log('✅ Cliente WhatsApp desconectado');
            } catch (error) {
                console.error('❌ Error desconectando:', error);
            }
            
            this.client = null;
            this.isReady = false;
            this.status = 'disconnected';
            this.qrCode = null;
            this.qrCodeBase64 = null;
        }
    }

    // Obtener información del cliente
    async getClientInfo() {
        if (!this.isReady) {
            return null;
        }

        try {
            const info = await this.client.info;
            return {
                phone: info.wid.user,
                name: info.pushname,
                connected: this.isReady
            };
        } catch (error) {
            console.error('❌ Error obteniendo info del cliente:', error);
            return null;
        }
    }
}

// Crear instancia global
const whatsappService = new WhatsAppBasicService();

// Ejecutar automáticamente si se ejecuta como script principal
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🚀 Iniciando servicio WhatsApp automáticamente...');
    whatsappService.initialize();
}

export default whatsappService; 