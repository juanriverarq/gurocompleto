// Configuración centralizada de la aplicación
// Detectar automáticamente si estamos en producción basándose en el hostname
const getApiBaseUrl = (): string => {
  // 1. Primero intentar variable de entorno
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // 2. Runtime override
  if (typeof window !== 'undefined' && (window as any).__ENV__?.API_BASE_URL) {
    return (window as any).__ENV__.API_BASE_URL;
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

export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  ENDPOINTS: {
    AUTH: {
      SYNC_FIREBASE_USER: '/auth/sync-firebase-user',
      PROFILE: '/auth/profile',
      LOGOUT: '/auth/logout',
    },
    SAAS: {
      ME: '/saas/me-simple',
      ROLES: '/saas/roles',
      ONBOARDING: '/saas/onboarding/create-broker',
      POLIZAS: '/saas/polizas',
      CLIENTES: '/saas/clientes',
      SINIESTROS: '/saas/siniestros',
    },
  },
};

// URL completas para facilitar el uso
export const API_URLS = {
  SYNC_FIREBASE_USER: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.SYNC_FIREBASE_USER}`,
  SAAS_ME: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SAAS.ME}`,
  SAAS_ROLES: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SAAS.ROLES}`,
  SAAS_ONBOARDING: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SAAS.ONBOARDING}`,
  SAAS_POLIZAS: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SAAS.POLIZAS}`,
  SAAS_CLIENTES: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SAAS.CLIENTES}`,
  SAAS_SINIESTROS: `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.SAAS.SINIESTROS}`,
};

export default API_CONFIG;
