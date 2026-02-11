import api from '../config/api';

export interface CarteraItem {
  id: number;
  numero_poliza: string;
  cliente: string;
  cliente_id: number;
  documento: string;
  aseguradora: string;
  ramo: string;
  estado: string;
  fecha_inicio: string;
  fecha_vencimiento: string;
  dias_vencimiento: number;
  prima_neta: number;
  iva: number;
  total: number;
  comision: number;
  forma_pago: string;
  estado_pago: string;
  vendedor: string;
  vendedor_id: number | null;
  recaudo_oficina: {
    recaudado: number;
    pendiente: number;
    total: number;
  };
  recaudo_aseguradora: {
    pagado: number;
    pendiente: number;
    total: number;
  };
  cobro_comision: {
    cobrada: number;
    pendiente: number;
    total: number;
  };
}

export interface CarteraEstadisticas {
  totalPolizas: number;
  polizasActivas: number;
  primaTotal: number;
  comisionesTotal: number;
  recaudadoTotal: number;
  porCobrarTotal: number;
  tasaRecaudo: number;
}

export interface ContadoresTabs {
  general: number;
  porCobrar: number;
  porPagar: number;
  recaudosCompletados: number;
}

export interface CarteraResponse {
  success: boolean;
  message?: string;
  data: CarteraItem[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  estadisticas: CarteraEstadisticas;
  contadoresTabs: ContadoresTabs;
}

export interface CarteraParams {
  page?: number;
  per_page?: number;
  search?: string;
  tab?: string;
  aseguradora?: string;
  vendedor_id?: string;
}

export const getCartera = async (params: CarteraParams = {}): Promise<CarteraResponse> => {
  const queryParams = new URLSearchParams();

  if (params.page) queryParams.append('page', params.page.toString());
  if (params.per_page) queryParams.append('per_page', params.per_page.toString());
  if (params.search) queryParams.append('search', params.search);
  if (params.tab) queryParams.append('tab', params.tab);
  if (params.aseguradora) queryParams.append('aseguradora', params.aseguradora);
  if (params.vendedor_id) queryParams.append('vendedor_id', params.vendedor_id);

  const response = await api.get(`/saas/polizas/cartera?${queryParams.toString()}`);
  return response.data;
};
