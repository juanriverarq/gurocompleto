import { toast } from 'src/hooks/use-toast';
import { auth } from '../config/firebase';

export interface MiniWebLink {
  label: string;
  url: string;
}

export interface MiniWebTheme {
  primary: string;
  background: string;
  text: string;
}

export interface MiniWebContact {
  whatsapp?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface MiniWebSocial {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  youtube?: string;
  linkedin?: string;
  x?: string;
  website?: string;
}

export interface MiniWebConfig {
  slug: string;
  title: string;
  bio?: string;
  logoUrl?: string; // nuevo campo para logo
  // avatarUrl se mantiene por compatibilidad temporal con backend/almacenado previo
  avatarUrl?: string;
  links: MiniWebLink[];
  theme: MiniWebTheme;
  contact?: MiniWebContact;
  social?: MiniWebSocial;
  published?: boolean;
  updated_at?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';
const API_PREFIX = '/saas/mini-web';
const PUBLIC_PREFIX = '/public/mini-web';
const LOCAL_KEY = 'mini_web_config';

const getAuthToken = async (): Promise<string | null> => {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    const token = await user.getIdToken();
    return token;
  } catch {
    return null;
  }
};

async function makeRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token = await getAuthToken();
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }
  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  };
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, config);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Error desconocido' }));
    const msg = errorData?.message || `HTTP ${response.status}`;
    throw new Error(msg);
  }
  const data = await response.json();
  return data;
}

// Local fallback
function loadLocal(): MiniWebConfig | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MiniWebConfig;
  } catch {
    return null;
  }
}

function saveLocal(cfg: MiniWebConfig): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ ...cfg, updated_at: new Date().toISOString() }));
  } catch {}
}

// Helpers de carga
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const miniWebService = {
  async uploadLogo(file: File): Promise<ApiResponse<{ url: string }>> {
    try {
      const token = await getAuthToken();
      const fd = new FormData();
      fd.append('logo', file);
      const resp = await fetch(`${API_BASE_URL}${API_PREFIX}/logo`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const data = await resp.json();
      return data;
    } catch (e) {
      // Fallback: devolver DataURL para almacenar localmente
      const dataUrl = await fileToDataUrl(file);
      return { success: true, data: { url: dataUrl } };
    }
  },
  async checkSlug(slug: string): Promise<ApiResponse<{ available: boolean }>> {
    try {
      const res = await makeRequest<{ available: boolean }>(`${API_PREFIX}/check-slug?slug=${encodeURIComponent(slug)}`);
      return res;
    } catch (error) {
      // Fallback local: si coincide con el guardado local (mismo tenant), debe considerarse DISPONIBLE
      const local = loadLocal();
      const available = local ? local.slug === slug : true;
      return { success: true, data: { available } };
    }
  },

  async getConfig(): Promise<ApiResponse<MiniWebConfig>> {
    try {
      const res = await makeRequest<MiniWebConfig>(`${API_PREFIX}`);
      // Compatibilidad: si backend aún retorna avatarUrl, mapear a logoUrl
      if (res?.success && res.data) {
        const d: any = res.data as any;
        if (!d.logoUrl && d.avatarUrl) {
          d.logoUrl = d.avatarUrl;
        }
      }
      return res;
    } catch (error) {
      const local = loadLocal();
      if (local) {
        // Compatibilidad local
        const d: any = local as any;
        if (!d.logoUrl && d.avatarUrl) {
          d.logoUrl = d.avatarUrl;
        }
        return { success: true, data: d as MiniWebConfig };
      }
      const def: MiniWebConfig = {
        slug: '',
        title: 'Mi Mini Web',
        bio: 'Agrega una breve descripción aquí.',
        logoUrl: '',
        links: [],
        theme: { primary: '#3B82F6', background: '#FFFFFF', text: '#111827' },
        contact: {},
        social: {},
        published: false,
        updated_at: new Date().toISOString(),
      };
      return { success: true, data: def };
    }
  },

  async saveConfig(cfg: MiniWebConfig): Promise<ApiResponse<MiniWebConfig>> {
    try {
      // Compatibilidad: duplicar logoUrl en avatarUrl si backend aún lo usa
      const payload: any = { ...cfg };
      if (!payload.avatarUrl && payload.logoUrl) {
        payload.avatarUrl = payload.logoUrl;
      }
      const res = await makeRequest<MiniWebConfig>(`${API_PREFIX}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res;
    } catch (error) {
      saveLocal(cfg);
      toast({ variant: 'primary', title: 'Sin conexión al servidor', description: 'Se guardó localmente.' });
      return { success: true, data: cfg };
    }
  },

  async publish(published: boolean): Promise<ApiResponse<{ published: boolean }>> {
    try {
      const res = await makeRequest<{ published: boolean }>(`${API_PREFIX}/publish`, {
        method: 'POST',
        body: JSON.stringify({ published }),
      });
      return res;
    } catch (error) {
      const local = loadLocal();
      if (local) {
        const updated = { ...local, published };
        saveLocal(updated);
        return { success: true, data: { published } };
      }
      return { success: false, message: 'No se pudo publicar' };
    }
  },

  async getPublicBySlug(slug: string): Promise<ApiResponse<MiniWebConfig>> {
    try {
      const res = await makeRequest<MiniWebConfig>(`${PUBLIC_PREFIX}/${encodeURIComponent(slug)}`);
      return res;
    } catch (error) {
      // Fallback: si el local coincide y está publicado, retornarlo
      const local = loadLocal();
      if (local && local.slug === slug && local.published) {
        return { success: true, data: local };
      }
      return { success: false, message: 'Mini Web no encontrada' };
    }
  },
};