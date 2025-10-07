import api from '../config/api';

export interface Comision {
  id: string;
  numeroPoliza: string;
  cliente: string;
  aseguradora: string;
  ramo: string;
  prima: number;
  porcentajeComision: number;
  valorComision: number;
  estado: 'Pendiente' | 'Pagada' | 'Parcial';
  fechaVencimiento: string;
  asesor: string;
  fechaCreacion: string;
  poliza_id: string;
}

export interface ComisionesFilters {
  search?: string;
  aseguradora?: string;
  asesor?: string;
  estado?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  per_page?: number;
  page?: number;
  sort_field?: string;
  sort_direction?: 'asc' | 'desc';
}

export interface ComisionesEstadisticas {
  total_comisiones: number;
  total_monto_comisiones: number;
  promedio_porcentaje: number;
  total_prima_asegurada: number;
  comisiones_por_asesor: Array<{
    asesor_id: string;
    asesor_nombre: string;
    cantidad_polizas: number;
    total_comisiones: number;
    total_prima: number;
  }>;
  comisiones_por_aseguradora: Array<{
    insurance_company: string;
    cantidad_polizas: number;
    total_comisiones: number;
    promedio_porcentaje: number;
  }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  success: boolean;
  message: string;
}

class ComisionesService {
  private baseUrl = '/saas/comisiones';

  async getComisiones(filters?: ComisionesFilters): Promise<PaginatedResponse<Comision>> {
    try {
      const params = new URLSearchParams();

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            params.append(key, value.toString());
          }
        });
      }

      const response = await api.get(`${this.baseUrl}?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching comisiones:', error);
      throw error;
    }
  }

  async getEstadisticas(): Promise<{ success: boolean; message: string; data: ComisionesEstadisticas }> {
    try {
      const response = await api.get(`${this.baseUrl}/estadisticas`);
      return response.data;
    } catch (error) {
      console.error('Error fetching comisiones statistics:', error);
      throw error;
    }
  }

  async calcularComisiones(): Promise<{ success: boolean; message: string; data: { actualizadas: number; errores: number; total_procesadas: number } }> {
    try {
      const response = await api.post(`${this.baseUrl}/calcular`);
      return response.data;
    } catch (error) {
      console.error('Error calculating comisiones:', error);
      throw error;
    }
  }

  async exportarComisiones(filters?: ComisionesFilters): Promise<Blob> {
    try {
      const params = new URLSearchParams();

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            params.append(key, value.toString());
          }
        });
      }

      const response = await api.get(`${this.baseUrl}/exportar?${params.toString()}`, {
        responseType: 'blob',
      });

      return response.data;
    } catch (error) {
      console.error('Error exporting comisiones:', error);
      throw error;
    }
  }

  async getComision(id: string): Promise<{ success: boolean; message: string; data: Comision }> {
    try {
      const response = await api.get(`${this.baseUrl}/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching comision:', error);
      throw error;
    }
  }

  // Método auxiliar para descargar archivo
  downloadBlob(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  // Método auxiliar para formatear filtros
  formatFiltersForAPI(filters: ComisionesFilters): Record<string, any> {
    const formatted: Record<string, any> = {};

    if (filters.search) formatted.search = filters.search;
    if (filters.aseguradora) formatted.aseguradora = filters.aseguradora;
    if (filters.asesor) formatted.asesor = filters.asesor;
    if (filters.estado) formatted.estado = filters.estado;
    if (filters.fecha_desde) formatted.fecha_desde = filters.fecha_desde;
    if (filters.fecha_hasta) formatted.fecha_hasta = filters.fecha_hasta;
    if (filters.per_page) formatted.per_page = filters.per_page;
    if (filters.page) formatted.page = filters.page;
    if (filters.sort_field) formatted.sort_field = filters.sort_field;
    if (filters.sort_direction) formatted.sort_direction = filters.sort_direction;

    return formatted;
  }
}

export const comisionesService = new ComisionesService();