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

export const carteraSimpleService = {
  async timeline(params?: { search?: string; group?: GroupKey; limit?: number }): Promise<TimelineResponse> {
    const res = await api.get('/saas/cartera-simple/timeline', { params });
    return res.data;
  },

  async detalle(itemId: number) {
    const res = await api.get(`/saas/cartera-simple/cuota/${itemId}`);
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
};
