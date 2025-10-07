const express = require('express');
const router = express.Router();

// Obtener lista de contactos
router.get('/', async (req, res) => {
    try {
        const { phone, name, tag, limit } = req.query;
        const filters = { phone, name, tag, limit: parseInt(limit, 10) || 50 };
        const contacts = await req.app.locals.database.getContacts(filters);
        res.json({ success: true, contacts });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener contactos', error: error.message });
    }
});

// Obtener un contacto por teléfono
router.get('/:phone', async (req, res) => {
    try {
        const phone = req.params.phone;
        const contact = await req.app.locals.database.getContact(phone);
        if (contact) {
            res.json({ success: true, contact });
        } else {
            res.status(404).json({ success: false, message: 'Contacto no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener contacto', error: error.message });
    }
});

// Agregar o actualizar un contacto
router.post('/', async (req, res) => {
    try {
        const contactData = req.body;
        const contactId = await req.app.locals.database.saveContact(contactData);
        res.json({ success: true, contactId });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al guardar contacto', error: error.message });
    }
});

// Eliminar un contacto
router.delete('/:phone', async (req, res) => {
    try {
        const phone = req.params.phone;
        await req.app.locals.database.deleteContact(phone);
        res.json({ success: true, message: 'Contacto eliminado' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al eliminar contacto', error: error.message });
    }
});

module.exports = router;

