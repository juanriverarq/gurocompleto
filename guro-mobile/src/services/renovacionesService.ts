import api from '../config/api';

export interface Renovacion {
  id: string;
  numeroPoliza: string;
  cliente: string;
  dni_cliente: string;
  aseguradora: string;
  tipoSeguro: string;
  ramo: string;
  placa: string | null;
  fechaVencimiento: string;
  diasVencimiento: number;
  valorPrima: number;
  estado: string;
  prioridad: string;
  agente: string;
  ultimoContacto: string;
  intentosContacto: number;
  observaciones: string;
  poliza_id: number;
  // Aliases for backward compat in list screen
  numero_poliza?: string;
  estado_renovacion?: string;
  dias_vencimiento?: number;
  prima_neta?: number;
}

export interface RenovacionesResponse {
  success: boolean;
  message?: string;
  data: Renovacion[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface RenovacionesStats {
  total_renovaciones: number;
  renovaciones_criticas: number;
  renovaciones_pendientes: number;
  renovaciones_vencidas: number;
  renovaciones_completadas: number;
  valor_total_primas: number;
}

export interface RenovacionesStatsResponse {
  success: boolean;
  data: RenovacionesStats;
  message?: string;
}

export interface RenovacionesParams {
  page?: number;
  per_page?: number;
  search?: string;
  estado?: string;
  dias_vencimiento?: string;
  aseguradora?: string;
  ramo?: string;
}

export const getRenovaciones = async (params: RenovacionesParams = {}): Promise<RenovacionesResponse> => {
  const queryParams = new URLSearchParams();

  if (params.page) queryParams.append('page', params.page.toString());
  if (params.per_page) queryParams.append('per_page', params.per_page.toString());
  if (params.search) queryParams.append('search', params.search);
  if (params.estado) queryParams.append('estado', params.estado);
  if (params.dias_vencimiento) queryParams.append('dias_vencimiento', params.dias_vencimiento);
  if (params.aseguradora) queryParams.append('aseguradora', params.aseguradora);
  if (params.ramo) queryParams.append('ramo', params.ramo);

  const response = await api.get(`/saas/renovaciones?${queryParams.toString()}`);
  return response.data;
};

export const getRenovacionesStats = async (): Promise<RenovacionesStatsResponse> => {
  const response = await api.get('/saas/renovaciones/estadisticas');
  return response.data;
};

export interface ContactoData {
  tipo: 'llamada' | 'email' | 'whatsapp' | 'presencial' | 'sms';
  resultado: 'exitoso' | 'no_disponible' | 'no_contesta' | 'rebotado' | 'solicita_info' | 'no_interesado';
  observaciones: string;
  proximoContacto?: string;
}

export const registrarContactoRenovacion = async (polizaId: number, data: ContactoData) => {
  const response = await api.post(`/saas/renovaciones/${polizaId}/contacto`, data);
  return response.data;
};

export const procesarRenovacion = async (polizaId: number) => {
  const response = await api.post(`/saas/renovaciones/${polizaId}/procesar`);
  return response.data;
};
