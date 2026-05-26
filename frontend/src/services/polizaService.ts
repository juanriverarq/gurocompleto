import { toast } from 'src/hooks/use-toast';
import { auth } from '../config/firebase';

export interface PolizaCoverageRow {
  id?: number;
  coverage_type?: string | null;
  coverage_name?: string | null;
  coverage_code?: string | null;
  insured_value?: number | string | null;
  deductible?: string | null;
  deductible_value?: number | string | null;
  deductible_percentage?: number | string | null;
  source_insurer?: string | null;
}

// Tipos para las pólizas
export interface Poliza {
  id?: string;
  numero_poliza: string;
  riesgo?: string;
  valor_riesgo_asegurado?: number;
  aseguradora: string;
  aseguradora_id?: number;
  aseguradora_nombre?: string;
  ramo_principal: string;
  ramo_id?: number;
  ramo_nombre?: string;
  subramo?: string;
  tipo_poliza?: string;
  // cliente_id definido en sección Campos SaaS
  
  // Campos adicionales (extensiones SaaS)
  fecha_recepcion?: string;
  renovable?: boolean;
  motivo?: string;
  pri_a_pre?: number;
  participacion?: number;
  co_corretaje?: number;
  comision_agencia?: number;
  porcentaje_retencion?: number;
  porcentaje_reteiva?: number;
  beneficiario_en_remision?: boolean;
  beneficiario_oneroso_nombre?: string;
  beneficiario_oneroso_documento?: string;
  documents?: any[];
  // Pólizas colectivas
  policy_category?: 'individual' | 'colectiva';
  oficina_radicacion?: string;
  ciudad_expedicion?: string;
  // Vehículos
  placas?: string[];
  // Lectura partes
  policy_holder_name?: string;
  policy_holder_document?: string;
  insured_name?: string;
  insured_document?: string;
  
  // Información del cliente (solo lectura desde backend)
  nombres_cliente?: string;
  apellidos_cliente?: string;
  dni_cliente?: string;
  tipo_documento?: string;
  telefono_cliente?: string;
  celular_cliente?: string;
  fecha_expedicion_dni?: string;
  fecha_nacimiento?: string;
  domicilio?: string;
  correo_cliente?: string;
  correos_secundarios?: string;
  observaciones_cliente?: string;
  
  // Información financiera
  prima_neta: number;
  porcentaje_iva?: number;
  iva?: number;
  total?: number;
  gastos_adicionales?: number;
  gastos_adicionales_aplica_iva?: boolean;
  porcentaje_comision?: number;
  comision?: number;
  forma_pago?: string;
  periodicidad_pago?: string;
  medio_pago?: string;
  // Pago
  banco?: string;
  cuotas?: number;
  numero_tarjeta?: string; // frontend envía completo, backend guarda last4
  
  // Información administrativa
  vendedor?: string;
  vendedor_id?: number;
  vendedor_id_2?: number;
  vendedor_2?: string;
  enlace_externo?: string;
  observaciones?: string;
  observaciones_internas?: string;
  fecha_expedicion: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado?: 'ACTIVA' | 'VENCIDA' | 'CANCELADA' | 'SUSPENDIDA';
  cancellation_reason?: string;
  non_renewal_reason?: string;
  cancelled_at?: string;
  cancelled_by?: number | null;
  sede?: string;
  
  // Campos SaaS
  broker_id?: string;
  usuario_id?: string;
  cliente_id?: string;
  
  // Metadatos
  created_at?: string;
  updated_at?: string;

  /** Sincronización detalle (microservicio aseguradoras) */
  detail_sync_status?: 'pending' | 'processing' | 'completed' | 'partial' | 'failed' | 'not_applicable' | string | null;
  detail_sync_at?: string | null;
  detail_sync_error?: string | null;
  coverages?: PolizaCoverageRow[];

  // Desglose de costos reportado por aseguradora (Mundial y otras que lo incluyan)
  valor_iva_aseguradora?: number;
  valor_gastos_emision_aseguradora?: number;
  valor_tasa_runt_aseguradora?: number;

  // Campos calculados
  nombre_completo_cliente?: string;
  dias_para_vencimiento?: number;
  esta_vencida?: boolean;
  esta_por_vencer?: boolean;
}

// Tipo para creación/edición desde el frontend (evita reingresar datos del cliente)
export type CreatePolizaInput = {
  numero_poliza: string;
  aseguradora: string;
  aseguradora_id?: number;
  ramo_principal: string;
  ramo_id?: number;
  fecha_expedicion: string;
  fecha_inicio: string;
  fecha_fin: string;
  prima_neta: number;
  cliente_id: string | undefined;

  // Opcionales
  riesgo?: string;
  valor_riesgo_asegurado?: number;
  subramo?: string;
  tipo_poliza?: string;
  porcentaje_iva?: number;
  iva?: number;
  total?: number;
  gastos_adicionales?: number;
  gastos_adicionales_aplica_iva?: boolean;
  porcentaje_comision?: number;
  comision?: number;
  forma_pago?: string;
  periodicidad_pago?: string;
  medio_pago?: string;
  vendedor?: string;
  observaciones?: string;
  observaciones_internas?: string;
  estado?: 'ACTIVA' | 'VENCIDA' | 'CANCELADA' | 'SUSPENDIDA';
  sede?: string;

  // Extensiones
  fecha_recepcion?: string;
  renovable?: boolean;
  motivo?: string;
  pri_a_pre?: number;
  participacion?: number;
  co_corretaje?: number;
  comision_agencia?: number;
  porcentaje_retencion?: number;
  porcentaje_reteiva?: number;
  beneficiario_en_remision?: boolean;
  beneficiario_oneroso_nombre?: string;
  beneficiario_oneroso_documento?: string;
  documents?: any[];
  // Vehículos (solo autos)
  placas?: string[];

  // Pago
  banco?: string;
  cuotas?: number;
  numero_tarjeta?: string;

  // Origen (sync vs manual)
  sync_source?: string;
  sync_at?: string;
};

export interface PolizaFilters {
  search?: string;
  numero_poliza?: string;
  aseguradora?: string;
  aseguradora_id?: number | string;
  ramo?: string;
  ramo_id?: number | string;
  estado?: string;
  vendedor?: string;
  sede?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  // Filtros adicionales
  renovable?: boolean | string;
  fecha_recepcion_desde?: string;
  fecha_recepcion_hasta?: string;
  forma_pago?: string;
  // Motivo de cancelación (aplicable cuando estado=CANCELADA)
  cancellation_reason?: string;
  // Rango de fecha de cancelación (cancelled_at) - aplicable cuando estado=CANCELADA
  cancelled_desde?: string;
  cancelled_hasta?: string;
  sort_field?: string;
  sort_direction?: 'asc' | 'desc';
  per_page?: number;
  page?: number;
  // Papelera: 'only' devuelve únicamente registros soft-deleted
  trashed?: 'only' | 'none';
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

// Configuración de la API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';

// Usar las nuevas rutas SaaS
const API_PREFIX = '/saas/polizas';

// Helper para obtener el token de autenticación Firebase
const getAuthToken = async (): Promise<string | null> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return null;
    }
    const token = await user.getIdToken();
    return token;
  } catch (error) {
    return null;
  }
};

// Helper para hacer peticiones HTTP con autenticación
async function makeRequest<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    // Obtener token de Firebase
    const token = await getAuthToken();
    
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    // Agregar token si existe
    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    const url = `${API_BASE_URL}${endpoint}`;
    
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
      
      // Manejo suave de duplicado de número de póliza
      if (response.status === 409 && (errorData.code === 'DUPLICATE_POLICY_NUMBER')) {
        throw new Error('El número de póliza ya existe. Prueba con otro identificador.');
      }

      // Si hay errores de validación, mostrarlos
      if (errorData.errors) {
        const firstError = Object.values(errorData.errors)[0];
        const errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
        throw new Error(errorMessage || errorData.message || `HTTP ${response.status}`);
      }
      
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    throw error;
  }
}

// Servicio de pólizas
export const polizaService = {
  /**
   * Obtener datos de cartera optimizados (solo pólizas activas con información de pagos)
   */
  async getCartera(filters: PolizaFilters = {}): Promise<ApiResponse<any[]>> {
    try {
      const queryParams = new URLSearchParams();

      // Filtros por defecto para cartera: solo activas, ordenadas por vencimiento
      const defaultFilters = {
        estado: 'ACTIVA',
        sort_field: 'fecha_fin',
        sort_direction: 'asc',
        per_page: 1000, // Límite razonable para cartera
        ...filters
      };

      // Agregar filtros (por defecto + especificados)
      Object.entries(defaultFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const endpoint = `${API_PREFIX}/cartera?${queryParams.toString()}`;
      const response = await makeRequest<any[]>(endpoint);

      return response;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al cargar cartera",
        description: error instanceof Error ? error.message : "Error desconocido",
      });
      throw error;
    }
  },

  /**
   * Obtener pólizas de cartera (optimizado para vista de cartera con paginación del servidor)
   */
  async getCarteraPolizas(
    page: number = 1,
    perPage: number = 25,
    search: string = '',
    tab?: 'general' | 'porCobrar' | 'porPagar' | 'comisionPorCobrar' | 'comisionRecibida' | 'pagoDirecto' | 'anticipos' | 'anulados',
  ): Promise<{ 
    success: boolean; 
    data: any[]; 
    message?: string; 
    pagination?: { current_page: number; last_page: number; per_page: number; total: number };
    estadisticas?: {
      totalPolizas: number;
      totalItems: number;
      primaTotal: number;
      comisionesTotal: number;
      recaudadoTotal: number;
      porCobrarTotal: number;
      porPagarTotal: number;
      comisionesRecibidasTotal: number;
      tasaRecaudo: number;
    };
    contadoresTabs?: {
      general: number;
      porCobrar: number;
      porPagar: number;
      comisionPorCobrar: number;
      comisionRecibida: number;
      pagoDirecto: number;
      anticipos: number;
      anulados: number;
    };
  }> {
    try {
      let endpoint = `${API_PREFIX}/cartera?page=${page}&per_page=${perPage}`;
      if (search) {
        endpoint += `&search=${encodeURIComponent(search)}`;
      }
      if (tab && tab !== 'general') {
        endpoint += `&tab=${encodeURIComponent(tab)}`;
      }
      const response = await makeRequest<any>(endpoint) as any;

      return {
        success: (response && typeof response === 'object' && 'success' in response) ? !!response.success : true,
        data: response.data || response,
        message: (response && typeof response === 'object' && 'message' in response) ? response.message : undefined,
        pagination: response.pagination,
        estadisticas: response.estadisticas,
        contadoresTabs: response.contadoresTabs,
      };
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al cargar cartera",
        description: error instanceof Error ? error.message : "Error desconocido",
      });
      throw error;
    }
  },

  /**
   * Acción masiva sobre cartera_items (estilo SoftSeguros)
   */
  async accionMasivaCartera(accion: 'recaudar_oficina' | 'recaudar_aseguradora' | 'comisionar', itemIds: number[], fecha?: string, observaciones?: string): Promise<ApiResponse<any>> {
    const endpoint = `${API_PREFIX}/cartera/accion-masiva`;
    return makeRequest<any>(endpoint, {
      method: 'POST',
      body: JSON.stringify({ accion, item_ids: itemIds, fecha, observaciones }),
    });
  },

  /**
   * Anular un cartera_item
   */
  async anularCarteraItem(itemId: number): Promise<ApiResponse<any>> {
    return makeRequest<any>(`${API_PREFIX}/cartera/${itemId}/anular`, { method: 'POST' });
  },

  /**
   * Reactivar un cartera_item anulado
   */
  async reactivarCarteraItem(itemId: number): Promise<ApiResponse<any>> {
    return makeRequest<any>(`${API_PREFIX}/cartera/${itemId}/reactivar`, { method: 'POST' });
  },

  /**
   * Registrar recaudo por número de póliza (para importación masiva)
   * Soporta búsqueda por últimos 5 dígitos y pagos parciales/negativos
   */
  async registrarRecaudoPorNumeroPoliza(params: {
    numero_poliza: string;
    tipo_recaudo: 'oficina' | 'aseguradora_directo';
    monto_pagado?: number;
    fecha_pago?: string;
    metodo_pago?: string;
    referencia_pago?: string;
    recaudo_import_id?: number;
  }): Promise<ApiResponse<any>> {
    try {
      const endpoint = `${API_PREFIX}/recaudo-por-numero`;
      const response = await makeRequest<any>(endpoint, {
        method: 'POST',
        body: JSON.stringify(params),
      });
      return response;
    } catch (error) {
      // No mostrar toast aquí para no saturar en importación masiva
      throw error;
    }
  },

  /**
   * Importar recaudos masivamente con registro para reversión
   */
  async importarRecaudosMasivo(params: {
    tipo_recaudo: 'oficina' | 'aseguradora_directo';
    recaudos: Array<{
      numero_poliza: string;
      monto_pagado?: number;
      fecha_pago?: string;
      metodo_pago?: string;
      referencia_pago?: string;
    }>;
    filename?: string;
    mapping?: Record<string, string>;
  }): Promise<ApiResponse<any>> {
    try {
      const endpoint = `${API_PREFIX}/importar-recaudos`;
      const response = await makeRequest<any>(endpoint, {
        method: 'POST',
        body: JSON.stringify(params),
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Listar importaciones de recaudos
   */
  async listarImportaciones(limit: number = 20): Promise<ApiResponse<any>> {
    try {
      const endpoint = `${API_PREFIX}/importaciones?limit=${limit}`;
      const response = await makeRequest<any>(endpoint, {
        method: 'GET',
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener detalle de una importación
   */
  async detalleImportacion(importId: number): Promise<ApiResponse<any>> {
    try {
      const endpoint = `${API_PREFIX}/importaciones/${importId}`;
      const response = await makeRequest<any>(endpoint, {
        method: 'GET',
      });
      return response;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Revertir una importación masiva
   */
  async revertirImportacion(importId: number): Promise<ApiResponse<any>> {
    try {
      const endpoint = `${API_PREFIX}/importaciones/${importId}/revertir`;
      const response = await makeRequest<any>(endpoint, {
        method: 'DELETE',
      });
      return response;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al revertir importación",
        description: error instanceof Error ? error.message : "Error desconocido",
      });
      throw error;
    }
  },

  /**
   * Registrar recaudo de póliza
   */
  async registrarPagoPoliza(polizaId: string, tipoRecaudo: 'oficina' | 'aseguradora' | 'aseguradora_directo', monto: number, metodoPago?: string, referenciaPago?: string, observaciones?: string, fechaPago?: string, carteraItemId?: number): Promise<ApiResponse<any>> {
    try {
      const endpoint = `${API_PREFIX}/${polizaId}/pagos`;
      const body: Record<string, any> = {
        tipo_recaudo: tipoRecaudo,
        monto: monto,
        metodo_pago: metodoPago,
        referencia_pago: referenciaPago,
        fecha_pago: fechaPago,
        observaciones: observaciones,
      };
      if (carteraItemId) body.cartera_item_id = carteraItemId;
      const response = await makeRequest<any>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      return response;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al registrar recaudo",
        description: error instanceof Error ? error.message : "Error desconocido",
      });
      throw error;
    }
  },

  /**
   * Registrar cobro de comisión
   */
  async registrarCobroComision(polizaId: string, monto: number, referenciaCobro?: string, observaciones?: string, fechaCobro?: string, carteraItemId?: number): Promise<ApiResponse<any>> {
    try {
      const endpoint = `${API_PREFIX}/${polizaId}/cobrar-comision`;
      const body: Record<string, any> = {
        monto: monto,
        referencia_cobro: referenciaCobro,
        fecha_cobro: fechaCobro,
        observaciones: observaciones,
      };
      if (carteraItemId) body.cartera_item_id = carteraItemId;
      const response = await makeRequest<any>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      return response;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al registrar cobro de comisión",
        description: error instanceof Error ? error.message : "Error desconocido",
      });
      throw error;
    }
  },

  /**
   * Revertir un pago de póliza
   */
  async revertirPago(polizaId: string, pagoId: string): Promise<ApiResponse<void>> {
    try {
      const response = await makeRequest<void>(`${API_PREFIX}/${polizaId}/pagos/${pagoId}`, {
        method: 'DELETE',
      });

      if (response.success) {
        toast({
          title: "Pago revertido",
          description: "El pago ha sido revertido exitosamente",
        });
      }

      return response;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al revertir pago",
        description: error instanceof Error ? error.message : "Error desconocido",
      });
      throw error;
    }
  },

  /**
   * Revertir todos los recaudos de oficina de una póliza
   */
  async revertirRecaudosOficina(polizaId: string): Promise<ApiResponse<void>> {
    try {
      const response = await makeRequest<void>(`${API_PREFIX}/${polizaId}/pagos/revertir-oficina`, {
        method: 'DELETE',
      });

      return response;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al revertir recaudos",
        description: error instanceof Error ? error.message : "Error desconocido",
      });
      throw error;
    }
  },

  /**
   * Revertir un cartera_item individual a por_cobrar (cuota-específico)
   */
  async revertirCarteraItem(polizaId: number | string, carteraItemId: number): Promise<ApiResponse<void>> {
    try {
      const response = await makeRequest<void>(`${API_PREFIX}/${polizaId}/cartera-item/${carteraItemId}/revertir`, {
        method: 'DELETE',
      });
      return response;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al revertir cuota",
        description: error instanceof Error ? error.message : "Error desconocido",
      });
      throw error;
    }
  },

  /**
   * Revertir recaudo completo (oficina + aseguradora)
   */
  async revertirRecaudoCompleto(polizaId: string): Promise<ApiResponse<void>> {
    try {
      const response = await makeRequest<void>(`${API_PREFIX}/${polizaId}/pagos/revertir-completo`, {
        method: 'DELETE',
      });

      return response;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al revertir recaudo",
        description: error instanceof Error ? error.message : "Error desconocido",
      });
      throw error;
    }
  },

  /**
   * Recaudo masivo de pólizas
   */
  async recaudoMasivo(params: {
    poliza_ids?: string[];
    fecha_inicio?: string;
    fecha_fin?: string;
    tipo_recaudo: 'oficina' | 'aseguradora_directo';
    metodo_pago?: string;
    referencia_pago?: string;
    observaciones?: string;
  }): Promise<ApiResponse<{ procesadas: number; total: number; errores: string[] }>> {
    try {
      const response = await makeRequest<{ procesadas: number; total: number; errores: string[] }>(`${API_PREFIX}/recaudo-masivo`, {
        method: 'POST',
        body: JSON.stringify(params),
      });

      return response;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error en recaudo masivo",
        description: error instanceof Error ? error.message : "Error desconocido",
      });
      throw error;
    }
  },

  /**
   * Recaudo masivo desde archivo CSV
   */
  async recaudoMasivoCsv(archivo: File, tipoRecaudo: 'oficina' | 'aseguradora_directo'): Promise<ApiResponse<{ procesadas: number; total_lineas: number; errores: string[] }>> {
    try {
      const formData = new FormData();
      formData.append('archivo', archivo);
      formData.append('tipo_recaudo', tipoRecaudo);

      const response = await makeRequest<{ procesadas: number; total_lineas: number; errores: string[] }>(`${API_PREFIX}/recaudo-masivo-csv`, {
        method: 'POST',
        body: formData,
        headers: {}, // No Content-Type header para FormData
      });

      return response;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error procesando CSV",
        description: error instanceof Error ? error.message : "Error desconocido",
      });
      throw error;
    }
  },

  /**
   * Revertir un cobro de comisión
   */
  async revertirCobroComision(polizaId: string, cobroId: string): Promise<ApiResponse<void>> {
    try {
      const response = await makeRequest<void>(`${API_PREFIX}/${polizaId}/cobrar-comision/${cobroId}`, {
        method: 'DELETE',
      });

      if (response.success) {
        toast({
          title: "Cobro revertido",
          description: "El cobro de comisión ha sido revertido exitosamente",
        });
      }

      return response;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al revertir cobro",
        description: error instanceof Error ? error.message : "Error desconocido",
      });
      throw error;
    }
  },

  /**
   * Obtener comisiones de pólizas (basado en pagos reales)
   */
  async getComisionesPolizas(): Promise<ApiResponse<any[]>> {
    try {
      // Usar el endpoint optimizado de cartera que incluye información de pagos
      const response = await this.getCarteraPolizas();

      if (!response.success || !response.data) {
        return response;
      }

      // Procesar las pólizas para extraer información de comisiones
      // SOLO incluir pólizas con recaudo (por oficina O por aseguradora)
      const comisionesData = response.data
        .filter((poliza: any) =>
          (poliza.recaudo_oficina?.recaudado || 0) > 0 ||
          (poliza.recaudo_aseguradora?.pagado || 0) > 0
        )
        .map((poliza: any) => {
          const primaNeta = Number(poliza.prima_neta || 0);
          const comisionReal = Number(poliza.comision || 0);
          const porcentajeComision = Number(poliza.comision_agencia || poliza.porcentaje_comision || 15);
          const comision = comisionReal > 0 ? comisionReal : (primaNeta * porcentajeComision / 100);

          // Usar datos reales de cobro de comisión del backend
          const cobroComision = poliza.cobro_comision || {};
          const comisionPendiente = Number(cobroComision.pendiente || 0);
          const comisionCobrada = Number(cobroComision.cobrada || 0);

          // Si no hay cobro registrado pero hay recaudo por oficina, la comisión está pendiente
          const pendiente = comisionPendiente > 0 ? comisionPendiente : (comisionCobrada === 0 ? comision : 0);

          return {
            id: poliza.id,
            numero_poliza: poliza.numero_poliza,
            nombres_cliente: poliza.cliente,
            apellidos_cliente: '',
            dni_cliente: poliza.documento,
            aseguradora_nombre: poliza.aseguradora,
            prima_neta: primaNeta,
            comision,
            comisionPendiente: pendiente,
            comisionCobrada,
            fecha_fin: poliza.fecha_vencimiento,
            estadoComision: pendiente > 0 ? 'Pendiente' : comisionCobrada > 0 ? 'Cobrada' : 'Sin Comisión',
            cobro_id: cobroComision.cobro_id,
          };
        });

      return {
        success: true,
        data: comisionesData,
        message: 'Comisiones obtenidas exitosamente',
      };
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al cargar comisiones",
        description: error instanceof Error ? error.message : "Error desconocido",
      });
      throw error;
    }
  },

  /**
   * Obtener lista de pólizas con filtros y paginación
   */
  async getPolizas(filters: PolizaFilters = {}): Promise<ApiResponse<PaginatedResponse<Poliza>>> {
    try {
      const queryParams = new URLSearchParams();
      
      // Usar los filtros tal cual, incluyendo per_page y page si vienen del UI
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const endpoint = `${API_PREFIX}?${queryParams.toString()}`;
      const response = await makeRequest<any>(endpoint);
      
      // Si el backend devuelve un objeto paginado con metadatos en el nivel raíz
      // (e.g., { data: [...], current_page, last_page, total, ... }), preservar todo el objeto
      const hasRootPaginationMeta =
        response && typeof response === 'object' && Array.isArray(response.data) && (
          'current_page' in response || 'last_page' in response || 'total' in response
        );

      // Si la paginación viene anidada en response.data (menos probable), tomar ese objeto
      const hasNestedPaginationMeta =
        response && response.data && typeof response.data === 'object' && Array.isArray(response.data.data) && (
          'current_page' in response.data || 'last_page' in response.data || 'total' in response.data
        );

      const payload = hasRootPaginationMeta
        ? response
        : hasNestedPaginationMeta
          ? response.data
          : (response.data ?? response);

      return {
        success: (response && typeof response === 'object' && 'success' in response) ? !!response.success : true,
        data: payload,
        message: (response && typeof response === 'object' && 'message' in response) ? response.message : undefined,
      };
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al cargar pólizas",
        description: error instanceof Error ? error.message : "Error desconocido",
      });
      throw error;
    }
  },

  /**
   * Asignar vendedor a múltiples pólizas en una sola request.
   */
  async bulkAssignSeller(
    assignments: Array<{ poliza_id: number; vendedor_id: number; vendedor_id_2?: number | null }>
  ): Promise<ApiResponse<{ updated: number; errors: Array<{ poliza_id: number; reason: string }> }>> {
    const endpoint = `${API_PREFIX}/bulk-assign-seller`;
    return makeRequest<any>(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignments }),
    });
  },

  /**
   * Verificar si existe una póliza con el mismo número
   */
  async checkPolizaExists(
    numeroPoliza: string,
    excludeId?: string
  ): Promise<{ exists: boolean; poliza?: Poliza }> {
    try {
      if (!numeroPoliza || numeroPoliza.trim().length < 3) {
        return { exists: false };
      }
      
      const response = await this.getPolizas({ 
        numero_poliza: numeroPoliza.trim(),
        per_page: 1 
      });
      
      console.log('🔍 [checkPolizaExists] Buscando:', numeroPoliza.trim());
      console.log('🔍 [checkPolizaExists] Respuesta:', response);
      
      if (response.success && response.data) {
        const polizas = Array.isArray(response.data) ? response.data : (response.data as any).data || [];
        console.log('🔍 [checkPolizaExists] Pólizas encontradas:', polizas.length, polizas.map((p: any) => p.numero_poliza));
        
        if (polizas.length > 0) {
          const found = polizas[0];
          // Verificar que el número de póliza coincida EXACTAMENTE
          if (found.numero_poliza !== numeroPoliza.trim()) {
            console.log('🔍 [checkPolizaExists] No coincide exactamente:', found.numero_poliza, '!==', numeroPoliza.trim());
            return { exists: false };
          }
          // Si estamos editando, excluir la póliza actual
          if (excludeId && found.id?.toString() === excludeId) {
            return { exists: false };
          }
          return { exists: true, poliza: found };
        }
      }
      
      return { exists: false };
    } catch (error) {
      console.warn('Error verificando póliza duplicada:', error);
      return { exists: false };
    }
  },

  /**
   * Obtener una póliza específica por ID
   */
  async getPoliza(id: string): Promise<ApiResponse<Poliza>> {
    try {
      const response = await makeRequest<Poliza>(`${API_PREFIX}/${id}`);
      return response;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al cargar póliza",
        description: error instanceof Error ? error.message : "Póliza no encontrada",
      });
      throw error;
    }
  },

  /**
   * Sincronizar detalle (coberturas + datos enriquecidos) desde el microservicio de la aseguradora.
   */
  async syncPolizaDetail(
    id: string,
    options?: { async?: boolean; insurer_connection_id?: number }
  ): Promise<
    ApiResponse<{
      async?: boolean;
      poliza_id?: number;
      insurer_connection_id?: number;
      detail_sync_status?: string;
      detail_sync_at?: string | null;
      detail_sync_error?: string | null;
      coverages_count?: number;
    }>
  > {
    return makeRequest(`${API_PREFIX}/${id}/sync-detail`, {
      method: 'POST',
      body: JSON.stringify({
        async: options?.async ?? false,
        insurer_connection_id: options?.insurer_connection_id,
      }),
    });
  },

  /**
   * Descargar carátula PDF de una póliza desde la aseguradora (solo HDI por ahora).
   */
  async downloadCaratulaPdf(id: string): Promise<void> {
    const token = await getAuthToken();
    const url = `${API_BASE_URL}${API_PREFIX}/${id}/caratula-pdf`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      let msg = `Error ${response.status}`;
      try { const j = await response.json(); msg = j.message || msg; } catch {}
      throw new Error(msg);
    }
    const blob = await response.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    a.download = match ? match[1] : `caratula_${id}.pdf`;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  /**
   * Sincronizar detalle para varias pólizas (por defecto en cola).
   */
  async syncPolizasDetailBatch(body: {
    poliza_ids: number[];
    insurer_connection_id?: number;
    async?: boolean;
  }): Promise<
    ApiResponse<{
      async: boolean;
      results: Array<{
        poliza_id: number;
        success: boolean;
        queued?: boolean;
        error?: string;
        detail_sync_status?: string;
        detail_sync_error?: string | null;
      }>;
    }>
  > {
    return makeRequest(`${API_PREFIX}/sync-details-batch`, {
      method: 'POST',
      body: JSON.stringify({
        poliza_ids: body.poliza_ids,
        insurer_connection_id: body.insurer_connection_id,
        async: body.async !== false,
      }),
    });
  },

  /**
   * Encola sincronización de detalle. reset=true vuelve a sincronizar incluso las ya completadas.
   */
  async syncAllPolizasDetail(opts?: { syncSource?: string; reset?: boolean }): Promise<ApiResponse<{ queued: number; skipped: number; total: number }>> {
    return makeRequest(`${API_PREFIX}/sync-all-details`, {
      method: 'POST',
      body: JSON.stringify({
        ...(opts?.syncSource ? { sync_source: opts.syncSource } : {}),
        ...(opts?.reset ? { reset: true } : {}),
      }),
    });
  },

  /**
   * Cancela la sincronización de detalle pendiente (marca las no procesadas como canceladas).
   */
  async cancelDetailSync(): Promise<ApiResponse<{ cancelled: number }>> {
    return makeRequest(`${API_PREFIX}/cancel-detail-sync`, { method: 'POST', body: '{}' });
  },

  /**
   * Progreso de sincronización de detalles: pendientes, sincronizadas, fallidas, canceladas.
   */
  async getDetailSyncProgress(): Promise<ApiResponse<{
    total: number; synced: number; failed: number; cancelled: number; pending: number;
    bySource?: Record<string, { total: number; synced: number; failed: number; cancelled: number; pending: number; sample_error?: string | null }>;
  }>> {
    return makeRequest(`${API_PREFIX}/detail-sync-progress`);
  },

  /**
   * Obtener historial de renovaciones (contactos y eventos) de una póliza
   */
  async getHistorialRenovaciones(id: string): Promise<ApiResponse<any[]>> {
    try {
      const response = await makeRequest<any[]>(`${API_PREFIX}/${id}/renovaciones/historial`);
      return response;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al cargar historial de renovaciones',
        description: error instanceof Error ? error.message : 'Error desconocido',
      });
      throw error;
    }
  },

  // ===== Anexos =====
  async listarAnexos(polizaId: string): Promise<ApiResponse<any[]>> {
    return makeRequest<any[]>(`${API_PREFIX}/${polizaId}/anexos`);
  },

  async crearAnexo(polizaId: string, input: {
    numero_poliza: string;
    aseguradora: string;
    ramo: string;
    anexo: string;
    riesgo: string;
    fawf?: string;
    renovable?: boolean;
    motivo?: string;
    fecha_expedicion?: string;
    fecha_inicio: string;
    fecha_fin: string;
    fecha_recepcion?: string;
    prima: number;
    porcentaje_iva?: number;
    pri_a_pre?: number;
    iva?: number;
    porcentaje_comision?: number;
    comision?: number;
    total?: number;
    periodicidad_pago?: 'mensual' | 'trimestral' | 'semestral' | 'anual';
    forma_pago?: 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta' | 'financiacion';
    gastos_expedicion?: number;
    observaciones?: string;
    accesorios?: string;
    estado: 'ACTIVA' | 'VENCIDA' | 'CANCELADA' | 'SUSPENDIDA' | 'PENDIENTE';
  }): Promise<ApiResponse<any>> {
    return makeRequest<any>(`${API_PREFIX}/${polizaId}/anexos`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async actualizarAnexo(polizaId: string, anexoId: string, input: Partial<{
    aseguradora: string;
    ramo: string;
    anexo: string;
    riesgo: string;
    fawf?: string;
    motivo?: string;
    fecha_expedicion?: string;
    fecha_inicio: string;
    fecha_fin: string;
    fecha_recepcion?: string;
    renovable?: boolean;
    prima: number;
    porcentaje_iva?: number;
    pri_a_pre?: number;
    iva?: number;
    porcentaje_comision?: number;
    comision?: number;
    total?: number;
    periodicidad_pago?: 'mensual' | 'trimestral' | 'semestral' | 'anual';
    forma_pago?: 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta' | 'financiacion';
    gastos_expedicion?: number;
    observaciones?: string;
    accesorios?: string;
    estado: 'ACTIVA' | 'VENCIDA' | 'CANCELADA' | 'SUSPENDIDA' | 'PENDIENTE';
  }>): Promise<ApiResponse<any>> {
    return makeRequest<any>(`${API_PREFIX}/${polizaId}/anexos/${anexoId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  async eliminarAnexo(polizaId: string, anexoId: string): Promise<ApiResponse<any>> {
    return makeRequest<any>(`${API_PREFIX}/${polizaId}/anexos/${anexoId}`, {
      method: 'DELETE',
    });
  },

  async subirDocumentosAnexo(polizaId: string, anexoId: string, files: File[]): Promise<ApiResponse<any>> {
    try {
      const token = await getAuthToken();
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files[]', file);
      });

      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE_URL}${API_PREFIX}/${polizaId}/anexos/${anexoId}/documents`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        let message = 'Error al subir archivos';
        if (res.status === 401) message = 'No autorizado. Inicia sesión para subir archivos.';
        else if (res.status === 403) message = 'Permisos insuficientes para subir archivos.';
        else if (res.status === 413) message = 'Archivo demasiado grande (máx 20MB).';
        toast({ variant: 'destructive', title: 'Subir archivos', description: message });
        throw new Error(message);
      }
      
      const result = await res.json();
      toast({ 
        title: 'Archivos subidos', 
        description: 'Los archivos se han subido correctamente al anexo y a la póliza.',
        variant: 'default'
      });
      return result;
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      toast({ variant: 'destructive', title: 'Subir archivos', description: error.message || 'Error desconocido' });
      throw error;
    }
  },

  // ===== Documentos (Firebase Storage vía backend) =====
  async listarDocumentos(id: string): Promise<ApiResponse<any[]>> {
    try {
      const token = await getAuthToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE_URL}${API_PREFIX}/${id}/documents`, { headers });
      if (!res.ok) {
        let message = 'Error al listar documentos';
        if (res.status === 401) message = 'No autorizado. Inicia sesión para ver documentos.';
        else if (res.status === 403) message = 'Permisos insuficientes para listar documentos.';
        else if (res.status === 404) message = 'No se encontraron documentos.';
        toast({ variant: 'destructive', title: 'Documentos de póliza', description: message });
        throw new Error(message);
      }
      return res.json();
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      toast({ variant: 'destructive', title: 'Documentos de póliza', description: error.message || 'Error desconocido' });
      throw error;
    }
  },

  /**
   * Listar documentos globales de todas las pólizas del broker
   */
  async listarDocumentosGlobal(filters: { search?: string; type?: string; poliza_id?: string | number; per_page?: number; page?: number } = {}): Promise<ApiResponse<any>> {
    try {
      const token = await getAuthToken();
      const query = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query.append(key, String(value));
        }
      });
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE_URL}${API_PREFIX}/documents?${query.toString()}`, { headers });
      if (!res.ok) {
        const msg = res.status === 401
          ? 'No autorizado. Inicia sesión para ver documentos.'
          : res.status === 403
            ? 'Permisos insuficientes para ver documentos.'
            : 'Error al listar documentos';
        toast({ variant: 'destructive', title: 'Documentos', description: msg });
        throw new Error(msg);
      }
      return res.json();
    } catch (error) {
      if (error instanceof Error) {
        toast({ variant: 'destructive', title: 'Documentos', description: error.message || 'Error desconocido' });
      }
      throw error;
    }
  },

  async getSignedUrl(id: string, args: { path?: string; name?: string }): Promise<string> {
    const token = await getAuthToken();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const query = new URLSearchParams();
    if (args.path) query.set('path', args.path);
    if (args.name) query.set('name', args.name);

    // Try signed URL first (works for Firebase-hosted files)
    try {
      const res = await fetch(`${API_BASE_URL}${API_PREFIX}/${id}/documents/signed-url?${query.toString()}`, { headers });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success && data?.data?.url) {
        return data.data.url as string;
      }
    } catch {}

    // Fallback: stream endpoint (proxies through backend for SS-only files)
    try {
      const streamRes = await fetch(`${API_BASE_URL}${API_PREFIX}/${id}/documents/stream?${query.toString()}`, { headers });
      if (streamRes.ok) {
        const ct = streamRes.headers.get('Content-Type') || '';
        if (!ct.includes('application/json')) {
          const blob = await streamRes.blob();
          return URL.createObjectURL(blob);
        }
      }
    } catch {}

    toast({ variant: 'destructive', title: 'Abrir documento', description: 'No se pudo obtener el archivo.' });
    throw new Error('No se pudo obtener el archivo');
  },

  async eliminarDocumento(id: string, args: { path?: string; name?: string }): Promise<ApiResponse<any[]>> {
    const token = await getAuthToken();
    const query = new URLSearchParams();
    if (args.path) query.set('path', args.path);
    if (args.name) query.set('name', args.name);
    const res = await fetch(`${API_BASE_URL}${API_PREFIX}/${id}/documents?${query.toString()}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      const message = res.status === 401
        ? 'No autorizado para eliminar documentos.'
        : res.status === 403
          ? 'Permisos insuficientes para eliminar documentos.'
          : res.status === 404
            ? 'Documento no encontrado.'
            : 'Error al eliminar documento';
      toast({ variant: 'destructive', title: 'Eliminar documento', description: message });
      throw new Error(message);
    }
    return res.json();
  },

  async subirDocumento(
    id: string,
    files: File | File[],
    extra?: { type?: string },
    onProgress?: (p: { loaded: number; total: number; percent: number; index?: number; count?: number; file?: File }) => void
  ): Promise<ApiResponse<any[]>> {
    const token = await getAuthToken();
    const list = Array.isArray(files) ? files : [files];

    // Subida con progreso: si hay múltiples y se solicita progreso, subir secuencialmente por archivo
    const uploadSingle = (file: File, index: number, count: number): Promise<ApiResponse<any[]>> => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE_URL}${API_PREFIX}/${id}/documents`);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable && onProgress) {
            const percent = Math.round((evt.loaded / evt.total) * 100);
            onProgress({ loaded: evt.loaded, total: evt.total, percent, index, count, file });
          }
        };

        xhr.onreadystatechange = () => {
          if (xhr.readyState === 4) {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch (e) {
                resolve({ success: true, data: [] as any[] });
              }
            } else {
              let description = 'Error al subir archivo.';
              if (xhr.status === 413) description = 'Archivo demasiado grande (máx. 20 MB).';
              else if (xhr.status === 401) description = 'No autorizado. Inicia sesión para subir archivos.';
              else if (xhr.status === 403) description = 'Permisos insuficientes para subir archivos.';
              else if (xhr.status === 415) description = 'Tipo de archivo no soportado.';
              else if (xhr.status === 422) description = 'Validación fallida al subir archivo.';
              else if (xhr.status >= 500) description = 'Error del servidor al subir archivo.';
              toast({ variant: 'destructive', title: 'Subida de documento', description });
              try {
                const data = JSON.parse(xhr.responseText);
                reject(new Error(`${xhr.status} ${data.message || description}`));
              } catch (e) {
                reject(new Error(`${xhr.status} ${description}`));
              }
            }
          }
        };

        const formData = new FormData();
        formData.append('file', file);
        if (extra?.type) formData.append('type', extra.type);
        xhr.send(formData);
      });
    };

    if (onProgress && list.length > 1) {
      const aggregated: any[] = [];
      for (let i = 0; i < list.length; i++) {
        const res = await uploadSingle(list[i], i + 1, list.length);
        if (res?.data && Array.isArray(res.data)) aggregated.push(...res.data);
      }
      return { success: true, data: aggregated } as ApiResponse<any[]>;
    }

    if (onProgress && list.length === 1) {
      return uploadSingle(list[0], 1, 1);
    }

    // Sin progreso: enviar en un solo request (soporta múltiples)
    const formData = new FormData();
    if (list.length === 1) {
      formData.append('file', list[0]);
    } else {
      list.forEach((f) => formData.append('files[]', f));
    }
    if (extra?.type) formData.append('type', extra.type);

    const res = await fetch(`${API_BASE_URL}${API_PREFIX}/${id}/documents`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
      body: formData,
    });
    if (!res.ok) {
      let description = 'Error al subir archivo.';
      if (res.status === 413) description = 'Archivo demasiado grande (máx. 20 MB).';
      else if (res.status === 401) description = 'No autorizado. Inicia sesión para subir archivos.';
      else if (res.status === 403) description = 'Permisos insuficientes para subir archivos.';
      else if (res.status === 415) description = 'Tipo de archivo no soportado.';
      else if (res.status === 422) description = 'Validación fallida al subir archivo.';
      else if (res.status >= 500) description = 'Error del servidor al subir archivo.';
      toast({ variant: 'destructive', title: 'Subida de documento', description });
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || description);
    }
    return res.json();
  },

  /**
   * Crear una nueva póliza
   */
  async createPoliza(poliza: CreatePolizaInput): Promise<ApiResponse<Poliza>> {
    try {
      const response = await makeRequest<Poliza>(API_PREFIX, {
        method: 'POST',
        body: JSON.stringify(poliza),
      });

      if (response.success) {
        toast({
          title: "Póliza creada exitosamente",
          description: `La póliza ${poliza.numero_poliza} ha sido creada correctamente.`,
        });
      }

      return response;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al crear póliza",
        description: error instanceof Error ? error.message : "Error desconocido",
      });
      throw error;
    }
  },

  /**
   * Actualizar una póliza existente
   */
  async updatePoliza(id: string, poliza: Partial<Poliza>): Promise<ApiResponse<Poliza>> {
    try {
      const response = await makeRequest<Poliza>(`${API_PREFIX}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(poliza),
      });

      if (response.success) {
        toast({
          title: "Póliza actualizada exitosamente",
          description: `La póliza ha sido actualizada correctamente.`,
        });
      }

      return response;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al actualizar póliza",
        description: error instanceof Error ? error.message : "Error desconocido",
      });
      throw error;
    }
  },

  /**
   * Regenerar cuotas de cartera de una póliza desde periodicidad/vigencia.
   * Solo funciona si no hay pagos activos no anulados.
   */
  async regenerarCarteraCuotas(id: string, params?: { forma_pago?: string; cuotas?: number }): Promise<ApiResponse<any>> {
    try {
      return await makeRequest<any>(`${API_PREFIX}/${id}/regenerar-cartera-cuotas`, {
        method: 'POST',
        body: JSON.stringify(params || {}),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al regenerar cuotas",
        description: error instanceof Error ? error.message : "Error desconocido",
      });
      throw error;
    }
  },

  /**
   * Eliminar una póliza
   */
  async deletePoliza(id: string): Promise<ApiResponse<void>> {
    try {
      const response = await makeRequest<void>(`${API_PREFIX}/${id}`, {
        method: 'DELETE',
      });

      if (response.success) {
        toast({
          title: "Póliza eliminada exitosamente",
          description: "La póliza ha sido eliminada correctamente.",
        });
      }

      return response;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al eliminar póliza",
        description: error instanceof Error ? error.message : "Error desconocido",
      });
      throw error;
    }
  },

  /**
   * Cambiar estado de una póliza
   */
  async cambiarEstado(
    id: string,
    estado: 'ACTIVA' | 'VENCIDA' | 'CANCELADA' | 'SUSPENDIDA',
    motivo?: string,
    cancellationReason?: string,
  ): Promise<ApiResponse<Poliza>> {
    try {
      const body: any = { estado, motivo };
      if (cancellationReason) body.cancellation_reason = cancellationReason;
      const response = await makeRequest<Poliza>(`${API_PREFIX}/${id}/cambiar-estado`, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (response.success) {
        toast({
          title: "Estado actualizado exitosamente",
          description: `El estado de la póliza ha sido cambiado a ${estado}.`,
        });
      }

      return response;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al cambiar estado",
        description: error instanceof Error ? error.message : "Error desconocido",
      });
      throw error;
    }
  },

  /**
   * Catálogo de motivos de cancelación (constantes en el backend).
   */
  async getCancellationReasons(): Promise<Array<{ key: string; label: string }>> {
    try {
      const r = await makeRequest<Array<{ key: string; label: string }>>(
        `${API_PREFIX}/cancellation-reasons`,
        { method: 'GET' },
      );
      return (r as any)?.data || [];
    } catch {
      return [];
    }
  },

  async getNonRenewalReasons(): Promise<Array<{ key: string; label: string }>> {
    try {
      const r = await makeRequest<Array<{ key: string; label: string }>>(
        `${API_PREFIX}/non-renewal-reasons`,
        { method: 'GET' },
      );
      return (r as any)?.data || [];
    } catch {
      return [];
    }
  },

  /**
   * Buscar pólizas por cliente
   */
  async buscarPorCliente(_dni: string): Promise<ApiResponse<Poliza[]>> {
    try {
      const msg = 'Buscar por cliente no está disponible (endpoint no existe en backend).';
      toast({ variant: 'destructive', title: 'Función no disponible', description: msg });
      throw new Error(msg);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al buscar pólizas",
        description: error instanceof Error ? error.message : "Función no disponible",
      });
      throw error;
    }
  },

  /**
   * Obtener estadísticas de pólizas
   */
  async getEstadisticas(): Promise<ApiResponse<any>> {
    try {
      const response = await makeRequest<any>(`${API_PREFIX}/estadisticas`);
      return response;
    } catch (error) {
      throw error;
    }
  },

  /**
   * Obtener pólizas activas para siniestros
   */
  async getPolizasActivasParaSiniestros(): Promise<ApiResponse<any[]>> {
    try {
      const response = await makeRequest<any[]>(`${API_PREFIX}/activas-para-siniestros`);
      return response;
    } catch (error) {
      throw error;
    }
  },


  /**
   * Exportar pólizas a Excel o CSV
   */
  async exportarPolizas(filters: PolizaFilters = {}, formato: 'excel' | 'csv' = 'excel'): Promise<Blob> {
    try {
      const token = await getAuthToken();
      const queryParams = new URLSearchParams();

      // Agregar formato
      queryParams.append('formato', formato);

      // Agregar filtros - solo los que tienen valor
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });

      console.log('Exportar URL:', `${API_BASE_URL}${API_PREFIX}/exportar?${queryParams.toString()}`);

      const response = await fetch(`${API_BASE_URL}${API_PREFIX}/exportar?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/csv, application/json',
        },
      });

      // Si la respuesta es JSON, probablemente es un error
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al exportar datos');
      }

      if (!response.ok) {
        throw new Error(`Error ${response.status}: No se pudo exportar los datos`);
      }

      const blob = await response.blob();
      
      // Verificar que el blob no esté vacío
      if (blob.size < 100) {
        // Un archivo Excel/CSV válido debería tener al menos los headers
        console.warn('Blob muy pequeño:', blob.size, 'bytes');
      }
      
      return blob;
    } catch (error) {
      console.error('Error en exportarPolizas:', error);
      toast({
        variant: "destructive",
        title: "Error al exportar pólizas",
        description: error instanceof Error ? error.message : "Error desconocido",
      });
      throw error;
    }
  },

  /**
   * Exportar pólizas a Excel (método de compatibilidad)
   */
  async exportarExcel(filters: PolizaFilters = {}): Promise<Blob> {
    return this.exportarPolizas(filters, 'excel');
  },

  /**
   * Renovar una póliza
   */
  async renovarPoliza(id: string, nuevaFechaFin: string): Promise<ApiResponse<Poliza>> {
    try {
      const response = await makeRequest<Poliza>(`${API_PREFIX}/${id}/renovaciones/procesar`, {
        method: 'POST',
        body: JSON.stringify({ fecha_fin: nuevaFechaFin }),
      });

      if (response.success) {
        toast({
          title: "Póliza renovada exitosamente",
          description: "La póliza ha sido renovada correctamente.",
        });
      }

      return response;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al renovar póliza",
        description: error instanceof Error ? error.message : "Error desconocido",
      });
      throw error;
    }
  },

  /**
   * Obtener historial de cambios de una póliza
   */
  async getHistorial(_id: string): Promise<ApiResponse<any[]>> {
    try {
      const msg = 'Historial de póliza no está disponible (endpoint no existe en backend).';
      toast({ variant: 'destructive', title: 'Función no disponible', description: msg });
      throw new Error(msg);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al cargar historial",
        description: error instanceof Error ? error.message : "Función no disponible",
      });
      throw error;
    }
  },

  /**
   * Duplicar una póliza
   */
  async duplicarPoliza(_id: string): Promise<ApiResponse<Poliza>> {
    try {
      const msg = 'Duplicar póliza no está disponible (endpoint no existe en backend).';
      toast({ variant: 'destructive', title: 'Función no disponible', description: msg });
      throw new Error(msg);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al duplicar póliza",
        description: error instanceof Error ? error.message : "Función no disponible",
      });
      throw error;
    }
  },

  /**
   * Generar certificado de póliza
   */
  async generarCertificado(_id: string): Promise<Blob> {
    try {
      const msg = 'Generación de certificado no está disponible (endpoint no existe en backend).';
      toast({ variant: 'destructive', title: 'Función no disponible', description: msg });
      throw new Error(msg);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al generar certificado",
        description: error instanceof Error ? error.message : "Función no disponible",
      });
      throw error;
    }
  },

};

// Utilidades para pólizas
export const polizaUtils = {
  /**
   * Formatear moneda
   */
  formatCurrency: (amount: number): string => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  },

  /**
   * Formatear fecha (seguro para fechas ISO sin problemas de zona horaria)
   */
  formatDate: (date: string): string => {
    if (!date) return '-';
    
    // Si es una fecha ISO solo-fecha (YYYY-MM-DD), formatear manualmente
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [y, m, d] = date.split('-');
      const dd = d.padStart(2, '0');
      const mm = m.padStart(2, '0');
      return `${dd}/${mm}/${y}`;
    }
    
    // Si es una fecha ISO con hora, extraer solo la parte de fecha
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(date)) {
      const [datePart] = date.split('T');
      const [y, m, d] = datePart.split('-');
      const dd = d.padStart(2, '0');
      const mm = m.padStart(2, '0');
      return `${dd}/${mm}/${y}`;
    }
    
    try {
      const dt = new Date(date);
      if (isNaN(dt.getTime())) return date;
      
      // Formateo manual para evitar problemas de zona horaria
      const year = dt.getFullYear();
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      return `${day}/${month}/${year}`;
    } catch {
      return date;
    }
  },

  /**
   * Calcular días para vencimiento
   */
  getDiasVencimiento: (fechaFin: string): number => {
    const hoy = new Date();
    const vencimiento = new Date(fechaFin);
    const diferencia = vencimiento.getTime() - hoy.getTime();
    return Math.ceil(diferencia / (1000 * 3600 * 24));
  },

  /**
   * Verificar si está vencida
   */
  estaVencida: (fechaFin: string): boolean => {
    return new Date(fechaFin) < new Date();
  },

  /**
   * Verificar si está por vencer (próximos 30 días)
   */
  estaPorVencer: (fechaFin: string): boolean => {
    const dias = polizaUtils.getDiasVencimiento(fechaFin);
    return dias <= 30 && dias > 0;
  },

  /**
   * Obtener nombre completo del cliente
   */
  getNombreCompletoCliente: (poliza: Poliza): string => {
    return `${poliza.nombres_cliente} ${poliza.apellidos_cliente}`.trim();
  },

  /**
   * Obtener color del estado
   */
  getColorEstado: (estado: string): string => {
    const colores = {
      'ACTIVA': 'success',
      'VENCIDA': 'warning',
      'CANCELADA': 'failure',
      'SUSPENDIDA': 'gray'
    };
    return colores[estado as keyof typeof colores] || 'gray';
  }
}; 

// ===== Vinculados (Riesgos de pólizas colectivas) =====

export interface PolizaVinculado {
  id?: number;
  poliza_id?: number;
  identificador?: string;
  documento?: string;
  nombre_asegurado: string;
  valor?: number;
  valor_iva?: number;
  valor_total?: number;
  estado?: string;
  tipo_documento?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  ciudad?: string;
  observaciones?: string;
  metadata?: Record<string, any>;
}

export const vinculadosService = {
  async list(polizaId: string | number): Promise<{ success: boolean; data: PolizaVinculado[]; totales?: any }> {
    const response = await makeRequest<any>(`${API_PREFIX}/${polizaId}/vinculados`);
    return response as any;
  },

  async create(polizaId: string | number, data: Partial<PolizaVinculado>): Promise<{ success: boolean; data: PolizaVinculado; message?: string }> {
    const response = await makeRequest<any>(`${API_PREFIX}/${polizaId}/vinculados`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response as any;
  },

  async bulkCreate(polizaId: string | number, vinculados: Partial<PolizaVinculado>[]): Promise<{ success: boolean; data: PolizaVinculado[]; message?: string }> {
    const response = await makeRequest<any>(`${API_PREFIX}/${polizaId}/vinculados/bulk`, {
      method: 'POST',
      body: JSON.stringify({ vinculados }),
    });
    return response as any;
  },

  async update(polizaId: string | number, vinculadoId: number, data: Partial<PolizaVinculado>): Promise<{ success: boolean; data: PolizaVinculado; message?: string }> {
    const response = await makeRequest<any>(`${API_PREFIX}/${polizaId}/vinculados/${vinculadoId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response as any;
  },

  async remove(polizaId: string | number, vinculadoId: number): Promise<{ success: boolean; message?: string }> {
    const response = await makeRequest<any>(`${API_PREFIX}/${polizaId}/vinculados/${vinculadoId}`, {
      method: 'DELETE',
    });
    return response as any;
  },

  async bulkDelete(polizaId: string | number, ids: number[]): Promise<{ success: boolean; message?: string; deleted_count?: number }> {
    const response = await makeRequest<any>(`${API_PREFIX}/${polizaId}/vinculados/bulk-delete`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    });
    return response as any;
  },
};