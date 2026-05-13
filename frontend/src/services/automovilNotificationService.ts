import api from '../config/api';

export interface AutomovilNotificationConfig {
  id?: number;
  broker_id: number;
  whatsapp_instance_id?: number | null;
  notify_soat: boolean;
  notify_tecnomecanica: boolean;
  soat_days_before: number;
  soat_days_before_multiple?: number[];
  tecnomecanica_days_before: number;
  tecnomecanica_days_before_multiple?: number[];
  send_time: string;
  send_days: number[];
  max_notifications_per_day: number;
  excluded_client_ids: number[];
  excluded_automovil_ids: number[];
  excluded_clase_vehiculo_ids: number[];
  soat_template?: string | null;
  tecnomecanica_template?: string | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
  whatsapp_instance?: {
    id: number;
    instance_id: string;
    phone_number?: string;
    status: string;
  };
  stats?: {
    total_sent?: number;
    total_failed?: number;
    total_skipped?: number;
    soat_sent?: number;
    soat_failed?: number;
    soat_skipped?: number;
    tecnomecanica_sent?: number;
    tecnomecanica_failed?: number;
    tecnomecanica_skipped?: number;
  };
}

export interface AutomovilNotificationLog {
  id: number;
  broker_id: number;
  automovil_id: number;
  notification_type: 'soat' | 'tecnomecanica';
  scheduled_date: string;
  sent_at?: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  error_message?: string;
  whatsapp_message_id?: string;
  delivered_at?: string | null;
  read_at?: string | null;
  delivery_failed_at?: string | null;
  delivery_error?: string | null;
  failed_at?: string | null;
  created_at: string;
  updated_at: string;
  automovil?: {
    id: number;
    placa: string;
    marca: string;
    linea: string;
    modelo: string;
    color: string;
    cliente?: {
      id: number;
      nombre: string;
      documento: string;
      celular?: string;
    };
  };
}

export interface ScheduledAutomovilNotification {
  automovil_id: number;
  placa: string;
  marca: string;
  linea: string;
  modelo: string;
  color: string;
  cliente?: {
    id: number;
    nombre: string;
    documento: string;
    celular?: string;
  };
  notification_type: 'soat' | 'tecnomecanica';
  scheduled_date: string;
  days_until: number;
  template_name?: string;
}

class AutomovilNotificationService {
  // Mapea la respuesta del backend (rtm_*, is_active) a los nombres usados por el frontend (tecnomecanica_*, active)
  private mapFromBackend(data: any): AutomovilNotificationConfig {
    if (!data) return data;
    return {
      ...data,
      active: data.is_active ?? data.active ?? false,
      notify_tecnomecanica: data.notify_rtm ?? data.notify_tecnomecanica ?? false,
      tecnomecanica_days_before: data.rtm_days_before ?? data.tecnomecanica_days_before ?? 30,
      tecnomecanica_days_before_multiple:
        data.rtm_days_before_multiple ?? data.tecnomecanica_days_before_multiple ?? null,
      tecnomecanica_template: data.rtm_template ?? data.tecnomecanica_template ?? null,
    };
  }

  // Mapea el payload del frontend (tecnomecanica_*, active) a los nombres que espera el backend (rtm_*, is_active)
  private mapToBackend(config: AutomovilNotificationConfig): any {
    const payload: any = { ...config };
    if (config.active !== undefined) payload.is_active = config.active;
    if (config.notify_tecnomecanica !== undefined) payload.notify_rtm = config.notify_tecnomecanica;
    if (config.tecnomecanica_days_before !== undefined) payload.rtm_days_before = config.tecnomecanica_days_before;
    if (config.tecnomecanica_days_before_multiple !== undefined) {
      payload.rtm_days_before_multiple = config.tecnomecanica_days_before_multiple;
    }
    if (config.tecnomecanica_template !== undefined) payload.rtm_template = config.tecnomecanica_template;
    // Eliminar claves que el backend no reconoce para evitar confusión
    delete payload.notify_tecnomecanica;
    delete payload.tecnomecanica_days_before;
    delete payload.tecnomecanica_days_before_multiple;
    delete payload.tecnomecanica_template;
    return payload;
  }

  async getConfig(): Promise<AutomovilNotificationConfig | null> {
    try {
      const response = await api.get('/saas/automovil-notifications/config');
      return this.mapFromBackend(response.data.data);
    } catch (error) {
      console.error('Error getting automovil notification config:', error);
      return null;
    }
  }

  async updateConfig(config: AutomovilNotificationConfig): Promise<AutomovilNotificationConfig> {
    const response = await api.put('/saas/automovil-notifications/config', this.mapToBackend(config));
    return this.mapFromBackend(response.data.data);
  }

  async getStats(): Promise<any> {
    try {
      const response = await api.get('/saas/automovil-notifications/stats');
      return response.data.data;
    } catch (error) {
      console.error('Error getting automovil notification stats:', error);
      return null;
    }
  }

  async getScheduledNotifications(type?: string): Promise<ScheduledAutomovilNotification[]> {
    try {
      const url = type ? `/saas/automovil-notifications/scheduled?type=${type}` : '/saas/automovil-notifications/scheduled';
      const response = await api.get(url);
      return response.data.data;
    } catch (error) {
      console.error('Error getting scheduled automovil notifications:', error);
      return [];
    }
  }

  async getLogs(params?: {
    page?: number;
    limit?: number;
    status?: string;
    notification_type?: string;
    search?: string;
  }): Promise<{
    data: AutomovilNotificationLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const response = await api.get('/saas/automovil-notifications/logs', { params });
      return response.data;
    } catch (error) {
      console.error('Error getting automovil notification logs:', error);
      return { data: [], total: 0, page: 1, limit: 20 };
    }
  }

  async skipNotification(automovilId: number, notificationType: string): Promise<void> {
    await api.post(`/saas/automovil-notifications/skip/${automovilId}`, {
      notification_type: notificationType
    });
  }

  async getWhatsAppTemplates(instanceId?: number | null): Promise<any[]> {
    try {
      const params = instanceId ? { instance_id: instanceId } : {};
      const response = await api.get('/saas/automovil-notifications/whatsapp-templates', { params });
      return response.data.data || [];
    } catch (error) {
      console.error('Error getting WhatsApp templates:', error);
      return [];
    }
  }

  async testNotification(automovilId: number, notificationType: string): Promise<void> {
    await api.post(`/saas/automovil-notifications/test/${automovilId}`, {
      notification_type: notificationType
    });
  }

  async getPendingNotifications(params?: {
    type?: string;
    limit?: number;
  }): Promise<any[]> {
    try {
      const response = await api.get('/saas/automovil-notifications/pending', { params });
      return response.data.data;
    } catch (error) {
      console.error('Error getting pending notifications:', error);
      return [];
    }
  }

  async validateTemplate(templateId: number, notificationType: string): Promise<{
    valid: boolean;
    errors?: string[];
  }> {
    try {
      const response = await api.post('/saas/automovil-notifications/validate-template', {
        template_id: templateId,
        notification_type: notificationType
      });
      return response.data;
    } catch (error) {
      console.error('Error validating template:', error);
      return { valid: false, errors: ['Error validating template'] };
    }
  }
}

export const automovilNotificationService = new AutomovilNotificationService();
export default automovilNotificationService;
