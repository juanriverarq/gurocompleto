const express = require('express');
const router = express.Router();

// Obtener lista de automatizaciones
router.get('/', async (req, res) => {
    try {
        const { active } = req.query;
        const activeFilter = active !== undefined ? active === 'true' : null;
        const automations = await req.app.locals.database.getAutomations(activeFilter);
        res.json({ success: true, automations });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener automatizaciones', error: error.message });
    }
});

// Obtener una automatización específica
router.get('/:id', async (req, res) => {
    try {
        const automation = await req.app.locals.database.getAutomation(req.params.id);
        if (automation) {
            res.json({ success: true, automation });
        } else {
            res.status(404).json({ success: false, message: 'Automatización no encontrada' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener automatización', error: error.message });
    }
});

// Crear nueva automatización
router.post('/', async (req, res) => {
    try {
        const automationData = req.body;
        
        // Validar datos requeridos
        if (!automationData.name || !automationData.trigger_type || !automationData.message_template) {
            return res.status(400).json({
                success: false,
                message: 'Nombre, tipo de trigger y plantilla de mensaje son requeridos'
            });
        }

        const automationId = await req.app.locals.automationService.createAutomation(automationData);
        res.json({ success: true, automationId, message: 'Automatización creada exitosamente' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al crear automatización', error: error.message });
    }
});

// Actualizar automatización
router.put('/:id', async (req, res) => {
    try {
        const automationId = req.params.id;
        const automationData = req.body;
        
        await req.app.locals.automationService.updateAutomation(automationId, automationData);
        res.json({ success: true, message: 'Automatización actualizada exitosamente' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al actualizar automatización', error: error.message });
    }
});

// Eliminar automatización
router.delete('/:id', async (req, res) => {
    try {
        const automationId = req.params.id;
        await req.app.locals.automationService.deleteAutomation(automationId);
        res.json({ success: true, message: 'Automatización eliminada exitosamente' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al eliminar automatización', error: error.message });
    }
});

// Activar/desactivar automatización
router.patch('/:id/toggle', async (req, res) => {
    try {
        const automationId = req.params.id;
        const automation = await req.app.locals.database.getAutomation(automationId);
        
        if (!automation) {
            return res.status(404).json({ success: false, message: 'Automatización no encontrada' });
        }

        const newActiveState = !automation.active;
        await req.app.locals.automationService.updateAutomation(automationId, {
            ...automation,
            active: newActiveState
        });

        res.json({ 
            success: true, 
            message: `Automatización ${newActiveState ? 'activada' : 'desactivada'} exitosamente`,
            active: newActiveState
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al cambiar estado de automatización', error: error.message });
    }
});

// Ejecutar automatización manualmente
router.post('/:id/execute', async (req, res) => {
    try {
        const automationId = req.params.id;
        const context = req.body.context || {};
        
        const automation = await req.app.locals.database.getAutomation(automationId);
        if (!automation) {
            return res.status(404).json({ success: false, message: 'Automatización no encontrada' });
        }

        await req.app.locals.automationService.executeAutomation(automation, context);
        res.json({ success: true, message: 'Automatización ejecutada exitosamente' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al ejecutar automatización', error: error.message });
    }
});

// Webhook para triggers externos
router.post('/webhook/:id', async (req, res) => {
    try {
        const automationId = req.params.id;
        const context = req.body;
        
        const automation = await req.app.locals.database.getAutomation(automationId);
        if (!automation || automation.trigger_type !== 'webhook') {
            return res.status(404).json({ success: false, message: 'Automatización webhook no encontrada' });
        }

        if (!automation.active) {
            return res.status(400).json({ success: false, message: 'Automatización no está activa' });
        }

        await req.app.locals.automationService.executeAutomation(automation, context);
        res.json({ success: true, message: 'Webhook procesado exitosamente' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error procesando webhook', error: error.message });
    }
});

module.exports = router;
