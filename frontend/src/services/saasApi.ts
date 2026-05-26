import {
  BrokerTenant,
  UsuarioSaaS,
  ClienteSaaS,
  RolPersonalizado,
  ClienteFilters,
  UsuarioFilters,
  ApiResponse,
  PaginatedResponse,
} from '../types/saas';
import { auth } from '../config/firebase';

// Configuración base de la API
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';

class SaasApiService {
  async getAuthHeaders(): Promise<HeadersInit> {
    let token: string | null = null;

    // 1) Firebase ID token (usuarios SaaS) - FORZAR REFRESH PARA EVITAR EXPIRACIÓN
    try {
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken(true); // true = force refresh
      }
    } catch { }

    // 2) Token de empleado (Laravel) emitido por EmpleadoAuthController
    if (!token) {
      token = localStorage.getItem('empleado_token');
    }

    // 3) Token SaaS propio (si existiera)
    if (!token) {
      token = localStorage.getItem('saas_token');
    }

    // 4) DEV_BYPASS (solo desarrollo)
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
  }

  // Obtener headers SOLO de autenticación (sin Content-Type, para usar con FormData)
  async getAuthHeadersOnly(): Promise<Record<string, string>> {
    const headers = await this.getAuthHeaders();
    const result: Record<string, string> = {};

    // Copiar solo Authorization y otros headers, pero NO Content-Type
    Object.entries(headers).forEach(([key, value]) => {
      if (key.toLowerCase() !== 'content-type' && typeof value === 'string') {
        result[key] = value;
      }
    });

    return result;
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    if (!response.ok) {
      let message = `Error HTTP: ${response.status}`;
      let errorData: any = {};
      try {
        errorData = await response.json();
        if (errorData?.message) message = errorData.message;
      } catch { }

      if (response.status === 401 || response.status === 403) {
        // Token expirado o inválido. No forzar redirección aquí; dejar que la UI decida la ruta de login.
        localStorage.removeItem('saas_token');
        const err: any = new Error('Unauthenticated');
        err.status = response.status;
        err.code = 'UNAUTHENTICATED';
        err.details = message;
        throw err;
      }

      const err: any = new Error(message);
      err.status = response.status;
      err.details = errorData;
      throw err;
    }

    return await response.json();
  }

  // ===== AUTENTICACIÓN =====

  async login(
    email: string,
    password: string,
  ): Promise<
    ApiResponse<{
      token: string;
      usuario: UsuarioSaaS;
      tenant: BrokerTenant;
    }>
  > {
    const response = await fetch(`${API_BASE_URL}/saas/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    return this.handleResponse(response);
  }

  // Obtener todos los clientes sin paginar (si el backend expone este endpoint)
  async getClientesAll(): Promise<{ success: boolean; data?: any[]; message?: string }> {
    const headers = await this.getAuthHeaders();
    // Intentar endpoint principal
    try {
      const res = await fetch(`${API_BASE_URL}/saas/clientes/all`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.data)) {
          return { success: true, data: json.data };
        }
        if (Array.isArray(json)) {
          return { success: true, data: json };
        }
      }
    } catch { }
    // Fallback temporal
    try {
      const res = await fetch(`${API_BASE_URL}/saas/clientes/all-temp`, { headers });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json?.data)) {
          return { success: true, data: json.data };
        }
        if (Array.isArray(json)) {
          return { success: true, data: json };
        }
      }
    } catch { }
    return { success: false, message: 'Endpoint all no disponible' };
  }

  async logout(): Promise<ApiResponse<void>> {
    const response = await fetch(`${API_BASE_URL}/saas/logout`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async getMe(): Promise<
    ApiResponse<{
      usuario: UsuarioSaaS;
      tenant: BrokerTenant;
    }>
  > {
    const response = await fetch(`${API_BASE_URL}/saas/me`, {
      headers: await this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // ===== TENANTS =====

  async getTenant(id: string): Promise<ApiResponse<BrokerTenant>> {
    const response = await fetch(`${API_BASE_URL}/saas/tenants/${id}`, {
      headers: await this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // ===== CATÁLOGOS ADMIN (ASEGURADORAS, RAMOS, SEDES, VENDEDORES) =====

  async getAseguradoras(): Promise<ApiResponse<PaginatedResponse<any>>> {
    const headers = await this.getAuthHeaders();
    // Intentar primero la ruta de catálogos
    let response = await fetch(`${API_BASE_URL}/saas/catalogos/aseguradoras?per_page=999999`, {
      headers,
    });
    // Fallback a ruta directa si está habilitada
    if (response.status === 404) {
      response = await fetch(`${API_BASE_URL}/saas/aseguradoras?per_page=999999`, { headers });
    }
    // Fallback a ruta temporal de debug
    if (response.status === 404) {
      response = await fetch(`${API_BASE_URL}/saas/temp-catalogos/aseguradoras`, { headers });
    }
    return this.handleResponse(response);
  }

  async bulkDeleteAseguradoras(params: { delete_all?: boolean; ids?: string[] }): Promise<ApiResponse<{ deleted_count: number }>> {
    const response = await fetch(`${API_BASE_URL}/saas/aseguradoras/bulk-delete`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(params),
    });
    return this.handleResponse(response);
  }

  async getRamos(): Promise<ApiResponse<PaginatedResponse<any>>> {
    const headers = await this.getAuthHeaders();
    // Intentar primero la ruta de catálogos
    let response = await fetch(`${API_BASE_URL}/saas/catalogos/ramos?per_page=999999`, { headers });
    // Fallback a ruta directa si está habilitada
    if (response.status === 404) {
      response = await fetch(`${API_BASE_URL}/saas/ramos?per_page=999999`, { headers });
    }
    // Fallback a ruta temporal de debug
    if (response.status === 404) {
      response = await fetch(`${API_BASE_URL}/saas/temp-catalogos/ramos`, { headers });
    }
    return this.handleResponse(response);
  }

  async bulkDeleteRamos(params: { delete_all?: boolean; ids?: string[] }): Promise<ApiResponse<{ deleted_count: number }>> {
    const response = await fetch(`${API_BASE_URL}/saas/ramos/bulk-delete`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(params),
    });
    return this.handleResponse(response);
  }

  async getSedes(): Promise<ApiResponse<PaginatedResponse<any>>> {
    const headers = await this.getAuthHeaders();
    // Intentar primero la ruta de catálogos
    let response = await fetch(`${API_BASE_URL}/saas/catalogos/sedes?per_page=999999`, { headers });
    // Fallback a ruta directa si está habilitada
    if (response.status === 404) {
      response = await fetch(`${API_BASE_URL}/saas/sedes?per_page=999999`, { headers });
    }
    // Fallback a ruta temporal de debug
    if (response.status === 404) {
      response = await fetch(`${API_BASE_URL}/saas/temp-catalogos/sedes`, { headers });
    }
    return this.handleResponse(response);
  }

  async getVendedores(): Promise<ApiResponse<PaginatedResponse<any>>> {
    const headers = await this.getAuthHeaders();
    // Intentar primero la ruta de catálogos
    let response = await fetch(`${API_BASE_URL}/saas/catalogos/vendedores?per_page=999999`, {
      headers,
    });
    // Fallback a ruta directa si está habilitada
    if (response.status === 404) {
      response = await fetch(`${API_BASE_URL}/saas/vendedores?per_page=999999`, { headers });
    }
    // Fallback a ruta temporal de debug
    if (response.status === 404) {
      response = await fetch(`${API_BASE_URL}/saas/temp-catalogos/vendedores`, { headers });
    }
    return this.handleResponse(response);
  }

  async getEstadosSiniestros(): Promise<ApiResponse<PaginatedResponse<any>>> {
    const headers = await this.getAuthHeaders();
    // Intentar primero la ruta de catálogos
    let response = await fetch(
      `${API_BASE_URL}/saas/catalogos/estados-siniestros?per_page=999999`,
      { headers },
    );
    // Fallback a ruta directa
    if (response.status === 404) {
      response = await fetch(`${API_BASE_URL}/saas/estados-siniestros?per_page=999999`, {
        headers,
      });
    }
    return this.handleResponse(response);
  }

  async getCoberturas(): Promise<ApiResponse<PaginatedResponse<any>>> {
    const headers = await this.getAuthHeaders();
    // Intentar primero la ruta de catálogos
    let response = await fetch(`${API_BASE_URL}/saas/catalogos/coberturas?per_page=999999`, {
      headers,
    });
    // Fallback a ruta directa
    if (response.status === 404) {
      response = await fetch(`${API_BASE_URL}/saas/coberturas?per_page=999999`, { headers });
    }
    return this.handleResponse(response);
  }

  async updateTenant(id: string, data: Partial<BrokerTenant>): Promise<ApiResponse<BrokerTenant>> {
    const response = await fetch(`${API_BASE_URL}/saas/tenants/${id}`, {
      method: 'PUT',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse(response);
  }

  async updateTenantBranding(
    id: string,
    branding: BrokerTenant['branding'],
  ): Promise<ApiResponse<BrokerTenant>> {
    const response = await fetch(`${API_BASE_URL}/saas/tenants/${id}/branding`, {
      method: 'PUT',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify({ branding }),
    });

    return this.handleResponse(response);
  }

  // ===== USUARIOS =====

  async getUsuarios(
    filters: UsuarioFilters = {},
  ): Promise<ApiResponse<PaginatedResponse<UsuarioSaaS>>> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, value.toString());
      }
    });

    const headers = await this.getAuthHeaders();

    // Intento principal
    let response = await fetch(`${API_BASE_URL}/saas/usuarios?${params}`, { headers });
    // Fallback a /admin/users si no existe la ruta SaaS
    if (response.status === 404) {
      response = await fetch(`${API_BASE_URL}/admin/users?${params}`, { headers });
    }

    return this.handleResponse(response);
  }

  async getUsuario(id: string): Promise<ApiResponse<UsuarioSaaS>> {
    const headers = await this.getAuthHeaders();

    let response = await fetch(`${API_BASE_URL}/saas/usuarios/${id}`, { headers });
    if (response.status === 404) {
      response = await fetch(`${API_BASE_URL}/admin/users/${id}`, { headers });
    }

    return this.handleResponse(response);
  }

  async createUsuario(
    data: Omit<UsuarioSaaS, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<ApiResponse<UsuarioSaaS>> {
    const headers = await this.getAuthHeaders();

    let response = await fetch(`${API_BASE_URL}/saas/usuarios`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (response.status === 404) {
      response = await fetch(`${API_BASE_URL}/admin/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
    }

    return this.handleResponse(response);
  }

  async updateUsuario(id: string, data: Partial<UsuarioSaaS>): Promise<ApiResponse<UsuarioSaaS>> {
    const headers = await this.getAuthHeaders();

    let response = await fetch(`${API_BASE_URL}/saas/usuarios/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });

    if (response.status === 404) {
      response = await fetch(`${API_BASE_URL}/admin/users/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });
    }

    return this.handleResponse(response);
  }

  async deleteUsuario(id: string): Promise<ApiResponse<void>> {
    const headers = await this.getAuthHeaders();

    let response = await fetch(`${API_BASE_URL}/saas/usuarios/${id}`, {
      method: 'DELETE',
      headers,
    });

    if (response.status === 404) {
      response = await fetch(`${API_BASE_URL}/admin/users/${id}`, {
        method: 'DELETE',
        headers,
      });
    }

    return this.handleResponse(response);
  }

  async updateUsuarioPermisos(
    id: string,
    permisos: UsuarioSaaS['permisos'],
  ): Promise<ApiResponse<UsuarioSaaS>> {
    const headers = await this.getAuthHeaders();

    let response = await fetch(`${API_BASE_URL}/saas/usuarios/${id}/permisos`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ permisos }),
    });

    if (response.status === 404) {
      // No hay endpoint equivalente en /admin/users para permisos
      // Lanzamos error claro para que el UI maneje este caso
      throw new Error('El endpoint de permisos no está disponible en esta API');
    }

    return this.handleResponse(response);
  }

  // ===== CLIENTES =====

  async getClientes(
    filters: ClienteFilters = {},
    signal?: AbortSignal,
  ): Promise<ApiResponse<PaginatedResponse<ClienteSaaS>>> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          value.forEach((v) => params.append(`${key}[]`, v));
        } else {
          params.append(key, value.toString());
        }
      }
    });

    // Compatibilidad de búsqueda avanzada: si vienen nombres/apellidos, agrega alias conocidos
    const nombres = (filters as any).nombres as string | undefined;
    const apellidos = (filters as any).apellidos as string | undefined;
    const documento = (filters as any).documento as string | undefined;
    const razonSocial = (filters as any).razon_social as string | undefined;
    const companyLegal = (filters as any).company_legal_name as string | undefined;
    const empresa = (filters as any).empresa as string | undefined;
    if (nombres) params.append('first_name', nombres);
    if (apellidos) params.append('last_name', apellidos);
    if (documento) {
      params.append('document', documento);
      params.append('numero_documento', documento);
    }
    if (razonSocial) params.append('razon_social', razonSocial);
    if (companyLegal) params.append('company_legal_name', companyLegal);
    if (empresa) params.append('empresa', empresa);

    const response = await fetch(`${API_BASE_URL}/saas/clientes?${params}`, {
      headers: await this.getAuthHeaders(),
      signal,
    });

    return this.handleResponse(response);
  }

  async getCliente(id: string): Promise<ApiResponse<ClienteSaaS>> {
    const response = await fetch(`${API_BASE_URL}/saas/clientes/${id}`, {
      headers: await this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async createCliente(
    data: Omit<ClienteSaaS, 'id' | 'codigo_cliente' | 'created_at' | 'updated_at'>,
  ): Promise<ApiResponse<ClienteSaaS>> {
    const response = await fetch(`${API_BASE_URL}/saas/clientes`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse(response);
  }

  async updateCliente(id: string, data: Partial<ClienteSaaS>): Promise<ApiResponse<ClienteSaaS>> {
    const response = await fetch(`${API_BASE_URL}/saas/clientes/${id}`, {
      method: 'PUT',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse(response);
  }

  async deleteCliente(id: string): Promise<ApiResponse<void>> {
    const response = await fetch(`${API_BASE_URL}/saas/clientes/${id}`, {
      method: 'DELETE',
      headers: await this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async bulkDeleteClientes(params: { delete_all?: boolean; ids?: string[] }): Promise<ApiResponse<{ deleted_count: number }>> {
    const response = await fetch(`${API_BASE_URL}/saas/clientes/bulk-delete`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(params),
    });

    return this.handleResponse(response);
  }

  async bulkDeletePolizas(params: { delete_all?: boolean; ids?: string[] }): Promise<ApiResponse<{ deleted_count: number }>> {
    const response = await fetch(`${API_BASE_URL}/saas/polizas/bulk-delete`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(params),
    });

    return this.handleResponse(response);
  }

  async asignarCliente(clienteId: string, asesorId: string): Promise<ApiResponse<ClienteSaaS>> {
    const response = await fetch(`${API_BASE_URL}/saas/clientes/${clienteId}/asignar`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify({ asesor_id: asesorId }),
    });

    return this.handleResponse(response);
  }

  async importarClientes(file: File): Promise<
    ApiResponse<{
      total: number;
      procesados: number;
      errores: string[];
    }>
  > {
    const formData = new FormData();
    formData.append('file', file);

    // Para FormData, necesitamos headers específicos sin Content-Type
    const headers = await this.getAuthHeaders();
    const { 'Content-Type': _, ...headersWithoutContentType } = headers as any;

    const response = await fetch(`${API_BASE_URL}/saas/clientes/importar`, {
      method: 'POST',
      headers: headersWithoutContentType,
      body: formData,
    });

    return this.handleResponse(response);
  }

  async exportarClientes(filters: ClienteFilters = {}): Promise<Blob> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        if (Array.isArray(value)) {
          value.forEach((v) => params.append(`${key}[]`, v));
        } else {
          params.append(key, value.toString());
        }
      }
    });

    // El backend activo define la ruta específica /saas/clientes/exportar/excel
    const url = `${API_BASE_URL}/saas/clientes/exportar/excel?${params.toString()}`;

    const response = await fetch(url, {
      headers: await this.getAuthHeaders(),
    });

    if (!response.ok) {
      // Intentar leer el error del backend para mayor claridad
      let message = 'Error al exportar clientes';
      try {
        const err = await response.json();
        if (err?.message) message = err.message;
      } catch { }
      throw new Error(message);
    }

    return response.blob();
  }

  async getClientesEstadisticas(): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/saas/clientes/estadisticas`, {
      headers: await this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // ===== ROLES =====

  async getRoles(): Promise<ApiResponse<RolPersonalizado[]>> {
    const response = await fetch(`${API_BASE_URL}/saas/roles`, {
      headers: await this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async createRol(
    data: Omit<RolPersonalizado, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<ApiResponse<RolPersonalizado>> {
    const response = await fetch(`${API_BASE_URL}/saas/roles`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse(response);
  }

  async updateRol(
    id: string,
    data: Partial<RolPersonalizado>,
  ): Promise<ApiResponse<RolPersonalizado>> {
    const response = await fetch(`${API_BASE_URL}/saas/roles/${id}`, {
      method: 'PUT',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse(response);
  }

  async deleteRol(id: string): Promise<ApiResponse<void>> {
    const response = await fetch(`${API_BASE_URL}/saas/roles/${id}`, {
      method: 'DELETE',
      headers: await this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // ===== DASHBOARD Y MÉTRICAS =====

  async getDashboardMetrics(): Promise<
    ApiResponse<{
      clientes: {
        total: number;
        activos: number;
        prospectos: number;
        nuevos_mes: number;
      };
      polizas: {
        total: number;
        activas: number;
        vencen_30_dias: number;
        prima_total: number;
      };
      usuarios: {
        total: number;
        activos: number;
        conectados_hoy: number;
      };
      comisiones: {
        mes_actual: number;
        mes_anterior: number;
        pendientes: number;
      };
    }>
  > {
    const response = await fetch(`${API_BASE_URL}/saas/dashboard/metrics`, {
      headers: await this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // ===== AUDITORÍA =====

  async getAuditLogs(
    params: Record<string, any> = {},
  ): Promise<ApiResponse<PaginatedResponse<any>>> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
    });
    const response = await fetch(`${API_BASE_URL}/saas/audit-logs?${query}`, {
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async createAuditLog(data: any): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/saas/audit-logs`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async getClientesChart(period: 'week' | 'month' | 'year'): Promise<
    ApiResponse<{
      labels: string[];
      data: number[];
    }>
  > {
    const response = await fetch(`${API_BASE_URL}/saas/dashboard/clientes-chart?period=${period}`, {
      headers: await this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async getPolizasChart(period: 'week' | 'month' | 'year'): Promise<
    ApiResponse<{
      labels: string[];
      data: number[];
    }>
  > {
    const response = await fetch(`${API_BASE_URL}/saas/dashboard/polizas-chart?period=${period}`, {
      headers: await this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async getPrimasChart(
    period: 'week' | 'month' | 'year' = 'month',
    startDate?: string | null,
    endDate?: string | null
  ): Promise<
    ApiResponse<{
      labels: string[];
      data: number[];
      start: string;
      end: string;
      period: string;
    }>
  > {
    const params = new URLSearchParams();
    params.append('period', period);

    if (startDate) {
      params.append('start_date', startDate);
    }
    if (endDate) {
      params.append('end_date', endDate);
    }

    const response = await fetch(`${API_BASE_URL}/saas/dashboard/primas-chart?${params.toString()}`, {
      headers: await this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  // ===== PÓLIZAS =====
  async getPolizas(
    filters: Record<string, any> = {},
  ): Promise<ApiResponse<PaginatedResponse<any>>> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
    });
    const response = await fetch(`${API_BASE_URL}/saas/polizas?${params}`, {
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  // ===== AUTOMÓVILES =====
  async getAutomoviles(
    filters: Record<string, any> = {},
  ): Promise<ApiResponse<PaginatedResponse<any>>> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
    });
    const response = await fetch(`${API_BASE_URL}/saas/automoviles?${params}`, {
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async getAutomovil(id: string | number): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/saas/automoviles/${id}`, {
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async getAutomovilesTabCounts(): Promise<ApiResponse<{ todos: number; proximos: number; vencidos: number; sin_datos_runt: number; no_sincronizados: number }>> {
    const response = await fetch(`${API_BASE_URL}/saas/automoviles/tab-counts`, {
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async createAutomovil(data: {
    placa: string;
    marca?: string;
    modelo?: string;
    anio?: number;
    vin?: string;
    color?: string;
    client_id?: number;
    poliza_id?: number;
    custom_fields?: any;
    brand_id?: number;
    model_id?: number;
    line_id?: number;
  }): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/saas/automoviles`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async getAutomovilCatalogos(
    params: { brand_id?: number; model_id?: number } = {},
  ): Promise<ApiResponse<{ brands: any[]; models: any[]; lines: any[] }>> {
    const q = new URLSearchParams();
    // Evitar comparar números con string vacío para no disparar TS2367
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) q.append(k, String(v));
    });
    const response = await fetch(`${API_BASE_URL}/saas/automoviles/catalogos?${q}`, {
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async updateAutomovil(
    id: string | number,
    data: Partial<{
      placa: string;
      marca: string;
      modelo: string;
      anio: number;
      vin: string;
      color: string;
      client_id?: number | null;
      poliza_id?: number | null;
      custom_fields?: any;
      brand_id?: number | null;
      model_id?: number | null;
      line_id?: number | null;
    }>,
  ): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/saas/automoviles/${id}`, {
      method: 'PUT',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async deleteAutomovil(id: string | number): Promise<ApiResponse<void>> {
    const response = await fetch(`${API_BASE_URL}/saas/automoviles/${id}`, {
      method: 'DELETE',
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async consultarRunt(id: number | string): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/saas/automoviles/${id}/consultar-runt`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify({}),
    });
    return this.handleResponse(response);
  }

  async syncRuntMasivoStream(
    opts: { onlyPending?: boolean; limit?: number; signal?: AbortSignal } = {},
    onProgress?: (data: any) => void,
    onDone?: (data: any) => void,
    onError?: (err: string) => void,
  ): Promise<void> {
    const headers = await this.getAuthHeaders();
    try {
      const response = await fetch(`${API_BASE_URL}/saas/automoviles/sync-runt`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          only_pending: opts.onlyPending !== false,
          limit: opts.limit ?? 50,
        }),
        signal: opts.signal,
      });
      if (!response.ok || !response.body) {
        const text = await response.text();
        onError?.(text || `HTTP ${response.status}`);
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let gotDone = false;
      let lastProgress: any = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (currentEvent === 'progress' || currentEvent === 'init') {
                lastProgress = parsed;
                onProgress?.(parsed);
              } else if (currentEvent === 'done') {
                gotDone = true;
                onDone?.(parsed);
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
      // Stream ended without done event — synthesize one from last progress
      if (!gotDone) {
        onDone?.({
          total: lastProgress?.total ?? 0,
          success: lastProgress?.success ?? 0,
          failed: lastProgress?.failed ?? 0,
          skipped: lastProgress?.skipped ?? 0,
          cancelled: opts.signal?.aborted === true,
        });
      }
    } catch (e: any) {
      // Don't report AbortError as a failure — it was an explicit user cancel
      if (e?.name === 'AbortError') {
        onDone?.({ total: 0, success: 0, failed: 0, skipped: 0, cancelled: true });
        return;
      }
      onError?.(e?.message || 'Error de conexión');
    }
  }

  /**
   * Sync RUNT masivo en modo JSON (no streaming). Procesa una tanda corta
   * sincrónicamente y retorna los contadores. Funciona detrás de Apache /
   * Cloudflare donde SSE se buffereaba. El consumidor encadena batches.
   */
  async syncRuntMasivoJson(
    opts: { onlyPending?: boolean; limit?: number; signal?: AbortSignal } = {},
  ): Promise<{ success: boolean; total: number; success_count: number; failed: number; skipped: number; cancelled?: boolean; items?: any[] }>
  {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/saas/automoviles/sync-runt-json`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        only_pending: opts.onlyPending !== false,
        limit: opts.limit ?? 10,
      }),
      signal: opts.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text || `HTTP ${response.status}`);
    }
    return await response.json();
  }

  async getAutomovilInsuredValue(params: {
    brand_id: number;
    model_id: number;
    line_id?: number;
  }): Promise<ApiResponse<{ insured_value: number | null }>> {
    const q = new URLSearchParams();
    q.append('brand_id', String(params.brand_id));
    q.append('model_id', String(params.model_id));
    if (params.line_id !== undefined && params.line_id !== null) {
      q.append('line_id', String(params.line_id));
    }
    const response = await fetch(`${API_BASE_URL}/saas/automoviles/catalogos?${q.toString()}`, {
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  // ===== TAREAS / SEGUIMIENTOS (Gestión Comercial) =====
  async getCommercialTasks(
    filters: Record<string, any> = {},
  ): Promise<ApiResponse<PaginatedResponse<any>>> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
    });
    const response = await fetch(`${API_BASE_URL}/saas/commercial-tasks?${params}`, {
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  // ===== CONFIGURACIÓN =====

  async getConfiguracion(): Promise<
    ApiResponse<{
      general: any;
      notificaciones: any;
      integraciones: any;
    }>
  > {
    const response = await fetch(`${API_BASE_URL}/saas/configuracion`, {
      headers: await this.getAuthHeaders(),
    });

    return this.handleResponse(response);
  }

  async updateConfiguracion(seccion: string, data: any): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/saas/configuracion/${seccion}`, {
      method: 'PUT',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse(response);
  }

  // ===== INTEGRACIONES ASEGURADORAS =====
  async getInsurerConnections(): Promise<ApiResponse<any[]>> {
    const response = await fetch(`${API_BASE_URL}/saas/integraciones/aseguradoras/conexiones`, {
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async connectInsurer(insurerCode: string, credentials: Record<string, any>): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/saas/integraciones/aseguradoras/${insurerCode}/conectar`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify({ credentials }),
    });
    return this.handleResponse(response);
  }

  async connectBrowserInsurer(insurerCode: string): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/saas/integraciones/aseguradoras/${insurerCode}/conectar-navegador`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  /**
   * Headless auto-login con credenciales + MFA relay (Belvo-style).
   *
   * Paso 1 — llamar con credenciales. Si la aseguradora pide OTP, el backend
   * devuelve 202 con `challenge_id` y el flujo queda pausado en el servidor
   * esperando el código.
   *
   * Paso 2 — llamar con `challengeId` + `mfaCode` (sin credenciales). El server
   * despierta el browser pausado, inyecta el OTP y completa el login.
   */
  async connectAutoInsurer(
    insurerCode: string,
    credentials: Record<string, string> | undefined,
    mfaCode?: string,
    challengeId?: string,
  ): Promise<{ success: boolean; requires_mfa?: boolean; challenge_id?: string; message?: string; data?: any }> {
    const body: any = {};
    if (challengeId) {
      body.challenge_id = challengeId;
      body.mfa_code = mfaCode || '';
    } else {
      body.credentials = credentials || {};
    }
    const response = await fetch(`${API_BASE_URL}/saas/integraciones/aseguradoras/${insurerCode}/conectar-auto`, {
      method: 'POST',
      headers: { ...(await this.getAuthHeadersOnly()), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    // 202 = job encolado (flujo async). El MFA real se detecta por polling.
    return await this.handleResponse(response) as any;
  }

  async reconnectInsurer(insurerCode: string): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/saas/integraciones/aseguradoras/${insurerCode}/reconectar`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async pingInsurer(insurerCode: string): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/saas/integraciones/aseguradoras/${insurerCode}/ping`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async healthCheckInsurer(insurerCode: string): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/saas/integraciones/aseguradoras/${insurerCode}/health-check`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async disconnectInsurer(insurerCode: string): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/saas/integraciones/aseguradoras/${insurerCode}/desconectar`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async getSessionStatus(insurerCode: string): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/saas/integraciones/aseguradoras/${insurerCode}/session-status`, {
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  /**
   * Estado del job asíncrono de conexión (para polling tras dispatch).
   * Devuelve `connect_job_status`: idle | queued | processing | requires_mfa | success | failed
   */
  async getConnectStatus(insurerCode: string): Promise<ApiResponse<{
    insurer_code?: string;
    status?: string;
    connected?: boolean;
    connect_job_status: 'idle' | 'queued' | 'processing' | 'requires_mfa' | 'success' | 'failed';
    connect_job_id?: string;
    connect_job_mode?: string;
    connect_job_message?: string | null;
    connect_job_error?: string | null;
    requires_mfa?: boolean;
    challenge_id?: string | null;
    started_at?: string | null;
    finished_at?: string | null;
    connected_at?: string | null;
    expires_at?: string | null;
  }>> {
    const response = await fetch(`${API_BASE_URL}/saas/integraciones/aseguradoras/${insurerCode}/connect-status`, {
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  /**
   * Wrapper que ejecuta una llamada a la API de aseguradoras con reconexión transparente.
   * Si la primera llamada falla con 401/403, intenta reconectar vía Laravel y reintenta.
   */
  async callWithReconnect<T>(insurerCode: string, apiFn: () => Promise<ApiResponse<T>>): Promise<ApiResponse<T>> {
    const result = await apiFn();
    if (result.success) return result;
    // Si falla, intentar reconectar y reintentar
    const reconnect = await this.reconnectInsurer(insurerCode).catch(() => null);
    if (reconnect?.success) {
      return apiFn();
    }
    return result;
  }

  async syncInsurers(insurers: string[], types: string[]): Promise<ApiResponse<{ batch_id: string }>> {
    const response = await fetch(`${API_BASE_URL}/saas/integraciones/aseguradoras/sync`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify({ insurers, types }),
    });
    return this.handleResponse(response);
  }

  async getSyncStatus(batchId: string): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/saas/integraciones/aseguradoras/sync/${batchId}/status`, {
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async guiameTts(params: { text: string; voice?: string }): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/saas/guiame/tts`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      throw new Error(`TTS failed: ${response.status}`);
    }
    return response.blob();
  }

  async guiameChat(params: {
    message: string;
    page_url?: string;
    page_title?: string;
    screenshot?: string;
    case_state?: string;
    history?: { role: 'user' | 'assistant'; content: string }[];
  }): Promise<ApiResponse<{ response: string; model: string; latency_ms?: number; highlight?: { x: number; y: number; label?: string } | null; navigate?: string | null }>> {
    const response = await fetch(`${API_BASE_URL}/saas/guiame/chat`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(params),
    });
    return this.handleResponse(response);
  }

  async cancelSync(batchId: string): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/saas/integraciones/aseguradoras/sync/${batchId}/cancel`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async getSyncHistory(limit = 10): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/saas/integraciones/aseguradoras/sync/history?limit=${limit}`, {
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  // ===== CARTERA CONSOLIDADA ASEGURADORAS =====

  async getCarteraAseguradoras(params: {
    page?: number; per_page?: number; tab?: string; search?: string; insurer?: string;
    link_filter?: 'all' | 'linked' | 'unlinked';
    seller_filter?: 'all' | 'with' | 'without';
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.per_page) searchParams.set('per_page', String(params.per_page));
    if (params.tab) searchParams.set('tab', params.tab);
    if (params.search) searchParams.set('search', params.search);
    if (params.insurer) searchParams.set('insurer', params.insurer);
    if (params.link_filter && params.link_filter !== 'all') searchParams.set('link_filter', params.link_filter);
    if (params.seller_filter && params.seller_filter !== 'all') searchParams.set('seller_filter', params.seller_filter);
    const response = await fetch(`${API_BASE_URL}/saas/cartera-aseguradoras?${searchParams}`, {
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  /**
   * Export CSV de cartera consolidada con filtros. Descarga directa como blob.
   * Devuelve la URL preparada para usar con <a download> o fetch + saveAs.
   */
  async exportCarteraAseguradoras(params: {
    tab?: string; search?: string; insurer?: string;
    link_filter?: 'all' | 'linked' | 'unlinked';
    seller_filter?: 'all' | 'with' | 'without';
  }): Promise<Blob> {
    const searchParams = new URLSearchParams();
    if (params.tab) searchParams.set('tab', params.tab);
    if (params.search) searchParams.set('search', params.search);
    if (params.insurer) searchParams.set('insurer', params.insurer);
    if (params.link_filter && params.link_filter !== 'all') searchParams.set('link_filter', params.link_filter);
    if (params.seller_filter && params.seller_filter !== 'all') searchParams.set('seller_filter', params.seller_filter);
    const response = await fetch(`${API_BASE_URL}/saas/cartera-aseguradoras/export?${searchParams}`, {
      headers: await this.getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Export falló: HTTP ${response.status}`);
    }
    return await response.blob();
  }

  async getCarteraAseguradorasStats(insurer?: string, linkFilter?: 'all' | 'linked' | 'unlinked'): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (insurer) params.set('insurer', insurer);
    if (linkFilter && linkFilter !== 'all') params.set('link_filter', linkFilter);
    const qs = params.toString();
    const url = `${API_BASE_URL}/saas/cartera-aseguradoras/stats${qs ? `?${qs}` : ''}`;
    const response = await fetch(url, { headers: await this.getAuthHeaders() });
    return this.handleResponse(response);
  }

  async getCarteraAseguradorasCuotas(policyNumber: string): Promise<ApiResponse<any>> {
    const url = `${API_BASE_URL}/saas/cartera-aseguradoras/cuotas/${encodeURIComponent(policyNumber)}`;
    const response = await fetch(url, { headers: await this.getAuthHeaders() });
    return this.handleResponse(response);
  }

  async deleteCarteraAseguradorasData(params: { insurer?: string } = {}): Promise<ApiResponse<any>> {
    const sp = new URLSearchParams();
    if (params.insurer) sp.set('insurer', params.insurer);
    const qs = sp.toString();
    const response = await fetch(`${API_BASE_URL}/saas/cartera-aseguradoras/data${qs ? `?${qs}` : ''}`, {
      method: 'DELETE',
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async previewCarteraAseguradorasImport(file: File, insurer?: string): Promise<ApiResponse<any>> {
    const form = new FormData();
    form.append('file', file);
    if (insurer) form.append('insurer_code', insurer);
    const response = await fetch(`${API_BASE_URL}/saas/cartera-aseguradoras/import/preview`, {
      method: 'POST',
      headers: await this.getAuthHeadersOnly(),
      body: form,
    });
    return this.handleResponse(response);
  }

  async importCarteraAseguradoras(file: File, params: {
    insurer_code: string; mapping: Record<string, number | null>; replace?: boolean;
  }): Promise<ApiResponse<any>> {
    const form = new FormData();
    form.append('file', file);
    form.append('insurer_code', params.insurer_code);
    form.append('mapping', JSON.stringify(params.mapping));
    form.append('replace', params.replace ? '1' : '0');
    const response = await fetch(`${API_BASE_URL}/saas/cartera-aseguradoras/import`, {
      method: 'POST',
      headers: await this.getAuthHeadersOnly(),
      body: form,
    });
    return this.handleResponse(response);
  }

  // ===== EMAIL SETTINGS DEL BROKER (SMTP) =====

  async getBrokerEmailSettings(): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/saas/email-settings`, {
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async updateBrokerEmailSettings(payload: {
    from_email: string; from_name?: string; reply_to_email?: string;
    smtp_host: string; smtp_port: number; smtp_username: string;
    smtp_password?: string;  // opcional al editar (si vacío, mantiene el existente)
    smtp_encryption?: 'tls' | 'ssl' | null; provider?: string;
  }): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/saas/email-settings`, {
      method: 'PUT',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse(response);
  }

  async testBrokerEmailSettings(to?: string): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/saas/email-settings/test`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify({ to }),
    });
    return this.handleResponse(response);
  }

  // ===== NOTIFICACIONES EMAIL A VENDEDORES (CONFIG GLOBAL DEL BROKER) =====

  async getVendedorNotificationConfig(): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/saas/vendedor-notifications`, {
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async updateVendedorNotificationConfig(payload: {
    enabled?: boolean;
    recipients_mode?: 'all' | 'with_email_only';
    bcc_admin?: string | null;
    cartera_enabled?: boolean;
    cartera_frequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    cartera_day_of_week?: number;
    cartera_day_of_month?: number;
    cartera_hour?: number;
    cartera_min_dias_mora?: number;
    vencimientos_enabled?: boolean;
    vencimientos_dias_anticipacion?: number[];
    vencimientos_hour?: number;
  }): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/saas/vendedor-notifications`, {
      method: 'PUT',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return this.handleResponse(response);
  }

  async testVendedorNotification(type: 'cartera' | 'vencimientos'): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/saas/vendedor-notifications/test`, {
      method: 'POST',
      headers: await this.getAuthHeaders(),
      body: JSON.stringify({ type }),
    });
    return this.handleResponse(response);
  }

  // ===== RECIBOS CON COMISIONES SINCRONIZADOS =====

  async getRecibosComisiones(params: {
    page?: number; per_page?: number; search?: string; insurer?: string;
    anio?: string; mes?: string; ramo?: string; policy?: string;
  }): Promise<ApiResponse<any>> {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
    });
    const response = await fetch(`${API_BASE_URL}/saas/recibos-comisiones?${sp}`, {
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async getRecibosComisionesStats(params: {
    insurer?: string; anio?: string; mes?: string;
  } = {}): Promise<ApiResponse<any>> {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
    });
    const response = await fetch(`${API_BASE_URL}/saas/recibos-comisiones/stats?${sp}`, {
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  async getRecibosComisionesByPolicy(policyNumber: string): Promise<ApiResponse<any>> {
    const url = `${API_BASE_URL}/saas/recibos-comisiones/by-policy/${encodeURIComponent(policyNumber)}`;
    const response = await fetch(url, { headers: await this.getAuthHeaders() });
    return this.handleResponse(response);
  }

  async syncRecibosComisiones(params: {
    anio: string; mes: string; ramo?: string; insurer?: string;
  }): Promise<ApiResponse<any>> {
    const response = await fetch(`${API_BASE_URL}/saas/recibos-comisiones/sync`, {
      method: 'POST',
      headers: { ...(await this.getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return this.handleResponse(response);
  }

  async deleteRecibosComisionesData(params: {
    insurer?: string; anio?: string; mes?: string;
  } = {}): Promise<ApiResponse<any>> {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
    });
    const qs = sp.toString();
    const response = await fetch(`${API_BASE_URL}/saas/recibos-comisiones/data${qs ? `?${qs}` : ''}`, {
      method: 'DELETE',
      headers: await this.getAuthHeaders(),
    });
    return this.handleResponse(response);
  }

  // ===== PAPELERA (registros soft-deleted) =====
  async getPapeleraEntidades(): Promise<ApiResponse<Array<{ key: string; label: string; count: number }>>> {
    const r = await fetch(`${API_BASE_URL}/saas/papelera/entidades`, { headers: await this.getAuthHeaders() });
    return this.handleResponse(r);
  }
  async getPapeleraItems(entidad: string, params: { page?: number; per_page?: number; search?: string } = {}): Promise<ApiResponse<{ items: any[]; pagination: any; columns: Record<string, string> }>> {
    const usp = new URLSearchParams();
    if (params.page) usp.set('page', String(params.page));
    if (params.per_page) usp.set('per_page', String(params.per_page));
    if (params.search) usp.set('search', params.search);
    const r = await fetch(`${API_BASE_URL}/saas/papelera/${entidad}?${usp}`, { headers: await this.getAuthHeaders() });
    return this.handleResponse(r);
  }
  async restaurarPapelera(entidad: string, ids: number[]): Promise<ApiResponse<{ restored: number }>> {
    const r = await fetch(`${API_BASE_URL}/saas/papelera/${entidad}/restaurar`, {
      method: 'POST',
      headers: { ...(await this.getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    return this.handleResponse(r);
  }
  async eliminarDefinitivoPapelera(entidad: string, ids: number[], deleteAll = false): Promise<ApiResponse<{ deleted: number }>> {
    const r = await fetch(`${API_BASE_URL}/saas/papelera/${entidad}/eliminar`, {
      method: 'POST',
      headers: { ...(await this.getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, delete_all: deleteAll }),
    });
    return this.handleResponse(r);
  }
  async exportarPapelera(entidad: string, search?: string): Promise<Blob> {
    const usp = new URLSearchParams();
    if (search) usp.set('search', search);
    const r = await fetch(`${API_BASE_URL}/saas/papelera/${entidad}/exportar?${usp}`, { headers: await this.getAuthHeaders() });
    return await r.blob();
  }

  // ===== BÚSQUEDA GLOBAL (Top Bar) =====
  async globalSearch(
    q: string,
    perType: number = 5
  ): Promise<ApiResponse<{ data: any[]; counts: Record<string, number>; query: string }>> {
    const headers = await this.getAuthHeaders();
    const usp = new URLSearchParams();
    usp.append('q', q);
    if (perType) usp.append('per_type', String(perType));

    const response = await fetch(`${API_BASE_URL}/saas/search?${usp.toString()}`, {
      headers,
    });
    return this.handleResponse(response);
  }
}

// Instancia singleton
export const saasApi = new SaasApiService();
export default saasApi;
