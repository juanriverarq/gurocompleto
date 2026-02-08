import api from '../config/api';

export interface DashboardData {
  broker: {
    id: number;
    name: string;
    legal_name: string;
    status: string;
    plan: string;
  };
  resumen_polizas: {
    total: number;
    activas: number;
    vencidas: number;
    canceladas: number;
    por_vencer: number;
  };
  finanzas: {
    valor_total_primas: string;
    comision_total: string;
    valor_total_asegurado: string;
    valor_primas_numero: number;
    comision_numero: number;
    valor_asegurado_numero: number;
  };
  clientes: {
    total: number;
    activos: number;
    prospectos: number;
    porcentaje_crecimiento: number;
  };
  siniestros: {
    total: number;
    pendientes: number;
    aprobados: number;
  };
  polizas_por_tipo: Record<string, number>;
  polizas_recientes: Array<{
    id: number;
    policy_number: string;
    product_name: string;
    client_name: string;
    premium_amount: number;
    status: string;
    insurance_company: string;
    created_at: string;
  }>;
  tareas_comerciales: {
    activas: number;
  };
  ventas: {
    del_mes: number;
    mes_anterior: number;
    crecimiento_porcentaje: number;
  };
  recaudos: {
    primas_cobradas: number;
    primas_cobradas_formato: string;
    primas_pendientes: number;
    primas_pendientes_formato: string;
    comisiones_cobradas: number;
    comisiones_cobradas_formato: string;
    comisiones_pendientes: number;
    comisiones_pendientes_formato: string;
    polizas_recaudadas: number;
  };
  timestamp: string;
}

export interface DashboardResponse {
  success: boolean;
  data: DashboardData;
  message?: string;
}

export const getDashboardData = async (): Promise<DashboardResponse> => {
  const response = await api.get<DashboardResponse>('/saas/dashboard/data');
  return response.data;
};

export const getDashboardMetrics = async () => {
  const response = await api.get('/saas/dashboard/metrics');
  return response.data;
};

export interface ChartResponse {
  success: boolean;
  data: {
    labels: string[];
    data: number[];
    start: string;
    end: string;
    period: string;
  };
  message?: string;
}

export const getPrimasChart = async (period: 'week' | 'month' | 'year' = 'month'): Promise<ChartResponse> => {
  const response = await api.get(`/saas/dashboard/primas-chart?period=${period}`);
  return response.data;
};

export const getClientesChart = async (period: 'week' | 'month' | 'year' = 'month'): Promise<ChartResponse> => {
  const response = await api.get(`/saas/dashboard/clientes-chart?period=${period}`);
  return response.data;
};

export const getPolizasChart = async (period: 'week' | 'month' | 'year' = 'month'): Promise<ChartResponse> => {
  const response = await api.get(`/saas/dashboard/polizas-chart?period=${period}`);
  return response.data;
};
