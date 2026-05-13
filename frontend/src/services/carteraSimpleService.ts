import api from 'src/config/api';

export interface Cuota {
  id: number;
  poliza_id: number | null;
  cliente_id: number | null;
  poliza_numero: string | null;
  numero_pago: string | null;
  anexo_numero: string | null;
  riesgo: string | null;
  aseguradora_nombre: string | null;
  ramo_principal: string | null;
  cliente_nombre: string | null;
  cliente_documento: string | null;
  vendedor_nombre: string | null;
  forma_pago: string | null;
  prima_total_pago: number;
  valor_neto_a_pagar: number;
  saldo_pendiente_oficina: number;
  saldo_pendiente_aseguradora: number;
  valor_recaudado_oficina: number;
  valor_pagado_aseguradora: number;
  comision_a_recibir: number;
  comision_recibida: number;
  fecha_limite_pago: string | null;
  fecha_recaudado_oficina: string | null;
  fecha_pago_aseguradora: string | null;
  fecha_comisionada: string | null;
  recaudado_en_oficina: boolean;
  recaudado_aseguradora: boolean;
  comisionada: boolean;
  recibo_pago_directo: boolean;
  es_anticipo: boolean;
  recibo_anulado: boolean;
  estado_cartera: string;
  numero_renovacion: number;
  updated_at: string;
}

export type GroupKey =
  | 'vencidas'
  | 'hoy'
  | 'proximos_7'
  | 'proximos_30'
  | 'sin_fecha'
  | 'por_pagar_aseguradora'
  | 'comision_por_cobrar'
  | 'cerradas';

export interface TimelineStats {
  vencidas_count: number;
  vencidas_monto: number;
  hoy_count: number;
  proximos_7_count: number;
  proximos_30_count: number;
  por_pagar_aseguradora_count: number;
  por_pagar_aseguradora_monto: number;
  comision_por_cobrar_count: number;
  comision_por_cobrar_monto: number;
}

export interface TimelineResponse {
  success: boolean;
  data: Partial<Record<GroupKey, Cuota[]>>;
  stats: TimelineStats;
  today: string;
}

export type Accion =
  | 'recaudar_oficina'
  | 'pagar_directo'
  | 'pagar_aseguradora'
  | 'cobrar_comision';

export interface PagarPayload {
  accion: Accion;
  monto?: number;
  metodo_pago?: string;
  referencia?: string;
  fecha?: string;
  observaciones?: string;
}

export interface CarteraSettings {
  auto_cobrar_comision: boolean;
}

export const carteraSimpleService = {
  async timeline(params?: { search?: string; group?: GroupKey; limit?: number }): Promise<TimelineResponse> {
    const res = await api.get('/saas/cartera-simple/timeline', { params });
    return res.data;
  },

  async getSettings(): Promise<{ success: boolean; data: CarteraSettings }> {
    const res = await api.get('/saas/cartera-simple/settings');
    return res.data;
  },

  async updateSettings(settings: Partial<CarteraSettings>): Promise<{ success: boolean; data: CarteraSettings }> {
    const res = await api.post('/saas/cartera-simple/settings', settings);
    return res.data;
  },

  async detalle(itemId: number) {
    const res = await api.get(`/saas/cartera-simple/cuota/${itemId}`);
    return res.data;
  },

  async actualizarCuotaPoliza(polizaId: number | string, itemId: number | string, payload: {
    fecha_limite_pago?: string | null;
    prima_total_pago?: number;
    comision_a_recibir?: number;
    numero_pago?: string | null;
  }) {
    const res = await api.put(`/saas/polizas/${polizaId}/cartera-items/${itemId}`, payload);
    return res.data;
  },

  async pagar(itemId: number, payload: PagarPayload) {
    const res = await api.post(`/saas/cartera-simple/cuota/${itemId}/pagar`, payload);
    return res.data;
  },

  async avisar(itemId: number) {
    const res = await api.post(`/saas/cartera-simple/cuota/${itemId}/avisar`);
    return res.data;
  },

  async anular(itemId: number) {
    const res = await api.post(`/saas/cartera-simple/cuota/${itemId}/anular`);
    return res.data;
  },

  async reactivar(itemId: number) {
    const res = await api.post(`/saas/cartera-simple/cuota/${itemId}/reactivar`);
    return res.data;
  },

  async revertirPaso(itemId: number) {
    const res = await api.post(`/saas/cartera-simple/cuota/${itemId}/revertir-paso`);
    return res.data;
  },

  async exportar(filters: Record<string, any> = {}): Promise<Blob> {
    const params: Record<string, string> = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params[k] = String(v);
    });
    const res = await api.get('/saas/cartera-simple/exportar', { params, responseType: 'blob' });
    return res.data as Blob;
  },

  /**
   * Marcar TODA la póliza (todas sus cuotas) como pagada al 100%.
   * Modo:
   *  - 'oficina'    → solo crea recaudos de oficina (queda "por pagar a aseguradora")
   *  - 'aseguradora_directo' → solo pago directo a aseguradora (sin pasar por oficina)
   *  - 'completo'   → recaudo oficina + pago aseguradora + cobro comisión (cerrada)
   */
  async marcarPolizaPagada(polizaId: number | string, modo: 'oficina' | 'aseguradora_directo' | 'completo' = 'completo') {
    const body: any = {};
    if (modo === 'oficina') {
      body.oficina = true;
      body.aseguradora = false;
    } else if (modo === 'aseguradora_directo') {
      body.oficina = false;
      body.aseguradora = true;
    } else {
      body.oficina = true;
      body.aseguradora = true;
    }
    const res = await api.post(`/saas/polizas/${polizaId}/marcar-pagada`, body);
    return res.data;
  },
};
