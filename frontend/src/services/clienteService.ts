import { toast } from 'src/hooks/use-toast';
import { auth } from '../config/firebase';

// Tipos para los clientes
export interface Cliente {
  id?: string;
  client_type?: 'persona' | 'empresa';
  nombre: string;
  apellidos: string;
  cuit: string;
  tipo_documento: string;
  fecha_expedicion_documento?: string;
  fecha_nacimiento?: string;
  genero?: string;
  domicilio_principal: string;
  celular_principal: string;
  email_principal: string;
  actividad?: string;
  ciudad?: string;
  department?: string; // Departamento
  branch_name?: string;
  estado: 'activo' | 'inactivo' | 'prospecto' | 'active' | 'inactive' | 'prospect' | 'blocked';
  observaciones?: string;
  razon_social?: string;
  representante_legal?: string;
  representante_legal_tipo_documento?: string;
  representante_legal_documento?: string;
  created_at?: string;
  updated_at?: string;
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
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api';

// Usar las nuevas rutas SaaS
const API_PREFIX = '/saas/clientes';

// Helper para obtener el token de autenticación Firebase (CON DEBUG COMO WHATSAPP SERVICE)
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
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken();

    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    } else {
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

// Servicio de clientes
export const clienteService = {
  async getCliente(clienteId: string): Promise<ApiResponse<Cliente>> {
    const endpoint = `${API_PREFIX}/${clienteId}`;
    const res = await makeRequest<any>(endpoint);
    if (!res.success || !res.data) return res as any;
    const d = res.data as any;
    const mapped: Cliente = {
      id: d.id?.toString?.() || clienteId,
      client_type: (d.client_type || d.tipo || (d.empresa || d.company ? 'empresa' : 'persona'))
        ?.toString()
        ?.toLowerCase?.(),
      nombre:
        d.nombre ||
        d.first_name ||
        d.persona?.nombres ||
        d.empresa?.razon_social ||
        d.company_legal_name ||
        '',
      apellidos: d.apellidos || d.last_name || d.persona?.apellidos || '',
      cuit: d.cuit || d.documento || d.document_number || d.empresa?.nit || '',
      tipo_documento:
        d.tipo_documento ||
        d.document_type ||
        d.persona?.tipo_documento ||
        (d.client_type === 'empresa' || d.tipo === 'EMPRESA' ? 'NIT' : ''),
      fecha_expedicion_documento:
        d.fecha_expedicion_documento || d.document_issue_date || undefined,
      fecha_nacimiento:
        d.fecha_nacimiento || d.birth_date || d.persona?.fecha_nacimiento || undefined,
      genero: d.genero || d.gender || d.persona?.genero || undefined,
      domicilio_principal: d.domicilio_principal || d.address || '',
      celular_principal: d.celular_principal || d.mobile_phone || '',
      email_principal: d.email_principal || d.email || '',
      actividad: d.actividad || d.empresa?.actividad_economica || '',
      ciudad: d.ciudad || d.city || '',
      department: d.department || d.state || d.departamento || '',
      branch_name: d.branch_name || d.sede || '',
      estado: (d.estado || d.status || 'prospecto').toString().toLowerCase(),
      observaciones: d.observaciones || d.notes || '',
      razon_social: d.razon_social || d.company_legal_name || d.empresa?.razon_social || undefined,
      representante_legal:
        d.representante_legal ||
        d.legal_representative_name ||
        d.empresa?.representante_legal ||
        undefined,
      representante_legal_tipo_documento:
        d.representante_legal_tipo_documento || d.legal_representative_document_type || undefined,
      representante_legal_documento:
        d.representante_legal_documento || d.legal_representative_document_number || undefined,
    };
    return { success: true, data: mapped } as ApiResponse<Cliente>;
  },
  async createCliente(
    cliente: Omit<Cliente, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<ApiResponse<Cliente>> {
    try {
      const endpoint = `${API_PREFIX}`;
      // Mapear payload según tipo y estructura esperada por el backend
      const payload: any = {
        client_type: cliente.client_type || 'persona',
        first_name: cliente.nombre,
        last_name: cliente.apellidos,
        document_number: cliente.cuit, // Mapear cuit a document_number
        document_type: cliente.tipo_documento,
        document_issue_date: cliente.fecha_expedicion_documento,
        birth_date: cliente.fecha_nacimiento,
        gender: cliente.genero,
        address: cliente.domicilio_principal,
        mobile_phone: cliente.celular_principal,
        email: cliente.email_principal,
        occupation: cliente.actividad,
        city: cliente.ciudad,
        department: cliente.department,
        branch_name: cliente.branch_name,
        status: cliente.estado,
        notes: cliente.observaciones,
      };

      if (cliente.client_type === 'empresa') {
        payload.company = cliente.razon_social ?? cliente.nombre;
        payload.company_legal_name = cliente.razon_social ?? cliente.nombre;
        payload.legal_representative_name = cliente.representante_legal;
        payload.legal_representative_document_type = cliente.representante_legal_tipo_documento;
        payload.legal_representative_document_number = cliente.representante_legal_documento;
      }

      const response = await makeRequest<Cliente>(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      toast({
        variant: 'primary',
        title: 'Cliente creado',
        description: 'El cliente se ha creado exitosamente.',
      });

      return response;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al crear cliente',
        description: error instanceof Error ? error.message : 'Error desconocido',
      });
      throw error;
    }
  },

  async updateCliente(
    clienteId: string,
    cliente: Partial<Omit<Cliente, 'id' | 'created_at' | 'updated_at'>>,
  ): Promise<ApiResponse<Cliente>> {
    try {
      const endpoint = `${API_PREFIX}/${clienteId}`;
      // Mapear payload según estructura esperada por el backend
      const payload: any = {};

      if (cliente.client_type !== undefined) payload.client_type = cliente.client_type;
      if (cliente.nombre !== undefined) payload.first_name = cliente.nombre;
      if (cliente.apellidos !== undefined) payload.last_name = cliente.apellidos;
      if (cliente.cuit !== undefined) payload.document_number = cliente.cuit;
      if (cliente.tipo_documento !== undefined) payload.document_type = cliente.tipo_documento;
      if (cliente.fecha_expedicion_documento !== undefined)
        payload.document_issue_date = cliente.fecha_expedicion_documento;
      if (cliente.fecha_nacimiento !== undefined) payload.birth_date = cliente.fecha_nacimiento;
      if (cliente.genero !== undefined) payload.gender = cliente.genero;
      if (cliente.domicilio_principal !== undefined) payload.address = cliente.domicilio_principal;
      if (cliente.celular_principal !== undefined) payload.mobile_phone = cliente.celular_principal;
      if (cliente.email_principal !== undefined) payload.email = cliente.email_principal;
      if (cliente.actividad !== undefined) payload.occupation = cliente.actividad;
      if (cliente.ciudad !== undefined) payload.city = cliente.ciudad;
      if (cliente.department !== undefined) payload.department = cliente.department;
      if (cliente.branch_name !== undefined) payload.branch_name = cliente.branch_name;
      if (cliente.estado !== undefined) payload.status = cliente.estado;
      if (cliente.observaciones !== undefined) payload.notes = cliente.observaciones;

      if (cliente.client_type === 'empresa') {
        if (cliente.razon_social !== undefined) {
          payload.company = cliente.razon_social;
          payload.company_legal_name = cliente.razon_social;
        }
        if (cliente.representante_legal !== undefined)
          payload.legal_representative_name = cliente.representante_legal;
        if (cliente.representante_legal_tipo_documento !== undefined)
          payload.legal_representative_document_type = cliente.representante_legal_tipo_documento;
        if (cliente.representante_legal_documento !== undefined)
          payload.legal_representative_document_number = cliente.representante_legal_documento;
      }

      const response = await makeRequest<Cliente>(endpoint, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      toast({
        variant: 'primary',
        title: 'Cliente actualizado',
        description: 'El cliente se ha actualizado correctamente.',
      });

      return response;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al actualizar cliente',
        description: error instanceof Error ? error.message : 'Error desconocido',
      });
      throw error;
    }
  },

  async getClientes(
    filters: Record<string, any> = {},
    options: RequestInit = {},
  ): Promise<ApiResponse<PaginatedResponse<Cliente>>> {
    try {
      const queryParams = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      const endpoint = `${API_PREFIX}?${queryParams.toString()}`;

      // Hacer la petición cruda (cubre respuestas con o sin "success")
      const raw: any = await makeRequest<any>(endpoint, options);

      // Si ya viene con success + data paginada, devolver tal cual
      if (raw && raw.success === true && raw.data) {
        return raw as ApiResponse<PaginatedResponse<Cliente>>;
      }

      // Normalizar diferentes formatos de paginación Laravel
      let paginated: PaginatedResponse<Cliente> | null = null;

      // Caso 1: Estructura Laravel Paginator directa (sin envolvente)
      // { data: [...], current_page, last_page, per_page, total, from, to }
      if (
        raw &&
        Array.isArray(raw.data) &&
        (raw.current_page !== undefined || raw.last_page !== undefined)
      ) {
        paginated = {
          data: raw.data || [],
          current_page: Number(raw.current_page ?? 1),
          last_page: Number(raw.last_page ?? 1),
          per_page: Number(raw.per_page ?? raw.data?.length ?? 0),
          total: Number(raw.total ?? raw.data?.length ?? 0),
          from: Number(raw.from ?? (raw.data?.length ? 1 : 0)),
          to: Number(raw.to ?? raw.data?.length ?? 0),
        };
      }
      // Caso 2: Envolvente con data.data (Laravel Resource)
      // { data: { data: [...], current_page, last_page, ... } }
      else if (raw && raw.data && Array.isArray(raw.data.data)) {
        const d = raw.data;
        paginated = {
          data: d.data || [],
          current_page: Number(d.current_page ?? 1),
          last_page: Number(d.last_page ?? 1),
          per_page: Number(d.per_page ?? d.data?.length ?? 0),
          total: Number(d.total ?? d.data?.length ?? 0),
          from: Number(d.from ?? (d.data?.length ? 1 : 0)),
          to: Number(d.to ?? d.data?.length ?? 0),
        };
      }
      // Caso 3: Array plano (sin metadatos)
      else if (Array.isArray(raw)) {
        paginated = {
          data: raw,
          current_page: 1,
          last_page: 1,
          per_page: raw.length,
          total: raw.length,
          from: raw.length ? 1 : 0,
          to: raw.length,
        };
      }

      // Si no fue posible normalizar, intentar fallback mínimo
      if (!paginated) {
        const maybeArray = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
        paginated = {
          data: maybeArray || [],
          current_page: Number(raw?.current_page ?? 1),
          last_page: Number(raw?.last_page ?? 1),
          per_page: Number(raw?.per_page ?? maybeArray?.length ?? 0),
          total: Number(raw?.total ?? maybeArray?.length ?? 0),
          from: Number(raw?.from ?? (maybeArray?.length ? 1 : 0)),
          to: Number(raw?.to ?? maybeArray?.length ?? 0),
        };
      }

      return { success: true, data: paginated };
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error al cargar clientes',
        description: error instanceof Error ? error.message : 'Error desconocido',
      });
      throw error;
    }
  },

  async getAllClientes(): Promise<ApiResponse<Cliente[]>> {
    try {
      // Intentar primero el endpoint optimizado sin paginación
      const allEndpoint = `/saas/clientes/all`;
      try {
        const allRes = await makeRequest<any>(allEndpoint);
        if (allRes.success && Array.isArray(allRes.data)) {
          return {
            success: true,
            data: allRes.data,
          };
        }
      } catch (_e) {
        // Silenciar y probar fallback
      }

      // Fallback: usar listado paginado con per_page alto
      const paginatedEndpoint = `/saas/clientes?per_page=20000&page=1`;
      const response = await makeRequest<any>(paginatedEndpoint);
      if (response.data && Array.isArray(response.data)) {
        return {
          success: true,
          data: response.data,
        };
      }

      return {
        success: false,
        data: [],
        message: 'No se encontraron clientes en la respuesta',
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        message: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  },

  async exportarClientes(
    filters: Record<string, any> = {},
    formato: 'excel' | 'csv' = 'excel',
  ): Promise<void> {
    try {
      const queryParams = new URLSearchParams();

      // El backend expone la ruta de exportación por path (exportar/excel).
      // No es necesario enviar el formato en query params.

      // Agregar filtros
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });

      // El backend actual solo expone /saas/clientes/exportar/excel
      const basePath = '/saas/clientes/exportar/excel';
      const endpoint = `${basePath}?${queryParams.toString()}`;

      // Obtener token de autenticación
      const token = await getAuthToken();

      // Crear headers
      const headers: HeadersInit = {
        Accept:
          formato === 'excel'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const url = `${API_BASE_URL}${endpoint}`;

      // Hacer la petición
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      // Obtener el blob del archivo
      const blob = await response.blob();

      // Crear URL para descarga
      const downloadUrl = window.URL.createObjectURL(blob);

      // Crear elemento de enlace para descarga
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `clientes_${new Date().toISOString().split('T')[0]}.${
        formato === 'excel' ? 'xlsx' : 'csv'
      }`;

      // Agregar al DOM y hacer clic
      document.body.appendChild(link);
      link.click();

      // Limpiar
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast({
        variant: 'primary',
        title: 'Exportación completada',
        description: `Los clientes se han exportado exitosamente en formato ${formato.toUpperCase()}.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error en exportación',
        description: error instanceof Error ? error.message : 'Error desconocido',
      });
      throw error;
    }
  },

  // Verificar si existe un cliente con el mismo documento (cédula/NIT)
  async checkDocumentExists(
    documentNumber: string,
    excludeId?: string
  ): Promise<{ exists: boolean; cliente?: Cliente }> {
    try {
      if (!documentNumber || documentNumber.trim().length < 5) {
        return { exists: false };
      }
      
      console.log('🔍 Verificando documento duplicado:', documentNumber.trim());
      
      const response = await this.getClientes({ 
        document_number: documentNumber.trim(),
        per_page: 1 
      });
      
      console.log('🔍 Respuesta de verificación:', response);
      
      // Manejar diferentes estructuras de respuesta
      let clientes: Cliente[] = [];
      if (response.success && response.data) {
        if (Array.isArray(response.data)) {
          clientes = response.data;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          clientes = response.data.data;
        }
      }
      
      console.log('🔍 Clientes encontrados:', clientes.length);
      
      if (clientes.length > 0) {
        const found = clientes[0];
        // Si estamos editando, excluir el cliente actual
        if (excludeId && String(found.id) === String(excludeId)) {
          return { exists: false };
        }
        return { exists: true, cliente: found };
      }
      
      return { exists: false };
    } catch (error) {
      console.warn('Error verificando documento duplicado:', error);
      return { exists: false };
    }
  },
};
