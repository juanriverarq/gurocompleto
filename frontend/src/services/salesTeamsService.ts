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
  // Rutas /api/test/* no requieren auth y resuelven broker vía X-Dev-Broker-Id o query
  return fetch(`${API_BASE_URL}/test${path}`, {
    ...(init || {}),
    headers: { ...(init?.headers || {}), ...devHeaders() },
  });
}

export interface SalesTeamDTO {
  id: number;
  name: string;
  description?: string;
  territory?: string;
  specialty?: string;
  leader_user_id?: number;
  status: string;
}

export default {
  async list(params: { page?: number; per_page?: number } = {}) {
    try {
      const res = await api.get('/saas/sales-teams', { params });
      return res.data;
    } catch (e: any) {
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        const usp = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null) usp.append(k, String(v));
        });
        const res = await testFetch(`/sales-teams?${usp.toString()}`, { method: 'GET' });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
      }
      throw e;
    }
  },

  async create(data: Partial<SalesTeamDTO>) {
    try {
      const res = await api.post('/saas/sales-teams', data);
      return res.data;
    } catch (e: any) {
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        const res = await testFetch(`/sales-teams`, {
          method: 'POST',
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
      }
      throw e;
    }
  },

  async update(id: number, data: Partial<SalesTeamDTO>) {
    try {
      const res = await api.put(`/saas/sales-teams/${id}`, data);
      return res.data;
    } catch (e: any) {
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        const res = await testFetch(`/sales-teams/${id}`, {
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
      const res = await api.delete(`/saas/sales-teams/${id}`);
      return res.data;
    } catch (e: any) {
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        const res = await testFetch(`/sales-teams/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
      }
      throw e;
    }
  },

  async members(teamId: number) {
    try {
      const res = await api.get(`/saas/sales-teams/${teamId}/members`);
      return res.data;
    } catch (e: any) {
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        const res = await testFetch(`/sales-teams/${teamId}/members`, { method: 'GET' });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
      }
      throw e;
    }
  },

  async addMember(
    teamId: number,
    data: { user_id: number; role?: string; monthly_goal?: number; status?: string },
  ) {
    try {
      const res = await api.post(`/saas/sales-teams/${teamId}/members`, data);
      return res.data;
    } catch (e: any) {
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        const res = await testFetch(`/sales-teams/${teamId}/members`, {
          method: 'POST',
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
      }
      throw e;
    }
  },

  async removeMember(teamId: number, userId: number) {
    try {
      const res = await api.delete(`/saas/sales-teams/${teamId}/members/${userId}`);
      return res.data;
    } catch (e: any) {
      if (e?.response?.status === 401 || e?.response?.status === 403) {
        const res = await testFetch(`/sales-teams/${teamId}/members/${userId}`, {
          method: 'DELETE',
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        return res.json();
      }
      throw e;
    }
  },
};
