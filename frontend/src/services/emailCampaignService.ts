import { auth } from '../config/firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';

export interface CreateEmailCampaignRequest {
  name: string;
  subject: string;
  // Si se usa contenido HTML directo
  content?: string;
  audience_type?: 'csv' | 'segment';
  csv_upload_id?: number;
  segment_filters?: any;
  throttling_per_minute?: number;
  window_start?: string;
  window_end?: string;
  timezone?: string;

  // Integración con plantillas externas (ej. SendGrid/MJT/etc.)
  // El backend debe soportar estos campos; se envían solo si están definidos.
  sendgrid_template_id?: string | number;
  template_variables?: any;
}
export interface EmailCampaign {
  id: number;
  broker_id: number;
  name: string;
  subject: string;
  content?: string | null;
  audience_type: 'csv' | 'segment';
  csv_upload_id?: number | null;
  segment_filters?: any;
  throttling_per_minute?: number | null;
  window_start?: string | null;
  window_end?: string | null;
  timezone?: string | null;
  status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  [key: string]: any;
}

const getAuthToken = async (): Promise<string | null> => {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
};

async function makeRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // 1) Token Firebase (si existe)
  const firebaseToken = await getAuthToken();

  // 2) Token Empleado (Laravel) desde localStorage
  let empleadoToken: string | null = null;
  try {
    empleadoToken = localStorage.getItem('empleado_token');
  } catch {}

  const headers = new Headers(options.headers as HeadersInit);

  if (!(options.body instanceof FormData)) {
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');
  }

  // Prioridad: Firebase > Empleado
  if (firebaseToken) {
    headers.set('Authorization', `Bearer ${firebaseToken}`);
  } else if (empleadoToken) {
    headers.set('Authorization', `Bearer ${empleadoToken}`);
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export const emailCampaignService = {
  async uploadCsv(file: File): Promise<{
    success: boolean;
    upload_id?: number;
    detected_columns?: string[];
    sample_rows?: any[];
    message?: string;
  }> {
    const form = new FormData();
    form.append('file', file);
    return makeRequest(`/saas/email-campaigns/uploads`, {
      method: 'POST',
      body: form,
    });
  },

  async createCampaign(payload: CreateEmailCampaignRequest): Promise<ApiResponse<{ id: number }>> {
    return makeRequest<ApiResponse<{ id: number }>>(`/saas/email-campaigns`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async startCampaign(id: number): Promise<ApiResponse<{ execution_id?: string | number }>> {
    return makeRequest<ApiResponse<{ execution_id?: string | number }>>(
      `/saas/email-campaigns/${id}/start`,
      {
        method: 'POST',
      },
    );
  },

  async listCampaigns(
    params: { status?: string; limit?: number; offset?: number } = {},
  ): Promise<
    ApiResponse<{ data: EmailCampaign[]; total?: number; limit?: number; offset?: number }>
  > {
    const q = new URLSearchParams();
    if (params.status) q.append('status', params.status);
    if (params.limit !== undefined) q.append('limit', String(params.limit));
    if (params.offset !== undefined) q.append('offset', String(params.offset));
    return makeRequest(`/saas/email-campaigns${q.toString() ? `?${q.toString()}` : ''}`);
  },

  async getStatus(id: number): Promise<ApiResponse<{ campaign: any; stats: any }>> {
    return makeRequest(`/saas/email-campaigns/${id}/status`);
  },

  async getRecipients(
    id: number,
    params: { status?: string; page?: number; limit?: number } = {},
  ): Promise<ApiResponse<any[]>> {
    const q = new URLSearchParams();
    if (params.status) q.append('status', params.status);
    if (params.page) q.append('page', String(params.page));
    if (params.limit) q.append('limit', String(params.limit));
    return makeRequest(
      `/saas/email-campaigns/${id}/recipients${q.toString() ? `?${q.toString()}` : ''}`,
    );
  },

  async deleteCampaign(id: number): Promise<ApiResponse> {
    return makeRequest(`/saas/email-campaigns/${id}`, {
      method: 'DELETE',
    });
  },

  async bulkDeleteCampaigns(campaignIds: number[]): Promise<ApiResponse> {
    return makeRequest(`/saas/email-campaigns/bulk-delete`, {
      method: 'POST',
      body: JSON.stringify({ campaign_ids: campaignIds }),
    });
  },
};

export default emailCampaignService;
