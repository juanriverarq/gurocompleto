const express = require('express');
const router = express.Router();

// Soporte de instancia por defecto usando el administrador multi-instancia
const DEFAULT_INSTANCE_ID = process.env.DEFAULT_INSTANCE_ID || 'default';

async function getDefaultInstance(req, opts = {}) {
    try {
        const manager = req.app.locals.whatsappManager;
        if (!manager) return null;
        let inst = manager.getInstance(DEFAULT_INSTANCE_ID);
        if (!inst && opts.autocreate) {
            inst = await manager.createInstance(DEFAULT_INSTANCE_ID, opts.settings || {});
        }
        return inst || null;
    } catch (e) {
        console.error('❌ Error obteniendo/creando instancia por defecto:', e);
        return null;
    }
}
// Estado de conexión de WhatsApp
router.get('/status', async (req, res) => {
    try {
        const inst = await getDefaultInstance(req, { autocreate: false });
        if (!inst) {
            return res.json({ success: true, connected: false, qrCode: null, status: 'disconnected' });
        }
        const connected = inst.isConnected();
        const qrCode = inst.getQRCode();
        res.json({
            success: true,
            connected,
            qrCode: connected ? null : qrCode,
            status: connected ? 'connected' : 'disconnected'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener estado', error: error.message });
    }
});

// Obtener QR Code para conectar
router.get('/qr', async (req, res) => {
    try {
        const inst = await getDefaultInstance(req, { autocreate: true });
        if (!inst) {
            return res.status(503).json({ success: false, message: 'Servicio no disponible' });
        }
        const qrCode = inst.getQRCode();
        if (qrCode) {
            res.json({ success: true, qrCode });
        } else if (inst.isConnected()) {
            res.json({ success: false, message: 'Instancia ya está conectada' });
        } else {
            res.json({ success: false, message: 'No hay QR disponible en este momento' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener QR', error: error.message });
    }
});

// Desconectar WhatsApp
router.post('/disconnect', async (req, res) => {
    try {
        const inst = await getDefaultInstance(req, { autocreate: false });
        if (!inst) return res.status(503).json({ success: false, message: 'Servicio no disponible' });
        await inst.disconnect();
        res.json({ success: true, message: 'Desconectado de WhatsApp' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al desconectar', error: error.message });
    }
});

// Reconectar WhatsApp
router.post('/reconnect', async (req, res) => {
    try {
        const inst = await getDefaultInstance(req, { autocreate: true });
        if (!inst) return res.status(503).json({ success: false, message: 'Servicio no disponible' });
        await inst.forceReconnect();
        res.json({ success: true, message: 'Intentando reconectar a WhatsApp' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al reconectar', error: error.message });
    }
});

// Reset completo de conexión
router.post('/reset', async (req, res) => {
    try {
        const inst = await getDefaultInstance(req, { autocreate: true });
        if (!inst) return res.status(503).json({ success: false, message: 'Servicio no disponible' });
        await inst.resetConnection();
        res.json({ success: true, message: 'Reiniciando conexión completamente (se generará nuevo QR)' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al reiniciar conexión', error: error.message });
    }
});

// Información detallada de conexión
router.get('/connection-info', async (req, res) => {
    try {
        const inst = await getDefaultInstance(req, { autocreate: false });
        if (!inst) return res.json({ success: true, info: { connected: false, status: 'disconnected' } });
        const info = inst.getConnectionInfo();
        res.json({ success: true, info });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener info de conexión', error: error.message });
    }
});

// Obtener contactos desde WhatsApp
router.get('/contacts', async (req, res) => {
    try {
        const inst = await getDefaultInstance(req, { autocreate: false });
        if (!inst) return res.status(503).json({ success: false, message: 'Servicio no disponible' });
        const contacts = await inst.getContacts();
        res.json({ success: true, contacts });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener contactos de WhatsApp', error: error.message });
    }
});

// Validar número de teléfono
router.post('/validate-phone', async (req, res) => {
    try {
        const { phone } = req.body;
        
        if (!phone) {
            return res.status(400).json({ success: false, message: 'Número de teléfono requerido' });
        }
        
        const PhoneUtils = require('../utils/phoneUtils');
        const phoneInfo = PhoneUtils.getPhoneInfo(phone);
        
        res.json({
            success: true,
            phoneInfo
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error validando teléfono', error: error.message });
    }
});

// Configurar código de país por defecto
router.post('/set-country-code', async (req, res) => {
    try {
        const { countryCode } = req.body;
        
        if (!countryCode) {
            return res.status(400).json({ success: false, message: 'Código de país requerido' });
        }
        
        const PhoneUtils = require('../utils/phoneUtils');
        PhoneUtils.setDefaultCountryCode(countryCode);
        
        res.json({
            success: true,
            message: `Código de país configurado a: +${countryCode}`,
            countryCode
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error configurando código de país', error: error.message });
    }
});

// Obtener códigos de país disponibles
router.get('/country-codes', async (req, res) => {
    try {
        const PhoneUtils = require('../utils/phoneUtils');
        const countryCodes = PhoneUtils.getAvailableCountryCodes();
        const defaultCode = PhoneUtils.getDefaultCountryCode();
        
        res.json({
            success: true,
            countryCodes,
            defaultCountryCode: defaultCode
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error obteniendo códigos de país', error: error.message });
    }
});

// Estadísticas del servicio
router.get('/stats', async (req, res) => {
    try {
        const stats = await req.app.locals.database.getStats();
        const inst = await getDefaultInstance(req, { autocreate: false });
        const connected = inst ? inst.isConnected() : false;
        res.json({
            success: true,
            stats: {
                ...stats,
                whatsapp_connected: connected,
                uptime: process.uptime()
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener estadísticas', error: error.message });
    }
});

// ========== NUEVAS RUTAS PARA SOPORTE MULTI-INSTANCIA ==========

// Crear nueva instancia
router.post('/instances', async (req, res) => {
    try {
        const { instanceId, webhook, settings } = req.body;
        
        if (!instanceId) {
            return res.status(400).json({ success: false, message: 'instanceId es requerido' });
        }
        
        // Por ahora, solo manejamos una instancia global
        // En el futuro, aquí se podría implementar lógica para múltiples instancias
        console.log(`🆕 Nueva instancia solicitada: ${instanceId}`);
        
        res.json({
            success: true,
            message: 'Instancia creada (usando instancia global por ahora)',
            instanceId,
            status: 'connecting'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al crear instancia', error: error.message });
    }
});

// Obtener QR de instancia específica
router.get('/instances/:instanceId/qr', async (req, res) => {
    try {
        const { instanceId } = req.params;
        console.log(`🔲 QR solicitado para instancia: ${instanceId}`);
        
        // Por ahora, devolvemos el QR de la instancia global
        const qrCode = req.app.locals.whatsappService.getQRCode();
        
        if (qrCode) {
            res.json({ 
                success: true, 
                qr: qrCode,
                instanceId,
                expires_at: new Date(Date.now() + 45000).toISOString() // 45 segundos
            });
        } else {
            // Verificar si ya está conectado
            const connected = req.app.locals.whatsappService.isConnected();
            if (connected) {
                res.json({ 
                    success: false, 
                    message: 'Instancia ya está conectada',
                    error: 'Already connected'
                });
            } else {
                res.json({ 
                    success: false, 
                    message: 'No hay QR disponible en este momento',
                    error: 'Failed to get QR code'
                });
            }
        }
    } catch (error) {
        console.error(`❌ Error obteniendo QR para ${req.params.instanceId}:`, error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al obtener QR', 
            error: 'Failed to get QR code'
        });
    }
});

// Obtener status de instancia específica
router.get('/instances/:instanceId/status', async (req, res) => {
    try {
        const { instanceId } = req.params;
        console.log(`📊 Status solicitado para instancia: ${instanceId}`);
        
        // Por ahora, devolvemos el status de la instancia global
        const connected = req.app.locals.whatsappService.isConnected();
        
        res.json({
            success: true,
            instanceId,
            status: connected ? 'connected' : 'disconnected',
            connected,
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
router.post('/instances/:instanceId/restart', async (req, res) => {
    try {
        const { instanceId } = req.params;
        console.log(`🔄 Reinicio solicitado para instancia: ${instanceId}`);
        
        // Por ahora, reiniciamos la instancia global
        await req.app.locals.whatsappService.forceReconnect();
        
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
router.post('/instances/:instanceId/disconnect', async (req, res) => {
    try {
        const { instanceId } = req.params;
        console.log(`🔌 Desconexión solicitada para instancia: ${instanceId}`);
        
        // Por ahora, desconectamos la instancia global
        await req.app.locals.whatsappService.disconnect();
        
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

// Eliminar instancia específica
router.delete('/instances/:instanceId', async (req, res) => {
    try {
        const { instanceId } = req.params;
        console.log(`🗑️ Eliminación solicitada para instancia: ${instanceId}`);
        
        // Por ahora, solo simulamos la eliminación
        res.json({
            success: true,
            message: 'Instancia eliminada (simulado)',
            instanceId
        });
    } catch (error) {
        console.error(`❌ Error eliminando instancia ${req.params.instanceId}:`, error);
        res.status(500).json({ 
            success: false, 
            message: 'Error al eliminar instancia', 
            error: error.message 
        });
    }
});

module.exports = router;
