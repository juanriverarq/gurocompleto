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

export interface ReporteFinanciero {
  periodo: string;
  totalPrimas: number;
  totalComisiones: number;
  comisionesPagadas: number;
  comisionesPendientes: number;
  anticipos: number;
  ajustes: number;
  margenBruto: number;
  crecimiento: number;
}

export interface ReportePorAsesor {
  asesor: string;
  comisionesGeneradas: number;
  comisionesPagadas: number;
  metaCumplida: number;
  porcentajeMeta: number;
  clientesActivos: number;
  polizasVendidas: number;
}

export interface ReportePorAseguradora {
  aseguradora: string;
  primasTotal: number;
  comisiones: number;
  porcentajeParticipacion: number;
  polizasActivas: number;
  crecimientoMensual: number;
}

export default {
  async monthly(
    params: { period?: string; months?: number; broker_id?: number } = {},
  ): Promise<ReporteFinanciero[]> {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) usp.append(k, String(v));
    });
    const res = await req(`/saas/cartera/reportes-financieros/monthly?${usp.toString()}`);
    return res.json();
  },
  async byAdvisor(
    params: { period?: string; broker_id?: number } = {},
  ): Promise<ReportePorAsesor[]> {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) usp.append(k, String(v));
    });
    const res = await req(`/saas/cartera/reportes-financieros/by-advisor?${usp.toString()}`);
    return res.json();
  },
  async byInsurer(
    params: { period?: string; broker_id?: number } = {},
  ): Promise<ReportePorAseguradora[]> {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) usp.append(k, String(v));
    });
    const res = await req(`/saas/cartera/reportes-financieros/by-insurer?${usp.toString()}`);
    return res.json();
  },
};
