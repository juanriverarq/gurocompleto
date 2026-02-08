import api from '../config/api';

export interface AuditLog {
  id: number;
  user_id: number;
  user_type: string;
  broker_id: number;
  module: string;
  action: string;
  path: string;
  method: string;
  ip_address: string;
  user_agent: string;
  request_payload: any;
  response_status: number;
  metadata: any;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

export interface AuditLogsResponse {
  success: boolean;
  data: AuditLog[];
  pagination: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}

export interface AuditStats {
  total_actions: number;
  unique_users: number;
  period_days: number;
  actions_by_module: Array<{ module: string; total: number }>;
  actions_by_day: Array<{ date: string; total: number }>;
  top_users: Array<{
    user_id: number;
    user_type: string;
    user_name: string;
    user_email: string;
    total_actions: number;
  }>;
  top_actions: Array<{ action: string; total: number }>;
}

export interface AuditStatsResponse {
  success: boolean;
  stats: AuditStats;
}

export interface AuditLogsParams {
  page?: number;
  per_page?: number;
  user_id?: number;
  module?: string;
  action?: string;
  date_from?: string;
  date_to?: string;
}

export const getAuditLogs = async (params: AuditLogsParams = {}): Promise<AuditLogsResponse> => {
  const queryParams = new URLSearchParams();
  
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.per_page) queryParams.append('per_page', params.per_page.toString());
  if (params.user_id) queryParams.append('user_id', params.user_id.toString());
  if (params.module) queryParams.append('module', params.module);
  if (params.action) queryParams.append('action', params.action);
  if (params.date_from) queryParams.append('date_from', params.date_from);
  if (params.date_to) queryParams.append('date_to', params.date_to);
  
  const response = await api.get(`/saas/audit-logs?${queryParams.toString()}`);
  return response.data;
};

export const getAuditStats = async (days: number = 30): Promise<AuditStatsResponse> => {
  const response = await api.get(`/saas/audit/stats?days=${days}`);
  return response.data;
};

export const getUserActivity = async (userId: number) => {
  const response = await api.get(`/saas/audit/user/${userId}`);
  return response.data;
};
