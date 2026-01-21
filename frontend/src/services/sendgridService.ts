import { auth } from '../config/firebase';
import { API_BASE_URL } from '../config/apiUrl';

export interface SendgridTemplate {
  id: string;
  name: string;
  version?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  [key: string]: any;
}

// Obtiene token de Firebase o token de empleado (Laravel) para Authorization
const getAuthHeader = async (): Promise<HeadersInit> => {
  const headers: HeadersInit = { Accept: 'application/json' };
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      return { ...headers, Authorization: `Bearer ${token}` };
    }
  } catch {
    /* ignore */
  }
  try {
    const empleado = localStorage.getItem('empleado_token');
    if (empleado) return { ...headers, Authorization: `Bearer ${empleado}` };
  } catch {
    /* ignore */
  }
  return headers;
};

// Normaliza diferentes formatos de respuesta a un arreglo de plantillas {id,name}
const normalizeTemplates = (raw: any): SendgridTemplate[] => {
  if (!raw) return [];
  // Caso ApiResponse con data array
  if (Array.isArray(raw?.data)) {
    return raw.data
      .map((t: any) => ({
        id: String(t.id ?? t.template_id ?? t.sid ?? t.guid ?? ''),
        name: String(t.name ?? t.template_name ?? t.title ?? 'Plantilla'),
        version: t.version ?? t.active_version ?? t.updated_at ?? undefined,
        updated_at: t.updated_at ?? undefined,
        ...t,
      }))
      .filter((t: SendgridTemplate) => !!t.id && !!t.name);
  }
  // Caso array directo
  if (Array.isArray(raw)) {
    return raw
      .map((t: any) => ({
        id: String(t.id ?? t.template_id ?? t.sid ?? t.guid ?? ''),
        name: String(t.name ?? t.template_name ?? t.title ?? 'Plantilla'),
        version: t.version ?? t.active_version ?? t.updated_at ?? undefined,
        updated_at: t.updated_at ?? undefined,
        ...t,
      }))
      .filter((t: SendgridTemplate) => !!t.id && !!t.name);
  }
  // Caso objeto con property distinta (e.g., templates, results)
  const arr = raw.templates || raw.results || raw.items || [];
  if (Array.isArray(arr)) {
    return arr
      .map((t: any) => ({
        id: String(t.id ?? t.template_id ?? t.sid ?? t.guid ?? ''),
        name: String(t.name ?? t.template_name ?? t.title ?? 'Plantilla'),
        version: t.version ?? t.active_version ?? t.updated_at ?? undefined,
        updated_at: t.updated_at ?? undefined,
        ...t,
      }))
      .filter((t: SendgridTemplate) => !!t.id && !!t.name);
  }
  return [];
};

class SendgridService {
  /**
   * Lista plantillas de SendGrid desde el backend.
   * Intenta varios endpoints en orden, devolviendo el primero que responda:
   *  - /saas/sendgrid/templates
   *  - /saas/email-templates
   *  - /saas/templates
   */
  async listTemplates(): Promise<SendgridTemplate[]> {
    const headers = await getAuthHeader();
    const candidates = ['/saas/sendgrid/templates', '/saas/email-templates', '/saas/templates'];
    for (const path of candidates) {
      try {
        const res = await fetch(`${API_BASE_URL}${path}`, { headers });
        if (!res.ok) continue;
        const json = await res.json().catch(() => ({}));
        const list = normalizeTemplates(json);
        if (list.length) return list;
      } catch {
        /* try next */
      }
    }
    return [];
  }

  /**
   * Obtiene detalles de una plantilla (si el backend lo expone).
   * Prueba rutas comunes:
   *  - /saas/sendgrid/templates/:id
   *  - /saas/email-templates/:id
   */
  async getTemplate(id: string): Promise<SendgridTemplate | null> {
    const headers = await getAuthHeader();
    const candidates = [`/saas/sendgrid/templates/${id}`, `/saas/email-templates/${id}`];
    for (const path of candidates) {
      try {
        const res = await fetch(`${API_BASE_URL}${path}`, { headers });
        if (!res.ok) continue;
        const json = await res.json().catch(() => ({}));
        const data = (json?.data ?? json) as any;
        if (data) {
          return {
            id: String(data.id ?? id),
            name: String(data.name ?? data.template_name ?? 'Plantilla'),
            version: data.version ?? data.active_version ?? data.updated_at ?? undefined,
            updated_at: data.updated_at ?? undefined,
            ...data,
          };
        }
      } catch {
        /* ignore */
      }
    }
    return null;
  }
}

export const sendgridService = new SendgridService();
export default sendgridService;
