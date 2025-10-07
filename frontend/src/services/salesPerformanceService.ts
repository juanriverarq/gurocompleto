import { API_BASE_URL } from '../config/api';

const headers = () => {
  const token = localStorage.getItem('firebase_token') || localStorage.getItem('saas_token');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  } as Record<string, string>;
};

async function req(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...(init || {}),
    headers: { 'Content-Type': 'application/json', ...headers(), ...(init?.headers || {}) } as any,
  });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res;
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
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) usp.append(k, String(v));
    });
    const path = `/saas/sales-performance/metrics?${usp.toString()}`;
    const res = await req(path);
    return res.json();
  },

  async getAgentsPerformance(
    params: { period?: string; team_id?: number; limit?: number; sort_by?: string } = {},
  ): Promise<AgentPerformance[]> {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) usp.append(k, String(v));
    });
    const path = `/saas/sales-performance/agents?${usp.toString()}`;
    const res = await req(path);
    return res.json();
  },

  async getTeamsPerformance(
    params: { period?: string; limit?: number } = {},
  ): Promise<TeamPerformance[]> {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) usp.append(k, String(v));
    });
    const path = `/saas/sales-performance/teams?${usp.toString()}`;
    const res = await req(path);
    return res.json();
  },

  async getStatistics(params: { period?: string } = {}): Promise<PerformanceStatistics> {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) usp.append(k, String(v));
    });
    const path = `/saas/sales-performance/statistics?${usp.toString()}`;
    const res = await req(path);
    return res.json();
  },

  async exportPerformance(
    params: { period?: string; format?: 'csv' | 'excel' } = {},
  ): Promise<Blob> {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) usp.append(k, String(v));
    });
    const path = `/saas/sales-performance/export?${usp.toString()}`;
    const res = await req(path);
    return res.blob();
  },
};
