import api from '../config/api';

export interface Cliente {
  id: number;
  nombre: string;
  apellidos: string;
  cuit: string;
  tipo_documento: string;
  email_principal: string;
  celular_principal: string;
  telefono: string;
  ciudad: string;
  estado: string;
  client_type: string;
  empresa: string;
}

export interface ClientesResponse {
  success: boolean;
  message?: string;
  data: Cliente[];
  total: number;
}

export interface ClientesParams {
  page?: number;
  per_page?: number;
  search?: string;
  tipo?: string;
  estado?: string;
}

export const getClientes = async (params: ClientesParams = {}): Promise<ClientesResponse> => {
  const queryParams = new URLSearchParams();
  
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.per_page) queryParams.append('per_page', params.per_page.toString());
  if (params.search) queryParams.append('search', params.search);
  if (params.tipo) queryParams.append('tipo', params.tipo);
  if (params.estado) queryParams.append('estado', params.estado);
  
  const response = await api.get(`/saas/clientes/all?${queryParams.toString()}`);
  return response.data;
};

export const getClienteById = async (id: number) => {
  const response = await api.get(`/saas/clientes/${id}`);
  return response.data;
};

export interface UpdateClienteData {
  nombre?: string;
  apellidos?: string;
  email_principal?: string;
  celular_principal?: string;
  telefono?: string;
  domicilio_principal?: string;
  ciudad?: string;
  departamento?: string;
  fecha_nacimiento?: string;
  observaciones?: string;
  documento?: string;
  tipo_documento?: string;
  empresa?: string;
}

export const updateCliente = async (id: number, data: UpdateClienteData) => {
  const response = await api.put(`/saas/clientes/${id}`, data);
  return response.data;
};

export interface CreateClienteData {
  client_type: 'persona' | 'empresa';
  // Persona
  nombre?: string;
  apellidos?: string;
  // Empresa
  empresa?: string;
  razon_social?: string;
  representante_legal?: string;
  representante_legal_tipo_documento?: string;
  representante_legal_documento?: string;
  // Documento
  tipo_documento: string;
  documento: string;
  // Contacto
  email_principal: string;
  celular_principal: string;
  telefono_secundario?: string;
  // Dirección
  direccion: string;
  ciudad?: string;
  departamento?: string;
  pais?: string;
  // Datos adicionales
  fecha_nacimiento?: string;
  genero?: string;
  actividad?: string;
  observaciones?: string;
  estado?: string;
  sede?: string;
}

export const createCliente = async (data: CreateClienteData) => {
  const response = await api.post('/saas/clientes', data);
  return response.data;
};

export const deleteCliente = async (id: number) => {
  const response = await api.delete(`/saas/clientes/${id}`);
  return response.data;
};
