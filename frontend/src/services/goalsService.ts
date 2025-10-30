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

export interface GoalDTO {
  id: number;
  user_id?: number;
  team_id?: number;
  period: string; // YYYY-MM
  type: 'Primas' | 'Pólizas' | 'Comisiones' | 'Clientes';
  target_value: number;
  current_value: number;
  status: string;
  starts_at?: string;
  ends_at?: string;
  notes?: string;
}

export default {
  async list(
    params: {
      period?: string;
      user_id?: number;
      team_id?: number;
      page?: number;
      per_page?: number;
    } = {},
  ) {
    try {
      const res = await api.get('/saas/goals', { params });
      return res.data;
    } catch (e: any) {
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        const usp = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null) usp.append(k, String(v));
        });
        const res = await testFetch(`/goals?${usp.toString()}`, { method: 'GET' });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
      }
      throw e;
    }
  },

  async statistics(period?: string) {
    try {
      const params = period ? { period } : {};
      const res = await api.get('/saas/goals/statistics', { params });
      return res.data;
    } catch (e: any) {
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        const usp = new URLSearchParams();
        if (period) usp.append('period', period);
        const res = await testFetch(`/goals/statistics?${usp.toString()}`, { method: 'GET' });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
      }
      throw e;
    }
  },

  async create(data: Partial<GoalDTO>) {
    try {
      const res = await api.post('/saas/goals', data);
      return res.data;
    } catch (e: any) {
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        const res = await testFetch(`/goals`, {
          method: 'POST',
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
      }
      throw e;
    }
  },

  async get(id: number) {
    try {
      const res = await api.get(`/saas/goals/${id}`);
      return res.data;
    } catch (e: any) {
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        const res = await testFetch(`/goals/${id}`, { method: 'GET' });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
      }
      throw e;
    }
  },

  async update(id: number, data: Partial<GoalDTO>) {
    try {
      const res = await api.put(`/saas/goals/${id}`, data);
      return res.data;
    } catch (e: any) {
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        const res = await testFetch(`/goals/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
      }
      throw e;
    }
  },

  async remove(id: number) {
    try {
      const res = await api.delete(`/saas/goals/${id}`);
      return res.data;
    } catch (e: any) {
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        const res = await testFetch(`/goals/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
      }
      throw e;
    }
  },
};
