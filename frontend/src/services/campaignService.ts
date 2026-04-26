/**
 * Servicio para la gestión de campañas de WhatsApp integrado con Laravel
 * Maneja diferentes tipos de campañas: inmediatas, programadas, recordatorios de pólizas, etc.
 */

import { auth } from '../config/firebase';
import { API_BASE_URL } from '../config/api';

// Configuración de la API de Laravel (usar config centralizada con runtime override)
const LARAVEL_API_BASE_URL = API_BASE_URL;

// Helper para obtener el token de autenticación Firebase (igual que clienteService)
const getAuthToken = async (): Promise<string | null> => {
  try {
    console.log('🔍 [CAMPAIGN DEBUG] Getting Firebase auth token...');
    console.log('🔍 [CAMPAIGN DEBUG] auth object:', auth);
    
    const user = auth.currentUser;
    console.log('🔍 [CAMPAIGN DEBUG] Current user:', user);
    
    if (!user) {
      console.log('❌ [CAMPAIGN DEBUG] No current user found');
      return null;
    }
    
    console.log('✅ [CAMPAIGN DEBUG] User found, getting ID token...');
    const token = await user.getIdToken();
    console.log('✅ [CAMPAIGN DEBUG] Token obtained:', token ? 'YES' : 'NO');
    console.log('🔍 [CAMPAIGN DEBUG] Token preview:', token ? token.substring(0, 50) + '...' : 'null');
    
    return token;
  } catch (error) {
    console.error('❌ [CAMPAIGN DEBUG] Error getting auth token:', error);
    return null;
  }
};

// Interfaces para tipos de campañas
export interface CampaignType {
  id: string;
  name: string;
  description: string;
  template_variables?: string[];
}

export interface PolicyBasedCampaign {
  id?: number;
  name: string;
  description?: string;
  campaign_type: 'policy_reminder' | 'expired_policy' | 'about_to_expire';
  message_template: string;
  whatsapp_instance_id?: number; // ID de instancia WhatsApp asignada
  trigger_conditions: {
    policy_status?: 'active' | 'expired' | 'about_to_expire';
    days_before_expiry?: number;
    days_after_expiry?: number;
    policy_types?: string[]; // Tipos de póliza específicos
    amount_range?: {
      min?: number;
      max?: number;
    };
  };
  schedule_config: {
    execution_type: 'immediate' | 'scheduled' | 'recurring';
    scheduled_date?: string;
    recurrence?: {
      frequency: 'daily' | 'weekly' | 'monthly';
      interval: number; // cada X días/semanas/meses
      days_of_week?: number[]; // para weekly
      day_of_month?: number; // para monthly
    };
  };
  target_filters: {
    client_segments?: string[];
    regions?: string[];
    agents?: string[];
    exclude_recently_contacted?: boolean;
    exclude_days?: number; // días desde último contacto
  };
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  stats?: {
    total_targets: number;
    sent_count: number;
    delivered_count: number;
    failed_count: number;
    last_execution?: string;
    next_execution?: string;
  };
}

export interface ImmediateCampaign {
  id?: number;
  name: string;
  description?: string;
  campaign_type: 'immediate';
  message_template: string;
  whatsapp_instance_id?: number; // ID de instancia WhatsApp asignada
  // Opcional: media adjunta (actualmente soporta solo imagen)
  media_url?: string;
  media_type?: 'image';
  contacts: Array<{
    phone: string;
    name?: string;
    policy_id?: string;
    custom_data?: Record<string, any>;
  }>;
  status: 'draft' | 'sending' | 'completed' | 'cancelled';
  created_at?: string;
  updated_at?: string;
  stats?: {
    total_contacts: number;
    sent_count: number;
    delivered_count: number;
    failed_count: number;
  };
}

export interface ScheduledCampaign {
  id?: number;
  name: string;
  description?: string;
  campaign_type: 'scheduled';
  message_template: string;
  whatsapp_instance_id?: number; // ID de instancia WhatsApp asignada
  // Opcional: media adjunta (solo imagen por ahora)
  media_url?: string;
  media_type?: 'image';
  scheduled_date: string;
  contacts: Array<{
    phone: string;
    name?: string;
    policy_id?: string;
    custom_data?: Record<string, any>;
  }>;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'cancelled';
  created_at?: string;
  updated_at?: string;
  stats?: {
    total_contacts: number;
    sent_count: number;
    delivered_count: number;
    failed_count: number;
  };
}

export type Campaign = PolicyBasedCampaign | ImmediateCampaign | ScheduledCampaign;

export interface CampaignExecution {
  id: number;
  campaign_id: number;
  execution_date: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  targets_found: number;
  messages_sent: number;
  messages_delivered: number;
  messages_failed: number;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  execution_details?: Array<{
    phone: string;
    name?: string;
    policy_id?: string;
    status: 'sent' | 'delivered' | 'failed';
    message_id?: string;
    error?: string;
    sent_at?: string;
  }>;
}

export interface CampaignTemplate {
  id: number;
  name: string;
  category: 'policy_reminder' | 'expired_policy' | 'welcome' | 'follow_up' | 'custom';
  message_template: string;
  variables: string[];
  description?: string;
  is_active: boolean;
}

export interface CampaignStats {
  total_campaigns: number;
  active_campaigns: number;
  paused_campaigns: number;
  completed_campaigns: number;
  total_messages_sent: number;
  total_messages_delivered: number;
  overall_delivery_rate: number;
  campaigns_by_type: Record<string, number>;
  recent_executions: Array<{
    campaign_name: string;
    execution_date: string;
    messages_sent: number;
    delivery_rate: number;
  }>;
}

class CampaignService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = LARAVEL_API_BASE_URL;
  }


  /**
   * Realizar petición HTTP a Laravel
   */
  private async makeRequest(endpoint: string, method: string = 'GET', data?: any): Promise<any> {
    console.log('🚀 [CAMPAIGN DEBUG] makeRequest called with:', { endpoint, method, data });
    
    const url = `${this.baseUrl}${endpoint}`;
    console.log('🚀 [CAMPAIGN DEBUG] URL:', url);
    
    console.log('🚀 [CAMPAIGN DEBUG] About to call getAuthToken...');
    const token = await getAuthToken();
    console.log('🚀 [CAMPAIGN DEBUG] Token result:', token ? 'GOT TOKEN' : 'NO TOKEN');

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || 'Unknown error'}`);
      }
      
      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Campaign Service Error:', error);
      throw new Error(`Error de conexión con backend: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  // ========================
  // GESTIÓN DE CAMPAÑAS
  // ========================

  /**
   * Obtener todas las campañas
   */
  async getCampaigns(filters?: {
    type?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ success: boolean; campaigns: Campaign[]; total: number }> {
    try {
      const queryParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            queryParams.append(key, value.toString());
          }
        });
      }
      
      const endpoint = `/saas/campaigns${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await this.makeRequest(endpoint);
      
      return {
        success: true,
        campaigns: response.data || response.campaigns || [],
        total: response.total || response.campaigns?.length || 0
      };
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      return { success: false, campaigns: [], total: 0 };
    }
  }

  /**
   * Obtener una campaña específica
   */
  async getCampaign(id: number): Promise<{ success: boolean; campaign?: Campaign; message?: string }> {
    try {
      const response = await this.makeRequest(`/saas/campaigns/${id}`);
      return { success: true, campaign: response.data || response };
    } catch (error) {
      console.error('Error fetching campaign:', error);
      return { success: false, message: 'Error al obtener campaña' };
    }
  }

  /**
   * Crear campaña inmediata
   */
  async createImmediateCampaign(campaign: Omit<ImmediateCampaign, 'id' | 'created_at' | 'updated_at' | 'stats'>): Promise<{
    success: boolean;
    message: string;
    campaign?: ImmediateCampaign;
  }> {
    try {
      const response = await this.makeRequest('/saas/campaigns/immediate', 'POST', campaign);
      return {
        success: true,
        message: 'Campaña inmediata creada exitosamente',
        campaign: response.data || response
      };
    } catch (error) {
      console.error('Error creating immediate campaign:', error);
      return { success: false, message: 'Error al crear campaña inmediata' };
    }
  }

  /**
   * Crear campaña programada
   */
  async createScheduledCampaign(campaign: Omit<ScheduledCampaign, 'id' | 'created_at' | 'updated_at' | 'stats'>): Promise<{
    success: boolean;
    message: string;
    campaign?: ScheduledCampaign;
  }> {
    try {
      const response = await this.makeRequest('/saas/campaigns/scheduled', 'POST', campaign);
      return {
        success: true,
        message: 'Campaña programada creada exitosamente',
        campaign: response.data || response
      };
    } catch (error) {
      console.error('Error creating scheduled campaign:', error);
      return { success: false, message: 'Error al crear campaña programada' };
    }
  }

  /**
   * Crear campaña basada en pólizas
   */
  async createPolicyBasedCampaign(campaign: Omit<PolicyBasedCampaign, 'id' | 'created_at' | 'updated_at' | 'stats'>): Promise<{
    success: boolean;
    message: string;
    campaign?: PolicyBasedCampaign;
  }> {
    try {
      const response = await this.makeRequest('/saas/campaigns/policy-based', 'POST', campaign);
      return {
        success: true,
        message: 'Campaña de pólizas creada exitosamente',
        campaign: response.data || response
      };
    } catch (error) {
      console.error('Error creating policy-based campaign:', error);
      return { success: false, message: 'Error al crear campaña de pólizas' };
    }
  }

  /**
   * Actualizar campaña
   */
  async updateCampaign(id: number, campaign: Partial<Campaign>): Promise<{ success: boolean; message: string }> {
    try {
      await this.makeRequest(`/saas/campaigns/${id}`, 'PUT', campaign);
      return { success: true, message: 'Campaña actualizada exitosamente' };
    } catch (error) {
      console.error('Error updating campaign:', error);
      return { success: false, message: 'Error al actualizar campaña' };
    }
  }

  /**
   * Eliminar campaña
   */
  async deleteCampaign(id: number): Promise<{ success: boolean; message: string }> {
    try {
      await this.makeRequest(`/saas/campaigns/${id}`, 'DELETE');
      return { success: true, message: 'Campaña eliminada exitosamente' };
    } catch (error) {
      console.error('Error deleting campaign:', error);
      return { success: false, message: 'Error al eliminar campaña' };
    }
  }

  /**
   * Activar/pausar campaña
   */
  async toggleCampaign(id: number): Promise<{ success: boolean; message: string; is_active: boolean }> {
    try {
      const response = await this.makeRequest(`/saas/campaigns/${id}/toggle`, 'PATCH');
      return {
        success: true,
        message: response.is_active ? 'Campaña activada' : 'Campaña pausada',
        is_active: response.is_active
      };
    } catch (error) {
      console.error('Error toggling campaign:', error);
      return { success: false, message: 'Error al cambiar estado de campaña', is_active: false };
    }
  }

  /**
   * Ejecutar campaña inmediatamente (para campaña programada)
   */
  async executeCampaignNow(id: number): Promise<{ success: boolean; message: string; execution_id?: number }> {
    try {
      const response = await this.makeRequest(`/saas/campaigns/${id}/execute-now`, 'POST');
      return {
        success: true,
        message: 'Campaña ejecutada exitosamente',
        execution_id: response.execution_id
      };
    } catch (error) {
      console.error('Error executing campaign:', error);
      return { success: false, message: 'Error al ejecutar campaña' };
    }
  }
  /**
   * Detener campaña (pausar mientras está enviando)
   */
  async stopCampaign(id: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.makeRequest(`/saas/campaigns/${id}/stop`, 'POST');
      return { success: true, message: response.message || 'Campaña detenida (pausada)' };
    } catch (error) {
      console.error('Error stopping campaign:', error);
      return { success: false, message: 'Error al detener campaña' };
    }
  }

  /**
   * Cancelar campaña (marcar pendientes como fallidos y cerrar)
   */
  async cancelCampaign(id: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.makeRequest(`/saas/campaigns/${id}/cancel`, 'POST');
      return { success: true, message: response.message || 'Campaña cancelada' };
    } catch (error) {
      console.error('Error cancelling campaign:', error);
      return { success: false, message: 'Error al cancelar campaña' };
    }
  }

  /**
   * Activar/Reanudar campaña
   */
  async activateCampaign(id: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.makeRequest(`/saas/campaigns/${id}/activate`, 'POST');
      return { success: true, message: response.message || 'Campaña activada' };
    } catch (error) {
      console.error('Error activating campaign:', error);
      return { success: false, message: 'Error al activar campaña' };
    }
  }

  // ========================
  // EJECUCIONES DE CAMPAÑAS
  // ========================

  /**
   * Obtener historial de ejecuciones de una campaña
   */
  async getCampaignExecutions(campaignId: number, filters?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ success: boolean; executions: CampaignExecution[]; total: number }> {
    try {
      const queryParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            queryParams.append(key, value.toString());
          }
        });
      }
      
      const endpoint = `/saas/campaigns/${campaignId}/executions${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await this.makeRequest(endpoint);
      
      return {
        success: true,
        executions: response.data || response.executions || [],
        total: response.total || response.executions?.length || 0
      };
    } catch (error) {
      console.error('Error fetching campaign executions:', error);
      return { success: false, executions: [], total: 0 };
    }
  }

  /**
   * Obtener detalles de una ejecución específica
   */
  async getCampaignExecution(campaignId: number, executionId: number): Promise<{
    success: boolean;
    execution?: CampaignExecution;
    message?: string;
  }> {
    try {
      const response = await this.makeRequest(`/saas/campaigns/${campaignId}/executions/${executionId}`);
      return { success: true, execution: response.data || response };
    } catch (error) {
      console.error('Error fetching campaign execution:', error);
      return { success: false, message: 'Error al obtener ejecución' };
    }
  }

  // ========================
  // PLANTILLAS DE CAMPAÑAS
  // ========================

  /**
   * Obtener plantillas de campañas
   */
  async getCampaignTemplates(category?: string): Promise<{ success: boolean; templates: CampaignTemplate[] }> {
    try {
      const endpoint = `/campaign-templates${category ? `?category=${category}` : ''}`;
      const response = await this.makeRequest(endpoint);
      
      return {
        success: true,
        templates: response.data || response.templates || []
      };
    } catch (error) {
      console.error('Error fetching campaign templates:', error);
      return { success: false, templates: [] };
    }
  }

  /**
   * Crear plantilla de campaña
   */
  async createCampaignTemplate(template: Omit<CampaignTemplate, 'id'>): Promise<{
    success: boolean;
    message: string;
    template?: CampaignTemplate;
  }> {
    try {
      const response = await this.makeRequest('/campaign-templates', 'POST', template);
      return {
        success: true,
        message: 'Plantilla creada exitosamente',
        template: response.data || response
      };
    } catch (error) {
      console.error('Error creating campaign template:', error);
      return { success: false, message: 'Error al crear plantilla' };
    }
  }

  // ========================
  // ESTADÍSTICAS
  // ========================

  /**
   * Obtener estadísticas generales de campañas
   */
  async getCampaignStats(): Promise<{ success: boolean; stats?: CampaignStats; message?: string }> {
    try {
      const response = await this.makeRequest('/saas/campaigns/stats');
      return { success: true, stats: response.data || response };
    } catch (error) {
      console.error('Error fetching campaign stats:', error);
      return { success: false, message: 'Error al obtener estadísticas' };
    }
  }

  /**
   * Obtener estadísticas de una campaña específica
   */
  async getCampaignStatsById(id: number): Promise<{
    success: boolean;
    stats?: {
      total_targets: number;
      sent_count: number;
      delivered_count: number;
      failed_count: number;
      delivery_rate: number;
      last_execution?: string;
      next_execution?: string;
    };
    message?: string;
  }> {
    try {
      const response = await this.makeRequest(`/saas/campaigns/${id}/stats`);
      return { success: true, stats: response.data || response };
    } catch (error) {
      console.error('Error fetching campaign stats by id:', error);
      return { success: false, message: 'Error al obtener estadísticas de campaña' };
    }
  }

  /**
   * Recalcular estadísticas de una campaña desde campaign_messages
   */
  async recalculateStats(id: number): Promise<{ success: boolean; stats?: any; message?: string }> {
    try {
      const response = await this.makeRequest(`/saas/campaigns/${id}/recalculate-stats`, 'POST');
      return { success: true, stats: response.stats || response.data };
    } catch (error) {
      console.error('Error recalculating campaign stats:', error);
      return { success: false, message: 'Error al recalcular estadísticas' };
    }
  }

  // ========================
  // INSTANCIAS DE WHATSAPP
  // ========================

  /**
   * Obtener instancias de WhatsApp disponibles para campañas
   * Alias robusto: intenta primero /saas/whatsapp/available-instances y hace fallback a /saas/campaigns/available-whatsapp-instances
   */
  async getAvailableWhatsAppInstances(): Promise<{
    success: boolean;
    instances?: Array<{
      id: number;
      instance_id: string;
      phone_number: string;
      status: string;
      name: string;
      display_name: string;
    }>;
    total?: number;
    message?: string;
  }> {
    const tryParse = (resp: any) => {
      if (resp && resp.success && Array.isArray(resp.data)) {
        return {
          success: true,
          instances: resp.data || [],
          total: resp.total || resp.data.length || 0
        };
      }
      return null;
    };

    try {
      console.log('🔄 [WHATSAPP SERVICE] Iniciando getAvailableWhatsAppInstances...');
      
      // 1) Nuevo alias estable (evita colisión con /campaigns/{id})
      const aliasEndpoint = '/saas/whatsapp/available-instances';
      console.log('📡 [WHATSAPP SERVICE] Intentando alias:', aliasEndpoint);
      try {
        const aliasResp = await this.makeRequest(aliasEndpoint);
        console.log('📨 [WHATSAPP SERVICE] Alias response:', aliasResp);
        const parsed = tryParse(aliasResp);
        if (parsed) {
          console.log('✅ [WHATSAPP SERVICE] Alias OK. Instancias:', parsed.total);
          return parsed;
        }
        console.warn('⚠️ [WHATSAPP SERVICE] Alias no devolvió datos válidos, intentando endpoint original…');
      } catch (aliasErr) {
        console.warn('⚠️ [WHATSAPP SERVICE] Alias falló, intentando endpoint original…', aliasErr);
      }

      // 2) Endpoint original dentro de /saas/campaigns
      const fallbackEndpoint = '/saas/campaigns/available-whatsapp-instances';
      console.log('📡 [WHATSAPP SERVICE] Intentando fallback:', fallbackEndpoint);
      const resp = await this.makeRequest(fallbackEndpoint);
      console.log('📨 [WHATSAPP SERVICE] Fallback response:', resp);
      const parsedFallback = tryParse(resp);
      if (parsedFallback) {
        console.log('✅ [WHATSAPP SERVICE] Fallback OK. Instancias:', parsedFallback.total);
        return parsedFallback;
      }

      console.warn('⚠️ [WHATSAPP SERVICE] Ningún endpoint devolvió datos válidos');
      return {
        success: false,
        instances: [],
        total: 0,
        message: 'No se pudieron cargar las instancias de WhatsApp (respuesta inválida).'
      };
    } catch (error) {
      console.error('❌ [WHATSAPP SERVICE] Error fetching WhatsApp instances:', error);
      return {
        success: false,
        instances: [],
        total: 0,
        message: 'Error al obtener las instancias: ' + (error instanceof Error ? error.message : 'desconocido')
      };
    }
  }

  // ========================
  // MÉTODOS DE VALIDACIÓN
  // ========================

  /**
   * Validar configuración de campaña
   */
  validateCampaignConfig(campaign: Partial<Campaign>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!campaign.name || campaign.name.trim().length === 0) {
      errors.push('El nombre de la campaña es requerido');
    }

    if (!campaign.message_template || campaign.message_template.trim().length === 0) {
      errors.push('La plantilla de mensaje es requerida');
    }

    if (campaign.campaign_type === 'scheduled' && !campaign.scheduled_date) {
      errors.push('La fecha de programación es requerida para campañas programadas');
    }

    if (campaign.campaign_type === 'immediate' && (!campaign.contacts || campaign.contacts.length === 0)) {
      errors.push('Los contactos son requeridos para campañas inmediatas');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Previsualizar objetivos de campaña basada en pólizas
   */
  async previewPolicyTargets(filters: PolicyBasedCampaign['trigger_conditions']): Promise<{
    success: boolean;
    preview?: {
      total_targets: number;
      sample_targets: Array<{
        client_name: string;
        phone: string;
        policy_number: string;
        policy_type: string;
        expiry_date?: string;
        days_until_expiry?: number;
      }>;
    };
    message?: string;
  }> {
    try {
      const response = await this.makeRequest('/saas/campaigns/preview-targets', 'POST', filters);
      return { success: true, preview: response.data || response };
    } catch (error) {
      console.error('Error previewing policy targets:', error);
      return { success: false, message: 'Error al previsualizar objetivos' };
    }
  }

  // ========================
  // HISTORIAL DE ENVÍOS
  // ========================

  /**
   * Obtener historial de envíos de campañas (desde campaign_messages)
   */
  async getSendHistory(filters?: {
    campaign_id?: number;
    status?: string;
    phone?: string;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    success: boolean;
    messages?: Array<{
      id: number;
      campaign_id: number;
      campaign_name: string;
      campaign_type: string;
      execution_id: number;
      recipient_phone: string;
      recipient_name?: string;
      message_content: string;
      status: string;
      sent_at?: string;
      delivered_at?: string;
      read_at?: string;
      failed_at?: string;
      whatsapp_message_id?: string;
      error_message?: string;
      created_at: string;
      updated_at: string;
      delivery_time?: number;
      is_recent: boolean;
    }>;
    total?: number;
    stats?: {
      total_messages: number;
      sent_count: number;
      delivered_count: number;
      failed_count: number;
      pending_count: number;
      read_count: number;
      delivery_rate: number;
      recent_messages_24h: number;
    };
    message?: string;
  }> {
    try {
      const queryParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined) {
            queryParams.append(key, value.toString());
          }
        });
      }
      
      const endpoint = `/saas/campaigns/send-history${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await this.makeRequest(endpoint);
      
      return {
        success: true,
        messages: response.data || [],
        total: response.total || 0,
        stats: response.stats || {}
      };
    } catch (error) {
      console.error('Error fetching send history:', error);
      return { success: false, message: 'Error al obtener historial de envíos' };
    }
  }
  /**
   * Subir media (imagen) para campañas. Retorna media_url/media_type.
   */
  async uploadCampaignMedia(file: File): Promise<{ success: boolean; media_url?: string; media_type?: 'image'; message?: string; }> {
    try {
      const endpoint = `/saas/campaigns/media-upload`;
      const token = await getAuthToken();
      const form = new FormData();
      form.append('media', file);

      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(this.baseUrl + endpoint, {
        method: 'POST',
        headers,
        body: form
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok || !(json?.success)) {
        throw new Error(json?.message || 'Error al subir la imagen');
      }

      return { success: true, media_url: json.media_url, media_type: (json.media_type as 'image') || 'image' };
    } catch (error) {
      console.error('Error uploading campaign media:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Error desconocido' };
    }
  }
}

 
// Crear instancia única del servicio
const campaignService = new CampaignService();
 
export default campaignService;
