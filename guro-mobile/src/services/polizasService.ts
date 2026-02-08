import api from '../config/api';

export interface Poliza {
  id: number;
  numero_poliza: string;
  cliente: string;
  cliente_documento: string;
  nombres_cliente: string;
  apellidos_cliente: string;
  nombre_completo_cliente: string;
  dni_cliente: string;
  aseguradora: string;
  aseguradora_nombre?: string;
  ramo: string;
  ramo_nombre: string;
  ramo_principal: string;
  subramo: string;
  tipo_poliza: string;
  estado: string;
  fecha_inicio: string;
  fecha_fin: string;
  fecha_expedicion: string;
  fecha_recepcion: string;
  prima_neta: number;
  prima_total: number;
  comision: number;
  valor_asegurado: number;
  descripcion: string;
  vendedor: string;
  created_at: string;
}

export interface PolizasResponse {
  success: boolean;
  message?: string;
  data: Poliza[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface PolizasParams {
  page?: number;
  per_page?: number;
  search?: string;
  estado?: string;
  aseguradora?: string;
  ramo?: string;
}

export const getPolizas = async (params: PolizasParams = {}): Promise<PolizasResponse> => {
  const queryParams = new URLSearchParams();
  
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.per_page) queryParams.append('per_page', params.per_page.toString());
  if (params.search) queryParams.append('search', params.search);
  if (params.estado) queryParams.append('estado', params.estado);
  if (params.aseguradora) queryParams.append('aseguradora', params.aseguradora);
  if (params.ramo) queryParams.append('ramo', params.ramo);
  
  const response = await api.get(`/saas/polizas?${queryParams.toString()}`);
  return response.data;
};

export const getPolizaById = async (id: number) => {
  const response = await api.get(`/saas/polizas/${id}`);
  return response.data;
};

export const getDocumentSignedUrl = async (polizaId: number, path: string) => {
  const response = await api.get(`/saas/polizas/${polizaId}/documents/signed-url?path=${encodeURIComponent(path)}`);
  return response.data;
};

export interface UpdatePolizaData {
  numero_poliza?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  fecha_expedicion?: string;
  fecha_recepcion?: string;
  prima_neta?: number;
  prima_total?: number;
  comision?: number;
  porcentaje_comision?: number;
  valor_asegurado?: number;
  observaciones?: string;
  descripcion?: string;
  estado?: string;
}

export const updatePoliza = async (id: number, data: UpdatePolizaData) => {
  const response = await api.put(`/saas/polizas/${id}`, data);
  return response.data;
};

export interface CreatePolizaData {
  numero_poliza: string;
  aseguradora: string;
  ramo_principal: string;
  subramo?: string;
  riesgo?: string;
  valor_riesgo_asegurado?: number;
  cliente_id?: number;
  nombres_cliente: string;
  apellidos_cliente?: string;
  dni_cliente: string;
  tipo_documento?: string;
  telefono_cliente?: string;
  celular_cliente?: string;
  correo_cliente?: string;
  domicilio?: string;
  prima_neta: number;
  porcentaje_comision?: number;
  comision?: number;
  porcentaje_iva?: number;
  iva?: number;
  total?: number;
  forma_pago?: string;
  periodicidad_pago?: string;
  medio_pago?: string;
  vendedor?: string;
  observaciones?: string;
  fecha_expedicion: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado?: string;
  renovable?: boolean;
}

export const createPoliza = async (data: CreatePolizaData) => {
  const response = await api.post('/saas/polizas', data);
  return response.data;
};

export interface CatalogoItem {
  id: number;
  nombre: string;
}

export const getAseguradoras = async (): Promise<CatalogoItem[]> => {
  try {
    const response = await api.get('/saas/catalogos/aseguradoras');
    return response.data?.data || [];
  } catch {
    return [];
  }
};

export const getRamos = async (): Promise<CatalogoItem[]> => {
  try {
    const response = await api.get('/saas/catalogos/ramos');
    return response.data?.data || [];
  } catch {
    return [];
  }
};

export interface PolizaDocument {
  name: string;
  path: string;
  size: number;
  contentType: string;
  url: string;
  uploaded_at: string;
  type: string;
}

export const getPolizaDocuments = async (polizaId: number): Promise<PolizaDocument[]> => {
  try {
    const response = await api.get(`/saas/polizas/${polizaId}/documents`);
    return response.data?.data || [];
  } catch {
    return [];
  }
};

export const getDocumentSignedUrlFresh = async (polizaId: number, path: string): Promise<string | null> => {
  try {
    const response = await api.get(`/saas/polizas/${polizaId}/documents/signed-url?path=${encodeURIComponent(path)}`);
    return response.data?.url || response.data?.data?.url || null;
  } catch {
    return null;
  }
};

export const getClientes = async (search?: string): Promise<any[]> => {
  try {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    const response = await api.get(`/saas/clientes${params}`);
    return response.data?.data || [];
  } catch {
    return [];
  }
};
