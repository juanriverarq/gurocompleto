const express = require('express');
const router = express.Router();

// Obtener lista de mensajes
router.get('/', async (req, res) => {
    try {
        const { phone, type, from_date, to_date, limit } = req.query;
        const filters = { phone, type, from_date, to_date, limit: parseInt(limit, 10) || 50 };
        const messages = await req.app.locals.database.getMessages(filters);
        res.json({ success: true, messages });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener mensajes', error: error.message });
    }
});

// Obtener conversación con un contacto
router.get('/conversation/:phone', async (req, res) => {
    try {
        const phone = req.params.phone;
        const limit = parseInt(req.query.limit, 10) || 50;
        const messages = await req.app.locals.database.getConversation(phone, limit);
        res.json({ success: true, messages });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener conversación', error: error.message });
    }
});

// Enviar mensaje a un contacto
router.post('/send', async (req, res) => {
    try {
        const { phone, message, options = {} } = req.body;
        
        if (!phone || !message) {
            return res.status(400).json({ 
                success: false, 
                message: 'Teléfono y mensaje son requeridos' 
            });
        }

        const result = await req.app.locals.whatsappService.sendMessage(phone, message, options);
        
        res.json({ 
            success: true, 
            message: 'Mensaje enviado exitosamente',
            messageId: result.key.id
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Error al enviar mensaje', 
            error: error.message 
        });
    }
});

// Enviar mensaje masivo
router.post('/send-bulk', async (req, res) => {
    try {
        const { contacts, message, options = {} } = req.body;
        
        if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Lista de contactos es requerida' 
            });
        }

        if (!message) {
            return res.status(400).json({ 
                success: false, 
                message: 'Mensaje es requerido' 
            });
        }

        const results = await req.app.locals.whatsappService.sendBulkMessages(contacts, message, options);
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        res.json({ 
            success: true, 
            message: `Mensajes enviados: ${successful} exitosos, ${failed} fallidos`,
            results
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Error al enviar mensajes masivos', 
            error: error.message 
        });
    }
});

module.exports = router;
