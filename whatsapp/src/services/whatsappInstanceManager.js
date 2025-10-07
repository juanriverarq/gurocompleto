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
        
        console.log(`🏗️ [${instanceId}] Instancia creada - Estado inicial: connected=${instance.isConnected()}, connecting=${instance.isConnecting()}`);
        
        this.instances.set(instanceId, instance);
        
        // Conectar automáticamente
        console.log(`🔌 [${instanceId}] Iniciando conexión automática...`);
        await instance.connect();
        
        console.log(`🔌 [${instanceId}] Conexión completada - Estado final: connected=${instance.isConnected()}, connecting=${instance.isConnecting()}`);
        
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
}

module.exports = WhatsAppInstanceManager;
