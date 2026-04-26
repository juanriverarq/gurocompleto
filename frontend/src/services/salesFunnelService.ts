import api, { API_BASE_URL } from '../config/api';

const hasAuthToken = () => {
  const token = localStorage.getItem('firebase_token') || localStorage.getItem('saas_token');
  return !!token;
};

async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...(init || {}), headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

// Interfaces
export interface SalesFunnelLead {
  id: number;
  broker_id: number;
  assigned_agent_id?: number;
  created_by: number;
  client_id?: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  secondary_phone?: string;
  document_type?: string;
  document_number?: string;
  company_name?: string;
  company_size?: string;
  industry?: string;
  position?: string;
  city?: string;
  department?: string;
  address?: string;
  stage: string;
  lead_source: string;
  insurance_type: string;
  potential_value: number;
  close_probability: number;
  expected_close_date?: string;
  first_contact_at?: string;
  last_contact_at?: string;
  next_follow_up_at?: string;
  stage_changed_at?: string;
  closed_at?: string;
  preferred_contact_method: string;
  preferred_contact_time?: string;
  contact_history?: ContactRecord[];
  notes?: string;
  qualifying_notes?: string;
  presentation_notes?: string;
  negotiation_notes?: string;
  closing_notes?: string;
  lost_reason?: string;
  insurance_details?: any;
  custom_fields?: any;
  activity_log?: ActivityRecord[];
  lead_score: number;
  quality_rating: string;
  days_in_current_stage: number;
  total_days_in_funnel: number;
  final_value?: number;
  policy_number?: string;
  created_at: string;
  updated_at: string;
  
  // Relaciones
  assigned_agent?: Agent;
  creator?: Agent;
  client?: Client;
  
  // Accessors calculados
  full_name?: string;
  stage_name?: string;
  lead_source_name?: string;
  insurance_type_name?: string;
  quality_rating_name?: string;
  contact_method_name?: string;
  contact_time_name?: string;
  company_size_name?: string;
  is_active?: boolean;
  is_closed?: boolean;
  is_won?: boolean;
  is_lost?: boolean;
  weighted_value?: number;
  days_in_funnel?: number;
  days_since_last_contact?: number;
  is_overdue_follow_up?: boolean;
  stage_progress_percentage?: number;
  business_state?: string;
}

export interface ContactRecord {
  datetime: string;
  method: string;
  notes?: string;
  details?: any;
  user_id: number;
}

export interface ActivityRecord {
  timestamp: string;
  activity: string;
  data: any;
  user_id: number;
}

export interface Agent {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

export interface Client {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
}

export interface SalesFunnelFilters {
  stage?: string;
  insurance_type?: string;
  lead_source?: string;
  quality_rating?: string;
  assigned_agent_id?: number;
  search?: string;
  potential_value_min?: number;
  potential_value_max?: number;
  close_probability_min?: number;
  expected_close_date_from?: string;
  expected_close_date_to?: string;
  created_from?: string;
  created_to?: string;
  active_only?: boolean;
  needing_follow_up?: boolean;
  high_value?: boolean;
  high_probability?: boolean;
  stale_leads?: boolean;
  expected_to_close_soon?: boolean;
  per_page?: number;
  page?: number;
}

export interface SalesFunnelStatistics {
  total_leads: number;
  active_leads: number;
  closed_won: number;
  closed_lost: number;
  needing_follow_up: number;
  high_value: number;
  high_probability: number;
  stale_leads: number;
  expected_to_close_soon: number;
  total_potential_value: number;
  total_weighted_value: number;
  conversion_rate_30d: number;
  average_days_to_close: number;
  by_stage: Record<string, number>;
  by_insurance_type: Record<string, number>;
  by_lead_source: Record<string, number>;
  by_quality: Record<string, number>;
}

export interface NeedingAttentionData {
  needing_follow_up: SalesFunnelLead[];
  stale_leads: SalesFunnelLead[];
  expected_to_close_soon: SalesFunnelLead[];
}

export interface SalesFunnelConstants {
  stages: Record<string, string>;
  lead_sources: Record<string, string>;
  insurance_types: Record<string, string>;
  quality_ratings: Record<string, string>;
  contact_methods: Record<string, string>;
  contact_times: Record<string, string>;
  company_sizes: Record<string, string>;
}

export interface CreateLeadData {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  secondary_phone?: string;
  document_type?: string;
  document_number?: string;
  company_name?: string;
  company_size?: string;
  industry?: string;
  position?: string;
  city?: string;
  department?: string;
  address?: string;
  stage: string;
  lead_source: string;
  insurance_type: string;
  potential_value: number;
  close_probability: number;
  expected_close_date?: string;
  assigned_agent_id?: number;
  client_id?: number;
  preferred_contact_method: string;
  preferred_contact_time?: string;
  notes?: string;
  insurance_details?: any;
  custom_fields?: any;
  quality_rating: string;
  lead_score?: number;
  next_follow_up_at?: string;
  referrer_type?: 'vendedor' | 'otro' | '';
  referrer_vendedor_id?: number | string;
  referrer_name?: string;
}

export interface UpdateLeadData extends Partial<CreateLeadData> {
  qualifying_notes?: string;
  presentation_notes?: string;
  negotiation_notes?: string;
  business_state?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

export interface ApiResponse<T> {
  success?: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// Constantes
export const STAGES = {
  'lead': 'Lead',
  'contacted': 'Contactado',
  'qualified': 'Calificado',
  'presentation': 'Cotización',
  'proposal': 'Asesoría',
  'negotiation': 'Seguimiento',
  'closed_won': 'Cerrado Ganado',
  'closed_lost': 'Cerrado Perdido'
} as const;

export const LEAD_SOURCES = {
  'website': 'Sitio Web',
  'social_media': 'Redes Sociales',
  'google_ads': 'Google Ads',
  'facebook_ads': 'Facebook Ads',
  'referral': 'Referido',
  'cold_call': 'Llamada Fría',
  'email_campaign': 'Campaña Email',
  'trade_show': 'Feria Comercial',
  'partner': 'Socio Comercial',
  'other': 'Otro'
} as const;

export const INSURANCE_TYPES = {
  'auto': 'Vehículos',
  'home': 'Hogar',
  'life': 'Vida',
  'health': 'Salud',
  'business': 'Empresarial',
  'travel': 'Viajes',
  'motorcycle': 'Motocicleta',
  'bicycle': 'Bicicleta',
  'pet': 'Mascotas',
  'multiple': 'Múltiples Seguros'
} as const;

export const QUALITY_RATINGS = {
  'hot': 'Caliente',
  'warm': 'Tibio',
  'cold': 'Frío'
} as const;

export const CONTACT_METHODS = {
  'phone': 'Teléfono',
  'email': 'Email',
  'whatsapp': 'WhatsApp',
  'in_person': 'Presencial'
} as const;

export const CONTACT_TIMES = {
  'morning': 'Mañana',
  'afternoon': 'Tarde',
  'evening': 'Noche'
} as const;

export const COMPANY_SIZES = {
  'small': 'Pequeña (1-50)',
  'medium': 'Mediana (51-200)',
  'large': 'Grande (200+)'
} as const;

// Utilidades
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const getStageColor = (stage: string): string => {
  const colors = {
    'lead': 'bg-gray-100 text-gray-800',
    'contacted': 'bg-blue-100 text-blue-800',
    'qualified': 'bg-indigo-100 text-indigo-800',
    'presentation': 'bg-purple-100 text-purple-800',
    'proposal': 'bg-yellow-100 text-yellow-800',
    'negotiation': 'bg-orange-100 text-orange-800',
    'closed_won': 'bg-green-100 text-green-800',
    'closed_lost': 'bg-red-100 text-red-800'
  };
  return colors[stage as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

export const getQualityColor = (quality: string): string => {
  const colors = {
    'hot': 'bg-red-100 text-red-800',
    'warm': 'bg-yellow-100 text-yellow-800',
    'cold': 'bg-blue-100 text-blue-800'
  };
  return colors[quality as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};

export const getPriorityColor = (score: number): string => {
  if (score >= 80) return 'text-red-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-blue-600';
  return 'text-gray-600';
};

export const getProgressColor = (probability: number): string => {
  if (probability >= 80) return 'bg-green-500';
  if (probability >= 60) return 'bg-yellow-500';
  if (probability >= 40) return 'bg-orange-500';
  return 'bg-red-500';
};

// Headers manejados por interceptores de api (Firebase token)

// Clase del servicio
class SalesFunnelService {
  private baseUrl = `${API_BASE_URL}/saas/sales-funnel`;

  // CRUD Operations
  async getLeads(filters: SalesFunnelFilters = {}): Promise<PaginatedResponse<SalesFunnelLead>> {
    try {
      // Intento principal: endpoint protegido con token
      const response = await api.get(`${this.baseUrl}`, { params: filters });
      return response.data;
    } catch (e: any) {
      // Si falla por autenticación o 404, intentar ruta de test
      if (e.response?.status === 401 || e.response?.status === 404 || !hasAuthToken()) {
        const usp = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== null) usp.append(k, String(v)); });
        const url = `${API_BASE_URL}/test/sales-funnel?${usp.toString()}`;
        return await fetchJson<PaginatedResponse<SalesFunnelLead>>(url);
      }
      throw e;
    }
  }

  async getLead(id: number): Promise<SalesFunnelLead> {
    const response = await api.get(`${this.baseUrl}/${id}`);
    return response.data;
  }

  async createLead(data: CreateLeadData): Promise<ApiResponse<SalesFunnelLead>> {
    const response = await api.post(this.baseUrl, data);
    return response.data;
  }

  async updateLead(id: number, data: UpdateLeadData): Promise<ApiResponse<SalesFunnelLead>> {
    const response = await api.put(`${this.baseUrl}/${id}`, data);
    return response.data;
  }

  async deleteLead(id: number, reason?: string): Promise<ApiResponse<null>> {
    const response = await api.delete(`${this.baseUrl}/${id}`, { data: { deletion_reason: reason } });
    return response.data;
  }

  // Statistics
  async getStatistics(): Promise<SalesFunnelStatistics> {
    try {
      const response = await api.get(`${this.baseUrl}/statistics`);
      return response.data;
    } catch (e: any) {
      // Fallback a ruta de test si falla
      if (e.response?.status === 401 || e.response?.status === 404 || !hasAuthToken()) {
        const url = `${API_BASE_URL}/test/sales-funnel/statistics`;
        return await fetchJson<SalesFunnelStatistics>(url);
      }
      throw e;
    }
  }

  // Attention needed
  async getNeedingAttention(): Promise<NeedingAttentionData> {
    const response = await api.get(`${this.baseUrl}/needing-attention`);
    return response.data;
  }

  // Constants
  async getConstants(): Promise<SalesFunnelConstants> {
    const response = await api.get(`${this.baseUrl}/constants`);
    return response.data;
  }

  // Agents
  async getAvailableAgents(): Promise<Agent[]> {
    try {
      const response = await api.get(`${this.baseUrl}/agents`);
      return response.data;
    } catch (e: any) {
      // Fallback a ruta de test si falla
      if (e.response?.status === 401 || e.response?.status === 404 || !hasAuthToken()) {
        const url = `${API_BASE_URL}/test/sales-funnel/agents`;
        return await fetchJson<Agent[]>(url);
      }
      throw e;
    }
  }

  // Stage Management
  async moveToNextStage(id: number, notes?: string): Promise<ApiResponse<SalesFunnelLead>> {
    const response = await api.post(`${this.baseUrl}/${id}/move-to-next-stage`, { notes });
    return response.data;
  }

  async moveToStage(id: number, stage: string, notes?: string): Promise<ApiResponse<SalesFunnelLead>> {
    const response = await api.post(`${this.baseUrl}/${id}/move-to-stage`, { stage, notes });
    return response.data;
  }

  // Closing
  async closeAsWon(id: number, finalValue: number, policyNumber?: string, notes?: string): Promise<ApiResponse<SalesFunnelLead>> {
    const response = await api.post(`${this.baseUrl}/${id}/close-as-won`, { final_value: finalValue, policy_number: policyNumber, notes });
    return response.data;
  }

  async closeAsLost(id: number, reason: string, notes?: string): Promise<ApiResponse<SalesFunnelLead>> {
    const response = await api.post(`${this.baseUrl}/${id}/close-as-lost`, { reason, notes });
    return response.data;
  }

  // Follow-up
  async scheduleFollowUp(id: number, followUpDate: string, notes?: string): Promise<ApiResponse<SalesFunnelLead>> {
    const response = await api.post(`${this.baseUrl}/${id}/schedule-follow-up`, { follow_up_date: followUpDate, notes });
    return response.data;
  }

  // Contact
  async recordContact(id: number, method: string, notes?: string, details?: any): Promise<ApiResponse<SalesFunnelLead>> {
    const response = await api.post(`${this.baseUrl}/${id}/record-contact`, { method, notes, details });
    return response.data;
  }

  // Score
  async updateScore(id: number, score: number, reason?: string): Promise<ApiResponse<SalesFunnelLead>> {
    const response = await api.post(`${this.baseUrl}/${id}/update-score`, { score, reason });
    return response.data;
  }

  // Conversion
  async convertToClient(id: number): Promise<ApiResponse<{ client: Client; lead: SalesFunnelLead }>> {
    const response = await api.post(`${this.baseUrl}/${id}/convert-to-client`);
    return response.data;
  }
}

import { mockSalesFunnelService } from './salesFunnelService.mock';

// Usar mock service temporalmente hasta que se implemente el backend
// TODO: Cambiar a SalesFunnelService() cuando el backend esté listo
const USE_MOCK_SERVICE = false;

export const salesFunnelService = USE_MOCK_SERVICE ? mockSalesFunnelService : new SalesFunnelService();
export default salesFunnelService;
