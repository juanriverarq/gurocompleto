import { API_BASE_URL } from '../config/api';

const headers = () => {
  const token = localStorage.getItem('firebase_token') || localStorage.getItem('saas_token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  } as Record<string, string>;
};

const hasAuthToken = () => {
  const token = localStorage.getItem('firebase_token') || localStorage.getItem('saas_token');
  return !!token;
};

// Para Sales Teams no usaremos fallback /test; las rutas son públicas en /saas
async function fetchJson(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...(init || {}),
    headers: { 'Content-Type': 'application/json', ...headers(), ...(init?.headers || {}) } as any,
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res;
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
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) usp.append(k, String(v));
    });
    const path = `/saas/sales-teams?${usp.toString()}`;
    const res = await fetchJson(path);
    return res.json();
  },
  async create(data: Partial<SalesTeamDTO>) {
    const res = await fetchJson(`/saas/sales-teams`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async update(id: number, data: Partial<SalesTeamDTO>) {
    const res = await fetchJson(`/saas/sales-teams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async remove(id: number) {
    const res = await fetchJson(`/saas/sales-teams/${id}`, { method: 'DELETE' });
    return res.json();
  },
  async members(teamId: number) {
    const res = await fetchJson(`/saas/sales-teams/${teamId}/members`);
    return res.json();
  },
  async addMember(
    teamId: number,
    data: { user_id: number; role?: string; monthly_goal?: number; status?: string },
  ) {
    const res = await fetchJson(`/saas/sales-teams/${teamId}/members`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async removeMember(teamId: number, userId: number) {
    const res = await fetchJson(`/saas/sales-teams/${teamId}/members/${userId}`, {
      method: 'DELETE',
    });
    return res.json();
  },
};
