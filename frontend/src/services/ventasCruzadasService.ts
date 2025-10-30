import { auth } from '../config/firebase';

export interface OportunidadVentasCruzadas {
  id: string;
  cliente: string;
  cliente_id: number;
  polizaActual: string;
  tipoActual: string;
  oportunidad: string;
  tipoOportunidad: string;
  scoring: number;
  probabilidad: number;
  valorEstimado: string;
  razonamiento: string;
  estado: string;
  estadoColor: string;
  fechaDeteccion: string;
  accionRecomendada: string;
  vendedor_id?: number;
  vendedor_nombre?: string;
  mensaje_ia?: string;
  cta?: string;
  proteccion_complementaria?: string;
  aseguradora_recomendada?: string;
}

export interface EstadisticasVentasCruzadas {
  total_oportunidades: number;
  alta_prioridad: number;
  valor_total_estimado: number;
  scoring_promedio: number;
  por_tipo: {
    vida: number;
    hogar: number;
    salud: number;
    empresarial: number;
    auto?: number;
  };
  estadisticas_ia?: {
    total_analisis: number;
    analisis_vigentes: number;
    total_consultas: number;
    scoring_promedio_global: number;
    ultimo_analisis: string | null;
    recomendaciones_generadas: number;
  };
}

class VentasCruzadasService {
  private async getAuthHeaders(): Promise<HeadersInit> {
    let token: string | null = null;

    // 1) Firebase ID token (usuarios SaaS)
    try {
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken(true);
      }
    } catch {}

    // 2) Token de empleado (Laravel)
    if (!token) {
      token = localStorage.getItem('empleado_token');
    }

    // 3) Token SaaS propio
    if (!token) {
      token = localStorage.getItem('saas_token');
    }

    // 4) DEV_BYPASS
    const devBypass = (import.meta as any).env?.VITE_DEV_AUTH_BYPASS === 'true';
    const devBrokerId = (import.meta as any).env?.VITE_DEV_BROKER_ID || '2';

    const headers: HeadersInit = { 'Content-Type': 'application/json' };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (devBypass) {
      headers['Authorization'] = `Bearer DEV_BYPASS`;
      headers['X-Dev-Broker-Id'] = String(devBrokerId);
      headers['X-Dev-Mode'] = 'true';
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<{ success: boolean; data?: T; message?: string }> {
    if (!response.ok) {
      let message = `Error HTTP: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.message) message = errorData.message;
      } catch {}

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('saas_token');
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
      }

      throw new Error(message);
    }

    const data = await response.json();
    return data;
  }

  /**
   * Obtener oportunidades de ventas cruzadas
   */
  async getOportunidades(filtros: {
    tipo_oportunidad?: string;
    prioridad?: string;
    scoring_min?: number;
    scoring_max?: number;
    fecha_desde?: string;
    fecha_hasta?: string;
    vendedor_id?: number;
    cliente_id?: number;
    per_page?: number;
    page?: number;
  } = {}): Promise<{ success: boolean; data: OportunidadVentasCruzadas[]; total: number; current_page?: number; last_page?: number; per_page?: number; from?: number; to?: number; message?: string }> {
    try {
      const headers = await this.getAuthHeaders();

      // Construir query string
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString());
        }
      });

      const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';
      const url = `${API_URL}/saas/ventas-cruzadas?${params.toString()}`;
      const response = await fetch(url, { headers });
 
      const result = await this.handleResponse<{
        success: boolean;
        data: OportunidadVentasCruzadas[];
        total: number;
        message?: string;
      }>(response);
 
      return {
        success: result.success ?? false,
        data: (result as any).data ?? [],
        total: (result as any).total ?? 0,
        current_page: (result as any).current_page ?? 1,
        last_page: (result as any).last_page ?? 1,
        per_page: (result as any).per_page ?? ((result as any).data?.length ?? 0),
        from: (result as any).from ?? (((result as any).data?.length ?? 0) > 0 ? 1 : 0),
        to: (result as any).to ?? ((result as any).data?.length ?? 0),
        message: (result as any).message
      };
    } catch (error) {
      console.error('Error obteniendo oportunidades de ventas cruzadas:', error);
      return {
        success: false,
        data: [],
        total: 0,
        message: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Obtener estadísticas de ventas cruzadas
   */
  async getEstadisticas(filtros: {
    fecha_desde?: string;
    fecha_hasta?: string;
    vendedor_id?: number;
  } = {}): Promise<{ success: boolean; data?: EstadisticasVentasCruzadas; message?: string }> {
    try {
      const headers = await this.getAuthHeaders();

      // Construir query string
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString());
        }
      });

      const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';
      const url = `${API_URL}/saas/ventas-cruzadas/estadisticas?${params.toString()}`;
      const response = await fetch(url, { headers });
 
      const result = await this.handleResponse<{
        success: boolean;
        data: EstadisticasVentasCruzadas;
        message?: string;
      }>(response);
      return {
        success: result.success ?? false,
        data: result.data,
        message: result.message,
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas de ventas cruzadas:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Ejecutar acción sobre una oportunidad
   */
  async ejecutarAccion(oportunidadId: string, accion: string, datos: any = {}): Promise<{ success: boolean; message?: string }> {
    try {
      const headers = await this.getAuthHeaders();

      const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';
      const url = `${API_URL}/saas/ventas-cruzadas/${oportunidadId}/ejecutar-accion`;
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          accion,
          datos
        })
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error ejecutando acción:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Crear campaña de WhatsApp desde oportunidad
   */
  async crearCampanaWhatsApp(oportunidadId: string, datos: {
    mensaje: string;
    programar?: boolean;
    fecha_envio?: string;
  }): Promise<{ success: boolean; message?: string }> {
    return this.ejecutarAccion(oportunidadId, 'crear_campana_whatsapp', datos);
  }

  /**
   * Enviar email desde oportunidad
   */
  async enviarEmail(oportunidadId: string, datos: {
    asunto: string;
    mensaje: string;
    programar?: boolean;
    fecha_envio?: string;
  }): Promise<{ success: boolean; message?: string }> {
    return this.ejecutarAccion(oportunidadId, 'enviar_email', datos);
  }

  /**
   * Crear tarea de seguimiento
   */
  async crearTareaSeguimiento(oportunidadId: string, datos: {
    titulo: string;
    descripcion: string;
    fecha_limite?: string;
    prioridad?: 'baja' | 'media' | 'alta';
  }): Promise<{ success: boolean; message?: string }> {
    return this.ejecutarAccion(oportunidadId, 'crear_tarea_seguimiento', datos);
  }

  /**
   * Generar cotización
   */
  async generarCotizacion(oportunidadId: string, datos: {
    tipo_seguro: string;
    valor_asegurado: number;
    observaciones?: string;
  }): Promise<{ success: boolean; message?: string }> {
    return this.ejecutarAccion(oportunidadId, 'generar_cotizacion', datos);
  }

  /**
   * Forzar reanálisis de todas las pólizas
   */
  async forzarReanalisis(): Promise<{ success: boolean; data?: OportunidadVentasCruzadas[]; message?: string }> {
    try {
      const headers = await this.getAuthHeaders();

      const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';
      const url = `${API_URL}/saas/ventas-cruzadas/forzar-reanalisis`;
      const response = await fetch(url, {
        method: 'POST',
        headers
      });
 
      const result = await this.handleResponse<{
        success: boolean;
        data?: OportunidadVentasCruzadas[];
        message?: string;
      }>(response);
      return {
        success: result.success ?? false,
        data: result.data,
        message: result.message,
      };
    } catch (error) {
      console.error('Error forzando reanálisis:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }
}

// Instancia singleton
export const ventasCruzadasService = new VentasCruzadasService();
export default ventasCruzadasService;