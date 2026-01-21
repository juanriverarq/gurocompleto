import axios from 'axios';
import { auth } from './firebase';

// Configuración base de la API
// Detectar automáticamente si estamos en producción basándose en el hostname
const getApiBaseUrl = (): string => {
  // 1. Runtime override
  if (typeof window !== 'undefined' && (window as any).__ENV__?.API_BASE_URL) {
    return (window as any).__ENV__.API_BASE_URL;
  }
  
  // 2. Variable de entorno
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // 3. Detectar producción por hostname
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'guro.co' || hostname === 'www.guro.co' || hostname.endsWith('.guro.co')) {
      return 'https://app.guro.co/api';
    }
  }
  
  // 4. Fallback para desarrollo local
  return 'http://localhost:8081/api';
};

export const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: true,
});

// Interceptor de request para agregar token con espera a Firebase init
api.interceptors.request.use(
  async (config) => {
    try {
      const method = (config.method || 'GET').toUpperCase();
      const urlPath = typeof config.url === 'string' ? config.url : '';
      const base = config.baseURL || '';
      const fullUrl = base && urlPath && urlPath.startsWith('http') ? urlPath : `${base}${urlPath}`;

      // Endpoints que EXIGEN token de Firebase (no permiten DEV_BYPASS)
      const mustUseFirebase = (path: string) => {
        if (!path) return false;
        // Soporta rutas con o sin prefijo /api
        return path.includes('/pricing/') || path.endsWith('/auth/sync-firebase-user');
      };

      // Espera breve para que Firebase inicialice al navegar/recargar
      const maxWait = 1200;
      const start = Date.now();
      if (!auth.currentUser) {
        console.log('⏳ Esperando Firebase auth...', { method, url: urlPath });
      }
      while (!auth.currentUser && Date.now() - start < maxWait) {
        await new Promise((r) => setTimeout(r, 150));
      }

      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        (config.headers as any).Authorization = `Bearer ${token}`;

        // Para empleados autenticados con Firebase, añadir header de broker
        const empleadoPerfil = localStorage.getItem('empleado_profile');
        if (empleadoPerfil) {
          try {
            const perfil = JSON.parse(empleadoPerfil);
            if (perfil.broker_id) {
              (config.headers as any)['X-Dev-Broker-Id'] = perfil.broker_id.toString();
              console.log('🏢 [REQ] broker_id agregado para empleado', {
                broker_id: perfil.broker_id,
                url: urlPath,
              });
            }
          } catch (e) {
            console.warn('🟨 Error parseando perfil de empleado:', e);
          }
        }
      } else {
        // Fallback: token de empleado si no hay usuario Firebase
        const empleadoToken = localStorage.getItem('empleado_token');
        const devBypass = (import.meta as any).env?.VITE_DEV_AUTH_BYPASS === 'true';
        const devBrokerId = (import.meta as any).env?.VITE_DEV_BROKER_ID || '2';

        // Si el endpoint requiere Firebase, NO permitir DEV_BYPASS ni token de empleado
        if (mustUseFirebase(urlPath) || mustUseFirebase(fullUrl)) {
          console.warn('🚫 [REQ] Endpoint requiere Firebase. Bloqueando DEV_BYPASS/empleado.', {
            method,
            url: urlPath,
          });
          // Forzar error temprano para que el caller redirija a registro/login
          const err: any = new Error('NEEDS_FIREBASE_AUTH');
          err.code = 'NEEDS_FIREBASE_AUTH';
          throw err;
        }

        // Soporte DEV_BYPASS (empleado_token='DEV_BYPASS' o flag de entorno activo)
        if (empleadoToken === 'DEV_BYPASS' || (!empleadoToken && devBypass)) {
          (config.headers as any).Authorization = 'Bearer DEV_BYPASS';
          (config.headers as any)['X-Dev-Broker-Id'] = String(devBrokerId);
          (config.headers as any)['X-Dev-Mode'] = 'true';
          console.log('🧪 [REQ] DEV_BYPASS activo', {
            broker_id: devBrokerId,
            method,
            url: urlPath,
          });
        } else if (empleadoToken) {
          (config.headers as any).Authorization = `Bearer ${empleadoToken}`;

          // Para empleados, añadir header de broker si está en perfil local
          const empleadoPerfil = localStorage.getItem('empleado_profile');
          if (empleadoPerfil) {
            try {
              const perfil = JSON.parse(empleadoPerfil);
              if (perfil.broker_id) {
                (config.headers as any)['X-Dev-Broker-Id'] = perfil.broker_id.toString();
                console.log('🏢 [REQ] broker_id agregado para empleado', {
                  broker_id: perfil.broker_id,
                  url: urlPath,
                });
              }
            } catch (e) {
              console.warn('🟨 Error parseando perfil de empleado:', e);
            }
          }
        } else {
          console.warn('🟨 [REQ] sin token', { method, url: urlPath });
        }
      }
    } catch (error: any) {
      // Si explicitamente requiere Firebase, abortar la request
      if (error?.code === 'NEEDS_FIREBASE_AUTH') {
        return Promise.reject(error);
      }
      console.error('🔐 Request interceptor - Error obteniendo token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Variable para evitar múltiples intentos de refresh simultáneos
let isRefreshing = false;

// Interceptor de response para manejo de errores
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Si ya hay un refresh en curso, rechazar la petición
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Intentar refrescar token de Firebase primero
        const user = auth.currentUser;
        if (user) {
          console.log('🔄 Intentando refrescar token Firebase...');
          const newToken = await user.getIdToken(true); // Force refresh
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          console.log('✅ Token Firebase refrescado, reintentando petición...');
          isRefreshing = false;
          return api(originalRequest);
        }

        // Si no hay usuario Firebase, intentar refrescar token de empleado
        const empleadoToken = localStorage.getItem('empleado_token');
        if (empleadoToken) {
          console.log('🔄 Intentando refrescar token de empleado...');
          try {
            // Intentar refrescar token de empleado desde el backend
            const refreshResponse = await fetch(
              `${
                import.meta.env.VITE_API_URL || 'http://localhost:8081/api'
              }/empleado-auth/validar-token`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${empleadoToken}`,
                  'Content-Type': 'application/json',
                },
              },
            );

            if (refreshResponse.ok) {
              const data = await refreshResponse.json();
              if (data.success) {
                // Si el backend devuelve un nuevo token, usarlo
                const newToken = data.token || empleadoToken;
                if (newToken !== empleadoToken) {
                  localStorage.setItem('empleado_token', newToken);
                }
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                console.log('✅ Token de empleado validado/refrescado, reintentando petición...');
                isRefreshing = false;
                return api(originalRequest);
              }
            }
          } catch (empleadoRefreshError) {
            console.warn('❌ Error validando token de empleado:', empleadoRefreshError);
          }
        }

        console.warn('❌ No se pudo refrescar ningún token, redirigiendo al login...');
      } catch (refreshError) {
        console.error('❌ Error en refresh de token:', refreshError);
      } finally {
        isRefreshing = false;
      }

      // Si llegamos aquí, no se pudo refrescar el token
      // Solo redirigir si no estamos ya en páginas de auth
      const currentPath = window.location.pathname + window.location.search;
      const hasEmpleado =
        !!localStorage.getItem('empleado_token') || !!localStorage.getItem('empleado_data');
      const inAuth = currentPath.startsWith('/auth/');
      const inOnboarding = currentPath.startsWith('/onboarding/');
      const inEmpleadoLogin = currentPath.startsWith('/empleados/login');
      if (!inAuth && !inOnboarding && !inEmpleadoLogin) {
        const target = hasEmpleado ? '/empleados/login' : '/auth/auth1/login';
        console.log('🔄 Redirigiendo al login debido a token expirado...', {
          target,
          from: currentPath,
        });
        window.location.href = `${target}?redirect=${encodeURIComponent(currentPath)}`;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
