import api, { API_BASE_URL } from '../config/api';

function getDevBrokerId(): string | undefined {
  try {
    const empleadoPerfil = localStorage.getItem('empleado_profile');
    if (empleadoPerfil) {
      const perfil = JSON.parse(empleadoPerfil);
      if (perfil?.broker_id) return String(perfil.broker_id);
    }
  } catch {
    // ignore
  }
  const devBrokerId = (import.meta as any).env?.VITE_DEV_BROKER_ID;
  return devBrokerId ? String(devBrokerId) : undefined;
}

function devHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const devBrokerId = getDevBrokerId();
  if (devBrokerId) h['X-Dev-Broker-Id'] = devBrokerId;
  h['X-Dev-Mode'] = 'true';
  return h;
}

async function testFetch(path: string, init?: RequestInit) {
  return fetch(`${API_BASE_URL}/test${path}`, {
    ...(init || {}),
    headers: { ...(init?.headers || {}), ...devHeaders() },
  });
}

export interface PerformanceMetrics {
  total_sales: number;
  total_goals: number;
  achievement_rate: number;
  active_agents: number;
  active_teams: number;
  period: string;
}

export interface AgentPerformance {
  id: number;
  name: string;
  email: string;
  team_name?: string;
  monthly_sales: number;
  monthly_goal: number;
  achievement_percentage: number;
  commission_earned: number;
  new_clients: number;
  calls_made: number;
  meetings_scheduled: number;
  proposals_sent: number;
  conversion_rate: number;
  ranking: number;
  status: 'active' | 'inactive';
}

export interface TeamPerformance {
  id: number;
  name: string;
  leader_name: string;
  total_members: number;
  team_sales: number;
  team_goal: number;
  achievement_percentage: number;
  average_conversion: number;
  top_performer: string;
}

export interface PerformanceStatistics {
  period: string;
  total_revenue: number;
  total_commissions: number;
  average_conversion_rate: number;
  top_performing_agent: AgentPerformance;
  top_performing_team: TeamPerformance;
  trends: {
    sales_growth: number;
    conversion_improvement: number;
    new_clients_growth: number;
  };
}

export default {
  async getMetrics(
    params: { period?: string; team_id?: number } = {},
  ): Promise<PerformanceMetrics> {
    try {
      const res = await api.get('/saas/sales-performance/metrics', { params });
      return res.data;
    } catch (e: any) {
      // Fallback a /test en caso de error de auth o servidor
      const usp = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) usp.append(k, String(v));
      });
      const res = await testFetch(`/sales-performance/metrics?${usp.toString()}`, { method: 'GET' });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return res.json();
    }
  },

  async getAgentsPerformance(
    params: { period?: string; team_id?: number; limit?: number; sort_by?: string } = {},
  ): Promise<AgentPerformance[]> {
    try {
      const res = await api.get('/saas/sales-performance/agents', { params });
      return res.data;
    } catch (e: any) {
      // Fallback a /test en caso de error de auth o servidor
      const usp = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) usp.append(k, String(v));
      });
      const res = await testFetch(`/sales-performance/agents?${usp.toString()}`, { method: 'GET' });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return res.json();
    }
  },

  async getTeamsPerformance(
    params: { period?: string; limit?: number } = {},
  ): Promise<TeamPerformance[]> {
    try {
      const res = await api.get('/saas/sales-performance/teams', { params });
      return res.data;
    } catch (e: any) {
      // Fallback a /test en caso de error de auth o servidor
      const usp = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) usp.append(k, String(v));
      });
      const res = await testFetch(`/sales-performance/teams?${usp.toString()}`, { method: 'GET' });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return res.json();
    }
  },

  async getStatistics(params: { period?: string } = {}): Promise<PerformanceStatistics> {
    try {
      const res = await api.get('/saas/sales-performance/statistics', { params });
      return res.data;
    } catch (e: any) {
      // Fallback a /test en caso de error de auth o servidor
      const usp = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) usp.append(k, String(v));
      });
      const res = await testFetch(`/sales-performance/statistics?${usp.toString()}`, { method: 'GET' });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return res.json();
    }
  },

  async exportPerformance(
    params: { period?: string; format?: 'csv' | 'excel' } = {},
  ): Promise<Blob> {
    try {
      const res = await api.get('/saas/sales-performance/export', { 
        params,
        responseType: 'blob'
      });
      return res.data;
    } catch (e: any) {
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        const usp = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null) usp.append(k, String(v));
        });
        const res = await testFetch(`/sales-performance/export?${usp.toString()}`, { method: 'GET' });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.blob();
      }
      throw e;
    }
  },
};
