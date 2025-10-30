import { auth } from '../config/firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';

const getAuthToken = async (): Promise<string | null> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return null;
    }
    const token = await user.getIdToken();
    return token;
  } catch (error) {
    return null;
  }
};

async function req(path: string, init?: RequestInit) {
  const token = await getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...(init || {}),
    headers: { ...headers, ...(init?.headers || {}) } as any,
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`Error ${res.status}:`, errorText);
    throw new Error(`Error ${res.status}: ${errorText}`);
  }
  
  return res;
}

export interface Movimiento {
  id: number;
  tipo: 'anticipo' | 'ajuste' | 'descuento';
  vendedor_id: number;
  vendedor_nombre?: string;
  concepto: string;
  valor: number;
  fecha: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  observaciones?: string;
  aprobado_por?: string;
  fecha_aprobacion?: string;
  poliza_id?: number;
  numero_poliza?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FiltrosMovimientos {
  tipo?: string;
  estado?: string;
  vendedor_id?: number;
  fecha_desde?: string;
  fecha_hasta?: string;
  search?: string;
}

export interface CrearMovimientoInput {
  tipo: 'anticipo' | 'ajuste' | 'descuento';
  vendedor_id: number;
  concepto: string;
  valor: number;
  observaciones?: string;
  poliza_id?: number;
}

export default {
  async getMovimientos(params: FiltrosMovimientos = {}): Promise<Movimiento[]> {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') usp.append(k, String(v));
    });
    const res = await req(`/saas/cartera/anticipos-ajustes?${usp.toString()}`);
    const data = await res.json();
    return data.data || data || [];
  },

  async crearMovimiento(input: CrearMovimientoInput): Promise<Movimiento> {
    const res = await req(`/saas/cartera/anticipos-ajustes`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const data = await res.json();
    return data.data || data;
  },

  async aprobarMovimiento(id: number): Promise<Movimiento> {
    const res = await req(`/saas/cartera/anticipos-ajustes/${id}/aprobar`, {
      method: 'POST',
    });
    const data = await res.json();
    return data.data || data;
  },

  async rechazarMovimiento(id: number, motivo?: string): Promise<Movimiento> {
    const res = await req(`/saas/cartera/anticipos-ajustes/${id}/rechazar`, {
      method: 'POST',
      body: JSON.stringify({ motivo }),
    });
    const data = await res.json();
    return data.data || data;
  },

  async eliminarMovimiento(id: number): Promise<void> {
    await req(`/saas/cartera/anticipos-ajustes/${id}`, {
      method: 'DELETE',
    });
  },

  async getEstadisticas(params: { fecha_desde?: string; fecha_hasta?: string } = {}): Promise<{
    totalAnticipos: number;
    totalAjustes: number;
    totalDescuentos: number;
    pendientesAprobacion: number;
    totalMovimientos: number;
  }> {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') usp.append(k, String(v));
    });
    const res = await req(`/saas/cartera/anticipos-ajustes/estadisticas?${usp.toString()}`);
    const data = await res.json();
    return data.data || data;
  },
};