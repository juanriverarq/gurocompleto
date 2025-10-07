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

// Metas ahora públicas en /saas/goals: quitamos fallback /test
async function req(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...(init || {}),
    headers: { 'Content-Type': 'application/json', ...headers(), ...(init?.headers || {}) } as any,
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res;
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
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) usp.append(k, String(v));
    });
    const path = `/saas/goals?${usp.toString()}`;
    const res = await req(path);
    return res.json();
  },
  async statistics(period?: string) {
    const usp = new URLSearchParams();
    if (period) usp.append('period', period);
    const path = `/saas/goals/statistics?${usp.toString()}`;
    const res = await req(path);
    return res.json();
  },
  async create(data: Partial<GoalDTO>) {
    const res = await req(`/saas/goals`, { method: 'POST', body: JSON.stringify(data) });
    return res.json();
  },
  async get(id: number) {
    const res = await req(`/saas/goals/${id}`);
    return res.json();
  },
  async update(id: number, data: Partial<GoalDTO>) {
    const res = await req(`/saas/goals/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    return res.json();
  },
  async remove(id: number) {
    const res = await req(`/saas/goals/${id}`, { method: 'DELETE' });
    return res.json();
  },
};
