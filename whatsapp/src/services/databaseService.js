const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { v4: uuid } = require('uuid');

class DatabaseService {
    constructor() {
        this.dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/guromensajes.db');
        this.db = null;
        
        // Crear directorio si no existe
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('❌ Error conectando a la base de datos:', err);
                    reject(err);
                } else {
                    console.log('✅ Conectado a la base de datos SQLite');
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        const tables = [
            // Tabla de contactos
            `CREATE TABLE IF NOT EXISTS contacts (
                id TEXT PRIMARY KEY,
                phone TEXT NOT NULL,
                name TEXT,
                email TEXT,
                tags TEXT,
                custom_fields TEXT,
                instance_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(phone, instance_id)
            )`,
            
            // Tabla de mensajes
            `CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                phone TEXT NOT NULL,
                message TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('sent', 'received')),
                status TEXT DEFAULT 'pending',
                media_url TEXT,
                media_type TEXT,
                instance_id TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                automation_id TEXT,
                FOREIGN KEY (automation_id) REFERENCES automations (id)
            )`,
            
            // Tabla de automatizaciones
            `CREATE TABLE IF NOT EXISTS automations (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                trigger_type TEXT NOT NULL CHECK(trigger_type IN ('keyword', 'schedule', 'webhook', 'new_contact')),
                trigger_value TEXT,
                message_template TEXT NOT NULL,
                active BOOLEAN DEFAULT 1,
                conditions TEXT,
                actions TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            
            // Tabla de campañas
            `CREATE TABLE IF NOT EXISTS campaigns (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                message_template TEXT NOT NULL,
                target_contacts TEXT,
                scheduled_at DATETIME,
                status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'scheduled', 'sending', 'completed', 'cancelled')),
                sent_count INTEGER DEFAULT 0,
                total_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            
            // Tabla de plantillas de mensajes
            `CREATE TABLE IF NOT EXISTS message_templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                content TEXT NOT NULL,
                variables TEXT,
                category TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            
            // Tabla de usuarios del sistema
            `CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user')),
                active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        for (const table of tables) {
            await this.run(table);
        }
    }

    // Método helper para ejecutar queries
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this);
                }
            });
        });
    }

    // Método helper para obtener un solo resultado
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Método helper para obtener múltiples resultados
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // ========== MÉTODOS PARA CONTACTOS ==========
    async saveContact(contactData) {
        const id = contactData.id || uuid();
        const { phone, name, email, tags, custom_fields, instance_id } = contactData;
        
        const sql = `INSERT OR REPLACE INTO contacts 
            (id, phone, name, email, tags, custom_fields, instance_id, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
        
        await this.run(sql, [
            id, 
            phone, 
            name, 
            email, 
            JSON.stringify(tags || []), 
            JSON.stringify(custom_fields || {}),
            instance_id
        ]);
        
        return id;
    }

    async getContacts(filters = {}) {
        let sql = 'SELECT * FROM contacts WHERE 1=1';
        const params = [];

        if (filters.phone) {
            sql += ' AND phone LIKE ?';
            params.push(`%${filters.phone}%`);
        }

        if (filters.name) {
            sql += ' AND name LIKE ?';
            params.push(`%${filters.name}%`);
        }

        if (filters.tag) {
            sql += ' AND tags LIKE ?';
            params.push(`%${filters.tag}%`);
        }

        sql += ' ORDER BY created_at DESC';

        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }

        const contacts = await this.all(sql, params);
        
        // Parsear campos JSON
        return contacts.map(contact => ({
            ...contact,
            tags: JSON.parse(contact.tags || '[]'),
            custom_fields: JSON.parse(contact.custom_fields || '{}')
        }));
    }

    async getContact(phone, instance_id = null) {
        let sql = 'SELECT * FROM contacts WHERE phone = ?';
        let params = [phone];
        
        if (instance_id) {
            sql += ' AND instance_id = ?';
            params.push(instance_id);
        }
        
        const contact = await this.get(sql, params);
        if (contact) {
            contact.tags = JSON.parse(contact.tags || '[]');
            contact.custom_fields = JSON.parse(contact.custom_fields || '{}');
        }
        return contact;
    }

    async deleteContact(phone, instance_id = null) {
        let sql = 'DELETE FROM contacts WHERE phone = ?';
        let params = [phone];
        
        if (instance_id) {
            sql += ' AND instance_id = ?';
            params.push(instance_id);
        }
        
        await this.run(sql, params);
    }

    // ========== MÉTODOS PARA MENSAJES ==========
    async saveMessage(messageData) {
        const id = messageData.id || uuid();
        const { phone, message, type, status, media_url, media_type, automation_id, instance_id } = messageData;
        
        const sql = `INSERT INTO messages 
            (id, phone, message, type, status, media_url, media_type, automation_id, instance_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        await this.run(sql, [id, phone, message, type, status || 'delivered', media_url, media_type, automation_id, instance_id]);
        
        return id;
    }

    async getMessages(filters = {}) {
        let sql = 'SELECT * FROM messages WHERE 1=1';
        const params = [];

        if (filters.phone) {
            sql += ' AND phone = ?';
            params.push(filters.phone);
        }

        if (filters.type) {
            sql += ' AND type = ?';
            params.push(filters.type);
        }

        if (filters.from_date) {
            sql += ' AND timestamp >= ?';
            params.push(filters.from_date);
        }

        if (filters.to_date) {
            sql += ' AND timestamp <= ?';
            params.push(filters.to_date);
        }

        sql += ' ORDER BY timestamp DESC';

        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }

        return await this.all(sql, params);
    }

    async getConversation(phone, limit = 50) {
        const sql = `SELECT * FROM messages 
            WHERE phone = ? 
            ORDER BY timestamp DESC 
            LIMIT ?`;
        
        return await this.all(sql, [phone, limit]);
    }

    // ========== MÉTODOS PARA AUTOMATIZACIONES ==========
    async saveAutomation(automationData) {
        const id = automationData.id || uuid();
        const { name, trigger_type, trigger_value, message_template, conditions, actions, active } = automationData;
        
        const sql = `INSERT OR REPLACE INTO automations 
            (id, name, trigger_type, trigger_value, message_template, conditions, actions, active, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
        
        await this.run(sql, [
            id, 
            name, 
            trigger_type, 
            trigger_value, 
            message_template, 
            JSON.stringify(conditions || {}),
            JSON.stringify(actions || []),
            active !== undefined ? active : 1
        ]);
        
        return id;
    }

    async getAutomations(active = null) {
        let sql = 'SELECT * FROM automations';
        const params = [];

        if (active !== null) {
            sql += ' WHERE active = ?';
            params.push(active ? 1 : 0);
        }

        sql += ' ORDER BY created_at DESC';

        const automations = await this.all(sql, params);
        
        return automations.map(automation => ({
            ...automation,
            conditions: JSON.parse(automation.conditions || '{}'),
            actions: JSON.parse(automation.actions || '[]'),
            active: !!automation.active
        }));
    }

    async getAutomation(id) {
        const automation = await this.get('SELECT * FROM automations WHERE id = ?', [id]);
        if (automation) {
            automation.conditions = JSON.parse(automation.conditions || '{}');
            automation.actions = JSON.parse(automation.actions || '[]');
            automation.active = !!automation.active;
        }
        return automation;
    }

    async deleteAutomation(id) {
        await this.run('DELETE FROM automations WHERE id = ?', [id]);
    }

    // ========== MÉTODOS PARA PLANTILLAS ==========
    async saveTemplate(templateData) {
        const id = templateData.id || uuid();
        const { name, content, variables, category } = templateData;
        
        const sql = `INSERT OR REPLACE INTO message_templates 
            (id, name, content, variables, category, updated_at) 
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;
        
        await this.run(sql, [
            id, 
            name, 
            content, 
            JSON.stringify(variables || []),
            category
        ]);
        
        return id;
    }

    async getTemplates(category = null) {
        let sql = 'SELECT * FROM message_templates';
        const params = [];

        if (category) {
            sql += ' WHERE category = ?';
            params.push(category);
        }

        sql += ' ORDER BY created_at DESC';

        const templates = await this.all(sql, params);
        
        return templates.map(template => ({
            ...template,
            variables: JSON.parse(template.variables || '[]')
        }));
    }

    // ========== ESTADÍSTICAS ==========
    async getStats() {
        const totalContacts = await this.get('SELECT COUNT(*) as count FROM contacts');
        const totalMessages = await this.get('SELECT COUNT(*) as count FROM messages');
        const totalAutomations = await this.get('SELECT COUNT(*) as count FROM automations WHERE active = 1');
        const messagesLastWeek = await this.get(`
            SELECT COUNT(*) as count FROM messages 
            WHERE timestamp >= datetime('now', '-7 days')
        `);

        return {
            total_contacts: totalContacts.count,
            total_messages: totalMessages.count,
            active_automations: totalAutomations.count,
            messages_last_week: messagesLastWeek.count
        };
    }

    async close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = DatabaseService;
