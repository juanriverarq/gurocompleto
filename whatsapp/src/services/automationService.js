const cron = require('cron');

class AutomationService {
    constructor(whatsappService, database) {
        this.whatsappService = whatsappService;
        this.database = database;
        this.activeJobs = new Map();
        this.keywordAutomations = new Map();
    }

    async initialize() {
        // Cargar todas las automatizaciones activas
        await this.loadAutomations();
        
        // Configurar el intervalo para verificar automatizaciones
        setInterval(() => {
            this.checkScheduledAutomations();
        }, parseInt(process.env.AUTOMATION_CHECK_INTERVAL) || 60000);
        
        console.log('✅ Servicio de automatizaciones inicializado');
    }

    async loadAutomations() {
        try {
            const automations = await this.database.getAutomations(true);
            
            for (const automation of automations) {
                await this.activateAutomation(automation);
            }
            
            console.log(`📋 Cargadas ${automations.length} automatizaciones activas`);
        } catch (error) {
            console.error('❌ Error cargando automatizaciones:', error);
        }
    }

    async activateAutomation(automation) {
        try {
            switch (automation.trigger_type) {
                case 'keyword':
                    this.keywordAutomations.set(automation.trigger_value.toLowerCase(), automation);
                    break;
                    
                case 'schedule':
                    this.scheduleAutomation(automation);
                    break;
                    
                case 'webhook':
                    // Los webhooks se manejan en las rutas
                    break;
                    
                case 'new_contact':
                    // Se ejecuta cuando se agrega un nuevo contacto
                    break;
            }
            
            console.log(`✅ Automatización activada: ${automation.name}`);
        } catch (error) {
            console.error(`❌ Error activando automatización ${automation.name}:`, error);
        }
    }

    scheduleAutomation(automation) {
        try {
            // Parsear la expresión cron desde trigger_value
            const cronExpression = automation.trigger_value;
            
            const job = new cron.CronJob(cronExpression, async () => {
                await this.executeAutomation(automation);
            });
            
            job.start();
            this.activeJobs.set(automation.id, job);
            
            console.log(`⏰ Automatización programada: ${automation.name} (${cronExpression})`);
        } catch (error) {
            console.error(`❌ Error programando automatización ${automation.name}:`, error);
        }
    }

    async deactivateAutomation(automationId) {
        // Detener job programado si existe
        if (this.activeJobs.has(automationId)) {
            this.activeJobs.get(automationId).stop();
            this.activeJobs.delete(automationId);
        }
        
        // Remover de keywords
        for (const [keyword, automation] of this.keywordAutomations.entries()) {
            if (automation.id === automationId) {
                this.keywordAutomations.delete(keyword);
                break;
            }
        }
    }

    async processIncomingMessage(phone, message) {
        try {
            const lowerMessage = message.toLowerCase().trim();
            
            // Buscar automatizaciones por palabra clave
            for (const [keyword, automation] of this.keywordAutomations.entries()) {
                if (lowerMessage.includes(keyword)) {
                    await this.executeAutomation(automation, { phone, triggerMessage: message });
                    break; // Solo ejecutar la primera coincidencia
                }
            }
        } catch (error) {
            console.error('❌ Error procesando mensaje para automatizaciones:', error);
        }
    }

    async executeAutomation(automation, context = {}) {
        try {
            console.log(`🤖 Ejecutando automatización: ${automation.name}`);
            
            // Evaluar condiciones si existen
            if (automation.conditions && Object.keys(automation.conditions).length > 0) {
                const conditionsMet = await this.evaluateConditions(automation.conditions, context);
                if (!conditionsMet) {
                    console.log(`⏸️ Condiciones no cumplidas para: ${automation.name}`);
                    return;
                }
            }
            
            // Determinar destinatarios
            let recipients = [];
            if (context.phone) {
                recipients = [{ phone: context.phone }];
            } else {
                // Para automatizaciones programadas, obtener todos los contactos o según condiciones
                recipients = await this.getRecipientsForAutomation(automation);
            }
            
            // Ejecutar acciones
            for (const action of automation.actions || []) {
                await this.executeAction(action, recipients, automation, context);
            }
            
            // Enviar mensaje principal
            if (automation.message_template && recipients.length > 0) {
                const processedMessage = this.processMessageTemplate(automation.message_template, context);
                
                for (const recipient of recipients) {
                    try {
                        await this.whatsappService.sendMessage(recipient.phone, processedMessage);
                        
                        // Registrar en la base de datos
                        await this.database.saveMessage({
                            phone: recipient.phone,
                            message: processedMessage,
                            type: 'sent',
                            automation_id: automation.id
                        });
                        
                        // Delay entre mensajes para evitar spam
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                    } catch (error) {
                        console.error(`❌ Error enviando mensaje a ${recipient.phone}:`, error);
                    }
                }
            }
            
            console.log(`✅ Automatización ejecutada: ${automation.name} para ${recipients.length} destinatarios`);
            
        } catch (error) {
            console.error(`❌ Error ejecutando automatización ${automation.name}:`, error);
        }
    }

    async evaluateConditions(conditions, context) {
        try {
            // Implementar lógica de evaluación de condiciones
            // Por ejemplo: tiempo desde último mensaje, tags del contacto, etc.
            
            if (conditions.min_time_since_last_message) {
                const lastMessage = await this.database.getMessages({
                    phone: context.phone,
                    limit: 1
                });
                
                if (lastMessage.length > 0) {
                    const timeDiff = Date.now() - new Date(lastMessage[0].timestamp).getTime();
                    const minTime = conditions.min_time_since_last_message * 60 * 1000; // minutos a ms
                    
                    if (timeDiff < minTime) {
                        return false;
                    }
                }
            }
            
            if (conditions.contact_has_tag && context.phone) {
                const contact = await this.database.getContact(context.phone);
                if (!contact || !contact.tags.includes(conditions.contact_has_tag)) {
                    return false;
                }
            }
            
            return true;
        } catch (error) {
            console.error('❌ Error evaluando condiciones:', error);
            return false;
        }
    }

    async getRecipientsForAutomation(automation) {
        try {
            // Obtener contactos según criterios de la automatización
            const contacts = await this.database.getContacts();
            
            // Aplicar filtros adicionales si están definidos en la automatización
            return contacts.map(contact => ({ phone: contact.phone, name: contact.name }));
        } catch (error) {
            console.error('❌ Error obteniendo destinatarios:', error);
            return [];
        }
    }

    async executeAction(action, recipients, automation, context) {
        try {
            switch (action.type) {
                case 'add_tag':
                    for (const recipient of recipients) {
                        const contact = await this.database.getContact(recipient.phone);
                        if (contact) {
                            const tags = [...new Set([...contact.tags, action.value])];
                            await this.database.saveContact({ ...contact, tags });
                        }
                    }
                    break;
                    
                case 'remove_tag':
                    for (const recipient of recipients) {
                        const contact = await this.database.getContact(recipient.phone);
                        if (contact) {
                            const tags = contact.tags.filter(tag => tag !== action.value);
                            await this.database.saveContact({ ...contact, tags });
                        }
                    }
                    break;
                    
                case 'wait':
                    await new Promise(resolve => setTimeout(resolve, action.value * 1000));
                    break;
                    
                case 'webhook':
                    // Enviar datos a webhook externo
                    // Implementar según necesidades
                    break;
            }
        } catch (error) {
            console.error('❌ Error ejecutando acción:', error);
        }
    }

    processMessageTemplate(template, context = {}) {
        let processedMessage = template;
        
        // Reemplazar variables del contexto
        Object.keys(context).forEach(key => {
            const placeholder = `{{${key}}}`;
            processedMessage = processedMessage.replace(new RegExp(placeholder, 'g'), context[key] || '');
        });
        
        // Variables generales
        processedMessage = processedMessage.replace(/{{date}}/g, new Date().toLocaleDateString());
        processedMessage = processedMessage.replace(/{{time}}/g, new Date().toLocaleTimeString());
        
        return processedMessage;
    }

    async checkScheduledAutomations() {
        // Esta función se ejecuta periódicamente para verificar automatizaciones programadas
        // Los cron jobs ya manejan esto, pero aquí se puede agregar lógica adicional
    }

    async createAutomation(automationData) {
        try {
            const automationId = await this.database.saveAutomation(automationData);
            
            if (automationData.active) {
                const automation = await this.database.getAutomation(automationId);
                await this.activateAutomation(automation);
            }
            
            return automationId;
        } catch (error) {
            console.error('❌ Error creando automatización:', error);
            throw error;
        }
    }

    async updateAutomation(automationId, automationData) {
        try {
            // Desactivar automatización actual
            await this.deactivateAutomation(automationId);
            
            // Actualizar en base de datos
            await this.database.saveAutomation({ ...automationData, id: automationId });
            
            // Reactivar si está activa
            if (automationData.active) {
                const automation = await this.database.getAutomation(automationId);
                await this.activateAutomation(automation);
            }
            
            return automationId;
        } catch (error) {
            console.error('❌ Error actualizando automatización:', error);
            throw error;
        }
    }

    async deleteAutomation(automationId) {
        try {
            await this.deactivateAutomation(automationId);
            await this.database.deleteAutomation(automationId);
        } catch (error) {
            console.error('❌ Error eliminando automatización:', error);
            throw error;
        }
    }
}

module.exports = AutomationService;
