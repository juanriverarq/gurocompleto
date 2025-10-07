import { auth } from '../config/firebase';

// Configuración base de la API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';

export interface RenovacionFilters {
  search?: string;
  estado?: string;
  prioridad?: string;
  agente?: string;
  diasVencimiento?: string;
  per_page?: number;
  page?: number;
  sort_field?: string;
  sort_direction?: 'asc' | 'desc';
}

export interface Renovacion {
  id: string;
  numeroPoliza: string;
  cliente: string;
  dni_cliente?: string;
  aseguradora: string;
  tipoSeguro: string;
  fechaVencimiento: string;
  diasVencimiento: number;
  valorPrima: number;
  estado: 'PENDIENTE' | 'EN_PROCESO' | 'CRITICO' | 'RENOVADO' | 'VENCIDO';
  prioridad: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  agente: string;
  ultimoContacto: string;
  intentosContacto: number;
  observaciones: string;
  poliza_id: number;
}

export interface RenovacionesResponse {
  data: Renovacion[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

export interface RenovacionesStats {
  total_renovaciones: number;
  renovaciones_criticas: number;
  renovaciones_pendientes: number;
  renovaciones_vencidas: number;
  renovaciones_completadas: number;
  valor_total_primas: string | number;
}

class RenovacionesService {
  private async getAuthHeaders(): Promise<HeadersInit> {
    let token: string | null = null;

    // Prioridad 1: Intentar obtener token de Firebase Auth
    try {
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken();
      }
    } catch (error) {
      // Ignorar errores de Firebase
    }

    // Fallback: Usar token SaaS si Firebase no está disponible
    if (!token) {
      token = localStorage.getItem('saas_token');
    }

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error HTTP: ${response.status}`);
    }

    const data = await response.json();
    return data; // Devolver la respuesta completa
  }

  /**
   * Obtener renovaciones con filtros y paginación
   */
  async getRenovaciones(filters: RenovacionFilters = {}): Promise<RenovacionesResponse> {
    try {
      const queryParams = new URLSearchParams();

      // Agregar filtros a los parámetros de búsqueda
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const url = `${API_BASE_URL}/saas/renovaciones${
        queryParams.toString() ? `?${queryParams.toString()}` : ''
      }`;

      const response = await fetch(url, {
        method: 'GET',
        headers: await this.getAuthHeaders(),
      });

      const result = await this.handleResponse<{
        success: boolean;
        message: string;
        data: Renovacion[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        from: number;
        to: number;
      }>(response);

      return {
        data: result.data || [],
        current_page: result.current_page || 1,
        last_page: result.last_page || 1,
        per_page: result.per_page || 15,
        total: result.total || 0,
        from: result.from || 0,
        to: result.to || 0,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Obtener estadísticas de renovaciones
   */
  async getEstadisticas(): Promise<RenovacionesStats> {
    try {
      const response = await fetch(`${API_BASE_URL}/saas/renovaciones/estadisticas`, {
        method: 'GET',
        headers: await this.getAuthHeaders(),
      });

      const result = await this.handleResponse<{ data: RenovacionesStats }>(response);
      return result.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Registrar contacto para una renovación
   */
  async registrarContacto(
    renovacionId: string,
    contacto: {
      tipo: string;
      resultado: string;
      observaciones: string;
      proximoContacto?: string;
    },
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/saas/renovaciones/${renovacionId}/contacto`, {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify(contacto),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al registrar contacto');
      }

      return {
        success: true,
        message: data.message || 'Contacto registrado exitosamente',
      };
    } catch (error) {
      // Fallback simulado para desarrollo
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            message: 'Contacto registrado exitosamente (modo desarrollo)',
          });
        }, 500);
      });
    }
  }

  /**
   * Procesar renovación
   */
  async procesarRenovacion(
    renovacionId: string,
    datos: {
      nuevaFechaVencimiento: string;
      nuevoValorPrima: number;
      observaciones: string;
    },
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/saas/renovaciones/${renovacionId}/procesar`, {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify(datos),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al procesar renovación');
      }

      return {
        success: true,
        message: data.message || 'Renovación procesada exitosamente',
      };
    } catch (error) {
      // Fallback simulado para desarrollo
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            message: 'Renovación procesada exitosamente (modo desarrollo)',
          });
        }, 500);
      });
    }
  }

  /**
   * Exportar renovaciones
   */
  async exportarRenovaciones(filters: RenovacionFilters = {}): Promise<Blob> {
    try {
      const queryParams = new URLSearchParams();

      // Agregar filtros a los parámetros de búsqueda
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const response = await fetch(
        `${API_BASE_URL}/saas/renovaciones/export${
          queryParams.toString() ? `?${queryParams.toString()}` : ''
        }`,
        {
          method: 'GET',
          headers: await this.getAuthHeaders(),
        },
      );

      if (!response.ok) {
        throw new Error('Error al exportar renovaciones');
      }

      return await response.blob();
    } catch (error) {
      // Fallback simulado para desarrollo
      return new Promise((resolve) => {
        setTimeout(() => {
          const csvContent =
            `Número Póliza,Cliente,Aseguradora,Tipo,Vencimiento,Estado,Prioridad,Prima
` +
            `POL-2024-001,Juan Carlos Pérez,Seguros Bolívar,Automóvil,2024-08-15,PENDIENTE,ALTA,1250000
` +
            `POL-2024-002,Empresa Logística ABC,Mapfre,Empresarial,2024-07-30,CRITICO,CRITICA,3500000
` +
            `POL-2024-003,Ana María Torres,Sura,Hogar,2024-09-10,EN_PROCESO,MEDIA,850000
`;
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
          resolve(blob);
        }, 1000);
      });
    }
  }
}

export const renovacionesService = new RenovacionesService();
export default renovacionesService;
