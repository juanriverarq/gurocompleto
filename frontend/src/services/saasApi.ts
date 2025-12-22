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
