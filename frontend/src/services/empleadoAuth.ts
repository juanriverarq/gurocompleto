import { API_BASE_URL } from '../config/api';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../config/firebase';

export interface EmpleadoPerfil {
  id: number;
  email: string;
  nombres?: string;
  apellidos?: string;
  cargo?: string;
  broker_id: number;
  estado?: string;
  acceso_activo?: boolean;
  rol?: {
    id: number;
    nombre: string;
    es_admin?: boolean;
    permisos?: string[];
  } | null;
}

export interface EmpleadoLoginResult {
  success: boolean;
  message?: string;
  token?: string;
  empleado?: EmpleadoPerfil | null;
  broker?: any | null;
  permisos?: string[] | null;
}

const TOKEN_KEY = 'empleado_token';
const PROFILE_KEY = 'empleado_profile';

class EmpleadoAuthService {
  private getAuthHeaders(extra: Record<string, string> = {}) {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extra,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  setToken(token: string | null) {
    try {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }

  getPerfilCache(): EmpleadoPerfil | null {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      return raw ? JSON.parse(raw) as EmpleadoPerfil : null;
    } catch {
      return null;
    }
  }

  setPerfilCache(profile: EmpleadoPerfil | null) {
    try {
      if (profile) {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      } else {
        localStorage.removeItem(PROFILE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  async login(identifier: string, password: string): Promise<EmpleadoLoginResult> {
    try {
      const res = await fetch(`${API_BASE_URL}/empleado-auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Enviar identifier y alias comunes para compatibilidad backend (email/username)
        body: JSON.stringify({ identifier, email: identifier, username: identifier, password }),
      });

      const data = await res.json().catch(() => ({} as any));

      if (!res.ok || data?.success === false) {
        const fieldError =
          (data?.errors?.identifier && data.errors.identifier[0]) ||
          (data?.errors?.email && data.errors.email[0]) ||
          (data?.errors?.password && data.errors.password[0]) ||
          data?.error ||
          data?.message;
        return { success: false, message: fieldError || `Error HTTP: ${res.status}` };
      }

      // Backend actual devuelve firebase_custom_token en data.data.firebase_custom_token
      const payload = data?.data ?? data ?? {};
      const customToken: string | undefined =
        payload.firebase_custom_token || payload.custom_token || data.firebase_custom_token;

      const empleado: EmpleadoPerfil | null =
        payload.empleado || data.empleado || payload.profile || payload.user || null;

      if (customToken) {
        // Iniciar sesión en Firebase con Custom Token unificado
        await signInWithCustomToken(auth, customToken);
        // Marcar sesión de empleado a nivel local (sentinela) para gating de UI
        this.setToken('FIREBASE');
        if (empleado) {
          this.setPerfilCache(empleado);
        }
        return {
          success: true,
          token: 'FIREBASE',
          empleado,
          message: data.message || 'Inicio de sesión exitoso',
        };
      }

      // Fallback legacy: token propio del backend (no recomendado)
      const legacyToken: string | undefined = data.token || data.access_token || data.jwt;
      if (legacyToken) {
        this.setToken(legacyToken);
      } else {
        // Si no hay ningún tipo de token, limpiar por seguridad
        this.setToken(null);
      }
      if (empleado) {
        this.setPerfilCache(empleado);
      }

      return {
        success: true,
        token: legacyToken,
        empleado,
        message: data.message || 'Inicio de sesión exitoso',
      };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Error de red al iniciar sesión' };
    }
  }

  async logout(): Promise<{ success: boolean; message?: string }> {
    const token = this.getToken();
    try {
      if (token) {
        await fetch(`${API_BASE_URL}/empleado-auth/logout`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({}),
        }).catch(() => undefined);
      }
    } finally {
      this.setToken(null);
      this.setPerfilCache(null);
    }
    return { success: true, message: 'Sesión de empleado cerrada' };
  }

  async validarToken(): Promise<{ valid: boolean; token?: string }> {
    const token = this.getToken();
    if (!token) return { valid: false };
    if (token === 'FIREBASE') {
      // Sesión basada en Firebase Custom Token: el ID Token lo aporta Firebase
      return { valid: true, token };
    }

    try {
      const res = await fetch(`${API_BASE_URL}/empleado-auth/validar-token`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });

      if (!res.ok) return { valid: false };

      const data = await res.json().catch(() => ({}));
      // Si backend retorna un nuevo token, guardarlo
      const maybeNewToken: string | undefined = data.token || data.access_token || data.jwt;
      if (maybeNewToken && maybeNewToken !== token) {
        this.setToken(maybeNewToken);
        return { valid: true, token: maybeNewToken };
      }
      return { valid: true, token };
    } catch {
      return { valid: false };
    }
  }

  async perfil(forceRefresh = false): Promise<EmpleadoPerfil | null> {
    if (!forceRefresh) {
      const cached = this.getPerfilCache();
      if (cached) return cached;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/empleado-auth/perfil`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      if (!res.ok) return null;
      const data = await res.json().catch(() => ({}));
      const empleado: EmpleadoPerfil | null = data.empleado || data.profile || data.data || null;
      if (empleado) {
        this.setPerfilCache(empleado);
      }
      return empleado;
    } catch {
      return null;
    }
  }
}

export const empleadoAuth = new EmpleadoAuthService();
export default empleadoAuth;