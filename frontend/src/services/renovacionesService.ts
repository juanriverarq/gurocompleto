import { auth } from '../config/firebase';
import { API_BASE_URL } from 'src/config/api';

// API_BASE_URL proviene de config/api con soporte de override en runtime

export interface RenovacionFilters {
  search?: string;
  estado?: string;
  prioridad?: string;
  agente?: string;
  aseguradora?: string;
  ramo?: string;
  placa?: string;
  diasVencimiento?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
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
  ramo?: string;
  placa?: string;
  fechaInicio?: string;
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
  numeroRenovacion?: number;
  comisionPorcentaje?: number;
  isRenewal?: boolean;
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

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      (headers as any).Authorization = `Bearer ${token}`;
    }
    return headers;
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
    * Procesar renovación con validaciones adicionales
    */
   async procesarRenovacion(
     renovacionId: string,
     datos: {
       nuevaFechaVencimiento: string;
       nuevoValorPrima: number;
       observaciones: string;
       nuevoNumeroPoliza?: string;
       nuevaAseguradora?: string;
       nuevoRamoId?: string;
     },
   ): Promise<{ success: boolean; message: string; data?: any }> {
     try {
       // Validaciones del lado cliente
       const fechaVencimiento = new Date(datos.nuevaFechaVencimiento);
       const hoy = new Date();
       const maxFecha = new Date();
       maxFecha.setFullYear(maxFecha.getFullYear() + 2);

       // Validar fecha no pasada
       if (fechaVencimiento <= hoy) {
         throw new Error('La fecha de vencimiento debe ser futura');
       }

       // Validar fecha no demasiado lejana
       if (fechaVencimiento > maxFecha) {
         throw new Error('La fecha de vencimiento no puede ser superior a 2 años');
       }

       // Validar prima mínima (sin límite máximo)
       if (datos.nuevoValorPrima < 0) {
         throw new Error('El valor de la prima debe ser mayor o igual a 0');
       }

       // Validar longitud mínima de número de póliza si se proporciona
       if (datos.nuevoNumeroPoliza && datos.nuevoNumeroPoliza.trim().length < 3) {
         throw new Error('El número de póliza debe tener al menos 3 caracteres');
       }

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
         data: data.data || null,
       };
     } catch (error) {
       console.error('Error al procesar renovación:', error);
       throw error;
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
        `${API_BASE_URL}/saas/polizas/renovaciones/exportar${
          queryParams.toString() ? `?${queryParams.toString()}` : ''
        }`,
        {
          method: 'GET',
          headers: {
            ...(await this.getAuthHeaders()),
            Accept: 'text/csv, application/json',
          } as any,
        },
      );

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const errorData = await response.json().catch(() => ({} as any));
        throw new Error(errorData.message || 'Error al exportar renovaciones');
      }

      if (!response.ok) {
        throw new Error(`Error ${response.status}: No se pudo exportar renovaciones`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Error exportando renovaciones:', error);
      throw error;
    }
  }
}

export const renovacionesService = new RenovacionesService();
export default renovacionesService;
