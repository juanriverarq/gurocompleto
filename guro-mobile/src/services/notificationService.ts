import api from '../config/api';

export interface PolicyNotification {
  id: number;
  policy_id: number;
  policy_number: string;
  client_name: string;
  notification_type: string;
  days_until_expiry: number;
  expiry_date: string;
  status: string;
  scheduled_at: string;
  sent_at: string | null;
  created_at: string;
}

export interface NotificationLog {
  id: number;
  policy_id: number;
  notification_type: string;
  channel: string;
  status: string;
  message: string;
  created_at: string;
}

export interface NotificationStats {
  total_sent: number;
  pending: number;
  failed: number;
  today: number;
  this_week: number;
}

export const getNotificationStats = async (): Promise<NotificationStats> => {
  const response = await api.get('/saas/policy-notifications/stats');
  return response.data.data || response.data;
};

export const getNotificationLogs = async (params?: { 
  page?: number; 
  per_page?: number;
  status?: string;
}): Promise<{ data: NotificationLog[]; total: number }> => {
  const response = await api.get('/saas/policy-notifications/logs', { params });
  return response.data;
};

export const getPendingPolicies = async (): Promise<PolicyNotification[]> => {
  const response = await api.get('/saas/policy-notifications/pending-policies');
  return response.data.data || response.data || [];
};

export const getScheduledNotifications = async (): Promise<PolicyNotification[]> => {
  const response = await api.get('/saas/policy-notifications/scheduled');
  return response.data.data || response.data || [];
};
