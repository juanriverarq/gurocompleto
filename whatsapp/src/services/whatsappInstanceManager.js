const WhatsAppInstance = require('./whatsappInstance');

class WhatsAppInstanceManager {
    constructor(io, database) {
        this.instances = new Map(); // instanceId -> WhatsAppInstance
        this.io = io;
        this.database = database;
        console.log('📘 Administrador de instancias inicializado');
    }

    async createInstance(instanceId, settings = {}) {
        if (this.instances.has(instanceId)) {
            throw new Error(`Instancia ${instanceId} ya existe`);
        }

        console.log(`🏗️ [${instanceId}] Creando nueva instancia con settings:`, settings);
        const instance = new WhatsAppInstance(instanceId, this.io, this.database, settings);
        
        // Limpiar cualquier estado de autenticación anterior para forzar generación de QR
        console.log(`🧹 [${instanceId}] Limpiando estado de autenticación anterior...`);
        await instance.clearAuthState();
        
        console.log(`🏗️ [${instanceId}] Instancia creada - Estado inicial: connected=${instance.isConnected()}, connecting=${instance.isConnecting()}`);
        
        this.instances.set(instanceId, instance);
        
        // NO conectar automáticamente - esperar a que el usuario solicite el QR
        console.log(`⏸️  [${instanceId}] Instancia lista. Esperando solicitud de QR para conectar...`);
        
        return instance;
    }

    getInstance(instanceId) {
        return this.instances.get(instanceId);
    }

    getAllInstances() {
        return Array.from(this.instances.values());
    }

    async deleteInstance(instanceId) {
        const instance = this.instances.get(instanceId);
        if (instance) {
            await instance.disconnect();
            await instance.clearAuthState();
            this.instances.delete(instanceId);
            console.log(`🗑️ Instancia ${instanceId} eliminada`);
        }
    }

    async cleanupInactiveInstances() {
        for (let [instanceId, instance] of this.instances) {
            if (!instance.isActive()) {
                console.log(`♻️ Eliminando instancia inactiva: ${instanceId}`);
                await this.deleteInstance(instanceId);
            }
        }
    }

    /**
     * Enviar mensaje usando la primera instancia conectada disponible
     */
    async sendMessage(phone, message, options = {}) {
        // Buscar una instancia conectada
        for (let [instanceId, instance] of this.instances) {
            if (instance.isConnected()) {
                console.log(`📤 [${instanceId}] Enviando mensaje a ${phone}`);
                return await instance.sendMessage(phone, message, options);
            }
        }
        throw new Error('No hay instancias de WhatsApp conectadas');
    }

    /**
     * Obtener la primera instancia conectada
     */
    getConnectedInstance() {
        for (let [instanceId, instance] of this.instances) {
            if (instance.isConnected()) {
                return instance;
            }
        }
        return null;
    }
}

module.exports = WhatsAppInstanceManager;
