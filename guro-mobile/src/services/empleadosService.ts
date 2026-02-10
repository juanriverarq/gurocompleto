import api from '../config/api';

export interface Empleado {
  id: number;
  nombres: string;
  apellidos: string;
  tipo_documento: string;
  numero_documento: string;
  email: string;
  usuario: string;
  telefono?: string;
  celular?: string;
  fecha_nacimiento?: string;
  direccion?: string;
  ciudad?: string;
  cargo?: string;
  departamento?: string;
  fecha_ingreso?: string;
  estado: string;
  tipo_vinculacion: string;
  salario?: number;
  acceso_activo: boolean;
  rol_id?: number;
  observaciones?: string;
  broker_id: number;
  created_at: string;
  updated_at: string;
  rol?: {
    id: number;
    nombre: string;
    descripcion?: string;
  };
}

export interface EmpleadosResponse {
  success: boolean;
  message: string;
  data: Empleado[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
  };
}

export interface EmpleadoDetailResponse {
  success: boolean;
  message: string;
  data: Empleado;
}

export interface EmpleadosParams {
  page?: number;
  per_page?: number;
  search?: string;
  estado?: string;
  tipo_vinculacion?: string;
  rol_id?: number;
  acceso_activo?: boolean;
  sort_field?: string;
  sort_direction?: string;
}

export const getEmpleados = async (params: EmpleadosParams = {}): Promise<EmpleadosResponse> => {
  const queryParams = new URLSearchParams();
  
  if (params.page) queryParams.append('page', params.page.toString());
  if (params.per_page) queryParams.append('per_page', params.per_page.toString());
  if (params.search) queryParams.append('search', params.search);
  if (params.estado) queryParams.append('estado', params.estado);
  if (params.tipo_vinculacion) queryParams.append('tipo_vinculacion', params.tipo_vinculacion);
  if (params.rol_id) queryParams.append('rol_id', params.rol_id.toString());
  if (params.acceso_activo !== undefined) queryParams.append('acceso_activo', params.acceso_activo.toString());
  if (params.sort_field) queryParams.append('sort_field', params.sort_field);
  if (params.sort_direction) queryParams.append('sort_direction', params.sort_direction);
  
  const response = await api.get(`/saas/empleados?${queryParams.toString()}`);
  return response.data;
};

export const getEmpleado = async (id: number): Promise<EmpleadoDetailResponse> => {
  const response = await api.get(`/saas/empleados/${id}`);
  return response.data;
};

export const getEstados = async () => {
  const response = await api.get('/saas/empleados/estados');
  return response.data;
};

export const getTiposVinculacion = async () => {
  const response = await api.get('/saas/empleados/tipos-vinculacion');
  return response.data;
};

export const getTiposDocumento = async () => {
  const response = await api.get('/saas/empleados/tipos-documento');
  return response.data;
};

export const getRolesBroker = async () => {
  const response = await api.get('/saas/roles');
  return response.data;
};

export interface CreateEmpleadoData {
  nombres: string;
  apellidos: string;
  tipo_documento: string;
  numero_documento: string;
  email: string;
  usuario: string;
  telefono?: string;
  celular?: string;
  fecha_nacimiento?: string;
  direccion?: string;
  ciudad?: string;
  cargo?: string;
  departamento?: string;
  fecha_ingreso?: string;
  estado: string;
  tipo_vinculacion: string;
  salario?: number;
  acceso_activo: boolean;
  rol_id?: number;
  observaciones?: string;
  password?: string;
  password_confirmation?: string;
}

export const createEmpleado = async (data: CreateEmpleadoData): Promise<EmpleadoDetailResponse> => {
  const response = await api.post('/saas/empleados', data);
  return response.data;
};

export const updateEmpleado = async (id: number, data: Partial<CreateEmpleadoData>): Promise<EmpleadoDetailResponse> => {
  const response = await api.put(`/saas/empleados/${id}`, data);
  return response.data;
};

export const deleteEmpleado = async (id: number) => {
  const response = await api.delete(`/saas/empleados/${id}`);
  return response.data;
};
