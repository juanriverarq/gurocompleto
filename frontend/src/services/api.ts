// Servicios API para el dashboard
import api from '../config/api';

export interface DashboardData {
  resumen_polizas: {
    total: number;
    activas: number;
    vencidas: number;
    por_vencer: number;
  };
  finanzas: {
    valor_total_primas: string;
    comision_total: string;
    valor_primas_numero: string;
    comision_numero: string;
  };
  clientes: {
    total: number;
    activos: number;
    porcentaje_crecimiento: number;
  };
  siniestros: {
    total: number;
    pendientes: number;
    aprobados: number;
  };
  polizas_por_tipo: Array<{
    type: string;
    total: number;
  }>;
  polizas_detalladas: {
    [key: string]: Array<{
      type: string;
      client_name: string;
      premium_amount: string;
      status: string;
      insurance_company: string;
      created_at: string;
    }>;
  };
  siniestros_detallados: Array<{
    estado: string;
    total: number;
    promedio_valor: string;
    total_valor: string;
  }>;
  siniestros_por_mes: Array<{
    mes: number;
    total: number;
    valor_total: string;
  }>;
  tareas_comerciales: {
    activas: number;
  };
  ventas: {
    del_mes: number;
  };
  timestamp: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

class ApiService {
  async getDashboardData(startDate?: string | null, endDate?: string | null): Promise<DashboardData> {
    try {
      const params = new URLSearchParams();
      
      if (startDate) {
        params.append('start_date', startDate);
      }
      if (endDate) {
        params.append('end_date', endDate);
      }
      
      const url = params.toString() ? `/dashboard/data?${params.toString()}` : '/dashboard/data';
      const response = await api.get(url);
      
      const result: ApiResponse<DashboardData> = response.data;
      
      if (!result.success) {
        throw new Error(result.message || 'Error al obtener datos del dashboard');
      }
      
      return result.data;
    } catch (error) {
      throw error;
    }
  }
}

export const apiService = new ApiService();
export default apiService;