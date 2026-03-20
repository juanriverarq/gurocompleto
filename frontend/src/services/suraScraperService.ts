import { getAuth } from 'firebase/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';
const API_PREFIX = '/saas/sura-scraper';

const getAuthToken = async (): Promise<string | null> => {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
  } catch {
    // ignore
  }
  return null;
};

async function makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<{
  success: boolean;
  data?: T;
  message?: string;
  meta?: any;
}> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const json = await res.json();

  if (!res.ok) {
    return {
      success: false,
      message: json?.message || `Error ${res.status}`,
      ...json,
    };
  }

  return json;
}

export interface SuraConnectionStatus {
  connected: boolean;
  username: string | null;
  last_sync_at: string | null;
  session_valid: boolean;
  status: string;
  last_error?: string | null;
  auth_method?: 'credentials' | 'cookies';
}

export interface SuraPoliza {
  ramo_codigo: string;
  ramo_nombre: string;
  producto: string;
  numero_poliza: string;
  numero_poliza_principal: string;
  tipo_dni_tomador: string;
  dni_tomador: string;
  nombre_tomador: string;
  direccion_tomador: string;
  telefono_tomador: string;
  celular_tomador: string;
  correo_tomador: string;
  ciudad: string;
  oficina: string;
  codigo_oficina: string;
  fecha_inicio: string;
  fecha_fin: string;
  forma_pago: string;
  financiada: string;
  estado: string;
  codigo_asesor: string;
  nombre_asesor: string;
  numero_renovacion: string;
  tipo_poliza: string;
}

export interface SuraCliente {
  id: string;
  nombre: string;
  tipo_documento: string;
  numero_documento: string;
  direccion: string;
  ciudad: string;
  telefono_fijo: string;
  telefono_celular: string;
  correo: string;
  fecha_nacimiento: string;
  tipo_vinculacion: string;
  tipo_persona: string;
  sarlaft_actualizado: boolean | null;
}

/**
 * Detail response from SURA ramo-specific endpoints.
 * Fields vary by ramo - all are optional since different ramos return different data.
 */
export interface SuraPolizaDetail {
  // Common fields across ramos
  poliza?: string;
  tipoPoliza?: string;
  plan?: string;
  estado?: string;
  dniTomador?: string;
  nombreTomador?: string;
  nombreAsegurado?: string;
  nombreBeneficiario?: string;
  oficina?: string;
  ciudad?: string;
  fechaExpedicion?: string;
  fechaInicioVigenciaRiesgo?: string;
  fechaFinVigenciaRiesgo?: string;
  ptprimaformapago?: string | number;
  formaPago?: string;

  // Autos-specific
  placa?: string;
  marca?: string;
  modelo?: string;
  vehiculo?: string;
  chasis?: string;
  motor?: string;
  zona?: string;
  valorVehiculo?: string | number;
  bonificacion?: string;

  // Coverage and details
  coberturas?: Array<{
    cobertura?: string;
    valorAsegurado?: string | number;
    deducible?: string;
    prima?: string | number;
    [key: string]: any;
  }>;
  asesores?: Array<{
    codigoAsesor?: string;
    nombreAsesor?: string;
    participacion?: string | number;
    [key: string]: any;
  }>;

  // Enriched data from our backend
  _recibos_pendientes?: any[];
  _reclamaciones?: any[];
  _ramo_code?: string;
  _endpoint_used?: string;

  // Allow any other fields from SURA
  [key: string]: any;
}

export type SuraDataType = 'polizas' | 'clientes';

export const suraScraperService = {
  /**
   * Get connection status.
   */
  async getStatus(): Promise<{ success: boolean; data?: SuraConnectionStatus; message?: string }> {
    return makeRequest<SuraConnectionStatus>(`${API_PREFIX}/status`);
  },

  /**
   * Connect to SURA with browser cookies (legacy).
   */
  async connect(cookies: string): Promise<{ success: boolean; data?: SuraConnectionStatus; message?: string }> {
    return makeRequest<SuraConnectionStatus>(`${API_PREFIX}/connect`, {
      method: 'POST',
      body: JSON.stringify({ cookies }),
    });
  },

  /**
   * Connect to SURA with username/password credentials (preferred).
   * Backend will programmatically login to SURA SSO and capture cookies.
   */
  async connectWithCredentials(suraUser: string, suraPassword: string, mfaCode?: string, docType?: string): Promise<{ success: boolean; data?: SuraConnectionStatus; message?: string; mfa_required?: boolean }> {
    return makeRequest<SuraConnectionStatus>(`${API_PREFIX}/connect`, {
      method: 'POST',
      body: JSON.stringify({
        sura_user: suraUser,
        sura_password: suraPassword,
        ...(mfaCode ? { mfa_code: mfaCode } : {}),
        ...(docType ? { doc_type: docType } : {}),
      }),
    });
  },

  /**
   * Refresh an expired SURA session using stored credentials.
   * Returns success if re-login worked, false if manual reconnect is needed.
   */
  async refreshSession(): Promise<{ success: boolean; data?: SuraConnectionStatus; message?: string }> {
    return makeRequest<SuraConnectionStatus>(`${API_PREFIX}/refresh-session`, {
      method: 'POST',
    });
  },

  /**
   * Disconnect from SURA.
   */
  async disconnect(): Promise<{ success: boolean; message?: string }> {
    return makeRequest(`${API_PREFIX}/disconnect`, {
      method: 'DELETE',
    });
  },

  /**
   * Fetch policy list from SURA.
   */
  async fetchPolizas(page = 1, perPage = 20, type: SuraDataType = 'polizas'): Promise<{
    success: boolean;
    data?: (SuraPoliza | SuraCliente)[];
    meta?: { total: number; page: number; per_page: number; has_more: boolean };
    message?: string;
  }> {
    return makeRequest<(SuraPoliza | SuraCliente)[]>(`${API_PREFIX}/polizas?page=${page}&per_page=${perPage}&type=${type}`);
  },

  /**
   * Fetch detail for a specific policy by ramo.
   * @param numeroPoliza - Policy number
   * @param ramoCode - Ramo code (e.g. '01' for autos, '06' for hogar)
   * @param fechaFin - Optional end date for the policy
   * @param codigoRol - Optional role code (default '100')
   */
  async fetchPolizaDetail(
    numeroPoliza: string,
    ramoCode: string,
    fechaFin?: string,
    codigoRol?: string,
  ): Promise<{
    success: boolean;
    data?: SuraPolizaDetail;
    message?: string;
    session_expired?: boolean;
  }> {
    const params = new URLSearchParams({ ramo: ramoCode });
    if (fechaFin) params.set('fecha_fin', fechaFin);
    if (codigoRol) params.set('codigo_rol', codigoRol);
    return makeRequest<SuraPolizaDetail>(`${API_PREFIX}/polizas/${numeroPoliza}/detail?${params.toString()}`);
  },

  /**
   * Trigger Excel export on SURA.
   */
  async exportExcel(type: SuraDataType = 'polizas'): Promise<{ success: boolean; data?: any; message?: string }> {
    return makeRequest(`${API_PREFIX}/export`, {
      method: 'POST',
      body: JSON.stringify({ type }),
    });
  },

  /**
   * Get document numbers that already exist in Guro for this broker.
   */
  async getExistingDocuments(): Promise<{ success: boolean; data?: string[]; message?: string }> {
    return makeRequest<string[]>(`${API_PREFIX}/existing-documents`);
  },

  /**
   * Import SURA clients into Guro clientes table.
   */
  async importClients(clients: SuraCliente[]): Promise<{
    success: boolean;
    message?: string;
    data?: {
      imported: { id: number; nombre: string; documento: string }[];
      duplicates: { sura_nombre: string; documento: string; existing_id: number; existing_nombre: string }[];
      errors: { nombre: string; documento?: string; reason: string }[];
      summary: { total: number; imported_count: number; duplicate_count: number; error_count: number };
    };
  }> {
    return makeRequest(`${API_PREFIX}/import-clients`, {
      method: 'POST',
      body: JSON.stringify({ clients }),
    });
  },
};
