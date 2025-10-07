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

export interface EstadoAgente {
  id: string;
  asesor: string;
  periodo?: string;
  comisionesGeneradas: number;
  comisionesPagadas: number;
  comisionesPendientes: number;
  saldoFinal: number;
  polizasVendidas: number;
  metaCumplida: number;
  porcentajeMeta: number;
}

export interface Movimiento {
  id: string;
  fecha: string;
  concepto: string;
  tipo: 'Comisión' | 'Anticipo' | 'Ajuste' | 'Descuento' | 'Pago';
  valor: number;
  saldo: number;
}

export default {
  async metrics(params: { period?: string; broker_id?: number } = {}) {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) usp.append(k, String(v));
    });
    const res = await req(`/saas/cartera/estados-cuenta/metrics?${usp.toString()}`);
    return res.json();
  },
  async agents(params: { period?: string; broker_id?: number } = {}): Promise<EstadoAgente[]> {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) usp.append(k, String(v));
    });
    const res = await req(`/saas/cartera/estados-cuenta/agents?${usp.toString()}`);
    return res.json();
  },
  async advisorSummary(
    userId: number,
    params: { period?: string; broker_id?: number } = {},
  ): Promise<EstadoAgente> {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) usp.append(k, String(v));
    });
    const res = await req(
      `/saas/cartera/estados-cuenta/advisor/${userId}/summary?${usp.toString()}`,
    );
    return res.json();
  },
  async advisorMovements(
    userId: number,
    params: { period?: string; broker_id?: number } = {},
  ): Promise<Movimiento[]> {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) usp.append(k, String(v));
    });
    const res = await req(
      `/saas/cartera/estados-cuenta/advisor/${userId}/movements?${usp.toString()}`,
    );
    return res.json();
  },
};
