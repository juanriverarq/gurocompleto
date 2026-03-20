import api from '../config/api';

export interface PolicyNotificationConfig {
  id?: number;
  broker_id: number;
  whatsapp_instance_id: number | null;
  is_active: boolean;
  name: string;
  description?: string;
  
  // Tipos de notificaciones
  notify_expiration: boolean;
  notify_renewal: boolean;
  notify_payment_due: boolean;
  
  // Días de anticipación (legacy - mantener compatibilidad)
  expiration_days_before: number;
  renewal_days_before: number;
  payment_days_before: number;
  
  // Días de anticipación múltiples (nuevo)
  expiration_days_before_multiple?: number[];
  renewal_days_before_multiple?: number[];
  payment_days_before_multiple?: number[];
  
  // Plantillas
  expiration_template?: string;
  renewal_template?: string;
  payment_template?: string;
  
  // Horario
  send_time: string;
  send_days: number[];
  
  // Exclusiones
  excluded_client_ids: number[];
  excluded_policy_types: string[];
  excluded_policy_statuses: string[];
  
  // Configuración avanzada
  send_to_client_phone: boolean;
  send_to_client_mobile: boolean;
  send_to_assigned_user: boolean;
  max_notifications_per_day: number;
  skip_weekends: boolean;
  skip_holidays: boolean;
  
  // Estadísticas
  total_sent?: number;
  total_failed?: number;
  last_execution_at?: string;
  next_execution_at?: string;
  
  // Relaciones
  whatsapp_instance?: any;
  whatsapp_status?: WhatsAppStatus;
  stats?: NotificationStats;
}

export interface WhatsAppStatus {
  connected: boolean;
  status: string;
  instance_id?: string;
  phone_number?: string;
  message: string;
}

export interface NotificationStats {
  total_sent: number;
  total_failed: number;
  last_30_days: {
    total: number;
    sent: number;
    failed: number;
    skipped: number;
  };
  success_rate: number;
  last_execution?: string;
  last_execution_at?: string;
  last_execution_formatted?: string;
  next_execution?: string;
  next_execution_at?: string;
  next_execution_formatted?: string;
  send_time?: string;
  send_days?: number[];
}

export interface PolicyNotificationLog {
  id: number;
  broker_id: number;
  policy_notification_config_id: number;
  poliza_id: number;
  client_id: number;
  whatsapp_instance_id: number;
  notification_type: 'expiration' | 'renewal' | 'payment_due';
  recipient_phone: string;
  message_sent: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  whatsapp_message_id?: string;
  error_message?: string;
  sent_at?: string;
  failed_at?: string;
  policy_data?: any;
  metadata?: any;
  created_at: string;
  updated_at: string;
  
  // Relaciones
  poliza?: any;
  client?: any;
  whatsapp_instance?: any;
}

export interface PendingPolicies {
  expiration: any[];
  renewal: any[];
  payment_due: any[];
}

export interface ScheduledNotification {
  policy_id: number;
  policy_number: string;
  client_name: string;
  notification_type: 'expiration' | 'renewal' | 'payment_due';
  notification_type_label: string;
  event_date: string | null;
  days_until_event: number | null;
  days_before_reminder: number;
  scheduled_send_at: string;
  scheduled_send_at_human: string;
}

class PolicyNotificationService {
  /**
   * Obtener configuración de notificaciones
   */
  async getConfig(): Promise<PolicyNotificationConfig> {
    const response = await api.get('/saas/policy-notifications/config');
    return response.data.data;
  }

  /**
   * Actualizar configuración de notificaciones
   */
  async updateConfig(config: Partial<PolicyNotificationConfig>): Promise<PolicyNotificationConfig> {
    const response = await api.put('/saas/policy-notifications/config', config);
    return response.data.data;
  }

  /**
   * Obtener historial de notificaciones
   */
  async getLogs(params?: {
    status?: string;
    notification_type?: string;
    poliza_id?: number;
    date_from?: string;
    date_to?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    data: PolicyNotificationLog[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const response = await api.get('/saas/policy-notifications/logs', { params });
    return response.data;
  }

  /**
   * Obtener estadísticas de notificaciones
   */
  async getStats(): Promise<{
    total_sent: number;
    total_failed: number;
    success_rate: number;
    by_type: any[];
    recent_activity: any[];
    whatsapp_status: WhatsAppStatus;
  }> {
    const response = await api.get('/saas/policy-notifications/stats');
    return response.data.data;
  }

  /**
   * Obtener pólizas pendientes de notificación
   */
  async getPendingPolicies(): Promise<PendingPolicies> {
    const response = await api.get('/saas/policy-notifications/pending-policies');
    return response.data.data;
  }

  /**
   * Obtener notificaciones programadas con detalle
   */
  async getScheduledNotifications(limit?: number): Promise<{
    data: ScheduledNotification[];
    total: number;
    next_execution: string | null;
    next_execution_formatted: string | null;
    next_execution_human: string | null;
    send_time: string;
    send_days: number[];
    send_days_labels: string[];
  }> {
    const response = await api.get('/saas/policy-notifications/scheduled', {
      params: { limit: limit || 50 }
    });
    return response.data;
  }

  /**
   * Omitir una notificación específica
   */
  async skipNotification(data: {
    poliza_id: number;
    notification_type: 'expiration' | 'renewal' | 'payment_due';
    reason?: string;
  }): Promise<{
    log_id: number;
    poliza_id: number;
    notification_type: string;
  }> {
    const response = await api.post('/saas/policy-notifications/skip', data);
    return response.data.data;
  }

  /**
   * Probar envío de notificación
   */
  async testNotification(data: {
    poliza_id: number;
    notification_type: 'expiration' | 'renewal' | 'payment_due';
    phone: string;
  }): Promise<{
    message_sent: string;
    whatsapp_message_id: string;
  }> {
    const response = await api.post('/saas/policy-notifications/test', data);
    return response.data.data;
  }

  /**
   * Obtener plantilla por defecto según tipo
   */
  getDefaultTemplate(type: 'expiration' | 'renewal' | 'payment_due'): string {
    const templates = {
      expiration: 'Hola {{client_name}}, te recordamos que tu póliza {{policy_number}} de {{insurance_company}} vence el {{end_date}}. Contáctanos para renovarla.',
      renewal: 'Hola {{client_name}}, es momento de renovar tu póliza {{policy_number}}. La fecha de renovación es {{renewal_date}}. ¿Te gustaría que te ayudemos?',
      payment_due: 'Hola {{client_name}}, te recordamos que el pago de tu póliza {{policy_number}} vence el {{payment_due_date}}. Monto: ${{premium_amount}}.',
    };

    return templates[type];
  }

  /**
   * Obtener variables disponibles para plantillas
   */
  getAvailableVariables(): { name: string; description: string }[] {
    return [
      { name: '{{client_name}}', description: 'Nombre completo del cliente' },
      { name: '{{policy_number}}', description: 'Número de póliza' },
      { name: '{{insurance_company}}', description: 'Compañía aseguradora' },
      { name: '{{product_name}}', description: 'Nombre del producto' },
      { name: '{{ramo_name}}', description: 'Ramo de la póliza' },
      { name: '{{riesgo}}', description: 'Riesgo / Objeto asegurado ({{6}} en plantilla)' },
      { name: '{{end_date}}', description: 'Fecha de vencimiento (formato dd/mm/yyyy)' },
      { name: '{{renewal_date}}', description: 'Fecha de renovación (formato dd/mm/yyyy)' },
      { name: '{{payment_due_date}}', description: 'Fecha de vencimiento de pago (formato dd/mm/yyyy)' },
      { name: '{{premium_amount}}', description: 'Monto de la prima (formateado)' },
      { name: '{{total_amount}}', description: 'Monto total (formateado)' },
      { name: '{{days_until_expiration}}', description: 'Días hasta el vencimiento' },
      { name: '{{days_until_renewal}}', description: 'Días hasta la renovación' },
      { name: '{{days_until_payment}}', description: 'Días hasta el vencimiento del pago' },
    ];
  }

  /**
   * Validar configuración antes de guardar
   */
  validateConfig(config: Partial<PolicyNotificationConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.is_active && !config.whatsapp_instance_id) {
      errors.push('Debes seleccionar una instancia de WhatsApp para activar las notificaciones');
    }

    if (config.expiration_days_before && (config.expiration_days_before < 1 || config.expiration_days_before > 365)) {
      errors.push('Los días de anticipación para vencimiento deben estar entre 1 y 365');
    }

    if (config.renewal_days_before && (config.renewal_days_before < 1 || config.renewal_days_before > 365)) {
      errors.push('Los días de anticipación para renovación deben estar entre 1 y 365');
    }

    if (config.payment_days_before && (config.payment_days_before < 1 || config.payment_days_before > 90)) {
      errors.push('Los días de anticipación para pago deben estar entre 1 y 90');
    }

    if (config.max_notifications_per_day && (config.max_notifications_per_day < 1 || config.max_notifications_per_day > 1000)) {
      errors.push('El máximo de notificaciones por día debe estar entre 1 y 1000');
    }

    if (!config.send_to_client_phone && !config.send_to_client_mobile) {
      errors.push('Debes seleccionar al menos un tipo de teléfono para enviar notificaciones');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Formatear tipo de notificación para mostrar
   */
  formatNotificationType(type: string): string {
    const types: Record<string, string> = {
      expiration: 'Vencimiento',
      renewal: 'Renovación',
      payment_due: 'Pago Pendiente',
    };

    return types[type] || type;
  }

  /**
   * Formatear estado de notificación para mostrar
   */
  formatNotificationStatus(status: string): string {
    const statuses: Record<string, string> = {
      pending: 'Pendiente',
      sent: 'Enviado',
      failed: 'Fallido',
      skipped: 'Omitido',
    };

    return statuses[status] || status;
  }

  /**
   * Obtener color según estado
   */
  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      pending: 'warning',
      sent: 'success',
      failed: 'error',
      skipped: 'default',
    };

    return colors[status] || 'default';
  }

  /**
   * Obtener icono según tipo de notificación
   */
  getNotificationTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      expiration: 'IconAlertCircle',
      renewal: 'IconRefresh',
      payment_due: 'IconCurrencyDollar',
    };

    return icons[type] || 'IconBell';
  }
}

export default new PolicyNotificationService();