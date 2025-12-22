import { auth } from '../config/firebase';

const API_BASE = `${import.meta.env.VITE_API_URL || 'http://localhost:8081/api'}/saas/imports`;

async function getAuthToken(): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
}

async function request<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  const headers: HeadersInit = {
    ...(options.headers || {}),
  };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    headers['Accept'] = 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getMeta() {
  return request('/meta', { method: 'GET' });
}

export async function dryRunImport(params: {
  entity: string;
  file: File;
  mapping: Record<string, string>;
  upsert_key?: string;
  limit?: number;
}) {
  const form = new FormData();
  form.append('entity', params.entity);
  form.append('file', params.file);
  form.append('dry_run', '1');
  // Enviar mapping como campo de texto JSON para que Laravel lo lea con input('mapping')
  form.append('mapping', JSON.stringify(params.mapping));
  if (params.upsert_key) form.append('upsert_key', params.upsert_key);
  if (params.limit) form.append('limit', params.limit.toString());
  return request('/process', { method: 'POST', body: form });
}

export async function executeImport(params: {
  entity: string;
  file: File;
  mapping: Record<string, string>;
  upsert_key?: string;
  auto_create?: boolean;
  limit?: number;
  // Mapeo de relaciones: indica qué columna del CSV de esta entidad se relaciona con qué columna del CSV de otra entidad
  relation_mappings?: Record<string, {
    targetEntityKey: string;
    columnInThisFile: string;
    columnInTargetFile: string;
  }>;
  // Índice de entidades importadas previamente para relacionar por columnas que no están en BD
  // Formato: { "clientes": { "valor_identificador": id_en_bd, ... }, ... }
  imported_index?: Record<string, Record<string, number>>;
}) {
  const form = new FormData();
  form.append('entity', params.entity);
  form.append('file', params.file);
  form.append('dry_run', '0');
  // Enviar mapping como texto JSON (no Blob) para compatibilidad con PHP
  form.append('mapping', JSON.stringify(params.mapping));
  if (params.upsert_key) form.append('upsert_key', params.upsert_key);
  // Enviar auto_create para crear automáticamente entidades relacionadas
  form.append('auto_create', params.auto_create ? '1' : '0');
  if (params.limit) form.append('limit', params.limit.toString());
  // Enviar relation_mappings para que el backend sepa cómo buscar entidades relacionadas
  if (params.relation_mappings) {
    form.append('relation_mappings', JSON.stringify(params.relation_mappings));
  }
  // Enviar índice de entidades importadas para relacionar por columnas temporales
  if (params.imported_index) {
    form.append('imported_index', JSON.stringify(params.imported_index));
  }
  return request('/process', { method: 'POST', body: form });
}

export type ImportMetaResponse = {
  success: boolean;
  entities: Record<
    string,
    {
      display_name: string;
      unique_keys: string[];
      required_fields?: string[];
      date_fields?: string[];
      number_fields?: string[];
      boolean_fields?: string[];
      fields: string[];
      auto_create_relations?: Record<string, { display_name: string; lookup_field: string }>;
    }
  >;
};

export async function getJobs(limit = 20) {
  return request(`/jobs?limit=${limit}`, { method: 'GET' });
}

export async function getJob(id: number) {
  return request(`/jobs/${id}`, { method: 'GET' });
}
