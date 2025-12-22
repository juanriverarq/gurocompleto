import { ApiResponse } from '../types/saas';
import { auth } from '../config/firebase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';

export interface ComisionDisponible {
  vendedor: string;
  vendedor_id: number;
  polizas: PolizaComision[];
  total_polizas: number;
  prima_total: number;
  comision_bruta_total: number;
  retencion_total: number;
  retencion_ica_total: number;
  iva_total: number;
  reteiva_total: number;
  comision_neta_total: number;
  porcentajes: {
    comision: number;
    retencion: number;
    retencion_ica: number;
    iva: number;
    reteiva: number;
  };
}

export interface PolizaComision {
  id: number;
  cobro_comision_id?: number;
  numero_poliza: string;
  cliente: string;
  aseguradora: string;
  ramo: string;
  fecha_poliza: string;
  fecha_cobro?: string; // Fecha en que la aseguradora pagó la comisión
  prima_neta: number;
  comision_aseguradora?: number; // Lo que pagó la aseguradora al broker
  porcentaje_comision: number;
  comision_bruta: number; // Comisión del vendedor
  porcentaje_retencion: number;
  retencion: number;
  porcentaje_retencion_ica: number;
  retencion_ica: number;
  porcentaje_iva: number;
  iva: number;
  porcentaje_reteiva?: number;
  reteiva?: number;
  comision_neta: number;
}

export interface FiltrosComisiones {
  vendedor_id?: number;
  fecha_inicio?: string;
  fecha_fin?: string;
  aseguradoras?: string[];
  ramos?: string[];
}

export interface VistaPreviaLiquidacion {
  vendedor: {
    id: number;
    nombres: string;
    tipo_documento: string;
    numero_documento: string;
    cuenta_bancaria?: string;
  };
  periodo: {
    inicio: string;
    fin: string;
  };
  detalles: DetallePolizaLiquidacion[];
  totales: {
    prima_total: number;
    comision_bruta_total: number;
    retencion_total: number;
    retencion_ica_total: number;
    iva_total: number;
    comision_neta_total: number;
  };
  cantidad_polizas: number;
}

export interface DetallePolizaLiquidacion {
  poliza_id: number;
  numero_poliza: string;
  cliente_nombre: string;
  aseguradora: string;
  ramo: string;
  fecha_poliza: string;
  prima_neta: number;
  porcentaje_comision: number;
  comision_bruta: number;
  porcentaje_retencion: number;
  monto_retencion: number;
  porcentaje_retencion_ica: number;
  monto_retencion_ica: number;
  porcentaje_iva: number;
  monto_iva: number;
  comision_neta: number;
}

export interface Liquidacion {
  id: number;
  codigo: string;
  broker_id: number;
  vendedor_id: number;
  vendedor?: {
    id: number;
    nombres: string;
    tipo_documento: string;
    numero_documento: string;
  };
  periodo_inicio: string;
  periodo_fin: string;
  fecha_generacion: string;
  filtros_aplicados?: any;
  prima_total: number;
  monto_bruto_total: number;
  monto_retencion_total: number;
  monto_retencion_ica_total: number;
  monto_iva_total: number;
  monto_reteiva_total?: number;
  monto_neto_total: number;
  cantidad_polizas: number;
  estado: 'generada' | 'aprobada' | 'pagada' | 'revertida';
  fecha_pago?: string;
  metodo_pago?: string;
  referencia_pago?: string;
  comprobante_url?: string;
  pdf_url?: string;
  observaciones?: string;
  creado_por?: number;
  aprobado_por?: number;
  fecha_aprobacion?: string;
  revertido_por?: number;
  fecha_reversion?: string;
  motivo_reversion?: string;
  created_at: string;
  updated_at: string;
  detalles?: DetallePolizaLiquidacion[];
}

export interface CrearLiquidacion {
  vendedor_id: number;
  polizas_ids: number[];
  periodo_inicio: string;
  periodo_fin: string;
  observaciones?: string;
  filtros?: any;
}

export interface RegistrarPago {
  fecha_pago: string;
  metodo_pago: string;
  referencia_pago?: string;
  comprobante_url?: string;
  observaciones?: string;
}

export interface RevertirLiquidacion {
  motivo: string;
}

// Helper para obtener headers con auth
const getAuthHeaders = async (): Promise<HeadersInit> => {
  let token: string | null = null;

  try {
    if (auth.currentUser) {
      token = await auth.currentUser.getIdToken(true);
    }
  } catch {}

  if (!token) {
    token = localStorage.getItem('empleado_token');
  }

  if (!token) {
    token = localStorage.getItem('saas_token');
  }

  const devBypass = (import.meta as any).env?.VITE_DEV_AUTH_BYPASS === 'true';
  const devBrokerId = (import.meta as any).env?.VITE_DEV_BROKER_ID || '2';

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (devBypass) {
    headers['Authorization'] = `Bearer DEV_BYPASS`;
    headers['X-Dev-Broker-Id'] = String(devBrokerId);
    headers['X-Dev-Mode'] = 'true';
  }

  return headers;
};

const liquidacionesVendedoresService = {
  /**
   * Obtener comisiones disponibles para liquidar con filtros
   */
  async getComisionesDisponibles(filtros?: FiltrosComisiones): Promise<ApiResponse<ComisionDisponible[]>> {
    try {
      const params = new URLSearchParams();
      if (filtros?.vendedor_id) params.append('vendedor_id', filtros.vendedor_id.toString());
      if (filtros?.fecha_inicio) params.append('fecha_inicio', filtros.fecha_inicio);
      if (filtros?.fecha_fin) params.append('fecha_fin', filtros.fecha_fin);
      if (filtros?.aseguradoras) filtros.aseguradoras.forEach(a => params.append('aseguradoras[]', a));
      if (filtros?.ramos) filtros.ramos.forEach(r => params.append('ramos[]', r));

      const endpoint = `${API_BASE_URL}/saas/liquidaciones-vendedores/comisiones-disponibles?${params.toString()}`;
      const headers = await getAuthHeaders();
      const response = await fetch(endpoint, { headers });
      return await response.json();
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Error al obtener comisiones disponibles',
        data: [] as ComisionDisponible[],
      };
    }
  },

  /**
   * Obtener vista previa de liquidación
   */
  async getVistaPrevia(data: CrearLiquidacion): Promise<ApiResponse<VistaPreviaLiquidacion>> {
    try {
      const endpoint = `${API_BASE_URL}/saas/liquidaciones-vendedores/vista-previa`;
      const headers = await getAuthHeaders();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      return await response.json();
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Error al obtener vista previa',
        data: {} as VistaPreviaLiquidacion,
      };
    }
  },

  /**
   * Crear nueva liquidación
   */
  async crear(data: CrearLiquidacion): Promise<ApiResponse<Liquidacion>> {
    try {
      const endpoint = `${API_BASE_URL}/saas/liquidaciones-vendedores`;
      const headers = await getAuthHeaders();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      return await response.json();
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Error al crear liquidación',
        data: {} as Liquidacion,
      };
    }
  },

  /**
   * Listar liquidaciones
   */
  async listar(filtros?: {
    estado?: string;
    vendedor_id?: number;
    fecha_desde?: string;
    fecha_hasta?: string;
  }): Promise<ApiResponse<Liquidacion[]>> {
    try {
      const params = new URLSearchParams();
      if (filtros?.estado) params.append('estado', filtros.estado);
      if (filtros?.vendedor_id) params.append('vendedor_id', filtros.vendedor_id.toString());
      if (filtros?.fecha_desde) params.append('fecha_desde', filtros.fecha_desde);
      if (filtros?.fecha_hasta) params.append('fecha_hasta', filtros.fecha_hasta);

      const endpoint = `${API_BASE_URL}/saas/liquidaciones-vendedores?${params.toString()}`;
      const headers = await getAuthHeaders();
      const response = await fetch(endpoint, { headers });
      return await response.json();
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Error al listar liquidaciones',
        data: [] as Liquidacion[],
      };
    }
  },

  /**
   * Obtener detalle de liquidación
   */
  async obtener(id: number): Promise<ApiResponse<Liquidacion>> {
    try {
      const endpoint = `${API_BASE_URL}/saas/liquidaciones-vendedores/${id}`;
      const headers = await getAuthHeaders();
      const response = await fetch(endpoint, { headers });
      return await response.json();
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Error al obtener liquidación',
        data: {} as Liquidacion,
      };
    }
  },

  /**
   * Aprobar liquidación
   */
  async aprobar(id: number): Promise<ApiResponse<Liquidacion>> {
    try {
      const endpoint = `${API_BASE_URL}/saas/liquidaciones-vendedores/${id}/aprobar`;
      const headers = await getAuthHeaders();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
      });
      return await response.json();
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Error al aprobar liquidación',
        data: {} as Liquidacion,
      };
    }
  },

  /**
   * Registrar pago de liquidación
   */
  async registrarPago(id: number, data: RegistrarPago): Promise<ApiResponse<Liquidacion>> {
    try {
      const endpoint = `${API_BASE_URL}/saas/liquidaciones-vendedores/${id}/registrar-pago`;
      const headers = await getAuthHeaders();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      return await response.json();
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Error al registrar pago',
        data: {} as Liquidacion,
      };
    }
  },

  /**
   * Revertir liquidación
   */
  async revertir(id: number, data: RevertirLiquidacion): Promise<ApiResponse<Liquidacion>> {
    try {
      const endpoint = `${API_BASE_URL}/saas/liquidaciones-vendedores/${id}/revertir`;
      const headers = await getAuthHeaders();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      return await response.json();
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Error al revertir liquidación',
        data: {} as Liquidacion,
      };
    }
  },

  /**
   * Descargar PDF de liquidación
   */
  async descargarPDF(id: number): Promise<void> {
    try {
      const headers = await getAuthHeaders();
      
      const response = await fetch(`${API_BASE_URL}/saas/liquidaciones-vendedores/${id}/pdf`, {
        method: 'GET',
        headers,
      });
      
      if (!response.ok) {
        throw new Error('Error al generar PDF');
      }
      
      // Obtener el blob del PDF
      const blob = await response.blob();
      
      // Crear URL del blob y descargar
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Liquidacion_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      throw new Error('Error al generar PDF: ' + error.message);
    }
  },
};

export default liquidacionesVendedoresService;
