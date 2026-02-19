import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api';

const masterPanelApi = axios.create({
  baseURL: `${API_URL}/master-panel`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token
masterPanelApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('master_panel_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar errores de autenticación
masterPanelApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('master_panel_token');
      localStorage.removeItem('master_panel_user');
      window.location.href = '/master-panel/login';
    }
    return Promise.reject(error);
  }
);

export interface MasterUser {
  id: number;
  name: string;
  email: string;
  user_type: string;
  avatar?: string;
  last_login_at?: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    user: MasterUser;
  };
}

export interface MasterStats {
  brokers: {
    total: number;
    activos: number;
    inactivos: number;
    en_trial: number;
    por_plan: Record<string, number>;
    este_mes: number;
    crecimiento_porcentaje: number;
  };
  usuarios: {
    total: number;
    activos: number;
    masters: number;
    admins: number;
    empleados_total: number;
    empleados_activos: number;
  };
  polizas: {
    total: number;
    activas: number;
    valor_primas: number;
    valor_primas_formato: string;
    valor_comisiones: number;
    valor_comisiones_formato: string;
  };
  clientes: {
    total: number;
    activos: number;
  };
  siniestros: {
    total: number;
    pendientes: number;
  };
  automatizacion: {
    campanas_whatsapp: { total: number; activas: number };
    campanas_voz: { total: number; activas: number };
    campanas_email: { total: number; activas: number };
    chatbots: { total: number; activos: number };
    instancias_whatsapp: { total: number; conectadas: number };
  };
  llamadas_voz: {
    total: number;
    completadas: number;
    duracion_minutos: number;
    costo_total_usd: number;
  };
  finanzas: {
    saldo_wallets: number;
    saldo_wallets_formato: string;
    wallets_con_saldo: number;
    suscripciones_total: number;
    suscripciones_activas: number;
  };
  top_brokers: {
    por_polizas: Array<{ id: number; name: string; status: string; plan: string; polizas_count: number }>;
    por_clientes: Array<{ id: number; name: string; status: string; plan: string; clientes_count: number }>;
  };
  actividad_reciente: {
    ultimos_brokers: Array<{ id: number; name: string; status: string; plan: string; created_at: string }>;
    ultimos_usuarios: Array<{ id: number; name: string; email: string; user_type: string; status: string; created_at: string }>;
  };
  timestamp: string;
}

export const masterPanelService = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const response = await masterPanelApi.post('/login', { email, password });
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await masterPanelApi.post('/logout');
    } finally {
      localStorage.removeItem('master_panel_token');
      localStorage.removeItem('master_panel_user');
    }
  },

  getMe: async (): Promise<{ success: boolean; data: MasterUser }> => {
    const response = await masterPanelApi.get('/me');
    return response.data;
  },

  getStats: async (): Promise<{ success: boolean; data: MasterStats }> => {
    const response = await masterPanelApi.get('/stats');
    return response.data;
  },

  getBrokers: async (params?: {
    search?: string;
    status?: string;
    plan?: string;
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_dir?: string;
  }) => {
    const response = await masterPanelApi.get('/brokers', { params });
    return response.data;
  },

  getBrokerDetail: async (brokerId: number) => {
    const response = await masterPanelApi.get(`/brokers/${brokerId}`);
    return response.data;
  },

  toggleBrokerStatus: async (brokerId: number) => {
    const response = await masterPanelApi.patch(`/brokers/${brokerId}/toggle-status`);
    return response.data;
  },

  getUsuarios: async (params?: {
    search?: string;
    user_type?: string;
    status?: string;
    page?: number;
    per_page?: number;
  }) => {
    const response = await masterPanelApi.get('/usuarios', { params });
    return response.data;
  },

  getFacturacion: async (params?: { en_mora?: string }) => {
    const response = await masterPanelApi.get('/facturacion', { params });
    return response.data;
  },

  getBrokerPayments: async (brokerId: number) => {
    const response = await masterPanelApi.get(`/brokers/${brokerId}/payments`);
    return response.data;
  },

  getBrokerFullDetail: async (brokerId: number) => {
    const response = await masterPanelApi.get(`/brokers/${brokerId}/full-detail`);
    return response.data;
  },

  updateBrokerWallet: async (brokerId: number, data: { action: 'add' | 'subtract'; amount: number; description: string }) => {
    const response = await masterPanelApi.post(`/brokers/${brokerId}/wallet`, data);
    return response.data;
  },

  getLogs: async (params?: { file?: string; lines?: number; search?: string }) => {
    const response = await masterPanelApi.get('/logs', { params });
    return response.data;
  },

  updateBrokerSubscription: async (brokerId: number, data: {
    status?: string;
    period?: string;
    current_period_end?: string;
    users_count?: number;
    storage_gb?: number;
    monthly_amount?: number;
    annual_amount?: number;
    plan?: string;
    broker_status?: string;
    features?: string[];
    max_users?: number;
    trial_ends_at?: string | null;
  }) => {
    const response = await masterPanelApi.put(`/brokers/${brokerId}/subscription`, data);
    return response.data;
  },

  createBroker: async (data: {
    name: string;
    email: string;
    phone?: string;
    city?: string;
    country?: string;
    plan?: string;
    status?: string;
    max_users?: number;
    features?: string[];
    trial_days?: number;
    document_type?: string;
    document_number?: string;
    legal_name?: string;
    address?: string;
  }) => {
    const response = await masterPanelApi.post('/brokers', data);
    return response.data;
  },

  updateBroker: async (brokerId: number, data: {
    name?: string;
    legal_name?: string;
    document_type?: string;
    document_number?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
    website?: string;
    plan?: string;
    status?: string;
    max_users?: number;
    max_clients?: number;
    max_policies?: number;
    features?: string[];
    trial_days?: number;
  }) => {
    const response = await masterPanelApi.put(`/brokers/${brokerId}`, data);
    return response.data;
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('master_panel_token');
  },

  getStoredUser: (): MasterUser | null => {
    const user = localStorage.getItem('master_panel_user');
    return user ? JSON.parse(user) : null;
  },

  setAuth: (token: string, user: MasterUser): void => {
    localStorage.setItem('master_panel_token', token);
    localStorage.setItem('master_panel_user', JSON.stringify(user));
  },

  clearAuth: (): void => {
    localStorage.removeItem('master_panel_token');
    localStorage.removeItem('master_panel_user');
  },
};

export default masterPanelService;
