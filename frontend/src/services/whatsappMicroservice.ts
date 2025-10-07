/**
 * Servicio completo para el microservicio de WhatsApp (GuromensajesService)
 * Integra todas las funcionalidades del microservicio de WhatsApp usando Baileys
 */

const MICROSERVICE_BASE_URL = 'http://localhost:3000/api/v1';

// Interfaces para los tipos de datos
export interface WhatsAppConnection {
  success: boolean;
  connected: boolean;
  qrCode?: string;
}

export interface WhatsAppStats {
  success: boolean;
  stats: {
    total_contacts: number;
    total_messages: number;
    total_automations: number;
    whatsapp_connected: boolean;
    uptime: number;
  };
}

export interface Contact {
  id?: number;
  phone: string;
  name?: string;
  email?: string;
  tags?: string[];
  custom_fields?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface Message {
  id?: number;
  phone: string;
  message: string;
  type: 'sent' | 'received';
  timestamp?: string;
  status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export interface Automation {
  id?: number;
  name: string;
  trigger_type: 'keyword' | 'schedule' | 'webhook' | 'new_contact';
  trigger_value?: string;
  message_template: string;
  active: boolean;
  conditions?: Record<string, any>;
  actions?: Array<{
    type: string;
    value: string;
  }>;
  created_at?: string;
  updated_at?: string;
}

export interface BulkMessageRequest {
  contacts: Array<{ phone: string; name?: string }>;
  message: string;
  options?: Record<string, any>;
}

export interface BulkMessageResult {
  success: boolean;
  message: string;
  results: Array<{
    phone: string;
    success: boolean;
    error?: string;
    messageId?: string;
    timestamp?: string;
  }>;
}

export interface Campaign {
  id?: number;
  name: string;
  description?: string;
  message_template: string;
  contacts: Array<{
    phone: string;
    name?: string;
    custom_data?: Record<string, any>;
  }>;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'paused' | 'cancelled';
  scheduled_at?: string;
  created_at?: string;
  updated_at?: string;
  total_contacts?: number;
  sent_count?: number;
  delivered_count?: number;
  failed_count?: number;
}

export interface CampaignExecution {
  id?: number;
  campaign_id: number;
  phone: string;
  contact_name?: string;
  message_sent: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  message_id?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  error_message?: string;
  retry_count?: number;
}

export interface CampaignStats {
  total_campaigns: number;
  active_campaigns: number;
  total_messages_sent: number;
  delivery_rate: number;
  recent_campaigns: Campaign[];
}

// Nueva interface para instancias múltiples
export interface WhatsAppInstance {
  id: string;
  name: string;
  phone?: string;
  connected: boolean;
  status: 'active' | 'inactive' | 'connecting' | 'error';
  created_at: string;
  last_seen?: string;
  user?: {
    id: string;
    name: string;
    avatar?: string;
  };
  qr?: string;
  is_primary?: boolean;
}

export interface CreateInstanceRequest {
  name: string;
  description?: string;
}

export interface InstanceStats {
  total_instances: number;
  active_instances: number;
  total_messages_all_instances: number;
  instances: WhatsAppInstance[];
}

class WhatsAppMicroservice {
  private baseUrl: string;

  constructor() {
    this.baseUrl = MICROSERVICE_BASE_URL;
  }

  /**
   * Realizar petición HTTP
   */
  private async makeRequest(method: string, endpoint: string, data?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      throw new Error(`Error de conexión con microservicio: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  // ========================
  // GESTIÓN DE WHATSAPP
  // ========================

  /**
   * Obtener estado de conexión de WhatsApp
   */
  async getConnectionStatus(): Promise<WhatsAppConnection> {
    return this.makeRequest('GET', '/whatsapp/status');
  }

  /**
   * Obtener código QR para conectar WhatsApp
   */
  async getQRCode(): Promise<{ success: boolean; qrCode?: string }> {
    return this.makeRequest('GET', '/whatsapp/qr');
  }

  /**
   * Desconectar WhatsApp
   */
  async disconnect(): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('POST', '/whatsapp/disconnect');
  }

  /**
   * Reconectar WhatsApp
   */
  async reconnect(): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('POST', '/whatsapp/reconnect');
  }

  /**
   * Reset completo de conexión
   */
  async resetConnection(): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('POST', '/whatsapp/reset');
  }

  // ========================
  // GESTIÓN DE INSTANCIAS MÚLTIPLES
  // ========================

  /**
   * Obtener todas las instancias de WhatsApp
   */
  async getInstances(): Promise<{ success: boolean; instances: WhatsAppInstance[] }> {
    return this.makeRequest('GET', '/instances');
  }

  /**
   * Obtener estadísticas de todas las instancias
   */
  async getInstanceStats(): Promise<{ success: boolean; stats: InstanceStats }> {
    return this.makeRequest('GET', '/instances/stats');
  }

  /**
   * Crear nueva instancia de WhatsApp
   */
  async createInstance(data: CreateInstanceRequest): Promise<{ 
    success: boolean; 
    instanceId: string;
    message: string;
  }> {
    return this.makeRequest('POST', '/instances', data);
  }

  /**
   * Obtener información de una instancia específica
   */
  async getInstance(instanceId: string): Promise<{ success: boolean; instance: WhatsAppInstance }> {
    return this.makeRequest('GET', `/instances/${instanceId}`);
  }

  /**
   * Eliminar instancia de WhatsApp
   */
  async deleteInstance(instanceId: string): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('DELETE', `/instances/${instanceId}`);
  }

  /**
   * Obtener código QR de una instancia específica
   */
  async getInstanceQR(instanceId: string): Promise<{ success: boolean; qrCode?: string }> {
    return this.makeRequest('GET', `/instances/${instanceId}/qr`);
  }

  /**
   * Obtener estado de conexión de una instancia específica
   */
  async getInstanceStatus(instanceId: string): Promise<{
    success: boolean;
    connected: boolean;
    phone?: string;
    user?: { id: string; name: string; avatar?: string };
  }> {
    return this.makeRequest('GET', `/instances/${instanceId}/status`);
  }

  /**
   * Desconectar instancia específica
   */
  async disconnectInstance(instanceId: string): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('POST', `/instances/${instanceId}/disconnect`);
  }

  /**
   * Reconectar instancia específica
   */
  async reconnectInstance(instanceId: string): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('POST', `/instances/${instanceId}/reconnect`);
  }

  /**
   * Reset instancia específica
   */
  async resetInstance(instanceId: string): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('POST', `/instances/${instanceId}/reset`);
  }

  /**
   * Actualizar información de instancia
   */
  async updateInstance(instanceId: string, data: { name?: string; description?: string }): Promise<{ 
    success: boolean; 
    message: string 
  }> {
    return this.makeRequest('PUT', `/instances/${instanceId}`, data);
  }

  /**
   * Establecer instancia como principal
   */
  async setPrimaryInstance(instanceId: string): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('POST', `/instances/${instanceId}/set-primary`);
  }

  /**
   * Enviar mensaje desde instancia específica
   */
  async sendMessageFromInstance(
    instanceId: string, 
    phone: string, 
    message: string, 
    options?: Record<string, any>
  ): Promise<{ 
    success: boolean; 
    message: string; 
    messageId: string 
  }> {
    return this.makeRequest('POST', `/instances/${instanceId}/messages/send`, { 
      phone, 
      message, 
      options 
    });
  }

  /**
   * Enviar mensajes masivos desde instancia específica
   */
  async sendBulkMessagesFromInstance(
    instanceId: string, 
    data: BulkMessageRequest
  ): Promise<BulkMessageResult> {
    return this.makeRequest('POST', `/instances/${instanceId}/messages/send-bulk`, data);
  }

  /**
   * Obtener contactos de instancia específica
   */
  async getInstanceContacts(instanceId: string): Promise<{ success: boolean; contacts: any[] }> {
    return this.makeRequest('GET', `/instances/${instanceId}/contacts`);
  }

  /**
   * Obtener mensajes de instancia específica
   */
  async getInstanceMessages(
    instanceId: string, 
    filters?: {
      phone?: string;
      type?: 'sent' | 'received';
      from_date?: string;
      to_date?: string;
      limit?: number;
    }
  ): Promise<{ success: boolean; messages: Message[] }> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    
    const endpoint = `/instances/${instanceId}/messages${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.makeRequest('GET', endpoint);
  }

  /**
   * Obtener estadísticas de instancia específica
   */
  async getInstanceStatistics(instanceId: string): Promise<{
    success: boolean;
    stats: {
      total_contacts: number;
      total_messages: number;
      messages_sent_today: number;
      last_activity: string;
      uptime: number;
    }
  }> {
    return this.makeRequest('GET', `/instances/${instanceId}/stats`);
  }

  /**
   * Obtener información detallada de conexión
   */
  async getConnectionInfo(): Promise<{ success: boolean; info: any }> {
    return this.makeRequest('GET', '/whatsapp/connection-info');
  }

  /**
   * Obtener estadísticas del servicio
   */
  async getStats(): Promise<WhatsAppStats> {
    return this.makeRequest('GET', '/whatsapp/stats');
  }

  /**
   * Validar número de teléfono
   */
  async validatePhone(phone: string): Promise<{ success: boolean; phoneInfo: any }> {
    return this.makeRequest('POST', '/whatsapp/validate-phone', { phone });
  }

  /**
   * Configurar código de país por defecto
   */
  async setCountryCode(countryCode: string): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('POST', '/whatsapp/set-country-code', { countryCode });
  }

  /**
   * Obtener códigos de país disponibles
   */
  async getCountryCodes(): Promise<{ success: boolean; countryCodes: any[]; defaultCountryCode: string }> {
    return this.makeRequest('GET', '/whatsapp/country-codes');
  }

  // ========================
  // GESTIÓN DE CONTACTOS
  // ========================

  /**
   * Obtener lista de contactos
   */
  async getContacts(filters?: {
    phone?: string;
    name?: string;
    tag?: string;
    limit?: number;
  }): Promise<{ success: boolean; contacts: Contact[] }> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    
    const endpoint = `/contacts${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.makeRequest('GET', endpoint);
  }

  /**
   * Obtener un contacto específico
   */
  async getContact(phone: string): Promise<{ success: boolean; contact: Contact }> {
    return this.makeRequest('GET', `/contacts/${phone}`);
  }

  /**
   * Crear o actualizar un contacto
   */
  async saveContact(contactData: Omit<Contact, 'id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; contactId: number }> {
    return this.makeRequest('POST', '/contacts', contactData);
  }

  /**
   * Eliminar un contacto
   */
  async deleteContact(phone: string): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('DELETE', `/contacts/${phone}`);
  }

  /**
   * Obtener contactos desde WhatsApp
   */
  async getWhatsAppContacts(): Promise<{ success: boolean; contacts: any[] }> {
    return this.makeRequest('GET', '/whatsapp/contacts');
  }

  // ========================
  // GESTIÓN DE MENSAJES
  // ========================

  /**
   * Obtener lista de mensajes
   */
  async getMessages(filters?: {
    phone?: string;
    type?: 'sent' | 'received';
    from_date?: string;
    to_date?: string;
    limit?: number;
  }): Promise<{ success: boolean; messages: Message[] }> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    
    const endpoint = `/messages${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.makeRequest('GET', endpoint);
  }

  /**
   * Obtener conversación con un contacto
   */
  async getConversation(phone: string, limit = 50): Promise<{ success: boolean; messages: Message[] }> {
    return this.makeRequest('GET', `/messages/conversation/${phone}?limit=${limit}`);
  }

  /**
   * Enviar mensaje a un contacto
   */
  async sendMessage(phone: string, message: string, options?: Record<string, any>): Promise<{ 
    success: boolean; 
    message: string; 
    messageId: string 
  }> {
    return this.makeRequest('POST', '/messages/send', { phone, message, options });
  }

  /**
   * Enviar mensajes masivos
   */
  async sendBulkMessages(data: BulkMessageRequest): Promise<BulkMessageResult> {
    return this.makeRequest('POST', '/messages/send-bulk', data);
  }

  // ========================
  // GESTIÓN DE AUTOMATIZACIONES
  // ========================

  /**
   * Obtener lista de automatizaciones
   */
  async getAutomations(): Promise<{ success: boolean; automations: Automation[] }> {
    return this.makeRequest('GET', '/automations');
  }

  /**
   * Obtener una automatización específica
   */
  async getAutomation(id: number): Promise<{ success: boolean; automation: Automation }> {
    return this.makeRequest('GET', `/automations/${id}`);
  }

  /**
   * Crear automatización
   */
  async createAutomation(automation: Omit<Automation, 'id' | 'created_at' | 'updated_at'>): Promise<{ 
    success: boolean; 
    automationId: number 
  }> {
    return this.makeRequest('POST', '/automations', automation);
  }

  /**
   * Actualizar automatización
   */
  async updateAutomation(id: number, automation: Partial<Automation>): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('PUT', `/automations/${id}`, automation);
  }

  /**
   * Eliminar automatización
   */
  async deleteAutomation(id: number): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('DELETE', `/automations/${id}`);
  }

  /**
   * Activar/desactivar automatización
   */
  async toggleAutomation(id: number): Promise<{ success: boolean; message: string; active: boolean }> {
    return this.makeRequest('PATCH', `/automations/${id}/toggle`);
  }

  /**
   * Ejecutar automatización manualmente
   */
  async executeAutomation(id: number, data?: any): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('POST', `/automations/${id}/execute`, data);
  }

  /**
   * Webhook para automatización
   */
  async triggerAutomationWebhook(id: number, data: any): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('POST', `/automations/webhook/${id}`, data);
  }

  // ========================
  // GESTIÓN DE CAMPAÑAS
  // ========================

  /**
   * Obtener lista de campañas
   */
  async getCampaigns(filters?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ success: boolean; campaigns: Campaign[]; total: number }> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    
    const endpoint = `/campaigns${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.makeRequest('GET', endpoint);
  }

  /**
   * Obtener una campaña específica
   */
  async getCampaign(id: number): Promise<{ success: boolean; campaign: Campaign }> {
    return this.makeRequest('GET', `/campaigns/${id}`);
  }

  /**
   * Crear nueva campaña
   */
  async createCampaign(campaign: Omit<Campaign, 'id' | 'created_at' | 'updated_at' | 'sent_count' | 'delivered_count' | 'failed_count'>): Promise<{ 
    success: boolean; 
    campaignId: number;
    message: string;
  }> {
    return this.makeRequest('POST', '/campaigns', campaign);
  }

  /**
   * Actualizar campaña
   */
  async updateCampaign(id: number, campaign: Partial<Campaign>): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('PUT', `/campaigns/${id}`, campaign);
  }

  /**
   * Eliminar campaña
   */
  async deleteCampaign(id: number): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('DELETE', `/campaigns/${id}`);
  }

  /**
   * Ejecutar campaña inmediatamente
   */
  async executeCampaign(id: number): Promise<{ success: boolean; message: string; executionId: number }> {
    return this.makeRequest('POST', `/campaigns/${id}/execute`);
  }

  /**
   * Pausar campaña en ejecución
   */
  async pauseCampaign(id: number): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('POST', `/campaigns/${id}/pause`);
  }

  /**
   * Reanudar campaña pausada
   */
  async resumeCampaign(id: number): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('POST', `/campaigns/${id}/resume`);
  }

  /**
   * Cancelar campaña
   */
  async cancelCampaign(id: number): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('POST', `/campaigns/${id}/cancel`);
  }

  /**
   * Obtener estadísticas de una campaña
   */
  async getCampaignStats(id: number): Promise<{ 
    success: boolean; 
    stats: {
      total_contacts: number;
      sent_count: number;
      delivered_count: number;
      failed_count: number;
      pending_count: number;
      delivery_rate: number;
    }
  }> {
    return this.makeRequest('GET', `/campaigns/${id}/stats`);
  }

  /**
   * Obtener historial de ejecución de una campaña
   */
  async getCampaignExecutions(id: number, filters?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ success: boolean; executions: CampaignExecution[]; total: number }> {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }
    
    const endpoint = `/campaigns/${id}/executions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.makeRequest('GET', endpoint);
  }

  /**
   * Reenviar mensaje fallido de campaña
   */
  async retryCampaignExecution(campaignId: number, executionId: number): Promise<{ success: boolean; message: string }> {
    return this.makeRequest('POST', `/campaigns/${campaignId}/executions/${executionId}/retry`);
  }

  /**
   * Obtener estadísticas generales de campañas
   */
  async getCampaignStatsOverview(): Promise<{ success: boolean; stats: CampaignStats }> {
    return this.makeRequest('GET', '/campaigns/stats/overview');
  }

  // ========================
  // MÉTODOS DE UTILIDAD
  // ========================

  /**
   * Verificar si el microservicio está disponible
   */
  async isServiceAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:3000/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtener información de salud del servicio
   */
  async getHealthCheck(): Promise<{
    status: string;
    timestamp: string;
    whatsapp: boolean;
    uptime: number;
  }> {
    const response = await fetch(`http://localhost:3000/health`);
    return response.json();
  }

  /**
   * Formatear número de teléfono para WhatsApp
   */
  formatPhoneNumber(phone: string, countryCode = '57'): string {
    // Remover caracteres no numéricos
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Si no empieza con código de país, agregarlo
    if (!cleanPhone.startsWith(countryCode)) {
      cleanPhone = countryCode + cleanPhone;
    }
    
    return cleanPhone + '@s.whatsapp.net';
  }

  /**
   * Validar formato de mensaje
   */
  validateMessage(message: string): { isValid: boolean; error?: string } {
    if (!message || message.trim().length === 0) {
      return { isValid: false, error: 'El mensaje no puede estar vacío' };
    }
    
    if (message.length > 4096) {
      return { isValid: false, error: 'El mensaje es demasiado largo (máximo 4096 caracteres)' };
    }
    
    return { isValid: true };
  }

  /**
   * Validar datos de contacto
   */
  validateContact(contact: Partial<Contact>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!contact.phone) {
      errors.push('El teléfono es requerido');
    } else if (!/^\d{10,15}$/.test(contact.phone.replace(/\D/g, ''))) {
      errors.push('El formato del teléfono no es válido');
    }
    
    if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
      errors.push('El formato del email no es válido');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Crear instancia única del servicio
const whatsappMicroservice = new WhatsAppMicroservice();

export default whatsappMicroservice;
